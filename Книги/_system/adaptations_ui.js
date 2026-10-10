// One work owns all of its screen adaptations. Rendering never edits either collection.
const START = '<!-- BOOK-ADAPTATIONS-GENERATED:START -->', END = '<!-- BOOK-ADAPTATIONS-GENERATED:END -->';
const values = value => [...new Set((Array.isArray(value) ? value : [value]).map(item => String(item ?? '').trim()).filter(Boolean))];
const searchable = value => String(value ?? '').toLocaleLowerCase('ru').replace(/ё/g, 'е').trim();
const compare = (a, b) => String(a).localeCompare(String(b), 'ru', { sensitivity: 'base', numeric: true });
const score = value => { const number = Number(value); return Number.isFinite(number) && number >= 1 && number <= 10 ? number : null; };
const targetOf = value => String(value ?? '').trim().replace(/^\[\[([^\]|]+)(?:\|[^\]]*)?\]\]$/, '$1').replace(/#.*$/, '').replace(/\.md$/i, '');

function buildOverview({ app, core, obsidian = {} }) {
    const records = core.snapshot(), books = new Map(records.map(record => [record.file.path, record]));
    const groups = new Map(), invalid = new Set(), mediaFiles = app.vault.getMarkdownFiles().filter(isMedia);
    const mediaPaths = new Set(mediaFiles.map(file => file.path));
    function isMedia(file) {
        if (!file || file.extension !== 'md' || !file.path.startsWith('Кино/') || /^Кино\/(?:Просмотры|Сезоны|_system)\//.test(file.path)) return false;
        return values(core.getFrontmatter(file).tags).some(tag => ['movies', 'serial'].includes(tag.replace(/^#/, '')));
    }
    function resolve(value, source) {
        const target = targetOf(value);
        if (!target) return null;
        const normalize = obsidian.normalizePath || (path => path.replace(/\\/g, '/'));
        return app.metadataCache.getFirstLinkpathDest?.(target, source)
            || app.vault.getAbstractFileByPath(normalize(target + '.md')) || app.vault.getAbstractFileByPath(normalize(target));
    }
    function add(record, media) {
        const { file, fm } = record;
        if (!groups.has(file.path)) groups.set(file.path, { file, title: String(fm.title || file.basename), authors: values(fm.authors),
            series: String(fm.series || ''), rating: core.isFiction(file) ? score(fm.rating) : null, media: new Map() });
        const group = groups.get(file.path);
        if (group.media.has(media.path)) return;
        const mediaFm = core.getFrontmatter(media);
        const type = values(mediaFm.tags).some(tag => tag.replace(/^#/, '') === 'serial') ? 'serial' : 'movie';
        const release = String(mediaFm['Релиз'] || '').match(/^\d{4}/)?.[0] || '';
        const item = { file: media, title: media.basename, originalTitle: String(mediaFm['Название'] || ''), type, year: release,
            rating: score(mediaFm['Оценка']) };
        const franchises = new Map();
        for (const value of values(mediaFm['Франшиза'])) {
            const page = resolve(value, media.path);
            if (!page || page.extension !== 'md' || !(page.path.startsWith('Кино/Франшизы/') || values(core.getFrontmatter(page).tags).includes('franchise'))) continue;
            franchises.set(page.path, { target: page.path.replace(/\.md$/i, ''), title: page.basename });
        }
        item.franchises = [...franchises.values()];
        item.search = searchable([item.title, item.originalTitle, release, ...item.franchises.map(page => page.title)].join(' '));
        group.media.set(media.path, item);
    }
    for (const record of records) for (const value of values(record.fm.adaptations)) {
        const media = resolve(value, record.file.path);
        if (media && mediaPaths.has(media.path)) add(record, media);
        else invalid.add(record.file.path + '\n' + targetOf(value));
    }
    for (const media of mediaFiles) {
        const fm = core.getFrontmatter(media);
        for (const value of values([...values(fm['Первоисточники']), ...values(fm.adapted_from)])) {
            const book = resolve(value, media.path), record = books.get(book?.path);
            if (record) add(record, media);
            else invalid.add(media.path + '\n' + targetOf(value));
        }
    }
    const items = [...groups.values()].map(group => {
        const media = [...group.media.values()].sort((a, b) => compare(a.year || '9999', b.year || '9999') || compare(a.title, b.title));
        return { ...group, media, search: searchable([group.title, ...group.authors, group.series, ...media.map(item => item.search)].join(' ')) };
    }).sort((a, b) => compare(a.title, b.title));
    const unique = new Map(items.flatMap(item => item.media.map(media => [media.file.path, media])));
    return { items, unresolved: invalid.size, stats: { books: items.length, media: unique.size,
        links: items.reduce((count, item) => count + item.media.length, 0),
        movies: [...unique.values()].filter(item => item.type === 'movie').length,
        serials: [...unique.values()].filter(item => item.type === 'serial').length } };
}

function filterItems(items, { type = 'all', query = '', sort = 'title' } = {}) {
    const needle = searchable(query);
    return items.map(item => ({ ...item, media: item.media.filter(media => type === 'all' || media.type === type) }))
        .filter(item => item.media.length && (!needle || searchable([item.title, ...item.authors, item.series, ...item.media.map(media => media.search)].join(' ')).includes(needle)))
        .sort((a, b) => (sort === 'count' ? b.media.length - a.media.length
            : sort === 'rating' ? Math.max(...b.media.map(item => item.rating ?? -1)) - Math.max(...a.media.map(item => item.rating ?? -1)) : 0) || compare(a.title, b.title));
}

function overviewRegion() {
    return [START, '```dataviewjs', 'const file = app.vault.getAbstractFileByPath("Книги/_system/adaptations_ui.js");',
        'if (file) {', '    const m = { exports: {} };', '    new Function("module", await app.vault.read(file))(m);',
        '    await m.exports({ dv, app, obsidian: typeof require === "function" ? require("obsidian") : {} });',
        '} else { dv.paragraph("Модуль экранизаций не найден. [[Книги/_index|← Библиотека]]"); }', '```', END].join('\n');
}
function overviewPage() { return '---\ncssclasses:\n  - books-library\nobsidianUIMode: preview\n---\n\n' + overviewRegion() + '\n'; }
function mergeOverview(raw) {
    const nl = raw.includes('\r\n') ? '\r\n' : '\n';
    if (raw.includes(START) || raw.includes(END)) {
        if (raw.split(START).length !== 2 || raw.split(END).length !== 2 || raw.indexOf(END) < raw.indexOf(START)) throw new Error('Повреждены маркеры страницы экранизаций. Исходный текст сохранён.');
        return raw.slice(0, raw.indexOf(START)) + overviewRegion().replace(/\n/g, nl) + raw.slice(raw.indexOf(END) + END.length);
    }
    const start = raw.indexOf('# 🎬 Экранизации');
    const legacy = /^# 🎬 Экранизации\r?\n\r?\n\[\[Книги\/_index\|← Библиотека\]\][^\r\n]*\r?\n\r?\n> \[!info\] Обзор\r?\n> \*\*Связей:\*\*[^\r\n]*\r?\n\r?\n(?:> \[!warning\] Недоступные связи\r?\n> [^\r\n]*\r?\n\r?\n)?(?:(?:\|[^\r\n]*\r?\n)+|_Связей книга ↔ кино пока нет\.[^\r\n]*\r?\n)/.exec(raw.slice(start));
    if (start < 0 || !legacy) throw new Error('Не распознана прежняя страница экранизаций. Исходный текст сохранён.');
    return raw.slice(0, start) + overviewRegion().replace(/\n/g, nl) + nl + raw.slice(start + legacy[0].length);
}

async function render({ dv, app, obsidian = {} }) {
    const source = dv.current?.()?.file?.path || 'Книги/_system/Экранизации.md';
    const component = dv.component, stateKey = '__bookAdaptationsOverview';
    let view = component?.[stateKey];
    if (!view && typeof component?.render === 'function') {
        const original = component.render, container = dv.container;
        view = { root: null, dispose: null, query: '', type: 'all', sort: 'title' };
        const state = view, wrapped = function (...args) {
            if (state.root?.parentNode === container) return Promise.resolve();
            return original.apply(this, args);
        };
        component[stateKey] = state; component.render = wrapped;
        component.register(() => {
            state.unloaded = true; state.dispose?.();
            if (component.render === wrapped) component.render = original;
            delete component[stateKey];
        });
    }
    view?.dispose?.(); view?.root?.remove();
    let disposed = false, timer, items = [], activeType = view?.type || 'all', signature = '';
    const listeners = [], cleanups = [];
    const root = el(dv.container, 'section', 'book-authors-ui book-adaptations-ui');
    if (view) { view.root = root; view.dispose = dispose; }
    else component?.register?.(dispose);
    if (view?.unloaded) dispose();
    if (disposed) return { dispose };
    for (const name of ['authors-ui.css', 'books-library.css']) {
        const css = app.vault.getAbstractFileByPath('Книги/_system/' + name);
        if (css) el(root, 'style', '', await app.vault.read(css));
        if (disposed) return { dispose };
    }
    const nav = el(root, 'nav', 'book-authors-nav'); nav.setAttribute('aria-label', 'Навигация библиотеки');
    internal(nav, '← Библиотека', 'Книги/_index'); internal(nav, 'Авторы', 'Книги/_system/Авторы');
    internal(nav, 'Итоги чтения', 'Книги/_system/Итоги чтения'); internal(nav, 'Цитаты', 'Книги/Цитаты');
    const header = el(root, 'header', 'book-authors-header');
    const identity = el(header, 'div', 'book-authors-identity');
    const icon = el(identity, 'div', 'book-authors-monogram', '↔'); icon.setAttribute('aria-hidden', 'true');
    const heading = el(identity, 'div', 'book-authors-heading');
    el(heading, 'div', 'book-authors-eyebrow', 'Библиотека / Книги и кино');
    el(heading, 'h1', 'book-authors-name', 'Экранизации');
    el(heading, 'p', 'book-authors-subtitle', 'Книги и связанное с ними кино');
    const stats = el(root, 'div', 'book-authors-stats');
    const section = el(root, 'section', 'book-authors-collection');
    const sectionHead = el(section, 'div', 'book-authors-section-heading');
    el(sectionHead, 'h2', '', 'Произведения и экранизации');
    const count = el(sectionHead, 'span', 'book-authors-result-count', 'Загружаю…'); count.setAttribute('aria-live', 'polite');
    const controls = el(section, 'div', 'book-authors-controls');
    const search = field('Поиск', 'input', 'book-authors-search');
    search.type = 'search'; search.autocomplete = 'off'; search.placeholder = 'Произведение, автор или экранизация'; search.value = view?.query || '';
    const sort = field('Сортировка', 'select', 'book-authors-sort');
    for (const [value, label] of [['title', 'По названию'], ['count', 'Больше экранизаций'], ['rating', 'По оценке кино']]) el(sort, 'option', '', label).value = value;
    sort.value = view?.sort || 'title';
    const filters = el(controls, 'div', 'book-authors-filters'); filters.setAttribute('role', 'group'); filters.setAttribute('aria-label', 'Тип экранизации');
    const buttons = [];
    for (const [value, label] of [['all', 'Все'], ['movie', 'Фильмы'], ['serial', 'Сериалы']]) {
        const button = el(filters, 'button', 'book-authors-filter', label); button.type = 'button';
        buttons.push({ button, value });
        listen(button, 'click', () => { activeType = value; draw(); });
    }
    const reset = el(filters, 'button', 'book-authors-reset', 'Сбросить'); reset.type = 'button';
    listen(reset, 'click', () => { search.value = ''; activeType = 'all'; sort.value = 'title'; draw(); });
    const list = el(section, 'div', 'book-adaptations-list');
    const warning = el(root, 'p', 'book-authors-warning'); warning.setAttribute('role', 'status');
    const footer = el(root, 'footer', 'book-adaptations-footer');
    internal(footer, 'Проверка библиотеки', 'Книги/_system/Проверка библиотеки');
    listen(search, 'input', draw); listen(sort, 'change', draw);
    function el(parent, tag, cls, text) {
        const node = parent.ownerDocument.createElement(tag); if (cls) node.className = cls;
        if (text !== undefined) node.textContent = String(text); parent.appendChild(node); return node;
    }
    function listen(node, event, callback) { node.addEventListener(event, callback); listeners.push(() => node.removeEventListener(event, callback)); }
    function internal(parent, label, target, cls = '') {
        const anchor = el(parent, 'a', `${cls} internal-link`.trim(), label);
        anchor.href = target; anchor.setAttribute('data-href', target);
        anchor.addEventListener('click', event => { event.preventDefault(); app.workspace.openLinkText(target, source, Boolean(event.ctrlKey || event.metaKey)); });
        return anchor;
    }
    function entityLink(parent, name, kind = 'author') {
        const choice = kind === 'series' ? 'Книги - Открыть серию' : 'Книги - Открыть автора';
        const anchor = el(parent, 'a', kind === 'series' ? 'book-adaptations-series-link' : 'book-authors-author-link', name);
        anchor.href = 'obsidian://quickadd?choice=' + encodeURIComponent(choice) + '&value-' + kind + '=' + encodeURIComponent(name).replace(/[!'()*]/g, char => '%' + char.charCodeAt(0).toString(16));
        anchor.title = `Открыть ${kind === 'series' ? 'серию' : 'страницу автора'}: ${name}`;
        anchor.addEventListener('click', async event => {
            const api = app.plugins?.plugins?.quickadd?.api;
            if (!api?.executeChoice) return;
            event.preventDefault();
            try { await api.executeChoice(choice, { [kind]: name }); }
            catch (problem) {
                if (!/cancel/i.test(String(problem.message || problem))) warning.textContent = `Не удалось открыть ${kind === 'series' ? 'серию' : 'автора'}: ${problem.message || problem}`;
            }
        });
    }
    function field(label, tag, cls) {
        const wrapper = el(controls, 'label', `book-authors-field ${cls}`); el(wrapper, 'span', 'book-authors-control-label', label);
        const node = el(wrapper, tag); node.setAttribute('aria-label', label); return node;
    }
    function draw() {
        if (disposed) return;
        if (view) { view.query = search.value; view.type = activeType; view.sort = sort.value; }
        for (const { button, value } of buttons) button.setAttribute('aria-pressed', String(value === activeType));
        const filtered = filterItems(items, { type: activeType, query: search.value, sort: sort.value });
        count.textContent = `Произведений: ${filtered.length} · Экранизаций: ${new Set(filtered.flatMap(item => item.media.map(media => media.file.path))).size}`;
        list.replaceChildren();
        for (const item of filtered) {
            const card = el(list, 'article', 'book-adaptations-card');
            const book = el(card, 'header', 'book-adaptations-book');
            const bookHeading = el(book, 'div', 'book-adaptations-book-heading');
            internal(el(bookHeading, 'h3', 'book-authors-row-title'), item.title, item.file.path.replace(/\.md$/i, ''));
            const authors = el(bookHeading, 'p', 'book-authors-row-meta');
            item.authors.forEach((name, index) => {
                if (index) el(authors, 'span', '', ' · ');
                entityLink(authors, name);
            });
            if (item.series) entityLink(el(bookHeading, 'p', 'book-authors-row-examples'), item.series, 'series');
            const info = el(book, 'div', 'book-adaptations-book-rating');
            if (item.rating !== null) el(info, 'span', '', `Книга ${item.rating}/10`);
            el(info, 'span', 'book-adaptations-count', `На экране: ${item.media.length}`);
            const mediaList = el(card, 'ul', 'book-adaptations-media-list');
            for (const media of item.media) {
                const row = el(mediaList, 'li', 'book-adaptations-media');
                const mediaIcon = el(row, 'span', 'book-adaptations-media-icon', media.type === 'serial' ? '📺' : '🎬'); mediaIcon.setAttribute('aria-hidden', 'true');
                const main = el(row, 'div', 'book-adaptations-media-main');
                const mediaLink = internal(main, media.title, media.file.path.replace(/\.md$/i, ''), 'book-adaptations-media-title');
                mediaLink.title = `Открыть карточку: ${media.title}`;
                el(main, 'p', 'book-adaptations-media-meta', [media.type === 'serial' ? 'Сериал' : 'Фильм', media.year,
                    media.originalTitle && media.originalTitle !== media.title ? media.originalTitle : ''].filter(Boolean).join(' · '));
                if (media.franchises.length) {
                    const franchises = el(main, 'div', 'book-adaptations-franchises');
                    el(franchises, 'span', '', 'Франшиза · ');
                    media.franchises.forEach((page, index) => {
                        if (index) el(franchises, 'span', '', ' · ');
                        internal(franchises, page.title, page.target, 'book-adaptations-franchise-link');
                    });
                }
                const rating = el(row, 'span', 'book-adaptations-media-rating', media.rating === null ? 'Без оценки' : `${media.rating}/10`);
                rating.setAttribute('aria-label', media.rating === null ? 'Оценка кино не указана' : `Моя оценка кино: ${media.rating} из 10`);
            }
        }
        if (!filtered.length) {
            const empty = el(list, 'div', 'book-authors-empty');
            el(empty, 'h3', '', items.length ? 'Ничего не найдено' : 'Связей с кино пока нет');
            el(empty, 'p', '', items.length ? 'Попробуйте другой запрос или сбросьте фильтры.' : 'Добавьте связь с кино из карточки произведения.');
        }
    }
    const coreFile = app.vault.getAbstractFileByPath('Книги/_system/book_core.js');
    if (!coreFile) { count.textContent = 'Модуль библиотеки не найден.'; return { dispose }; }
    const module = { exports: {} }; new Function('module', await app.vault.read(coreFile))(module);
    if (disposed) return { dispose };
    const core = module.exports({ app, obsidian });
    function reload() {
        if (disposed) return;
        try {
            const overview = buildOverview({ app, core, obsidian });
            // TFile belongs to the live vault and can contain circular parent references.
            const nextSignature = JSON.stringify([overview.unresolved, overview.items.map(item => [item.file.path, item.title, item.authors, item.series, item.rating,
                item.media.map(media => [media.file.path, media.title, media.originalTitle, media.type, media.year, media.rating, media.franchises])])]);
            if (nextSignature === signature) return;
            signature = nextSignature; items = overview.items; stats.replaceChildren();
            for (const [key, label] of [['books', 'Произведений'], ['media', 'Экранизаций'], ['movies', 'Фильмов'], ['serials', 'Сериалов']]) {
                const cell = el(stats, 'div', 'book-authors-stat');
                el(cell, 'strong', 'book-authors-stat-value', overview.stats[key]); el(cell, 'span', 'book-authors-stat-label', label);
            }
            warning.textContent = overview.unresolved ? `Недоступных связей: ${overview.unresolved}. Проверьте пути в карточках и отчёт проверки библиотеки.` : '';
            draw();
        } catch (problem) { warning.textContent = `Не удалось загрузить экранизации: ${problem.message || problem}`; }
    }
    function changed(file, oldPath) {
        const relevant = path => String(path || '').startsWith('Книги/') || String(path || '').startsWith('Кино/');
        if (file && !relevant(file.path) && !relevant(oldPath)) return;
        clearTimeout(timer); timer = setTimeout(reload, 150);
    }
    for (const [owner, events] of [[app.metadataCache, ['changed', 'resolved']], [app.vault, ['create', 'delete', 'rename', 'modify']]]) {
        if (!owner?.on) continue;
        for (const event of events) { const ref = owner.on(event, changed); cleanups.push(() => owner.offref?.(ref)); }
    }
    function dispose() { if (disposed) return; disposed = true; clearTimeout(timer); cleanups.forEach(cleanup => cleanup()); listeners.forEach(cleanup => cleanup()); }
    reload();
    return { reload, dispose };
}
module.exports = Object.assign(render, { buildOverview, filterItems, overviewPage, mergeOverview });
