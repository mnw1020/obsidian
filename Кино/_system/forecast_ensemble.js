/* Data-155 and EmbeddingGemma predictors with an independently validated mixture.
   Browser/CommonJS portable: this module never performs IO. */
"use strict";

const core = require("./forecast_core.js");
const { corpus, fit, calculateData, calculatePlot, embedding, isRated, clamp, rounded, temporalWeight, selectNeighbors, MIN_PEERS, MIN_SIM } = core.ensembleInternals;
const VERSION = 6;
const ENGINE = "kino-data-gemma-forecasts-6.0.0";
const MODEL_KEYS = ["embeddinggemma"];
const DATA_LIMITS = [155];
const BRANCHES = [
    { id: "data155", label: "По данным · 155 соседей" },
    { id: "plot-embeddinggemma", label: "Сюжет · EmbeddingGemma" }
];
const GRID = [];
for (const k of [10, 20, 35, 55, 100, 155]) for (const temperature of [0.03, 0.07, 0.15])
    for (const smoothing of [0, 3, 10]) GRID.push({ k, temperature, smoothing });
const DEFAULT_PLOT = { k: 20, temperature: 0.07, smoothing: 3 };
const MIN_PAIRED_VALIDATION = 30;
const MIN_BRANCH_WEIGHT = 0.25;
const MAX_BRANCH_WEIGHT = 0.75;
const RELIABILITY_FORMULA = "rawDataWeight = MAEplot / (MAEdata + MAEplot); dataWeight = clamp(rawDataWeight, 0.25, 0.75); plotWeight = 1 - dataWeight; fewer than 30 paired validation targets/identity groups or an invalid/zero error sum: 0.5 / 0.5";
const equalWeights = () => Object.fromEntries(BRANCHES.map(({ id }) => [id, 1 / BRANCHES.length]));
const defaultReliability = () => ({ method: "inverse-mae", pairedCount: 0, pairedGroupCount: 0, minimumPairedCount: MIN_PAIRED_VALIDATION, dataMae: null, plotMae: null, dataRmse: null, plotRmse: null, rawDataWeight: null, dataWeight: 0.5, plotWeight: 0.5, minWeight: MIN_BRANCH_WEIGHT, maxWeight: MAX_BRANCH_WEIGHT, rawWeights: null, weights: equalWeights(), formula: RELIABILITY_FORMULA, fallbackReason: "Параметры ещё не рассчитаны по независимым проверочным прогнозам; используются равные веса" });
const defaults = () => ({ plots: Object.fromEntries(MODEL_KEYS.map(key => [key, { ...DEFAULT_PLOT }])), weights: equalWeights(), reliability: defaultReliability() });
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
const checkCancelled = options => { if (options.shouldCancel?.()) { const error = new Error("Расчёт отменён; сохранённые прогнозы не изменены"); error.name = "AbortError"; throw error; } };
const emptyScore = () => ({ count: 0, absolute: 0, squared: 0 });
const scoreAdd = (score, prediction, actual) => {
    if (!Number.isFinite(prediction)) return;
    const error = prediction - actual; score.count++; score.absolute += Math.abs(error); score.squared += error * error;
};
const scoreResult = score => ({ count: score.count, mae: score.count ? score.absolute / score.count : null, rmse: score.count ? Math.sqrt(score.squared / score.count) : null });

function parametersFor(target, training, items) {
    const fallback = defaults();
    const merged = value => ({ plots: Object.fromEntries(MODEL_KEYS.map(key => [key, { ...DEFAULT_PLOT, ...value?.plots?.[key] }])), weights: Object.fromEntries(BRANCHES.map(({ id }) => [id, value?.weights?.[id] ?? fallback.weights[id]])), reliability: value?.reliability || fallback.reliability });
    if (training?.outer) {
        const knownFolds = new Set();
        const remember = value => { if (Number.isInteger(value)) knownFolds.add(value); };
        remember(training.folds?.[target.path]);
        remember(training.groupFolds?.[target.group]);
        for (const item of items) if (item.group === target.group) remember(training.folds?.[item.path]);
        if (knownFolds.size > 1) return { ...fallback, source: "defaults-merged-identity", fitCount: 0, needsRetuning: true, reason: "Объединены произведения из разных обучающих групп; нужны новые параметры без оценок объединённого произведения" };
        const known = knownFolds.size === 1;
        const fold = known ? [...knownFolds][0] : isRated(target) ? core.foldFor(target.group) : null;
        if (fold !== null) {
            const fitted = training.outer[String(fold)];
            if (fitted?.parameters) return { ...merged(fitted.parameters), source: "outer-training", outerFold: fold, fitCount: fitted.fitCount };
            if (known) return { ...fallback, source: "defaults-missing-withheld-fold", fitCount: 0, needsRetuning: true };
        }
    }
    return { ...merged(training?.global?.parameters || training?.parameters), source: training?.global ? "all-rated-cross-validation" : "defaults", fitCount: training?.global?.fitCount ?? null };
}

