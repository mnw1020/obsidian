"use strict";

// Pure helpers: both QuickAdd and offline migration use the same lossless layout.
const UI_START = "<!-- KINO:UI:START -->";
const UI_END = "<!-- KINO:UI:END -->";
const MARKERS = {
    seasons: ["<!-- SEASONS:START -->", "<!-- SEASONS:END -->"],
    viewings: ["<!-- KINO:VIEWINGS:START -->", "<!-- KINO:VIEWINGS:END -->"]
};
const escapeRegex = value => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const newlineOf = raw => String(raw).includes("\r\n") ? "\r\n" : "\n";
const asNewlines = (value, newline) => String(value).replace(/\r?\n/g, newline);

function splitRaw(raw) {
    const text = String(raw ?? "");
    const match = text.match(/^(\ufeff?---[ \t]*\r?\n)([\s\S]*?)(\r?\n---[ \t]*(?:\r?\n|$))/);
    return match ? { opening: match[1], yaml: match[2], closing: match[3], body: text.slice(match[0].length) }
        : { opening: "", yaml: "", closing: "", body: text };
}

function fieldBlock(yaml, key) {
    const pattern = new RegExp("^(?:" + escapeRegex(key) + "|\"" + escapeRegex(key) + "\"|'" + escapeRegex(key) + "'):[^\\r\\n]*(?:\\r?\\n(?:[ \\t]+[^\\r\\n]*|-(?:[ \\t]+[^\\r\\n]*)?))*", "m");
    return String(yaml).match(pattern);
}

