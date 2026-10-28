/* Local ordered delivery stops. This module never reads or edits a 2GIS app's state.
   Load with new Function('module', source), like the other vault UI modules.
   Corrupt saved trips throw INVALID_TRIP; an explicit clear() can recover them. */
const VERSION = 1;
const MAX_STOPS = 5; // Default local selection cap, independent of map providers.
const MAX_SAVED_STOPS = 99; // Read older larger selections without discarding them.
const TWO_GIS_MAX_STOPS = 9; // Current location + eight intermediate stops + destination.
const YANDEX_MAX_STOPS = 19; // Current location + eighteen via points + destination.
const BASE = 'dgis://2gis.ru/chelyabinsk';

function fail(code, message, fields = {}) {
    return Object.assign(new Error(message), { code }, fields);
}
function normalizeAddress(value) {
    return String(value ?? '').normalize('NFC').toLocaleLowerCase('ru')
        .replace(/ё/g, 'е').replace(/[,\s]+/g, ' ').trim();
}
function stopSnapshot(value) {
    if (!value || typeof value.id !== 'string' || !value.id.trim()
        || typeof value.address !== 'string' || !value.address.trim()
        || (value.custom !== undefined && typeof value.custom !== 'boolean')) {
        throw fail('INVALID_STOP', 'У остановки должны быть имя записи и адрес.');
    }
    return { id: value.id, address: value.address.trim(), ...(value.custom === true ? { custom: true } : {}) };
}
function validLimit(value) {
    if (!Number.isSafeInteger(value) || value < 1 || value > MAX_SAVED_STOPS) {
        throw fail('INVALID_LIMIT', 'В одной поездке можно выбрать от 1 до 99 адресов.');
    }
    return value;
}
function reconcileStops(stops, entries) {
    const current = new Map((entries || []).map(entry => [entry.id, entry]));
    const seen = new Set(), seenAddresses = new Set(), result = [];
    for (const value of stops || []) {
        const stop = stopSnapshot(value), entry = current.get(stop.id);
        const key = normalizeAddress(stop.address);
        if (seen.has(stop.id) || seenAddresses.has(key)) continue;
        if (!stop.custom && (!entry || typeof entry.address !== 'string'
            || normalizeAddress(entry.address) !== key)) continue;
        seen.add(stop.id);
        seenAddresses.add(key);
        result.push(stop.custom ? stop : { id: stop.id, address: entry.address.trim() });
    }
    return result;
}
function snapshots(values) {
    if (!Array.isArray(values) || values.length > MAX_SAVED_STOPS) throw Error('Invalid stops');
    const stops = values.map(stopSnapshot);
    if (new Set(stops.map(stop => stop.id)).size !== stops.length) throw Error('Duplicate stops');
    return stops;
}
function sameStops(left, right) {
    return left.length === right.length && left.every((stop, index) => stop.id === right[index].id
        && stop.address === right[index].address && Boolean(stop.custom) === Boolean(right[index].custom));
}
function readTrip(raw, entries) {
    if (raw == null) return { version: VERSION, stops: [], revision: 0 };
    let data;
    try { data = JSON.parse(raw); }
    catch (_) { throw fail('INVALID_TRIP', 'Не удалось прочитать поездку. Начните новую поездку.'); }
    if (!data || data.version !== VERSION || !Array.isArray(data.stops)
        || data.stops.length > MAX_SAVED_STOPS || !Number.isSafeInteger(data.revision) || data.revision < 0) {
        throw fail('INVALID_TRIP', 'Неизвестный формат поездки. Начните новую поездку.');
    }
    let stops;
    try { stops = snapshots(data.stops); }
    catch (_) { throw fail('INVALID_TRIP', 'Повреждены адреса поездки. Начните новую поездку.'); }
    const state = { version: VERSION, stops: entries === undefined ? stops : reconcileStops(stops, entries), revision: data.revision };
    if (Object.prototype.hasOwnProperty.call(data, 'undoStops')) {
        try {
            const previous = snapshots(data.undoStops);
            state.undoStops = entries === undefined ? previous : reconcileStops(previous, entries);
        } catch (_) {
            // A damaged history must not make the current valid trip unusable.
            state.undoInvalid = true;
        }
    }
    return state;
}
function formatTripText(stops, entries = []) {
    const ordered = snapshots(stops);
    if (!ordered.length) throw fail('EMPTY_TRIP', 'Сначала выберите адрес поездки.');
    const current = new Map(entries.map(entry => [entry.id, entry]));
    const oneLine = value => String(value ?? '').replace(/\s+/g, ' ').trim();
    return ordered.map((stop, index) => {
        const entry = current.get(stop.id), address = oneLine(stop.address);
        const name = entry && (stop.custom || normalizeAddress(entry.address) === normalizeAddress(stop.address)) ? oneLine(entry.name) : '';
        return `${index + 1}. ` + (name && normalizeAddress(name) !== normalizeAddress(address) ? name + ' — ' : '') + address;
    }).join('\n');
}
function appendStop(stops, entry, maxStops = MAX_STOPS) {
    validLimit(maxStops);
    const result = (stops || []).map(stopSnapshot), stop = stopSnapshot(entry);
    if (result.some(value => value.id === stop.id || normalizeAddress(value.address) === normalizeAddress(stop.address))) return result;
    if (result.length >= maxStops) {
        throw fail('TRIP_FULL', `В одной поездке можно выбрать до ${maxStops} адресов. Начните новую поездку.`);
    }
    result.push(stop);
    return result;
}
function locationPoint(value, includeObjectId = true) {
    if (!value || !Number.isFinite(value.lon) || value.lon < -180 || value.lon > 180
        || !Number.isFinite(value.lat) || value.lat < -90 || value.lat > 90) return null;
    if (!includeObjectId) return { lon: value.lon, lat: value.lat };
    let objectId = value.objectId;
    if (objectId == null || objectId === '') objectId = '';
    else if (typeof objectId === 'number' && Number.isSafeInteger(objectId) && objectId >= 0) objectId = String(objectId);
    else if (typeof objectId !== 'string' || !/^\d+$/.test(objectId)) return null;
    return { lon: value.lon, lat: value.lat, objectId };
}
function tripPoints(stops, locations, includeObjectId = true, maxStops = TWO_GIS_MAX_STOPS, provider = '2ГИС') {
    const ordered = (stops || []).map(stopSnapshot);
    if (!ordered.length) throw fail('EMPTY_TRIP', 'Сначала выберите адрес поездки.');
    if (ordered.length > maxStops) throw fail('TRIP_FULL', `В ${provider} можно передать до ${maxStops} адресов. Уберите лишние адреса из поездки.`);
    const index = new Map((locations || []).map(value => [normalizeAddress(value.address), value]));
    const points = ordered.map(stop => locationPoint(index.get(normalizeAddress(stop.address)), includeObjectId));
    return { ordered, points };
}
function requirePoints(ordered, points) {
    const missing = [...new Set(ordered.filter((_, index) => !points[index]).map(stop => stop.address))];
    if (missing.length) throw fail('MISSING_LOCATION', 'Для маршрута нужны точные точки выбранных адресов.', { addresses: missing });
}
function routeUri(ordered, points) {
    requirePoints(ordered, points);
    return BASE + '/directions/tab/car/points/|' + points.map(point =>
        `${point.lon},${point.lat}` + (point.objectId ? ';' + point.objectId : '')).join('|');
}
function buildTwoGisRouteUri(stops, locations) {
    const { ordered, points } = tripPoints(stops, locations);
    return routeUri(ordered, points);
}
function buildYandexNavigatorUri(stops, locations) {
    // Navigator uses coordinates only. An optional 2GIS object id is unrelated
    // and must not prevent opening valid coordinates in another application.
    const { ordered, points } = tripPoints(stops, locations, false, YANDEX_MAX_STOPS, 'Яндекс Навигатор');
    requirePoints(ordered, points);
    const destination = points[points.length - 1];
    const query = [`lat_to=${destination.lat}`, `lon_to=${destination.lon}`];
    for (let index = 0; index < points.length - 1; index++) {
        query.push(`lat_via_${index}=${points[index].lat}`, `lon_via_${index}=${points[index].lon}`);
    }
    // Omitted from coordinates tell Navigator to start at current position.
    return 'yandexnavi://build_route_on_map?' + query.join('&');
}
function buildOrganicMapsPointsUri(stops, locations) {
    const { ordered, points } = tripPoints(stops, locations, false, MAX_STOPS, 'Organic Maps');
    requirePoints(ordered, points);
    // Each ll starts a new pin; its name and style must follow that point.
    const query = ['v=1'];
    for (let index = 0; index < points.length; index++) {
        query.push(`ll=${points[index].lat},${points[index].lon}`,
            'n=' + encodeURIComponent((index + 1) + '. ' + ordered[index].address),
            's=placemark-purple');
    }
    query.push('appname=' + encodeURIComponent('Развоз'));
    return 'om://map?' + query.join('&');
}
function buildTripUri(stops, locations) {
    const { ordered, points } = tripPoints(stops, locations);
    if (ordered.length === 1) {
        const point = points[0];
        if (point) return `${BASE}/geo/${point.objectId || `${point.lon},${point.lat}`}`;
        return BASE + '/search/' + encodeURIComponent(ordered[0].address);
    }
    return routeUri(ordered, points);
}
function createTripStore({ storage, key, getEntries, locations = [], maxStops = MAX_STOPS }) {
    validLimit(maxStops);
    if (!storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function'
        || typeof key !== 'string' || !key || typeof getEntries !== 'function' || !Array.isArray(locations)) {
        throw fail('INVALID_STORE', 'Не удалось подключить хранилище поездки.');
    }
    function getRaw() {
        try { return storage.getItem(key); }
        catch (cause) { throw fail('TRIP_STORAGE_ERROR', 'Не удалось прочитать сохранённую поездку.', { cause }); }
    }
    function read() { return readTrip(getRaw(), getEntries()); }
    function write(previous, stops, { history = previous.stops, force = false } = {}) {
        const next = stops.map(stopSnapshot);
        if (!force && sameStops(previous.stops, next)) return previous;
        if (previous.revision >= Number.MAX_SAFE_INTEGER) throw fail('INVALID_TRIP', 'Слишком много изменений поездки.');
        const state = { version: VERSION, stops: next, revision: previous.revision + 1 };
        if (history !== null) state.undoStops = history.map(stopSnapshot);
        try { storage.setItem(key, JSON.stringify(state)); }
        catch (cause) { throw fail('TRIP_STORAGE_ERROR', 'Не удалось сохранить поездку.', { cause }); }
        return state;
    }
    function prepareSelection(entry) {
        const snapshot = stopSnapshot(entry), entries = getEntries();
        const current = entries.find(value => value.id === snapshot.id);
        if (!current) throw fail('ENTRY_NOT_FOUND', 'Запись уже удалена. Обновите список адресов.');
        if (normalizeAddress(current.address) !== normalizeAddress(snapshot.address)) {
            throw fail('ENTRY_CHANGED', 'Адрес записи уже изменён. Обновите список адресов.');
        }
        const previous = readTrip(getRaw(), entries);
        const stops = appendStop(previous.stops, current, maxStops);
        return { previous, stops, added: stops.length > previous.stops.length };
    }
    function add(entry) {
        // Selection is local only: unresolved addresses can be accumulated
        // without building a URI, looking up coordinates, or launching an app.
        const { previous, stops, added } = prepareSelection(entry);
        return { state: write(previous, stops), previous, added };
    }
    function addCustom(address) {
        if (typeof address !== 'string' || !normalizeAddress(address)) throw fail('INVALID_STOP', 'Укажите адрес.');
        const value = address.trim(), key = normalizeAddress(value), entries = getEntries();
        const known = entries.find(entry => typeof entry.address === 'string' && normalizeAddress(entry.address) === key);
        if (known) return add(known);
        const previous = readTrip(getRaw(), entries);
        const stops = appendStop(previous.stops, { id: 'manual:' + key, address: value, custom: true }, maxStops);
        return { state: write(previous, stops), previous, added: stops.length > previous.stops.length };
    }
    function select(entry) {
        // Legacy combined preparation, retained for callers that need a URI.
        const { previous, stops, added } = prepareSelection(entry);
        const uri = buildTripUri(stops, locations); // Validate before persistence.
        return { state: write(previous, stops), previous, uri, added };
    }
    function clear() {
        let previous;
        try { previous = read(); }
        catch (error) {
            if (error.code !== 'INVALID_TRIP') throw error;
            previous = { version: VERSION, stops: [], revision: 0 };
            return write(previous, [], { history: null, force: true });
        }
        return write(previous, []);
    }
    function removeLast() {
        const previous = read();
        return write(previous, previous.stops.slice(0, -1));
    }
    function checkRevision(previous, expectedRevision) {
        if (expectedRevision !== undefined && previous.revision !== expectedRevision) {
            throw fail('TRIP_CHANGED', 'Список уже изменился. Повторите действие.');
        }
    }
    function remove(id, expectedRevision) {
        const previous = read();
        checkRevision(previous, expectedRevision);
        if (!previous.stops.some(stop => stop.id === id)) throw fail('STOP_NOT_FOUND', 'Адрес уже удалён из списка.');
        return write(previous, previous.stops.filter(stop => stop.id !== id));
    }
    function editAddress(id, address, expectedRevision) {
        const previous = read();
        checkRevision(previous, expectedRevision);
        const index = previous.stops.findIndex(stop => stop.id === id);
        if (index < 0) throw fail('STOP_NOT_FOUND', 'Адрес уже удалён из списка.');
        if (typeof address !== 'string' || !address.trim()) throw fail('INVALID_STOP', 'Укажите адрес.');
        const value = address.trim(), key = normalizeAddress(value);
        if (previous.stops.some((stop, i) => i !== index && normalizeAddress(stop.address) === key)) {
            throw fail('DUPLICATE_STOP', 'Такой адрес уже есть в поездке.');
        }
        if (previous.stops[index].address === value) return previous;
        const stops = previous.stops.map((stop, i) => i === index ? { ...stop, address: value, custom: true } : stop);
        return write(previous, stops);
    }
    function canUndo() {
        const previous = read();
        return Array.isArray(previous.undoStops) && !sameStops(previous.stops, previous.undoStops);
    }
    function undo(expectedRevision) {
        const previous = read();
        checkRevision(previous, expectedRevision);
        if (previous.undoInvalid) throw fail('INVALID_UNDO', 'Не удалось прочитать отмену последнего действия. Текущий список сохранён.');
        if (!Array.isArray(previous.undoStops)) throw fail('NO_UNDO', 'Нет действия для отмены.');
        return write(previous, previous.undoStops, { history: null, force: true });
    }
    function reorder(ids, expectedRevision) {
        const previous = read();
        if (previous.revision !== expectedRevision) {
            throw fail('TRIP_CHANGED', 'Список уже изменился. Повторите перетаскивание.');
        }
        const stopsById = new Map(previous.stops.map(stop => [stop.id, stop]));
        if (!Array.isArray(ids) || ids.length !== previous.stops.length
            || new Set(ids).size !== ids.length || ids.some(id => !stopsById.has(id))) {
            throw fail('INVALID_ORDER', 'Не удалось изменить порядок адресов.');
        }
        if (ids.every((id, index) => id === previous.stops[index].id)) return previous;
        return write(previous, ids.map(id => stopsById.get(id)));
    }
    function rollback(selection) {
        const current = read();
        if (!selection?.state || !selection.previous || current.revision !== selection.state.revision) return false;
        write(current, reconcileStops(selection.previous.stops, getEntries()), {
            history: selection.previous.undoStops ? reconcileStops(selection.previous.undoStops, getEntries()) : null,
            force: true
        });
        return true;
    }
    return { read, add, addCustom, select, clear, removeLast, remove, editAddress, canUndo, undo, reorder, rollback };
}
module.exports = { normalizeAddress, readTrip, formatTripText, buildTripUri, buildTwoGisRouteUri, buildYandexNavigatorUri, buildOrganicMapsPointsUri, appendStop, reconcileStops, createTripStore };
