// QuickAdd: Кино - обновить роли актёров.
// Порядок источников: IMDb fullcredits/GraphQL, затем КП /cast/.
// В основной карточке остается только короткий индекс режиссера.
// "Актеры" и строки Role - Name хранятся в companion-файле _system/Роли.
// Постоянного HTTP-кэша нет. Успешный источник полностью заменяет поле;
// старое значение используется только если источник для этого поля недоступен.

const ROOT = "Кино";
const API = "https://movie-planner.ru/api/public";
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
let nextRequestAt = 0;

const ROLE_LINKS_BLOCK = [
    '<!-- KINO:ENTITY:LINKS:V3 -->',
    '```dataviewjs',
    'const KINO_ENTITY_FIELDS = [',
    '    ["Режисер", "Режиссер", "Кино - Открыть режиссера"],',
    '    ["Актеры", "Актеры", "Кино - Открыть актера"],',
    '    ["Жанр", "Жанры", "Кино - Открыть жанр"]',
    '];',
    '',
    'function kinoText(value) { return String(value ?? "").trim().normalize("NFC"); }',
    'function kinoValues(value) {',
    '    return [...new Set((Array.isArray(value) ? value : [value]).map(kinoText).filter(Boolean))];',
    '}',
    'function kinoName(value) {',
    '    const text = kinoText(value);',
    '    const actorNames = kinoValues(dv.current()["Актеры"]);',
    '    const known = actorNames.find(name =>',
    '        text === name || text.startsWith(name + " - ") || text.endsWith(" - " + name)',
    '    );',
    '    if (known) return known;',
    '    return text.includes(" - ") ? text.split(/\\s+-\\s+/).slice(-1)[0].trim() : text;',
    '}',
    'function kinoUri(choice, value) {',
    '    return "obsidian://quickadd?vault=" + encodeURIComponent(app.vault.getName())',
    '        + "&choice=" + encodeURIComponent(choice)',
    '        + "&value-entity=" + encodeURIComponent(value);',
    '}',
    '',
    'const actorRoles = kinoValues(dv.current()["Роли актеров"]);',
    'const root = dv.container.createDiv({ cls: "kino-entity-links" });',
    'for (const [field, label, choice] of KINO_ENTITY_FIELDS) {',
    '    const row = root.createDiv({ cls: "kino-entity-links-row" });',
    '    row.createEl("strong", { text: label + ": " });',
    '    const values = field === "Актеры"',
    '        ? (actorRoles.length ? actorRoles : kinoValues(dv.current()[field]))',
    '        : kinoValues(dv.current()[field]);',
    '    if (!values.length) { row.appendText("Не указано"); continue; }',
    '    if (field === "Актеры") {',
    '        values.forEach(value => {',
    '            const line = row.createDiv({ cls: "kino-entity-link-line" });',
    '            const link = line.createEl("a");',
    '            link.textContent = value;',
    '            link.href = kinoUri(choice, kinoName(value));',
    '        });',
    '        continue;',
    '    }',
    '    values.forEach((value, index) => {',
    '        if (index) row.appendText(" · ");',
    '        const link = row.createEl("a");',
    '        link.textContent = value;',
    '        link.href = kinoUri(choice, value);',
    '    });',
    '}',
    '```'
].join("\n");

