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
        const fields = { themes: "", section: undefined, conclusion: "", location: "", sourceTitle: "", sourceAuthors: "", savedDate: "" };
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
            sourceTitle: fields.sourceTitle.trim(), sourceAuthors: excerptAuthors(fields.sourceAuthors),
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
        ...(excerptAuthors(value.sourceAuthors).length ? [`> **Автор:** ${excerptAuthors(value.sourceAuthors).join("; ")}`] : []),
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

function renderCard(parent, entry, app, { compact = false } = {}) {
    const card = element(parent, "article", undefined, "book-excerpt-card");
    const top = element(card, "div", undefined, "book-excerpt-meta");
    for (const theme of entry.themes) element(top, "span", theme, "book-quote-tag");
    if (compact && entry.text.length > 450) {
        const full = element(card, "details", undefined, "book-quote-long-text");
        const preview = entry.text.slice(0, 300).replace(/\s+\S*$/, "") + "…";
        const summary = element(full, "summary", preview);
        const text = element(full, "p", entry.text); text.style.whiteSpace = "pre-wrap";
        full.addEventListener("toggle", () => { summary.textContent = full.open ? "Свернуть текст" : preview; });
    } else {
        const text = element(card, "p", entry.text, "book-quote-text"); text.style.whiteSpace = "pre-wrap";
    }
    if (entry.conclusion) {
        const conclusion = element(card, "details", undefined, "book-quote-conclusion");
        element(conclusion, "summary", "Мой вывод");
        const text = element(conclusion, "p", entry.conclusion); text.style.whiteSpace = "pre-wrap";
    }
    const footer = element(card, "footer", undefined, "book-quote-footer");
    const source = element(footer, "div");
    element(source, "span", entry.collection ? "Коллекция · " : "Произведение · ", "book-quote-source-label");
    sourceLink(source, entry, app);
    if (entry.location) element(footer, "small", entry.location);
    if (entry.savedDate) {
        const [year, month, day] = entry.savedDate.split("-");
        element(footer, "small", `${day}.${month}.${year}`);
    }
}

function renderRow(parent, entry, app, selectTheme) {
    const row = element(parent, "article", undefined, "book-quotes-row");
    const details = element(row, "details", undefined, "book-quote-details");
    const flattened = entry.text.replace(/\s+/g, " ").trim();
    const preview = flattened.length > 180 ? flattened.slice(0, 180).replace(/\s+\S*$/, "") + "…" : flattened;
    const summary = element(details, "summary", preview);
    let loaded = false;
    details.addEventListener("toggle", () => {
        summary.textContent = details.open ? "Свернуть цитату" : preview;
        if (!details.open || loaded) return;
        loaded = true;
        const body = element(details, "div", undefined, "book-quote-body");
        element(body, "p", entry.text, "book-quote-text");
        if (entry.conclusion) {
            const conclusion = element(body, "div", undefined, "book-quote-conclusion");
            element(conclusion, "small", "Мой вывод");
            element(conclusion, "p", entry.conclusion);
        }
        const meta = [entry.location, entry.savedDate ? entry.savedDate.split("-").reverse().join(".") : ""].filter(Boolean);
        if (meta.length) element(body, "small", meta.join(" · "), "book-quote-location");
    });
    const meta = element(row, "div", undefined, "book-quotes-row-meta");
    sourceLink(meta, entry, app);
    if (entry.themes.length) {
        const topics = element(meta, "div", undefined, "book-quotes-row-themes");
        for (const theme of entry.themes.slice(0, 3)) {
            const button = element(topics, "button", theme);
            button.title = `Показать тему «${theme}»`;
            button.addEventListener("click", () => selectTheme(themePath(theme)));
        }
        if (entry.themes.length > 3) {
            const rest = element(topics, "span", `+${entry.themes.length - 3}`);
            rest.title = entry.themes.slice(3).join(" · ");
        }
    }
}

