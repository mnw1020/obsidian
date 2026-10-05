// Portable Obsidian module: explicit excerpts and a read-only index.
const META = "<!-- BOOK-EXCERPT:META -->";
// A new format version prevents a live Obsidian session from reusing old parsed metadata.
const STATE_KEY = "__bookKnowledgeV4";
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
            id, type: "quote", text: excerptText,
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
        (!filters.author || entry.authors.includes(filters.author)) &&
        (!filters.theme || entry.themes.some(theme => normalize(theme) === normalize(filters.theme))) &&
        (!query || normalize([entry.text, entry.conclusion, entry.location, entry.savedDate, entry.title, ...entry.authors, ...entry.themes].join(" ")).includes(query))
    );
}

const QUOTE_SECTIONS = [
    { title: "Ритм жизни", themes: ["сон", "утро", "ритм жизни", "планирование", "привычки"] },
    { title: "Действие и перемены", themes: ["успех", "эксперименты", "прокрастинация", "действие", "неудачи", "мотивация"] },
    { title: "Мысли и убеждения", themes: ["убеждения", "мышление", "вина", "тревога", "познание"] },
    { title: "Отношения и общение", themes: ["отношения", "гордость", "общение"] },
    { title: "Юмор и ирония", themes: ["юмор", "ирония"] },
    { title: "Воспитание", themes: ["воспитание", "видеоигры"] }
];
function quoteSection(entry) {
    const names = entry.themes.map(normalize);
    // Prefer specific themes to the broad motivation label shared by old fragments.
    for (const index of [4, 5, 3, 0, 2, 1]) {
        const section = QUOTE_SECTIONS[index];
        if (section.themes.some(theme => names.includes(theme))) return { title: section.title, key: `section:${index}`, order: index };
    }
    const title = entry.themes[0] || "Без темы";
    return { title, key: `section:${normalize(title)}`, order: 6 };
}
function groupExcerpts(entries, { by = "section", theme = "" } = {}) {
    const groups = new Map();
    for (const entry of entries) {
        const info = by === "source" ? { title: entry.title, key: `source:${entry.path}`, order: 0 }
            : by === "theme" ? { title: theme || entry.themes[0] || "Без темы", key: `theme:${normalize(theme || entry.themes[0] || "Без темы")}`, order: 0 }
            : quoteSection(entry);
        if (!groups.has(info.key)) groups.set(info.key, { ...info, entries: [] });
        groups.get(info.key).entries.push(entry);
    }
    return [...groups.values()].sort((a, b) => a.order - b.order || a.title.localeCompare(b.title, "ru")).map(group => ({ ...group,
        entries: [...group.entries].sort((a, b) => (b.savedDate || "").localeCompare(a.savedDate || "") || a.title.localeCompare(b.title, "ru") || a.line - b.line)
    }));
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

async function render({ dv, app, obsidian, mode = "index" }) {
    const home = mode === "home";
    const root = element(dv.container, "div", undefined, home ? "book-knowledge" : "book-knowledge book-quotes-index");
    if (!home) {
        const stylesheet = app.vault.getAbstractFileByPath("Книги/_system/quotes-index.css");
        if (stylesheet) element(root, "style", await app.vault.read(stylesheet));
    }
    const status = element(root, "p", "Загружаю цитаты…", "book-quotes-status");
    let disposed = false, generation = 0, timer, service;
    try { service = await getService({ app, obsidian }); }
    catch (error) { status.textContent = `Не удалось загрузить цитаты: ${error.message || error}`; return; }
    const controls = element(root, "div", undefined, "book-knowledge-controls");
    const toolbar = home ? null : element(root, "div", undefined, "book-quotes-toolbar");
    const sections = home ? null : element(root, "nav", undefined, "book-quotes-section-nav");
    if (sections) sections.setAttribute("aria-label", "Разделы коллекции");
    const content = element(root, "div", undefined, "book-knowledge-results");
    let entries = [], randomId = null, groupBy = "section", activeSection = "", expandAll = null, allExpanded = false;
    const expandedGroups = new Set(), groupingButtons = [], selects = {};
    const filters = { query: "", theme: "", author: "" };
    let expandButton;
    function filteredEntries() { return filterExcerpts(entries, filters); }
    function draw() {
        content.replaceChildren();
        const filtered = filteredEntries();
        if (home) {
            status.textContent = entries.length ? `${entries.length} цитат` : "Добавь первую цитату из карточки книги.";
            if (entries.length) {
                const entry = entries.find(entry => `${entry.path}:${entry.id}` === randomId) || entries[Math.floor(Math.random() * entries.length)];
                randomId = `${entry.path}:${entry.id}`; renderCard(content, entry, app);
            }
            return;
        }
        const available = groupExcerpts(filtered, { by: groupBy });
        if (!available.some(group => group.key === activeSection)) activeSection = "";
        const groups = activeSection ? available.filter(group => group.key === activeSection) : available;
        status.textContent = entries.length ? `${filtered.length} из ${entries.length} цитат · Разделов: ${available.length}` : "Добавь первую цитату из карточки книги.";
        sections.replaceChildren();
        if (available.length) {
            const resetSection = element(sections, "button", "Все разделы", "book-quotes-all-sections");
            resetSection.setAttribute("aria-pressed", String(!activeSection));
            resetSection.addEventListener("click", () => { activeSection = ""; expandAll = null; expandedGroups.clear(); collapsedGroups.clear(); draw(); });
            const tiles = element(sections, "div", undefined, "book-quotes-section-tiles");
            for (const group of available) {
                const button = element(tiles, "button", undefined, "book-quotes-section-tile");
                button.setAttribute("aria-pressed", String(activeSection === group.key));
                element(button, "strong", group.title.charAt(0).toLocaleUpperCase("ru") + group.title.slice(1));
                element(button, "span", `Цитат: ${group.entries.length}`, "book-quotes-tile-count");
                button.addEventListener("click", () => { activeSection = activeSection === group.key ? "" : group.key; expandAll = null; expandedGroups.clear(); collapsedGroups.clear(); draw(); });
            }
        }
        const matching = Object.values(filters).some(Boolean) || Boolean(activeSection);
        const expanded = group => !collapsedGroups.has(group.key) && (expandedGroups.has(group.key) || (expandAll === null ? matching : expandAll));
        allExpanded = groups.every(group => group.entries.length <= 2 || expanded(group));
        if (expandButton) {
            expandButton.textContent = allExpanded ? "Свернуть списки" : "Показать все цитаты";
            expandButton.disabled = !groups.some(group => group.entries.length > 2);
        }
        groups.forEach((group, index) => {
            const panel = element(content, "section", undefined, "book-quotes-group");
            const header = element(panel, "header", undefined, "book-quotes-group-header");
            element(header, "span", String(index + 1).padStart(2, "0"), "book-quotes-group-number");
            element(header, "h2", group.title.charAt(0).toLocaleUpperCase("ru") + group.title.slice(1), "book-quotes-group-title");
            element(header, "span", `Цитат: ${group.entries.length}`, "book-quotes-group-count");
            const body = element(panel, "div", undefined, "book-quotes-group-body");
            for (const entry of group.entries.slice(0, expanded(group) ? group.entries.length : 2)) renderCard(body, entry, app, { compact: true });
            if (group.entries.length > 2) {
                const button = element(panel, "button", expanded(group) ? "Свернуть раздел" : `Ещё цитат: ${group.entries.length - 2}`, "book-quotes-section-more");
                button.addEventListener("click", () => {
                    if (expanded(group)) {
                        expandedGroups.delete(group.key);
                        // Per-section override lets matching results collapse independently.
                        collapsedGroups.add(group.key);
                    } else { expandedGroups.add(group.key); collapsedGroups.delete(group.key); }
                    draw();
                });
            }
        });
        if (!filtered.length && entries.length) element(content, "p", "По этим условиям цитат пока нет.");
    }
    const collapsedGroups = new Set();
    // Keep explicit per-section collapse separate from automatic search expansion.
    function refreshFilters() { activeSection = ""; expandAll = null; expandedGroups.clear(); collapsedGroups.clear(); draw(); }
    if (home) {
        element(controls, "button", "Другая цитата").addEventListener("click", () => {
            const choices = entries.filter(entry => `${entry.path}:${entry.id}` !== randomId);
            const entry = choices[Math.floor(Math.random() * choices.length)];
            if (entry) randomId = `${entry.path}:${entry.id}`;
            draw();
        });
    } else {
        const query = element(controls, "input");
        query.type = "search"; query.placeholder = "Найти цитату, тему, автора или вывод";
        query.setAttribute("aria-label", "Поиск цитат");
        query.addEventListener("input", () => { filters.query = query.value; refreshFilters(); });
        for (const [field, label] of [["theme", "Все темы"], ["author", "Все авторы"]]) {
            const select = selects[field] = element(controls, "select");
            select.setAttribute("aria-label", label);
            select.addEventListener("change", () => { filters[field] = select.value; refreshFilters(); });
        }
        const grouping = element(toolbar, "div", undefined, "book-quotes-grouping");
        grouping.setAttribute("role", "group"); grouping.setAttribute("aria-label", "Группировка цитат");
        for (const [value, label] of [["section", "По разделам"], ["source", "По источникам"]]) {
            const button = element(grouping, "button", label);
            button.setAttribute("aria-pressed", String(groupBy === value));
            button.addEventListener("click", () => {
                groupBy = value;
                for (const row of groupingButtons) row.button.setAttribute("aria-pressed", String(row.value === value));
                refreshFilters();
            });
            groupingButtons.push({ button, value });
        }
        const actions = element(toolbar, "div", undefined, "book-quotes-actions");
        expandButton = element(actions, "button", "Показать все цитаты");
        expandButton.addEventListener("click", () => { expandAll = !allExpanded; expandedGroups.clear(); collapsedGroups.clear(); draw(); });
        element(actions, "button", "Сбросить").addEventListener("click", () => {
            query.value = "";
            for (const key of Object.keys(filters)) filters[key] = "";
            for (const select of Object.values(selects)) select.value = "";
            refreshFilters();
        });
    }
    async function reload() {
        const current = ++generation;
        try {
            const records = await service.snapshot({ includeCollections: true });
            if (disposed || current !== generation) return;
            entries = service.excerpts(records);
            if (!home) for (const [field, values, label] of [
                ["theme", [...new Set(entries.flatMap(entry => entry.themes))].sort((a, b) => a.localeCompare(b, "ru")), "Все темы"],
                ["author", [...new Set(entries.flatMap(entry => entry.authors))].sort((a, b) => a.localeCompare(b, "ru")), "Все авторы"]
            ]) {
                const select = selects[field]; select.replaceChildren();
                element(select, "option", label).value = "";
                for (const value of values) element(select, "option", value).value = value;
                select.value = values.includes(filters[field]) ? filters[field] : ""; filters[field] = select.value;
            }
            draw();
            const failed = records.filter(record => record.error).length;
            if (failed) status.textContent += ` · Не удалось прочитать карточек: ${failed}`;
        } catch (error) { if (!disposed) status.textContent = `Не удалось загрузить цитаты: ${error.message || error}`; }
    }
    const unsubscribe = service.subscribe(() => { clearTimeout(timer); timer = setTimeout(reload, 200); });
    function dispose() { disposed = true; clearTimeout(timer); unsubscribe(); }
    dv.component?.register?.(dispose);
    await reload();
    return { reload, dispose };
}

module.exports = Object.assign(render, { parseExcerpts, renderExcerpt, applyExcerpt, filterExcerpts, groupExcerpts, noteSearch, createId, getService, loadCore, themes, normalize, isExactDate, localDate });
