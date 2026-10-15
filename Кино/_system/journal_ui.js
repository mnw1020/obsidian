const PATH = 'Кино/_system/Журнал изменений.md';
const BACKUPS = 'Кино/_system/redesign-backups';

function ensureLayout(raw) {
    let text = String(raw).replace(/^\ufeff/, '').replace(/\r\n/g, '\n');
    const frontmatter = text.match(/^---\n([\s\S]*?)\n---(?:\n|$)/);
    let yaml = frontmatter?.[1] || '', body = frontmatter ? text.slice(frontmatter[0].length) : text;
    yaml = /^obsidianUIMode:/m.test(yaml)
        ? yaml.replace(/^obsidianUIMode:[^\n]*/m, 'obsidianUIMode: preview')
        : (yaml ? yaml + '\n' : '') + 'obsidianUIMode: preview';
    const classes = ['kino-page', 'kino-system', 'kino-home-page', 'kino-report-page', 'kino-journal-page'];
    const existing = yaml.match(/^cssclasses:[^\n]*(?:\n[ \t]+-[^\n]*)*/m);
    if (existing) {
        const value = existing[0].slice('cssclasses:'.length).trim();
        let values;
        try { values = JSON.parse(value); }
        catch { values = value.startsWith('[') ? value.slice(1, -1).split(',') : value.split('\n').map(line => line.replace(/^\s*-\s*/, '')); }
        for (const item of Array.isArray(values) ? values : [values]) {
            const name = String(item).trim().replace(/^['"]|['"]$/g, '');
            if (name && !classes.includes(name)) classes.push(name);
        }
    }
    const replacement = 'cssclasses: ' + JSON.stringify(classes);
    yaml = existing ? yaml.replace(existing[0], replacement) : yaml + '\n' + replacement;
    const loader = ['<!-- KINO:UI:START -->', '```dataviewjs', 'try {',
        '    const file = app.vault.getAbstractFileByPath("Кино/_system/journal_ui.js");',
        '    if (!file) throw new Error("Не найден интерфейс журнала");',
        '    const mod = { exports: {} };',
        '    new Function("module", await app.vault.read(file))(mod);',
        '    await mod.exports({ dv, app, obsidian: typeof require === "function" ? require("obsidian") : {} });',
        '} catch (error) { dv.paragraph("Не удалось загрузить журнал: " + (error.message || error)); }',
        '```', '<!-- KINO:UI:END -->'].join('\n');
    const region = /<!-- KINO:UI:START -->[\s\S]*?<!-- KINO:UI:END -->/;
    body = region.test(body) ? body.replace(region, loader) : loader + '\n\n' + body.trimStart();
    return '---\n' + yaml + '\n---\n' + body;
}

function maskedSource(raw) {
    return String(raw).replace(/\r\n/g, '\n')
        .replace(/^\ufeff?---\n[\s\S]*?\n---(?:\n|$)/, match => match.replace(/[^\n]/g, ' '))
        .replace(/<!-- KINO:UI:START -->[\s\S]*?<!-- KINO:UI:END -->/, match => match.replace(/[^\n]/g, ' '));
}

function entries(raw) {
    const source = String(raw).replace(/\r\n/g, '\n');
    const matches = [...maskedSource(raw).matchAll(/^(?:<!-- KINO-AUDIT-EVENT[^\n]*-->\n\s*)?##[ \t]+([^\n]+)(?:\n|$)/gm)];
    return matches.map((match, index) => {
        const at = match[0].match(/\bat="([^"]+)"/)?.[1] || '';
        return { title: match[1].trim(), at, key: at + ':' + index,
            body: source.slice(match.index + match[0].length, matches[index + 1]?.index ?? source.length).trim() };
    });
}

function clearEntries(raw) {
    const source = String(raw).replace(/\r\n/g, '\n');
    const first = maskedSource(raw).search(/^<!-- KINO-AUDIT-EVENT[^\n]*-->|^##[ \t]+/m);
    return first < 0 ? source : source.slice(0, first).trimEnd() + '\n';
}

async function clearJournal(app) {
    const file = app.vault.getAbstractFileByPath(PATH);
    if (!file) throw Error('Не найден журнал изменений');
    const raw = await app.vault.read(file), list = entries(raw);
    if (!list.length) return { cleared: 0, backupPath: null };
    if (typeof app.vault.process !== 'function') throw Error('Для очистки требуется Vault.process. Обновите Obsidian.');
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = BACKUPS + '/journal-' + stamp + '-' + Math.random().toString(36).slice(2, 10) + '.md';
    await app.vault.create(backupPath, raw);
    await app.vault.process(file, current => {
        if (current !== raw) throw Error('Журнал изменился во время сохранения копии. Нажмите «Почистить» ещё раз.');
        return clearEntries(current);
    });
    return { cleared: list.length, backupPath };
}

async function render({ dv, app, obsidian = {} }) {
    // Load collection CSS even when the startup plugin is unavailable on mobile.
    try {
        const styleFile = app.vault.getAbstractFileByPath("Кино/_system/vault_styles.js");
        if (styleFile) {
            const styles = { exports: {} };
            new Function("module", await app.vault.read(styleFile))(styles);
            await styles.exports({ app, document: dv.container.ownerDocument });
        }
    } catch (error) { console.warn("Не удалось подключить оформление коллекций", error); }

    const component = dv.component, doc = dv.container.ownerDocument, key = '__kinoJournal';
    const currentPath = dv.current?.()?.file?.path;
    const archived = typeof currentPath === 'string' && currentPath.startsWith(BACKUPS + '/journal-');
    const notePath = archived ? currentPath : PATH;
    let state = component?.[key];
    if (!state) {
        state = { folds: {} };
        if (component) {
            component[key] = state;
            const original = component.render;
            if (typeof original === 'function') {
                const wrapped = function (...args) {
                    if (state.root?.parentNode === dv.container && state.root.dataset.ready === 'true') return Promise.resolve();
                    return original.apply(this, args);
                };
                component.render = wrapped;
                component.register?.(() => { if (component.render === wrapped) component.render = original; delete component[key]; });
            }
        }
    }
    state.dispose?.();
    let root, disposed = false, timer, generation = 0, busy = false, count = 0;
    const cleanups = [], rows = new Set();
    function el(parent, tag, cls = '', text) {
        const node = doc.createElement(tag); node.className = cls;
        if (text !== undefined) node.textContent = String(text);
        parent.append(node); return node;
    }
    function listen(node, event, callback, list = cleanups) {
        node.addEventListener(event, callback); list.push(() => node.removeEventListener(event, callback));
    }
    function release(row) {
        if (!rows.delete(row)) return;
        for (const cleanup of row.cleanups) cleanup();
        if (row.child) {
            if (component?.removeChild) component.removeChild(row.child);
            else row.child.unload?.();
        }
    }
    function clearRows() { for (const row of [...rows]) release(row); }
    function dispose() {
        if (disposed) return;
        disposed = true; generation++; clearTimeout(timer); clearRows();
        for (const cleanup of cleanups.splice(0)) cleanup();
        root?.remove(); if (state.root === root) state.root = null;
    }
    state.dispose = dispose; component?.register?.(dispose);
    function link(parent, label, path) {
        const node = el(parent, 'a', 'internal-link', label); node.href = path;
        listen(node, 'click', event => { event.preventDefault(); const target = node.getAttribute('href'); if (target) app.workspace.openLinkText(target, notePath, Boolean(event.ctrlKey || event.metaKey)); });
        return node;
    }
    try {
        const styles = [];
        for (const name of ['kino-home.css', 'kino-statistics.css', 'kino-journal.css']) {
            const file = app.vault.getAbstractFileByPath('Кино/_system/' + name);
            if (!file) throw Error('Не найден стиль журнала');
            styles.push(await app.vault.read(file)); if (disposed) return { dispose };
        }
        root = el(dv.container, 'section', 'kino-home-ui kino-report kino-journal'); state.root = root;
        el(root, 'style', '', styles.join('\n'));
        const head = el(root, 'header', 'kino-home-masthead'), nav = el(head, 'nav', 'kino-home-nav');
        link(nav, '← Кинотека', 'Кино/_index');
        link(nav, 'Проверка кинотеки', 'Кино/_system/Проверка кинотеки');
        link(nav, 'Исключения', 'Кино/_system/Исключения');
        el(head, 'h1', 'kino-home-title', archived ? 'Копия журнала изменений' : 'Журнал изменений');
        el(head, 'p', 'kino-journal-description', archived ? 'Записи, сохранённые перед очисткой журнала.' : 'История обслуживания кинотеки. Новые записи появляются сверху.');
        const actions = el(head, 'div', 'kino-home-actions');
        const button = el(actions, 'button', 'kino-home-action kino-journal-clear', 'Почистить'); button.type = 'button'; button.disabled = true;
        button.hidden = archived;
        button.title = 'Удалить записи журнала, сохранив резервную копию';
        const total = el(actions, 'span', 'kino-journal-total'); el(total, 'span', '', 'Записей: ');
        const counter = el(total, 'span', 'kino-journal-count', '0');
        const status = el(head, 'p', 'kino-journal-status'); status.setAttribute('role', 'status'); status.hidden = true;
        const archive = link(head, 'Открыть копию', ''); archive.classList.add('kino-journal-backup'); archive.hidden = true;
        const content = el(root, 'div', 'kino-journal-content');
        async function refresh() {
            const current = ++generation;
            try {
                const file = app.vault.getAbstractFileByPath(notePath);
                if (!file) throw Error('Не найден журнал изменений');
                const raw = await app.vault.read(file);
                if (disposed || current !== generation) return;
                const list = entries(raw).reverse();
                count = list.length; counter.textContent = String(count); button.disabled = busy || !count;
                clearRows(); content.replaceChildren();
                if (!count) {
                    const empty = el(content, 'div', 'kino-report-section kino-journal-empty');
                    el(empty, 'h2', '', 'Журнал пуст');
                    el(empty, 'p', '', 'Новые записи появятся после обслуживания кинотеки.');
                }
                for (const entry of list) {
                    if (disposed || current !== generation) return;
                    const row = { cleanups: [], child: null }; rows.add(row);
                    const box = el(content, 'details', 'kino-report-section kino-journal-entry');
                    box.dataset.entry = entry.key; box.open = state.folds[entry.key] ?? true;
                    const summary = el(box, 'summary'); el(summary, 'span', '', entry.title);
                    el(summary, 'span', 'kino-home-fold-chevron').setAttribute('aria-hidden', 'true');
                    listen(box, 'toggle', event => { if (event.target === box) state.folds[entry.key] = box.open; }, row.cleanups);
                    const body = el(box, 'div', 'kino-report-body');
                    if (obsidian.MarkdownRenderer?.render && obsidian.Component && component?.addChild) {
                        const child = new obsidian.Component(); row.child = child;
                        let ended = false;
                        const register = child.register?.bind(child), unload = child.unload?.bind(child), addChild = child.addChild?.bind(child);
                        if (register) child.register = callback => { if (ended || disposed) { callback(); return callback; } return register(callback); };
                        child.unload = () => { if (ended) return; ended = true; return unload?.(); };
                        if (addChild) child.addChild = nested => { if (ended || disposed) { nested.load?.(); nested.unload?.(); return nested; } return addChild(nested); };
                        component.addChild(child);
                        await obsidian.MarkdownRenderer.render(app, entry.body, body, notePath, child);
                        if (disposed || current !== generation) { release(row); return; }
                    } else el(body, 'pre', 'kino-journal-fallback', entry.body);
                }
            } catch (error) {
                if (!disposed && current === generation) { button.disabled = true; status.hidden = false; status.textContent = 'Не удалось прочитать журнал: ' + (error.message || error); }
            }
        }
        listen(button, 'click', async () => {
            if (busy || disposed || !count || archived) return;
            busy = true; button.disabled = true; status.hidden = false; status.textContent = 'Сохраняем копию и очищаем журнал…'; archive.hidden = true;
            try {
                const result = await clearJournal(app);
                if (disposed) return;
                await refresh();
                if (disposed) return;
                status.textContent = result.cleared ? 'Журнал очищен. Резервная копия сохранена.' : 'Журнал уже пуст.';
                if (result.backupPath) { archive.href = result.backupPath; archive.hidden = false; }
            } catch (error) {
                if (!disposed) { await refresh(); status.textContent = 'Не удалось очистить журнал: ' + (error.message || error); }
            } finally { busy = false; if (!disposed) button.disabled = !count; }
        });
        await refresh(); if (disposed) return { dispose };
        if (app.vault.on) {
            const ref = app.vault.on('modify', file => { if (file.path === notePath) { clearTimeout(timer); timer = setTimeout(() => void refresh(), 100); } });
            cleanups.push(() => app.vault.offref?.(ref));
        }
        root.dataset.ready = 'true'; return { dispose };
    } catch (error) { dispose(); throw error; }
}

module.exports = render;
module.exports.ensureLayout = ensureLayout;
module.exports.entries = entries;
module.exports.clearEntries = clearEntries;
module.exports.clearJournal = clearJournal;