/* Normalize only available branches. Both ready branches have positive learned
   weights; a missing model remains visible and marks the result provisional. */
function mix(values, suppliedWeights) {
    const weights = BRANCHES.map(({ id }) => Number.isFinite(suppliedWeights?.[id]) && suppliedWeights[id] >= 0 ? suppliedWeights[id] : 0);
    const weightSum = weights.reduce((sum, value) => sum + value, 0);
    if (weightSum > 0) for (let i = 0; i < weights.length; i++) weights[i] /= weightSum;
    else for (let i = 0; i < weights.length; i++) weights[i] = 1 / weights.length;
    let availableSum = 0;
    for (let i = 0; i < values.length; i++) if (Number.isFinite(values[i])) availableSum += weights[i];
    const effective = weights.map((weight, i) => Number.isFinite(values[i]) && availableSum > 0 ? weight / availableSum : 0);
    if (availableSum <= 0) {
        const first = Number.isFinite(values[0]) ? 0 : values.findIndex(Number.isFinite);
        if (first >= 0) effective[first] = 1;
    }
    const hasPrediction = effective.some(value => value > 0);
    const raw = hasPrediction ? clamp(values.reduce((sum, value, i) => sum + (Number.isFinite(value) ? effective[i] * value : 0), 0)) : null;
    return { raw, weights: Object.fromEntries(BRANCHES.map(({ id }, i) => [id, weights[i]])), effectiveWeights: Object.fromEntries(BRANCHES.map(({ id }, i) => [id, effective[i]])) };
}

const preparedMemo = new WeakMap();
function prepare(items, vectorSets) {
    const cached = preparedMemo.get(items);
    if (cached?.vectorSets === vectorSets) return cached.value;
    // Keep features and vectors immutable for this operation so single-card and
    // batch calculations share precisely the same stable ranking caches.
    const modelCorpora = Object.fromEntries(MODEL_KEYS.map(key => [key, corpus(items.slice(), vectorSets?.[key] || {})]));
    const c = modelCorpora[MODEL_KEYS[0]];
    const value = { c, modelCorpora };
    preparedMemo.set(items, { vectorSets, value });
    return value;
}

// Retaining millions of {item,sim} objects is expensive on phones. Store only
// rated-item indices and exact Float64 similarities; the iterable materializes
// the small prefix used by a calculation. Float64 preserves exact similarity
// order rather than changing neighbors through quantization.
const compactRankMemo = new WeakMap();
function ranks(target, c, plot = false) {
    let caches = compactRankMemo.get(c);
    if (!caches) { caches = { data: new Map(), plot: new Map() }; compactRankMemo.set(c, caches); }
    const cache = plot ? caches.plot : caches.data;
    let record = cache.get(target.path);
    if (!record) {
        const vector = plot ? c.normalized.get(target.path) || embedding(c.sourceVectors, target.path) : null;
        const rows = [];
        if (!plot || core.validDescription(target.description) && vector) for (let index = 0; index < c.rated.length; index++) {
            const item = c.rated[index];
            if (item.path === target.path || item.group === target.group) continue;
            const sim = plot ? core.cosine(vector, c.normalized.get(item.path)) : core.similarity(target, item);
            if (sim !== null && (plot || sim >= MIN_SIM)) rows.push({ index, sim });
        }
        rows.sort((a, b) => b.sim - a.sim || (c.rated[a.index].path < c.rated[b.index].path ? -1 : c.rated[a.index].path > c.rated[b.index].path ? 1 : 0));
        const IndexArray = c.rated.length <= 65535 ? Uint16Array : Uint32Array;
        record = { indices: IndexArray.from(rows, row => row.index), similarities: Float64Array.from(rows, row => row.sim) };
        cache.set(target.path, record);
    }
    return { *[Symbol.iterator]() { for (let i = 0; i < record.indices.length; i++) yield { item: c.rated[record.indices[i]], sim: record.similarities[i] }; } };
}

