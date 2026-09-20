// QuickAdd: Кино - вынести актеров и роли в служебные файлы.
// Формат: Кино/<карточка>.md + Кино/_system/Роли/<карточка>.роли.md.
// Основная карточка получает только ссылку на служебный файл; имя режиссера
// остается в ней как короткий индекс для старых Bases и страницы режиссеров.

const ROOT = "Кино";
const ROLE_DIR = `${ROOT}/_system/Роли`;

const ROLE_LINKS_BLOCK = [
    "<!-- KINO:ENTITY:LINKS:V3 -->",
    "```dataviewjs",
    "const KINO_ENTITY_FIELDS = [",
    "    [\"Режисер\", \"Режиссер\", \"Кино - Открыть режиссера\"],",
    "    [\"Актеры\", \"Актеры\", \"Кино - Открыть актера\"],",
    "    [\"Жанр\", \"Жанры\", \"Кино - Открыть жанр\"]",
    "];",
    "",
    "function kinoText(value) { return String(value ?? \"\").trim().normalize(\"NFC\"); }",
    "function kinoValues(value) {",
    "    return [...new Set((Array.isArray(value) ? value : [value]).map(kinoText).filter(Boolean))];",
    "}",
    "function kinoName(value) {",
    "    const text = kinoText(value);",
    "    const actorNames = kinoValues(dv.current()[\"Актеры\"]);",
    "    const known = actorNames.find(name =>",
    "        text === name || text.startsWith(name + \" - \") || text.endsWith(\" - \" + name)",
    "    );",
    "    if (known) return known;",
    "    return text.includes(\" - \") ? text.split(/\\s+-\\s+/).slice(-1)[0].trim() : text;",
    "}",
    "function kinoUri(choice, value) {",
    "    return \"obsidian://quickadd?vault=\" + encodeURIComponent(app.vault.getName())",
    "        + \"&choice=\" + encodeURIComponent(choice)",
    "        + \"&value-entity=\" + encodeURIComponent(value);",
    "}",
    "",
    "const actorRoles = kinoValues(dv.current()[\"Роли актеров\"]);",
    "const root = dv.container.createDiv({ cls: \"kino-entity-links\" });",
    "for (const [field, label, choice] of KINO_ENTITY_FIELDS) {",
    "    const row = root.createDiv({ cls: \"kino-entity-links-row\" });",
    "    row.createEl(\"strong\", { text: label + \": \" });",
    "    const values = field === \"Актеры\"",
    "        ? (actorRoles.length ? actorRoles : kinoValues(dv.current()[field]))",
    "        : kinoValues(dv.current()[field]);",
    "    if (!values.length) { row.appendText(\"Не указано\"); continue; }",
    "    if (field === \"Актеры\") {",
    "        values.forEach(value => {",
    "            const line = row.createDiv({ cls: \"kino-entity-link-line\" });",
    "            const link = line.createEl(\"a\");",
    "            link.textContent = value;",
    "            link.href = kinoUri(choice, kinoName(value));",
    "        });",
    "        continue;",
    "    }",
    "    values.forEach((value, index) => {",
    "        if (index) row.appendText(String.fromCharCode(32, 183, 32));",
    "        const link = row.createEl(\"a\");",
    "        link.textContent = value;",
    "        link.href = kinoUri(choice, value);",
    "    });",
    "}",
    "```"
].join("\n");

