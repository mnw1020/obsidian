// Portable Obsidian module: explicit excerpts and a read-only index.
const META = "<!-- BOOK-EXCERPT:META -->";
// A new format version prevents a live Obsidian session from reusing old parsed metadata.
const STATE_KEY = "__bookKnowledgeV2";
const CORE_PATH = "Книги/_system/book_core.js";

function normalize(value) {
    return String(value ?? "").toLocaleLowerCase("ru").replace(/ё/g, "е").replace(/\s+/g, " ").trim();
}

function themes(value) {
    const values = Array.isArray(value) ? value : String(value ?? "").split(/[,;\n]+/);
    const seen = new Set();
    return values.map(v => String(v).trim().replace(/^#/, "")).filter(v => {
        const key = normalize(v);
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function isExactDate(value) {
    const match = String(value ?? "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match || Number(match[1]) < 1) return false;
    const date = new Date(0);
    date.setUTCFullYear(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    return date.getUTCFullYear() === Number(match[1]) && date.getUTCMonth() === Number(match[2]) - 1 && date.getUTCDate() === Number(match[3]);
}

function localDate(now = new Date()) {
    const pad = value => String(value).padStart(2, "0");
    return `${String(now.getFullYear()).padStart(4, "0")}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function parseExcerpts(text) {
    const lines = String(text ?? "").split(/\r?\n/);
    const excerpts = [];
    let fence = null;
    for (let i = 0; i < lines.length; i++) {
        const fenced = lines[i].match(/^\s*(`{3,}|~{3,})/);
        if (fenced) {
            if (!fence) fence = fenced[1];
            else if (fenced[1][0] === fence[0] && fenced[1].length >= fence.length) fence = null;
            continue;
        }
        if (fence) continue;
        const header = lines[i].match(/^>\s*\[!(quote|idea)\][+-]?(?:\s+.*)?$/i);
        if (!header) continue;
        let end = i + 1;
        const body = [];
        while (end < lines.length && /^>/.test(lines[end])) body.push(lines[end++].replace(/^> ?/, ""));
        let anchor = end;
        while (anchor < lines.length && !lines[anchor].trim()) anchor++;
        const id = lines[anchor]?.match(/^\^(book-excerpt-[a-z0-9-]+)\s*$/i)?.[1];
        const meta = body.indexOf(META);
        if (!id || meta < 0) continue;
        const fields = { themes: "", conclusion: "", location: "", savedDate: "" };
        let field = null;
        for (const line of body.slice(meta + 1)) {
            const match = line.match(/^\*\*(Темы|Вывод|Место в источнике|Сохранено):\*\*\s*(.*)$/);
            if (match) {
                field = { "Темы": "themes", "Вывод": "conclusion", "Место в источнике": "location", "Сохранено": "savedDate" }[match[1]];
                fields[field] = match[2];
            } else if (field) fields[field] += `\n${line.startsWith("  ") ? line.slice(2) : line}`;
        }
        const excerptText = body.slice(0, meta).join("\n").trim();
        if (excerptText) excerpts.push({
            id, type: header[1].toLowerCase(), text: excerptText,
            themes: themes(fields.themes), conclusion: fields.conclusion.trim(), location: fields.location.trim(),
            savedDate: isExactDate(fields.savedDate.trim()) ? fields.savedDate.trim() : "",
            line: i, endLine: anchor
        });
        i = anchor;
    }
    return excerpts;
}

function createId(text = "") {
    let id;
    do {
        const random = globalThis.crypto?.randomUUID?.().replace(/-/g, "") ?? Math.random().toString(36).slice(2, 12);
        id = `book-excerpt-${Date.now().toString(36)}-${random}`;
    } while (String(text).includes(`^${id}`));
    return id;
}

function renderExcerpt(value, newline = "\n") {
    const type = value.type === "idea" ? "idea" : "quote";
    const text = String(value.text ?? "").replace(/\r\n/g, "\n").trim();
    const id = value.id || createId();
    if (!text) throw new Error("Введите текст выписки.");
    if (text.includes(META) || /^\^book-excerpt-/m.test(text)) throw new Error("Этот фрагмент уже содержит служебные маркеры выписки.");
    if (!/^book-excerpt-[a-z0-9-]+$/i.test(id)) throw new Error("Некорректный идентификатор выписки.");
    const conclusion = String(value.conclusion ?? "").replace(/\r\n/g, "\n").trim();
    const location = String(value.location ?? "").replace(/[\r\n]+/g, " ").trim();
    const savedDate = String(value.savedDate ?? "").trim();
    if (savedDate && !isExactDate(savedDate)) throw new Error("Дата сохранения выписки должна быть действительной датой YYYY-MM-DD.");
    const content = [
        `> [!${type}] ${type === "quote" ? "Цитата" : "Идея"}`,
        ...text.split("\n").map(line => `> ${line}`), ">", `> ${META}`,
        `> **Темы:** ${themes(value.themes).join("; ")}`,
        `> **Вывод:** ${conclusion.split("\n")[0]}`,
        ...conclusion.split("\n").slice(1).map(line => `>   ${line}`),
        `> **Место в источнике:** ${location}`,
        ...(savedDate ? [`> **Сохранено:** ${savedDate}`] : []), "", `^${id}`, ""
    ];
    return content.join(newline);
}

function applyExcerpt(raw, value, selection = null) {
    const newline = raw.includes("\r\n") ? "\r\n" : "\n";
    const input = { ...value, id: value.id || createId(raw) };
    if (parseExcerpts(raw).some(entry => entry.id === input.id)) throw new Error("Выписка с таким идентификатором уже есть.");
    const block = renderExcerpt(input, newline);
    if (!selection) {
        const separator = raw.endsWith(newline + newline) || !raw ? "" : raw.endsWith(newline) ? newline : newline + newline;
        return raw + separator + block;
    }
    const normalized = raw.replace(/\r\n/g, "\n");
    if (normalized !== selection.baseline || normalized.slice(selection.from, selection.to) !== selection.text) {
        throw new Error("Текст книги изменился. Выделите фрагмент заново.");
    }
    const { from, to } = selection;
    if (from < 0 || to <= from || to > normalized.length || (from && normalized[from - 1] !== "\n") || (to < normalized.length && normalized[to] !== "\n" && normalized[to - 1] !== "\n")) {
        throw new Error("Для оформления выделите полный абзац или несколько целых строк.");
    }
    const frontmatter = normalized.match(/^---\s*\n[\s\S]*?\n---(?:\n|$)/);
    if (frontmatter && from < frontmatter[0].length) throw new Error("Свойства книги нельзя оформить как выписку.");
    const hs = normalized.indexOf("<!-- BOOK-READINGS:START -->");
    const he = normalized.indexOf("<!-- BOOK-READINGS:END -->", hs);
    if (hs >= 0 && he >= hs && from < he + "<!-- BOOK-READINGS:END -->".length && to > hs) {
        throw new Error("Историю чтений нельзя заменять выпиской. Добавьте новую выписку из выбранного текста.");
    }
    const offsets = [0];
    for (let index = 0; index < normalized.length; index++) if (normalized[index] === "\n") offsets.push(index + 1);
    for (const excerpt of parseExcerpts(normalized)) {
        const start = offsets[excerpt.line], end = offsets[excerpt.endLine + 1] ?? normalized.length;
        if (from < end && to > start) throw new Error("Этот фрагмент уже оформлен как выписка.");
    }
    let fence = null;
    for (const line of normalized.slice(0, from).split("\n")) {
        const match = line.match(/^\s*(`{3,}|~{3,})/);
        if (!match) continue;
        if (!fence) fence = match[1];
        else if (match[1][0] === fence[0] && match[1].length >= fence.length) fence = null;
    }
    if (fence) throw new Error("Выделите весь блок кода вместе с его границами.");
    function rawOffset(offset) {
        let index = 0, logical = 0;
        while (logical < offset && index < raw.length) {
            index += raw[index] === "\r" && raw[index + 1] === "\n" ? 2 : 1;
            logical++;
        }
        return index;
    }
    const prefix = raw.slice(0, rawOffset(from));
    const suffix = raw.slice(rawOffset(to));
    return prefix + (prefix && !prefix.endsWith(newline + newline) ? newline : "") + block + (suffix && !suffix.startsWith(newline) ? newline : "") + suffix;
}

function filterExcerpts(entries, filters = {}) {
    const query = normalize(filters.query);
    return entries.filter(entry =>
        (!filters.type || entry.type === filters.type) &&
        (!filters.author || entry.authors.includes(filters.author)) &&
        (!filters.theme || entry.themes.some(theme => normalize(theme) === normalize(filters.theme))) &&
        (!query || normalize([entry.text, entry.conclusion, entry.location, entry.savedDate, entry.title, ...entry.authors, ...entry.themes].join(" ")).includes(query))
    );
}

function noteSearch(records, query) {
    const tokens = normalize(query).split(" ").filter(Boolean);
    if (normalize(query).length < 2) return [];
    const results = [];
    for (const record of records) {
        const fm = record.fm;
        const authors = Array.isArray(fm.authors) ? fm.authors : [fm.authors].filter(Boolean);
        const body = record.text.replace(/^---\s*\n[\s\S]*?\n---(?:\n|$)/, "")
            .split("\n").filter(line => !line.includes("obsidian://") && !line.includes("<!-- BOOK-")).join("\n");
        const haystack = normalize([fm.title, ...authors, body].join(" "));
        if (!tokens.every(token => haystack.includes(token))) continue;
        const lines = body.split("\n");
        const matched = lines.findIndex(line => tokens.some(token => normalize(line).includes(token)));
        const snippet = matched >= 0 ? lines[matched].replace(/^>\s*|^#+\s*/g, "").trim().slice(0, 150) : "Совпадение в названии или авторе";
        const originalLines = record.text.split("\n");
        const line = matched >= 0 ? Math.max(0, originalLines.indexOf(lines[matched])) : 0;
        results.push({ file: record.file, title: String(fm.title || record.file.basename), authors, snippet, line, score: tokens.filter(token => normalize(fm.title).includes(token)).length });
    }
    return results.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title, "ru"));
}

async function loadCore(app, obsidian) {
    const file = app.vault.getAbstractFileByPath(CORE_PATH);
    if (!file) throw new Error("Не найден общий модуль библиотеки.");
    const mod = { exports: {} };
    new Function("module", await app.vault.read(file))(mod);
    return mod.exports({ app, obsidian });
}

async function getService({ app, obsidian }) {
    const core = await loadCore(app, obsidian);
    let state = app[STATE_KEY];
    if (!state) state = app[STATE_KEY] = { cache: new Map(), pending: new Map(), listeners: new Set(), eventRefs: [] };
    if (!state.pending) state.pending = new Map();
    const invalidate = (path, oldPath) => {
        for (const cached of new Set([...state.cache.keys(), ...state.pending.keys()])) {
            if (!path || cached === path || cached.startsWith(path + "/") || (oldPath && (cached === oldPath || cached.startsWith(oldPath + "/")))) {
                state.cache.delete(cached);
                state.pending.delete(cached);
            }
        }
        for (const callback of state.listeners) callback();
    };
    if (!state.watching && app.vault.on) {
        state.watching = true;
        for (const event of ["modify", "create", "delete", "rename"]) {
            state.eventRefs.push(app.vault.on(event, (file, oldPath) => {
                if (file.path.startsWith("Книги/") || oldPath?.startsWith("Книги/")) invalidate(file.path, oldPath);
            }));
        }
        if (app.metadataCache.on) state.eventRefs.push(app.metadataCache.on("changed", file => {
            if (file.path.startsWith("Книги/")) for (const callback of state.listeners) callback();
        }));
    }
    async function snapshot() {
        const cards = await core.snapshot();
        const paths = new Set(cards.map(card => card.file.path));
        for (const path of state.cache.keys()) if (!paths.has(path)) state.cache.delete(path);
        const records = [];
        for (let i = 0; i < cards.length; i += 4) {
            const batch = await Promise.all(cards.slice(i, i + 4).map(async ({ file, fm }) => {
                const mtime = file.stat?.mtime;
                let item = state.cache.get(file.path);
                if (!item || mtime === undefined || item.mtime !== mtime) {
                    const filePath = file.path;
                    let pending = state.pending.get(filePath);
                    if (!pending || pending.mtime !== mtime) {
                        pending = { mtime };
                        pending.promise = (async () => {
                            try {
                                const text = (await app.vault.read(file)).replace(/\r\n/g, "\n");
                                const value = { mtime, text, excerpts: parseExcerpts(text), history: [], historyError: "" };
                                try { value.history = core.parseHistory(text).entries; }
                                catch (error) { value.historyError = error.message || String(error); }
                                if (state.pending.get(filePath) === pending && file.path === filePath && mtime !== undefined && mtime === file.stat?.mtime) state.cache.set(filePath, value);
                                return value;
                            } catch (error) {
                                if (!app.vault.getAbstractFileByPath(filePath)) return null;
                                return { error: error.message || String(error), text: "", excerpts: [], history: [] };
                            }
                        })();
                        state.pending.set(filePath, pending);
                    }
                    try { item = await pending.promise; }
                    finally { if (state.pending.get(filePath) === pending) state.pending.delete(filePath); }
                    if (!item) return null;
                }
                return { file, fm, ...item };
            }));
            records.push(...batch.filter(Boolean));
            if (i + 4 < cards.length) await new Promise(resolve => setTimeout(resolve, 0));
        }
        return records;
    }
    return {
        core, snapshot, invalidate,
        subscribe(callback) { state.listeners.add(callback); return () => state.listeners.delete(callback); },
        excerpts(records) {
            return records.flatMap(record => record.excerpts.map(excerpt => ({ ...excerpt,
                file: record.file, path: record.file.path, title: String(record.fm.title || record.file.basename),
                authors: Array.isArray(record.fm.authors) ? record.fm.authors.map(String) : [String(record.fm.authors || "")]
            })));
        },
        search: noteSearch
    };
}

function element(parent, tag, text, cls) {
    const el = parent.ownerDocument.createElement(tag);
    if (text !== undefined) el.textContent = text;
    if (cls) el.className = cls;
    parent.appendChild(el);
    return el;
}

function sourceLink(parent, entry, app) {
    const link = element(parent, "a", `${entry.title} · ${entry.authors.join(", ")}`, "internal-link");
    const target = `${entry.path.replace(/\.md$/i, "")}#^${entry.id}`;
    link.href = target;
    link.setAttribute("data-href", target);
    link.addEventListener("click", event => {
        event.preventDefault();
        if (app.vault.getAbstractFileByPath(entry.path)) app.workspace.openLinkText(target, entry.path, event.ctrlKey || event.metaKey);
        else link.textContent = "Карточка больше не доступна";
    });
}

function renderCard(parent, entry, app) {
    const card = element(parent, "article", undefined, "book-excerpt-card");
    const top = element(card, "div", undefined, "book-excerpt-meta");
    element(top, "strong", entry.type === "idea" ? "💡 Идея" : "💬 Цитата");
    if (entry.themes.length) element(top, "span", " · " + entry.themes.join(" · "));
    const text = element(card, "p", entry.text);
    text.style.whiteSpace = "pre-wrap";
    if (entry.conclusion) {
        const conclusion = element(card, "p", "Мой вывод: " + entry.conclusion);
        conclusion.style.whiteSpace = "pre-wrap";
    }
    if (entry.location) element(card, "small", entry.location);
    if (entry.savedDate) {
        const [year, month, day] = entry.savedDate.split("-");
        element(card, "div", `Сохранено: ${day}.${month}.${year}`, "book-excerpt-meta");
    }
    sourceLink(element(card, "div"), entry, app);
}

async function render({ dv, app, obsidian, mode = "index" }) {
    const root = element(dv.container, "div", undefined, "book-knowledge");
    const status = element(root, "p", "Загружаю выписки…");
    let disposed = false, generation = 0, timer;
    let service;
    try { service = await getService({ app, obsidian }); }
    catch (error) { status.textContent = `Не удалось загрузить выписки: ${error.message || error}`; return; }
    const controls = element(root, "div", undefined, "book-knowledge-controls");
    const content = element(root, "div", undefined, "book-knowledge-results");
    let entries = [], limit = 25, randomId = null;
    const filters = { query: "", theme: "", author: "", type: "" };
    const selects = {};
    function draw() {
        content.replaceChildren();
        const filtered = filterExcerpts(entries, filters);
        status.textContent = entries.length ? `${filtered.length} из ${entries.length} выписок` : "Добавь первую выписку из карточки книги. Старые конспекты можно включать по одному выделенному фрагменту.";
        if (mode === "home") {
            if (entries.length) {
                const entry = entries.find(entry => `${entry.path}:${entry.id}` === randomId) || entries[Math.floor(Math.random() * entries.length)];
                randomId = `${entry.path}:${entry.id}`;
                renderCard(content, entry, app);
            }
            return;
        }
        for (const entry of filtered.slice(0, limit)) renderCard(content, entry, app);
        if (filtered.length > limit) {
            const more = element(content, "button", `Ещё ${Math.min(25, filtered.length - limit)}`);
            more.addEventListener("click", () => { limit += 25; draw(); });
        } else if (!filtered.length && entries.length) element(content, "p", "По этим условиям выписок пока нет.");
    }
    if (mode === "home") {
        element(controls, "button", "Другая выписка").addEventListener("click", () => {
            const choices = entries.filter(entry => `${entry.path}:${entry.id}` !== randomId);
            const entry = choices[Math.floor(Math.random() * choices.length)];
            if (entry) randomId = `${entry.path}:${entry.id}`;
            draw();
        });
    } else {
        const query = element(controls, "input");
        query.type = "search";
        query.placeholder = "Текст, тема, автор или вывод";
        query.setAttribute("aria-label", "Поиск выписок");
        query.addEventListener("input", () => { filters.query = query.value; limit = 25; draw(); });
        for (const [field, label] of [["theme", "Все темы"], ["author", "Все авторы"], ["type", "Цитаты и идеи"]]) {
            const select = selects[field] = element(controls, "select");
            select.setAttribute("aria-label", label);
            select.addEventListener("change", () => { filters[field] = select.value; limit = 25; draw(); });
        }
    }
    async function reload() {
        const current = ++generation;
        try {
            const records = await service.snapshot();
            if (disposed || current !== generation) return;
            entries = service.excerpts(records);
            if (mode !== "home") {
                for (const [field, values, label] of [
                    ["theme", [...new Set(entries.flatMap(entry => entry.themes))].sort((a, b) => a.localeCompare(b, "ru")), "Все темы"],
                    ["author", [...new Set(entries.flatMap(entry => entry.authors))].sort((a, b) => a.localeCompare(b, "ru")), "Все авторы"],
                    ["type", ["quote", "idea"], "Цитаты и идеи"]
                ]) {
                    const select = selects[field];
                    select.replaceChildren();
                    element(select, "option", label).value = "";
                    for (const value of values) element(select, "option", field === "type" ? value === "quote" ? "Цитаты" : "Идеи" : value).value = value;
                    select.value = values.includes(filters[field]) ? filters[field] : "";
                    filters[field] = select.value;
                }
            }
            draw();
            const failed = records.filter(record => record.error).length;
            if (failed) status.textContent += ` · Не удалось прочитать карточек: ${failed}`;
        } catch (error) { if (!disposed) status.textContent = `Не удалось загрузить выписки: ${error.message || error}`; }
    }
    const unsubscribe = service.subscribe(() => { clearTimeout(timer); timer = setTimeout(reload, 200); });
    function dispose() { disposed = true; clearTimeout(timer); unsubscribe(); }
    dv.component?.register?.(dispose);
    await reload();
    return { reload, dispose };
}

module.exports = Object.assign(render, { parseExcerpts, renderExcerpt, applyExcerpt, filterExcerpts, noteSearch, createId, getService, loadCore, themes, normalize, isExactDate, localDate });