function plotReport(target, context, c, vectors, parameters) {
    let report;
    if (!core.validDescription(target.description)) report = { status: "insufficient", reason: "Недостаточно содержательного описания сюжета: нужно не менее 30 символов и 5 слов", prediction: null, raw: null, neighbors: [], parameters };
    else if (!c.normalized.get(target.path) && !embedding(vectors, target.path)) report = { status: "pending", reason: "Вектор сюжета этой модели ещё не рассчитан", prediction: null, raw: null, neighbors: [], parameters };
    else report = calculatePlot(target, context, ranks(target, c, true), parameters, true);
    report.shortDescription = core.validDescription(target.description) && target.description.trim().length < 80;
    if (report.shortDescription) report.note = "Использовано краткое описание сюжета (менее 80 символов); смысловое сравнение располагает меньшим контекстом.";
    return report;
}

function forecast(items, target, vectorSets = {}, training = null, options = {}) {
    const prepared = options.prepared || prepare(items, vectorSets), { c, modelCorpora } = prepared;
    const local = c.byPath.get(target.path);
    const identities = local ? null : core.assignGroups([...c.items, target]);
    target = local || identities.pop();
    const excludedPaths = identities ? new Set(identities.filter(item => item.group === target.group).map(item => item.path)) : null;
    const peers = c.rated.filter(item => item.path !== target.path && item.group !== target.group && !excludedPaths?.has(item.path));
    if (peers.length < MIN_PEERS) return { version: VERSION, engine: ENGINE, target: { path: target.path, name: target.name }, error: "Для прогноза нужно не менее 30 оценённых других карточек", prediction: null };
    const context = fit(peers, target, options), parameters = parametersFor(target, training, identities || c.items);
    const dataRanking = ranks(target, c);
    const dataVariants = Object.fromEntries(DATA_LIMITS.map(k => [String(k), calculateData(target, context, dataRanking, true, k)]));
    const plotVariants = Object.fromEntries(MODEL_KEYS.map(key => [key, plotReport(target, context, modelCorpora[key], vectorSets[key] || {}, parameters.plots[key])]));
    const values = [...DATA_LIMITS.map(k => dataVariants[k].raw), ...MODEL_KEYS.map(key => plotVariants[key].raw)];
    const mixed = mix(values, parameters.weights);
    const missing = MODEL_KEYS.filter(key => !Number.isFinite(plotVariants[key].raw));
    const provisional = missing.length > 0 || !!parameters.needsRetuning;
    const reason = [missing.length ? `Не готовы модели: ${missing.join(", ")}` : "", parameters.needsRetuning ? parameters.reason || "Нужно повторно подобрать параметры без оценок текущего произведения" : ""].filter(Boolean).join("; ") || null;
    const report = {
        version: VERSION, engine: ENGINE, createdAt: new Date().toISOString(), target: { ...target, ownRatingExcluded: true },
        temporal: context.temporal,
        training: { count: peers.length, excludedGroup: target.group, globalMean: context.mean, temporal: context.temporal, parameters, validation: training?.metrics || null, fitCount: parameters.fitCount ?? training?.ratedCount ?? null },
        dataVariants, plotVariants, branches: BRANCHES.map((branch, i) => ({ ...branch, raw: values[i], prediction: rounded(values[i]), status: i < DATA_LIMITS.length ? "ready" : plotVariants[MODEL_KEYS[i - DATA_LIMITS.length]].status })),
        data: dataVariants[155], plot: plotVariants.embeddinggemma,
        final: { ...mixed, prediction: rounded(mixed.raw), provisional, reason, reliability: parameters.reliability, formula: "final.raw = clamp(dataWeight × data155.raw + plotWeight × plot.raw, 1, 10); weights are inverse-MAE reliability weights limited to 25–75%, before rounding. If a branch is unavailable, normalize weights across available branches and mark the result provisional." }
    };
    return report;
}

