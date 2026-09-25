module.exports = async (params) => {
    const { app, obsidian } = params;
    const { Notice, normalizePath } = obsidian;

    const ROOT = "Кино";
    const REPORT_PATH = `${ROOT}/_system/Проверка кинотеки.md`;
    const CHANGELOG_PATH = `${ROOT}/_system/Журнал изменений.md`;
    const VIEWINGS_PREFIX = `${ROOT}/Просмотры/`;
    const SEASONS_PREFIX = `${ROOT}/Сезоны/`;
    const FRANCHISES_PREFIX = `${ROOT}/Франшизы/`;
    const ENTITY_FIELDS = ["Режисер", "Жанр"];
    const ROLE_FIELDS = ["Режисер", "Актеры", "Роли актеров"];

    const asText = value => {
        if (value === null || value === undefined) return "";
        if (typeof value?.toISODate === "function") return value.toISODate();
        if (value instanceof Date && !Number.isNaN(value.getTime())) {
            return value.toISOString().slice(0, 10);
        }
        return String(value).trim();
    };

    const listValues = value => {
        if (value === null || value === undefined || value === "") return [];
        return (Array.isArray(value) ? value : [value])
            .map(asText)
            .filter(Boolean);
    };

    const getFrontmatter = file => app.metadataCache.getFileCache(file)?.frontmatter ?? {};

    function tags(frontmatter) {
        return listValues(frontmatter?.tags).map(tag => tag.replace(/^#/, ""));
    }

    function isRootCard(file) {
        if (!file || file.extension !== "md") return false;
        if (!file.path.startsWith(`${ROOT}/`)) return false;
        return !file.path.slice(ROOT.length + 1).includes("/");
    }

    function isMedia(file) {
        if (!isRootCard(file)) return false;
        const fileTags = tags(getFrontmatter(file));
        return fileTags.includes("movies") || fileTags.includes("serial");
    }

    function isTemplate(file, frontmatter) {
        return file?.basename === "Без названия" && !asText(frontmatter?.Название);
    }

    function isViewing(file) {
        return file?.extension === "md" && file.path.startsWith(VIEWINGS_PREFIX)
            && tags(getFrontmatter(file)).includes("viewing");
    }

    function isSeason(file) {
        return file?.extension === "md" && file.path.startsWith(SEASONS_PREFIX)
            && tags(getFrontmatter(file)).includes("season");
    }

    function isFranchise(file) {
        return file?.extension === "md" && file.path.startsWith(FRANCHISES_PREFIX);
    }

    function linkTarget(value) {
        const text = asText(value);
        const match = text.match(/^\[\[([^\]|]+)(?:\|[^\]]+)?\]\]$/);
        return (match ? match[1] : text).replace(/\.md$/i, "").trim();
    }

    function resolveLink(value, sourcePath) {
        const target = linkTarget(value);
        if (!target) return null;
        try {
            const resolved = app.metadataCache.getFirstLinkpathDest(target, sourcePath);
            if (resolved) return resolved;
        } catch (_) {
        }
        for (const candidate of [target, `${target}.md`]) {
            const exact = app.vault.getAbstractFileByPath(normalizePath(candidate));
            if (exact) return exact;
        }
        return null;
    }

    function fileLink(file, label) {
        const safeLabel = asText(label || file?.basename || "файл").replace(/\|/g, "¦");
        return `[[${file.path}|${safeLabel}]]`;
    }

    function normalizeText(value) {
        return asText(value)
            .toLocaleLowerCase("ru")
            .replace(/ё/g, "е")
            .replace(/[‐‑‒–—―]/g, "-")
            .replace(/[“”„«»'’`]/g, "")
            .replace(/\s+/g, " ")
            .trim();
    }

    function stripWiki(value) {
        const text = asText(value);
        const match = text.match(/^\[\[([^\]|]+)(?:\|([^\]]+))?\]\]$/);
        return match ? (match[2] || match[1]).trim() : text;
    }

    function personRole(value) {
        return stripWiki(value).match(/^.+?\s+-\s+(.+)$/)?.[1].trim() || "";
    }

    function personName(value) {
        return stripWiki(value).replace(/\s+-\s+.+$/, "").trim();
    }

    function roleActorName(value, knownActors = []) {
        const text = stripWiki(value);
        const known = knownActors instanceof Set ? knownActors : new Set(listValues(knownActors));
        if (known.has(text)) return text;
        const split = text.lastIndexOf(" - ");
        const candidate = split >= 0 ? text.slice(split + 3).trim() : text;
        return known.has(candidate) ? candidate : candidate;
    }

    function hasCyrillicPersonName(value) {
        return /\p{Script=Cyrillic}/u.test(stripWiki(value));
    }

    function personBaseKey(value) {
        let text = personName(value).normalize("NFC");
        text = text.replace(/\s*\([^()]*\)\s*$/, "");
        return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            .toLocaleLowerCase("ru").replace(/ё/g, "е").replace(/[^0-9a-zа-я]/gi, "");
    }

    function normalizePersonDisplay(value) {
        const role = personRole(value);
        let text = personName(value).normalize("NFC");
        for (let i = 0; i < 5; i++) {
            const match = text.match(/^(.+?)\s*\((.*)\)$/);
            if (!match || !match[2].includes("(")) break;
            const inner = match[2].replace(/^.*\(([^()]*)\)$/, "$1").trim();
            if (!inner || inner === match[2]) break;
            text = `${match[1].trim()} (${inner})`;
        }
        const pair = text.match(/^(.+?)\s*\(([^()]*)\)$/);
        const normalized = pair && personBaseKey(pair[1]) === personBaseKey(pair[2])
            ? pair[1].trim() : text;
        return role && normalized ? `${normalized} - ${role}` : normalized;
    }

    function personKey(value) {
        return personBaseKey(normalizePersonDisplay(value));
    }

    function hasNestedParentheses(value) {
        return /\([^()]*\([^()]*\)[^()]*\)/.test(asText(value));
    }

    function hasSameParentheses(value) {
        const pair = personName(value).match(/^(.+?)\s*\(([^()]*)\)$/);
        return Boolean(pair && personBaseKey(pair[1]) === personBaseKey(pair[2]));
    }

    function personFormatIssue(value) {
        const text = personName(normalizePersonDisplay(value));
        if (!text || text.toUpperCase() === "N/A") return "";
        // Кириллица, в том числе в скобках, проверяется отдельно как ошибка.
        if (hasNestedParentheses(text)) return "вложенные скобки в имени";
        return "";
    }

    function dateText(value) {
        const text = asText(value).replace(/^@date:/, "");
        return text;
    }

    function validDate(value, allowRange = false) {
        const text = dateText(value);
        let match = text.match(/^(\d{4})$/);
        if (match) return Number(match[1]) >= 1;

        match = text.match(/^(\d{4})-(\d{2})$/);
        if (match) return Number(match[1]) >= 1 && Number(match[2]) >= 1 && Number(match[2]) <= 12;

        match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (match) {
            const year = Number(match[1]);
            const month = Number(match[2]);
            const day = Number(match[3]);
            const date = new Date(Date.UTC(year, month - 1, day));
            return date.getUTCFullYear() === year
                && date.getUTCMonth() === month - 1
                && date.getUTCDate() === day;
        }

        if (allowRange) {
            match = text.match(/^(\d{4})-(\d{4})$/);
            if (match) return Number(match[1]) >= 1 && Number(match[1]) <= Number(match[2]);
        }

        return false;
    }

    function yearOf(value) {
        const match = dateText(value).match(/^(\d{4})/);
        return match ? match[1] : "";
    }

    function toNumber(value) {
        if (value === null || value === undefined || asText(value) === "") return null;
        const number = Number(asText(value).replace(",", "."));
        return Number.isFinite(number) ? number : null;
    }

    function isBoolean(value) {
        return typeof value === "boolean" || /^(true|false)$/i.test(asText(value));
    }

    function addUnique(array, value) {
        if (!array.includes(value)) array.push(value);
    }

    function entityValueKey(field, value) {
        const base = field === "Жанр" ? normalizeText(value) : personKey(value);
        if (field !== "Актеры") return base;
        return `${base}|${normalizeText(personRole(value))}`;
    }

    const exclusionPath = `${ROOT}/_system/Исключения.md`;
    let excludedPaths = new Set();
    const exclusionFile = app.vault.getAbstractFileByPath(exclusionPath);
    if (exclusionFile) {
        const exclusionText = await app.vault.read(exclusionFile);
        for (const match of exclusionText.matchAll(/\[\[(Кино\/[^\]|]+)(?:\|[^\]]+)?\]\]/g)) {
            const path = match[1].endsWith(".md") ? match[1] : `${match[1]}.md`;
            excludedPaths.add(path);
        }
    }
    const toggleChoice = encodeURIComponent("Кино - Переключить исключение аудита");
    const exclusionAction = file => ` [\\[ исключить \\]](obsidian://quickadd?choice=${toggleChoice}&value-path=${encodeURIComponent(file.path)}&value-action=exclude)`;
    const exclusionTarget = file => {
        if (isMedia(file)) return file;
        if (file?.path?.startsWith(`${ROOT}/_system/Роли/`) && file.basename.endsWith(".роли")) {
            const main = app.vault.getAbstractFileByPath(`${ROOT}/${file.basename.slice(0, -5)}.md`);
            if (isMedia(main)) return main;
        }
        return null;
    };
    const allMarkdown = app.vault.getMarkdownFiles();
    const mediaFiles = allMarkdown.filter(isMedia)
        .filter(file => !excludedPaths.has(file.path))
        .sort((a, b) => a.path.localeCompare(b.path, "ru"));
    const media = mediaFiles.filter(file => !isTemplate(file, getFrontmatter(file)));
    const templates = mediaFiles.filter(file => isTemplate(file, getFrontmatter(file)));
    const viewFiles = allMarkdown.filter(isViewing);
    const seasonFiles = allMarkdown.filter(isSeason);
    const franchiseFiles = allMarkdown.filter(isFranchise);
    const mediaByPath = new Map(media.map(file => [file.path, file]));
    const franchiseByPath = new Map(franchiseFiles.map(file => [file.path, file]));

    const errors = [];
    const warnings = [];
    const possibleDuplicates = [];
    const info = [];
    if (excludedPaths.size) info.push(`Исключено из проверки: **${excludedPaths.size}**.`);

    const addError = (file, message) => errors.push(`${fileLink(file)} - ${message}`);
    const addWarning = (file, message) => {
        const target = exclusionTarget(file);
        warnings.push(`${fileLink(file)} - ${message}${target ? exclusionAction(target) : ""}`);
    };

    const titleKeys = new Map();
    const imdbKeys = new Map();
    const viewingsByMedia = new Map();
    const seasonsByMedia = new Map();
    const missingIds = [];
    const missingKinopoiskIds = [];
    const missingPosters = [];
    let missingDirectors = 0;
    let missingActors = 0;
    let missingGenres = 0;
    let naDirectors = 0;
    let actorsWithoutRoles = 0;
    let franchiseLinkCount = 0;

    for (const file of media) {
        const fm = getFrontmatter(file);
        const title = asText(fm.Название);
        const fileTags = tags(fm);
        const mediaTags = fileTags.filter(tag => tag === "movies" || tag === "serial");
        const label = title || file.basename;
        const rolePath = `${ROOT}/_system/Роли/${file.basename}.роли.md`;
        const roleFile = app.vault.getAbstractFileByPath(rolePath);
        const roleFm = roleFile ? getFrontmatter(roleFile) : {};
        const rawCard = await app.vault.read(file);
        const roleV2Count = (rawCard.match(/<!-- KINO:ROLES:EMBED:V2 -->/g) || []).length;
        const recommendV2Count = (rawCard.match(/<!-- KINO:RECOMMEND:BUTTON:V2 -->/g) || []).length;
        if (roleV2Count !== 0) {
            addError(file, "устаревший раскрывающийся блок ролей: используйте ссылку в YAML.");
        }
        if (recommendV2Count !== 1) addError(file, "кнопка `🔎 Найти похожие` V2 отсутствует или продублирована.");

        if (!title) addError(file, "отсутствует свойство `Название`.");
        if (mediaTags.length > 1) addWarning(file, "одновременно стоят теги `movies` и `serial`.");
        if (!asText(fm.Релиз)) addWarning(file, "не указано свойство `Релиз`.");
        else if (!validDate(fm.Релиз, true)) addError(file, `некорректная дата в \`Релиз\`: \`${asText(fm.Релиз)}\`.`);

        const imdb = asText(fm["imdb Id"]).toLowerCase();
        if (!imdb || imdb === "none" || imdb === "null") missingIds.push(file);
        else if (!/^tt\d{7,12}$/.test(imdb)) addError(file, `некорректный IMDb ID: \`${asText(fm["imdb Id"])}\`.`);
        else {
            if (!imdbKeys.has(imdb)) imdbKeys.set(imdb, []);
            imdbKeys.get(imdb).push(file);
        }

        const kinopoiskId = asText(fm["Кинопоиск ID"]);
        if (!kinopoiskId || /^(none|null|n\/a)$/i.test(kinopoiskId)) {
            // КП ID необязателен: роли и другие данные могут быть получены по IMDb.
            missingKinopoiskIds.push(file);
            addWarning(file, "не указан Кинопоиск ID.");
        } else if (!/^\d+$/.test(kinopoiskId)) {
            addError(file, `некорректный Кинопоиск ID: \`${kinopoiskId}\`.`);
        }

        if (!asText(fm.poster)) missingPosters.push(file);

        if (!roleFile) {
            addError(file, `отсутствует файл ролей: \`${rolePath}\`.`);
            missingActors++;
        } else {
            if (!Object.keys(roleFm).length) addError(roleFile, "файл ролей пуст или не содержит YAML.");
            if (asText(fm["Роли файл"]).replace(/^\[\[|\]\]$/g, "") !== rolePath) {
                addWarning(file, `поле \`Роли файл\` не совпадает с сопровождающим файлом: \`${rolePath}\`.`);
            }
            if (asText(roleFm["Основная карточка"]).replace(/^\[\[|\]\]$/g, "") !== file.path) {
                addError(roleFile, `поле \`Основная карточка\` не ведёт на \`${file.path}\`.`);
            }
            for (const field of ["imdb Id", "Кинопоиск ID"]) {
                if (asText(fm[field]) !== asText(roleFm[field])) {
                    addError(roleFile, `\`${field}\` не совпадает с основной карточкой.`);
                }
            }
            const actors = listValues(roleFm.Актеры);
            const credits = listValues(roleFm["Роли актеров"]);
            if (!actors.length) addWarning(file, "в файле ролей нет актёров.");
            const actorSet = new Set(actors);
            const creditedNames = new Set(credits
                .filter(value => value.includes(" - "))
                .map(value => roleActorName(value, actorSet)));
            const noRoles = actors.filter(name => !creditedNames.has(name));
            actorsWithoutRoles += noRoles.length;
            if (noRoles.length) addWarning(file, `актёров без роли: **${noRoles.length}**. Можно запустить обновление ролей.`);
            for (const field of ROLE_FIELDS) {
                const raw = roleFm[field];
                if (!listValues(raw).length) {
                    if (field === "Актеры") missingActors++;
                    continue;
                }
                const values = listValues(raw);
                const seen = new Set();
                for (const value of values) {
                    if (value.startsWith("[[")) addWarning(roleFile, `в \`${field}\` осталась wikilink-ссылка: \`${value}\`.`);
                    if (field !== "Роли актеров") {
                        if (hasNestedParentheses(value)) addError(roleFile, `в \`${field}\` вложенные скобки: \`${value}\`.`);
                        if (hasSameParentheses(value)) addError(roleFile, `в \`${field}\` повторяется имя в скобках: \`${value}\`.`);
                    }
                    if (field === "Режисер" || field === "Актеры" || field === "Роли актеров") {
                        const personValue = field === "Роли актеров"
                            ? roleActorName(value, actorSet)
                            : value;
                        if (hasCyrillicPersonName(personValue)) {
                            addError(roleFile, `в \`${field}\` имя содержит кириллицу: \`${value}\`. Ожидается только латинское имя.`);
                        }
                    }
                    const key = field === "Роли актеров"
                        ? `${personName(value)}|${personRole(value)}`
                        : personKey(value);
                    if (key && seen.has(key)) addError(roleFile, `в \`${field}\` есть точный дубль: \`${value}\`.`);
                    if (key) seen.add(key);
                }
            }
        }

        for (const [field, min, max] of [["Оценка", 1, 10], ["Оценка Imdb", 0, 10], ["Оценка Кинопоиск", 0, 10]]) {
            if (asText(fm[field]) === "") continue;
            const number = toNumber(fm[field]);
            if (number === null || number < min || number > max) {
                addError(file, `значение \`${field}\` должно быть числом от ${min} до ${max}.`);
            }
        }

        for (const field of ["Количество голосов Кинопоиск", "Количество голосов Imdb", "Количество просмотров", "Количество сезонов", "Последний сезон"]) {
            if (asText(fm[field]) === "") continue;
            const number = toNumber(fm[field]);
            if (number === null || !Number.isInteger(number) || number < 0) {
                addError(file, `значение \`${field}\` должно быть неотрицательным целым числом.`);
            }
        }

        if (asText(fm.Часть) !== "") {
            const part = toNumber(fm.Часть);
            if (part === null || part <= 0) addError(file, "`Часть` должна быть положительным числом.");
        }

        if (asText(fm.Просмотрено) !== "" && !validDate(fm.Просмотрено)) {
            addError(file, `некорректная дата в \`Просмотрено\`: \`${asText(fm.Просмотрено)}\`.`);
        }

        for (const field of ENTITY_FIELDS) {
            const raw = fm[field];
            if (raw === null || raw === undefined || raw === "") {
                if (field === "Режисер") missingDirectors++;
                    if (field === "Жанр") missingGenres++;
                continue;
            }

            const values = listValues(raw);
            const seen = new Set();
            for (const value of values) {
                if (value.startsWith("[[")) addWarning(file, `в \`${field}\` осталась wikilink-ссылка: \`${value}\`.`);
                if (field !== "Жанр") {
                    if (hasNestedParentheses(value)) addError(file, `в \`${field}\` вложенные скобки: \`${value}\`.`);
                    if (hasSameParentheses(value)) addError(file, `в \`${field}\` повторяется имя в скобках: \`${value}\`.`);
                    const formatIssue = personFormatIssue(value);
                    if (formatIssue) addError(file, `в \`${field}\`: ${formatIssue}: \`${value}\`.`);
                    if (hasCyrillicPersonName(value)) {
                        addError(file, `в \`${field}\` имя содержит кириллицу: \`${value}\`. Ожидается только латинское имя.`);
                    }
                    if (value.toUpperCase() === "N/A") naDirectors++;
                }
                const key = entityValueKey(field, value);
                if (key && seen.has(key)) addError(file, `в \`${field}\` есть точный дубль: \`${value}\`.`);
                if (key) seen.add(key);
            }
        }

        const releaseKey = yearOf(fm.Релиз);
        const titleKey = `${normalizeText(label)}|${releaseKey}|${mediaTags.sort().join(",")}`;
        if (!titleKeys.has(titleKey)) titleKeys.set(titleKey, []);
        titleKeys.get(titleKey).push(file);

        for (const field of ["Франшиза", "Первоисточники", "adapted_from", "related"]) {
            const values = listValues(fm[field]);
            const seen = new Set();
            for (const value of values) {
                const target = resolveLink(value, file.path);
                const key = target?.path || linkTarget(value);
                if (seen.has(key)) addError(file, `в \`${field}\` есть повторяющаяся ссылка: \`${value}\`.`);
                seen.add(key);
                if (!/^\[\[/.test(value)) addWarning(file, `поле \`${field}\` должно содержать wikilink: \`${value}\`.`);
                if (!target) addError(file, `битая ссылка в \`${field}\`: \`${value}\`.`);
                else if (field === "Франшиза" && !franchiseByPath.has(target.path)) {
                    addError(file, `ссылка в \`Франшиза\` ведёт не на страницу франшизы: \`${value}\`.`);
                }
                if (field === "Франшиза" && target) franchiseLinkCount++;
            }
        }
    }

    for (const [id, files] of imdbKeys.entries()) {
        if (files.length > 1) {
            const kpIds = new Set(files.map(file => String(getFrontmatter(file)["Кинопоиск ID"] || "").trim()).filter(Boolean));
            if (kpIds.size <= 1) {
                // Один и тот же IMDb + тот же КП почти наверняка означает
                // дублирующую карточку одного произведения.
                errors.push(`Один IMDb ID используется в нескольких карточках: \`${id}\` - ${files.map(file => fileLink(file)).join(", ")}.`);
            } else {
                // IMDb иногда объединяет телефильм/мини-сериал и продолжение в
                // одну страницу, тогда разные КП ID могут легитимно делить IMDb.
                warnings.push(`IMDb ID \`${id}\` используется у разных КП ID (${[...kpIds].join(", ")}): ${files.map(file => fileLink(file)).join(", ")}. Проверь вручную, это может быть объединённая страница IMDb.`);
            }
        }
    }

    for (const files of titleKeys.values()) {
        if (files.length > 1) {
            possibleDuplicates.push(`Одинаковые название, год и тип: ${files.map(file => fileLink(file, getFrontmatter(file).Название || file.basename)).join("; ")}.`);
        }
    }

    for (const file of missingIds) addWarning(file, "не указан IMDb ID.");
    for (const file of missingPosters) addWarning(file, "не указан poster.");
    if (missingDirectors) warnings.push(`Карточек без режиссёра: **${missingDirectors}**.`);
    if (missingActors) warnings.push(`Карточек без актёров или файла ролей: **${missingActors}**.`);
    if (missingGenres) warnings.push(`Карточек без жанра: **${missingGenres}**.`);
    if (naDirectors) warnings.push(`Карточек с режиссёром \`N/A\`: **${naDirectors}**.`);
    if (actorsWithoutRoles) warnings.push(`Актёров без указанной роли: **${actorsWithoutRoles}**. Роль добавляется только если её вернул источник КП/IMDb.`);

    function addGrouped(map, key, item) {
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(item);
    }

    for (const file of viewFiles) {
        const fm = getFrontmatter(file);
        const target = resolveLink(fm.Фильм, file.path);
        if (target && excludedPaths.has(target.path)) continue;
        const mediaFile = target && mediaByPath.get(target.path);
        if (!mediaFile) {
            addError(file, "поле `Фильм` не ведёт на карточку фильма или сериала.");
            continue;
        }

        const number = toNumber(fm.Просмотр);
        if (number === null || !Number.isInteger(number) || number < 1) addError(file, "`Просмотр` должен быть положительным целым числом.");
        if (!validDate(fm.Дата)) addError(file, "отсутствует или некорректна дата просмотра в `Дата`.");
        if (asText(fm.Оценка) !== "") {
            const rating = toNumber(fm.Оценка);
            if (rating === null || rating < 1 || rating > 10) addError(file, "оценка просмотра должна быть от 1 до 10.");
        }
        if (fm["Последний просмотр"] !== undefined && !isBoolean(fm["Последний просмотр"])) {
            addWarning(file, "`Последний просмотр` должен быть true или false.");
        }

        addGrouped(viewingsByMedia, mediaFile.path, {
            file,
            number,
            date: dateText(fm.Дата),
            last: fm["Последний просмотр"] === true || /^true$/i.test(asText(fm["Последний просмотр"]))
        });
    }

    for (const [mediaPath, records] of viewingsByMedia.entries()) {
        const numbers = records.map(record => record.number).filter(Number.isInteger);
        const seen = new Set();
        for (const number of numbers) {
            if (seen.has(number)) errors.push(`Для \`${mediaPath}\` номер просмотра **${number}** используется повторно.`);
            seen.add(number);
        }
        const max = Math.max(...numbers, 0);
        const missing = [];
        for (let number = 1; number <= max; number++) if (!seen.has(number)) missing.push(number);
        if (missing.length) warnings.push(`Для \`${mediaPath}\` пропущены номера просмотров: **${missing.join(", ")}**.`);

        const mediaFile = mediaByPath.get(mediaPath);
        const fm = getFrontmatter(mediaFile);
        const declared = toNumber(fm["Количество просмотров"]);
        if (declared !== null && (!Number.isInteger(declared) || declared !== records.length)) {
            warnings.push(`${fileLink(mediaFile)} - ` + `\`Количество просмотров\`: **${declared}**, файлов просмотров: **${records.length}**.`);
        }
        const markedLast = records.filter(record => record.last);
        if (markedLast.length > 1) warnings.push(`${fileLink(mediaFile)} - отмечено несколько последних просмотров.`);
        if (records.length && !markedLast.length) warnings.push(`${fileLink(mediaFile)} - среди записей просмотров не отмечен последний.`);
    }

    for (const file of seasonFiles) {
        const fm = getFrontmatter(file);
        const target = resolveLink(fm.Сериал, file.path);
        if (target && excludedPaths.has(target.path)) continue;
        const mediaFile = target && mediaByPath.get(target.path);
        if (!mediaFile) {
            addError(file, "поле `Сериал` не ведёт на карточку сериала.");
            continue;
        }
        if (!tags(getFrontmatter(mediaFile)).includes("serial")) addError(file, "сезон привязан к карточке без тега `serial`.");
        const number = toNumber(fm.Сезон);
        if (number === null || !Number.isInteger(number) || number < 1) addError(file, "`Сезон` должен быть положительным целым числом.");
        if (asText(fm.Дата) && !validDate(fm.Дата)) addError(file, "некорректная дата сезона в `Дата`.");
        if (asText(fm.Оценка) !== "") {
            const rating = toNumber(fm.Оценка);
            if (rating === null || rating < 1 || rating > 10) addError(file, "оценка сезона должна быть от 1 до 10.");
        }
        addGrouped(seasonsByMedia, mediaFile.path, { file, number });
    }

    for (const mediaFile of media) {
        const fm = getFrontmatter(mediaFile);
        const records = seasonsByMedia.get(mediaFile.path) || [];
        const declared = toNumber(fm["Количество сезонов"]);
        if (declared !== null && Number.isInteger(declared) && declared !== records.length) {
            warnings.push(`${fileLink(mediaFile)} - ` + `\`Количество сезонов\`: **${declared}**, файлов сезонов: **${records.length}**.`);
        }
        const lastSeason = toNumber(fm["Последний сезон"]);
        if (lastSeason !== null && records.length && lastSeason > Math.max(...records.map(item => item.number).filter(Number.isFinite), 0)) {
            warnings.push(`${fileLink(mediaFile)} - ` + `\`Последний сезон\` больше максимального номера имеющихся сезонов.`);
        }
        const numbers = records.map(record => record.number).filter(Number.isInteger);
        const seen = new Set();
        for (const number of numbers) {
            if (seen.has(number)) errors.push(`Для \`${mediaFile.path}\` номер сезона **${number}** используется повторно.`);
            seen.add(number);
        }
        const max = Math.max(...numbers, 0);
        const missing = [];
        for (let number = 1; number <= max; number++) if (!seen.has(number)) missing.push(number);
        if (missing.length) warnings.push(`Для \`${mediaFile.path}\` пропущены сезоны: **${missing.join(", ")}**.`);
    }

    const journalState = async () => {
        const file = app.vault.getAbstractFileByPath(normalizePath(CHANGELOG_PATH));
        if (!file) return "-";
        const text = await app.vault.read(file);
        const matches = [...text.matchAll(/<!-- KINO-AUDIT-EVENT at="([^"]+)" structure="(true|false)" -->/g)];
        return matches.length ? matches[matches.length - 1][1].replace("T", " ") : "-";
    };

    const now = new Date();
    const pad = value => String(value).padStart(2, "0");
    const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    const structureState = await journalState();
    const movies = media.filter(file => tags(getFrontmatter(file)).includes("movies")).length;
    const serials = media.filter(file => tags(getFrontmatter(file)).includes("serial")).length;

    info.push(`Карточек проверено: **${media.length}**.`);
    info.push(`Фильмов: **${movies}**, сериалов: **${serials}**.`);
    info.push(`Записей просмотров: **${viewFiles.length}**.`);
    info.push(`Записей сезонов: **${seasonFiles.length}**.`);
    info.push(`Страниц франшиз: **${franchiseFiles.length}**, связей с франшизами: **${franchiseLinkCount}**.`);
    info.push(`Шаблонов без названия: **${templates.length}**.`);
    info.push(`Возможных дублей карточек: **${possibleDuplicates.length}**.`);
    info.push(`Карточек без КП ID: **${missingKinopoiskIds.length}**. Проверены локальные поля; соответствие ID реальному фильму на сайтах этот аудит не подтверждает.`);

    const renderSection = (title, items, emptyText) => {
        if (!items.length) return `## ${title}\n\n${emptyText}\n\n`;
        return `## ${title}\n\n${items.map(item => `- ${item}`).join("\n")}\n\n`;
    };

    const checkUrl = encodeURIComponent("Кино - Проверить кинотеку");
    const fixUrl = encodeURIComponent("Кино - Исправить безопасное");
    const rolesUrl = encodeURIComponent("Кино - Обновить роли актёров");
    let report = `# Проверка кинотеки\n\n`;
    report += `[[Кино/_index|← Кино]] · [[Кино/_system/Журнал изменений|📜 Журнал]] · [[Кино/_system/Исключения|⛔ Исключения]]\n\n`;
    report += `[🔎 Проверить](obsidian://quickadd?choice=${checkUrl}) · [🛠 Исправить безопасное](obsidian://quickadd?choice=${fixUrl}) · [Обновить роли](obsidian://quickadd?choice=${rolesUrl})\n\n`;
    report += `## Состояние кинотеки\n\n`;
    report += `**${media.length} карточек** · **${movies} фильмов** · **${serials} сериалов** · **${viewFiles.length} просмотров** · **${seasonFiles.length} сезонов**\n\n`;
    report += `- Последняя проверка: **${timestamp}**.\n`;
    report += `- Последнее безопасное исправление: **${structureState}**.\n`;
    report += `- Текущее состояние: **${errors.length} ошибок**, **${warnings.length} предупреждений**.\n\n`;
    report += `## Итог\n\n- Ошибок: **${errors.length}**.\n- Предупреждений: **${warnings.length}**.\n${info.map(item => `- ${item}`).join("\n")}\n\n`;
    report += renderSection("❌ Ошибки", errors, "Ошибок не найдено.");
    report += renderSection("⚠️ Предупреждения", warnings, "Предупреждений нет.");
    report += renderSection("🔎 Возможные дубли", possibleDuplicates, "Похожих дублей не найдено.");

    report += `## Что проверяется\n\n`;
    report += "- карточки фильмов и сериалов: название, теги, релиз, личные/внешние оценки, число голосов, длительность, часть и счётчики;\n";
    report += "- IMDb ID и КП ID: формат, повторное использование IMDb ID; отсутствие ID отмечается предупреждением;\n";
    report += "- постер, режиссёр, актёры, жанры и роли: заполненность, допустимое написание, формат, скобки, wikilinks и дубли;\n";
    report += "- файлы ролей: наличие и непустой YAML, ссылка на основную карточку, совпадение людей/жанров с карточкой;\n";
    report += "- шаблонный блок ролей и кнопка рекомендаций: устаревший блок и отсутствие или дублирование кнопки;\n";
    report += "- ссылки на франшизы и связанные карточки: формат, повторения, существование цели и тип страницы франшизы;\n";
    report += "- записи просмотров: ссылка на фильм/сериал, номер, дата, оценка и флаг последнего просмотра;\n";
    report += "- история просмотров: повторяющиеся и пропущенные номера, количество записей и отметка последнего просмотра;\n";
    report += "- записи сезонов: ссылка на сериал, тег `serial`, номер, дата и оценка;\n";
    report += "- сезоны сериала: повторяющиеся и пропущенные номера, количество файлов сезонов и номер последнего сезона;\n";
    report += "- карточки-шаблоны без названия, пропуски IMDb ID/постера и возможные дубли названий.\n";

    const reportPath = normalizePath(REPORT_PATH);
    let reportFile = app.vault.getAbstractFileByPath(reportPath);
    if (reportFile) await app.vault.modify(reportFile, report);
    else reportFile = await app.vault.create(reportPath, report);

    new Notice(`Проверка кинотеки завершена: ошибок ${errors.length}, предупреждений ${warnings.length}.`, 9000);
    await app.workspace.getLeaf(false).openFile(reportFile);
};
