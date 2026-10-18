/*
 * Experimental, local rating forecasts. No app, filesystem or network access.
 * Predictors: author, work type (missing = book), series. Never uses dates,
 * reading counts, review text, titles or the target's rating as predictors.
 *
 * Validation is retrospective, not a claim about a historical forecast:
 * - Candidate selection for a rated row excludes its entire outer fold.
 * - Its final training set excludes the row itself.
 * - All smoothing constants and the simplicity tolerance are fixed below.
 * This also keeps the target out of parameter/model selection.
 */
(function () {
  "use strict";

  const VERSION = "1.0.0";
  const SHRINKAGE = Object.freeze({ type: 12, author: 8, series: 6 });
  const SIMPLICITY_TOLERANCE = 0.02;
  const CANDIDATES = Object.freeze([
    Object.freeze({ id: "mean", name: "Общее среднее", complexity: 0 }),
    Object.freeze({ id: "median", name: "Общая медиана", complexity: 0 }),
    Object.freeze({ id: "type", name: "Тип произведения", complexity: 1, type: true }),
    Object.freeze({ id: "author", name: "Автор", complexity: 1, author: true }),
    Object.freeze({ id: "typeAuthor", name: "Тип + автор", complexity: 2, type: true, author: true }),
    Object.freeze({ id: "typeAuthorSeries", name: "Тип + автор + серия", complexity: 3, type: true, author: true, series: true }),
  ]);

  function cleanText(value) {
    return typeof value === "string" ? value.normalize("NFC").trim().replace(/\s+/g, " ") : "";
  }

  function key(value) {
    return cleanText(value).toLowerCase();
  }

  function displayText(value) {
    let text = cleanText(value);
    const wiki = text.match(/^\[\[([^\]]+)\]\]$/);
    if (wiki) {
      const parts = wiki[1].split("|");
      text = parts.length > 1 ? parts[parts.length - 1] : parts[0].split("/").pop();
      text = text.replace(/\.md$/i, "");
    }
    return cleanText(text);
  }

  function list(value) {
    const values = Array.isArray(value) ? value : value == null ? [] : [value];
    const seen = new Map();
    for (const value of values) {
      const text = displayText(value);
      if (text && !seen.has(key(text))) seen.set(key(text), text);
    }
    return [...seen.entries()].sort((a, b) => compare(a[0], b[0])).map(entry => entry[1]);
  }

  function compare(a, b) {
    return a < b ? -1 : a > b ? 1 : 0;
  }

  function parseRating(value) {
    if (typeof value === "string") {
      value = value.trim();
      if (!/^\d+(?:[.,]\d+)?$/.test(value)) return null;
      value = Number(value.replace(",", "."));
    }
    return typeof value === "number" && Number.isFinite(value) && value >= 1 && value <= 10 ? value : null;
  }

  function normalizeRecord(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const path = cleanText(value.path).replace(/\\/g, "/");
    if (!path) return null;
    const title = cleanText(value.title) || path.split("/").pop().replace(/\.md$/i, "");
    const rawType = key(displayText(value.type));
    const aliases = { "книга": "book", "рассказ": "story", "повесть": "novella", "роман": "novel" };
    return {
      path,
      title,
      authors: list(value.authors),
      type: aliases[rawType] || rawType || "book",
      series: list(value.series),
      rating: parseRating(value.rating),
      date: typeof value.date === "string" ? value.date : null,
    };
  }

  function canonicalRecords(rawRecords) {
    const recordsByPath = new Map();
    let invalidCount = 0;
    let duplicateCount = 0;
    for (const value of Array.isArray(rawRecords) ? rawRecords : []) {
      const record = normalizeRecord(value);
      if (!record) { invalidCount++; continue; }
      const pathKey = key(record.path);
      const old = recordsByPath.get(pathKey);
      if (old) {
        duplicateCount++;
        // A duplicate must not gain extra weight. Prefer a rated record, then
        // a stable lexical representation, independent of input order.
        const oldRank = (old.rating == null ? "1" : "0") + JSON.stringify(old);
        const newRank = (record.rating == null ? "1" : "0") + JSON.stringify(record);
        if (newRank < oldRank) recordsByPath.set(pathKey, record);
      } else recordsByPath.set(pathKey, record);
    }
    return {
      records: [...recordsByPath.values()].sort((a, b) => compare(key(a.path), key(b.path))),
      invalidCount,
      duplicateCount,
    };
  }

  function mean(values) {
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
  }

  function median(values) {
    if (!values.length) return null;
    const ordered = [...values].sort((a, b) => a - b);
    const middle = Math.floor(ordered.length / 2);
    return ordered.length % 2 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2;
  }

  function clamp(value) {
    return Math.max(1, Math.min(10, value));
  }

  function averageEffect(effects, values) {
    if (!values.length) return 0;
    return values.reduce((sum, value) => sum + (effects.get(key(value)) || 0), 0) / values.length;
  }

  function effectsFor(records, getValues, getResidual, shrinkage) {
    const groups = new Map();
    for (const record of records) {
      const residual = getResidual(record);
      for (const value of getValues(record)) {
        const groupKey = key(value);
        const group = groups.get(groupKey) || { n: 0, sum: 0 };
        group.n++;
        group.sum += residual;
        groups.set(groupKey, group);
      }
    }
    return new Map([...groups].map(([groupKey, group]) => [groupKey, group.sum / (group.n + shrinkage)]));
  }

  function fitModel(records, candidate) {
    const base = candidate.id === "median" ? median(records.map(r => r.rating)) : mean(records.map(r => r.rating));
    const fitted = { candidate, base, type: new Map(), author: new Map(), series: new Map() };
    if (base == null) return fitted;
    if (candidate.type) fitted.type = effectsFor(records, r => [r.type], r => r.rating - base, SHRINKAGE.type);
    const typeEffect = r => fitted.type.get(key(r.type)) || 0;
    if (candidate.author) fitted.author = effectsFor(records, r => r.authors, r => r.rating - base - typeEffect(r), SHRINKAGE.author);
    const authorEffect = r => averageEffect(fitted.author, r.authors);
    if (candidate.series) fitted.series = effectsFor(records, r => r.series, r => r.rating - base - typeEffect(r) - authorEffect(r), SHRINKAGE.series);
    return fitted;
  }

  function predict(fitted, record) {
    if (fitted.base == null) return { raw: null, unclamped: null, contributions: null };
    const contributions = {
      base: fitted.base,
      type: fitted.type.get(key(record.type)) || 0,
      author: averageEffect(fitted.author, record.authors),
      series: averageEffect(fitted.series, record.series),
    };
    const unclamped = Object.values(contributions).reduce((sum, value) => sum + value, 0);
    return { raw: clamp(unclamped), unclamped, contributions };
  }

  function foldFor(record, salt, count = 5) {
    // FNV-1a over the normalized path, never over ratings or input order.
    let hash = 2166136261;
    const text = salt + ":" + key(record.path);
    for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619) >>> 0;
    return hash % count;
  }

  function metrics(pairs) {
    const valid = pairs.filter(pair => Number.isFinite(pair.actual) && Number.isFinite(pair.predicted));
    if (!valid.length) return { n: 0, mae: null, rmse: null, within1: null, within1Count: 0, residual80: null };
    const errors = valid.map(pair => Math.abs(pair.actual - pair.predicted));
    const sorted = [...errors].sort((a, b) => a - b);
    const within1Count = errors.filter(error => error <= 1).length;
    return {
      n: valid.length,
      mae: mean(errors),
      rmse: Math.sqrt(mean(errors.map(error => error * error))),
      within1: within1Count / valid.length,
      within1Count,
      // Descriptive held-out error quantile, not a calibrated interval.
      residual80: sorted[Math.max(0, Math.ceil(sorted.length * 0.8) - 1)],
    };
  }

  function candidateScores(records) {
    return CANDIDATES.map(candidate => {
      const pairs = [];
      for (let fold = 0; fold < 5; fold++) {
        const training = records.filter(r => foldFor(r, "inner") !== fold);
        const heldOut = records.filter(r => foldFor(r, "inner") === fold);
        const fitted = fitModel(training, candidate);
        for (const record of heldOut) pairs.push({ actual: record.rating, predicted: predict(fitted, record).raw });
      }
      return { id: candidate.id, name: candidate.name, complexity: candidate.complexity, ...metrics(pairs) };
    });
  }

  function selectCandidate(scores) {
    const available = scores.filter(score => score.n && score.mae != null);
    if (!available.length) return CANDIDATES[0];
    const bestMae = Math.min(...available.map(score => score.mae));
    const close = available.filter(score => score.mae <= bestMae + SIMPLICITY_TOLERANCE);
    close.sort((a, b) => a.complexity - b.complexity || a.mae - b.mae || compare(a.id, b.id));
    return CANDIDATES.find(candidate => candidate.id === close[0].id);
  }

  function rowEvidence(record, training, candidate, prediction) {
    const authors = new Set(record.authors.map(key));
    const series = new Set(record.series.map(key));
    const hasAuthor = r => r.authors.some(author => authors.has(key(author)));
    const hasSeries = r => r.series.some(value => series.has(key(value)));
    const support = {
      author: training.filter(hasAuthor).length,
      series: training.filter(hasSeries).length,
      type: training.filter(r => r.type === record.type).length,
      total: training.length,
    };
    let evidence;
    if (prediction.raw == null) evidence = "Недостаточно других оценок для прогноза";
    else if (!support.author) evidence = "Автор без истории оценок; " + (candidate.type && support.type ? `ориентир по типу · оценок: ${support.type}` : "общий ориентир");
    else if (candidate.complexity === 0) evidence = "Общий ориентир: признаки не улучшили проверку достаточно";
    else if (!candidate.author && candidate.type) evidence = `Ориентир по типу · оценок: ${support.type}`;
    else if (support.author < 5) evidence = "Мало оценок автора; сильное сглаживание к общему уровню";
    else evidence = "Есть оценки автора; экспериментальная оценка";
    const matching = training.filter(r => hasAuthor(r) || hasSeries(r) || (candidate.type && r.type === record.type));
    matching.sort((a, b) => {
      const rank = r => (hasAuthor(r) ? 4 : 0) + (hasSeries(r) ? 2 : 0) + (r.type === record.type ? 1 : 0);
      return rank(b) - rank(a) || compare(key(a.path), key(b.path));
    });
    const examples = matching.slice(0, 4).map(r => ({ path: r.path, title: r.title, authors: [...r.authors], rating: r.rating, type: r.type, series: [...r.series] }));
    return { support, evidence, examples };
  }

  function buildForecast(rawRecords) {
    const { records, invalidCount, duplicateCount } = canonicalRecords(rawRecords);
    const rated = records.filter(record => record.rating != null);
    const finalScores = candidateScores(rated);
    const finalCandidate = selectCandidate(finalScores);
    const finalFit = fitModel(rated, finalCandidate);
    const foldCandidates = new Map();
    for (let fold = 0; fold < 5; fold++) {
      const available = rated.filter(record => foldFor(record, "outer") !== fold);
      foldCandidates.set(fold, selectCandidate(candidateScores(available)));
    }
    const rows = records.map(record => {
      const isRated = record.rating != null;
      const training = isRated ? rated.filter(other => other.path !== record.path) : rated;
      const candidate = isRated ? foldCandidates.get(foldFor(record, "outer")) : finalCandidate;
      const fitted = isRated ? fitModel(training, candidate) : finalFit;
      const prediction = predict(fitted, record);
      return {
        ...record,
        forecast: prediction.raw,
        ...prediction,
        delta: isRated && prediction.raw != null ? record.rating - prediction.raw : null,
        ...rowEvidence(record, training, candidate, prediction),
        modelId: candidate.id,
        modelName: candidate.name,
        validationMode: isRated ? "leave-one-out" : "unrated",
      };
    });
    const validation = metrics(rows.filter(row => row.rating != null).map(row => ({ actual: row.rating, predicted: row.raw })));
    const baselinePairs = { mean: [], median: [], author: [] };
    for (const record of rated) {
      const training = rated.filter(other => other.path !== record.path);
      for (const id of Object.keys(baselinePairs)) {
        const fitted = fitModel(training, CANDIDATES.find(candidate => candidate.id === id));
        baselinePairs[id].push({ actual: record.rating, predicted: predict(fitted, record).raw });
      }
    }
    const baselines = Object.fromEntries(Object.entries(baselinePairs).map(([name, pairs]) => [name, metrics(pairs)]));
    return {
      version: VERSION,
      rows,
      ratedCount: rated.length,
      unratedCount: records.length - rated.length,
      totalCount: records.length,
      invalidCount,
      duplicateCount,
      validation: {
        ...validation,
        mode: "retrospective-nested-selection-loo-fit",
        description: "Ретроспективная проверка: модель выбрана без всей группы проверяемой строки; обучение без самой строки. Это не исторический прогноз.",
        baselines,
        baselineMae: baselines.mean.mae,
        baselineRmse: baselines.mean.rmse,
        baselineWithin1: baselines.mean.within1,
        baselineMedianMae: baselines.median.mae,
        authorBaselineMae: baselines.author.mae,
        candidateScores: finalScores,
        foldModels: [...foldCandidates].map(([fold, candidate]) => ({ fold, id: candidate.id, name: candidate.name })),
      },
      model: {
        id: finalCandidate.id,
        name: finalCandidate.name,
        features: [finalCandidate.type && "type", finalCandidate.author && "authors", finalCandidate.series && "series"].filter(Boolean),
        availableFeatures: ["authors", "type", "series"],
        shrinkage: { ...SHRINKAGE },
        simplicityTolerance: SIMPLICITY_TOLERANCE,
        selection: "5-fold MAE; prefer simpler candidate within 0.02",
        formula: "mean + type residual/(n+12) + author residual/(n+8) + series residual/(n+6); disabled features contribute 0; median candidate uses median only",
        missingType: "book",
        base: finalFit.base,
        candidateScores: finalScores,
      },
    };
  }

  module.exports = { buildForecast, normalizeRecord, parseRating, metrics, VERSION };
})();
