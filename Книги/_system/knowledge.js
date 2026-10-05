// Portable Obsidian module: explicit excerpts and a live reading index.
const META = "<!-- BOOK-EXCERPT:META -->";
// A new format version prevents a live Obsidian session from reusing old parsed metadata.
const STATE_KEY = "__bookKnowledgeV5";
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

function excerptAuthors(value) {
    const values = Array.isArray(value) ? value : String(value ?? "").split(/[;\n]+/);
    return [...new Set(values.map(value => String(value).replace(/[\r\n]+/g, " ").trim()).filter(Boolean))];
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
        const fields = { themes: "", section: undefined, conclusion: "", location: "", sourceTitle: "", sourceAuthors: undefined, savedDate: "" };
        const names = { "Темы": "themes", "Раздел": "section", "Вывод": "conclusion", "Место в источнике": "location", "Произведение": "sourceTitle", "Автор": "sourceAuthors", "Сохранено": "savedDate" };
        let field = null;
        for (const line of body.slice(meta + 1)) {
            const match = line.match(/^\*\*([^*]+):\*\*\s*(.*)$/);
            if (match) {
                field = names[match[1]] || null;
                if (field) fields[field] = match[2];
            } else if (field) fields[field] += `\n${line.startsWith("  ") ? line.slice(2) : line}`;
        }
        const excerptText = body.slice(0, meta).join("\n").trim();
        if (excerptText) excerpts.push({
            id, type: "quote", text: excerptText,
            themes: themes(fields.themes), conclusion: fields.conclusion.trim(), location: fields.location.trim(),
            ...(fields.section !== undefined ? { section: themePath(fields.section) } : {}),
            sourceTitle: fields.sourceTitle.trim(),
            ...(fields.sourceAuthors !== undefined ? { sourceAuthors: excerptAuthors(fields.sourceAuthors) } : {}),
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
        `> [!quote] Цитата`,
        ...text.split("\n").map(line => `> ${line}`), ">", `> ${META}`,
        `> **Темы:** ${themes(value.themes).join("; ")}`,
        ...(value.section !== undefined ? [`> **Раздел:** ${themePath(String(value.section).replace(/[\r\n]+/g, " "))}`] : []),
        `> **Вывод:** ${conclusion.split("\n")[0]}`,
        ...conclusion.split("\n").slice(1).map(line => `>   ${line}`),
        `> **Место в источнике:** ${location}`,
        ...(String(value.sourceTitle ?? "").trim() ? [`> **Произведение:** ${String(value.sourceTitle).replace(/[\r\n]+/g, " ").trim()}`] : []),
        ...(value.sourceAuthors !== undefined ? [`> **Автор:** ${excerptAuthors(value.sourceAuthors).join("; ")}`] : []),
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
    const tokens = normalize(filters.query).split(" ").filter(Boolean);
    return entries.filter(entry =>
        (!filters.author || entry.authors.includes(filters.author)) &&
        (!filters.source || entry.path === filters.source) &&
        (!filters.theme || entry.themes.some(theme => themeMatches(theme, filters.theme))) &&
        (!tokens.length || tokens.every(token => (entry.searchText ?? excerptSearchText(entry)).includes(token)))
    );
}

function excerptSearchText(entry) {
    return normalize([entry.text, entry.conclusion, entry.location, entry.savedDate, entry.title, entry.section, entry.sourceTitle, ...(entry.sourceAuthors || []), ...entry.authors, ...entry.themes].join(" "));
}

// Hierarchy comes only from explicit theme paths; existing flat themes stay flat.
function themePath(value) { return String(value ?? "").split("/").map(part => part.trim()).filter(Boolean).join("/"); }
function themeMatches(value, selected) {
    const actual = normalize(themePath(value)), target = normalize(themePath(selected));
    return actual === target || actual.startsWith(target + "/");
}
function themeOptions(entries) {
    const options = new Map();
    for (const entry of entries) for (const theme of entry.themes) {
        const parts = themePath(theme).split("/");
        for (let depth = 1; depth <= parts.length; depth++) {
            const label = parts.slice(0, depth).join("/");
            if (label && !options.has(normalize(label))) options.set(normalize(label), label);
        }
    }
    return [...options.values()].sort((a, b) => a.localeCompare(b, "ru"));
}
function sortExcerpts(entries) {
    return [...entries].sort((a, b) => (b.savedDate || "").localeCompare(a.savedDate || "") || a.title.localeCompare(b.title, "ru") || a.path.localeCompare(b.path, "ru") || a.line - b.line || a.id.localeCompare(b.id));
}
function excerptPage(entries, page = 1, size = 20) {
    const pages = Math.max(1, Math.ceil(entries.length / size));
    const current = Math.min(pages, Math.max(1, Math.floor(Number(page) || 1)));
    const offset = (current - 1) * size;
    return { page: current, pages, start: entries.length ? offset + 1 : 0, end: Math.min(offset + size, entries.length), entries: entries.slice(offset, offset + size) };
}

function quoteCountLabel(count) {
    const last = count % 10, teen = count % 100 >= 11 && count % 100 <= 14;
    return `${count} ${teen ? "цитат" : last === 1 ? "цитата" : last >= 2 && last <= 4 ? "цитаты" : "цитат"}`;
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
    async function snapshot({ includeCollections = false } = {}) {
        const cards = await core.snapshot();
        if (includeCollections) {
            for (const file of app.vault.getMarkdownFiles()) {
                if (!file.path.startsWith("Книги/Цитаты/")) continue;
                const fm = core.getFrontmatter(file);
                if (fm.note_type === "excerpt_collection" && String(fm.title ?? "").trim()) cards.push({ file, fm, collection: true });
            }
        }
        const paths = new Set(cards.map(card => card.file.path));
        for (const path of state.cache.keys()) if (!paths.has(path)) state.cache.delete(path);
        const records = [];
        for (let i = 0; i < cards.length; i += 4) {
            const batch = await Promise.all(cards.slice(i, i + 4).map(async ({ file, fm, collection = false }) => {
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
                                if (!collection) {
                                    try { value.history = core.parseHistory(text).entries; }
                                    catch (error) { value.historyError = error.message || String(error); }
                                }
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
                return { file, fm, collection, ...item };
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
                collection: Boolean(record.collection), file: record.file, path: record.file.path, title: String(record.fm.title || record.file.basename),
                section: excerpt.section !== undefined ? excerpt.section : themePath(record.fm.quote_section),
                authors: (Array.isArray(record.fm.authors) ? record.fm.authors : [record.fm.authors]).map(value => String(value ?? "").trim()).filter(Boolean)
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
    const link = element(parent, "a", [entry.title, entry.authors.join(", ")].filter(Boolean).join(" · "), "internal-link");
    const target = `${entry.path.replace(/\.md$/i, "")}#^${entry.id}`;
    link.href = target;
    link.setAttribute("data-href", target);
    link.addEventListener("click", event => {
        event.preventDefault();
        if (app.vault.getAbstractFileByPath(entry.path)) app.workspace.openLinkText(target, entry.path, event.ctrlKey || event.metaKey);
        else link.textContent = "Карточка больше не доступна";
    });
}

function quoteSource(entry) {
    const authors = entry.collection ? (entry.sourceAuthors !== undefined ? entry.sourceAuthors : entry.authors) : entry.authors;
    if (!entry.collection) return { key: `source:${entry.path}`, title: entry.title, authors, label: entry.title };
    if (entry.sourceTitle) return { key: `external:${normalize(entry.sourceTitle)}:${authors.map(normalize).join(";")}`, title: entry.sourceTitle, authors, label: entry.sourceTitle };
    if (authors.length) return { key: `author:${authors.map(normalize).join(";")}`, title: "", authors, label: authors.join(", ") };
    return { key: "source:unknown", title: "", authors: [], label: "Без источника" };
}

function quoteSectionPath(entry) { return themePath(entry.section) || "Неразобранное"; }
function buildQuoteTree(entries, mode = "sections") {
    const roots = new Map();
    for (const entry of entries) {
        if (mode === "sources") {
            const source = quoteSource(entry);
            if (!roots.has(source.key)) roots.set(source.key, { key: source.key, label: source.label, caption: source.authors.join(", "), count: 0, children: new Map() });
            roots.get(source.key).count++;
        } else {
            const parts = quoteSectionPath(entry).split("/"); let level = roots;
            for (let depth = 0; depth < parts.length; depth++) {
                const key = `section:${normalize(parts.slice(0, depth + 1).join("/"))}`;
                if (!level.has(key)) level.set(key, { key, label: parts[depth], count: 0, children: new Map() });
                const node = level.get(key); node.count++; level = node.children;
            }
        }
    }
    function finish(level, root = false) {
        return [...level.values()].sort((a, b) => {
            const last = node => node.key === "section:неразобранное" || node.key === "source:unknown";
            return Number(last(a)) - Number(last(b)) || (root && mode === "sections" ? b.count - a.count : 0) || a.label.localeCompare(b.label, "ru");
        }).map(node => ({ ...node, children: finish(node.children) }));
    }
    const result = finish(roots, true);
    if (mode === "sources") {
        const counts = new Map(); for (const node of result) counts.set(node.label, (counts.get(node.label) || 0) + 1);
        for (const node of result) if (counts.get(node.label) > 1 && !node.caption) node.caption = node.key.replace(/^source:Книги\//, "");
    }
    return result;
}
function quoteInNode(entry, key, mode = "sections") {
    if (!key || key === "all") return true;
    if (mode === "sources") return quoteSource(entry).key === key;
    const actual = `section:${normalize(quoteSectionPath(entry))}`;
    return actual === key || actual.startsWith(key + "/");
}

function renderQuote(parent, entry, app, onEdit, home = false) {
    const row = element(parent, "article", undefined, home ? "book-excerpt-card" : "book-quotes-row");
    const text = element(row, "p", entry.text, "book-quote-text"); text.style.whiteSpace = "pre-wrap";
    const footer = element(row, "footer", undefined, "book-quote-footer");
    const info = element(footer, "div", undefined, "book-quote-source");
    const source = quoteSource(entry);
    if (source.authors.length) element(info, "span", source.authors.join(", "), "book-quote-authors");
    const target = `${entry.path.replace(/\.md$/i, "")}#^${entry.id}`;
    const link = element(info, "a", source.title || (source.authors.length ? "Открыть заметку" : "Источник не указан"), "internal-link");
    link.title = `Открыть цитату: ${entry.title}`;
    link.href = target; link.setAttribute("data-href", target);
    link.addEventListener("click", event => {
        event.preventDefault();
        if (app.vault.getAbstractFileByPath(entry.path)) app.workspace.openLinkText(target, entry.path, event.ctrlKey || event.metaKey);
    });
    if (entry.location) element(info, "small", entry.location, "book-quote-location");
    const edit = element(footer, "button", "Редактировать", "book-quote-edit");
    edit.setAttribute("aria-label", "Редактировать цитату");
    edit.addEventListener("click", () => onEdit(entry));
    if (entry.conclusion) {
        const conclusion = element(row, "div", undefined, "book-quote-conclusion");
        element(conclusion, "small", "Мой вывод"); const text = element(conclusion, "p", entry.conclusion); text.style.whiteSpace = "pre-wrap";
    }
}

async function render({ dv, app, obsidian, mode = "index" }) {
    const home = mode === "home";
    const root = element(dv.container, "div", undefined, home ? "book-knowledge" : "book-knowledge book-quotes-index");
    if (!home) {
        const stylesheet = app.vault.getAbstractFileByPath("Книги/_system/quotes-index.css");
        if (stylesheet) element(root, "style", await app.vault.read(stylesheet));
    }
    let disposed = false, generation = 0, timer, service;
    const loading = element(root, "p", "Загружаю цитаты…", "book-quotes-loading");
    try { service = await getService({ app, obsidian }); }
    catch (error) { loading.textContent = `Не удалось загрузить цитаты: ${error.message || error}`; return; }
    const remembered = !home ? app.__bookQuotesNavigationV1 : null;
    let entries = [], selected = remembered?.selected || "", view = remembered?.view || "sections", page = 1, randomId = null, treeData = [], editorPromise;
    let queryValue = remembered?.query || "", navigationQuery = "", searchVisible = Boolean(queryValue);
    const opened = new Set(remembered?.opened || []), limits = new Map(), modeButtons = [];
    let status, content, tree, treeBody, treeSearch, heading, pagination, searchPanel, search, resetQuery, breadcrumb, navigationButton;
    function remember() {
        if (!home) app.__bookQuotesNavigationV1 = { selected, view, query: queryValue, opened: [...opened] };
    }
    async function edit(entry) {
        try {
            if (!editorPromise) editorPromise = (async () => {
                const file = app.vault.getAbstractFileByPath("Книги/_system/quote_edit.js");
                if (!file) throw new Error("Не найден редактор цитат.");
                const module = { exports: {} }; new Function("module", await app.vault.read(file))(module); return module.exports;
            })().catch(error => { editorPromise = null; throw error; });
            const editor = await editorPromise;
            await editor({ app, obsidian, entry, onSaved: async () => {
                service.invalidate(entry.path); await reload();
                const updated = entries.find(value => value.path === entry.path && value.id === entry.id);
                if (!home && updated) {
                    if (queryValue && !filterExcerpts([updated], { query: queryValue }).length) { queryValue = ""; search.value = ""; }
                    if (!quoteInNode(updated, selected, view)) selected = view === "sources" ? quoteSource(updated).key : `section:${normalize(quoteSectionPath(updated))}`;
                    const visible = queryValue ? filterExcerpts(entries, { query: queryValue }) : entries.filter(value => quoteInNode(value, selected, view));
                    page = Math.floor(Math.max(0, visible.indexOf(updated)) / 20) + 1;
                    revealSelection(); drawTree(); draw(); remember();
                }
            } });
        } catch (error) { status.textContent = `Не удалось открыть редактор: ${error.message || error}`; }
    }
    if (home) {
        status = element(root, "p", undefined, "book-quotes-status");
        const controls = element(root, "div", undefined, "book-knowledge-controls");
        element(controls, "button", "Другая цитата").addEventListener("click", () => {
            const choices = entries.filter(entry => `${entry.path}:${entry.id}` !== randomId);
            const entry = choices[Math.floor(Math.random() * choices.length)];
            if (entry) randomId = `${entry.path}:${entry.id}`; draw();
        });
        content = element(root, "div", undefined, "book-knowledge-results");
    } else {
        root.setAttribute("data-navigation-open", "false");
        const toolbar = element(root, "div", undefined, "book-quotes-toolbar");
        const modes = element(toolbar, "div", undefined, "book-quotes-modes");
        modes.setAttribute("role", "group"); modes.setAttribute("aria-label", "Просмотр цитат");
        for (const [value, label] of [["sections", "Разделы"], ["sources", "Источники"]]) {
            const button = element(modes, "button", label);
            button.addEventListener("click", () => {
                view = value; selected = ""; page = 1; navigationQuery = ""; treeSearch.value = ""; limits.clear();
                treeData = buildQuoteTree(entries, view); ensureSelection(); revealSelection(); drawTree(); draw(); remember();
            }); modeButtons.push({ value, button });
        }
        const navigation = navigationButton = element(toolbar, "button", "Навигация", "book-quotes-navigation-toggle");
        navigation.setAttribute("aria-expanded", "false");
        navigation.addEventListener("click", () => {
            const expanded = navigation.getAttribute("aria-expanded") !== "true";
            navigation.setAttribute("aria-expanded", String(expanded)); root.setAttribute("data-navigation-open", String(expanded));
        });
        const searchToggle = element(toolbar, "button", "Поиск", "book-quotes-search-toggle");
        searchToggle.setAttribute("aria-expanded", String(searchVisible));
        searchToggle.addEventListener("click", () => {
            searchVisible = !searchVisible; searchPanel.hidden = !searchVisible; searchToggle.setAttribute("aria-expanded", String(searchVisible));
            if (searchVisible) search.focus?.(); else { queryValue = ""; search.value = ""; page = 1; draw(); remember(); }
        });
        searchPanel = element(root, "div", undefined, "book-quotes-search-panel"); searchPanel.hidden = !searchVisible;
        search = element(searchPanel, "input"); search.type = "search"; search.value = queryValue; search.placeholder = "Поиск по всем цитатам";
        search.setAttribute("aria-label", "Поиск цитат");
        search.addEventListener("input", () => { queryValue = search.value; page = 1; draw(); remember(); });
        resetQuery = element(searchPanel, "button", "Сбросить поиск");
        resetQuery.addEventListener("click", () => { queryValue = ""; search.value = ""; page = 1; draw(); remember(); });
        const shell = element(root, "div", undefined, "book-quotes-shell");
        tree = element(shell, "nav", undefined, "book-quotes-tree");
        treeSearch = element(tree, "input", undefined, "book-quotes-tree-search"); treeSearch.type = "search"; treeSearch.placeholder = "Найти раздел или источник";
        treeSearch.setAttribute("aria-label", "Поиск разделов и источников");
        treeSearch.addEventListener("input", () => { navigationQuery = normalize(treeSearch.value); limits.clear(); drawTree(); });
        treeBody = element(tree, "div", undefined, "book-quotes-tree-body");
        const reading = element(shell, "section", undefined, "book-quotes-reading");
        breadcrumb = element(reading, "nav", undefined, "book-quotes-breadcrumb"); breadcrumb.setAttribute("aria-label", "Путь раздела");
        const header = element(reading, "header", undefined, "book-quotes-reading-header");
        heading = element(header, "h2", undefined, "book-quotes-reading-title"); status = element(header, "p", undefined, "book-quotes-status");
        heading.tabIndex = -1;
        content = element(reading, "div", undefined, "book-knowledge-results");
        pagination = element(reading, "nav", undefined, "book-quotes-pagination"); pagination.setAttribute("aria-label", "Страницы цитат");
    }
    function findNode(key, nodes = treeData) {
        for (const node of nodes) { if (node.key === key) return node; const found = findNode(key, node.children); if (found) return found; }
        return null;
    }
    function ensureSelection() {
        if (selected !== "all" && !findNode(selected)) selected = treeData[0]?.key || "all";
    }
    function revealSelection() {
        if (view !== "sections" || !selected.startsWith("section:")) return;
        const parts = selected.slice(8).split("/");
        for (let depth = 1; depth < parts.length; depth++) opened.add(`section:${parts.slice(0, depth).join("/")}`);
    }
    function selectNode(key) {
        selected = key; page = 1; queryValue = ""; search.value = "";
        root.setAttribute("data-navigation-open", "false");
        navigationButton.setAttribute("aria-expanded", "false");
        for (const row of modeButtons) row.button.setAttribute("aria-pressed", String(row.value === view));
        drawTree(); draw(); remember();
    }
    function drawTree() {
        if (home) return;
        treeBody.replaceChildren(); tree.setAttribute("aria-label", view === "sections" ? "Разделы цитат" : "Источники цитат");
        function countNodes(nodes) { return nodes.reduce((sum, node) => sum + 1 + countNodes(node.children), 0); }
        treeSearch.hidden = countNodes(treeData) <= 40 && !navigationQuery;
        function matches(node) { return !navigationQuery || normalize([node.label, node.caption, node.key].join(" ")).includes(navigationQuery) || node.children.some(matches); }
        function choose(parent, node) {
            const button = element(parent, "button", undefined, "book-quotes-tree-row");
            button.setAttribute("data-node-key", node.key); button.setAttribute("aria-current", selected === node.key ? "page" : "false");
            element(button, "span", node.label, "book-quotes-tree-label"); element(button, "small", String(node.count), "book-quotes-tree-count");
            if (node.caption) { button.title = `${node.label} · ${node.caption}`; element(button, "small", node.caption, "book-quotes-tree-caption"); }
            button.addEventListener("click", event => { event?.preventDefault?.(); event?.stopPropagation?.(); selectNode(node.key); });
        }
        choose(treeBody, { key: "all", label: "Все цитаты", count: entries.length });
        function level(parent, nodes, key = "root") {
            const matched = nodes.filter(matches), limit = limits.get(key) || 40;
            for (const node of matched.slice(0, limit)) {
                if (!node.children.length) { choose(parent, node); continue; }
                const branch = element(parent, "details", undefined, "book-quotes-tree-branch");
                const summary = element(branch, "summary"); summary.setAttribute("aria-label", `Подразделы: ${node.label}`);
                choose(summary, node);
                const children = element(branch, "div", undefined, "book-quotes-tree-children");
                let populated = false;
                branch.addEventListener("toggle", () => {
                    if (branch.open) { opened.add(node.key); if (!populated) { populated = true; level(children, node.children, node.key); } }
                    else { opened.delete(node.key); children.replaceChildren(); populated = false; }
                    remember();
                });
                branch.open = opened.has(node.key) || Boolean(navigationQuery);
                if (branch.open) { populated = true; level(children, node.children, node.key); }
            }
            if (matched.length > limit) {
                const more = element(parent, "button", view === "sources" ? "Ещё источники" : "Ещё разделы", "book-quotes-tree-more");
                more.addEventListener("click", () => { limits.set(key, limit + 40); drawTree(); });
            }
        }
        level(treeBody, treeData);
    }
    function draw() {
        content.replaceChildren();
        if (home) {
            status.textContent = entries.length ? quoteCountLabel(entries.length) : "Добавь первую цитату из карточки книги.";
            if (entries.length) {
                const entry = entries.find(entry => `${entry.path}:${entry.id}` === randomId) || entries[Math.floor(Math.random() * entries.length)];
                randomId = `${entry.path}:${entry.id}`; renderQuote(content, entry, app, edit, true);
            }
            return;
        }
        for (const row of modeButtons) row.button.setAttribute("aria-pressed", String(row.value === view));
        const node = findNode(selected);
        heading.textContent = queryValue ? "Результаты поиска" : node?.label || "Все цитаты";
        breadcrumb.replaceChildren();
        if (view === "sections" && node) {
            const parts = node.key.slice(8).split("/");
            element(breadcrumb, "button", "Разделы").addEventListener("click", () => selectNode("all"));
            for (let depth = 1; depth < parts.length; depth++) {
                element(breadcrumb, "span", "/"); const ancestor = findNode(`section:${parts.slice(0, depth).join("/")}`);
                if (ancestor) element(breadcrumb, "button", ancestor.label).addEventListener("click", () => selectNode(ancestor.key));
            }
        }
        const filtered = queryValue ? filterExcerpts(entries, { query: queryValue }) : entries.filter(entry => quoteInNode(entry, selected, view));
        const current = excerptPage(filtered, page); page = current.page;
        status.textContent = current.pages === 1 ? quoteCountLabel(filtered.length) : `${current.start}–${current.end} из ${filtered.length} цитат`;
        resetQuery.hidden = !queryValue;
        for (const entry of current.entries) renderQuote(content, entry, app, edit);
        if (!filtered.length) element(content, "p", entries.length ? "В этой подборке цитат пока нет." : "Добавь первую цитату из карточки книги.", "book-quotes-empty");
        pagination.replaceChildren(); pagination.hidden = current.pages === 1;
        if (current.pages > 1) {
            const previous = element(pagination, "button", "Назад"); previous.disabled = page === 1;
            const nextPage = value => { page = value; draw(); heading.scrollIntoView?.({ block: "start" }); heading.focus?.({ preventScroll: true }); };
            previous.addEventListener("click", () => nextPage(page - 1));
            const label = element(pagination, "span", `${page} / ${current.pages}`); label.setAttribute("aria-live", "polite");
            const next = element(pagination, "button", "Далее"); next.disabled = page === current.pages;
            next.addEventListener("click", () => nextPage(page + 1));
        }
    }
    async function reload() {
        const current = ++generation;
        try {
            const records = await service.snapshot({ includeCollections: true });
            if (disposed || current !== generation) return;
            entries = sortExcerpts(service.excerpts(records)).map(entry => ({ ...entry, searchText: excerptSearchText(entry) }));
            loading.hidden = true; loading.textContent = "";
            if (!home) { treeData = buildQuoteTree(entries, view); ensureSelection(); revealSelection(); drawTree(); }
            draw();
            const failed = records.filter(record => record.error).length;
            if (failed) status.textContent += ` · Не удалось прочитать карточек: ${failed}`;
        } catch (error) { if (!disposed && current === generation) status.textContent = `Не удалось загрузить цитаты: ${error.message || error}`; }
    }
    const unsubscribe = service.subscribe(() => { clearTimeout(timer); timer = setTimeout(reload, 200); });
    function dispose() { disposed = true; clearTimeout(timer); unsubscribe(); }
    dv.component?.register?.(dispose);
    await reload();
    return { reload, dispose };
}

module.exports = Object.assign(render, { parseExcerpts, renderExcerpt, applyExcerpt, filterExcerpts, themeMatches, themeOptions, sortExcerpts, excerptPage, buildQuoteTree, quoteInNode, quoteSource, noteSearch, createId, getService, loadCore, themes, excerptAuthors, normalize, isExactDate, localDate });
