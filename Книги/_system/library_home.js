// A single home renderer; each existing widget owns its own lifecycle.
module.exports = async ({ dv, app, obsidian = {} }) => {
    const source = dv.current?.()?.file?.path || 'Книги/_index.md';
    // These widgets already subscribe to vault changes. Dataview's global
    // refresh must not clear and rebuild the whole page on every index update.
    const component = dv.component;
    const stateKey = '__bookHomeRefresh';
    let refresh = component?.[stateKey];
    if (!refresh && typeof component?.render === 'function') {
        const container = dv.container;
        const original = component.render;
        refresh = { dispose: null, root: null };
        const wrapped = function (...args) {
            if (refresh.root?.parentNode === container) return Promise.resolve();
            return original.apply(this, args);
        };
        component[stateKey] = refresh;
        component.render = wrapped;
        component.register(() => {
            refresh.dispose?.();
            if (component.render === wrapped) component.render = original;
            delete component[stateKey];
        });
    }
    // Dataview reuses its component on refresh; release preceding subscriptions.
    refresh?.dispose?.();
    let disposed = false, timer, actionBusy = false, root = null;
    const cleanups = [], children = [], commandLinks = [];
    if (refresh) refresh.dispose = dispose;
    else dv.component?.register?.(dispose);
    const paths = ['library-home.css', 'book_core.js', 'lazy_base.js', 'reading_dashboard.js'];
    const files = paths.map(name => app.vault.getAbstractFileByPath('Книги/_system/' + name));
    if (files.some(file => !file)) throw new Error('Не найдены модули главной страницы.');
    const texts = await Promise.all(files.map(file => app.vault.read(file)));
    if (disposed) return { dispose };
    const modules = texts.slice(1).map(text => { const module = { exports: {} }; new Function('module', text)(module); return module.exports; });
    const [loadCore, lazy, dashboard] = modules;
    const core = loadCore({ app, obsidian });
    const doc = dv.container.ownerDocument;
    root = el(dv.container, 'section', 'book-home-ui');
    if (refresh) refresh.root = root;
    root.dataset.ready = 'false';
    el(root, 'style', '', texts[0]);
    function el(parent, tag, cls = '', text) {
        const node = doc.createElement(tag); if (cls) node.className = cls;
        if (text !== undefined) node.textContent = String(text); parent.appendChild(node); return node;
    }
    function listen(node, event, callback) { node.addEventListener(event, callback); cleanups.push(() => node.removeEventListener(event, callback)); }
    function internal(parent, text, target, cls = '') {
        const link = el(parent, 'a', `internal-link ${cls}`.trim(), text); link.href = target; link.dataset.href = target;
        listen(link, 'click', event => { event.preventDefault(); app.workspace.openLinkText(target, source, Boolean(event.ctrlKey || event.metaKey)); }); return link;
    }
    const status = el(root, 'p', 'book-home-action-error'); status.hidden = true; status.setAttribute('role', 'status');
    function command(parent, text, choice, cls = '') {
        const link = el(parent, 'a', cls, text); link.href = 'obsidian://quickadd?choice=' + encodeURIComponent(choice);
        commandLinks.push(link);
        listen(link, 'click', async event => {
            const api = app.plugins?.plugins?.quickadd?.api;
            if (!api?.executeChoice) return;
            event.preventDefault();
            if (disposed || actionBusy) return;
            actionBusy = true; for (const node of commandLinks) node.setAttribute('aria-disabled', 'true');
            status.hidden = true;
            try { await api.executeChoice(choice); }
            catch (problem) {
                if (!disposed && !/^Input cancel(?:led|ed) by user\.?$/i.test(String(problem?.message || problem))) {
                    status.textContent = `Не удалось открыть «${text}»: ${problem.message || problem}`; status.hidden = false;
                }
            } finally { actionBusy = false; for (const node of commandLinks) node.removeAttribute('aria-disabled'); }
        }); return link;
    }
    const masthead = el(root, 'header', 'book-home-masthead');
    const nav = el(masthead, 'nav', 'book-home-nav'); nav.setAttribute('aria-label', 'Навигация библиотеки');
    internal(nav, 'Цитаты', 'Книги/Цитаты'); internal(nav, 'Стихи', 'Книги/Стихи'); internal(nav, 'Итоги чтения', 'Книги/_system/Итоги чтения');
    const identity = el(masthead, 'div', 'book-home-identity');
    const heading = el(identity, 'div', 'book-home-heading');
    el(heading, 'h1', 'book-home-title', 'Библиотека');
    el(heading, 'p', 'book-home-subtitle', 'Произведения, чтения и заметки');
    const actions = el(identity, 'div', 'book-home-actions');
    command(actions, 'Записать произведение', 'Книги - Добавить книгу', 'book-home-action is-primary');
    command(actions, 'Записать чтение', 'Книги - Добавить чтение', 'book-home-action');
    command(actions, 'Редактировать чтение', 'Книги - Редактировать чтение', 'book-home-action');
    command(actions, 'Добавить цитату', 'Книги - Добавить выписку', 'book-home-action');
    const search = command(actions, 'Поиск по библиотеке', 'Книги - Поиск по библиотеке', 'book-home-action is-icon');
    search.setAttribute('aria-label', 'Поиск по библиотеке'); search.title = 'Поиск по библиотеке';
    const icon = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
    for (const [name, value] of Object.entries({ viewBox: '0 0 24 24', width: '20', height: '20', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.8', 'stroke-linecap': 'round', 'aria-hidden': 'true', focusable: 'false' })) icon.setAttribute(name, value);
    for (const [tag, attributes] of [['circle', { cx: '10.5', cy: '10.5', r: '6.5' }], ['path', { d: 'm16 16 5 5' }]]) {
        const shape = doc.createElementNS('http://www.w3.org/2000/svg', tag);
        for (const [name, value] of Object.entries(attributes)) shape.setAttribute(name, value); icon.appendChild(shape);
    }
    search.replaceChildren(icon);
    const stats = el(masthead, 'div', 'book-home-stats');
    const statValues = [];
    for (const [key, label] of [['books', 'Произведений'], ['authors', 'Авторов'], ['fictionRead', 'Художественных'], ['nonfictionRead', 'Нон-фикшн'], ['reread', 'Перечитано']]) {
        const cell = el(stats, 'div', 'book-home-stat');
        const value = el(cell, 'strong'); value.dataset.stat = key; el(cell, 'span', '', label); statValues.push([key, value]);
    }
    function drawStats() { if (disposed) return; const values = core.stats(); for (const [key, node] of statValues) { const value = String(values[key]); if (node.textContent !== value) node.textContent = value; } }
    drawStats();
    function scheduleStats() { clearTimeout(timer); timer = setTimeout(drawStats, 120); }
    for (const [owner, events] of [[app.metadataCache, ['changed']], [app.vault, ['create', 'delete', 'rename', 'modify']]]) {
        if (!owner?.on) continue;
        for (const event of events) { const ref = owner.on(event, scheduleStats); cleanups.push(() => owner.offref?.(ref)); }
    }
    function panel(parent, title, cls, linkLabel, target) {
        const box = el(parent, 'section', `book-home-panel ${cls}`);
        const head = el(box, 'div', 'book-home-panel-head');
        el(head, 'h2', '', title); if (linkLabel) internal(head, linkLabel, target, 'book-home-section-link');
        return { box, head, body: el(box, 'div', 'book-home-widget') };
    }
    // Late registration after navigation must immediately release a widget subscription.
    function widgetComponent() {
        let ended = false;
        if (obsidian.Component && dv.component?.addChild) {
            const component = new obsidian.Component();
            const register = component.register.bind(component), unload = component.unload.bind(component), addChild = component.addChild.bind(component);
            component.register = callback => { if (ended || disposed) { callback(); return callback; } return register(callback); };
            component.unload = () => { ended = true; return unload(); };
            component.addChild = child => { if (ended || disposed) { child.load?.(); child.unload?.(); return child; } return addChild(child); };
            dv.component.addChild(component); children.push(component); return component;
        }
        const callbacks = [], refs = [], nested = [];
        const component = {
            register(callback) { if (ended || disposed) callback(); else callbacks.push(callback); },
            registerEvent(ref) { refs.push(ref); dv.component?.registerEvent?.(ref); },
            addChild(child) { if (!ended && !disposed) nested.push(child); child.load?.(); if (ended || disposed) child.unload?.(); return child; },
            removeChild(child) { const index = nested.indexOf(child); if (index >= 0) nested.splice(index, 1); child.unload?.(); return child; },
            unload() { if (ended) return; ended = true; for (const callback of callbacks) callback(); for (const child of nested) child.unload?.(); }
        };
        children.push(component); return component;
    }
    async function mount(container, renderer, options = {}) {
        const component = widgetComponent();
        const scope = { container, component, current: () => dv.current?.() || { file: { path: source } },
            paragraph: text => el(container, 'p', '', text) };
        try { if (!disposed) await renderer({ dv: scope, app, obsidian, ...options }); }
        catch (problem) { if (!disposed) el(container, 'p', 'book-home-widget-error', `Не удалось загрузить блок: ${problem.message || problem}`); }
    }
    const recent = panel(root, 'Недавние произведения', 'book-home-recent', 'Весь каталог ↗', 'Книги/_system/_Книги.base#Все');
    el(recent.head, 'p', 'book-home-caption', 'Последние 20 по дате чтения');
    const reading = panel(root, 'Чтение в цифрах', 'book-home-reading', 'Все итоги ↗', 'Книги/_system/Итоги чтения');
    const overviews = el(root, 'section', 'book-home-overviews'); el(overviews, 'h2', '', 'Обзор библиотеки');
    const overviewLinks = el(overviews, 'div', 'book-home-overview-links');
    for (const [label, description, choice] of [['Авторы', 'Произведения и впечатления', 'Книги - Авторы'], ['Серии', 'Порядок книг', 'Книги - Серии'], ['Экранизации', 'Книги и кино', 'Книги - Экранизации']]) {
        const tile = el(overviewLinks, 'div', 'book-home-overview'); command(tile, label, choice); el(tile, 'p', '', description);
    }
    const poems = el(overviewLinks, 'div', 'book-home-overview'); internal(poems, 'Стихи', 'Книги/Стихи'); el(poems, 'p', '', 'Поэты и тексты');
    const views = el(root, 'details', 'book-home-views'); el(views, 'summary', '', 'Другие представления каталога');
    const viewLinks = el(views, 'nav', 'book-home-view-links'); viewLinks.setAttribute('aria-label', 'Представления каталога');
    for (const [label, name] of [['Подробная таблица', 'Все'], ['Любимые', 'Любимые'], ['Без оценки', 'Без оценки'], ['По году', 'По году'], ['По типу', 'По типу']]) internal(viewLinks, label, 'Книги/_system/_Книги.base#' + name);
    const reread = el(views, 'section', 'book-home-reread'); el(reread, 'h3', '', 'Перечитанные');
    const rereadBody = el(reread, 'div', 'book-home-widget');
    let rereadComponent = null, rereadPending = false;
    listen(views, 'toggle', async () => {
        if (!views.open) { if (rereadComponent) release(rereadComponent); rereadComponent = null; rereadBody.replaceChildren(); return; }
        if (disposed || rereadComponent || rereadPending) return;
        rereadPending = true;
        const index = children.length;
        try { await mount(rereadBody, lazy, { mode: 'reread', target: 'Книги/_system/_Книги.base#Перечитанные', label: 'перечитанные' }); rereadComponent = children[index]; }
        finally {
            rereadPending = false;
            if (!views.open || disposed) { if (rereadComponent) release(rereadComponent); rereadComponent = null; rereadBody.replaceChildren(); }
        }
    });
    const footer = el(root, 'footer', 'book-home-footer');
    internal(footer, 'Проверка библиотеки', 'Книги/_system/Проверка библиотеки'); internal(footer, 'Журнал изменений', 'Книги/_system/Журнал изменений');
    function release(component) {
        const index = children.indexOf(component); if (index >= 0) children.splice(index, 1);
        if (obsidian.Component && dv.component?.removeChild) dv.component.removeChild(component); else component.unload();
    }
    function dispose() {
        if (disposed) return; disposed = true; clearTimeout(timer);
        for (const cleanup of cleanups) cleanup(); for (const child of [...children]) release(child);
        if (root) { root.dataset.ready = 'false'; root.remove(); }
        if (refresh?.root === root) refresh.root = null;
    }
    await Promise.all([
        mount(recent.body, lazy, { target: 'Книги/_system/_Книги.base#Главная', label: 'недавние 20', expanded: true }),
        mount(reading.body, dashboard, { mode: 'home' })
    ]);
    if (!disposed) root.dataset.ready = 'true';
    return { dispose };
};
