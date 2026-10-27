/* Compact address book. Data stays in the source note, next to its view. */
const START = '<!-- MANANA:CONTACTS\n';
const END = '\nMANANA:CONTACTS -->';
const collator = new Intl.Collator('ru', { sensitivity: 'base', numeric: true });
const normalize = value => String(value).normalize('NFKC').toLocaleLowerCase('ru').replace(/ё/g, 'е');
const sorted = entries => [...entries].sort((a, b) => collator.compare(a.name, b.name));
function readData(raw) {
    const text = String(raw).replace(/\r\n/g, '\n');
    const start = text.indexOf(START), end = text.indexOf(END, start + START.length);
    if (start < 0 || end < 0 || text.indexOf(START, start + START.length) >= 0) throw Error('Не найден единственный блок адресов в заметке.');
    const data = JSON.parse(text.slice(start + START.length, end));
    if (data.version !== 1 || !Array.isArray(data.entries)) throw Error('Неизвестный формат адресов.');
    const ids = new Set();
    for (const row of data.entries) {
        if (!row || typeof row.id !== 'string' || !row.id || ids.has(row.id) || typeof row.name !== 'string' || !row.name.trim() || typeof row.address !== 'string') throw Error('Повреждена запись в списке адресов.');
        ids.add(row.id);
    }
    return data;
}
function writeData(raw, data) {
    readData(raw);
    const eol = raw.includes('\r\n') ? '\r\n' : '\n';
    const startMarker = START.replace(/\n/g, eol), endMarker = END.replace(/\n/g, eol);
    const start = raw.indexOf(startMarker), end = raw.indexOf(endMarker, start + startMarker.length);
    if (start < 0 || end < 0) throw Error('Изменился формат блока адресов.');
    const json = JSON.stringify({ ...data, entries: sorted(data.entries) }, null, 2).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/\n/g, eol);
    return raw.slice(0, start + startMarker.length) + json + raw.slice(end);
}
function changeData(raw, change) {
    const data = readData(raw), rows = data.entries;
    const index = rows.findIndex(row => row.id === change.id);
    if (change.type === 'add') {
        if (index >= 0) throw Error('Такая запись уже существует.');
        rows.push({ id: change.id, name: change.name.trim(), address: change.address.trim() });
    } else {
        if (index < 0) throw Error('Запись уже удалена. Закройте окно и обновите список.');
        const current = rows[index];
        if (current.name !== change.original.name || current.address !== change.original.address) throw Error('Запись уже изменена в другом окне. Закройте это окно и откройте её заново.');
        if (change.type === 'delete') rows.splice(index, 1);
        else if (change.type === 'edit') rows[index] = { ...current, name: change.name.trim(), address: change.address.trim() };
        else throw Error('Неизвестное действие.');
    }
    if (change.type !== 'delete' && !change.name.trim()) throw Error('Укажите имя.');
    return writeData(raw, data);
}
function filterRows(entries, query) {
    const terms = normalize(query).trim().split(/\s+/).filter(Boolean);
    return sorted(entries).filter(row => terms.every(term => normalize(row.name + ' ' + row.address).includes(term)));
}
function isMobileClient(obsidian, doc) {
    if (typeof obsidian.Platform?.isMobile === 'boolean') return obsidian.Platform.isMobile;
    const navigator = doc.defaultView?.navigator;
    return /Android|iPhone|iPad|iPod/i.test(navigator?.userAgent || '')
        || (/Mac/i.test(navigator?.platform || '') && navigator?.maxTouchPoints > 1);
}
function twoGisSearchUri(address) {
    const value = String(address ?? '').trim();
    if (!value) throw Error('Адрес не указан.');
    // Official mobile search URL: https://help.2gis.ru/question/razrabotchikam-zapusk-ideystviya-vmobilnom-prilozhenii-cherez-deeplink
    return 'dgis://2gis.ru/search/' + encodeURIComponent(value);
}
function copyTextNow(doc, text) {
    const focused = doc.activeElement, area = doc.createElement('textarea');
    area.value = text; area.readOnly = true; area.tabIndex = -1;
    area.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none';
    doc.body.append(area);
    try {
        area.focus({ preventScroll: true }); area.select(); area.setSelectionRange?.(0, text.length);
        if (!doc.execCommand?.('copy')) throw Error('Буфер обмена недоступен.');
    } finally { area.remove(); focused?.focus({ preventScroll: true }); }
}
async function activateAddress({ doc, address, mobile = false }) {
    const value = String(address ?? '');
    if (!value.trim()) throw Error('Адрес не указан.');
    const win = doc.defaultView;
    const copyAsync = () => {
        if (!win?.navigator?.clipboard?.writeText) throw Error('Буфер обмена недоступен.');
        return win.navigator.clipboard.writeText(value);
    };
    let copyError = null, mapError = null, mapRequested = false;
    if (mobile) {
        // Keep the external-app launch inside the original tap. Waiting for
        // Clipboard API first can lose mobile browser user activation.
        let copying;
        try { copyTextNow(doc, value); copying = Promise.resolve(); }
        catch (_) {
            try { copying = Promise.resolve(copyAsync()); }
            catch (error) { copying = Promise.reject(error); }
        }
        try {
            if (typeof win?.open !== 'function') throw Error('Запуск приложения недоступен.');
            win.open(twoGisSearchUri(value), '_blank');
            // Native app handlers may return null even on a successful launch.
            mapRequested = true;
        } catch (error) { mapError = error; }
        try { await copying; } catch (error) { copyError = error; }
    } else {
        try { await copyAsync(); }
        catch (_) { try { copyTextNow(doc, value); } catch (error) { copyError = error; } }
    }
    return { copied: !copyError, copyError, mapRequested, mapError };
}