function simpleValue(value) {
    const text = String(value).trim();
    if (text.startsWith('"')) { try { return JSON.parse(text); } catch (_) {} }
    if (text.startsWith("'") && text.endsWith("'")) return text.slice(1, -1).replace(/''/g, "'");
    return text.replace(/[ \t]+#.*$/, "");
}

function readFields(yaml, parseYaml) {
    if (typeof parseYaml === "function") return parseYaml(yaml) ?? {};
    const result = {};
    for (const key of ["poster", "cssclasses"]) {
        const block = fieldBlock(yaml, key);
        if (!block) continue;
        const lines = block[0].split(/\r?\n/), value = lines[0].slice(lines[0].indexOf(":") + 1).trim();
        if (key === "cssclasses" && value.startsWith("[") && value.endsWith("]")) {
            try { result[key] = JSON.parse(value); }
            catch (_) { result[key] = value.slice(1, -1).split(",").map(simpleValue).filter(Boolean); }
        } else if (key === "cssclasses" && !value) {
            result[key] = lines.slice(1).filter(line => /^\s*-\s*/.test(line)).map(line => simpleValue(line.replace(/^\s*-\s*/, "")));
        } else result[key] = simpleValue(value);
    }
    return result;
}

function addClasses(yaml, kind, parseYaml, newline) {
    const fields = readFields(yaml, parseYaml);
    const existing = fields.cssclasses == null ? [] : Array.isArray(fields.cssclasses) ? fields.cssclasses : [fields.cssclasses];
    const needed = ["kino-page", "kino-" + kind];
    if (needed.every(value => existing.includes(value))) return yaml;
    const values = [...existing];
    needed.forEach(value => { if (!values.includes(value)) values.push(value); });
    const block = fieldBlock(yaml, "cssclasses");
    const replacement = "cssclasses: " + JSON.stringify(values);
    return block ? yaml.slice(0, block.index) + replacement + yaml.slice(block.index + block[0].length)
        : yaml + newline + replacement;
}

function regionPattern(start, end, global = false) {
    return new RegExp("^[ \\t]*" + escapeRegex(start) + "[ \\t]*\\r?\\n[\\s\\S]*?^[ \\t]*" + escapeRegex(end) + "[ \\t]*\\r?$", global ? "gm" : "m");
}

function uiBlock(kind, newline = "\n") {
    return [UI_START, "```dataviewjs", "try {",
        '    const file = app.vault.getAbstractFileByPath("Кино/_system/kino_ui.js");',
        '    if (!file) throw new Error("Не найден интерфейс кинотеки");',
        "    const kinoModule = { exports: {} };",
        '    new Function("module", "exports", await app.vault.read(file))(kinoModule, kinoModule.exports);',
        "    await kinoModule.exports({ dv, app, obsidian: typeof require === 'function' ? require('obsidian') : {}, kind: " + JSON.stringify(kind) + " });",
        "} catch (error) {", '    dv.paragraph("Интерфейс кинотеки временно недоступен. Данные карточки сохранены.");',
        '    console.warn("Кино: интерфейс", error);', "}", "```", UI_END].join(newline);
}

function recommendationPattern() {
    return /^<!-- KINO:RECOMMEND:BUTTON:V(?:1|2) -->[ \t]*\r?\n```dataviewjs[ \t]*\r?\n[\s\S]*?^```[ \t]*\r?$/gm;
}

function dedupeRecommendations(body) {
    let seen = false;
    return body.replace(recommendationPattern(), block => {
        if (!seen) { seen = true; return block; }
        return "";
    });
}

function takePoster(body, poster) {
    if (!poster) return { body, image: "" };
    const pattern = new RegExp("^[ \\t]*!\\[[^\\]\\r\\n]*\\]\\(" + escapeRegex(poster) + "\\)[ \\t]*\\r?$", "gm");
    let image = "";
    const remaining = body.replace(pattern, line => { if (!image) image = line.replace(/\r$/, ""); return ""; });
    return { body: remaining, image: image || `![](${poster})` };
}

function ensureLayout(raw, { kind = "media", parseYaml } = {}) {
    if (!/^(media|franchise|viewing|season|roles|entity|system)$/.test(kind)) throw new Error("Unknown kino layout kind: " + kind);
    const parts = splitRaw(raw);
    if (!parts.opening) return String(raw ?? "");
    const newline = newlineOf(raw);
    const fields = readFields(parts.yaml, parseYaml);
    const yaml = addClasses(parts.yaml, kind, parseYaml, newline);
    let body = parts.body.replace(regionPattern(UI_START, UI_END, true), "");
    body = dedupeRecommendations(body);
    const poster = kind === "media" ? String(fields.poster ?? "").trim() : "";
    const taken = takePoster(body, poster);
    body = taken.body.replace(/^(?:\r?\n)+/, "").replace(/(?:\r?\n)+$/, "");
    let result = parts.opening + yaml + parts.closing;
    if (!result.endsWith(newline)) result += newline;
    result += newline + uiBlock(kind, newline);
    if (body) result += newline + newline + body;
    if (taken.image) result += newline + newline + taken.image;
    return result + newline;
}

function region(kind, content, newline = "\n") {
    const markers = MARKERS[kind];
    if (!markers) throw new Error("Unknown kino generated region: " + kind);
    return markers[0] + newline + asNewlines(content, newline) + newline + markers[1];
}

// This whitelist recognizes the exact former generated history query only.
function legacyHistoryPattern() {
    return /^```dataview\r?\nTABLE WITHOUT ID\r?\n  Просмотр AS "№",\r?\n  choice\(Дата != null, dateformat\(Дата, "dd\.MM\.yyyy"\), string\(Год\)\) AS "Когда",\r?\n  Оценка AS "⭐",\r?\n  Комментарий AS "Мысль",\r?\n  file\.link AS "Запись"\r?\nFROM "Кино\/Просмотры"\r?\nWHERE Фильм = this\.file\.link\r?\nSORT Просмотр DESC, Год DESC, Дата DESC\r?\n```[ \t]*\r?$/gm;
}

function rebuildCard(raw, generated, options = {}) {
    const parts = splitRaw(raw), newline = newlineOf(raw);
    let body = parts.body;
    for (const [kind, markers] of Object.entries(MARKERS)) {
        const legacy = kind === "viewings" ? ["<!-- VIEWINGS:START -->", "<!-- VIEWINGS:END -->"] : markers;
        const match = String(generated).match(regionPattern(markers[0], markers[1]))
            || String(generated).match(regionPattern(legacy[0], legacy[1]));
        if (!match) continue;
        const replacement = asNewlines(match[0].replace(legacy[0], markers[0]).replace(legacy[1], markers[1]), newline);
        let placed = false;
        for (const pair of kind === "viewings" ? [markers, legacy] : [markers]) {
            body = body.replace(regionPattern(pair[0], pair[1], true), () => { if (placed) return ""; placed = true; return replacement; });
        }
        if (kind === "viewings") body = body.replace(legacyHistoryPattern(), () => { if (placed) return ""; placed = true; return replacement; });
        if (!placed) body += (body.endsWith(newline) ? newline : newline + newline) + replacement + newline;
    }
    return ensureLayout(parts.opening + parts.yaml + parts.closing + body, { kind: "media", ...options });
}

// Used when copying a legacy review to a new YAML comment. Unknown Markdown,
// custom queries and block IDs are deliberately retained.
function personalBody(body, poster = "") {
    let result = String(body ?? "").replace(regionPattern(UI_START, UI_END, true), "").replace(recommendationPattern(), "");
    result = result.replace(/^<!-- KINO:ROLES:EMBED:V2 -->\r?\n<details[^>]*class=["']kino-roles-details["'][^>]*>[\s\S]*?<\/details>/gm, "");
    for (const pair of [...Object.values(MARKERS), ["<!-- VIEWINGS:START -->", "<!-- VIEWINGS:END -->"]]) result = result.replace(regionPattern(pair[0], pair[1], true), "");
    result = result.replace(legacyHistoryPattern(), "");
    if (poster) result = takePoster(result, poster).body;
    return result.trim();
}

module.exports = { ensureLayout, rebuildCard, region, personalBody, splitRaw, uiBlock, UI_START, UI_END, MARKERS };
