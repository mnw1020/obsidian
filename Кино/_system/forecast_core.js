/* Pure, portable forecast engine. No Obsidian, filesystem or network dependency. */
"use strict";

const DATA_K = 155;
const MIN_SIM = 0.055;
const MIN_PEERS = 30;
const TEMPORAL_HALF_LIFE_DAYS = 730;
const DAY_MS = 86400000;
const clamp = (x, lo = 1, hi = 10) => Math.max(lo, Math.min(hi, x));
const rounded = x => x === null ? null : Math.round(x * 10) / 10;
const text = v => v == null ? "" : typeof v.toISODate === "function" ? v.toISODate() : String(v).trim();
const list = v => v == null || v === "" ? [] : (v instanceof Set ? [...v] : Array.isArray(v) ? v : [v]).map(text).filter(Boolean);
const number = v => { const m = text(v).replace(",", ".").match(/-?\d+(?:\.\d+)?/); return m && Number.isFinite(Number(m[0])) ? Number(m[0]) : null; };
const average = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : null;
const norm = v => text(v).toLocaleLowerCase("ru").replace(/ё/g, "е").replace(/[‐‑‒–—―]/g, "-").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const unique = values => [...new Set(list(values).map(norm).filter(Boolean))];
const link = v => { const s = text(v), m = s.match(/^\[\[([^\]|]+)(?:\|[^\]]+)?\]\]$/); return (m ? m[1] : s).replace(/\.md$/i, ""); };
const imdbId = v => { const m = text(v).match(/tt\s*0*(\d+)/i) || text(v).match(/(\d+)/); return m ? "tt" + String(Number(m[1])).padStart(7, "0") : ""; };
const kpId = v => { const m = text(v).match(/\d+/); return m ? String(Number(m[0])) : ""; };
const isRated = x => Number.isFinite(x.rating) && x.rating >= 1 && x.rating <= 10;
const validDescription = description => {
    const value = text(description);
    return value.length >= 30 && (value.match(/\p{L}{2,}/gu) || []).length >= 5;
};

/* Calendar dates, rather than local timestamps: the same viewing must have the
   same distance on desktop and Android, including across DST changes. */
function calendarDate(value) {
    if (value instanceof Date) value = Number.isFinite(value.getTime()) ? value.toISOString() : "";
    else if (typeof value?.toISODate === "function") value = value.toISODate();
    const match = text(value).match(/^(\d{4})-(\d{2})-(\d{2})(?:$|T)/);
    if (!match) return null;
    const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    if (year < 1000 || month < 1 || month > 12 || day < 1 || day > days[month - 1]) return null;
    return `${match[1]}-${match[2]}-${match[3]}`;
}
const calendarDay = value => { const date = calendarDate(value); return date ? Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10))) / DAY_MS : null; };
function temporalFactor(anchorDate, peerDate) {
    const anchor = calendarDay(anchorDate), peer = calendarDay(peerDate);
    const distanceDays = anchor !== null && peer !== null ? Math.abs(anchor - peer) : null;
    return { timeWeight: distanceDays === null ? 1 : Math.exp(-Math.LN2 * distanceDays / TEMPORAL_HALF_LIFE_DAYS), distanceDays };
}
function temporalContext(items, target, options = {}) {
    const ownDate = calendarDate(target?.watchDate), asOfDate = calendarDate(options.asOfDate);
    const forecastDate = calendarDate(options.forecastDate);
    const anchorDate = forecastDate || ownDate || asOfDate, weights = new Map();
    let datedPeers = 0, effectiveCount = 0;
    for (const item of items) {
        const watchDate = calendarDate(item.watchDate), factor = temporalFactor(anchorDate, watchDate);
        if (watchDate) datedPeers++;
        weights.set(item.path, factor.timeWeight); effectiveCount += factor.timeWeight;
    }
    return { weights, report: {
        method: "exponential-watch-distance", halfLifeDays: TEMPORAL_HALF_LIFE_DAYS,
        anchorDate, anchorSource: forecastDate ? "forecastDate" : ownDate ? "watchDate" : asOfDate ? "asOfDate" : "missing",
        status: !anchorDate ? "neutral-missing-target-date" : datedPeers < items.length ? "partial-missing-peer-dates" : "ready",
        datedPeerCount: datedPeers, missingPeerDateCount: items.length - datedPeers, effectiveCount,
        missingDateWeight: 1, formula: "timeWeight = exp(-ln(2) × abs(peerWatchDate − targetWatchDate) / 730 days); missing viewing dates use neutral weight 1"
    } };
}
const temporalWeight = (context, item) => context.timeWeights?.get(item.path) ?? 1;
/* Apply time before the cutoff: an old high-similarity record must not crowd
   a closer viewing out of the fixed-size neighborhood. Raw ranks stay cached. */