// Time-adjusted selection depends on temperature. Share the three rankings,
// then use prefixes for k/smoothing. The maximum similarity is taken across
// all eligible peers before the cutoff, exactly as in calculatePlot.
function plotGrid(context, ranking) {
    const eligible = [...ranking].filter(row => context.paths.has(row.item.path));
    const result = new Float64Array(GRID.length); result.fill(NaN);
    if (!eligible.length) return result;
    const maximum = Math.max(...eligible.map(row => row.sim)), prefixes = new Map();
    for (const temperature of [0.03, 0.07, 0.15]) {
        const top = selectNeighbors(context, eligible, 155, temperature);
        const weights = new Float64Array(top.length + 1), residuals = new Float64Array(top.length + 1);
        for (let i = 0; i < top.length; i++) { const weight = Math.exp((top[i].sim - maximum) / temperature) * temporalWeight(context, top[i].item); weights[i + 1] = weights[i] + weight; residuals[i + 1] = residuals[i] + weight * (top[i].item.rating - context.mean); }
        prefixes.set(temperature, { weights, residuals, count: top.length });
    }
    for (let i = 0; i < GRID.length; i++) { const parameters = GRID[i], prefix = prefixes.get(parameters.temperature), count = Math.min(parameters.k, prefix.count), denominator = prefix.weights[count] + parameters.smoothing; result[i] = clamp(context.mean + (denominator > 0 ? prefix.residuals[count] / denominator : 0)); }
    return result;
}

function betterPlot(candidate, best) {
    if (!best) return true;
    const a = [candidate.mae ?? Infinity, candidate.rmse ?? Infinity, candidate.parameters.k, candidate.parameters.temperature, candidate.parameters.smoothing];
    const b = [best.mae ?? Infinity, best.rmse ?? Infinity, best.parameters.k, best.parameters.temperature, best.parameters.smoothing];
    for (let i = 0; i < a.length; i++) { if (a[i] < b[i] - 1e-12) return true; if (a[i] > b[i] + 1e-12) return false; }
    return false;
}

function mixtureScore(weights, matrix, actual) {
    const n = actual.length;
    let absolute = 0, squared = 0;
    for (let row = 0, at = 0; row < n; row++, at += 2) {
        const data = matrix[at], plot = matrix[at + 1];
        const prediction = Number.isFinite(plot) ? weights[0] * data + weights[1] * plot : data;
        const error = prediction - actual[row]; absolute += Math.abs(error); squared += error * error;
    }
    return { count: n, mae: n ? absolute / n : null, rmse: n ? Math.sqrt(squared / n) : null };
}

async function tuneMixture(matrix, actual, records, options, label) {
    const dataScore = emptyScore(), plotScore = emptyScore(), pairedGroups = new Set();
    // Score both sources on exactly the same inner-held-out targets. Missing
    // plots must not give the data branch an easier/different validation set.
    for (let row = 0; row < actual.length; row++) {
        checkCancelled(options);
        const data = matrix[row * 2], plot = matrix[row * 2 + 1];
        if (!Number.isFinite(data) || !Number.isFinite(plot) || !Number.isFinite(actual[row])) continue;
        scoreAdd(dataScore, data, actual[row]); scoreAdd(plotScore, plot, actual[row]);
        if (records[row]?.group) pairedGroups.add(records[row].group);
    }
    const data = scoreResult(dataScore), plot = scoreResult(plotScore), sum = data.mae + plot.mae;
    const reliability = {
        ...defaultReliability(), pairedCount: data.count, pairedGroupCount: pairedGroups.size,
        dataMae: data.mae, plotMae: plot.mae, dataRmse: data.rmse, plotRmse: plot.rmse
    };
    if (data.count < MIN_PAIRED_VALIDATION || pairedGroups.size < MIN_PAIRED_VALIDATION) reliability.fallbackReason = `Недостаточно независимых пар проверочных прогнозов: ${data.count} карточек, ${pairedGroups.size} произведений; нужно не менее ${MIN_PAIRED_VALIDATION} произведений. Используются равные веса`;
    else if (!Number.isFinite(sum) || sum <= 0) reliability.fallbackReason = "Сумма средних абсолютных ошибок равна нулю или недоступна; используются равные веса";
    else {
        reliability.rawDataWeight = plot.mae / sum;
        reliability.rawWeights = { data155: reliability.rawDataWeight, "plot-embeddinggemma": 1 - reliability.rawDataWeight };
        reliability.dataWeight = Math.min(MAX_BRANCH_WEIGHT, Math.max(MIN_BRANCH_WEIGHT, reliability.rawDataWeight));
        reliability.plotWeight = 1 - reliability.dataWeight;
        reliability.weights = { data155: reliability.dataWeight, "plot-embeddinggemma": reliability.plotWeight };
        reliability.fallbackReason = null;
    }
    const weights = [reliability.dataWeight, reliability.plotWeight];
    options.onProgress?.({ phase: "training", stage: `${label}: надёжность данных и сюжета`, completed: 1, total: 1 }); await tick();
    return { weights: reliability.weights, reliability, validation: mixtureScore(weights, matrix, actual), equal: mixtureScore([0.5, 0.5], matrix, actual), evaluatedMixtures: 1 };
}