module.exports = async function updateKinoRoles(params) {
    const { app, obsidian: ob } = params;
    let files = app.vault.getMarkdownFiles()
        .filter(file => isMedia(file, app))
        .filter(file => !isTemplate(file, app))
        .sort((a, b) => a.path.localeCompare(b.path, "ru"));
    const scope = params.variables?.kinoRolesScope || (params.quickAddApi?.suggester
        ? await params.quickAddApi.suggester(
            ["Только карточки из отчёта проверки", "Только открытая карточка", "Вся кинотека"],
            ["report", "active", "all"], "Какие карточки обновить?")
        : "report");
    if (!scope) return;
    if (scope === "active") files = files.filter(file => file.path === app.workspace.getActiveFile()?.path);
    else if (scope === "report") {
        const report = app.vault.getAbstractFileByPath(`${ROOT}/_system/Проверка кинотеки.md`);
        if (!report) { new ob.Notice("Сначала запусти проверку кинотеки."); return; }
        const selected = new Set();
        for (const match of (await app.vault.read(report)).matchAll(/\[\[(Кино\/[^\]|]+)/g)) {
            let target = match[1];
            if (target.startsWith(`${ROOT}/_system/Роли/`)) {
                target = `${ROOT}/` + target.split("/").pop().replace(/\.роли(?:\.md)?$/, ".md");
            }
            if (!target.endsWith(".md")) target += ".md";
            selected.add(target);
        }
        files = files.filter(file => selected.has(file.path));
    }
    if (!files.length) { new ob.Notice("В выбранном списке нет карточек для обновления."); return; }
    const notice = new ob.Notice(`Кино: роли актёров 0/${files.length}…`, 0);
    let processed = 0;
    let changed = 0;
    let foundRoles = 0;
    let foundDirectors = 0;
    let imdbSources = 0;
    let kpSources = 0;
    let skipped = 0;
    let failed = 0;
    let noRoleSource = 0;
    const noRoleFiles = [];

    try {
        for (const file of files) {
            processed++;
            const fm = app.metadataCache.getFileCache(file)?.frontmatter || {};
            const imdbId = extractImdbId(fm["imdb Id"]);
            const rolePath = roleFilePath(file);
            const roleFile = app.vault.getAbstractFileByPath(rolePath);
            const roleFm = roleFile ? app.metadataCache.getFileCache(roleFile)?.frontmatter || {} : {};
            const actorValue = roleFm.Актеры ?? fm.Актеры ?? [];
            const roleValue = roleFm["Роли актеров"] ?? fm["Роли актеров"] ?? [];
            const directorField = fm.Режисер !== undefined ? "Режисер" : "Режиссер";
            const directorValue = roleFm.Режисер ?? roleFm.Режиссер ?? fm[directorField] ?? [];
            const storedKpId = explicitKpId(fm) || explicitKpId(roleFm);
            const progress = stage => notice.setMessage?.(
                `Кино: ${processed}/${files.length} - ${file.basename} - ${stage}`
            );
            progress("подготовка");
            if (!imdbId && !storedKpId) {
                skipped++;
                continue;
            }

            try {
                const type = tagsOf(fm).includes("serial") ? "series" : "movie";
                progress("IMDb fullcredits / API");
                const imdbResult = imdbId
                    ? await getImdbCredits(ob, imdbId)
                    : { actors: [], directors: [] };
                const imdb = imdbResult.actors;
                const imdbDirectors = imdbResult.directors;
                if (imdb.length || imdbDirectors.length) imdbSources++;

                let kpId = storedKpId;
                let kp = [];
                let kpDirectors = [];
                if (!kpId && imdbId) {
                    progress("поиск ID Кинопоиска по IMDb ID");
                    kpId = await findKpId(ob, fm, file);
                }
                if (kpId) {
                    // КП читается всегда, когда ID известен. Это нужно для
                    // случая, когда IMDb вернул только часть fullcredits.
                    progress("Кинопоиск: полный /cast/");
                    const direct = await getKinopoiskCredits(ob, kpId, type);
                    kp = direct.actors;
                    kpDirectors = direct.directors;
                }
                if (kp.length || kpDirectors.length) kpSources++;

                const actorSource = chooseCreditSource([imdb, kp], "Актеры");
                const directorSource = chooseCreditSource([imdbDirectors, kpDirectors], "Режисер");
                const result = replacePeople(actorSource, "Актеры");
                const directorResult = replacePeople(directorSource, "Режисер");
                foundRoles += result.roles;
                foundDirectors += directorResult.values.length;
                const hasActorSource = result.values.length > 0;
                const hasDirectorSource = directorResult.values.length > 0;
                // Списки актёров и ролей теперь всегда живут во внешнем файле.
                // Если источник временно недоступен, сохраняем уже известное
                // значение из этого файла, а не затираем его пустым ответом.
                const oldActors = replacePeople(asArray(actorValue), "Актеры");
                const oldRoles = replacePeople(asArray(roleValue), "Актеры");
                const nextValue = hasActorSource ? result.values : oldActors.values;
                const nextActorRoles = hasActorSource ? result.displayValues : oldRoles.displayValues;
                const nextDirectorValue = hasDirectorSource
                    ? directorResult.values
                    : replacePeople(asArray(directorValue), "Режисер").values;
                const hasNewKpId = Boolean(kpId && !explicitKpId(fm));
                const roleChanged = !roleFile
                    || explicitKpId(roleFm) !== (kpId || "")
                    || extractImdbId(roleFm["imdb Id"]) !== imdbId
                    || roleFm["Основная карточка"] !== file.path
                    || JSON.stringify(nextValue) !== JSON.stringify(asArray(roleFm.Актеры))
                    || JSON.stringify(nextActorRoles) !== JSON.stringify(asArray(roleFm["Роли актеров"]))
                    || JSON.stringify(nextDirectorValue) !== JSON.stringify(asArray(roleFm.Режисер ?? roleFm.Режиссер));
                let frontmatterChanged = JSON.stringify(nextDirectorValue) !== JSON.stringify(asArray(fm[directorField]))
                    || JSON.stringify(nextDirectorValue) !== JSON.stringify(directorValue)
                    || hasNewKpId;
                let bodyChanged = false;
                if (frontmatterChanged) {
                    await app.fileManager.processFrontMatter(file, frontmatter => {
                        frontmatter[directorField] = nextDirectorValue;
                        if (hasNewKpId) frontmatter["Кинопоиск ID"] = kpId;
                    });
                }
                if (roleChanged) {
                    await writeRoleFile(app, file, fm, {
                        actors: nextValue,
                        roles: nextActorRoles,
                        directors: nextDirectorValue,
                        kpId: kpId || explicitKpId(fm),
                        genre: fm.Жанр
                    });
                }
                await app.vault.process(file, raw => {
                    const next = ensureRoleEmbed(raw, rolePath);
                    bodyChanged = next !== raw;
                    return next;
                });
                if (!frontmatterChanged && !roleChanged && !bodyChanged) {
                    if (!result.roles && !directorResult.values.length) noRoleSource++;
                    continue;
                }
                changed++;
                if (!result.roles && !directorResult.values.length) {
                    noRoleSource++;
                    noRoleFiles.push(file.basename);
                }
            } catch (error) {
                failed++;
                console.warn("Кино: не удалось получить роли", file.path, error);
            }
        }
    } finally {
        notice.hide?.();
    }

    const unresolved = noRoleFiles.length
        ? ` Не найдены: ${noRoleFiles.slice(0, 5).join(", ")}${noRoleFiles.length > 5 ? "…" : ""}.`
        : "";
    new ob.Notice(
        `Роли и люди: обработано ${processed}, изменено ${changed}, ролей ${foundRoles}, режиссеров ${foundDirectors}, IMDb ${imdbSources}, КП ${kpSources}, без ролей ${noRoleSource}, пропущено ${skipped}, ошибок ${failed}.${unresolved}`,
        15000
    );
};

function isMedia(file, app) {
    if (!file?.path?.startsWith(`${ROOT}/`) || file.path.slice(ROOT.length + 1).includes("/")) return false;
    const fm = app.metadataCache.getFileCache(file)?.frontmatter || {};
    return tagsOf(fm).some(tag => ["movies", "serial"].includes(tag));
}

function isTemplate(file, app) {
    const fm = app.metadataCache.getFileCache(file)?.frontmatter || {};
    return file.basename === "Без названия" && !String(fm.Название || "").trim();
}

function tagsOf(fm) {
    return toList(fm?.tags).map(value => String(value).replace(/^#/, "").toLowerCase());
}

function toList(value) {
    if (value === null || value === undefined || value === "") return [];
    return (Array.isArray(value) ? value : [value]).map(value => String(value).trim()).filter(Boolean);
}

function extractImdbId(value) {
    return String(value || "").match(/\btt\d{7,12}\b/i)?.[0].toLowerCase() || "";
}

function extractKpId(value) {
    const text = String(value || "").trim().replace(/^['"]|['"]$/g, "");
    if (/^\d{1,12}$/.test(text)) return text;
    return text.match(/(?:kinopoisk\.ru\/(?:film|series)\/|movie-planner\.ru\/f\/|(?:^|[\s:])(?:kp|кп)\s*[:#]?\s*)(\d{1,12})/i)?.[1] || "";
}

function explicitKpId(fm) {
    for (const key of ["Кинопоиск ID", "Кинопоиск Id", "kinopoiskId", "kp_id", "kpId", "КП ID", "КП"]) {
        const id = extractKpId(fm?.[key]);
        if (id) return id;
    }
    for (const key of ["Кинопоиск URL", "kinopoiskUrl", "КП URL"]) {
        const id = extractKpId(fm?.[key]);
        if (id) return id;
    }
    return "";
}

async function request(ob, url, accept, headers = {}) {
    for (let attempt = 0; attempt < 2; attempt++) {
        await sleep(Math.max(0, nextRequestAt - Date.now()));
        nextRequestAt = Date.now() + 900;
        let timer;
        try {
            const response = await Promise.race([
                ob.requestUrl({
                    url,
                    method: "GET",
                    throw: false,
                    headers: {
                        Accept: accept,
                        "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
                        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/131 Safari/537.36",
                        ...headers
                    }
                }),
                new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("timeout")), 20000); })
            ]);
            if ([429, 503].includes(response.status)) {
                nextRequestAt = Date.now() + 5000;
                continue;
            }
            if (response.status !== 200) return "";
            return accept.includes("json") ? response.json : String(response.text || "");
        } catch {
            nextRequestAt = Date.now() + 2500;
        } finally {
            clearTimeout(timer);
        }
    }
    return null;
}

async function getJson(ob, base, params = {}) {
    const url = new URL(base);
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, String(value)));
    return request(ob, url.href, "application/json");
}

async function getText(ob, url, headers = {}) {
    return request(ob, url, "text/html,application/xhtml+xml", headers);
}

async function postJson(ob, url, body, headers = {}) {
    for (let attempt = 0; attempt < 2; attempt++) {
        await sleep(Math.max(0, nextRequestAt - Date.now()));
        nextRequestAt = Date.now() + 900;
        let timer;
        try {
            const response = await Promise.race([
                ob.requestUrl({
                    url,
                    method: "POST",
                    throw: false,
                    body: JSON.stringify(body),
                    headers: {
                        Accept: "application/json",
                        "Content-Type": "application/json",
                        "Accept-Language": "en-US,en;q=0.9,ru;q=0.8",
                        "Origin": "https://www.imdb.com",
                        Referer: "https://www.imdb.com/",
                        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/131 Safari/537.36",
                        ...headers
                    }
                }),
                new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("timeout")), 20000); })
            ]);
            if ([429, 503].includes(response.status)) {
                nextRequestAt = Date.now() + 5000;
                continue;
            }
            if (response.status !== 200) return null;
            if (response.json && typeof response.json === "object") return response.json;
            return JSON.parse(String(response.text || "{}"));
        } catch {
            nextRequestAt = Date.now() + 2500;
        } finally {
            clearTimeout(timer);
        }
    }
    return null;
}

