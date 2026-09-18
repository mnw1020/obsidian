// QuickAdd: Кино - обновить роли актёров.
// Порядок источников: IMDb fullcredits, затем КП cast, если IMDb не дал роли.
// Постоянного HTTP-кэша нет. Уже записанные значения не заменяются пустыми ответами.

const ROOT = "Кино";
const API = "https://movie-planner.ru/api/public";
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
let nextRequestAt = 0;

module.exports = async function updateKinoRoles(params) {
    const { app, obsidian: ob } = params;
    const files = app.vault.getMarkdownFiles()
        .filter(file => isMedia(file, app))
        .filter(file => !isTemplate(file, app))
        .sort((a, b) => a.path.localeCompare(b.path, "ru"));
    const notice = new ob.Notice(`Кино: роли актёров 0/${files.length}…`, 0);
    let processed = 0;
    let changed = 0;
    let foundRoles = 0;
    let imdbSources = 0;
    let kpSources = 0;
    let skipped = 0;
    let failed = 0;
    let noRoleSource = 0;

    try {
        for (const file of files) {
            processed++;
            const fm = app.metadataCache.getFileCache(file)?.frontmatter || {};
            const imdbId = extractImdbId(fm["imdb Id"]);
            const actorValue = fm.Актеры;
            const actors = splitPeople(actorValue).map(entityName).filter(Boolean);
            notice.setMessage?.(`Кино: ${processed}/${files.length} - ${file.basename}`);
            if (!actors.length) {
                skipped++;
                continue;
            }

            try {
                const type = tagsOf(fm).includes("serial") ? "series" : "movie";
                const imdb = imdbId ? await getImdbCredits(ob, imdbId) : [];
                if (imdb.length) imdbSources++;

                let kpId = explicitKpId(fm);
                let kpDetails = null;
                let kp = [];
                const imdbComplete = actors.length > 0 && actors.every(actor =>
                    imdb.some(person => person.role && (samePerson(actor, personEnglish(person))
                        || samePerson(actor, personRussian(person)))));
                if (!imdbComplete) {
                    if (!kpId) kpId = await findKpId(ob, fm, file);
                    if (kpId) {
                        kpDetails = await getKpDetails(ob, kpId);
                        kp = normalizeCredits(kpDetails?.cast?.actors || [], "kp");
                        if (!kp.some(person => person.role)) {
                            const direct = await getKinopoiskCredits(ob, kpId, type);
                            kp = uniqueCredits([...kp, ...direct]);
                        }
                    }
                }
                if (kp.length) kpSources++;

                const result = mergeActors(actors, [imdb, kp]);
                foundRoles += result.roles;
                if (!result.values.length) {
                    skipped++;
                    continue;
                }
                const nextValue = Array.isArray(actorValue) ? result.values : result.values.join(", ");
                const hasNewKpId = Boolean(kpId && !explicitKpId(fm));
                if (JSON.stringify(nextValue) === JSON.stringify(actorValue) && !hasNewKpId) {
                    if (!result.roles) noRoleSource++;
                    continue;
                }
                await app.fileManager.processFrontMatter(file, frontmatter => {
                    frontmatter.Актеры = nextValue;
                    if (hasNewKpId) frontmatter["Кинопоиск ID"] = kpId;
                });
                changed++;
                if (result.roles) continue;
                noRoleSource++;
            } catch (error) {
                failed++;
                console.warn("Кино: не удалось получить роли", file.path, error);
            }
        }
    } finally {
        notice.hide?.();
    }

    new ob.Notice(
        `Роли актёров: обработано ${processed}, изменено ${changed}, добавлено ролей ${foundRoles}, IMDb ${imdbSources}, КП ${kpSources}, без ролей ${noRoleSource}, пропущено ${skipped}, ошибок ${failed}.`,
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

function splitPeople(value) {
    if (Array.isArray(value)) return value;
    return String(value || "").split(/\s*,\s*/).filter(Boolean);
}

function entityName(value) {
    const text = String(value || "").trim();
    const link = text.match(/^\[\[([\s\S]+?)\]\]$/);
    if (!link) return text;
    const parts = link[1].split("|");
    return (parts.length > 1 ? parts.slice(1).join("|") : parts[0].split("#")[0].replace(/\.md$/i, "").split("/").pop()).trim();
}

function extractImdbId(value) {
    return String(value || "").match(/\btt\d{7,12}\b/i)?.[0].toLowerCase() || "";
}

function extractKpId(value) {
    const text = String(value || "").trim();
    if (/^\d{4,12}$/.test(text)) return text;
    return text.match(/(?:kinopoisk\.ru\/(?:film|series)\/|movie-planner\.ru\/f\/|(?:^|[\s:])(?:kp|кп)\s*[:#]?\s*)(\d{4,12})/i)?.[1] || "";
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

async function request(ob, url, accept) {
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
                        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/131 Safari/537.36"
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

async function getText(ob, url) {
    return request(ob, url, "text/html,application/xhtml+xml");
}

async function findKpId(ob, fm, file) {
    const imdbId = extractImdbId(fm["imdb Id"]);
    if (!imdbId) return "";
    const directSearch = await getJson(ob, `${API}/search`, { q: imdbId, limit: 24, person_limit: 0 });
    const exact = (directSearch?.items || []).filter(item => extractImdbId(item.imdb_id || item.imdbID) === imdbId);
    if (exact.length === 1) return String(exact[0].kp_id || "");

    const wiki = await getJson(ob, "https://query.wikidata.org/sparql", {
        format: "json",
        query: `SELECT DISTINCT ?kp WHERE { ?item wdt:P345 "${imdbId}" . ?item wdt:P2603 ?kp . } LIMIT 5`
    });
    const wikiIds = [...new Set((wiki?.results?.bindings || [])
        .map(row => row.kp?.value).filter(value => /^\d+$/.test(String(value || ""))))];
    if (wikiIds.length === 1) return wikiIds[0];

    const title = String(fm.Название || file.basename || "").trim();
    const year = String(fm.Релиз || "").match(/\d{4}/)?.[0] || "";
    const type = tagsOf(fm).includes("serial") ? "series" : "film";
    for (const query of [`${title} ${year}`.trim(), title].filter(Boolean)) {
        const result = await getJson(ob, `${API}/search`, { q: query, limit: 24, type, person_limit: 0 });
        const items = Array.isArray(result?.items) ? result.items : [];
        const candidates = items
            .filter(item => Boolean(item.is_series) === (type === "series"))
            .filter(item => !year || String(item.year || "") === year);
        if (candidates.length === 1) return String(candidates[0].kp_id || "");
    }
    return "";
}

async function getKpDetails(ob, kpId) {
    if (!/^\d{4,12}$/.test(String(kpId || ""))) return null;
    const result = await getJson(ob, `${API}/film/${kpId}`);
    return result?.film ? { ...result.film, cast: result.cast || {} } : null;
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

function roleText(value) {
    const text = valueText(value).replace(/^['"]|['"]$/g, "").replace(/\s+/g, " ").trim();
    if (!text || /^(actor|actress|cast|act[её]р|актриса)$/i.test(text)) return "";
    if (/^(режиссёр|режиссер|director|producer|продюсер|writer|сценарист|оператор|cinematographer|монтажёр|монтажер|editor)$/i.test(text)
        || /(?:режисс[её]р|продюсер|сценарист|оператор|монтаж[её]р|художник|композитор|костюм|грим|director|producer|writer|cinematographer|editor)/i.test(text)) return "";
    return text;
}

function personRole(person) {
    if (typeof person === "string") return person.match(/^.+?\s+-\s+(.+)$/)?.[1].trim() || "";
    for (const key of ["role", "character", "character_name", "characterName", "role_name", "roleName", "characters", "roles", "played_as", "playedAs"]) {
        const role = roleText(person?.[key]);
        if (role) return role;
    }
    return "";
}

function creditNameParts(node, source) {
    const values = [];
    const add = value => {
        const text = valueText(value);
        if (text && !values.includes(text)) values.push(text);
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
        english: values.find(value => /[a-z]/i.test(value) && !/[а-яё]/i.test(value)) || "",
        russian: values.find(value => /[а-яё]/i.test(value)) || ""
    };
}

function collectJsonCredits(node, source, result = [], seen = new WeakSet()) {
    if (!node || typeof node !== "object" || seen.has(node)) return result;
    seen.add(node);
    if (Array.isArray(node)) {
        node.forEach(item => collectJsonCredits(item, source, result, seen));
        return result;
    }
    const role = roleText(node.characters || node.character || node.role || node.roleName
        || node.character_name || node.characterName || node.roles || node.charactersText);
    const nestedPerson = node.person || node.actor || node.personInfo || node.castMember;
    const directNames = creditNameParts(node, source);
    const nestedNames = creditNameParts(nestedPerson, source);
    const names = {
        english: directNames.english || nestedNames.english,
        russian: directNames.russian || nestedNames.russian
    };
    if (role && (names.english || names.russian) && (node.id || node.nconst || node.href || node.url
        || node.personId || node.kinopoiskId || node.name || node.nameText || nestedPerson)) {
        result.push({ name_en: names.english, name_ru: names.russian, role });
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
        const role = roleFromChunk(String(html).slice(match.index || 0, next));
        if (name && role) values.push({ name_en: source === "kp" ? "" : name, name_ru: source === "kp" ? name : "", role });
    });
    return uniqueCredits(values);
}

async function getImdbCredits(ob, imdbId) {
    const html = await getText(ob, `https://www.imdb.com/title/${imdbId}/fullcredits/`);
    return parseCredits(html, "imdb");
}

async function getKinopoiskCredits(ob, kpId, type) {
    const paths = type === "series" ? ["series", "film"] : ["film", "series"];
    for (const path of paths) {
        const html = await getText(ob, `https://www.kinopoisk.ru/${path}/${kpId}/cast/`);
        const credits = parseCredits(html, "kp");
        if (credits.length) return credits;
    }
    return [];
}

function baseKey(value) {
    return personName(value).replace(/\s*\([^()]*\)\s*$/, "").normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("ru").replace(/ё/g, "е")
        .replace(/[^0-9a-zа-я]/gi, "").replace(/iy/g, "y").replace(/ii/g, "y");
}

function personName(value) {
    return String(value || "").replace(/^\[\[([\s\S]+?)\]\]$/, "$1").replace(/\s+-\s+.+$/, "").trim();
}

function personParts(value) {
    const text = personName(value);
    const pair = text.match(/^(.+?)\s*\(([^()]*)\)$/);
    const values = pair ? [pair[1].trim(), pair[2].trim()] : [text];
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
    return role && normalized ? `${normalized} - ${role}` : normalized;
}

function personPair(english, russian, role) {
    const canonical = PERSON_CANONICAL_OVERRIDES[baseKey(english)] || PERSON_CANONICAL_OVERRIDES[baseKey(russian)] || "";
    const first = personParts(canonical || english);
    const second = personParts(russian);
    const en = first.english || second.english || english || "";
    const ru = first.russian || second.russian || "";
    const result = en && ru && en !== ru ? `${en} (${ru})` : en || ru || personName(english);
    const finalRole = roleText(role);
    return finalRole && result ? `${result} - ${finalRole}` : result;
}

function normalizeCredits(values, source) {
    return uniqueCredits((values || []).map(person => {
        const parts = creditNameParts(person, source);
        return {
            name_en: person.name_en || parts.english,
            name_ru: person.name_ru || parts.russian,
            role: personRole(person)
        };
    }));
}

function uniqueCredits(values) {
    const result = new Map();
    for (const person of values || []) {
        const parts = creditNameParts(person, "mixed");
        const english = person?.name_en || parts.english;
        const russian = person?.name_ru || parts.russian;
        const role = roleText(personRole(person));
        if (!role || !(english || russian)) continue;
        const key = `${baseKey(english || russian)}|${role.toLocaleLowerCase("ru")}`;
        const previous = result.get(key);
        result.set(key, { name_en: previous?.name_en || english, name_ru: previous?.name_ru || russian, role });
    }
    return [...result.values()];
}

function mergeActors(current, sources) {
    const values = [];
    let roles = 0;
    const seen = new Set();
    const people = (sources || []).flatMap(source => Array.isArray(source) ? source : []);
    for (const actor of current) {
        const matches = people.filter(person => samePerson(actor, personEnglish(person)) || samePerson(actor, personRussian(person)));
        const english = matches.map(personEnglish).find(Boolean) || personParts(actor).english || actor;
        const russian = matches.map(personRussian).find(Boolean) || personParts(actor).russian;
        const role = matches.map(personRole).find(Boolean) || personRole(actor);
        const value = normalizePerson(personPair(english, russian, role));
        const key = `${baseKey(value)}|${role.toLocaleLowerCase("ru")}`;
        if (value && !seen.has(key)) {
            seen.add(key);
            values.push(value);
            if (matches.some(person => personRole(person))) roles++;
        }
    }
    return { values, roles };
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
