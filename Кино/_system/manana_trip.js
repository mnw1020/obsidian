/* Local ordered delivery stops. This module never reads or edits a 2GIS app's state.
   Load with new Function('module', source), like the other vault UI modules.
   Corrupt saved trips throw INVALID_TRIP; an explicit clear() can recover them. */
const VERSION = 1;
const MAX_STOPS = 9; // Current location + eight intermediate stops + destination.
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
        || typeof value.address !== 'string' || !value.address.trim()) {
        throw fail('INVALID_STOP', 'У остановки должны быть имя записи и адрес.');
    }
    return { id: value.id, address: value.address.trim() };
}
function validLimit(value) {
    if (!Number.isSafeInteger(value) || value < 1 || value > MAX_STOPS) {
        throw fail('INVALID_LIMIT', 'В одной поездке можно выбрать от 1 до 9 адресов.');
    }
    return value;
}
function reconcileStops(stops, entries) {
    const current = new Map((entries || []).map(entry => [entry.id, entry]));
    const seen = new Set(), result = [];
    for (const value of stops || []) {
        const stop = stopSnapshot(value), entry = current.get(stop.id);
        if (seen.has(stop.id) || !entry || typeof entry.address !== 'string'
            || normalizeAddress(entry.address) !== normalizeAddress(stop.address)) continue;
        seen.add(stop.id);
        result.push({ id: stop.id, address: entry.address.trim() });
    }
    return result;
}
function readTrip(raw, entries) {
    if (raw == null) return { version: VERSION, stops: [], revision: 0 };
    let data;
    try { data = JSON.parse(raw); }
    catch (_) { throw fail('INVALID_TRIP', 'Не удалось прочитать поездку. Начните новую поездку.'); }
    if (!data || data.version !== VERSION || !Array.isArray(data.stops)
        || data.stops.length > MAX_STOPS || !Number.isSafeInteger(data.revision) || data.revision < 0) {
        throw fail('INVALID_TRIP', 'Неизвестный формат поездки. Начните новую поездку.');
    }
    let stops;
    try { stops = data.stops.map(stopSnapshot); }
    catch (_) { throw fail('INVALID_TRIP', 'Повреждены адреса поездки. Начните новую поездку.'); }
    if (new Set(stops.map(stop => stop.id)).size !== stops.length) {
        throw fail('INVALID_TRIP', 'В поездке повторяются записи. Начните новую поездку.');
    }
    return { version: VERSION, stops: entries === undefined ? stops : reconcileStops(stops, entries), revision: data.revision };
}
function appendStop(stops, entry, maxStops = MAX_STOPS) {
    validLimit(maxStops);
    const result = (stops || []).map(stopSnapshot), stop = stopSnapshot(entry);
    if (result.some(value => value.id === stop.id)) return result;
    if (result.length >= maxStops) {
        throw fail('TRIP_FULL', `В одной поездке можно выбрать до ${maxStops} адресов. Начните новую поездку.`);
    }
    result.push(stop);
    return result;
}
function locationPoint(value) {
    if (!value || !Number.isFinite(value.lon) || value.lon < -180 || value.lon > 180
        || !Number.isFinite(value.lat) || value.lat < -90 || value.lat > 90) return null;
    let objectId = value.objectId;
    if (objectId == null || objectId === '') objectId = '';
    else if (typeof objectId === 'number' && Number.isSafeInteger(objectId) && objectId >= 0) objectId = String(objectId);
    else if (typeof objectId !== 'string' || !/^\d+$/.test(objectId)) return null;
    return { lon: value.lon, lat: value.lat, objectId };
}
function buildTripUri(stops, locations) {
    const ordered = (stops || []).map(stopSnapshot);
    if (!ordered.length) throw fail('EMPTY_TRIP', 'Сначала выберите адрес поездки.');
    if (ordered.length > MAX_STOPS) throw fail('TRIP_FULL', 'В одной поездке можно выбрать до 9 адресов.');
    const index = new Map((locations || []).map(value => [normalizeAddress(value.address), value]));
    const points = ordered.map(stop => locationPoint(index.get(normalizeAddress(stop.address))));
    if (ordered.length === 1) {
        const point = points[0];
        if (point) return `${BASE}/geo/${point.objectId || `${point.lon},${point.lat}`}`;
        return BASE + '/search/' + encodeURIComponent(ordered[0].address);
    }
    const missing = [...new Set(ordered.filter((_, index) => !points[index]).map(stop => stop.address))];
    if (missing.length) throw fail('MISSING_LOCATION', 'Для маршрута нужны точные точки выбранных адресов.', { addresses: missing });
    return BASE + '/directions/tab/car/points/|' + points.map(point =>
        `${point.lon},${point.lat}` + (point.objectId ? ';' + point.objectId : '')).join('|');
}
function createTripStore({ storage, key, getEntries, locations, maxStops = MAX_STOPS }) {
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
    function write(previous, stops) {
        if (previous.revision >= Number.MAX_SAFE_INTEGER) throw fail('INVALID_TRIP', 'Слишком много изменений поездки.');
        const state = { version: VERSION, stops: stops.map(stopSnapshot), revision: previous.revision + 1 };
        try { storage.setItem(key, JSON.stringify(state)); }
        catch (cause) { throw fail('TRIP_STORAGE_ERROR', 'Не удалось сохранить поездку.', { cause }); }
        return state;
    }
    function select(entry) {
        const snapshot = stopSnapshot(entry), entries = getEntries();
        const current = entries.find(value => value.id === snapshot.id);
        if (!current) throw fail('ENTRY_NOT_FOUND', 'Запись уже удалена. Обновите список адресов.');
        if (normalizeAddress(current.address) !== normalizeAddress(snapshot.address)) {
            throw fail('ENTRY_CHANGED', 'Адрес записи уже изменён. Обновите список адресов.');
        }
        const previous = readTrip(getRaw(), entries);
        const stops = appendStop(previous.stops, current, maxStops);
        const uri = buildTripUri(stops, locations); // Validate before persistence.
        const state = write(previous, stops);
        return { state, previous, uri, added: stops.length > previous.stops.length };
    }
    function clear() {
        let previous;
        try { previous = read(); }
        catch (error) {
            if (error.code !== 'INVALID_TRIP') throw error;
            previous = { version: VERSION, stops: [], revision: 0 };
        }
        return write(previous, []);
    }
    function removeLast() {
        const previous = read();
        return write(previous, previous.stops.slice(0, -1));
    }
    function rollback(selection) {
        const current = read();
        if (!selection?.state || !selection.previous || current.revision !== selection.state.revision) return false;
        write(current, reconcileStops(selection.previous.stops, getEntries()));
        return true;
    }
    return { read, select, clear, removeLast, rollback };
}
module.exports = { normalizeAddress, readTrip, buildTripUri, appendStop, reconcileStops, createTripStore };