async function findKpId(ob, fm, file) {
    const imdbId = extractImdbId(fm["imdb Id"]);
    if (!imdbId) return "";
    const directSearch = await getJson(ob, `${API}/search`, { q: imdbId, limit: 24, person_limit: 0 });
    const exact = (directSearch?.items || []).filter(item => extractImdbId(item.imdb_id || item.imdbID) === imdbId);
    const exactIds = [...new Set(exact.map(item => String(item.kp_id || "")).filter(Boolean))];
    if (exactIds.length === 1) return exactIds[0];

    const wiki = await getJson(ob, "https://query.wikidata.org/sparql", {
        format: "json",
        query: `SELECT DISTINCT ?kp WHERE { ?item wdt:P345 "${imdbId}" . ?item wdt:P2603 ?kp . } LIMIT 5`
    });
    const wikiIds = [...new Set((wiki?.results?.bindings || [])
        .map(row => row.kp?.value).filter(value => /^\d+$/.test(String(value || ""))))];
    if (wikiIds.length === 1) return wikiIds[0];

    // Одного совпавшего года/типа недостаточно. Без точной связи по IMDb
    // оставляем ID пустым: чужая карточка перезаписала бы весь состав.
    return "";
}

async function getKpDetails(ob, kpId) {
    if (!/^\d{1,12}$/.test(String(kpId || ""))) return null;
    const result = await getJson(ob, `${API}/film/${kpId}`);
    return result?.film ? { ...result.film, cast: result.cast || {} } : null;
}

function asPeople(value) {
    return Array.isArray(value) ? value : value ? [value] : [];
}

function normalizeApiCredit(person) {
    const names = creditNameParts(person, "mixed");
    const role = personRoleParts(person);
    return {
        name_en: person?.name_en || names.english || "",
        name_ru: person?.name_ru || names.russian || "",
        display_name: person?.display_name || names.raw || names.english || names.russian || "",
        role: person?.role || role.english || role.russian || "",
        role_en: person?.role_en || role.english || "",
        role_ru: person?.role_ru || role.russian || ""
    };
}

function normalizeKpApiCast(cast) {
    const rawActors = asPeople(cast?.actors ?? cast?.actor ?? cast?.cast);
    const rawDirectors = [...asPeople(cast?.directors), ...asPeople(cast?.director)];
    const actors = rawActors.map(normalizeApiCredit)
        .filter(person => person.name_en || person.name_ru);
    const directors = uniquePeople(rawDirectors.map(normalizeApiCredit)
        .filter(person => person.name_en || person.name_ru));
    return { actors: uniqueRoleCredits(actors), directors };
}

function uniqueRoleCredits(values) {
    const result = [];
    const seen = new Set();
    for (const person of values || []) {
        const name = sourcePersonName(person);
        const role = sourcePersonRole(person, "Актеры");
        const key = `${name.toLocaleLowerCase("en")}|${role.toLocaleLowerCase("ru")}`;
        if (!name || seen.has(key)) continue;
        seen.add(key);
        result.push(person);
    }
    return result;
}

function mergeKpCredits(left, right) {
    return {
        actors: uniqueRoleCredits([...(left?.actors || []), ...(right?.actors || [])]),
        directors: uniquePeople([...(left?.directors || []), ...(right?.directors || [])])
    };
}

async function getKpApiCredits(ob, kpId) {
    const details = await getKpDetails(ob, kpId);
    return normalizeKpApiCast(details?.cast);
}

function decodeHtml(value) {
    return String(value ?? "")
        .replace(/&#(x[0-9a-f]+|[0-9]+);/gi, (_, code) => {
            const number = code[0].toLowerCase() === "x" ? parseInt(code.slice(1), 16) : parseInt(code, 10);
            return Number.isFinite(number) ? String.fromCodePoint(number) : _;
        })
        .replace(/&nbsp;/gi, " ").replace(/&quot;/gi, '"').replace(/&apos;|&#39;/gi, "'")
        .replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">");
}

function htmlPlain(value) {
    return decodeHtml(String(value || "")
        .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
        .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
        .replace(/<br\s*\/?\s*>/gi, "\n")
        .replace(/<\/(?:div|p|li|tr|section|article|h[1-6]|dd|dt)>/gi, "\n")
        .replace(/<[^>]+>/g, " "))
        .replace(/[ \t]+/g, " ").replace(/\n[ \t]+/g, "\n").trim();
}

function valueText(value) {
    if (value === null || value === undefined) return "";
    if (typeof value === "string" || typeof value === "number") return String(value).trim();
    if (Array.isArray(value)) return value.map(valueText).filter(Boolean).join(" / ");
    if (typeof value === "object") {
        for (const key of ["text", "value", "name", "displayName", "label", "title"]) {
            const text = valueText(value[key]);
            if (text) return text;
        }
    }
    return "";
}

