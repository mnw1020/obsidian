// Навигация по одной заметке. Исходный Markdown читается, но не изменяется.
function sportNutritionParse(text) {
    const start = "<!-- SPORT:NUTRITION:CONTENT:START -->";
    const end = "<!-- SPORT:NUTRITION:CONTENT:END -->";
    const marker = /^<!-- SPORT:NUTRITION:CONTENT:START -->\s*$/m.exec(text);
    const offset = marker?.index ?? -1;
    const content = (offset < 0 ? text : text.slice(offset + start.length)).split(end)[0]
        .replace(/<!-- SPORT:NUTRITION:BACK:START -->[\s\S]*?<!-- SPORT:NUTRITION:BACK:END -->/g, "");
    const lines = content.split(/\r?\n/), entries = [], stack = [];
    let section = "", fenced = false;
    for (let i = 0; i < lines.length; i++) {
        if (/^\s*(\x60{3,}|~{3,})/.test(lines[i])) { fenced = !fenced; continue; }
        if (fenced) continue;
        const match = /^(#{1,6})\s+(.+?)\s*$/.exec(lines[i]);
        if (!match) continue;
        const level = match[1].length, title = match[2];
        if (level === 1) section = title;
        while (stack.length && stack[stack.length - 1].level >= level) stack.pop();
        entries.push({ title, level, section, line: i, path: stack.map(item => item.title) });
        stack.push({ title, level });
    }
    for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        entry.body = lines.slice(entry.line + 1, entries[i + 1]?.line ?? lines.length).join("\n").trim();
        entry.plain = sportNutritionPlain(entry.body);
        entry.titleKey = sportNutritionNormalize(entry.title);
        entry.bodyKey = sportNutritionNormalize(entry.plain);
        entry.pathKey = sportNutritionNormalize(entry.path.join(" "));
    }
    return entries;
}
function sportNutritionNormalize(value) {
    return String(value).toLocaleLowerCase("ru").replace(/ё/g, "е").replace(/\s+/g, " ").trim();
}
function sportNutritionPlain(value) {
    return String(value)
        .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2")
        .replace(/\[\[([^\]]+)\]\]/g, "$1")
        .replace(/\[([^\]]+)\]\([^]*?\)/g, "$1")
        .replace(/<!--[\s\S]*?-->/g, "")
        .replace(/[*_\x60>#]/g, "").replace(/^\^[\w-]+$/gm, "")
        .replace(/\s+/g, " ").trim();
}
function sportNutritionSearch(entries, query, section = "") {
    const key = sportNutritionNormalize(query), terms = key.split(" ").filter(Boolean);
    return entries.filter(entry => (!section || entry.section === section)
        && terms.every(term => (entry.titleKey + " " + entry.pathKey + " " + entry.bodyKey).includes(term)))
        .map(entry => ({ entry, rank: !key ? 5 : entry.titleKey === key ? 0
            : entry.titleKey.startsWith(key) ? 1 : entry.titleKey.includes(key) ? 2
                : terms.every(term => entry.titleKey.includes(term)) ? 3 : 4 }))
        .sort((a, b) => a.rank - b.rank || a.entry.line - b.entry.line).map(item => item.entry);
}
const sportNutritionCss = [
    ".sport-nutrition-page { --sn-bg:#16181c; --sn-panel:#202329; --sn-hover:#282b31; --sn-line:#363a42; --sn-accent:#b89760; --sn-text:#e4e2de; --sn-muted:#a8a6a1; --file-line-width:100%; }",
    ".markdown-preview-view.sport-nutrition-page .markdown-preview-sizer { max-width:1120px; width:100%; min-width:0; margin-inline:auto; }",
    ".sport-nutrition-page .inline-title { display:none; }",
    ".sport-nutrition-page .markdown-rendered h1, .markdown-rendered.sport-nutrition-page h1 { border-inline-start:3px solid var(--sn-accent); padding-inline-start:14px; color:var(--sn-accent); font-family:'Iowan Old Style','Palatino Linotype',Georgia,serif; scroll-margin-top:28px; }",
    ".sport-nutrition-page :is(h2,h3,h4) { scroll-margin-top:28px; overflow-wrap:anywhere; }",
    ".sport-nutrition-page hr { border-color:var(--sn-line); opacity:.7; margin-block:28px; }",
    ".sn-ui { color:var(--sn-text,#e4e2de); font-size:15px; line-height:1.5; min-width:0; max-width:100%; container:sn-ui / inline-size; margin:12px 0 28px; }",
    ".sn-ui * { box-sizing:border-box; }",
    ".sn-ui [hidden] { display:none !important; }",
    ".sn-ui :is(button,input,select,summary,a):focus-visible { outline:2px solid var(--sn-accent,#b89760); outline-offset:3px; }",
    ".sn-ui :is(a,button,summary) { -webkit-tap-highlight-color:transparent; }",
    ".sn-ui a { text-decoration:none; overflow-wrap:anywhere; color:var(--sn-text,#e4e2de); }",
    ".sn-ui a:hover { color:var(--sn-accent,#b89760); }",
    ".sn-ui button { box-shadow:none; font:inherit; cursor:pointer; white-space:normal; height:auto; }",
    ".sn-hero { padding:24px 26px; border:1px solid var(--sn-line,#363a42); border-top:3px solid var(--sn-accent,#b89760); border-radius:4px 4px 12px 12px; background:linear-gradient(120deg,#27251f,var(--sn-bg,#16181c) 75%); }",
    ".sn-kicker { color:var(--sn-accent,#b89760); font-size:11px; letter-spacing:.13em; text-transform:uppercase; }",
    ".sn-intro { margin:10px 0 18px; color:var(--sn-muted,#a8a6a1); font-size:13px; }",
    ".sn-stats { display:flex; flex-wrap:wrap; gap:12px 28px; padding:16px 0 20px; border-top:1px solid var(--sn-line,#363a42); }",
    ".sn-stat { display:flex; align-items:baseline; gap:7px; color:var(--sn-muted,#a8a6a1); font-size:12px; }",
    ".sn-stat strong { color:var(--sn-accent,#b89760); font:600 23px/1.2 'Cascadia Mono',Consolas,monospace; }",
    ".sn-form { display:grid; grid-template-columns:minmax(0,1fr) minmax(145px,210px) 44px; gap:8px; }",
    ".sn-ui .sn-input,.sn-ui .sn-select { width:100%; min-width:0; height:44px; border:1px solid var(--sn-line,#363a42); border-radius:7px; background:var(--sn-panel,#202329); color:var(--sn-text,#e4e2de); padding:10px 12px; font:inherit; font-size:13px; }",
    ".sn-ui .sn-clear { width:44px; min-height:44px; padding:8px; border:1px solid var(--sn-line,#363a42); border-radius:7px; background:var(--sn-panel,#202329); color:var(--sn-muted,#a8a6a1); font-size:22px; }",
    ".sn-ui .sn-clear:disabled { opacity:.35; cursor:default; }",
    ".sn-status { margin:10px 0 0; font-size:12px; color:var(--sn-muted,#a8a6a1); }",
    ".sn-results { margin-top:14px; border-top:1px solid var(--sn-line,#363a42); padding-top:4px; }",
    ".sn-result { display:block; padding:13px 0; border-bottom:1px solid var(--sn-line,#363a42); min-height:44px; }",
    ".sn-result-title { display:block; font-weight:600; font-size:14px; }",
    ".sn-result-path { display:block; margin-top:4px; color:var(--sn-accent,#b89760); font-size:11px; }",
    ".sn-result-text { display:block; margin-top:6px; font-size:12px; line-height:1.6; color:var(--sn-muted,#a8a6a1); }",
    ".sn-ui mark { background:#b8976030; color:var(--sn-text,#e4e2de); border-radius:2px; padding:0 1px; }",
    ".sn-ui .sn-more { min-height:44px; padding:9px 16px; margin-top:12px; border:1px solid var(--sn-line,#363a42); border-radius:7px; color:var(--sn-accent,#b89760); background:var(--sn-panel,#202329); font-size:13px; }",
    ".sn-section-title { margin:24px 0 14px; border-inline-start:3px solid var(--sn-accent,#b89760); padding-inline-start:12px; font:700 24px/1.25 'Iowan Old Style','Palatino Linotype',Georgia,serif; color:var(--sn-accent,#b89760); }",
    ".sn-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:9px; }",
    ".sn-card { min-width:0; border:1px solid var(--sn-line,#363a42); border-radius:8px; background:var(--sn-bg,#16181c); overflow:hidden; }",
    ".sn-card-top { display:flex; align-items:center; justify-content:space-between; gap:8px; padding:13px 14px; min-height:66px; }",
    ".sn-card-title { font:700 19px/1.3 'Iowan Old Style','Palatino Linotype',Georgia,serif; color:var(--sn-accent,#b89760); }",
    ".sn-card-count { flex-shrink:0; font:12px 'Cascadia Mono',Consolas,monospace; color:var(--sn-muted,#a8a6a1); }",
    ".sn-card details { border-top:1px solid var(--sn-line,#363a42); }",
    ".sn-card summary { min-height:44px; padding:11px 14px; cursor:pointer; color:var(--sn-muted,#a8a6a1); font-size:12px; }",
    ".sn-card summary:hover { background:var(--sn-hover,#282b31); color:var(--sn-accent,#b89760); }",
    ".sn-topic-list { padding:0 14px 12px; max-height:360px; overflow-y:auto; overscroll-behavior:contain; scrollbar-width:thin; }",
    ".sn-topic { display:block; min-height:44px; padding:10px 0; border-top:1px solid var(--sn-line,#363a42); font-size:12px; }",
    ".sn-topic[data-depth='1'] { padding-inline-start:10px; color:var(--sn-muted,#a8a6a1); }",
    ".sn-topic[data-depth='2'] { padding-inline-start:20px; color:var(--sn-muted,#a8a6a1); }",
    ".sn-alphabet { margin-top:12px; border:1px solid var(--sn-line,#363a42); border-radius:8px; background:var(--sn-bg,#16181c); }",
    ".sn-alphabet>summary { padding:14px; min-height:48px; cursor:pointer; color:var(--sn-muted,#a8a6a1); font-size:13px; }",
    ".sn-letters { display:flex; flex-wrap:wrap; gap:6px; padding:0 14px 12px; }",
    ".sn-ui .sn-letter { min-width:36px; min-height:44px; padding:8px; border:1px solid var(--sn-line,#363a42); border-radius:6px; background:var(--sn-panel,#202329); color:var(--sn-muted,#a8a6a1); font-size:12px; }",
    ".sn-ui .sn-letter[aria-pressed='true'] { border-color:var(--sn-accent,#b89760); color:var(--sn-accent,#b89760); }",
    ".sn-alpha-list { max-height:420px; overflow-y:auto; padding:0 14px 14px; scrollbar-width:thin; }",
    ".sn-note { margin:12px 0 0; font-size:11px; line-height:1.6; color:var(--sn-muted,#a8a6a1); }",
    "@container sn-ui (max-width:720px) { .sn-grid { grid-template-columns:repeat(2,minmax(0,1fr)); } }",
    "@container sn-ui (max-width:480px) { .sn-hero { padding:18px 16px; } .sn-form { grid-template-columns:minmax(0,1fr) 44px; } .sn-input { grid-column:1; grid-row:1; } .sn-clear { grid-column:2; grid-row:1; } .sn-select { grid-column:1 / -1; grid-row:2; } .sn-grid { grid-template-columns:1fr; } .sn-stats { gap:12px 18px; } }"
].join("\n");

async function sportNutritionUi({ dv, app }) {
    const doc = dv.container.ownerDocument;
    const component = dv.component || dv.container;
    let state = component.__sportNutritionState;
    if (!state) {
        state = { generation:0, alive:true, dispose:null, query:"", section:"", limit:12 };
        component.__sportNutritionState = state;
        component.register?.(() => {
            state.alive = false; state.generation++; state.dispose?.();
            delete component.__sportNutritionState;
        });
    }
    state.dispose?.();
    const generation = ++state.generation;
    const source = dv.current?.()?.file?.path || "Спортивное питание.md";
    const file = app.vault.getAbstractFileByPath(source);
    if (!file) throw new Error("Не найдена заметка");
    const text = await app.vault.read(file);
    if (!state.alive || state.generation !== generation) return;
    const entries = sportNutritionParse(text), sections = entries.filter(item => item.level === 1);
    if (!entries.length) throw new Error("Не найдены заголовки справочника");
    const root = doc.createElement("section");
    root.className = "sn-ui";
    root.setAttribute("aria-label", "Навигация по спортивному питанию");
    const cleanup = [], foldKey = "sport_nutrition_folds:" + source;
    let disposed = false, timer = null, limit = state.limit || 12;
    function el(parent, tag, cls, text) {
        const node = doc.createElement(tag);
        if (cls) node.className = cls;
        if (text !== undefined) node.textContent = text;
        parent.appendChild(node); return node;
    }
    function listen(node, event, handler) {
        node.addEventListener(event, handler);
        cleanup.push(() => node.removeEventListener(event, handler));
    }
    function link(parent, title, heading, cls = "") {
        const node = el(parent, "a", "internal-link " + cls, title);
        const target = source + "#" + heading;
        node.href = target; node.dataset.href = target;
        // Delegation keeps the index and result lists free of stale listeners.
        node.dataset.snTarget = target;
        return node;
    }
    listen(root, "click", event => {
        const target = event.target.closest?.("a[data-sn-target]");
        if (!target || !root.contains(target)) return;
        event.preventDefault();
        app.workspace.openLinkText(target.dataset.snTarget, source, !!(event.ctrlKey || event.metaKey))
            ?.catch?.(error => console.warn("Спортивное питание: переход", error));
    });
    function dispose() {
        disposed = true; clearTimeout(timer);
        cleanup.splice(0).forEach(fn => fn()); root.remove();
    }
    state.dispose = dispose;
    let folds = {};
    try { folds = JSON.parse(doc.defaultView.localStorage.getItem(foldKey)) || {}; } catch (_) {}
    if (!folds || typeof folds !== "object" || Array.isArray(folds)) folds = {};
    function remember(details, key) {
        details.open = folds[key] === true;
        listen(details, "toggle", () => {
            if (disposed) return;
            folds[key] = details.open;
            try { doc.defaultView.localStorage.setItem(foldKey, JSON.stringify(folds)); } catch (_) {}
        });
    }
    // Keep typography available while Obsidian virtualizes the top Markdown block.
    let style = doc.getElementById("sport-nutrition-ui-style");
    if (!style) { style = doc.createElement("style"); style.id = "sport-nutrition-ui-style"; doc.head.appendChild(style); }
    style.textContent = sportNutritionCss;
    const hero = el(root, "div", "sn-hero");
    el(hero, "div", "sn-kicker", "Личный справочник");
    el(hero, "p", "sn-intro", "Найди вещество, термин или фразу и перейди к записи ниже.");
    const stats = el(hero, "div", "sn-stats");
    for (const [number, title] of [[String(sections.length), "разделов"], [String(entries.length), "заголовков"], ["1", "файл"]]) {
        const stat = el(stats, "div", "sn-stat"); el(stat, "strong", "", number); el(stat, "span", "", title);
    }
    const form = el(hero, "div", "sn-form");
    const input = el(form, "input", "sn-input"); input.type = "search";
    input.value = state.query;
    input.placeholder = "Например: магний, B12, сон";
    input.setAttribute("aria-label", "Поиск по заголовкам и тексту заметки");
    const select = el(form, "select", "sn-select"); select.setAttribute("aria-label", "Раздел справочника");
    el(select, "option", "", "Все разделы").value = "";
    for (const section of sections) el(select, "option", "", section.title).value = section.title;
    if (sections.some(section => section.title === state.section)) select.value = state.section;
    const clear = el(form, "button", "sn-clear", "×"); clear.type = "button";
    clear.title = "Очистить поиск"; clear.setAttribute("aria-label", "Очистить поиск и выбор раздела");
    const status = el(hero, "p", "sn-status");
    status.setAttribute("role", "status"); status.setAttribute("aria-live", "polite");
    const results = el(hero, "div", "sn-results"); results.hidden = true;
    let more = null;
    function marked(parent, text, query) {
        const term = sportNutritionNormalize(query).split(" ").filter(Boolean).sort((a, b) => b.length - a.length);
        if (!term.length) { parent.textContent = text; return; }
        const normalized = sportNutritionNormalize(text);
        // Snippets use the same whitespace normalization as the index.
        let position = 0, next = 0;
        while (position < text.length) {
            let found = -1, length = 0;
            for (const word of term) {
                next = normalized.indexOf(word, position);
                if (next >= 0 && (found < 0 || next < found)) { found = next; length = word.length; }
            }
            if (found < 0) { parent.appendChild(doc.createTextNode(text.slice(position))); break; }
            parent.appendChild(doc.createTextNode(text.slice(position, found)));
            el(parent, "mark", "", text.slice(found, found + length)); position = found + length;
        }
    }
    function showResults(reset = true) {
        if (disposed) return;
        if (reset) limit = 12;
        const query = input.value.trim(), section = select.value;
        state.query = input.value; state.section = section; state.limit = limit;
        results.replaceChildren(); more = null;
        clear.disabled = !query && !section;
        results.hidden = !query && !section;
        if (results.hidden) { status.textContent = "Поиск по заголовкам и всему тексту · ниже — разделы и алфавитный указатель"; return; }
        const matches = sportNutritionSearch(entries, query, section);
        status.textContent = matches.length ? "Найдено: " + matches.length + " · показано: " + Math.min(limit, matches.length)
            : "Совпадений нет. Попробуй другое название или убери фильтр раздела.";
        for (const entry of matches.slice(0, limit)) {
            const row = link(results, "", entry.title, "sn-result");
            marked(el(row, "span", "sn-result-title"), entry.title.replace(/\s+/g, " "), query);
            el(row, "span", "sn-result-path", entry.path.join(" › ") || entry.section);
            if (entry.plain) {
                const key = sportNutritionNormalize(query).split(" ").filter(Boolean).find(term => entry.bodyKey.includes(term));
                const offset = key ? Math.max(0, entry.bodyKey.indexOf(key) - 65) : 0;
                const snippet = (offset ? "…" : "") + entry.plain.slice(offset, offset + 200)
                    + (offset + 200 < entry.plain.length ? "…" : "");
                marked(el(row, "span", "sn-result-text"), snippet, query);
            }
        }
        if (matches.length > limit) {
            more = el(results, "button", "sn-more", "Показать ещё 12"); more.type = "button";
            more.dataset.snMore = "true";
        }
    }
    listen(root, "click", event => {
        if (event.target.closest?.("[data-sn-more]")) {
            limit += 12; showResults(false);
            results.querySelectorAll(".sn-result")[limit - 12]?.focus();
        }
    });
    listen(input, "input", () => {
        state.query = input.value; clearTimeout(timer); timer = setTimeout(showResults, 140);
    });
    listen(input, "keydown", event => {
        if (event.key === "Escape") { input.value = ""; select.value = ""; showResults(); }
        if (event.key === "Enter") { clearTimeout(timer); showResults(); results.querySelector("a")?.focus(); }
    });
    listen(select, "change", () => { clearTimeout(timer); showResults(); });
    listen(clear, "click", () => { clearTimeout(timer); input.value = ""; select.value = ""; showResults(); input.focus(); });
    el(root, "div", "sn-section-title", "Разделы и темы");
    const grid = el(root, "nav", "sn-grid"); grid.setAttribute("aria-label", "Разделы справочника");
    for (const section of sections) {
        const items = entries.filter(item => item.section === section.title && item !== section);
        const card = el(grid, "div", "sn-card");
        const top = link(card, "", section.title, "sn-card-top");
        el(top, "span", "sn-card-title", section.title); el(top, "span", "sn-card-count", String(items.length));
        const details = el(card, "details", "");
        el(details, "summary", "", "Темы раздела · " + items.length);
        remember(details, section.title);
        const list = el(details, "div", "sn-topic-list");
        for (const item of items) {
            const node = link(list, item.title, item.title, "sn-topic");
            node.dataset.depth = String(Math.min(2, Math.max(0, item.level - 2)));
        }
    }
    const alphabet = el(root, "details", "sn-alphabet");
    el(alphabet, "summary", "", "Алфавитный указатель · все заголовки");
    remember(alphabet, "__alphabet");
    const letters = el(alphabet, "div", "sn-letters");
    const alphaList = el(alphabet, "div", "sn-alpha-list");
    const sorted = [...entries].sort((a, b) => a.title.localeCompare(b.title, "ru", { numeric:true, sensitivity:"base" }));
    function initial(entry) {
        const first = entry.title.replace(/^[^А-Яа-яЁёA-Za-z0-9]+/u, "").charAt(0).toLocaleUpperCase("ru");
        return /\d/.test(first) ? "0–9" : first;
    }
    function showLetter(letter) {
        alphaList.replaceChildren();
        for (const entry of sorted.filter(item => !letter || initial(item) === letter)) {
            const row = link(alphaList, "", entry.title, "sn-result");
            el(row, "span", "sn-result-title", entry.title);
            el(row, "span", "sn-result-path", entry.path.join(" › ") || entry.section);
        }
        for (const button of letters.children) button.setAttribute("aria-pressed", String(button.dataset.letter === letter));
    }
    const initials = [...new Set(sorted.map(initial))].sort((a, b) => a.localeCompare(b, "ru"));
    for (const letter of ["", ...initials]) {
        const button = el(letters, "button", "sn-letter", letter || "Все");
        button.type = "button"; button.dataset.letter = letter; button.setAttribute("aria-pressed", String(!letter));
    }
    listen(letters, "click", event => {
        const button = event.target.closest?.("button[data-letter]");
        if (button) showLetter(button.dataset.letter);
    });
    showLetter("");
    el(root, "p", "sn-note", "Переходы ведут к исходным записям в этой заметке. Обычное оглавление доступно ниже.");
    showResults(false);
    if (!state.alive || state.generation !== generation) { dispose(); return; }
    dv.container.appendChild(root);
    return { dispose };
}
module.exports = sportNutritionUi;
module.exports.parse = sportNutritionParse;
module.exports.search = sportNutritionSearch;
module.exports.css = sportNutritionCss;