async function fitParameters(pool, prepared, options, label) {
    const { c, modelCorpora } = prepared;
    const records = [], plotScores = Object.fromEntries(MODEL_KEYS.map(key => [key, GRID.map(() => emptyScore())]));
    for (let fold = 0; fold < 4; fold++) {
        checkCancelled(options);
        const validation = pool.filter(item => core.foldFor(item.group, 4, "inner-v2") === fold);
        const trainSet = pool.filter(item => core.foldFor(item.group, 4, "inner-v2") !== fold);
        if (trainSet.length < MIN_PEERS) continue;
        for (let index = 0; index < validation.length; index++) {
            checkCancelled(options);
            const target = validation[index], context = fit(trainSet, target, options), ranking = ranks(target, c);
            const data = DATA_LIMITS.map(k => calculateData(target, context, ranking, false, k));
            const plots = Object.fromEntries(MODEL_KEYS.map(key => [key, plotGrid(context, ranks(target, modelCorpora[key], true))]));
            for (const key of MODEL_KEYS) for (let g = 0; g < GRID.length; g++) scoreAdd(plotScores[key][g], plots[key][g], target.rating);
            records.push({ group: target.group, actual: target.rating, data, plots });
            if (index % 16 === 0) { options.onProgress?.({ phase: "training", stage: `${label}: отдельные сюжетные модели`, fold: fold + 1, folds: 4, completed: index + 1, total: validation.length }); await tick(); }
        }
    }
    const plots = {}, plotValidation = {}, bestIndices = {};
    for (const key of MODEL_KEYS) {
        let best = null, bestIndex = -1;
        for (let g = 0; g < GRID.length; g++) { const candidate = { ...scoreResult(plotScores[key][g]), parameters: GRID[g] }; if (betterPlot(candidate, best)) { best = candidate; bestIndex = g; } }
        plots[key] = best?.count ? { ...best.parameters } : { ...DEFAULT_PLOT };
        plotValidation[key] = best?.count ? best : { count: 0, mae: null, rmse: null, reason: "Нет готовых сюжетных векторов во внутренней проверке" };
        bestIndices[key] = best?.count ? bestIndex : -1;
    }
    const matrix = new Float64Array(records.length * BRANCHES.length), actual = new Float64Array(records.length);
    for (let row = 0; row < records.length; row++) { const record = records[row]; actual[row] = record.actual; matrix.set([...record.data, ...MODEL_KEYS.map(key => bestIndices[key] < 0 ? NaN : record.plots[key][bestIndices[key]])], row * BRANCHES.length); }
    const mixture = await tuneMixture(matrix, actual, records, options, label);
    return { parameters: { plots, weights: mixture.weights, reliability: mixture.reliability }, validation: { plots: plotValidation, mixture: mixture.validation, equal: mixture.equal, reliability: mixture.reliability, evaluatedMixtures: mixture.evaluatedMixtures }, fitCount: pool.length, validationCount: records.length };
}

