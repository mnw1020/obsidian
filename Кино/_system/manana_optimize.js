/* Driving-distance stop ordering for a personal Obsidian address list.
   First selected stop stays the start; visit every other stop once, no return.
   Valhalla: https://valhalla.github.io/valhalla/api/route/api-reference/#costing-options
   Matrix: https://valhalla.github.io/valhalla/api/matrix/
   Public demo policy: https://github.com/valhalla/valhalla#demo-server
   No straight-line or fastest-route fallback: a failed road query leaves order intact. */
const ENDPOINT = 'https://valhalla1.openstreetmap.de/sources_to_targets';
const ATTRIBUTION = 'Valhalla · © OpenStreetMap';
const CACHE_MS = 15 * 60 * 1000, TIMEOUT_MS = 25000, RESPONSE_LIMIT = 1024 * 1024;
const normalize = value => String(value ?? '').normalize('NFC').toLocaleLowerCase('ru')
    .replace(/ё/g, 'е').replace(/[,\s]+/g, ' ').trim();
const fail = (code, message, fields = {}) => Object.assign(new Error(message), { code }, fields);
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

function validateMatrix(matrix, size) {
    if (!Array.isArray(matrix) || matrix.length !== size || matrix.some(row => !Array.isArray(row) || row.length !== size
        || row.some(value => value !== null && (!Number.isFinite(value) || value < 0)))) {
        throw fail('INVALID_MATRIX', 'Сервис вернул некорректные расстояния.');
    }
    return matrix;
}
function routeDistance(order, matrix) {
    let total = 0;
    for (let i = 1; i < order.length; i++) {
        const value = matrix[order[i - 1]][order[i]];
        if (value === null) return Infinity;
        total += value;
    }
    return total;
}
function solveOrder(matrix) {
    // At most 4! permutations. Directed distances account for one-way streets.
    const count = matrix?.length;
    if (!Number.isSafeInteger(count) || count < 1 || count > 5) throw fail('INVALID_MATRIX', 'Нужно от 1 до 5 адресов.');
    validateMatrix(matrix, count);
    const original = Array.from({ length: count }, (_, index) => index);
    let best = original, bestDistance = routeDistance(original, matrix);
    function visit(prefix, remaining, total) {
        if (!remaining.length) {
            // Preserve the original order when it is tied for shortest.
            if (total < bestDistance - .001) { best = prefix; bestDistance = total; }
            return;
        }
        for (const next of remaining) {
            const edge = matrix[prefix[prefix.length - 1]][next];
            if (edge === null || total + edge >= bestDistance - .001) continue;
            visit([...prefix, next], remaining.filter(index => index !== next), total + edge);
        }
    }
    visit([0], original.slice(1), 0);
    if (!Number.isFinite(bestDistance)) throw fail('NO_ROUTE', 'По автомобильным дорогам не удалось соединить все адреса.');
    return { order: best, distanceMeters: bestDistance, originalDistanceMeters: routeDistance(original, matrix) };
}
function parseRoadMatrix(data, count) {
    if (!data || data.units !== 'kilometers' || !Array.isArray(data.sources_to_targets)
        || data.sources_to_targets.length !== count || data.warnings?.length) {
        throw fail('INVALID_MATRIX', 'Сервис не подтвердил расчёт кратчайшего пути. Повторите позже.');
    }
    const matrix = data.sources_to_targets.map((row, from) => {
        if (!Array.isArray(row) || row.length !== count) throw fail('INVALID_MATRIX', 'Сервис вернул неполную таблицу расстояний.');
        return row.map((cell, to) => {
            if (cell === null) return null;
            if (!cell || cell.from_index !== from || cell.to_index !== to) throw fail('INVALID_MATRIX', 'Изменился формат ответа сервиса маршрутов.');
            if (cell.distance === null && cell.time === null) return null;
            const distance = cell.distance * 1000;
            if (typeof cell.distance !== 'number' || !Number.isFinite(distance) || distance < 0
                || !Number.isFinite(cell.cost) || Math.abs(cell.cost - distance) > 1.1) {
                throw fail('INVALID_MATRIX', 'Сервис не подтвердил расчёт именно по расстоянию.');
            }
            return distance;
        });
    });
    return validateMatrix(matrix, count);
}
function selectedPoints(stops, locations) {
    if (!Array.isArray(stops) || stops.length < 2 || stops.length > 5 || new Set(stops.map(stop => stop?.id)).size !== stops.length
        || stops.some(stop => !stop || typeof stop.id !== 'string' || !stop.id || typeof stop.address !== 'string' || !normalize(stop.address))) {
        throw fail('INVALID_STOPS', 'Для подбора порядка выберите от 2 до 5 адресов.');
    }
    const index = new Map((locations || []).map(record => [normalize(record.address), record]));
    const missing = [], points = stops.map(stop => {
        const point = index.get(normalize(stop.address));
        if (!point || !Number.isFinite(point.lat) || Math.abs(point.lat) > 90 || !Number.isFinite(point.lon) || Math.abs(point.lon) > 180) {
            missing.push(stop.address); return null;
        }
        return { lat: point.lat, lon: point.lon };
    });
    if (missing.length) throw fail('MISSING_LOCATION', 'Сначала нужно найти координаты адресов.', { addresses: [...new Set(missing)] });
    return points;
}
function createRoadOptimizer({ requestUrl, now = Date.now, delay = pause } = {}) {
    const cache = new Map(), pending = new Map();
    let nextRequestAt = 0;
    async function loadMatrix(points) {
        if (typeof requestUrl !== 'function') throw fail('NETWORK_UNAVAILABLE', 'Загрузка автомобильных расстояний недоступна.');
        const request = { sources: points, targets: points, costing: 'auto',
            costing_options: { auto: { shortest: true, disable_hierarchy_pruning: true } }, units: 'kilometers', verbose: true };
        // Respect the public server's one request per user per second policy.
        const wait = Math.max(0, nextRequestAt - now());
        nextRequestAt = Math.max(nextRequestAt, now()) + 1100;
        if (wait) await delay(wait);
        let timer;
        try {
            const response = await Promise.race([
                requestUrl({ url: ENDPOINT + '?json=' + encodeURIComponent(JSON.stringify(request)), method: 'GET', throw: false,
                    headers: { 'X-Client-Id': 'obsidian-manana-personal' } }),
                new Promise((_, reject) => { timer = setTimeout(() => reject(fail('ROUTE_TIMEOUT', 'Сервис маршрутов не ответил за 25 секунд.')), TIMEOUT_MS); })
            ]);
            if (response?.status === 429) throw fail('ROUTE_RATE_LIMIT', 'Сервис маршрутов занят. Повторите чуть позже.');
            if (response?.status !== 200) throw fail('ROUTE_NETWORK', 'Не удалось получить расстояния: HTTP ' + response?.status + '.');
            if (typeof response.text !== 'string' || response.text.length > RESPONSE_LIMIT) throw fail('INVALID_MATRIX', 'Некорректный ответ сервиса маршрутов.');
            let data;
            try { data = JSON.parse(response.text); }
            catch (_) { throw fail('INVALID_MATRIX', 'Не удалось прочитать автомобильные расстояния.'); }
            return parseRoadMatrix(data, points.length);
        } finally { clearTimeout(timer); }
    }
    async function optimize({ stops, locations }) {
        const points = selectedPoints(stops, locations);
        // Canonical order makes the cache reusable after an address is moved.
        const canonical = points.map(point => JSON.stringify(point)).sort();
        const key = canonical.join('|'), canonicalPoints = canonical.map(value => JSON.parse(value));
        let matrix;
        const existing = cache.get(key);
        if (existing && now() - existing.time < CACHE_MS) matrix = existing.matrix;
        else {
            if (!pending.has(key)) pending.set(key, loadMatrix(canonicalPoints).then(value => {
                if (cache.size >= 12) cache.delete(cache.keys().next().value);
                cache.set(key, { time: now(), matrix: value }); return value;
            }).finally(() => pending.delete(key)));
            matrix = await pending.get(key);
        }
        const mapping = points.map(point => canonical.indexOf(JSON.stringify(point)));
        const orderedMatrix = mapping.map(from => mapping.map(to => matrix[from][to]));
        const result = solveOrder(orderedMatrix), ids = result.order.map(index => stops[index].id);
        return { ids, distanceMeters: result.distanceMeters, originalDistanceMeters: result.originalDistanceMeters,
            savedMeters: Number.isFinite(result.originalDistanceMeters) ? Math.max(0, result.originalDistanceMeters - result.distanceMeters) : null,
            changed: result.order.some((index, position) => index !== position), provider: 'Valhalla / OpenStreetMap', attribution: ATTRIBUTION };
    }
    return { optimize };
}
module.exports = { createRoadOptimizer, solveOrder, parseRoadMatrix };