async function render({ dv, app, obsidian = {} }) {
    const doc = dv.container.ownerDocument, component = dv.component;
    const mobile = isMobileClient(obsidian, doc);
    const source = dv.current?.()?.file?.path || 'Развоз Манана мама 3.md';
    const file = app.vault.getAbstractFileByPath(source);
    if (!file) throw Error('Не найдена заметка с адресами.');
    const stateKey = '__mananaTransport';
    let state = component?.[stateKey];
    if (!state) {
        state = { query: '', root: null };
        if (component) {
            component[stateKey] = state;
            const original = component.render;
            const wrapped = function (...args) {
                if (state.root?.parentNode === dv.container && state.root.dataset.ready === 'true') return Promise.resolve();
                return original.apply(this, args);
            };
            if (typeof original === 'function') component.render = wrapped;
            component.register?.(() => {
                state.dispose?.();
                if (component.render === wrapped) component.render = original;
                delete component[stateKey];
            });
        }
    }
    state.dispose?.();
    let disposed = false, root, dialog = null, timer, generation = 0, entries = [];
    const cleanups = [];
    const labelPrefix = 'manana-' + Math.random().toString(36).slice(2);
    let labelSequence = 0;
    function el(parent, tag, cls = '', text) {
        const node = doc.createElement(tag); node.className = cls;
        if (text !== undefined) node.textContent = text;
        parent.append(node); return node;
    }
    function listen(node, event, fn) { node.addEventListener(event, fn); cleanups.push(() => node.removeEventListener(event, fn)); }
    // Obsidian turns aria-label and title into hover tooltips. Use labelledby
    // so controls retain accessible names without showing those popups.
    function accessibleName(control, text, parent = control) {
        const label = el(parent, 'span', 'manana-sr-only', text);
        label.id = labelPrefix + '-' + (++labelSequence);
        control.setAttribute('aria-labelledby', label.id);
    }
    function dispose() {
        if (disposed) return;
        disposed = true; generation++; clearTimeout(timer);
        for (const fn of cleanups.splice(0)) fn();
        dialog?.close(); root?.remove(); if (state.root === root) state.root = null;
    }
    state.dispose = dispose;
    if (!component?.[stateKey]) component?.register?.(dispose);
    try {
        const stylesFile = app.vault.getAbstractFileByPath('Кино/_system/vault_styles.js');
        if (stylesFile) {
            const styles = { exports: {} }; new Function('module', await app.vault.read(stylesFile))(styles);
            await styles.exports({ app, document: doc });
        }
        const cssFile = app.vault.getAbstractFileByPath('Кино/_system/manana-transport.css');
        if (!cssFile) throw Error('Не найдено оформление списка адресов.');
        const css = await app.vault.read(cssFile);
        if (disposed) return;
        root = el(dv.container, 'section', 'manana-ui'); state.root = root;
        el(root, 'style', '', css);
        const head = el(root, 'header', 'manana-head');
        el(head, 'p', 'manana-eyebrow', 'АДРЕСА · МАНАНА МАМА');
        el(head, 'h1', 'manana-title', 'Развоз');
        const toolbar = el(root, 'div', 'manana-toolbar');
        const searchWrap = el(toolbar, 'div', 'manana-search');
        const searchIcon = el(searchWrap, 'span', 'manana-search-icon');
        icon(searchIcon, 'search', '⌕'); searchIcon.setAttribute('aria-hidden', 'true');
        const search = el(searchWrap, 'input');
        search.type = 'search'; search.placeholder = 'Поиск по имени или адресу'; search.value = state.query;
        accessibleName(search, 'Поиск по имени или адресу', searchWrap); search.autocomplete = 'off';
        const clear = iconButton(searchWrap, 'circle-x', '⊗', 'Очистить поиск', 'manana-search-clear');
        clear.hidden = !search.value.length;
        const add = iconButton(toolbar, 'plus', '+', 'Добавить человека', 'manana-add');
        add.setAttribute('aria-haspopup', 'dialog');
        const rows = el(root, 'div', 'manana-list'); rows.setAttribute('role', 'list'); accessibleName(rows, 'Адреса для развоза', root);
        const status = el(root, 'div', 'manana-status'); status.setAttribute('role', 'status');
        const counter = el(status, 'span', 'manana-counter');
        const statusMessage = el(status, 'span', 'manana-status-message');
        function message(text, error = false) { if (!disposed) { statusMessage.textContent = text; status.classList.toggle('is-error', error); } }
        function icon(node, name, fallback) {
            if (obsidian.setIcon) obsidian.setIcon(node, name); else node.textContent = fallback;
        }
        function iconButton(parent, name, fallback, label, cls = '') {
            const button = el(parent, 'button', 'manana-icon-button ' + cls);
            button.type = 'button';
            icon(button, name, fallback); accessibleName(button, label); return button;
        }
        function paint() {
            const visible = filterRows(entries, state.query);
            rows.replaceChildren(); counter.textContent = state.query.trim() ? `Найдено: ${visible.length} из ${entries.length}` : `Всего: ${entries.length}`;
            clear.hidden = !search.value.length;
            if (!visible.length) el(rows, 'p', 'manana-empty', entries.length ? 'Ничего не найдено. Попробуйте другое имя или адрес.' : 'Список пуст. Добавьте первого человека кнопкой +.');
            for (const entry of visible) {
                const row = el(rows, 'div', 'manana-row'); row.setAttribute('role', 'listitem');
                const name = el(row, 'button', 'manana-name', entry.name); name.type = 'button';
                accessibleName(name, entry.address ? (mobile ? 'Скопировать адрес и открыть в 2ГИС: ' : 'Скопировать адрес: ') + entry.name : 'Добавить адрес: ' + entry.name);
                name.addEventListener('click', () => entry.address ? void copyAddress(entry) : openDialog('edit', entry, name));
                el(row, 'span', 'manana-address' + (entry.address ? '' : ' is-missing'), entry.address || 'Адрес не указан');
                const actions = el(row, 'div', 'manana-row-actions');
                const edit = iconButton(actions, 'pencil', '✎', 'Редактировать: ' + entry.name);
                const remove = iconButton(actions, 'trash-2', '×', 'Удалить: ' + entry.name, 'manana-delete');
                edit.setAttribute('aria-haspopup', 'dialog'); remove.setAttribute('aria-haspopup', 'dialog');
                edit.addEventListener('click', () => openDialog('edit', entry, edit));
                remove.addEventListener('click', () => openDialog('delete', entry, remove));
            }
        }
        async function refresh() {
            const current = ++generation;
            try {
                const data = readData(await app.vault.read(file));
                if (disposed || current !== generation) return;
                entries = data.entries; paint();
            } catch (error) { if (!disposed && current === generation) message('Не удалось прочитать адреса: ' + error.message, true); }
        }
        async function copyAddress(entry) {
            if (disposed) return;
            try {
                const result = await activateAddress({ doc, address: entry.address, mobile });
                if (disposed) return;
                if (!result.copied) {
                    const copyFailure = 'Не удалось скопировать адрес: ' + (result.copyError.message || String(result.copyError));
                    const mapResult = result.mapRequested ? ' · адрес передан в 2ГИС' : result.mapError ? ' · не удалось открыть 2ГИС: ' + (result.mapError.message || String(result.mapError)) : '';
                    message(copyFailure + mapResult, true);
                } else if (result.mapError) {
                    message('Адрес скопирован. Не удалось открыть 2ГИС: ' + (result.mapError.message || String(result.mapError)), true);
                } else {
                    message((result.mapRequested ? 'Адрес скопирован · отправлен в 2ГИС: ' : 'Адрес скопирован: ') + entry.name);
                }
            } catch (error) { message('Не удалось скопировать адрес: ' + error.message, true); }
        }
        function openDialog(mode, entry, trigger) {
            if (disposed) return;
            if (dialog) { dialog.nameInput?.focus(); return; }
            if (!obsidian.Modal) { message('Не удалось открыть окно редактирования.', true); return; }
            const original = entry ? { ...entry } : null;
            class ContactModal extends obsidian.Modal {
                onOpen() {
                    this.modalEl.classList.add('kino-page', 'manana-modal');
                    el(this.contentEl, 'style', '', css);
                    this.titleEl.textContent = mode === 'add' ? 'Добавить человека' : mode === 'edit' ? 'Редактировать запись' : 'Удалить запись?';
                    const form = el(this.contentEl, 'form', 'manana-form'); form.noValidate = true;
                    if (mode === 'delete') {
                        el(form, 'p', 'manana-delete-name', original.name);
                        el(form, 'p', 'manana-dialog-description', original.address || 'Адрес не указан');
                    } else {
                        const field = (title, value, placeholder) => {
                            const label = el(form, 'label', 'manana-field'); el(label, 'span', '', title);
                            const input = el(label, 'input'); input.type = 'text'; input.value = value || ''; input.placeholder = placeholder;
                            input.autocomplete = 'off'; return input;
                        };
                        this.nameInput = field('Имя', original?.name, 'Фамилия Имя');
                        this.nameInput.required = true;
                        this.addressInput = field('Адрес', original?.address, 'Улица, дом, квартира');
                    }
                    const errorText = el(form, 'p', 'manana-form-error'); errorText.setAttribute('role', 'alert');
                    const actions = el(form, 'div', 'manana-dialog-actions');
                    const cancel = el(actions, 'button', '', 'Отмена'); cancel.type = 'button'; cancel.addEventListener('click', () => this.close());
                    const save = el(actions, 'button', mode === 'delete' ? 'is-danger' : 'is-primary', mode === 'delete' ? 'Удалить' : 'Сохранить'); save.type = 'submit';
                    form.addEventListener('submit', async event => {
                        event.preventDefault(); if (this.saving) return;
                        const name = this.nameInput?.value.trim(), address = this.addressInput?.value.trim();
                        if (mode !== 'delete' && !name) { errorText.textContent = 'Укажите имя.'; this.nameInput.focus(); return; }
                        const change = { type: mode, id: original?.id || (doc.defaultView.crypto?.randomUUID?.() ?? 'contact-' + Date.now() + '-' + Math.random().toString(36).slice(2)), original, name, address };
                        this.saving = true; errorText.textContent = '';
                        for (const control of form.querySelectorAll('input,button')) control.disabled = true;
                        form.setAttribute('aria-busy', 'true');
                        try {
                            await app.vault.process(file, raw => changeData(raw, change));
                            this.saving = false; this.close();
                            await refresh();
                            message(mode === 'delete' ? 'Удалена запись: ' + original.name : 'Сохранено: ' + name);
                        } catch (error) {
                            this.saving = false; errorText.textContent = 'Не удалось сохранить: ' + error.message;
                            for (const control of form.querySelectorAll('input,button')) control.disabled = false;
                            form.removeAttribute('aria-busy');
                        }
                    });
                    // Cancellation is the default focus for destructive actions.
                    if (mode === 'delete') cancel.focus(); else this.nameInput.focus();
                }
                close() { if (!this.saving) super.close(); }
                onClose() {
                    if (dialog === this) dialog = null;
                    this.contentEl.replaceChildren();
                    if (!disposed) (trigger?.isConnected ? trigger : search).focus();
                }
            }
            dialog = new ContactModal(app); dialog.open();
        }
        listen(search, 'input', () => { state.query = search.value; paint(); });
        function clearSearch() { search.value = state.query = ''; paint(); search.focus(); }
        listen(clear, 'click', clearSearch);
        listen(search, 'keydown', event => {
            if (event.key === 'Escape' && search.value) { event.preventDefault(); clearSearch(); }
        });
        listen(add, 'click', () => openDialog('add', null, add));
        await refresh(); if (disposed) return;
        if (app.vault.on) {
            const ref = app.vault.on('modify', changed => { if (changed === file || changed.path === file.path) { clearTimeout(timer); timer = setTimeout(() => void refresh(), 80); } });
            cleanups.push(() => app.vault.offref(ref));
        }
        root.dataset.ready = 'true';
        return { dispose };
    } catch (error) { dispose(); throw error; }
}
module.exports = render;
module.exports.readData = readData;
module.exports.writeData = writeData;
module.exports.changeData = changeData;
module.exports.filterRows = filterRows;
module.exports.isMobileClient = isMobileClient;
module.exports.twoGisSearchUri = twoGisSearchUri;
module.exports.activateAddress = activateAddress;
