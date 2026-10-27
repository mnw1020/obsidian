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
async function copyAddressText({ doc, address, mobile = false }) {
    const value = String(address ?? '');
    if (!value.trim()) throw Error('Адрес не указан.');
    const win = doc.defaultView;
    const copyAsync = () => {
        if (!win?.navigator?.clipboard?.writeText) throw Error('Буфер обмена недоступен.');
        return win.navigator.clipboard.writeText(value);
    };
    let copyError = null;
    if (mobile) {
        try { copyTextNow(doc, value); }
        catch (_) {
            try { await copyAsync(); } catch (error) { copyError = error; }
        }
    } else {
        try { await copyAsync(); }
        catch (_) { try { copyTextNow(doc, value); } catch (error) { copyError = error; } }
    }
    return { copied: !copyError, copyError };
}

async function render({ dv, app, obsidian = {} }) {
    const doc = dv.container.ownerDocument, component = dv.component;
    const mobile = isMobileClient(obsidian, doc);
    const tripEnabled = true;
    const source = dv.current?.()?.file?.path || 'Развоз Манана мама 3.md';
    const file = app.vault.getAbstractFileByPath(source);
    if (!file) throw Error('Не найдена заметка с адресами.');
    const stateKey = '__mananaTransport';
    let state = component?.[stateKey];
    if (!state) {
        state = { query: '', root: null, tripExpanded: true };
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
    let tripApi = null, tripStore = null, locationResolver = null, tripInitError = null, mapInitError = null, tripPreparing = false;
    const locations = [];
    const tripStorageKey = 'manana.trip.v1:' + (app.vault.getName?.() || 'obsidian') + ':' + source;
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
        let css = await app.vault.read(cssFile), cssGeneration = 0;
        if (tripEnabled) {
            try {
                const helper = app.vault.getAbstractFileByPath('Кино/_system/manana_trip.js');
                if (!helper) throw Error('Не найден список адресов.');
                const tripModule = { exports: {} };
                new Function('module', await app.vault.read(helper))(tripModule);
                tripApi = tripModule.exports;
                tripStore = tripApi.createTripStore({ storage: doc.defaultView.localStorage, key: tripStorageKey, getEntries: () => entries, locations, maxStops: 5 });
            } catch (error) { tripInitError = error; }
            try {
                const paths = ['manana_geocode.js', 'manana_locations.json'];
                const contents = await Promise.all(paths.map(async name => {
                    const helper = app.vault.getAbstractFileByPath('Кино/_system/' + name);
                    if (!helper) throw Error('Не найден файл поездки: ' + name);
                    return app.vault.read(helper);
                }));
                const geoModule = { exports: {} };
                new Function('module', contents[0])(geoModule);
                const cache = JSON.parse(contents[1]);
                if (cache.version !== 1 || !Array.isArray(cache.entries)) throw Error('Неизвестный формат точек поездки.');
                locations.push(...cache.entries);
                locationResolver = geoModule.exports.createLocationResolver({ app, obsidian, records: locations });
            } catch (error) { mapInitError = error; }
        }
        if (disposed) return;
        root = el(dv.container, 'section', 'manana-ui'); state.root = root;
        const uiStyle = el(root, 'style', '', css);
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
        const searchAdd = iconButton(searchWrap, 'plus', '+', 'Добавить введённый адрес в список', 'manana-search-add');
        searchAdd.hidden = !search.value.trim();
        const clear = iconButton(searchWrap, 'circle-x', '⊗', 'Очистить поиск', 'manana-search-clear');
        clear.hidden = !search.value.length;
        const add = iconButton(toolbar, 'plus', '+', 'Добавить человека', 'manana-add');
        add.setAttribute('aria-haspopup', 'dialog');
        const tripPanel = el(root, 'section', 'manana-trip'); tripPanel.hidden = true;
        const tripHead = el(tripPanel, 'div', 'manana-trip-head');
        const tripToggle = el(tripHead, 'button', 'manana-trip-toggle'); tripToggle.type = 'button';
        const tripActions = el(tripHead, 'div', 'manana-trip-actions');
        const tripOpen = iconButton(tripActions, 'map-pinned', '↗', 'Открыть маршрут в 2ГИС', 'manana-trip-2gis');
        const tripYandex = iconButton(tripActions, 'navigation', '➤', 'Открыть маршрут в Яндекс Навигаторе', 'manana-trip-yandex');
        const tripOrganicPoints = iconButton(tripActions, 'map', '▧', 'Organic Maps: показать все адреса метками', 'manana-trip-organic-points');
        const tripUndo = iconButton(tripActions, 'undo-2', '↶', 'Удалить последний адрес из списка');
        const tripReset = iconButton(tripActions, 'trash-2', '×', 'Удалить все адреса из списка');
        const tripList = el(tripPanel, 'ol', 'manana-trip-stops'); tripList.id = labelPrefix + '-trip-stops';
        let tripDrag = null;
        cleanups.push(() => cancelTripDrag());
        tripToggle.setAttribute('aria-controls', tripList.id);
        const status = el(root, 'div', 'manana-status'); status.setAttribute('role', 'status');
        const counter = el(status, 'span', 'manana-counter');
        const statusMessage = el(status, 'span', 'manana-status-message');
        const rows = el(root, 'div', 'manana-list'); rows.setAttribute('role', 'list'); accessibleName(rows, 'Адреса для развоза', root);
        function message(text, error = false) { if (!disposed) { statusMessage.textContent = text; status.classList.toggle('is-error', error); } }
        function icon(node, name, fallback) {
            if (obsidian.setIcon) obsidian.setIcon(node, name); else node.textContent = fallback;
        }
        function iconButton(parent, name, fallback, label, cls = '') {
            const button = el(parent, 'button', 'manana-icon-button ' + cls);
            button.type = 'button';
            icon(button, name, fallback); accessibleName(button, label); return button;
        }
        function addressCount(count) { return count + (count === 1 ? ' адрес' : count >= 2 && count <= 4 ? ' адреса' : ' адресов'); }
        function paintTrip() {
            if (disposed || !tripEnabled) return;
            cancelTripDrag();
            try {
                if (tripInitError) throw tripInitError;
                const selected = tripStore.read();
                tripPanel.hidden = selected.stops.length === 0;
                tripToggle.textContent = 'Список: ' + addressCount(selected.stops.length);
                tripToggle.setAttribute('aria-expanded', String(Boolean(state.tripExpanded)));
                tripList.hidden = !state.tripExpanded;
                tripList.replaceChildren();
                for (const stop of selected.stops) {
                    const entry = entries.find(item => item.id === stop.id);
                    const item = el(tripList, 'li');
                    item.dataset.stopId = stop.id;
                    const line = el(item, 'div', 'manana-trip-stop');
                    const text = el(line, 'div', 'manana-trip-stop-text');
                    el(text, 'span', '', entry?.name || stop.address);
                    if (entry?.name) el(text, 'span', 'manana-trip-address', stop.address);
                    const handle = iconButton(line, 'grip-vertical', '⠿', 'Перетащить адрес: ' + (entry?.name || stop.address) + '. Стрелки вверх и вниз меняют порядок.', 'manana-trip-drag');
                    handle.disabled = selected.stops.length < 2;
                }
                const overLimit = selected.stops.length > 5;
                tripOpen.disabled = tripPreparing || !selected.stops.length || overLimit;
                tripYandex.disabled = tripPreparing || !selected.stops.length || overLimit;
                tripOrganicPoints.disabled = tripPreparing || !selected.stops.length || overLimit;
                tripUndo.disabled = !selected.stops.length;
                tripReset.disabled = false;
                if (overLimit) message('В списке больше 5 адресов. Удалите лишние адреса или очистите список.', true);
            } catch (error) {
                tripPanel.hidden = false; tripToggle.textContent = 'Список недоступен';
                tripList.hidden = true; tripOpen.disabled = tripYandex.disabled = tripOrganicPoints.disabled = tripUndo.disabled = true; tripReset.disabled = !tripStore;
                message(error.message || String(error), true);
            }
        }
        function notifyTrip() {
            paintTrip();
            doc.defaultView.dispatchEvent(new doc.defaultView.CustomEvent('manana-trip-change', { detail: tripStorageKey }));
        }
        function cancelTripDrag() {
            const drag = tripDrag;
            if (!drag) return;
            tripDrag = null;
            if (drag.handle.hasPointerCapture?.(drag.pointerId)) drag.handle.releasePointerCapture(drag.pointerId);
            drag.item.classList.remove('is-dragging');
            tripList.classList.remove('is-reordering');
            for (const item of drag.original) tripList.append(item);
        }
        function saveTripOrder(ids, revision, focusId) {
            try {
                tripStore.reorder(ids, revision); notifyTrip(); message('Порядок адресов сохранён.');
            } catch (error) { paintTrip(); message(error.message || String(error), true); }
            for (const item of tripList.children) {
                if (item.dataset.stopId === focusId) item.querySelector('.manana-trip-drag')?.focus({ preventScroll: true });
            }
        }
        listen(tripList, 'pointerdown', event => {
            const handle = event.target.closest?.('.manana-trip-drag');
            if (!handle || handle.disabled || event.button !== 0 || event.isPrimary === false || tripDrag || !tripStore) return;
            try {
                const selected = tripStore.read(), original = [...tripList.children];
                if (selected.stops.map(stop => stop.id).join('\n') !== original.map(item => item.dataset.stopId).join('\n')) { paintTrip(); return; }
                tripDrag = { handle, item: handle.closest('li'), pointerId: event.pointerId,
                    startY: event.clientY, active: false, original, revision: selected.revision };
                handle.setPointerCapture?.(event.pointerId);
            } catch (error) { cancelTripDrag(); message(error.message || String(error), true); }
        });
        listen(doc, 'pointermove', event => {
            const drag = tripDrag;
            if (!drag || event.pointerId !== drag.pointerId) return;
            if (!drag.active && Math.abs(event.clientY - drag.startY) < 5) return;
            drag.active = true;
            if (event.cancelable) event.preventDefault();
            drag.item.classList.add('is-dragging'); tripList.classList.add('is-reordering');
            const others = [...tripList.children].filter(item => item !== drag.item);
            const before = others.find(item => { const rect = item.getBoundingClientRect(); return event.clientY < rect.top + rect.height / 2; });
            if (drag.item.nextElementSibling !== (before || null)) {
                tripList.insertBefore(drag.item, before || null);
                drag.handle.setPointerCapture?.(drag.pointerId);
            }
        });
        listen(doc, 'pointerup', event => {
            const drag = tripDrag;
            if (!drag || event.pointerId !== drag.pointerId) return;
            const ids = [...tripList.children].map(item => item.dataset.stopId);
            cancelTripDrag();
            if (drag.active) saveTripOrder(ids, drag.revision, drag.item.dataset.stopId);
        });
        listen(doc, 'pointercancel', event => { if (tripDrag?.pointerId === event.pointerId) cancelTripDrag(); });
        listen(doc.defaultView, 'blur', cancelTripDrag);
        listen(doc, 'keydown', event => {
            if (event.key === 'Escape' && tripDrag) { event.preventDefault(); cancelTripDrag(); }
        });
        listen(tripList, 'keydown', event => {
            const handle = event.target.closest?.('.manana-trip-drag');
            if (!handle || handle.disabled || !['ArrowUp', 'ArrowDown'].includes(event.key)) return;
            event.preventDefault(); cancelTripDrag();
            try {
                const selected = tripStore.read(), ids = selected.stops.map(stop => stop.id);
                const id = handle.closest('li').dataset.stopId, from = ids.indexOf(id), to = from + (event.key === 'ArrowUp' ? -1 : 1);
                if (from < 0 || to < 0 || to >= ids.length) return;
                [ids[from], ids[to]] = [ids[to], ids[from]];
                saveTripOrder(ids, selected.revision, id);
            } catch (error) { paintTrip(); message(error.message || String(error), true); }
        });
        function mapProvider(provider) {
            const providers = {
                '2gis': { name: '2ГИС', build: tripApi?.buildTwoGisRouteUri },
                yandex: { name: 'Яндекс Навигатор', build: tripApi?.buildYandexNavigatorUri },
                'organic-points': { name: 'Organic Maps', build: tripApi?.buildOrganicMapsPointsUri }
            };
            const selected = providers[provider];
            if (!selected || typeof selected.build !== 'function') throw Error('Не найден способ открытия карты.');
            return selected;
        }
        async function prepareMapPoints(provider, addresses) {
            tripPreparing = true; paintTrip();
            const mapName = mapProvider(provider).name;
            message('Готовим точки маршрута для ' + mapName + '…');
            try {
                await locationResolver.ensure(addresses);
                if (disposed) return;
                if (tripStore.read().stops.length) message('Точки готовы. Нажмите значок ' + mapName + ', чтобы открыть маршрут.');
            } catch (error) {
                message('Не удалось подготовить маршрут: ' + (error.message || error), true);
            } finally { tripPreparing = false; if (!disposed) paintTrip(); }
        }
        function openTrip(provider) {
            if (disposed || tripPreparing || !tripStore) return;
            try {
                const current = tripStore.read();
                if (current.stops.length > 5) throw Error('В списке может быть не больше 5 адресов.');
                if (mapInitError) throw mapInitError;
                const selected = mapProvider(provider), uri = selected.build(current.stops, locations);
                doc.defaultView.open(uri, '_blank');
                message((provider === 'organic-points' ? 'Адреса переданы в ' : 'Маршрут передан в ') + selected.name + ': ' + addressCount(current.stops.length));
            } catch (error) {
                if (error.code === 'MISSING_LOCATION' && locationResolver) { void prepareMapPoints(provider, error.addresses); return; }
                message('Не удалось открыть маршрут: ' + (error.message || error), true);
            }
        }
        function paint() {
            const visible = filterRows(entries, state.query);
            rows.replaceChildren(); counter.textContent = state.query.trim() ? `Найдено: ${visible.length} из ${entries.length}` : `Всего: ${entries.length}`;
            clear.hidden = !search.value.length;
            searchAdd.hidden = !search.value.trim();
            if (!visible.length) el(rows, 'p', 'manana-empty', entries.length ? 'Ничего не найдено. Попробуйте другое имя или адрес.' : 'Список пуст. Добавьте первого человека кнопкой +.');
            for (const entry of visible) {
                const row = el(rows, 'div', 'manana-row'); row.setAttribute('role', 'listitem');
                const name = el(row, 'button', 'manana-name', entry.name); name.type = 'button';
                accessibleName(name, entry.address ? 'Скопировать адрес и добавить в список: ' + entry.name : 'Добавить адрес: ' + entry.name);
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
                entries = data.entries; paint(); paintTrip();
            } catch (error) { if (!disposed && current === generation) message('Не удалось прочитать адреса: ' + error.message, true); }
        }
        async function copyAddress(entry) {
            if (disposed) return;
            const copying = copyAddressText({ doc, address: entry.address, mobile });
            let selection = null, selectionError = null;
            try {
                if (tripInitError) throw tripInitError;
                if (tripStore) selection = tripStore.add(entry);
                if (selection) {
                    state.tripExpanded = true;
                    notifyTrip();
                    if (locationResolver && !locations.some(point => tripApi.normalizeAddress(point.address) === tripApi.normalizeAddress(entry.address))) {
                        void locationResolver.ensure([entry.address]).catch(() => {});
                    }
                }
            } catch (error) { selectionError = error; }
            const result = await copying;
            if (disposed) return;
            const parts = [result.copied ? 'Адрес скопирован' : 'Не удалось скопировать адрес: ' + (result.copyError.message || String(result.copyError))];
            if (selectionError) parts.push('Не удалось добавить в список: ' + (selectionError.message || String(selectionError)));
            else if (selection) parts.push('в списке ' + addressCount(selection.state.stops.length));
            message(parts.join(' · '), !result.copied || Boolean(selectionError));
        }
        function addSearchAddress() {
            if (disposed) return;
            const address = search.value.trim();
            if (!address) return;
            try {
                if (tripInitError) throw tripInitError;
                const selection = tripStore.addCustom(address);
                state.tripExpanded = true;
                notifyTrip();
                if (locationResolver && !locations.some(point => tripApi.normalizeAddress(point.address) === tripApi.normalizeAddress(address))) {
                    void locationResolver.ensure([address]).catch(() => {});
                }
                search.value = state.query = ''; paint(); search.focus();
                message((selection.added ? 'Адрес добавлен' : 'Адрес уже в списке') + ' · в списке ' + addressCount(selection.state.stops.length));
            } catch (error) { message('Не удалось добавить адрес: ' + (error.message || error), true); }
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
        listen(searchAdd, 'click', addSearchAddress);
        function clearSearch() { search.value = state.query = ''; paint(); search.focus(); }
        listen(clear, 'click', clearSearch);
        listen(search, 'keydown', event => {
            if (event.key === 'Escape' && search.value) { event.preventDefault(); clearSearch(); }
        });
        listen(add, 'click', () => openDialog('add', null, add));
        listen(tripToggle, 'click', () => { state.tripExpanded = !state.tripExpanded; paintTrip(); });
        listen(tripOpen, 'click', () => openTrip('2gis'));
        listen(tripYandex, 'click', () => openTrip('yandex'));
        listen(tripOrganicPoints, 'click', () => openTrip('organic-points'));
        listen(tripUndo, 'click', () => {
            if (!tripStore) return;
            try { tripStore.removeLast(); notifyTrip(); message('Последний адрес удалён из списка.'); }
            catch (error) { message(error.message || String(error), true); }
        });
        listen(tripReset, 'click', () => {
            if (!tripStore) return;
            try { tripStore.clear(); state.tripExpanded = true; notifyTrip(); message('Список адресов очищен.'); }
            catch (error) { message(error.message || String(error), true); }
        });
        if (tripEnabled) {
            listen(doc.defaultView, 'storage', event => { if (event.key === tripStorageKey) paintTrip(); });
            listen(doc.defaultView, 'manana-trip-change', event => { if (event.detail === tripStorageKey) paintTrip(); });
        }
        await refresh(); if (disposed) return;
        if (app.vault.on) {
            const ref = app.vault.on('modify', changed => {
                if (changed === file || changed.path === file.path) { clearTimeout(timer); timer = setTimeout(() => void refresh(), 80); }
                if (changed.path === cssFile.path) {
                    const current = ++cssGeneration;
                    void app.vault.read(cssFile).then(updated => {
                        if (disposed || current !== cssGeneration) return;
                        css = updated; uiStyle.textContent = updated;
                    }).catch(error => console.warn('Не удалось обновить оформление развоза', error));
                }
            });
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
module.exports.copyAddressText = copyAddressText;
