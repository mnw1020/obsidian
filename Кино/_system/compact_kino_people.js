// QuickAdd: Кино - сжать поля актеров и ролей актеров.
// Работает в служебных файлах Кино/_system/Роли и совместима со старыми
// карточками, где эти поля еще находились в основной карточке.
// Приводит существующие поля к виду:
// Актеры: ["Имя 1", "Имя 2"]
// Роли актеров: ["Роль 1 - Имя 1", "Роль 2 - Имя 2"]
// Значения не сортируются и не объединяются: меняется только YAML-представление.

const ROOT = "Кино";
const FIELDS = ["Актеры", "Роли актеров"];

module.exports = async function compactKinoPeople({ app, obsidian: ob }) {
    const files = app.vault.getMarkdownFiles()
        .filter(file => isMediaCard(file))
        .sort((left, right) => left.path.localeCompare(right.path, "ru"));
    const notice = new ob.Notice(`Кино: сжимаю поля 0/${files.length}…`, 0);
    let changedCards = 0;
    let changedFields = 0;
    let errors = 0;

    try {
        for (let index = 0; index < files.length; index++) {
            const file = files[index];
            notice.setMessage?.(`Кино: сжимаю ${index + 1}/${files.length} - ${file.basename}`);
            try {
                const before = await app.vault.read(file);
                const result = compactRaw(before, ob);
                if (!result.changed) continue;

                let applied = false;
                await app.vault.process(file, current => {
                    if (current !== before) return current;
                    applied = true;
                    return result.raw;
                });
                if (!applied) throw new Error("карточка изменилась во время записи");
                changedCards++;
                changedFields += result.changedFields;
            } catch (error) {
                errors++;
                console.warn("Кино: не удалось сжать поля", file.path, error);
            }
        }
    } finally {
        notice.hide?.();
    }

    new ob.Notice(
        `Готово: карточек изменено ${changedCards}, полей ${changedFields}, ошибок ${errors}.`,
        12000
    );
};

function isMediaCard(file) {
    if (!file || file.extension !== "md" || !file.path.startsWith(`${ROOT}/`)) return false;
    const relative = file.path.slice(ROOT.length + 1);
    if (!relative.includes("/")) return file.basename !== "_index" && file.basename !== "Без названия";
    return relative.startsWith("_system/Роли/") && file.basename.endsWith(".роли");
}

function compactRaw(raw, ob) {
    const parts = yamlParts(raw);
    if (!parts) return { raw, changed: false, changedFields: 0 };

    let yaml = parts.yaml;
    let changedFields = 0;
    for (const key of FIELDS) {
        const block = propertyBlock(yaml, key);
        if (!block) continue;

        const parsed = readField(block[0], key, ob);
        if (!parsed.found) continue;

        const values = parsed.values;
        const replacement = `${key}: ${yamlArray(values)}`;
        if (block[0] === replacement) continue;
        yaml = yaml.slice(0, block.index) + replacement
            + yaml.slice(block.index + block[0].length);
        changedFields++;
    }

    return {
        raw: changedFields
            ? parts.prefix + yaml + parts.end + parts.body
            : raw,
        changed: changedFields > 0,
        changedFields
    };
}

function readField(block, key, ob) {
    try {
        const parsed = ob.parseYaml(block) || {};
        if (Object.prototype.hasOwnProperty.call(parsed, key)) {
            return { found: true, values: asArray(parsed[key]) };
        }
    } catch {
        // В старых ролях встречаются управляющие символы. Ниже есть
        // построчный разбор, который сохраняет их и безопасно сериализует.
    }

    const lines = block.split(/\r?\n/);
    const first = lines.shift() || "";
    const colon = first.indexOf(":");
    if (colon < 0) return { found: false, values: [] };
    const inline = first.slice(colon + 1).trim();
    if (!inline || inline === "[]") {
        return { found: true, values: lines
            .filter(line => /^\s*-\s+/.test(line))
            .map(line => decodeScalar(line.replace(/^\s*-\s+/, "")))
            .filter(value => value.trim() !== "") };
    }
    try {
        return { found: true, values: asArray(JSON.parse(inline)) };
    } catch {
        return { found: true, values: [decodeScalar(inline)].filter(value => value.trim() !== "") };
    }
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

function asArray(value) {
    if (value === null || value === undefined || value === "") return [];
    const values = Array.isArray(value) ? value : [value];
    return values
        .map(item => String(item ?? ""))
        .filter(item => item.trim() !== "");
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
