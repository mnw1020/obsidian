// The Markdown below the loader remains a readable fallback and the source of the view.
module.exports = async ({ dv, app, obsidian = {}, mode = 'audit' }) => {
    // Load collection CSS even when the startup plugin is unavailable on mobile.
    try {
        const styleFile = app.vault.getAbstractFileByPath("Кино/_system/vault_styles.js");
        if (styleFile) {
            const styles = { exports: {} };
            new Function("module", await app.vault.read(styleFile))(styles);
            await styles.exports({ app, document: dv.container.ownerDocument });
        }
    } catch (error) { console.warn("Не удалось подключить оформление коллекций", error); }

    if (!['audit', 'journal'].includes(mode)) throw new Error('Неизвестная страница обслуживания.');
    const journalPath = 'Книги/_system/Журнал изменений.md';
    const source = mode === 'journal' ? journalPath : 'Книги/_system/Проверка библиотеки.md';
    const stateKey = '_bookMaintenanceView';
    dv.component?.[stateKey]?.dispose();
    let disposed = false, generation = 0, activeVersion = 0, timer, busy = false, activeChild = null;
    const cleanups = [], children = new Set(), actions = [];
    const doc = dv.container.ownerDocument;
    function el(parent, tag, cls = '', text) {
        const node = doc.createElement(tag);
        if (cls) node.className = cls;
        if (text !== undefined) node.textContent = String(text);
        parent.appendChild(node); return node;
    }
    const root = el(dv.container, 'section', 'book-authors-ui book-maintenance-ui');
    root.dataset.mode = mode; root.dataset.ready = 'false';
    const handle = { dispose, reload };
    if (dv.component) { dv.component[stateKey] = handle; dv.component.register?.(dispose); }
    if (disposed) return handle;
    const fileNames = ['authors-ui.css', 'maintenance-ui.css', 'maintenance_pages.js'];
    const files = fileNames.map(name => app.vault.getAbstractFileByPath('Книги/_system/' + name));
    if (files.some(file => !file)) { dispose(); throw new Error('Не найдены модули страниц обслуживания библиотеки.'); }
    const texts = await Promise.all(files.map(file => app.vault.read(file)));
    if (disposed) return handle;
    if (!obsidian.MarkdownRenderer?.render) {
        dispose(); throw new Error('Средство отображения Markdown недоступно. Данные страницы приведены ниже.');
    }
    el(root, 'style', '', texts[0] + '\n' + texts[1]);
    const module = { exports: {} }; new Function('module', texts[2])(module);
    const pages = module.exports;
    const nav = el(root, 'nav', 'book-authors-nav');
    function internal(parent, label, target) {
        const link = el(parent, 'a', 'internal-link', label);
        link.href = target; link.dataset.href = target;
        link.addEventListener('click', event => {
            event.preventDefault(); app.workspace.openLinkText(target, source, Boolean(event.ctrlKey || event.metaKey));
        }); return link;
    }
    internal(nav, '← Библиотека', 'Книги/_index');
    internal(nav, 'Авторы', 'Книги/_system/Авторы');
    internal(nav, 'Серии', 'Книги/_system/Серии');
    internal(nav, 'Экранизации', 'Книги/_system/Экранизации');
    internal(nav, mode === 'audit' ? 'Журнал изменений' : 'Проверка библиотеки', mode === 'audit' ? journalPath.slice(0, -3) : 'Книги/_system/Проверка библиотеки');
    const header = el(root, 'header', 'book-authors-header');
    const identity = el(header, 'div', 'book-authors-identity');
    const heading = el(identity, 'div', 'book-authors-heading');
    el(heading, 'div', 'book-authors-eyebrow', 'Библиотека / Обслуживание');
    el(heading, 'h1', 'book-authors-name', mode === 'audit' ? 'Проверка библиотеки' : 'Журнал изменений');
    const controls = el(header, 'div', 'book-maintenance-actions');
    const status = el(root, 'p', 'book-maintenance-status');
    status.hidden = true; status.setAttribute('role', 'status');
    const content = el(root, 'div', 'book-maintenance-content');
    let clearButton = null;
    function setBusy(value) {
        busy = value;
        for (const action of actions) {
            if (action.tagName === 'BUTTON') action.disabled = value || action.dataset.empty === 'true';
            else if (value) action.setAttribute('aria-disabled', 'true');
            else action.removeAttribute('aria-disabled');
        }
    }
    async function run(action) {
        if (disposed || busy) return;
        setBusy(true); status.hidden = true;
        try { await action(); }
        catch (problem) {
            if (!disposed && !/cancel/i.test(String(problem?.message || problem))) {
                status.textContent = `Не удалось выполнить действие: ${problem.message || problem}`; status.hidden = false;
            }
        } finally { if (!disposed) setBusy(false); }
    }
    function command(label, choice) {
        const link = el(controls, 'a', 'book-authors-change', label);
        link.href = 'obsidian://quickadd?choice=' + encodeURIComponent(choice); actions.push(link);
        link.addEventListener('click', event => {
            const api = app.plugins?.plugins?.quickadd?.api;
            if (!api?.executeChoice) return;
            event.preventDefault(); void run(() => api.executeChoice(choice));
        });
    }
    if (mode === 'audit') {
        command('Проверить', 'Книги - Проверить библиотеку');
        command('Исправить безопасное', 'Книги - Исправить безопасное');
        command('Нормализовать', 'Книги - Нормализовать библиотеку');
    } else {
        clearButton = el(controls, 'button', 'book-authors-change book-maintenance-clear', 'Очистить журнал');
        clearButton.type = 'button'; clearButton.disabled = true; actions.push(clearButton);
        clearButton.addEventListener('click', () => void run(async () => {
            const file = app.vault.getAbstractFileByPath(journalPath);
            if (file) await app.vault.process(file, current => pages.clearJournal(current));
            await reload();
        }));
    }
    function makeChild() {
        if (!obsidian.Component) return null;
        const child = new obsidian.Component(); children.add(child);
        if (dv.component?.addChild) dv.component.addChild(child); else child.load?.();
        return child;
    }
    function release(child) {
        if (!child || !children.delete(child)) return;
        if (dv.component?.removeChild) dv.component.removeChild(child); else child.unload?.();
    }
    async function markdown(text, target, child) {
        await obsidian.MarkdownRenderer.render(app, text, target, source, child || dv.component);
    }
    function sectionHeading(parent, title, count) {
        const row = el(parent, 'div', 'book-authors-section-heading');
        el(row, 'h2', '', title);
        if (count !== undefined) el(row, 'span', 'book-authors-result-count', count);
    }
    async function reload() {
        const version = ++generation;
        let child = null;
        try {
            const file = app.vault.getAbstractFileByPath(source);
            if (!file && mode === 'audit') throw new Error('Отчёт проверки не найден. Запустите проверку библиотеки.');
            const text = file ? await app.vault.read(file) : '';
            if (disposed || version !== generation) return;
            const draft = doc.createElement('div');
            const model = mode === 'audit' ? pages.parseAudit(text) : pages.parseJournal(text);
            if (mode === 'audit' && !model.sections.length) throw new Error('В отчёте нет разделов проверки. Запустите проверку библиотеки.');
            child = makeChild();
            if (mode === 'audit') {
                const stats = el(draft, 'div', 'book-authors-stats');
                for (const [label, value] of [['Произведений', model.checked], ['Ошибок', model.errors], ['Предупреждений', model.warnings]]) {
                    const stat = el(stats, 'div', 'book-authors-stat');
                    el(stat, 'strong', 'book-authors-stat-value', value); el(stat, 'span', 'book-authors-stat-label', label);
                }
                if (model.timestamp) el(draft, 'p', 'book-maintenance-updated', `Последняя проверка: ${model.timestamp}`);
                sectionHeading(draft, 'Результаты проверки');
                const previous = new Map([...content.querySelectorAll('details')].map(node => [node.dataset.section, node.open]));
                const sections = [...model.sections].sort((a, b) => {
                    const priority = section => /(?:^|\s)Ошибки\s*$/u.test(section.title) ? 0 : /Предупреждения\s*$/u.test(section.title) ? 1 : 2;
                    return priority(a) - priority(b);
                });
                const pending = [];
                for (const section of sections) {
                    const title = section.title.replace(/^[^\p{L}\p{N}]+/u, '').trim();
                    const details = el(draft, 'details', 'book-maintenance-section'); details.dataset.section = section.title;
                    el(details, 'summary', '', title);
                    const body = el(details, 'div', 'book-maintenance-markdown');
                    let loaded = false;
                    const load = async () => {
                        if (loaded || disposed || version !== generation && version !== activeVersion) return;
                        loaded = true;
                        body.replaceChildren();
                        try { await markdown(section.markdown, body, child); }
                        catch (problem) { loaded = false; throw problem; }
                    };
                    details.addEventListener('toggle', () => {
                        if (details.open) void load().catch(problem => { body.textContent = `Не удалось показать раздел: ${problem.message || problem}`; });
                    });
                    details.open = previous.get(section.title) ?? (/^Ошибки$/u.test(title) && model.errors > 0 || /^Предупреждения$/u.test(title) && model.warnings > 0);
                    if (details.open) pending.push(load());
                }
                await Promise.all(pending);
            } else {
                sectionHeading(draft, 'История изменений', `Записей: ${model.length}`);
                const list = el(draft, 'div', 'book-maintenance-entries');
                if (!model.length) {
                    const empty = el(list, 'div', 'book-authors-empty');
                    el(empty, 'h3', '', 'Журнал пуст');
                } else {
                    for (const entry of [...model].reverse()) {
                        const article = el(list, 'article', 'book-maintenance-entry');
                        el(article, 'h2', 'book-maintenance-entry-title', entry.title);
                        await markdown(entry.markdown, el(article, 'div', 'book-maintenance-markdown'), child);
                    }
                }
            }
            if (disposed || version !== generation) { release(child); return; }
            content.replaceChildren(...draft.childNodes);
            release(activeChild); activeChild = child; activeVersion = version;
            if (clearButton) { clearButton.dataset.empty = String(model.length === 0); clearButton.disabled = busy || model.length === 0; }
            status.hidden = true;
            root.dataset.ready = 'true';
        } catch (problem) {
            release(child);
            if (!disposed && version === generation) {
                status.textContent = `Не удалось показать страницу: ${problem.message || problem}`; status.hidden = false;
            }
        }
    }
    function dispose() {
        if (disposed) return;
        disposed = true; generation++; clearTimeout(timer);
        root.dataset.ready = 'false'; root.remove();
        for (const cleanup of cleanups) cleanup();
        for (const child of [...children]) release(child);
        if (dv.component?.[stateKey] === handle) delete dv.component[stateKey];
    }
    if (app.vault.on && app.vault.offref) {
        for (const event of ['modify', 'create', 'delete']) {
            const ref = app.vault.on(event, file => {
                if (file?.path !== source) return;
                clearTimeout(timer); timer = setTimeout(() => { if (!disposed) void reload(); }, 80);
            });
            cleanups.push(() => app.vault.offref(ref));
        }
    }
    await reload();
    return handle;
};