function selectNeighbors(context, ranked, maximumNeighbors, temperature = null) {
    const rows = [];
    let maximumSimilarity = -Infinity;
    for (const row of ranked) if (context.paths.has(row.item.path)) {
        maximumSimilarity = Math.max(maximumSimilarity, row.sim);
        const timeWeight = temporalWeight(context, row.item);
        const score = (temperature === null ? 3 * Math.log(row.sim) : row.sim / temperature) + Math.log(timeWeight);
        rows.push({ item: row.item, sim: row.sim, score });
    }
    rows.sort((a, b) => b.score - a.score || (a.item.path < b.item.path ? -1 : a.item.path > b.item.path ? 1 : 0));
    const selected = rows.slice(0, maximumNeighbors);
    selected.maximumSimilarity = maximumSimilarity;
    return selected;
}
function weightedAverage(items, value, weights) {
    let sum = 0, count = 0;
    for (const item of items) { const weight = weights?.get(item.path) ?? 1; sum += weight * value(item); count += weight; }
    return count > 0 ? sum / count : null;
}

function feature(file, fm = {}, actors = []) {
    const path = text(typeof file === "string" ? file : file?.path);
    const release = text(fm["Релиз"]).match(/(?:19|20)\d{2}/);
    const imdb = number(fm["Оценка Imdb"]), kp = number(fm["Оценка Кинопоиск"]);
    const id = imdbId(fm["imdb Id"]), kpid = kpId(fm["Кинопоиск ID"]);
    return {
        path, name: text(file?.basename) || path.split("/").pop().replace(/\.md$/i, "") || text(fm["Название"]),
        group: id ? `imdb:${id}` : kpid ? `kp:${kpid}` : `path:${path}`,
        type: list(fm.tags).some(x => x.replace(/^#/, "") === "serial") ? "serial" : "movies",
        rating: number(fm["Оценка"]), watchDate: calendarDate(fm["Просмотрено"]), imdbId: id, kpId: kpid, imdb, kp,
        publicMean: average([imdb, kp].filter(x => x !== null && x >= 0 && x <= 10)),
        genres: unique(fm["Жанр"]), directors: unique(fm["Режисер"]), actors: unique(list(actors).slice(0, 60)),
        releaseYear: release ? Number(release[0]) : null, duration: number(fm["Время"]),
        franchise: norm(link(fm["Франшиза"])), description: text(fm["Описание"])
    };
}

/* Union both provider IDs, including bridge records with IMDb and KP IDs. */
function assignGroups(items) {
    const parent = new Map();
    const find = key => { if (!parent.has(key)) parent.set(key, key); let r = key; while (parent.get(r) !== r) r = parent.get(r); while (parent.get(key) !== key) { const n = parent.get(key); parent.set(key, r); key = n; } return r; };
    const join = (a, b) => { a = find(a); b = find(b); if (a !== b) parent.set(a < b ? b : a, a < b ? a : b); };
    const keys = item => [item.imdbId ? `imdb:${imdbId(item.imdbId)}` : "", item.kpId ? `kp:${kpId(item.kpId)}` : ""].filter(Boolean);
    for (const item of items) { const ids = keys(item); for (const id of ids) find(id); if (ids.length === 2) join(ids[0], ids[1]); }
    return items.map(item => { const ids = keys(item); return { ...item, group: ids.length ? find(ids[0]) : `path:${item.path}` }; });
}

function hash(value) {
    let h = 2166136261;
    for (let i = 0; i < value.length; i++) { h ^= value.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
}
const foldFor = (group, count = 5, salt = "outer-v2") => hash(`${salt}:${group}`) % count;

function overlap(a, b) {
    if (!a.length || !b.length) return 0;
    let n = 0; for (const x of a) if (b.includes(x)) n++;
    return n / Math.sqrt(a.length * b.length);
}

function similarity(a, b, details = false) {
    let sum = 0, total = 0;
    const components = [];
    const add = (name, coefficient, value) => { if (!Number.isFinite(value)) return; value = clamp(value, 0, 1); sum += coefficient * value; total += coefficient; if (details) components.push({ name, coefficient, similarity: value }); };
    add("Жанры", 0.19, overlap(a.genres, b.genres));
    add("Режиссёры", 0.13, overlap(a.directors, b.directors));
    add("Актёры", 0.15, overlap(a.actors, b.actors));
    if (a.releaseYear !== null && b.releaseYear !== null) add("Год", 0.05, Math.exp(-Math.abs(a.releaseYear - b.releaseYear) / 11));
    if (a.duration !== null && b.duration !== null) add("Длительность", 0.035, Math.exp(-Math.abs(a.duration - b.duration) / 45));
    if (a.publicMean !== null && b.publicMean !== null) add("Публичный рейтинг", 0.10, 1 - Math.abs(a.publicMean - b.publicMean) / 7);
    add("Тип", 0.045, a.type === b.type ? 1 : 0);
    if (a.franchise && b.franchise) add("Франшиза", 0.08, a.franchise === b.franchise ? 1 : 0);
    if (details) for (const component of components) component.contribution = component.coefficient * component.similarity / total;
    return details ? { similarity: total ? sum / total : 0, components, totalCoefficient: total } : total ? sum / total : 0;
}

function calibration(items, weights) {
    const pairs = items.filter(x => x.publicMean !== null);
    const globalMean = weightedAverage(items, x => x.rating, weights) ?? 6;
    const effectiveCount = pairs.reduce((sum, item) => sum + (weights?.get(item.path) ?? 1), 0);
    if (pairs.length < 20 || effectiveCount <= 0) return { a: globalMean, b: 0, count: pairs.length, effectiveCount };
    const mx = weightedAverage(pairs, x => x.publicMean, weights), my = weightedAverage(pairs, x => x.rating, weights);
    let cov = 0, variance = 0;
    for (const x of pairs) { const weight = weights?.get(x.path) ?? 1; cov += weight * (x.publicMean - mx) * (x.rating - my); variance += weight * (x.publicMean - mx) ** 2; }
    const b = clamp(variance > 1e-9 ? cov / variance : 0, -0.25, 1.35);
    return { a: my - b * mx, b, count: pairs.length, effectiveCount };
}
const baseline = (item, cal, mean) => item.publicMean !== null ? clamp(cal.a + cal.b * item.publicMean) : mean;
const categoryKeys = item => ({ genres: item.genres, decade: item.releaseYear === null ? [] : [`${Math.floor(item.releaseYear / 10) * 10}s`], duration: item.duration === null ? [] : [item.duration < 90 ? "short" : item.duration < 130 ? "medium" : "long"], franchise: item.franchise ? [item.franchise] : [] });

function fit(items, target, options = {}) {
    const temporal = temporalContext(items, target, options), timeWeights = temporal.weights;
    const mean = weightedAverage(items, x => x.rating, timeWeights) ?? 6;
    const cal = calibration(items, timeWeights), residuals = new Map(), bases = new Map();
    for (const item of items) {
        const base = baseline(item, cal, mean), weight = timeWeights.get(item.path); bases.set(item.path, base);
        for (const [group, keys] of Object.entries(categoryKeys(item))) for (const key of keys) {
            const id = `${group}:${key}`, entry = residuals.get(id) || { sum: 0, count: 0, weightSum: 0 };
            entry.sum += weight * (item.rating - base); entry.count++; entry.weightSum += weight; residuals.set(id, entry);
        }
    }
    return { items, paths: new Set(items.map(x => x.path)), calibration: cal, mean, residuals, bases, timeWeights, temporal: temporal.report };
}

function categoryCorrection(target, context) {
    const categories = [];
    for (const [group, keys] of Object.entries(categoryKeys(target))) {
        const entries = keys.map(key => ({ key, ...context.residuals.get(`${group}:${key}`) })).filter(x => x.count).map(x => ({ ...x, effect: x.sum / ((x.weightSum ?? x.count) + 10) }));
        if (entries.length) categories.push({ group, entries, effect: average(entries.map(x => x.effect)) });
    }
    for (const category of categories) category.contribution = 0.75 * category.effect / categories.length;
    return { correction: average(categories.map(x => x.effect)) || 0, categories };
}

function calculateData(target, context, ranked, details = false, maximumNeighbors = DATA_K) {
    const top = selectNeighbors(context, ranked, maximumNeighbors);
    const base = baseline(target, context.calibration, context.mean);
    const sw = top.reduce((s, x) => s + x.sim ** 3 * temporalWeight(context, x.item), 0);
    let correction = 0;
    const neighbors = top.map(row => {
        const neighborBase = context.bases.get(row.item.path), residual = row.item.rating - neighborBase;
        const timeWeight = temporalWeight(context, row.item), weight = row.sim ** 3 * timeWeight, share = sw > 0 ? weight / sw : 0, contribution = share * residual;
        correction += contribution;
        if (!details) return null;
        return { path: row.item.path, name: row.item.name, rating: row.item.rating, watchDate: row.item.watchDate || null, distanceDays: temporalFactor(context.temporal?.anchorDate, row.item.watchDate).distanceDays, timeWeight, base: neighborBase, similarity: row.sim, weight, share, residual, contribution, components: similarity(target, row.item, true).components };
    });
    const category = categoryCorrection(target, context), weightedCategory = 0.75 * category.correction;
    const unbounded = base + correction + weightedCategory, raw = clamp(unbounded);
    if (!details) return raw;
    return { prediction: rounded(raw), raw, unbounded, base, globalMean: context.mean, calibration: context.calibration, temporal: context.temporal, correction, categoryCorrection: category.correction, weightedCategory, neighbors, categories: category.categories, formula: "weight = similarity³ × timeWeight; clamp(base + Σ(weight / Σweight × (rating − neighborBase)) + 0.75 × temporallyWeightedCategoryCorrection, 1, 10)", maximumNeighbors, minimumSimilarity: MIN_SIM };
}

function embedding(vectors, path) {
    const entry = vectors?.[path];
    const array = Array.isArray(entry) || ArrayBuffer.isView(entry) ? entry : entry?.vector || entry?.embedding;
    if (!array?.length || [...array].some(x => !Number.isFinite(x))) return null;
    let magnitude = 0; for (const value of array) magnitude += value * value;
    if (magnitude <= 1e-20) return null;
    const inverse = 1 / Math.sqrt(magnitude);
    return Float32Array.from(array, value => value * inverse);
}
const cosine = (a, b) => { if (!a || !b || a.length !== b.length) return null; let sum = 0; for (let i = 0; i < a.length; i++) sum += a[i] * b[i]; return clamp(sum, -1, 1); };

function calculatePlot(target, context, ranked, parameters, details = false) {
    const top = selectNeighbors(context, ranked, parameters.k, parameters.temperature);
    if (!top.length) return details ? { status: "pending", reason: "Нет готовых векторов оценённых сюжетных соседей", prediction: null, raw: null, neighbors: [], parameters } : null;
    const maximum = top.maximumSimilarity;
    let sumWeights = 0, sumResiduals = 0;
    const values = top.map(row => {
        const timeWeight = temporalWeight(context, row.item), weight = Math.exp((row.sim - maximum) / parameters.temperature) * timeWeight, residual = row.item.rating - context.mean;
        sumWeights += weight; sumResiduals += weight * residual;
        if (!details) return null;
        return { path: row.item.path, name: row.item.name, rating: row.item.rating, watchDate: row.item.watchDate || null, distanceDays: temporalFactor(context.temporal?.anchorDate, row.item.watchDate).distanceDays, timeWeight, similarity: row.sim, weight, residual };
    });
    const denominator = sumWeights + parameters.smoothing, correction = denominator > 0 ? sumResiduals / denominator : 0;
    const unbounded = context.mean + correction, raw = clamp(unbounded);
    if (!details) return raw;
    for (const row of values) { row.share = denominator > 0 ? row.weight / denominator : 0; row.contribution = row.share * row.residual; }
    return { status: "ready", reason: null, prediction: rounded(raw), raw, unbounded, base: context.mean, temporal: context.temporal, correction, sumWeights, denominator, neighbors: values, parameters, formula: "weight = exp((similarity − maxSimilarity) / temperature) × timeWeight; clamp(temporallyWeightedMean + Σ(weight × (rating − mean)) / (Σweights + smoothing), 1, 10)" };
}

function corpus(items, vectors = {}) {
    const grouped = assignGroups(items), byPath = new Map(grouped.map(x => [x.path, x]));
    const normalized = new Map(grouped.filter(x => validDescription(x.description)).map(x => [x.path, embedding(vectors, x.path)]));
    return { items: grouped, rated: grouped.filter(isRated), byPath, normalized, sourceVectors: vectors };
}

module.exports = { feature, assignGroups, foldFor, validDescription, similarity, cosine, calendarDate, temporalFactor, TEMPORAL_HALF_LIFE_DAYS,
    ensembleInternals: { corpus, fit, calculateData, calculatePlot, embedding, isRated, clamp, rounded, temporalWeight, selectNeighbors, MIN_PEERS, MIN_SIM } };