async function train(items, vectorSets = {}, options = {}) {
    const prepared = options.prepared || prepare(items, vectorSets), { c, modelCorpora } = prepared, pool = c.rated;
    if (pool.length < 40) throw new Error("Для вложенной проверки нужно не менее 40 оценённых карточек");
    const training = {
        version: VERSION, engine: ENGINE, createdAt: new Date().toISOString(), ratedCount: pool.length, groupCount: new Set(pool.map(item => item.group)).size,
        folds: {}, groupFolds: {}, outer: {}, global: null, metrics: {},
        temporal: { method: "exponential-watch-distance", halfLifeDays: core.TEMPORAL_HALF_LIFE_DAYS, asOfDate: core.calendarDate(options.asOfDate), missingDateWeight: 1, anchor: "Each target's viewing date, falling back only to the explicitly supplied asOfDate", appliesTo: ["mean", "public-rating calibration", "category residuals", "data-neighbor weights", "plot-neighbor weights", "all inner and outer validation predictions"] },
        crossValidation: { outerFolds: 5, innerFolds: 4, grouping: "connected IMDb/KP identity", split: "stable FNV-1a hash, label independent", selection: "Plot independently: MAE, RMSE, k, temperature, smoothing. Mixture: inverse MAE on paired inner-held-out predictions, each source limited to 25–75%; fewer than 30 paired targets/identity groups or invalid/zero errors: 50/50.", reliability: { method: "inverse-mae", minimumPairedCount: MIN_PAIRED_VALIDATION, minWeight: MIN_BRANCH_WEIGHT, maxWeight: MAX_BRANCH_WEIGHT, formula: RELIABILITY_FORMULA }, grid: { dataNeighbors: DATA_LIMITS, plotNeighbors: [10, 20, 35, 55, 100, 155], temperature: [0.03, 0.07, 0.15], smoothing: [0, 3, 10] } }
    };
    for (const target of pool) { training.folds[target.path] = core.foldFor(target.group); training.groupFolds[target.group] = core.foldFor(target.group); }
    const metricKeys = [...BRANCHES.map(branch => branch.id), "half", "tuned"];
    const scores = Object.fromEntries(metricKeys.map(key => [key, emptyScore()]));
    for (let outer = 0; outer < 5; outer++) {
        checkCancelled(options);
        const trainSet = pool.filter(item => core.foldFor(item.group) !== outer), validation = pool.filter(item => core.foldFor(item.group) === outer);
        options.onProgress?.({ phase: "training", stage: `Внешняя группа ${outer + 1}/5`, completed: outer, total: 6 }); await tick();
        const fitted = await fitParameters(trainSet, prepared, options, `Группа ${outer + 1}/5`);
        training.outer[String(outer)] = fitted;
        const foldScores = Object.fromEntries(metricKeys.map(key => [key, emptyScore()]));
        for (let index = 0; index < validation.length; index++) {
            checkCancelled(options);
            const target = validation[index], context = fit(trainSet, target, options), ranking = ranks(target, c);
            const values = [...DATA_LIMITS.map(k => calculateData(target, context, ranking, false, k)), ...MODEL_KEYS.map(key => calculatePlot(target, context, ranks(target, modelCorpora[key], true), fitted.parameters.plots[key]))];
            const predictions = { ...Object.fromEntries(BRANCHES.map(({ id }, i) => [id, values[i]])), half: mix(values, equalWeights()).raw, tuned: mix(values, fitted.parameters.weights).raw };
            for (const [key, prediction] of Object.entries(predictions)) { scoreAdd(scores[key], prediction, target.rating); scoreAdd(foldScores[key], prediction, target.rating); }
            if (index % 12 === 0) { options.onProgress?.({ phase: "validating", stage: `Группа ${outer + 1}/5`, completed: index + 1, total: validation.length }); await tick(); }
        }
        fitted.metrics = Object.fromEntries(Object.entries(foldScores).map(([key, score]) => [key, scoreResult(score)]));
    }
    training.global = await fitParameters(pool, prepared, options, "Параметры для новых карточек");
    training.metrics = Object.fromEntries(Object.entries(scores).map(([key, score]) => [key, scoreResult(score)]));
    training.metrics.note = "Независимая внешняя проверка 5×4: оценки внешней группы не участвуют ни в обучении, ни в подборе сюжетных параметров или веса. EmbeddingGemma подбирается по собственной ошибке. Веса источников обратно пропорциональны MAE на одних и тех же внутренних проверочных карточках и ограничены диапазоном 25–75%; при менее 30 парах/произведениях или нулевой/недоступной сумме ошибок используются 50/50. tuned означает эту смесь по надёжности, half — отдельное сравнение 50/50. Ошибки до округления. При отсутствии сюжета используется data155, результат предварительный. Улучшение относительно отдельного источника не гарантируется: его определяет только внешняя проверка.";
    options.onProgress?.({ phase: "trained", completed: 6, total: 6 });
    return training;
}

module.exports = { VERSION, ENGINE, MODEL_KEYS, DATA_LIMITS, BRANCHES, GRID, DEFAULT_PARAMETERS: defaults(), forecast, train, prepare, mix };
