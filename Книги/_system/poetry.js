// Reading view over the original Markdown. This module never writes poems.
const normalize = value => String(value ?? '').toLocaleLowerCase('ru').replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();

function parsePoems(raw) {
    const rows = String(raw ?? '').replace(/^\uFEFF/, '').split(/\r?\n/);
    const poems = [], duplicates = new Map();
    let author = '', current = null, fence = null, frontmatter = rows[0] === '---';
    function finish() {
        if (!current) return;
        const body = current.body.slice();
        while (body.length && !body[0].trim()) body.shift();
        while (body.length && !body.at(-1).trim()) body.pop();
        const text = body.map(line => line.replace(/ {2,}$/u, '')).join('\n');
        if (text.trim()) {
            const stem = JSON.stringify([author, current.title]);
            const occurrence = duplicates.get(stem) || 0;
            duplicates.set(stem, occurrence + 1);
            poems.push({ key: JSON.stringify([author, current.title, occurrence]), author, title: current.title,
                text, line: current.line, lines: body.filter(line => line.trim()).length,
                stanzas: text.split(/\n(?:\s*\n)+/u).filter(part => part.trim()).length });
        }
        current = null;
    }
    for (let line = 0; line < rows.length; line++) {
        const value = rows[line];
        if (frontmatter) { if (line > 0 && value === '---') frontmatter = false; continue; }
        const fenced = value.match(/^\s*(`{3,}|~{3,})/u);
        if (fenced) {
            if (!fence) fence = fenced[1];
            else if (fence[0] === fenced[1][0] && fenced[1].length >= fence.length) fence = null;
            continue;
        }
        if (fence) continue;
        const heading = value.match(/^(#{2,3})\s+(.+?)(?:\s+#+)?\s*$/u);
        if (heading) {
            finish();
            if (heading[1] === '##') author = heading[2];
            else if (author) current = { title: heading[2], line, body: [] };
        } else if (/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/u.test(value)) finish();
        else if (current) current.body.push(value);
    }
    finish();
    return poems;
}

function filterPoems(poems, { query = '', author = '' } = {}) {
    const terms = normalize(query).split(' ').filter(Boolean);
    return poems.filter(poem => (!author || poem.author === author)
        && terms.every(term => normalize([poem.author, poem.title, poem.text].join(' ')).includes(term)));
}

function noun(count, forms) {
    const tens = count % 100, units = count % 10;
    return `${count} ${forms[tens >= 11 && tens <= 14 ? 2 : units === 1 ? 0 : units >= 2 && units <= 4 ? 1 : 2]}`;
}

async function render({ dv, app, obsidian = {} }) {
    const source = dv.current?.()?.file?.path || 'Книги/Стихи.md';
    let sourceFile = app.vault.getAbstractFileByPath(source);
    const cssFile = app.vault.getAbstractFileByPath('Книги/_system/poetry.css');
    if (!sourceFile || !cssFile) throw new Error('Не найден текст сборника или его оформление.');
    const [raw, css] = await Promise.all([app.vault.read(sourceFile), app.vault.read(cssFile)]);
    const doc = dv.container.ownerDocument, win = doc.defaultView;
    const host = dv.container.closest('.markdown-preview-view') || dv.container;
    const memory = host.__bookPoetryViewV1?.path === source ? host.__bookPoetryViewV1 : { path: source };
    host.__bookPoetryViewV1 = memory;
    const openGroups = new Map(memory.groups || []);
    let poems = parsePoems(raw), selected = memory.selected || '', author = memory.author || '', disposed = false, generation = 0, timer;
    let lastRenderedSelection = '';
    const listeners = [], events = [];
    let readerController = null;
    const root = el(dv.container, 'section', 'book-poetry-ui');
    root.dataset.navigationOpen = 'false'; root.dataset.sourceOpen = 'false';
    el(root, 'style', '', css);
    const masthead = el(root, 'header', 'book-poetry-masthead');
    const topNav = el(masthead, 'nav', 'book-poetry-top-nav');
    topNav.setAttribute('aria-label', 'Навигация библиотеки');
    internal(topNav, '← Библиотека', 'Книги/_index');
    internal(topNav, 'Авторы', 'Книги/_system/Авторы');
    internal(topNav, 'Цитаты', 'Книги/Цитаты');
    const identity = el(masthead, 'div', 'book-poetry-identity');
    const heading = el(identity, 'div', 'book-poetry-heading');
    el(heading, 'div', 'book-poetry-eyebrow', 'Личная антология');
    el(heading, 'h1', '', 'Стихи');
    const total = el(heading, 'p', 'book-poetry-total');
    const mastActions = el(identity, 'div', 'book-poetry-mast-actions');
    const add = button(mastActions, 'Добавить', 'book-poetry-add'); add.setAttribute('aria-label', 'Добавить стихотворение');
    const random = button(mastActions, 'Наугад', 'book-poetry-random');
    const sourceToggle = button(mastActions, 'Все тексты', 'book-poetry-source-toggle');
    sourceToggle.setAttribute('aria-pressed', 'false');
    const controls = el(root, 'div', 'book-poetry-controls');
    const searchLabel = el(controls, 'label', 'book-poetry-search-field');
    el(searchLabel, 'span', 'book-poetry-label', 'Поиск стихов');
    const search = el(searchLabel, 'input');
    search.type = 'search'; search.autocomplete = 'off'; search.placeholder = 'Автор, название или строка';
    search.setAttribute('aria-label', 'Поиск стихов');
    search.value = memory.query || '';
    const authorLabel = el(controls, 'label', 'book-poetry-author-field');
    el(authorLabel, 'span', 'book-poetry-label', 'Автор');
    const authorSelect = el(authorLabel, 'select'); authorSelect.setAttribute('aria-label', 'Автор');
    const reset = button(controls, 'Сбросить', 'book-poetry-reset');
    const mobileBar = el(root, 'div', 'book-poetry-mobile-bar');
    const navigationToggle = button(mobileBar, 'Оглавление', 'book-poetry-navigation-toggle');
    navigationToggle.setAttribute('aria-expanded', 'false');
    const resultCount = el(mobileBar, 'span', 'book-poetry-result-count'); resultCount.setAttribute('aria-live', 'polite');
    const shell = el(root, 'div', 'book-poetry-shell');
    const navigation = el(shell, 'nav', 'book-poetry-navigation'); navigation.setAttribute('aria-label', 'Оглавление стихов');
    const reader = el(shell, 'article', 'book-poetry-reader');
    const warning = el(root, 'p', 'book-poetry-warning'); warning.setAttribute('role', 'status'); warning.hidden = true;

    function el(parent, tag, cls, text) {
        const node = doc.createElement(tag);
        if (cls) node.className = cls;
        if (text !== undefined) node.textContent = String(text);
        parent.appendChild(node); return node;
    }
    function button(parent, text, cls = '') { const node = el(parent, 'button', cls, text); node.type = 'button'; return node; }
    function listen(node, name, callback, options) {
        node.addEventListener(name, callback, options); listeners.push(() => node.removeEventListener(name, callback, options));
    }
    function internal(parent, text, target) {
        const anchor = el(parent, 'a', 'internal-link', text); anchor.href = target; anchor.dataset.href = target;
        listen(anchor, 'click', event => { event.preventDefault(); app.workspace.openLinkText(target, source, Boolean(event.ctrlKey || event.metaKey)); });
    }
    function notify(text) { warning.textContent = text; warning.hidden = !text; }
    function results() { return filterPoems(poems, { query: search.value, author }); }
    let actionsPromise;
    async function actions() {
        if (!actionsPromise) actionsPromise = (async () => {
            const file = app.vault.getAbstractFileByPath('Книги/_system/poetry_edit.js');
            if (!file) throw new Error('Не найден модуль редактирования стихов.');
            const editor = { exports: {} }; new Function('module', await app.vault.read(file))(editor); return editor.exports;
        })().catch(problem => { actionsPromise = null; throw problem; });
        return actionsPromise;
    }
    async function saved(entry) {
        Object.assign(memory, { selected: entry.key || '', author: '', query: '', sourceOpen: false });
        if (disposed) { host.dispatchEvent(new win.CustomEvent('book-poetry-change', { detail: { path: sourceFile.path } })); return; }
        selected = entry.key || ''; author = ''; search.value = ''; authorSelect.value = ''; setSource(false);
        await reload();
        if (!disposed) reader.scrollIntoView?.({ block: 'start' });
    }
    async function runAction(node, method, entry) {
        if (node.disabled) return;
        node.disabled = true; notify('');
        try {
            const editor = await actions();
            await editor[method]({ app, obsidian, sourcePath: sourceFile.path, poems, parsePoems, entry,
                initial: { author }, onSaved: saved,
                onDeleted: async removed => {
                    const rows = results(), index = rows.findIndex(poem => poem.key === removed.key);
                    const next = rows[index + 1] || rows[index - 1]; memory.selected = next?.key || '';
                    if (!disposed) { selected = memory.selected; await reload(); }
                    else host.dispatchEvent(new win.CustomEvent('book-poetry-change', { detail: { path: sourceFile.path } }));
                } });
        } catch (problem) { if (!disposed) notify(problem.message || String(problem)); }
        finally { node.disabled = false; }
    }
    function setSource(open) {
        root.dataset.sourceOpen = String(open); sourceToggle.setAttribute('aria-pressed', String(open));
        sourceToggle.textContent = open ? 'Режим чтения' : 'Все тексты';
        memory.sourceOpen = open;
        random.disabled = (open ? poems : results()).length < 2;
    }
    function setNavigation(open) {
        root.dataset.navigationOpen = String(open); navigationToggle.setAttribute('aria-expanded', String(open));
    }
    function mobile() { return root.getBoundingClientRect().width <= 680; }
    function select(key, focus = false) {
        setSource(false);
        selected = key; draw();
        if (mobile()) setNavigation(false);
        if (focus) { reader.scrollIntoView?.({ block: 'start' }); reader.querySelector('h2')?.focus({ preventScroll: true }); }
    }
    function authorOptions() {
        const authors = [...new Set(poems.map(poem => poem.author))];
        if (!authors.includes(author)) author = '';
        authorSelect.replaceChildren();
        el(authorSelect, 'option', '', 'Все авторы').value = '';
        for (const name of authors) el(authorSelect, 'option', '', name).value = name;
        authorSelect.value = author;
        total.textContent = `${noun(authors.length, ['автор', 'автора', 'авторов'])} · ${noun(poems.length, ['текст', 'текста', 'текстов'])}`;
    }
    function draw() {
        for (const group of navigation.querySelectorAll('details')) openGroups.set(group.dataset.author, group.open);
        const rows = results();
        if (!rows.some(poem => poem.key === selected)) selected = rows[0]?.key || '';
        Object.assign(memory, { selected, author, query: search.value, groups: [...openGroups] });
        resultCount.textContent = search.value.trim() || author ? `Найдено: ${rows.length} из ${poems.length}` : `${noun(poems.length, ['текст', 'текста', 'текстов'])}`;
        reset.disabled = !search.value && !author; random.disabled = rows.length < 2;
        navigation.replaceChildren();
        el(navigation, 'div', 'book-poetry-contents-title', 'Оглавление');
        const groups = new Map();
        for (const poem of rows) { if (!groups.has(poem.author)) groups.set(poem.author, []); groups.get(poem.author).push(poem); }
        for (const [name, texts] of groups) {
            const group = el(navigation, 'details', 'book-poetry-author');
            group.dataset.author = name;
            group.open = selected !== lastRenderedSelection && texts.some(poem => poem.key === selected)
                || (openGroups.has(name) ? openGroups.get(name) : groups.size <= 12);
            group.addEventListener('toggle', () => {
                if (disposed || !group.isConnected) return;
                openGroups.set(name, group.open); memory.groups = [...openGroups];
            });
            const summary = el(group, 'summary'); el(summary, 'span', '', name); el(summary, 'small', '', texts.length);
            for (const poem of texts) {
                const choice = button(group, poem.title, 'book-poetry-poem-button'); choice.dataset.key = poem.key;
                if (poem.key === selected) choice.setAttribute('aria-current', 'true');
                choice.addEventListener('click', () => select(poem.key, true));
            }
        }
        lastRenderedSelection = selected;
        if (!rows.length) el(navigation, 'p', 'book-poetry-empty', 'Ничего не найдено');
        readerController?.abort(); readerController = new win.AbortController();
        reader.replaceChildren();
        const poem = rows.find(poem => poem.key === selected);
        if (!poem) {
            el(reader, 'h2', 'book-poetry-title', poems.length ? 'Не нашлось таких строк' : 'Здесь будут стихи');
            el(reader, 'p', 'book-poetry-empty', poems.length ? 'Попробуйте другой запрос или сбросьте фильтры.' : 'Нажмите «Добавить», чтобы сохранить первое стихотворение.');
            return;
        }
        const index = rows.indexOf(poem);
        const top = el(reader, 'div', 'book-poetry-reader-top');
        const attribution = button(top, poem.author, 'book-poetry-attribution'); attribution.title = 'Показать стихи этого автора';
        attribution.addEventListener('click', () => { author = poem.author; authorSelect.value = author; draw(); });
        el(top, 'span', 'book-poetry-position', `${index + 1} / ${rows.length}`);
        const title = el(reader, 'h2', 'book-poetry-title', poem.title); title.tabIndex = -1;
        const poemActions = el(reader, 'div', 'book-poetry-reader-actions');
        el(reader, 'p', 'book-poetry-text', poem.text);
        const footer = el(reader, 'div', 'book-poetry-reader-footer');
        el(footer, 'span', 'book-poetry-length', `${noun(poem.lines, ['строка', 'строки', 'строк'])} · ${noun(poem.stanzas, ['строфа', 'строфы', 'строф'])}`);
        const actions = poemActions;
        const copy = button(actions, 'Копировать'); copy.setAttribute('aria-label', 'Копировать стихотворение');
        copy.addEventListener('click', async () => {
            try {
                if (!win.navigator.clipboard?.writeText) throw new Error('Копирование недоступно. Выделите строки вручную.');
                await win.navigator.clipboard.writeText(poem.text);
                if (!disposed && selected === poem.key && copy.isConnected) { copy.textContent = 'Скопировано'; notify(''); }
            } catch (problem) { if (!disposed) notify(problem.message || 'Не удалось скопировать стихотворение.'); }
        });
        const edit = button(actions, 'Редактировать'); edit.setAttribute('aria-label', 'Редактировать стихотворение');
        edit.addEventListener('click', () => runAction(edit, 'editPoem', poem));
        const remove = button(actions, 'Удалить', 'book-poetry-delete'); remove.setAttribute('aria-label', 'Удалить стихотворение');
        remove.addEventListener('click', () => runAction(remove, 'deletePoem', poem));
        const pager = el(reader, 'div', 'book-poetry-pager');
        const previous = button(pager, '← Предыдущий'); previous.setAttribute('aria-label', 'Предыдущее стихотворение'); previous.disabled = index === 0;
        const next = button(pager, 'Следующий →'); next.setAttribute('aria-label', 'Следующее стихотворение'); next.disabled = index === rows.length - 1;
        previous.addEventListener('click', () => select(rows[index - 1].key, true));
        next.addEventListener('click', () => select(rows[index + 1].key, true));
        // Keyboard reading only while the article has focus; typing in search stays native.
        reader.addEventListener('keydown', event => {
            if (event.altKey || event.ctrlKey || event.metaKey || event.target.closest('input,textarea,select,button,a,[contenteditable="true"]')) return;
            if (event.key === 'ArrowLeft' && index > 0) { event.preventDefault(); select(rows[index - 1].key, true); }
            if (event.key === 'ArrowRight' && index < rows.length - 1) { event.preventDefault(); select(rows[index + 1].key, true); }
        }, { signal: readerController.signal });
    }
    listen(search, 'input', draw);
    listen(host, 'book-poetry-change', event => {
        if (event.detail?.path !== sourceFile.path) return;
        selected = memory.selected || ''; author = memory.author || ''; search.value = memory.query || '';
        authorSelect.value = author; setSource(Boolean(memory.sourceOpen)); reload();
    });
    listen(add, 'click', () => runAction(add, 'openCreate'));
    listen(authorSelect, 'change', () => { author = authorSelect.value; draw(); });
    listen(reset, 'click', () => { author = ''; search.value = ''; authorSelect.value = ''; draw(); });
    listen(navigationToggle, 'click', () => setNavigation(root.dataset.navigationOpen !== 'true'));
    listen(sourceToggle, 'click', () => setSource(root.dataset.sourceOpen !== 'true'));
    listen(random, 'click', () => {
        if (root.dataset.sourceOpen === 'true') { author = ''; search.value = ''; authorSelect.value = ''; }
        const choices = results().filter(poem => poem.key !== selected);
        if (choices.length) select(choices[Math.floor(Math.random() * choices.length)].key, true);
    });
    function containingView(node) {
        const views = app.workspace.getLeavesOfType?.('markdown') || [];
        const found = views.find(leaf => leaf.view?.containerEl?.contains(node));
        if (found) return found.view;
        const active = obsidian.MarkdownView && app.workspace.getActiveViewOfType?.(obsidian.MarkdownView);
        return active?.containerEl?.contains(node) ? active : null;
    }
    function hasSubpath(view) { return Boolean(view?.getState?.()?.subpath || view?.getEphemeralState?.()?.subpath); }
    // Reveal original headings before Obsidian follows a legacy link into this note.
    listen(doc, 'click', event => {
        const anchor = event.target.closest?.('a.internal-link');
        const target = anchor?.getAttribute('data-href') || anchor?.getAttribute('href') || '';
        const [filePath, fragment] = target.split('#');
        if (!fragment) return;
        if (!filePath) { if (anchor.closest('.markdown-preview-view') === host) setSource(true); return; }
        const origin = containingView(anchor)?.file?.path || sourceFile.path;
        const destination = app.metadataCache?.getFirstLinkpathDest?.(filePath, origin);
        const basename = sourceFile.basename || sourceFile.path.split('/').at(-1).replace(/\.md$/u, '');
        if (destination ? destination.path === sourceFile.path
            : [sourceFile.path, sourceFile.path.replace(/\.md$/u, ''), basename, basename + '.md'].includes(filePath)) setSource(true);
    }, true);
    function subscribe(owner, name, callback) {
        if (!owner?.on) return;
        const ref = owner.on(name, callback); events.push(() => owner.offref?.(ref));
    }
    subscribe(app.workspace, 'file-open', file => {
        const view = containingView(dv.container);
        if (file?.path === sourceFile.path && view && app.workspace.activeLeaf?.view === view && hasSubpath(view)) setSource(true);
    });
    const currentView = containingView(dv.container);
    setSource(Boolean(memory.sourceOpen || currentView?.file?.path === sourceFile.path && hasSubpath(currentView)));
    async function reload() {
        const token = ++generation;
        try {
            const file = app.vault.getAbstractFileByPath(sourceFile.path);
            if (!file) throw new Error('Заметка была удалена.');
            const updated = parsePoems(await app.vault.read(file));
            if (disposed || token !== generation) return;
            poems = updated; authorOptions(); draw(); notify(''); root.dataset.ready = 'true';
        } catch (problem) {
            if (!disposed && token === generation) { root.dataset.ready = 'false'; notify(`Не удалось обновить сборник: ${problem.message || problem}`); }
        }
    }
    const schedule = () => { clearTimeout(timer); timer = setTimeout(reload, 180); };
    subscribe(app.vault, 'modify', file => { if (file.path === sourceFile.path) schedule(); });
    subscribe(app.vault, 'delete', file => { if (file.path === sourceFile.path) schedule(); });
    subscribe(app.vault, 'rename', (file, oldPath) => { if (oldPath === sourceFile.path) { sourceFile = file; schedule(); } });
    function dispose() {
        if (disposed) return;
        disposed = true; clearTimeout(timer); readerController?.abort();
        for (const cleanup of [...events, ...listeners]) cleanup();
        root.dataset.ready = 'false'; root.remove();
    }
    dv.component?.register?.(dispose);
    authorOptions(); draw(); root.dataset.ready = 'true';
    return { reload, dispose };
}

module.exports = Object.assign(render, { parsePoems, filterPoems });