async function render({ dv, app, obsidian, mode = "index" }) {
    const home = mode === "home";
    const root = element(dv.container, "div", undefined, home ? "book-knowledge" : "book-knowledge book-quotes-index");
    if (!home) {
        const stylesheet = app.vault.getAbstractFileByPath("Книги/_system/quotes-index.css");
        if (stylesheet) element(root, "style", await app.vault.read(stylesheet));
    }
    const status = element(root, "p", "Загружаю цитаты…", "book-quotes-status");
    status.tabIndex = -1;
    let disposed = false, generation = 0, timer, service;
    try { service = await getService({ app, obsidian }); }
    catch (error) { status.textContent = `Не удалось загрузить цитаты: ${error.message || error}`; return; }
    const controls = element(root, "div", undefined, "book-knowledge-controls");
    const content = element(root, "div", undefined, "book-knowledge-results");
    const pagination = home ? null : element(root, "nav", undefined, "book-quotes-pagination");
    if (pagination) pagination.setAttribute("aria-label", "Страницы цитат");
    let entries = [], randomId = null, page = 1, failed = 0;
    const filters = { query: "", theme: "", source: "" }, pickers = {};
    let query, filterSummary, reset, chips;
    function pickerOption(field, value) {
        return pickers[field].options.find(option => field === "theme"
            ? normalize(themePath(option.value)) === normalize(themePath(value))
            : option.value === value);
    }
    function refreshPicker(field) {
        const picker = pickers[field];
        const selected = filters[field];
        const matching = picker.options.filter(option => normalize(option.label).includes(normalize(picker.search.value)));
        const visible = matching.slice(0, 40);
        const current = pickerOption(field, selected);
        if (current && !visible.includes(current)) visible.unshift(current);
        picker.select.replaceChildren();
        element(picker.select, "option", picker.all).value = "";
        for (const option of visible) element(picker.select, "option", option.label).value = option.value;
        if (matching.length > 40) {
            const more = element(picker.select, "option", `Ещё ${matching.length - 40} — уточните поиск`);
            more.disabled = true; more.value = "__more";
        }
        picker.select.value = selected;
    }
    function changeFilter(field, value) {
        filters[field] = field === "theme" ? (pickerOption(field, value)?.value ?? value) : value; page = 1;
        if (pickers[field]) refreshPicker(field);
        draw();
    }
    function changePage(value) {
        page = value; draw();
        status.scrollIntoView?.({ block: "start" });
        status.focus?.({ preventScroll: true });
    }
    function draw() {
        content.replaceChildren();
        if (home) {
            status.textContent = entries.length ? `${entries.length} цитат` : "Добавь первую цитату из карточки книги.";
            if (entries.length) {
                const entry = entries.find(entry => `${entry.path}:${entry.id}` === randomId) || entries[Math.floor(Math.random() * entries.length)];
                randomId = `${entry.path}:${entry.id}`; renderCard(content, entry, app);
            }
            return;
        }
        const filtered = filterExcerpts(entries, filters), current = excerptPage(filtered, page);
        page = current.page;
        status.textContent = entries.length ? `${current.start}–${current.end} из ${filtered.length} цитат${filtered.length !== entries.length ? ` · всего ${entries.length}` : ""}` : "Добавь первую цитату из карточки книги.";
        if (failed) status.textContent += ` · Не удалось прочитать карточек: ${failed}`;
        const active = [filters.theme, filters.source].filter(Boolean).length;
        filterSummary.textContent = active ? `Фильтры · ${active}` : "Фильтры";
        reset.hidden = !Object.values(filters).some(Boolean) && !Object.values(pickers).some(picker => picker.search.value);
        chips.replaceChildren();
        for (const field of ["theme", "source"]) if (filters[field]) {
            const label = pickers[field].options.find(option => option.value === filters[field])?.label || filters[field];
            const button = element(chips, "button", `${label} ×`, "book-quotes-filter-chip");
            button.title = `Сбросить ${field === "theme" ? "тему" : "источник"}`;
            button.addEventListener("click", () => changeFilter(field, ""));
        }
        for (const entry of current.entries) renderRow(content, entry, app, theme => changeFilter("theme", theme));
        if (!filtered.length && entries.length) element(content, "p", "Цитат по этим условиям нет.", "book-quotes-empty");
        pagination.replaceChildren();
        pagination.hidden = current.pages === 1;
        if (current.pages > 1) {
            const previous = element(pagination, "button", "Назад"); previous.disabled = page === 1;
            previous.addEventListener("click", () => changePage(page - 1));
            const label = element(pagination, "span", `${page} / ${current.pages}`);
            label.setAttribute("aria-live", "polite");
            const next = element(pagination, "button", "Далее"); next.disabled = page === current.pages;
            next.addEventListener("click", () => changePage(page + 1));
        }
    }
    if (home) {
        element(controls, "button", "Другая цитата").addEventListener("click", () => {
            const choices = entries.filter(entry => `${entry.path}:${entry.id}` !== randomId);
            const entry = choices[Math.floor(Math.random() * choices.length)];
            if (entry) randomId = `${entry.path}:${entry.id}`;
            draw();
        });
    } else {
        query = element(controls, "input", undefined, "book-quotes-search");
        query.type = "search"; query.placeholder = "Поиск цитат";
        query.setAttribute("aria-label", "Поиск цитат");
        query.addEventListener("input", () => changeFilter("query", query.value));
        const toolbar = element(controls, "div", undefined, "book-quotes-toolbar");
        const details = element(toolbar, "details", undefined, "book-quotes-filters");
        filterSummary = element(details, "summary", "Фильтры");
        const panel = element(details, "div", undefined, "book-quotes-filter-panel");
        for (const [field, label, all, searchLabel] of [["theme", "Тема", "Все темы", "Найти тему"], ["source", "Источник", "Все источники", "Найти источник"]]) {
            const group = element(panel, "label", undefined, "book-quotes-filter-field");
            element(group, "span", label);
            const search = element(group, "input"); search.type = "search"; search.placeholder = searchLabel;
            search.setAttribute("aria-label", searchLabel);
            const select = element(group, "select"); select.setAttribute("aria-label", label);
            pickers[field] = { search, select, all, options: [] };
            search.addEventListener("input", () => {
                refreshPicker(field);
                reset.hidden = !Object.values(filters).some(Boolean) && !Object.values(pickers).some(picker => picker.search.value);
            });
            select.addEventListener("change", () => changeFilter(field, select.value));
        }
        chips = element(toolbar, "div", undefined, "book-quotes-filter-chips");
        reset = element(toolbar, "button", "Сбросить", "book-quotes-reset"); reset.hidden = true;
        reset.addEventListener("click", () => {
            query.value = ""; page = 1;
            for (const field of Object.keys(filters)) filters[field] = "";
            for (const field of Object.keys(pickers)) { pickers[field].search.value = ""; refreshPicker(field); }
            draw();
        });
    }
    async function reload() {
        const current = ++generation;
        try {
            const records = await service.snapshot({ includeCollections: true });
            if (disposed || current !== generation) return;
            entries = sortExcerpts(service.excerpts(records)).map(entry => ({ ...entry, searchText: excerptSearchText(entry) }));
            failed = records.filter(record => record.error).length;
            if (!home) {
                pickers.theme.options = themeOptions(entries).map(value => ({ value, label: value }));
                const sources = [...new Map(entries.map(entry => [entry.path, entry])).values()];
                const titles = new Map();
                for (const entry of sources) titles.set(entry.title, (titles.get(entry.title) || 0) + 1);
                pickers.source.options = sources.map(entry => ({ value: entry.path, label: titles.get(entry.title) > 1 ? `${entry.title} · ${entry.path.replace(/^Книги\//, "")}` : entry.title })).sort((a, b) => a.label.localeCompare(b.label, "ru"));
                for (const field of Object.keys(pickers)) {
                    filters[field] = pickerOption(field, filters[field])?.value || "";
                    refreshPicker(field);
                }
            }
            draw();
        } catch (error) { if (!disposed && current === generation) status.textContent = `Не удалось загрузить цитаты: ${error.message || error}`; }
    }
    const unsubscribe = service.subscribe(() => { clearTimeout(timer); timer = setTimeout(reload, 200); });
    function dispose() { disposed = true; clearTimeout(timer); unsubscribe(); }
    dv.component?.register?.(dispose);
    await reload();
    return { reload, dispose };
}

module.exports = Object.assign(render, { parseExcerpts, renderExcerpt, applyExcerpt, filterExcerpts, themeMatches, themeOptions, sortExcerpts, excerptPage, noteSearch, createId, getService, loadCore, themes, normalize, isExactDate, localDate });