module.exports = async function migrateKinoRolesFiles(params) {
    const { app, obsidian: ob } = params;
    const files = app.vault.getMarkdownFiles()
        .filter(file => isMedia(file, app))
        .sort((a, b) => a.path.localeCompare(b.path, "ru"));
    const notice = new ob.Notice(`Кино: вынос ролей 0/${files.length}…`, 0);
    let processed = 0;
    let changed = 0;
    let created = 0;
    let failed = 0;
    try {
        for (const file of files) {
            processed++;
            notice.setMessage?.(`Кино: вынос ролей ${processed}/${files.length} - ${file.basename}`);
            try {
                const raw = await app.vault.read(file);
                const parsed = parseFrontmatter(raw, ob);
                if (!parsed) continue;
                const rolePath = `${ROLE_DIR}/${file.basename}.роли.md`;
                const roleFile = app.vault.getAbstractFileByPath(rolePath);
                const hasLegacyPeople = parsed.data.Актеры !== undefined
                    || parsed.data["Роли актеров"] !== undefined;
                let sourceData = parsed.data;
                if (!hasLegacyPeople && roleFile) {
                    const roleRaw = await app.vault.read(roleFile);
                    sourceData = parseFrontmatter(roleRaw, ob)?.data || parsed.data;
                }
                const actors = sortedUnique(list(sourceData.Актеры));
                const actorRoles = sortedRoles(list(sourceData["Роли актеров"]));
                const directors = sortedUnique(list(sourceData.Режисер ?? sourceData.Режиссер));
                const roleContent = roleCard(parsed.data, file, actors, actorRoles, directors);
                await makeFolders(app, rolePath);
                if (roleFile) {
                    // После первого переноса люди живут только во внешнем файле.
                    // Повторный запуск не должен заменить его пустыми полями основной карточки.
                    if (hasLegacyPeople) await app.vault.modify(roleFile, roleContent);
                } else { await app.vault.create(rolePath, roleContent); created++; }

                const next = ensureRoleEmbed(removePeopleFields(raw), rolePath);
                if (next !== raw) {
                    await app.vault.modify(file, next);
                    changed++;
                }
            } catch (error) {
                failed++;
                console.warn("Кино: не удалось вынести роли", file.path, error);
            }
        }
    } finally {
        notice.hide?.();
    }
    new ob.Notice(`Роли вынесены: обработано ${processed}, карточек изменено ${changed}, файлов ролей создано ${created}, ошибок ${failed}.`, 15000);
};