function splitBilingualText(value) {
    const text = htmlPlain(String(value ?? "")).replace(/\s+/g, " ").trim();
    if (!text) return { english: "", russian: "" };
    const pair = text.match(/^(.+?)\s*\(([^()]*)\)$/);
    if (pair && /[a-z]/i.test(pair[1]) && /[а-яё]/i.test(pair[2])) {
        return { english: pair[1].trim(), russian: pair[2].trim() };
    }
    if (pair && /[а-яё]/i.test(pair[1]) && /[a-z]/i.test(pair[2])) {
        return { english: pair[2].trim(), russian: pair[1].trim() };
    }
    const main = text.replace(/\s+\((?:в титрах|in credits|credited as|credit(?:ed)? as)[\s\S]*$/i, "").trim();
    const russianFirst = main.match(/^(.+?[А-ЯЁа-яё][А-ЯЁа-яё .,'’`-]*)\s+([A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ .,'’`-]*)$/u);
    if (russianFirst) {
        return { english: russianFirst[2].trim(), russian: russianFirst[1].trim() };
    }
    const englishFirst = main.match(/^([A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ .,'’`-]*)\s+(.+?[А-ЯЁа-яё][А-ЯЁа-яё .,'’`-]*)$/u);
    if (englishFirst) {
        return { english: englishFirst[1].trim(), russian: englishFirst[2].trim() };
    }
    return {
        english: /[a-z]/i.test(text) && !/[а-яё]/i.test(text) ? text : "",
        russian: /[а-яё]/i.test(text) ? text : ""
    };
}

function roleText(value) {
    const text = valueText(value).replace(/^['"]|['"]$/g, "").replace(/\s+/g, " ").trim();
    const cleaned = text
        .replace(/^(?:as|в роли)\s+/i, "")
        .replace(/\s*,\s*\$[\d\s.,]+.*$/i, "")
        .replace(/\s+\d+\.\s*$/, "")
        .trim();
    if (!cleaned || /^(actor|actress|cast|act[её]р|актриса)$/i.test(cleaned)) return "";
    if (/^(режиссёр|режиссер|director|producer|продюсер|writer|сценарист|оператор|cinematographer|монтажёр|монтажер|editor)$/i.test(cleaned)
        || /(?:режисс[её]р|продюсер|сценарист|оператор|монтаж[её]р|художник|композитор|костюм|грим|director|producer|writer|cinematographer|editor)/i.test(cleaned)) return "";
    return cleaned;
}

function transliterateEnglishToRussian(value) {
    const digraphs = [["tch", "ч"], ["sch", "ш"], ["sh", "ш"], ["ch", "ч"], ["th", "т"],
        ["ph", "ф"], ["kh", "х"], ["zh", "ж"], ["ts", "ц"], ["qu", "кв"], ["ck", "к"],
        ["ya", "я"], ["yu", "ю"], ["yo", "ё"], ["ee", "и"], ["oo", "у"], ["ou", "ау"], ["ow", "оу"]];
    const chars = { a: "а", b: "б", c: "к", d: "д", e: "е", f: "ф", g: "г", h: "х", i: "и",
        j: "дж", k: "к", l: "л", m: "м", n: "н", o: "о", p: "п", q: "к", r: "р", s: "с",
        t: "т", u: "у", v: "в", w: "в", x: "кс", y: "й", z: "з" };
    const source = String(value || "").toLocaleLowerCase("en");
    let result = "";
    for (let index = 0; index < source.length;) {
        const rest = source.slice(index);
        const digraph = digraphs.find(([from]) => rest.startsWith(from));
        if (digraph) {
            result += digraph[1];
            index += digraph[0].length;
            continue;
        }
        result += chars[source[index]] ?? source[index];
        index++;
    }
    return result.replace(/ие(?=\s|[\/,;:.)]|$)/g, "и")
        .replace(/(^|[\s-])([а-яё])/g, (_, prefix, char) => prefix + char.toLocaleUpperCase("ru"));
}

function roleRussianFromEnglish(value) {
    const text = roleText(value);
    if (!text || /[а-яё]/i.test(text) && !/[a-z]/i.test(text)) return text;
    const exact = {
        cathy: "Кэти",
        lewis: "Льюис",
        dennis: "Деннис",
        jen: "Джен",
        jarrod: "Джаррод"
    }[text.toLocaleLowerCase("en")];
    if (exact) return exact;
    const phrases = [
        ["scenes deleted", "сцены вырезаны"], ["uncredited", "в титрах не указан"],
        ["himself", "самого себя"], ["herself", "саму себя"], ["themselves", "самих себя"],
        ["voice", "голос"], ["narrator", "рассказчик"], ["waitress", "официантка"],
        ["waiter", "официант"], ["attorney", "адвокат"], ["prosecutor", "прокурор"],
        ["ranger", "рейнджер"], ["doctor", "доктор"], ["professor", "профессор"],
        ["detective", "детектив"], ["police officer", "полицейский"], ["customer", "посетитель"],
        ["woman", "женщина"], ["man", "мужчина"], ["girl", "девушка"], ["boy", "мальчик"],
        ["mother", "мать"], ["father", "отец"], ["wife", "жена"], ["husband", "муж"],
        ["brother", "брат"], ["sister", "сестра"], ["young", "молодой"], ["old", "старый"]
    ];
    const placeholders = [];
    let translated = text;
    for (const [english, russian] of phrases) {
        const token = `\uE000${placeholders.length}\uE001`;
        const expression = new RegExp(`(^|[^A-Za-z])${english.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![A-Za-z])`, "gi");
        if (expression.test(translated)) {
            translated = translated.replace(expression, (_, prefix) => prefix + token);
            placeholders.push(russian);
        }
    }
    translated = translated.split(/([A-Za-zÀ-ÖØ-öø-ÿ]+)/u).map(part =>
        /[A-Za-zÀ-ÖØ-öø-ÿ]/u.test(part) ? transliterateEnglishToRussian(part) : part
    ).join("");
    return translated.replace(/\uE000(\d+)\uE001/g, (_, index) => placeholders[Number(index)] || "");
}

function personRoleParts(person) {
    if (person && typeof person === "object" && (person.role_en || person.role_ru
        || person.character_en || person.character_ru || person.english || person.russian)) {
        const english = roleText(person.role_en || person.character_en || person.english || "");
        const russian = roleText(person.role_ru || person.character_ru || person.russian || "");
        if (english || russian) return { english, russian: russian || roleRussianFromEnglish(english) };
    }
    const raw = typeof person === "string"
        ? roleValueParts(person).role || ""
        : ["role", "character", "character_name", "characterName", "role_name", "roleName",
            "characters", "roles", "played_as", "playedAs"].map(key => roleText(person?.[key])).find(Boolean) || "";
    const pair = splitBilingualText(raw);
    const english = pair.english || (/[a-z]/i.test(raw) && !/[а-яё]/i.test(raw) ? roleText(raw) : "");
    const russian = pair.russian || (/[а-яё]/i.test(raw) && !/[a-z]/i.test(raw) ? roleText(raw) : "")
        || roleRussianFromEnglish(english);
    return { english, russian };
}

function personRole(person) {
    const parts = personRoleParts(person);
    return parts.english && parts.russian
        ? `${parts.english} (${parts.russian})`
        : parts.english || parts.russian || "";
}

function creditNameParts(node, source) {
    const values = [];
    const separated = { english: "", russian: "" };
    const add = value => {
        const text = valueText(value);
        if (text && !values.includes(text)) values.push(text);
        const pair = splitBilingualText(text);
        if (!separated.english && pair.english) separated.english = pair.english;
        if (!separated.russian && pair.russian) separated.russian = pair.russian;
        for (const part of [pair.english, pair.russian]) {
            if (part && !values.includes(part)) values.push(part);
        }
    };
    if (typeof node === "string") add(node);
    else if (node && typeof node === "object") {
        const keys = source === "kp"
            ? ["name_ru", "russian_name", "name", "displayName", "title"]
            : source === "imdb"
                ? ["name_en", "english_name", "original_name", "name", "displayName", "title"]
                : ["name_en", "name_ru", "english_name", "russian_name", "original_name", "name", "displayName", "title"];
        keys.forEach(key => add(node[key]));
        if (node.nameText) add(node.nameText);
        if (node.name && typeof node.name === "object") {
            add(node.name.nameText); add(node.name.displayName); add(node.name.text);
        }
    }
    return {
        english: separated.english || values.find(value => /[a-z]/i.test(value) && !/[а-яё]/i.test(value)) || "",
        russian: separated.russian || values.find(value => /[а-яё]/i.test(value) && !/[a-z]/i.test(value)) || "",
        raw: values[0] || ""
    };
}

function collectJsonCredits(node, source, result = [], seen = new WeakSet()) {
    if (!node || typeof node !== "object" || seen.has(node)) return result;
    seen.add(node);
    if (Array.isArray(node)) {
        node.forEach(item => collectJsonCredits(item, source, result, seen));
        return result;
    }
    const role = personRoleParts(node);
    const nestedPerson = node.person || node.actor || node.personInfo || node.castMember;
    const directNames = creditNameParts(node, source);
    const nestedNames = creditNameParts(nestedPerson, source);
    const names = {
        english: directNames.english || nestedNames.english,
        russian: directNames.russian || nestedNames.russian
    };
    if ((role.english || role.russian) && (names.english || names.russian) && (node.id || node.nconst || node.href || node.url
        || node.personId || node.kinopoiskId || node.name || node.nameText || nestedPerson)) {
        result.push({ name_en: names.english, name_ru: names.russian,
            display_name: directNames.raw || nestedNames.raw || names.english || names.russian,
            role: role.english || role.russian, role_en: role.english, role_ru: role.russian });
    }
    Object.values(node).forEach(value => collectJsonCredits(value, source, result, seen));
    return result;
}

function parseEmbeddedCredits(html, source) {
    const result = [];
    for (const match of String(html || "").matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
        const attrs = match[1] || "";
        const body = match[2].trim();
        if (!/application\/json|__NEXT_DATA__|initial/i.test(attrs + body.slice(0, 80))) continue;
        try { collectJsonCredits(JSON.parse(body.replace(/^<!--|-->$/g, "").trim()), source, result); } catch { }
    }
    return result;
}


function parseCredits(html, source) {
    const values = parseEmbeddedCredits(html, source);
    const links = [...String(html || "").matchAll(/<a\b[^>]*href=['"][^'"]*\/name\/(?:nm)?\d+[^'"]*['"][^>]*>([\s\S]*?)<\/a>/gi)];
    links.forEach((match, index) => {
        const name = htmlPlain(match[1]);
        const next = links[index + 1]?.index ?? Math.min(String(html).length, (match.index || 0) + 2400);
        const role = personRoleParts({ role: roleFromChunk(String(html).slice(match.index || 0, next)) });
        const names = creditNameParts(name, source);
        if (name && (role.english || role.russian) && (names.english || names.russian)) {
            values.push({ name_en: names.english, name_ru: names.russian,
                display_name: name,
                role: role.english || role.russian, role_en: role.english, role_ru: role.russian });
        }
    });
    return uniqueCredits(values);
}

function imdbSectionBefore(html, index) {
    const plain = htmlPlain(String(html || "").slice(0, index)).replace(/\s+/g, " ").trim();
    const markers = [...plain.matchAll(/(?:^|\s)(Full\s+Cast|Cast|Directed\s+by|Director|Directors)(?=\s|$)/gi)];
    const marker = markers.at(-1)?.[1] || "";
    if (/directed\s+by|directors?/i.test(marker)) return "director";
    if (/full\s+cast|cast/i.test(marker)) return "actor";
    return "";
}

function parseImdbFullcredits(html) {
    const actors = [...parseEmbeddedCredits(html, "imdb")];
    const directors = [];
    const links = [...String(html || "").matchAll(/<a\b[^>]*href=['"][^'"]*\/name\/(?:nm)?\d+[^'"]*['"][^>]*>([\s\S]*?)<\/a>/gi)];
    links.forEach((match, index) => {
        const name = htmlPlain(match[1]);
        const next = links[index + 1]?.index ?? Math.min(String(html).length, (match.index || 0) + 2400);
        const chunk = String(html).slice(match.index || 0, next);
        const role = roleFromChunk(chunk);
        const section = imdbSectionBefore(html, match.index || 0);
        if (!name || name.length > 120 || (section !== "director" && !role)) return;
        const names = creditNameParts(name, "imdb");
        if (section === "director") {
            directors.push({ name_en: names.english || name, display_name: name });
        } else {
            actors.push({ name_en: names.english || name, display_name: name, role });
        }
    });
    return { actors: uniqueCredits(actors), directors: uniquePeople(directors) };
}

function kinopoiskSectionBefore(html, index) {
    const plain = htmlPlain(String(html || "").slice(0, index)).replace(/\s+/g, " ").trim();
    const markers = [...plain.matchAll(/(?:^|\s)(Режисс(?:е|ё)р(?:ы)?(?:\s+дубляжа)?|Акт(?:е|ё)ры(?:\s+дубляжа)?|Продюсеры|Сценаристы|Оператор|Композитор|Художники|Монтажер|Монтажёр)(?=\s|$)/gi)];
    const marker = markers.at(-1)?.[1]?.toLocaleLowerCase("ru") || "";
    if (marker.includes("режисс") && !marker.includes("дубляж")) return "director";
    if (marker.includes("актер") || marker.includes("актёр")) return marker.includes("дубляж") ? "" : "actor";
    return "";
}

function kinopoiskNameParts(anchorName, chunk) {
    const anchor = htmlPlain(anchorName).replace(/\s+/g, " ").trim();
    let plain = htmlPlain(chunk).replace(/\s+/g, " ").trim().replace(/^\d+\.\s*/, "");
    plain = plain.split(/\s+(?:\.\.\.|…)[ \t]*/)[0].trim();
    plain = plain.replace(/\s+(?:Акт(?:е|ё)ры|Режисс(?:е|ё)р(?:ы)?|Продюсеры|Сценаристы|Оператор|Композитор|Художники|Монтажер|Монтажёр)(?=\s|$)[\s\S]*$/i, "").trim();
    const names = creditNameParts(plain || anchor, "mixed");
    const anchorParts = creditNameParts(anchor, "mixed");
    return {
        english: names.english || anchorParts.english,
        russian: names.russian || anchorParts.russian,
        display: names.english || names.russian || anchorParts.english || anchorParts.russian || anchor
    };
}

function kinopoiskRoleFromChunk(chunk) {
    const role = roleFromChunk(chunk);
    if (role) return role;
    const plain = htmlPlain(chunk).replace(/\s+/g, " ").trim();
    const after = plain.match(/(?:\.\.\.|…)\s*(.+)$/)?.[1] || "";
    if (!after) return "";
    const withoutDub = after.replace(/\s+(?=[А-ЯЁ][А-ЯЁа-яё]+(?:\s+[А-ЯЁ][А-ЯЁа-яё]+){1,}(?:\s|$)).*$/u, "").trim();
    return roleText(withoutDub || after);
}

function sameCreditPerson(left, right) {
    const leftNames = [personEnglish(left), personRussian(left)].filter(Boolean);
    const rightNames = [personEnglish(right), personRussian(right)].filter(Boolean);
    return leftNames.some(leftName => rightNames.some(rightName => samePerson(leftName, rightName)));
}

function uniquePeople(values) {
    const result = [];
    for (const value of values || []) {
        const parts = creditNameParts(value, "mixed");
        const person = {
            name_en: value?.name_en || parts.english || "",
            name_ru: value?.name_ru || parts.russian || "",
            display_name: value?.display_name || parts.raw || parts.english || parts.russian || "",
            role: value?.role || "",
            role_en: value?.role_en || "",
            role_ru: value?.role_ru || ""
        };
        if (!(person.name_en || person.name_ru)) continue;
        const previous = result.find(item => sameCreditPerson(item, person));
        if (!previous) {
            result.push(person);
            continue;
        }
        previous.name_en ||= person.name_en;
        previous.name_ru ||= person.name_ru;
        previous.display_name ||= person.display_name;
        previous.role ||= person.role;
        previous.role_en ||= person.role_en;
        previous.role_ru ||= person.role_ru;
    }
    return result;
}

function normalizePeople(values) {
    return uniquePeople((Array.isArray(values) ? values : values ? [values] : []).map(value => {
        const parts = creditNameParts(value, "mixed");
        return { name_en: parts.english, name_ru: parts.russian,
            display_name: value?.display_name || parts.raw || parts.english || parts.russian };
    }));
}

function parseKinopoiskCastPage(html) {
    const actors = [...parseEmbeddedCredits(html, "kp")];
    const directors = [];
    const links = [...String(html || "").matchAll(/<a\b[^>]*href=['"][^'"]*\/name\/(?:nm)?\d+[^'"]*['"][^>]*>([\s\S]*?)<\/a>/gi)];
    links.forEach((match, index) => {
        const section = kinopoiskSectionBefore(html, match.index || 0);
        if (!section) return;
        const next = links[index + 1]?.index ?? Math.min(String(html).length, (match.index || 0) + 2400);
        const chunk = String(html).slice(match.index || 0, next);
        const names = kinopoiskNameParts(match[1], chunk);
        if (!(names.english || names.russian)) return;
        if (section === "director") {
            directors.push({ name_en: names.english, name_ru: names.russian,
                display_name: names.display });
        } else {
            actors.push({ name_en: names.english, name_ru: names.russian,
                display_name: names.display, role: kinopoiskRoleFromChunk(chunk) });
        }
    });
    return {
        actors: uniquePeople(actors),
        directors: uniquePeople(directors)
    };
}

function parseImdbGraphqlCredits(data) {
    const castEdges = data?.data?.title?.credits?.edges
        || data?.data?.title?.mainColumnData?.cast?.edges
        || [];
    const directorEdges = data?.data?.title?.directorCredits?.edges || [];
    const edges = [...castEdges, ...directorEdges];
    const actors = [];
    const directors = [];
    edges.forEach(edge => {
        const node = edge?.node || edge || {};
        const name = node.name || node.person || {};
        const nameEn = valueText(name.nameText?.text || name.nameText || name.text || name);
        if (!nameEn) return;
        const category = String(node.category?.id || node.category?.text || "").toLowerCase();
        if (category === "director" || category === "directors") {
            directors.push({ name_en: nameEn, display_name: nameEn });
            return;
        }
        // Любой узел с category - это съёмочная группа, а не актёр.
        if (category) return;
        const role = valueText(node.characters || node.character || node.roles)
            || valueText(node.attributes);
        if (role) actors.push({ name_en: nameEn, display_name: nameEn, role });
    });
    return { actors: normalizeCredits(actors, "imdb"), directors: uniquePeople(directors) };
}

async function getImdbGraphqlCredits(ob, imdbId) {
    const id = extractImdbId(imdbId);
    if (!id) return { actors: [], directors: [] };
    const query = `query TitleCredits($id: ID!, $after: ID) {
        title(id: $id) {
            credits(first: 100, after: $after) {
                edges {
                    node {
                        name { nameText { text } }
                        ... on Cast { characters { name } }
                        ... on Crew { category { id text } }
                        attributes { text }
                    }
                }
                pageInfo { hasNextPage endCursor }
            }
            directorCredits: credits(first: 10, filter: { categories: ["director"] }) {
                edges {
                    node {
                        name { nameText { text } }
                        ... on Crew { category { id text } }
                    }
                }
            }
        }
    }`;
    for (const endpoint of ["https://graphql.imdb.com/", "https://api.graphql.imdb.com/"]) {
        const actors = [];
        const directors = [];
        let after = null;
        for (let page = 0; page < 5; page++) {
            const data = await postJson(ob, endpoint, {
                operationName: "TitleCredits",
                query,
                variables: { id, after }
            });
            const credits = parseImdbGraphqlCredits(data);
            actors.push(...credits.actors);
            directors.push(...credits.directors);
            const pageInfo = data?.data?.title?.credits?.pageInfo;
            if (!pageInfo?.hasNextPage || !pageInfo.endCursor) break;
            after = pageInfo.endCursor;
        }
        const result = { actors: uniqueCredits(actors), directors: uniquePeople(directors) };
        if (result.actors.length || result.directors.length) return result;
    }
    return { actors: [], directors: [] };
}

async function getImdbCredits(ob, imdbId) {
    let parsed = { actors: [], directors: [] };
    for (const base of ["https://www.imdb.com", "https://m.imdb.com"]) {
        const html = await getText(ob, `${base}/title/${imdbId}/fullcredits/`, {
            Referer: `https://www.imdb.com/title/${imdbId}/`
        });
        parsed = parseImdbFullcredits(html);
        if (parsed.actors.length || parsed.directors.length) break;
    }
    const htmlCredits = parsed.actors;
    const graphqlCredits = await getImdbGraphqlCredits(ob, imdbId);
    return {
        actors: uniqueCredits([...htmlCredits, ...graphqlCredits.actors]),
        directors: uniquePeople([...parsed.directors, ...graphqlCredits.directors])
    };
}

async function getKinopoiskCredits(ob, kpId, type) {
    const paths = type === "series" ? ["series", "film"] : ["film", "series"];
    let pageCredits = { actors: [], directors: [] };
    for (const path of paths) {
        const html = await getText(ob, `https://www.kinopoisk.ru/${path}/${kpId}/cast/`, {
            Referer: `https://www.kinopoisk.ru/${path}/${kpId}/`
        });
        const cast = parseKinopoiskCastPage(html);
        const credits = parseCredits(html, "kp");
        pageCredits = mergeKpCredits(pageCredits, {
            actors: [...cast.actors, ...credits],
            directors: cast.directors
        });
    }
    const apiCredits = await getKpApiCredits(ob, kpId);
    return mergeKpCredits(pageCredits, apiCredits);
}

function baseKey(value) {
    return personName(value).replace(/\s*\([^()]*\)\s*$/, "").normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("ru").replace(/ё/g, "е")
        .replace(/[^0-9a-zа-я]/gi, "").replace(/iy/g, "y").replace(/ii/g, "y");
}

function roleValueParts(value) {
    const text = String(value || "").replace(/^\[\[([\s\S]+?)\]\]$/, "$1").trim();
    const match = text.match(/^(.+)\s+-\s+(.+)$/);
    return match
        ? { role: match[1].trim(), name: match[2].trim() }
        : { role: "", name: text };
}

function personName(value) {
    return roleValueParts(value).name;
}

function personParts(value) {
    const text = personName(value);
    const pair = text.match(/^(.+?)\s*\(([^()]*)\)$/);
    const bilingual = pair ? { english: "", russian: "" } : splitBilingualText(text);
    const values = pair ? [pair[1].trim(), pair[2].trim()] : [bilingual.english, bilingual.russian].filter(Boolean);
    return {
        english: values.find(part => /[a-z]/i.test(part) && !/[а-яё]/i.test(part)) || "",
        russian: values.find(part => /[а-яё]/i.test(part)) || ""
    };
}

function personEnglish(person) {
    const values = [typeof person === "string" ? person : "", person?.name_en, person?.english_name,
        person?.original_name, person?.name, person?.displayName];
    for (const value of values) if (personParts(value).english) return personParts(value).english;
    return "";
}

function personRussian(person) {
    const values = [typeof person === "string" ? person : "", person?.name_ru, person?.russian_name,
        person?.name, person?.displayName, person?.original_name];
    for (const value of values) if (personParts(value).russian) return personParts(value).russian;
    return "";
}

function transliterate(value) {
    const map = { а:"a", б:"b", в:"v", г:"g", д:"d", е:"e", ё:"yo", ж:"zh", з:"z", и:"i", й:"y", к:"k", л:"l", м:"m", н:"n", о:"o", п:"p", р:"r", с:"s", т:"t", у:"u", ф:"f", х:"kh", ц:"ts", ч:"ch", ш:"sh", щ:"shch", ъ:"", ы:"y", ь:"", э:"e", ю:"yu", я:"ya" };
    return String(value || "").toLocaleLowerCase("ru").split("").map(char => map[char] ?? char).join("");
}
function transliteratePersonName(value) {
    const extra = { і:"i", ї:"yi", є:"ye", ґ:"g", ў:"u", ђ:"dj", ј:"j", љ:"lj", њ:"nj", ћ:"c", џ:"dz", ѕ:"dz", ѓ:"gj", ќ:"kj", ә:"a", ғ:"gh", қ:"q", ң:"ng", ө:"o", ұ:"u", ү:"u", һ:"h", ӓ:"a", ӧ:"o", ӱ:"u", ӂ:"zh" };
    const result = String(value || "").split(/(\p{Script=Cyrillic}+)/u).map(part => {
        if (!/\p{Script=Cyrillic}/u.test(part)) return part;
        const latin = [...transliterate(part)].map(char => extra[char] ?? char).join("");
        return /^\p{Lu}/u.test(part)
            ? latin.charAt(0).toUpperCase() + latin.slice(1)
            : latin;
    }).join("").replace(/\s+/g, " ").trim();
    return /\p{Script=Cyrillic}/u.test(result) ? "" : result;
}

function personMatchKeys(value) {
    const parts = personParts(value);
    const candidates = [value, parts.english, parts.russian].filter(Boolean);
    const keys = new Set();
    for (const candidate of candidates) {
        const plain = String(candidate).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("ru");
        const transliterated = transliterate(candidate);
        [plain.replace(/[^0-9a-zа-яё]/gi, "").replace(/ё/g, "е"),
            transliterated.replace(/[^0-9a-z]/gi, ""), baseKey(candidate)]
            .filter(Boolean).forEach(key => keys.add(key));
    }
    return keys;
}

function samePerson(left, right) {
    const a = personMatchKeys(left);
    const b = new Set([...personMatchKeys(right), baseKey(right)].filter(Boolean));
    return [...a].some(key => b.has(key));
}

const PERSON_CANONICAL_OVERRIDES = {
    vitaliygogunskiy: "Vitaly Gogunsky (Виталий Гогунский)",
    vitalygogunsky: "Vitaly Gogunsky (Виталий Гогунский)",
    виталийгогунский: "Vitaly Gogunsky (Виталий Гогунский)",
    виталиигогунскии: "Vitaly Gogunsky (Виталий Гогунский)",
    evgeniyromantsov: "Evgeniy Romantsov (Евгений Романцов)",
    евгенийроманцов: "Evgeniy Romantsov (Евгений Романцов)",
    joeystarr: "JoeyStarr (Джои Старр)",
    джоистарр: "JoeyStarr (Джои Старр)",
    icecube: "Ice Cube (Айс Кьюб)",
    айскьюб: "Ice Cube (Айс Кьюб)",
    methodman: "Method Man (Метод Мэн)",
    методмэн: "Method Man (Метод Мэн)",
    vingrhames: "Ving Rhames (Винг Реймз)",
    вингреймз: "Ving Rhames (Винг Реймз)",
    thomasschnauz: "Thomas Schnauz (Томас Шнауц)",
    томасшнауц: "Thomas Schnauz (Томас Шнауц)",
    petergould: "Peter Gould (Питер Гулд)",
    питергулд: "Peter Gould (Питер Гулд)",
    michaelmorris: "Michael Morris (Майкл Моррис)",
    маиклморрис: "Michael Morris (Майкл Моррис)",
    майклморрис: "Michael Morris (Майкл Моррис)",
    adambernstein: "Adam Bernstein (Адам Бернштейн)",
    адамбернштеин: "Adam Bernstein (Адам Бернштейн)",
    mikhailshulaev: "Mikhail Shulaev (Михаил Шулаев)",
    михаилшулаев: "Mikhail Shulaev (Михаил Шулаев)"
};

function normalizePerson(value) {
    const role = personRole(value);
    let text = personName(value);
    for (let i = 0; i < 5; i++) {
        const match = text.match(/^(.+?)\s*\((.*)\)$/);
        if (!match || !match[2].includes("(")) break;
        const inner = match[2].replace(/^.*\(([^()]*)\)$/, "$1").trim();
        if (!inner || inner === match[2]) break;
        text = `${match[1].trim()} (${inner})`;
    }
    const pair = text.match(/^(.+?)\s*\(([^()]*)\)$/);
    const normalized = pair && baseKey(pair[1]) === baseKey(pair[2]) ? pair[1].trim() : text;
    return role && normalized ? `${role} - ${normalized}` : normalized;
}

function personPair(english, russian, role) {
    const canonical = PERSON_CANONICAL_OVERRIDES[baseKey(english)] || PERSON_CANONICAL_OVERRIDES[baseKey(russian)] || "";
    const first = personParts(canonical || english);
    const second = personParts(russian);
    const en = first.english || second.english || english || "";
    const ru = first.russian || second.russian || "";
    const result = en && ru && en !== ru ? `${en} (${ru})` : en || ru || personName(english);
    const roleParts = role && typeof role === "object" && (role.english || role.russian)
        ? role : personRoleParts(role);
    const finalRole = roleParts.english && roleParts.russian
        ? `${roleParts.english} (${roleParts.russian})`
        : roleParts.english || roleParts.russian || "";
    return finalRole && result ? `${finalRole} - ${result}` : result;
}

function normalizeCredits(values, source) {
    return uniqueCredits((values || []).map(person => {
        const parts = creditNameParts(person, source);
        return {
            name_en: person.name_en || parts.english,
            name_ru: person.name_ru || parts.russian,
            display_name: person.display_name || parts.raw || person.name_en || person.name_ru,
            ...personRoleParts(person)
        };
    }));
}

function uniqueCredits(values) {
    const result = new Map();
    for (const person of values || []) {
        const parts = creditNameParts(person, "mixed");
        const english = person?.name_en || parts.english;
        const russian = person?.name_ru || parts.russian;
        const role = personRoleParts(person);
        const roleKey = (role.english || role.russian || "").toLocaleLowerCase("ru");
        if (!roleKey || !(english || russian)) continue;
        const key = `${baseKey(english || russian)}|${roleKey}`;
        const previous = result.get(key);
        result.set(key, {
            name_en: previous?.name_en || english,
            name_ru: previous?.name_ru || russian,
            display_name: previous?.display_name || person?.display_name || parts.raw || english || russian,
            role: role.english || role.russian,
            role_en: previous?.role_en || role.english,
            role_ru: previous?.role_ru || role.russian
        });
    }
    return [...result.values()];
}

function sourcePersonName(person) {
    const candidates = typeof person === "string"
        ? [person]
        : [person?.name_en, person?.english_name, person?.original_name,
            person?.display_name, person?.source_name, person?.name_raw,
            person?.name, person?.name_ru];
    let fallback = "";
    for (const candidate of candidates.map(value => String(value || "").trim()).filter(Boolean)) {
        const text = (typeof person === "string" ? personName(candidate) : candidate).replace(/^\[\[([\s\S]+?)\]\]$/, "$1").trim();
        const parts = splitBilingualText(text);
        if (parts.english && !/\p{Script=Cyrillic}/u.test(parts.english)) return parts.english;
        if (!/\p{Script=Cyrillic}/u.test(text)) return text;
        fallback ||= parts.russian || text;
    }
    return transliteratePersonName(fallback);
}

function sourcePersonRole(person, field) {
    if (field !== "Актеры") return "";
    if (typeof person === "string") return roleValueParts(person).role;
    return String(person?.role_raw || person?.source_role || person?.role
        || person?.character || person?.character_name || person?.characterName
        || person?.role_en || person?.role_ru || "").trim();
}

function sourcePersonValue(person, field) {
    const name = sourcePersonName(person);
    if (!name || name.toUpperCase() === "N/A") return "";
    const role = sourcePersonRole(person, field);
    return role ? `${role} - ${name}` : name;
}

function chooseCreditSource(sources, field = "Актеры") {
    const available = (sources || []).filter(source => Array.isArray(source) && source.length);
    if (!available.length) return [];
    return field === "Актеры"
        ? available.find(source => source.some(person => sourcePersonRole(person, field))) || available[0]
        : available[0];
}

function replacePeople(source, field) {
    const values = [];
    const displayValues = [];
    const seenNames = new Set();
    const seenDisplays = new Set();
    let roles = 0;
    for (const person of source || []) {
        const display = sourcePersonValue(person, field).normalize("NFC").replace(/\s+/g, " ").trim();
        const name = sourcePersonName(person).normalize("NFC").replace(/\s+/g, " ").trim();
        if (!name || seenDisplays.has(display)) continue;
        seenDisplays.add(display);
        if (!seenNames.has(name)) {
            seenNames.add(name);
            values.push(name);
        }
        displayValues.push(display || name);
        if (field === "Актеры" && /\s+-\s+/.test(display)) roles++;
    }
    values.sort(comparePeopleValues);
    displayValues.sort(compareRoleValues);
    return { values, displayValues, roles, replaced: Boolean(source?.length) };
}

function comparePeopleValues(left, right) {
    const leftName = sourcePersonName(left);
    const rightName = sourcePersonName(right);
    return leftName.localeCompare(rightName, "en", { sensitivity: "base", numeric: true })
        || String(left).localeCompare(String(right), "en", { sensitivity: "base", numeric: true });
}

function compareRoleValues(left, right) {
    const leftRole = sourcePersonRole(left, "Актеры");
    const rightRole = sourcePersonRole(right, "Актеры");
    return leftRole.localeCompare(rightRole, "en", { sensitivity: "base", numeric: true })
        || sourcePersonName(left).localeCompare(sourcePersonName(right), "en", { sensitivity: "base", numeric: true });
}

function roleFilePath(file) {
    return `${ROOT}/_system/Роли/${file.basename}.роли.md`;
}

async function makeFolders(app, path) {
    let current = "";
    for (const part of path.split("/").slice(0, -1)) {
        current = current ? `${current}/${part}` : part;
        if (!app.vault.getAbstractFileByPath(current)) await app.vault.createFolder(current);
    }
}

async function writeRoleFile(app, mainFile, fm, values) {
    const rolePath = roleFilePath(mainFile);
    const title = String(fm.Название || mainFile.basename).trim();
    const content = [
        "---",
        `Название: ${JSON.stringify(title)}`,
        `Основная карточка: ${JSON.stringify(mainFile.path)}`,
        `imdb Id: ${JSON.stringify(String(fm["imdb Id"] || "").trim())}`,
        `Кинопоиск ID: ${JSON.stringify(String(values.kpId || fm["Кинопоиск ID"] || "").trim())}`,
        `Жанр: ${yamlArray(asArray(values.genre ?? fm.Жанр))}`,
        `Режисер: ${yamlArray(asArray(values.directors))}`,
        `Актеры: ${yamlArray(asArray(values.actors))}`,
        `Роли актеров: ${yamlArray(asArray(values.roles))}`,
        "---",
        ROLE_LINKS_BLOCK,
        ""
    ].join("\n");
    await makeFolders(app, rolePath);
    const existing = app.vault.getAbstractFileByPath(rolePath);
    if (existing) await app.vault.modify(existing, content);
    else await app.vault.create(rolePath, content);
}

function setRawField(raw, key, value) {
    const match = raw.match(/^(\ufeff?---\r?\n)([\s\S]*?)(\r?\n---(?:\r?\n|$))/);
    if (!match) return raw;
    const newline = raw.includes("\r\n") ? "\r\n" : "\n";
    let yaml = match[2];
    const safe = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const expression = new RegExp('^(?:'+safe+'|"'+safe+'"|\''+safe+'\'):[^\\r\\n]*(?:\\r?\\n(?:[ \\t]+[^\\r\\n]*|-(?:[ \\t]+[^\\r\\n]*)?|(?=\\r?$)))*', 'm');
    const line = `${key}: ${JSON.stringify(value)}`;
    yaml = expression.test(yaml) ? yaml.replace(expression, () => line)
        : yaml.trimEnd() + newline + line;
    return match[1] + yaml + match[3] + raw.slice(match[0].length);
}

function ensureRoleEmbed(raw, rolePath) {
    const withPath = setRawField(raw, "Роли файл", rolePath);
    const match = withPath.match(/^(\ufeff?---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$))/);
    if (!match) return withPath;
    const newline = withPath.includes("\r\n") ? "\r\n" : "\n";
    const oldBlock = /(?:\r?\n)?^[ \t]*<!-- KINO:ENTITY:LINKS:V(?:1|2|3) -->\r?\n```dataviewjs\r?\n[\s\S]*?^```[ \t]*(?:\r?\n|$)/m;
    const oldEmbed = /(?:\r?\n)?^[ \t]*<!-- KINO:ROLES:EMBED:V1 -->\r?\n!\[\[[^\]]+\]\][ \t]*(?:\r?\n|$)/m;
    const body = withPath.slice(match[0].length)
        .replace(oldBlock, "").replace(oldEmbed, "").replace(/^(?:\r?\n)+/, "");
    return match[0] + `<!-- KINO:ROLES:EMBED:V1 -->${newline}![[${rolePath.replace(/\.md$/i, "")}]]${newline}` + body;
}

function ensureRoleLinksBlock(raw) {
    const frontmatter = raw.match(/^(\ufeff?---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$))/);
    if (!frontmatter) return raw;
    const newline = raw.includes("\r\n") ? "\r\n" : "\n";
    const pattern = /(?:\r?\n)?^[ \t]*<!-- KINO:ENTITY:LINKS:V(?:2|3) -->\r?\n```dataviewjs\r?\n[\s\S]*?^```[ \t]*(?:\r?\n|$)/m;
    const body = raw.slice(frontmatter[0].length).replace(pattern, "");
    return frontmatter[0] + ROLE_LINKS_BLOCK.replace(/\n/g, newline) + newline + body;
}

function compactPeopleFields(raw, ob) {
    const parts = yamlParts(raw);
    if (!parts) return raw;
    let yaml = parts.yaml;
    for (const key of ["Актеры", "Роли актеров"]) {
        const block = propertyBlock(yaml, key);
        if (!block) continue;
        const parsed = readField(block[0], key, ob);
        if (!parsed.found) continue;
        const values = parsed.values;
        const replacement = `${key}: ${yamlArray(values)}`;
        if (block[0] === replacement) continue;
        yaml = yaml.slice(0, block.index) + replacement
            + yaml.slice(block.index + block[0].length);
    }
    return parts.prefix + yaml + parts.end + parts.body;
}

function readField(block, key, ob) {
    try {
        const parsed = ob.parseYaml(block) || {};
        if (Object.prototype.hasOwnProperty.call(parsed, key)) {
            return { found: true, values: asArray(parsed[key]) };
        }
    } catch {
        // В старых ролях встречаются управляющие символы. Используем
        // построчный разбор и затем безопасно сериализуем значение в JSON.
    }
    const lines = block.split(/\r?\n/);
    const first = lines.shift() || "";
    const colon = first.indexOf(":");
    if (colon < 0) return { found: false, values: [] };
    const inline = first.slice(colon + 1).trim();
    if (!inline || inline === "[]") {
        return {
            found: true,
            values: lines
                .filter(line => /^\s*-\s+/.test(line))
                .map(line => decodeScalar(line.replace(/^\s*-\s+/, "")))
                .filter(value => value.trim() !== "")
        };
    }
    try { return { found: true, values: asArray(JSON.parse(inline)) }; }
    catch { return { found: true, values: [decodeScalar(inline)].filter(value => value.trim() !== "") }; }
}

function asArray(value) {
    if (value === null || value === undefined || value === "") return [];
    const values = Array.isArray(value) ? value : [value];
    return values.map(item => String(item ?? "")).filter(item => item.trim() !== "");
}

function decodeScalar(value) {
    const text = String(value ?? "").trim();
    if (text.startsWith('"') && text.endsWith('"')) {
        try { return JSON.parse(escapeControls(text)); } catch { return text.slice(1, -1); }
    }
    if (text.startsWith("'") && text.endsWith("'")) {
        return text.slice(1, -1).replace(/''/g, "'");
    }
    return text;
}

function escapeControls(value) {
    return value.replace(/[\u0000-\u001f\u007f-\u009f]/g,
        character => `\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`);
}

function yamlArray(values) {
    return JSON.stringify(values).replace(/[\u007f-\u009f]/g,
        character => `\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`);
}

function yamlParts(raw) {
    const match = raw.match(/^(\uFEFF?---\r?\n)([\s\S]*?)(\r?\n---(?:\r?\n|$))/);
    return match
        ? { prefix: match[1], yaml: match[2], end: match[3], body: raw.slice(match[0].length) }
        : null;
}

function propertyBlock(yaml, key) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const expression = new RegExp(
        `^(?:${escaped}|"${escaped}"|'${escaped}'):[^\\r\\n]*` +
        `(?:\\r?\\n(?![^ \\t\\r\\n#][^\\r\\n]*:)[^\\r\\n]*)*`,
        "m"
    );
    return yaml.match(expression);
}

function roleFromChunk(chunk) {
    const roleElements = /<([a-z0-9]+)\b[^>]*(?:class|data-testid|data-qa)=['"][^'"]*(?:role|character|acting|characters)[^'"]*['"][^>]*>([\s\S]*?)<\/\1>/gi;
    for (const match of String(chunk || "").matchAll(roleElements)) {
        const role = roleText(htmlPlain(match[2]));
        if (role) return role;
    }
    const plain = htmlPlain(chunk);
    const asRole = plain.match(/\bas\s+([^\n|·]{1,120})/i)?.[1];
    if (asRole && roleText(asRole)) return roleText(asRole);
    const ellipsis = plain.match(/(?:\.\.\.|…)[ \t]*([^\n]{1,120})/);
    return ellipsis && roleText(ellipsis[1]) ? roleText(ellipsis[1]) : "";
}
