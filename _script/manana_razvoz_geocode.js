/* Public 2GIS address pages only. Website scripts and credentials are never executed. */
const CITY = 'chelyabinsk', LIMIT = 3 * 1024 * 1024;
const normalize = value => String(value).normalize('NFKC').toLocaleLowerCase('ru').replace(/ё/g, 'е').replace(/[‐‑‒–—−]/g, '-');
const addressKey = value => normalize(value).replace(/[.,]/g, ' ').replace(/\s+/g, ' ').trim();
function quotedString(text, start) {
    const quote = text[start], simple = { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', v: '\v' };
    if (quote !== "'" && quote !== '"') throw Error('Неизвестный формат данных 2ГИС.');
    let value = '';
    for (let i = start + 1; i < text.length; i++) {
        const char = text[i];
        if (char === quote) {
            if (!/^\s*\)/.test(text.slice(i + 1, i + 80))) throw Error('Повреждён блок данных 2ГИС.');
            return value;
        }
        if (char === '\n' || char === '\r') throw Error('Перенос строки в данных 2ГИС.');
        if (char !== '\\') { value += char; continue; }
        const escape = text[++i];
        if (escape === undefined) break;
        if (escape === '\n') continue;
        if (escape === '\r') { if (text[i + 1] === '\n') i++; continue; }
        if (escape in simple) { value += simple[escape]; continue; }
        if (escape === 'x' || escape === 'u') {
            const braced = escape === 'u' && text[i + 1] === '{';
            const rest = text.slice(i + 1), match = braced ? /^\{([0-9a-f]{1,6})\}/i.exec(rest) : new RegExp('^([0-9a-f]{' + (escape === 'x' ? 2 : 4) + '})', 'i').exec(rest);
            if (!match || parseInt(match[1], 16) > 0x10ffff) throw Error('Повреждена escape-последовательность 2ГИС.');
            value += String.fromCodePoint(parseInt(match[1], 16)); i += match[0].length; continue;
        }
        if (escape === '0' && !/[0-9]/.test(text[i + 1] || '')) { value += '\0'; continue; }
        if (/[0-9]/.test(escape)) throw Error('Неоднозначная escape-последовательность 2ГИС.');
        value += escape;
    }
    throw Error('Не завершён блок данных 2ГИС.');
}
function streetTokens(street) {
    return normalize(street).replace(/(\d+)[\s-]*(?:летия|лет)/g, '$1 лет').replace(/пр-т/g, 'проспект')
        .replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(/\s+/).filter(token => token && !['улица', 'ул'].includes(token));
}
function addressParts(address) {
    const text = normalize(address).trim().replace(/^(?:(?:г(?:ород)?\.?)\s*)?челябинск(?:\s*,\s*|\s+)/, '');
    const match = /(?:^|[\s,])(\d+[а-яa-z]?(?:[/-]\d+[а-яa-z]?)?)\s*$/.exec(text);
    if (!match) throw Error('Укажите улицу и точный номер дома: ' + address);
    const tokens = streetTokens(text.slice(0, match.index));
    if (!tokens.length) throw Error('Не указана улица: ' + address);
    return { number: match[1], tokens };
}
function parseSearchHtml(html, address) {
    if (typeof html !== 'string' || html.length > LIMIT) throw Error('Некорректный размер страницы 2ГИС.');
    const marker = /\b(?:var|let|const)\s+initialState\s*=\s*JSON\.parse\(\s*/.exec(html);
    if (!marker) throw Error('На странице 2ГИС нет адресных данных.');
    let state;
    try { state = JSON.parse(quotedString(html, marker.index + marker[0].length)); }
    catch (_) { throw Error('Не удалось прочитать адресные данные 2ГИС.'); }
    const query = addressParts(address), buildings = new Map(), branches = new Map();
    for (const wrapper of Object.values(state?.data?.entity?.profile || {})) {
        const item = wrapper?.data;
        if (!['building', 'branch'].includes(item?.type) || item.city_alias !== CITY || !/^\d+$/.test(String(item.id))) continue;
        // Some buildings (e.g. shopping centres) are represented by a business
        // card even at their /geo/ URL. Accept only an exact address with an
        // explicit building reference; group businesses in the same building.
        const buildingId = item.type === 'building' ? String(item.id) : String(item.address?.building_id || '');
        if (!/^\d+$/.test(buildingId)) continue;
        const matches = (item.address?.components || []).some(part => normalize(part.number || '').trim() === query.number
            && query.tokens.every(token => streetTokens(part.street || '').includes(token)));
        if (!matches) continue;
        const point = /^POINT\(\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*\)$/i.exec(item.geometry?.centroid || '');
        if (!point) continue;
        const lon = Number(point[1]), lat = Number(point[2]);
        if (!Number.isFinite(lon) || !Number.isFinite(lat) || Math.abs(lon) > 180 || Math.abs(lat) > 90) continue;
        const objectId = String(item.id);
        const found = item.type === 'building' ? buildings : branches;
        if (!found.has(buildingId)) found.set(buildingId, { address, formattedAddress: item.address_name || item.full_name || address, lon, lat, objectId,
            source: 'https://2gis.ru/' + CITY + (item.type === 'building' ? '/geo/' : '/firm/') + objectId,
            checkedAt: new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Yekaterinburg' }) });
    }
    const found = buildings.size ? buildings : branches;
    const buildingIds = new Set([...buildings.keys(), ...branches.keys()]);
    if (buildingIds.size > 1) throw Error('Найдено несколько зданий. Уточните адрес: ' + address);
    if (!found.size) throw Error('Точный адрес в Челябинске не найден: ' + address);
    return found.values().next().value;
}
function createLocationResolver({ app, obsidian, records, cachePath = '_script/manana_razvoz_locations.json' }) {
    if (!Array.isArray(records)) throw Error('Не передан список координат.');
    const inFlight = new Map(), dirty = new Map();
    async function fetchLocation(address) {
        if (typeof obsidian?.requestUrl !== 'function') throw Error('Загрузка адресов недоступна.');
        let timer;
        try {
            const response = await Promise.race([
                obsidian.requestUrl({ url: 'https://2gis.ru/' + CITY + '/search/' + encodeURIComponent(address), method: 'GET', throw: false }),
                new Promise((_, reject) => { timer = setTimeout(() => reject(Error('2ГИС не ответил за 15 секунд.')), 15000); })
            ]);
            if (response.status !== 200) throw Error('2ГИС вернул HTTP ' + response.status + '.');
            if (typeof response.text !== 'string' || response.text.length > LIMIT || new TextEncoder().encode(response.text).length > LIMIT) throw Error('Слишком большая страница 2ГИС.');
            return parseSearchHtml(response.text, address);
        } finally { clearTimeout(timer); }
    }
    function resolve(address) {
        const key = addressKey(address), existing = records.find(item => addressKey(item.address) === key);
        if (existing) return Promise.resolve(existing);
        if (!inFlight.has(key)) inFlight.set(key, fetchLocation(address).then(record => {
            records.push(record); dirty.set(key, record); return record;
        }).finally(() => inFlight.delete(key)));
        return inFlight.get(key);
    }
    async function persist() {
        if (!dirty.size) return;
        const pending = [...dirty.values()];
        function merge(raw) {
            const cache = JSON.parse(raw);
            if (!Array.isArray(cache.entries)) throw Error('Повреждён кеш адресов.');
            const merged = new Map(cache.entries.map(item => [addressKey(item.address), item]));
            for (const record of pending) merged.set(addressKey(record.address), record);
            return JSON.stringify({ ...cache, version: 1, city: 'Челябинск', entries: [...merged.values()] }, null, 2) + '\n';
        }
        let file = app.vault.getAbstractFileByPath(cachePath);
        if (file) await app.vault.process(file, merge);
        else {
            try { await app.vault.create(cachePath, merge('{"entries":[]}')); }
            catch (error) { file = app.vault.getAbstractFileByPath(cachePath); if (!file) throw error; await app.vault.process(file, merge); }
        }
        for (const record of pending) if (dirty.get(addressKey(record.address)) === record) dirty.delete(addressKey(record.address));
    }
    return { async ensure(addresses) {
        if (!Array.isArray(addresses) || addresses.some(address => typeof address !== 'string' || !address.trim())) throw Error('Не переданы корректные адреса.');
        const unique = [...new Map(addresses.map(address => [addressKey(address), address.trim()])).values()];
        const results = await Promise.allSettled(unique.map(resolve));
        await persist();
        const failure = results.find(result => result.status === 'rejected');
        if (failure) throw failure.reason;
        return results.map(result => result.value);
    } };
}
module.exports = { parseSearchHtml, createLocationResolver };