function isMedia(file, app) {
    if (!file.path.startsWith(`${ROOT}/`) || file.path.slice(ROOT.length + 1).includes("/")) return false;
    if (["_index", "Без названия"].includes(file.basename)) return false;
    const fm = app.metadataCache.getFileCache(file)?.frontmatter || {};
    const tags = list(fm.tags).map(value => value.replace(/^#/, "").toLowerCase());
    return tags.includes("movies") || tags.includes("serial");
}

function list(value) {
    if (value == null || value === "") return [];
    return (Array.isArray(value) ? value : [value]).map(item => String(item ?? "").trim()).filter(Boolean);
}

function parseFrontmatter(raw, ob) {
    const match = raw.match(/^(\ufeff?---\r?\n)([\s\S]*?)(\r?\n---(?:\r?\n|$))/);
    if (!match) return null;
    try { return { prefix: match[1], yaml: match[2], end: match[3], body: raw.slice(match[0].length), data: ob.parseYaml(match[2]) || {} }; }
    catch { return null; }
}

function sortedUnique(values) {
    return [...new Set(list(values))].sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base", numeric: true }));
}

function roleKey(value) {
    const text = String(value ?? "");
    const match = text.match(/^(.+?)\s+-\s+(.+)$/);
    return [match?.[1] || text, match?.[2] || ""];
}

function sortedRoles(values) {
    return [...new Set(list(values))].sort((a, b) => {
        const [ar, aa] = roleKey(a);
        const [br, ba] = roleKey(b);
        return ar.localeCompare(br, "en", { sensitivity: "base", numeric: true })
            || aa.localeCompare(ba, "en", { sensitivity: "base", numeric: true });
    });
}

function yamlArray(values) {
    return JSON.stringify(values).replace(/[\u007f-\u009f]/g,
        character => `\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`);
}

function roleCard(fm, mainFile, actors, actorRoles, directors) {
    const title = String(fm.Название || mainFile.basename).trim();
    const imdbId = String(fm["imdb Id"] || "").trim();
    const kpId = String(fm["Кинопоиск ID"] || "").trim();
    const genres = sortedUnique(fm.Жанр);
    return [
        "---",
        `Название: ${JSON.stringify(title)}`,
        `Основная карточка: ${JSON.stringify(mainFile.path)}`,
        `imdb Id: ${JSON.stringify(imdbId)}`,
        `Кинопоиск ID: ${JSON.stringify(kpId)}`,
        `Жанр: ${yamlArray(genres)}`,
        `Режисер: ${yamlArray(directors)}`,
        `Актеры: ${yamlArray(actors)}`,
        `Роли актеров: ${yamlArray(actorRoles)}`,
        "---",
        ROLE_LINKS_BLOCK,
        ""
    ].join("\n");
}

function removePeopleFields(raw) {
    const parsed = parseFrontmatterForRewrite(raw);
    if (!parsed) return raw;
    let yaml = parsed.yaml;
    for (const key of ["Актеры", "Роли актеров"]) {
        const safe = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const expression = new RegExp('(?:^|\\r?\\n)'+safe+':[^\\r\\n]*(?:\\r?\\n(?:[ \\t]+[^\\r\\n]*|(?=\\r?$)))*', "m");
        yaml = yaml.replace(expression, "");
    }
    return parsed.prefix + yaml + parsed.end + parsed.body;
}

function parseFrontmatterForRewrite(raw) {
    const match = raw.match(/^(\ufeff?---\r?\n)([\s\S]*?)(\r?\n---(?:\r?\n|$))/);
    return match ? { prefix: match[1], yaml: match[2], end: match[3], body: raw.slice(match[0].length) } : null;
}

function setRawField(raw, key, value) {
    const parsed = parseFrontmatterForRewrite(raw);
    if (!parsed) return raw;
    const newline = raw.includes("\r\n") ? "\r\n" : "\n";
    const safe = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const expression = new RegExp('^'+safe+':[^\\r\\n]*(?:\\r?\\n(?:[ \\t]+[^\\r\\n]*|(?=\\r?$)))*', "m");
    const line = `${key}: ${JSON.stringify(value)}`;
    parsed.yaml = expression.test(parsed.yaml) ? parsed.yaml.replace(expression, line)
        : parsed.yaml.trimEnd() + newline + line;
    return parsed.prefix + parsed.yaml + parsed.end + parsed.body;
}

function ensureRoleEmbed(raw, rolePath) {
    const withPath = setRawField(raw, "Роли файл", rolePath);
    const parsed = parseFrontmatterForRewrite(withPath);
    if (!parsed) return withPath;
    const newline = withPath.includes("\r\n") ? "\r\n" : "\n";
    const oldBlock = /(?:\r?\n)?^[ \t]*<!-- KINO:ENTITY:LINKS:V(?:1|2|3) -->\r?\n```dataviewjs\r?\n[\s\S]*?^```[ \t]*(?:\r?\n|$)/m;
    const oldEmbed = /(?:\r?\n)?^[ \t]*<!-- KINO:ROLES:EMBED:V1 -->\r?\n!\[\[[^\]]+\]\][ \t]*(?:\r?\n|$)/m;
    let body = parsed.body.replace(oldBlock, "").replace(oldEmbed, "").replace(/^(?:\r?\n)+/, "");
    return parsed.prefix + parsed.yaml + parsed.end
        + `<!-- KINO:ROLES:EMBED:V1 -->${newline}![[${rolePath.replace(/\.md$/i, "")}]]${newline}`
        + body;
}

async function makeFolders(app, path) {
    let current = "";
    for (const part of path.split("/").slice(0, -1)) {
        current = current ? `${current}/${part}` : part;
        if (!app.vault.getAbstractFileByPath(current)) await app.vault.createFolder(current);
    }
}
