// Author catalogue and permanent author pages. Rendering never writes book notes.
const TYPES = { book: 'Книга', novel: 'Роман', novella: 'Повесть', story: 'Рассказ', collection: 'Сборник', poem: 'Стихи', play: 'Пьеса', essay: 'Эссе', lecture: 'Лекция', article: 'Статья', other: 'Другое' };
const values = value => [...new Set((Array.isArray(value) ? value : [value]).map(item => String(item ?? '').trim()).filter(Boolean))];
const searchable = value => String(value ?? '').toLocaleLowerCase('ru').replace(/ё/g, 'е').trim();
function buildItems(records) {
    return records.map(record => {
        const fm = record.fm, fiction = record.file.path.startsWith('Книги/Художественные/');
        const number = Number(fm.rating);
        const rating = fiction && Number.isFinite(number) && number >= 1 && number <= 10 ? number : null;
        const history = record.history || [];
        const date = history.map(entry => entry.date).sort().at(-1) || '';
        const title = String(fm.title || record.file.basename), authors = values(fm.authors), series = String(fm.series || '');
        return { file: record.file, title, authors, fiction, rating, date, series, seriesIndex: fm.series_index,
            type: TYPES[fm.work_type] || (fiction ? 'Художественное' : 'Non-fiction'), history,
            years: [...new Set(history.map(entry => entry.date.slice(0, 4)))], excerpts: record.excerpts || [],
            search: searchable([title, ...authors, series].join(' ')), historyError: record.historyError || record.error };
    });
}
function aggregate(items) {
    const map = new Map();
    for (const item of items) for (const name of item.authors) {
        if (!map.has(name)) map.set(name, { name, items: [], ratings: [], favorites: 0, points: 0 });
        const row = map.get(name);
        row.items.push(item);
        if (item.rating !== null) { row.ratings.push(item.rating); row.favorites += Number(item.rating >= 8); row.points += Math.max(0, item.rating - 5); }
    }
    return [...map.values()].map(row => ({ ...row, count: row.items.length,
        average: row.ratings.length ? row.ratings.reduce((sum, n) => sum + n, 0) / row.ratings.length : null,
        latest: row.items.map(item => item.date).sort().at(-1) || '', search: searchable([row.name, ...row.items.map(item => item.search)].join(' ')) }));
}
function filterItems(items, { filter = 'all', year = '', query = '' } = {}) {
    return items.filter(item => (filter === 'all' || filter === 'fiction' && item.fiction || filter === 'nonfiction' && !item.fiction || filter === 'best' && item.rating !== null && item.rating >= 8)
        && (!year || (year === 'unknown' ? !item.years.length : item.years.includes(year)))
        && (!query || item.search.includes(searchable(query))));
}
const score = value => value === null ? '—' : value.toFixed(1).replace('.', ',');
const initials = name => name.split(/[\s-]+/).filter(Boolean).slice(0, 2).map(part => Array.from(part)[0]).join('').toLocaleUpperCase('ru');
async function render({ dv, app, obsidian = {}, mode = 'index' }) {
    const index = mode !== 'author';
    const source = dv.current?.()?.file?.path || '';
    const author = index ? '' : String(dv.current?.()?.selected_author || '').trim();
    const root = el(dv.container, 'section', 'book-authors-ui');
    const css = app.vault.getAbstractFileByPath('Книги/_system/authors-ui.css');
    if (css) el(root, 'style', '', await app.vault.read(css));
    const nav = el(root, 'nav', 'book-authors-nav');
    internal(nav, '← Библиотека', 'Книги/_index');
    if (!index) internal(nav, 'Все авторы', 'Книги/_system/Авторы');
    internal(nav, 'Итоги чтения', 'Книги/_system/Итоги чтения');
    internal(nav, 'Цитаты', 'Книги/Цитаты/_Цитаты');
    const header = el(root, 'header', 'book-authors-header');
    const identity = el(header, 'div', 'book-authors-identity');
    const monogram = el(identity, 'div', 'book-authors-monogram', index ? 'Аа' : initials(author) || 'А');
    monogram.setAttribute('aria-hidden', 'true');
    const heading = el(identity, 'div', 'book-authors-heading');
    el(heading, 'div', 'book-authors-eyebrow', `Библиотека / ${index ? 'Авторы' : 'Автор'}`);
    el(heading, 'h1', 'book-authors-name', index ? 'Все авторы' : author || 'Автор не выбран');
    el(heading, 'p', 'book-authors-subtitle', index ? 'Писатели, книги и ваши впечатления' : 'Произведения и ваши впечатления');
    if (!index) internal(header, 'Выбрать автора', 'Книги/_system/Авторы', 'book-authors-change');
    const stats = el(root, 'div', 'book-authors-stats');
    const section = el(root, 'section', 'book-authors-collection');
    const sectionHead = el(section, 'div', 'book-authors-section-heading');
    el(sectionHead, 'h2', '', index ? 'Авторы в коллекции' : 'Произведения');
    const count = el(sectionHead, 'span', 'book-authors-result-count', 'Загружаю…');
    count.setAttribute('aria-live', 'polite');
    const controls = el(section, 'div', 'book-authors-controls');
    function field(label, tag, cls) {
        const wrapper = el(controls, 'label', `book-authors-field ${cls}`);
        el(wrapper, 'span', 'book-authors-control-label', label);
        const input = el(wrapper, tag);
        input.setAttribute('aria-label', label);
        return input;
    }
    const search = field(index ? 'Поиск среди авторов' : 'Поиск среди произведений', 'input', 'book-authors-search');
    search.type = 'search'; search.autocomplete = 'off';
    search.placeholder = index ? 'Имя автора или название произведения' : 'Название произведения или серии';
    const year = field('Год чтения', 'select', 'book-authors-year');
    const sort = field('Сортировка', 'select', 'book-authors-sort');
    const options = index ? [['points', 'По симпатии'], ['count', 'Больше произведений'], ['rating', 'По средней оценке'], ['name', 'По алфавиту']]
        : [['recent', 'Недавно прочитанные'], ['rating', 'Сначала лучшие'], ['name', 'По алфавиту'], ['series', 'По сериям']];
    for (const [value, label] of options) el(sort, 'option', '', label).value = value;
    sort.value = options[0][0];
    const filters = el(controls, 'div', 'book-authors-filters');
    filters.setAttribute('role', 'group'); filters.setAttribute('aria-label', 'Категория произведений');
    const filterButtons = [], listeners = [];
    let activeFilter = 'all', items = [], disposed = false, timer, generation = 0;
    for (const [value, label] of [['all', 'Все'], ['fiction', 'Художественные'], ['nonfiction', 'Non-fiction'], ['best', 'Любимые 8–10']]) {
        const button = el(filters, 'button', 'book-authors-filter', label);
        button.type = 'button'; button.setAttribute('aria-pressed', String(value === activeFilter));
        listen(button, 'click', () => {
            activeFilter = value;
            for (const row of filterButtons) row.button.setAttribute('aria-pressed', String(row.value === value));
            draw();
        });
        filterButtons.push({ value, button });
    }
    const reset = el(filters, 'button', 'book-authors-reset', 'Сбросить');
    reset.type = 'button';
    listen(reset, 'click', () => {
        search.value = ''; year.value = ''; sort.value = options[0][0]; activeFilter = 'all';
        for (const row of filterButtons) row.button.setAttribute('aria-pressed', String(row.value === 'all'));
        draw();
    });
    const grid = el(section, 'div', 'book-authors-list');
    let tableChild = null;
    if (!index) {
        const table = el(root, 'details', 'book-authors-info');
        el(table, 'summary', '', 'Таблица и представления');
        const body = el(table, 'div', 'book-authors-table');
        listen(table, 'toggle', async () => {
            if (!table.open || tableChild || disposed) return;
            if (!obsidian.MarkdownRenderer?.render || !obsidian.Component || !dv.component?.addChild) {
                if (!body.children.length) internal(body, 'Открыть подробный каталог', 'Книги/Книги.base');
                return;
            }
            tableChild = new obsidian.Component();
            dv.component.addChild(tableChild);
            try { await obsidian.MarkdownRenderer.render(app, '![[Книги/Книги.base#Автор]]', body, source, tableChild); }
            catch (problem) {
                dv.component.removeChild?.(tableChild); tableChild = null;
                body.textContent = `Не удалось показать таблицу: ${problem.message || problem}`;
            }
        });
    }
    const error = el(root, 'p', 'book-authors-warning');
    const info = el(root, 'details', 'book-authors-info');
    el(info, 'summary', '', 'Об оценках и подсчётах');
    el(info, 'p', '', 'Средняя оценка и любимые 8–10 — по текущим оценкам художественных произведений в карточках. Баллы симпатии — сумма превышения оценок над 5. Строки отражают произведения выбранной категории и года. Год определяется по истории чтений; дата только до месяца или года сохраняет свою точность. Показатели в шапке относятся ко всей коллекции автора или библиотеки.');
    for (const [input, event] of [[search, 'input'], [year, 'change'], [sort, 'change']]) listen(input, event, draw);
    function el(parent, tag, cls, text) {
        const node = parent.ownerDocument.createElement(tag);
        if (cls) node.className = cls;
        if (text !== undefined) node.textContent = String(text);
        parent.appendChild(node); return node;
    }
    function listen(node, event, callback) { node.addEventListener(event, callback); listeners.push(() => node.removeEventListener(event, callback)); }
    function internal(parent, label, target, cls = '') {
        const anchor = el(parent, 'a', `${cls} internal-link`.trim(), label);
        anchor.href = target; anchor.setAttribute('data-href', target);
        // Row listeners are owned by their discarded DOM subtrees, not by the persistent controls.
        anchor.addEventListener('click', event => {
            event.preventDefault(); app.workspace.openLinkText(target, source, Boolean(event.ctrlKey || event.metaKey));
        });
        return anchor;
    }
    function authorLink(parent, name) {
        const anchor = el(parent, 'a', 'book-authors-author-link', name);
        anchor.href = 'obsidian://quickadd?choice=' + encodeURIComponent('Книги - Открыть автора') + '&value-author=' + encodeURIComponent(name).replace(/[!'()*]/g, char => '%' + char.charCodeAt(0).toString(16));
        anchor.addEventListener('click', async event => {
            const api = app.plugins?.plugins?.quickadd?.api;
            if (!api?.executeChoice) return;
            event.preventDefault();
            try { await api.executeChoice('Книги - Открыть автора', { author: name }); }
            catch (problem) { if (!/cancel/i.test(String(problem.message || problem))) error.textContent = `Не удалось открыть автора: ${problem.message || problem}`; }
        });
    }
    function stat(label, value) {
        const cell = el(stats, 'div', 'book-authors-stat');
        el(cell, 'strong', 'book-authors-stat-value', value); el(cell, 'span', 'book-authors-stat-label', label);
    }
    function chip(parent, label, value, accent = false) {
        const cell = el(parent, 'div', `book-authors-chip${accent ? ' is-accent' : ''}`);
        el(cell, 'span', '', label); el(cell, 'strong', '', value);
    }
    function draw() {
        grid.replaceChildren();
        const filtered = filterItems(items, { filter: activeFilter, year: year.value, query: index ? '' : search.value });
        const compare = (a, b) => a.localeCompare(b, 'ru', { sensitivity: 'base', numeric: true });
        if (index) {
            const rows = aggregate(filtered).filter(row => !search.value || row.search.includes(searchable(search.value)));
            rows.sort((a, b) => (sort.value === 'points' ? b.points - a.points : sort.value === 'count' ? b.count - a.count : sort.value === 'rating' ? (b.average ?? -1) - (a.average ?? -1) : 0) || compare(a.name, b.name));
            count.textContent = `Авторов: ${rows.length}`;
            rows.forEach((row, i) => {
                const card = el(grid, 'article', 'book-authors-row book-authors-person-row');
                el(card, 'span', 'book-authors-row-number', String(i + 1).padStart(2, '0'));
                const monogram = el(card, 'span', 'book-authors-row-monogram', initials(row.name)); monogram.setAttribute('aria-hidden', 'true');
                const main = el(card, 'div', 'book-authors-row-main');
                authorLink(el(main, 'h3', 'book-authors-row-title'), row.name);
                el(main, 'p', 'book-authors-row-meta', row.items.some(item => item.fiction) ? row.items.some(item => !item.fiction) ? 'Художественные · Non-fiction' : 'Художественные' : 'Non-fiction');
                const examples = [...row.items].sort((a, b) => compare(b.date, a.date)).slice(0, 3).map(item => item.title).join(' · ');
                el(main, 'p', 'book-authors-row-examples', examples);
                const chips = el(card, 'div', 'book-authors-chips');
                chip(chips, 'В коллекции', row.count); chip(chips, 'Средняя', score(row.average), true);
                chip(chips, 'Любимые', row.favorites); chip(chips, 'Симпатия', row.points);
            });
            if (!rows.length) empty();
        } else {
            filtered.sort((a, b) => (sort.value === 'recent' ? compare(b.date, a.date) : sort.value === 'rating' ? (b.rating ?? -1) - (a.rating ?? -1) : sort.value === 'series' ? compare(a.series || '\uffff', b.series || '\uffff') || (Number(a.seriesIndex) || 0) - (Number(b.seriesIndex) || 0) : 0) || compare(a.title, b.title));
            count.textContent = `Произведений: ${filtered.length}`;
            filtered.forEach((item, i) => {
                const card = el(grid, 'article', 'book-authors-row');
                el(card, 'span', 'book-authors-row-number', String(i + 1).padStart(2, '0'));
                const main = el(card, 'div', 'book-authors-row-main');
                internal(el(main, 'h3', 'book-authors-row-title'), item.title, item.file.path.replace(/\.md$/i, ''));
                el(main, 'p', 'book-authors-row-meta', `${item.type} · ${item.fiction ? 'Художественное' : 'Non-fiction'} · ${item.date ? 'Читалось: ' + service.core.displayDate(item.date) : 'Дата чтения не записана'}`);
                if (item.series) el(main, 'p', 'book-authors-row-examples', `Серия: ${item.series}${item.seriesIndex ? ' · №' + item.seriesIndex : ''}`);
                if (item.authors.length > 1) el(main, 'p', 'book-authors-row-examples', `Авторы: ${item.authors.join(', ')}`);
                const chips = el(card, 'div', 'book-authors-chips');
                chip(chips, 'Моя оценка', item.rating === null ? '—' : item.rating, true);
                chip(chips, 'Чтений', item.history.length); chip(chips, 'Выписок', item.excerpts.length);
            });
            if (!filtered.length) empty();
        }
        function empty() {
            const box = el(grid, 'div', 'book-authors-empty');
            el(box, 'h3', '', items.length ? 'Ничего не найдено' : 'В коллекции пока нет произведений');
            el(box, 'p', '', items.length ? 'Попробуйте другой запрос или сбросьте фильтры.' : 'Связанные произведения появятся здесь после добавления.');
        }
    }
    const file = app.vault.getAbstractFileByPath('Книги/_system/knowledge.js');
    if (!file) { count.textContent = 'Модуль библиотеки не найден.'; return; }
    let service;
    try {
        const module = { exports: {} }; new Function('module', await app.vault.read(file))(module);
        service = await module.exports.getService({ app, obsidian });
    } catch (problem) { count.textContent = `Не удалось загрузить авторов: ${problem.message || problem}`; return; }
    async function reload() {
        const current = ++generation;
        try {
            const records = await service.snapshot();
            if (disposed || current !== generation) return;
            items = buildItems(records).filter(item => index || item.authors.includes(author));
            const ratings = items.map(item => item.rating).filter(value => value !== null);
            stats.replaceChildren();
            if (index) {
                stat('Авторов', aggregate(items).length); stat('Произведений', items.length);
                stat('Художественных', items.filter(item => item.fiction).length); stat('Non-fiction', items.filter(item => !item.fiction).length);
                stat('Любимые 8–10', ratings.filter(value => value >= 8).length);
            } else {
                stat('В коллекции', items.length); stat('Чтений', items.reduce((sum, item) => sum + item.history.length, 0));
                stat('Средняя моя оценка', score(ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null));
                stat('Любимые 8–10', ratings.filter(value => value >= 8).length);
                const years = [...new Set(items.flatMap(item => item.years))].sort();
                stat('Годы чтения', !years.length ? '—' : years[0] === years.at(-1) ? years[0] : `${years[0]}–${years.at(-1)}`);
            }
            const selected = year.value;
            year.replaceChildren(); el(year, 'option', '', 'Все годы').value = '';
            const years = [...new Set(items.flatMap(item => item.years))].sort((a, b) => b.localeCompare(a));
            for (const value of years) el(year, 'option', '', value).value = value;
            if (items.some(item => !item.years.length)) el(year, 'option', '', 'Без даты').value = 'unknown';
            year.value = years.includes(selected) || selected === 'unknown' && items.some(item => !item.years.length) ? selected : '';
            const damaged = items.filter(item => item.historyError).length;
            error.textContent = damaged ? `Историй с ошибками: ${damaged}. Их чтения и годы не подменяются значениями карточек.` : '';
            draw();
        } catch (problem) { if (!disposed) error.textContent = `Не удалось загрузить авторов: ${problem.message || problem}`; }
    }
    const unsubscribe = service.subscribe(() => { clearTimeout(timer); timer = setTimeout(reload, 200); });
    function dispose() {
        disposed = true; clearTimeout(timer); unsubscribe(); listeners.forEach(cleanup => cleanup());
        if (tableChild) { dv.component.removeChild?.(tableChild); tableChild = null; }
    }
    dv.component?.register?.(dispose);
    await reload();
    return { reload, dispose };
}
module.exports = Object.assign(render, { buildItems, aggregate, filterItems });
