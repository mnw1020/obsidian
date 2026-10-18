/* Shared forecast orchestration. Uses Vault APIs on desktop and Android. */
const BASE = 'Кино/_system/Прогноз';
const VERSION = 'kino-forecast-v6';
const MODEL_KEYS = ['embeddinggemma'];
const OBSOLETE_FIELDS = ['Прогноз данные 55', 'Прогноз данные 100', 'Прогноз данные 155', 'Прогноз E5-small', 'Прогноз E5-base', 'Прогноз EmbeddingGemma'];
const states = new WeakMap();
const text = value => String(value ?? '').trim();
const pause = () => new Promise(resolve => setTimeout(resolve, 0));
function referenceDate(params) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(text(params.asOfDate))) return text(params.asOfDate);
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
function media(app, file) {
    if (!file || !/^Кино\/Media\/[^/]+\.md$/i.test(file.path)) return false;
    const tags = app.metadataCache.getFileCache(file)?.frontmatter?.tags;
    return (Array.isArray(tags) ? tags : [tags]).some(tag => ['movies', 'serial'].includes(text(tag).replace(/^#/, '')));
}
async function load(app, name, dependencies = {}) {
    const file = app.vault.getAbstractFileByPath(`Кино/_system/${name}.js`);
    if (!file) throw Error(`Не найден ${name}.js`);
    const module = {exports: {}};
    const localRequire = id => { if (Object.hasOwn(dependencies, id)) return dependencies[id]; throw Error(`Недоступная зависимость: ${id}`); };
    new Function('module', 'exports', 'require', await app.vault.read(file))(module, module.exports, localRequire);
    return module.exports;
}
async function folders(app, path) {
    const parts = path.split('/');
    for (let index = 1; index <= parts.length; index++) {
        const next = parts.slice(0, index).join('/');
        if (!app.vault.getAbstractFileByPath(next)) {
            try { await app.vault.createFolder(next); }
            catch (error) { if (!app.vault.getAbstractFileByPath(next)) throw error; }
        }
    }
}
async function readJson(app, path, fallback) {
    const file = app.vault.getAbstractFileByPath(path);
    if (!file) return fallback;
    try { return JSON.parse(await app.vault.read(file)); }
    catch (error) { throw Error(`Не удалось прочитать ${path}: ${error.message}`); }
}
async function writeJson(app, path, value) {
    await folders(app, path.slice(0, path.lastIndexOf('/')));
    const content = JSON.stringify(value);
    const file = app.vault.getAbstractFileByPath(path);
    if (!file) await app.vault.create(path, content);
    else if (await app.vault.read(file) !== content) {
        if (app.vault.process) await app.vault.process(file, () => content);
        else await app.vault.modify(file, content);
    }
}
async function maintenanceBusy(params) {
    const queue = await readJson(params.app, `${BASE}/queue.json`, null);
    const active = queue?.maintenance;
    return Boolean(active?.token && Date.parse(active.expiresAt) > Date.now() && active.token !== params.maintenanceToken);
}
async function checkMaintenance(params) {
    if (await maintenanceBusy(params)) throw Error('Выполняется полный пересчёт прогнозов. Дождись его завершения.');
}
async function hash(value) {
    const bytes = new TextEncoder().encode(typeof value === 'string' ? value : JSON.stringify(value));
    const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}
function abort(params) {
    if (params.shouldCancel?.()) { const error = Error('Расчёт отменён'); error.name = 'AbortError'; throw error; }
}
async function coreFor(app) {
    let state = states.get(app);
    if (!state) { state = {corePromise: load(app, 'forecast_core'), overrides: new Map(), lane: Promise.resolve()}; states.set(app, state); }
    if (!state.core) state.core = await state.corePromise;
    if (!state.enginePromise) state.enginePromise = load(app, 'forecast_ensemble', {'./forecast_core.js': state.core});
    if (!state.engine) state.engine = await state.enginePromise;
    return state;
}
async function locked(app, action) {
    const state = await coreFor(app), previous = state.lane;
    let release;
    state.lane = new Promise(resolve => { release = resolve; });
    await previous.catch(() => {});
    app.__kinoForecastBusy = (app.__kinoForecastBusy || 0) + 1;
    try { return await action(); } finally { app.__kinoForecastBusy--; if (!app.__kinoForecastBusy) delete app.__kinoForecastBusy; release(); }
}
function fmFor(app, file, state) {
    const fm = app.metadataCache.getFileCache(file)?.frontmatter || {};
    const pending = state.overrides.get(file.path);
    if (!pending) return fm;
    if (text(fm['Описание']) === pending.description || text(fm['Описание']) !== pending.original || (pending.mtime != null && file.stat?.mtime !== pending.mtime)) {
        state.overrides.delete(file.path); return fm;
    }
    return {...fm, 'Описание': pending.description};
}
async function itemsFor(app, state) {
    const items = [];
    for (const file of app.vault.getMarkdownFiles().filter(file => media(app, file))) {
        const fm = fmFor(app, file, state);
        const rolePath = text(fm['Роли файл']).replace(/^\[\[|\]\]$/g, '').split('|')[0];
        let role;
        if (rolePath) {
            role = app.metadataCache.getFirstLinkpathDest?.(rolePath, file.path)
                || app.vault.getAbstractFileByPath(rolePath) || app.vault.getAbstractFileByPath(rolePath + '.md');
        }
        const actors = role ? app.metadataCache.getFileCache(role)?.frontmatter?.['Актеры'] || [] : [];
        items.push(state.core.feature(file, fm, actors));
    }
    return state.core.assignGroups ? state.core.assignGroups(items) : items;
}
async function trainingFor(params, items, semantic, state, prepared) {
    const {app} = params;
    const previous = await readJson(app, `${BASE}/training.json`, null);
    const rated = items.filter(item => Number.isFinite(item.rating) && item.rating >= 1 && item.rating <= 10);
    // Only training inputs are fingerprinted: writing forecast fields must not
    // trigger another calibration. Sorting makes vault enumeration irrelevant.
    const inputFingerprint = await hash({
        engine: state.engine.ENGINE, models: semantic.models,
        undatedReferenceDate: rated.some(item => !item.watchDate) ? params.asOfDate : null,
        rated: rated.map(item => ({...item, vectors: Object.fromEntries(MODEL_KEYS.map(key => [key,
            semantic.vectors[key]?.[item.path] ? semantic.caches[key]?.entries?.[item.path]?.hash || null : null
        ]))})).sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0)
    });
    const compatible = previous?.version === state.engine.VERSION && previous?.engine === state.engine.ENGINE
        && JSON.stringify(previous.models) === JSON.stringify(semantic.models);
    if (compatible && previous.inputFingerprint === inputFingerprint && !params.retrain) return previous;
    abort(params);
    if (rated.length < 40 || !MODEL_KEYS.every(key => Object.keys(semantic.vectors[key] || {}).length >= 30)) return null;
    params.onProgress?.({phase: 'training', stage: 'Проверка точности по актуальным личным оценкам', completed: 0, total: 5});
    const training = await state.engine.train(items, semantic.vectors, {onProgress: params.onProgress, shouldCancel: params.shouldCancel, asOfDate: params.asOfDate, prepared});
    // Clearing a previously known personal rating must not switch that card
    // from its withheld outer group to parameters selected on the whole base.
    for (const item of items) if (Number.isInteger(previous?.folds?.[item.path])) {
        const fold = state.core.foldFor(item.group);
        training.folds[item.path] = fold;
        training.groupFolds[item.group] = fold;
    }
    training.models = semantic.models;
    training.inputFingerprint = inputFingerprint;
    training.refresh = {trigger: 'training-input-change-or-explicit-retrain', checkedAt: new Date().toISOString(),
        formula: 'Revalidate when personal ratings, viewing dates, rated-card features, descriptions, vectors, model or engine change; undated training targets also depend on the reference date.'};
    await writeJson(app, `${BASE}/training.json`, training);
    return training;
}
async function enrich(params, files, state) {
    const {app, obsidian = {}} = params;
    const results = [];
    const weak = files.filter(file => text(fmFor(app, file, state)['Описание']).length < 80);
    if (!weak.length) return results;
    const source = app.vault.getAbstractFileByPath('Кино/_system/Examples_Attachments_movies.js');
    const key = source && (await app.vault.read(source)).match(/^const KP_API_KEY\s*=\s*['"]([^'"]+)['"]/m)?.[1];
    for (let index = 0; index < weak.length; index++) {
        abort(params);
        const file = weak[index], fm = fmFor(app, file, state);
        const id = text(fm['Кинопоиск ID']);
        params.onProgress?.({phase: 'descriptions', completed: index, total: weak.length, path: file.path});
        if (!/^\d+$/.test(id) || !key || !obsidian.requestUrl) {
            results.push({path: file.path, updated: false, reason: 'Нет ID Кинопоиска или доступного запроса'}); continue;
        }
        try {
            let timer;
            const response = await Promise.race([
                obsidian.requestUrl({url: `https://kinopoiskapiunofficial.tech/api/v2.2/films/${id}`, headers: {'X-API-KEY': key, Accept: 'application/json'}, throw: false}),
                new Promise((_, reject) => { timer = setTimeout(() => reject(Error('Время ожидания Кинопоиска истекло')), 20000); })
            ]).finally(() => clearTimeout(timer));
            const data = response.json || JSON.parse(response.text || '{}');
            if (response.status < 200 || response.status >= 300) throw Error(`Кинопоиск HTTP ${response.status}`);
            const description = [data.description, data.shortDescription].map(text).filter(value => state.core.validDescription(value)).sort((a, b) => b.length - a.length)[0] || '';
            if (description.length <= text(fm['Описание']).length || !state.core.validDescription(description)) {
                results.push({path: file.path, updated: false, reason: 'Кинопоиск не дал более содержательный сюжет'}); continue;
            }
            let applied = false;
            await app.fileManager.processFrontMatter(file, current => {
                if (text(current['Описание']) !== text(fm['Описание'])) return;
                current['Описание'] = description; applied = true;
            });
            if (applied) state.overrides.set(file.path, {description, original: text(fm['Описание']), mtime: file.stat?.mtime});
            results.push({path: file.path, updated: applied, source: `https://www.kinopoisk.ru/${data.type === 'FILM' ? 'film' : 'series'}/${id}/`, previous: fm['Описание'], description: applied ? description : undefined, reason: applied ? undefined : 'Описание одновременно изменено пользователем'});
        } catch (error) { results.push({path: file.path, updated: false, reason: String(error.message || error)}); }
    }
    params.onProgress?.({phase: 'descriptions', completed: weak.length, total: weak.length});
    return results;
}
async function embeddings(params, items, state, extra = []) {
    const {app} = params;
    let runtimeModule, runtimeError = '', manifest;
    try { runtimeModule = await load(app, 'semantic_runtime'); }
    catch (error) { runtimeError = String(error.message || error); }
    try { manifest = await readJson(app, `${BASE}/runtime/manifest.json`, null); }
    catch (error) { runtimeError ||= String(error.message || error); }
    const configured = runtimeModule?.MODELS || manifest?.models || (runtimeModule?.MODEL ? [runtimeModule.MODEL] : manifest?.model ? [manifest.model] : []);
    const sourceModels = Array.isArray(configured) ? configured : Object.values(configured);
    const models = MODEL_KEYS.map(key => sourceModels.find(model => model.key === key) || {key, label: 'EmbeddingGemma', dimensions: 768});
    const identity = model => JSON.stringify(Object.fromEntries(['id','revision','dtype','dimensions','libraryVersion','onnxVersion','maxTokens','prefix','pooling','normalize'].map(key => [key, model?.[key]])));
    const validVector = (vector, dimensions) => Array.isArray(vector) && vector.length === dimensions && vector.every(Number.isFinite) && vector.some(value => value !== 0);
    const desired = [];
    for (const item of new Map([...items, ...extra].map(item => [item.path, item])).values()) {
        if (state.core.validDescription(item.description)) desired.push({item, hash: await hash(text(item.description))});
    }
    const vectors = {}, caches = {}, errors = {};
    for (let modelIndex = 0; modelIndex < MODEL_KEYS.length; modelIndex++) {
        abort(params);
        const key = MODEL_KEYS[modelIndex], model = {...models[modelIndex], key};
        models[modelIndex] = model;
        const cachePath = `${BASE}/embeddings.json`;
        let cache;
        try { cache = await readJson(app, cachePath, null); }
        catch (error) { errors[key] = String(error.message || error); }
        cache ||= {version: 4, model, entries: {}};
        if (identity(cache.model) !== identity(model)) cache.entries = {};
        cache.model = model;
        cache.entries ||= {};
        const wanted = desired.filter(entry => cache.entries[entry.item.path]?.hash !== entry.hash || !validVector(cache.entries[entry.item.path]?.vector, model.dimensions));
        let runtime;
        try {
            if (wanted.length) {
                if (!runtimeModule) throw Error(runtimeError || 'Локальная модель недоступна');
                runtime = await runtimeModule.create({app, modelKey: key, onProgress: value => {
                    if (value.phase !== 'embedding') params.onProgress?.({...value, phase: 'model', model: key, modelIndex: modelIndex + 1, modelCount: MODEL_KEYS.length});
                }});
                if (identity(runtime.model) !== identity(model)) throw Error(`Версия модели ${key} не совпадает с настройками`);
                const size = app.isMobile ? 1 : 4;
                for (let offset = 0; offset < wanted.length; offset += size) {
                    abort(params);
                    const batch = wanted.slice(offset, offset + size);
                    const values = await runtime.embed(batch.map(entry => entry.item.description), {shouldCancel: params.shouldCancel});
                    if (values.length !== batch.length) throw Error('Модель вернула неверное число сюжетных векторов');
                    for (let index = 0; index < batch.length; index++) {
                        const entry = batch[index], value = values[index];
                        if (!validVector(value.vector, model.dimensions)) throw Error(`Некорректный вектор ${key}`);
                        cache.entries[entry.item.path] = {hash: entry.hash, vector: value.vector, tokens: value.tokens, usedTokens: value.usedTokens, truncated: Boolean(value.truncated)};
                    }
                    if (offset % 32 === 0 || offset + size >= wanted.length) await writeJson(app, cachePath, cache);
                    params.onProgress?.({phase: 'embeddings', model: key, modelIndex: modelIndex + 1, modelCount: MODEL_KEYS.length, completed: Math.min(offset + size, wanted.length), total: wanted.length});
                    await pause();
                }
                delete errors[key];
            }
        } catch (error) {
            if (error.name === 'AbortError' && params.shouldCancel?.()) throw error;
            errors[key] = String(error.message || error);
        } finally { runtime?.dispose?.(); }
        await writeJson(app, cachePath, cache);
        caches[key] = cache;
        vectors[key] = {};
        for (const entry of desired) {
            const stored = cache.entries[entry.item.path];
            if (stored?.hash === entry.hash && validVector(stored.vector, model.dimensions)) vectors[key][entry.item.path] = stored.vector;
        }
    }
    return {vectors, caches, models, errors, reason: Object.entries(errors).map(([key, reason]) => `${key}: ${reason}`).join('; ')};
}
async function calculate(params) {
    params = {...params, asOfDate: referenceDate(params)};
    await checkMaintenance(params);
    const {app} = params, state = await coreFor(app);
    const requested = params.forecastFiles || [params.targetFile || app.workspace.getActiveFile()];
    const files = requested.filter(file => media(app, file));
    const queue = await readJson(app, `${BASE}/queue.json`, {version: 5, entries: {}});
    queue.version = 5;
    for (const file of files) queue.entries[file.path] = {reason: 'Ожидает завершения расчёта', at: new Date().toISOString()};
    await writeJson(app, `${BASE}/queue.json`, queue);
    const descriptions = params.prepareDescriptions === false ? [] : await enrich(params, files, state);
    const items = await itemsFor(app, state);
    abort(params);
    let semantic;
    try { semantic = await embeddings(params, items, state); }
    catch (error) { if (error.name === 'AbortError') return {results: [], cancelled: true, descriptions}; throw error; }
    const prepared = state.engine.prepare(items, semantic.vectors);
    const training = await trainingFor(params, items, semantic, state, prepared);
    const inputHash = await hash(items.map(item => ({...item, description: undefined})));
    const results = [], byPath = new Map(items.map(item => [item.path, item]));
    for (let index = 0; index < files.length; index++) {
        if (params.shouldCancel?.()) return {results, cancelled: true, descriptions};
        const file = files[index], target = byPath.get(file.path);
        try {
            const report = state.engine.forecast(items, target, semantic.vectors, training, {prepared, asOfDate: params.asOfDate});
            if (report.error) throw Error(report.error);
            report.version = state.engine.VERSION;
            report.models = semantic.models;
            report.model = semantic.models[0];
            report.training = {...report.training, inputHash, parameterVersion: training?.version, parameterCreatedAt: training?.createdAt,
                inputFingerprint: training?.inputFingerprint, refresh: training?.refresh};
            const descriptionHash = await hash(text(target.description));
            report.input = {descriptionHash, models: Object.fromEntries(MODEL_KEYS.map(key => {
                const cached = semantic.caches[key].entries[file.path];
                const entry = semantic.vectors[key][file.path] && cached?.hash === descriptionHash ? cached : null;
                return [key, {status: entry ? 'ready' : 'pending', tokens: entry?.tokens, usedTokens: entry?.usedTokens, truncated: entry ? Boolean(entry.truncated) : null}];
            }))};
            for (const key of MODEL_KEYS) if (report.plotVariants[key].raw == null && semantic.errors[key] && state.core.validDescription(target.description)) report.plotVariants[key].reason = semantic.errors[key];
            results.push({file, prediction: report.final.prediction, dataPrediction: report.data.prediction, plotPrediction: report.plot.prediction,
                branchPredictions: Object.fromEntries(report.branches.map(branch => [branch.id, branch.prediction])), real: target.rating, report, sourceSignature: await hash({...target, group: undefined}), sourceMtime: file.stat?.mtime});
        } catch (error) { results.push({file, error: String(error.message || error)}); }
        params.onProgress?.({phase: 'predicting', completed: index + 1, total: files.length});
        if (index % 8 === 0) await pause();
    }
    return {results, cancelled: false, descriptions, metrics: training?.metrics, semanticError: semantic.reason};
}
async function persist(params, estimate) {
    await checkMaintenance(params);
    const {app} = params, state = await coreFor(app), {file, report} = estimate;
    if (!file || !report || estimate.error) throw Error(estimate.error || 'Нет сохранённого расчёта');
    if (app.vault.getAbstractFileByPath(file.path) !== file) throw Error('Карточка перемещена во время расчёта');
    if (estimate.sourceMtime != null && file.stat?.mtime !== estimate.sourceMtime) throw Error('Карточка изменена во время расчёта; повтори обновление');
    const fm = fmFor(app, file, state), rolePath = text(fm['Роли файл']).replace(/^\[\[|\]\]$/g, '').split('|')[0];
    const role = rolePath && (app.metadataCache.getFirstLinkpathDest?.(rolePath, file.path) || app.vault.getAbstractFileByPath(rolePath) || app.vault.getAbstractFileByPath(rolePath + '.md'));
    const current = state.core.feature(file, fm, role ? app.metadataCache.getFileCache(role)?.frontmatter?.['Актеры'] || [] : []);
    if (await hash({...current, group: undefined}) !== estimate.sourceSignature) throw Error('Свойства карточки изменились во время расчёта; повтори обновление');
    const digest = (await hash({...report, createdAt: undefined})).slice(0, 20);
    const reportPath = `${BASE}/reports/${(await hash(file.path)).slice(0, 12)}-${digest}.json`;
    const existingReport = app.vault.getAbstractFileByPath(reportPath);
    if (!existingReport) await writeJson(app, reportPath, report);
    const savedCreatedAt = existingReport ? (await readJson(app, reportPath, report)).createdAt : report.createdAt;
    const missing = Object.entries(report.plotVariants).filter(([, plot]) => plot.raw == null).map(([key, plot]) => `${key}: ${plot.reason || 'ожидает расчёта'}`);
    const status = report.final.provisional ? `Предварительный: ${missing.join('; ') || report.final.reason || 'ожидает полного расчёта'}` : 'Готов';
    const fields = {
        'Прогноз оценки': Number(report.final.prediction).toFixed(1),
        'Прогноз по данным': Number(report.dataVariants['155'].prediction).toFixed(1),
        'Прогноз по сюжету': report.plotVariants.embeddinggemma.prediction == null ? null : Number(report.plotVariants.embeddinggemma.prediction).toFixed(1),
        'Расчёт прогноза': `[[${reportPath}]]`,
        'Статус прогноза': status,
        'Дата прогноза': savedCreatedAt || new Date().toISOString(),
        'Версия прогноза': VERSION
    };
    const previousReportPath = text(fm['Расчёт прогноза']).replace(/^\[\[|\]\]$/g, '').split('|')[0];
    await app.fileManager.processFrontMatter(file, fm => { Object.assign(fm, fields); for (const key of OBSOLETE_FIELDS) delete fm[key]; });
    const queue = await readJson(app, `${BASE}/queue.json`, {version: 5, entries: {}});
    queue.version = 5;
    if (report.final.provisional) queue.entries[file.path] = {reason: missing.join('; ') || report.final.reason, at: new Date().toISOString()};
    else delete queue.entries[file.path];
    await writeJson(app, `${BASE}/queue.json`, queue);
    if (previousReportPath !== reportPath && previousReportPath.startsWith(`${BASE}/reports/`) && !previousReportPath.includes('..') && app.vault.delete) {
        const used = app.vault.getMarkdownFiles().some(other => other.path !== file.path && text(app.metadataCache.getFileCache(other)?.frontmatter?.['Расчёт прогноза']).includes(previousReportPath));
        const obsoleteReport = !used && app.vault.getAbstractFileByPath(previousReportPath);
        if (obsoleteReport) { try { await app.vault.delete(obsoleteReport); } catch (error) { console.warn('Не удалось удалить прежний разбор прогноза:', error.message); } }
    }
    return {reportPath, provisional: report.final.provisional};
}
async function candidates(params) {
    params = {...params, asOfDate: referenceDate(params)};
    await checkMaintenance(params);
    const {app} = params, state = await coreFor(app), items = await itemsFor(app, state);
    const local = new Map(items.map(item => [item.path, item]));
    const targets = params.forecastCandidates.map((candidate, index) => {
        const linked = local.get(text(candidate.localPath || candidate.local?.localPath || candidate.libraryPath));
        if (linked) return linked;
        const feature = state.core.feature(
        {path: `candidate:${index}:${candidate.imdbId || candidate.kpId || candidate.ruTitle || ''}`, basename: candidate.ruTitle || candidate.enTitle || 'Фильм'},
        {'Оценка Imdb': candidate.imdbRating, 'Оценка Кинопоиск': candidate.kpRating, 'imdb Id': candidate.imdbId, 'Кинопоиск ID': candidate.kpId, 'Жанр': candidate.genres, 'Режисер': candidate.directors, 'Релиз': candidate.year, 'Время': candidate.duration, 'Франшиза': candidate.franchise, 'Описание': candidate.description, tags: candidate.type === 'series' ? ['serial'] : ['movies']}, candidate.actors || []);
        // Filtering or merging sources must not change the embedding-cache key.
        feature.path = `candidate:${feature.imdbId ? 'imdb:' + feature.imdbId : feature.kpId ? 'kp:' + feature.kpId : 'title:' + text(candidate.ruTitle || candidate.enTitle) + ':' + text(candidate.year) + ':' + feature.type}`;
        return items.find(item => feature.imdbId && item.imdbId === feature.imdbId || feature.kpId && item.kpId === feature.kpId) || feature;
    });
    const semantic = await embeddings(params, items, state, targets);
    const prepared = state.engine.prepare(items, semantic.vectors);
    const training = await trainingFor(params, items, semantic, state, prepared);
    // Recommendations estimate a viewing today, including already-watched
    // titles. A saved retrospective forecast is anchored to a different date.
    return targets.map(target => {
        try { return state.engine.forecast(items, target, semantic.vectors, training, {prepared, asOfDate: params.asOfDate, forecastDate: params.asOfDate}).final?.prediction ?? null; }
        catch (_) { return null; }
    });
}
// A preview shares the current engine and caches but never writes a media card,
// queues it, or creates a saved report. The returned report lives in the dialog.
async function preview(params) {
    params = {...params, asOfDate: referenceDate(params)};
    await checkMaintenance(params);
    const {app, forecastCandidate: candidate} = params;
    if (!candidate || (!/^\d{1,12}$/.test(text(candidate.kpId)) && !/^tt\d{5,12}$/.test(text(candidate.imdbId)))) throw Error('Укажи корректный ID Кинопоиска или IMDb');
    const state = await coreFor(app), items = await itemsFor(app, state);
    abort(params);
    const target = items.find(item => item.path === candidate.localPath)
        || state.core.feature({path: `preview:${candidate.kpId?'kp:'+candidate.kpId:'imdb:'+candidate.imdbId}`, basename: candidate.ruTitle || candidate.enTitle || 'Фильм'}, {
            'Оценка Imdb': candidate.imdbRating, 'Оценка Кинопоиск': candidate.kpRating,
            'imdb Id': candidate.imdbId, 'Кинопоиск ID': candidate.kpId,
            'Жанр': candidate.genres, 'Режисер': candidate.directors, 'Релиз': candidate.year,
            'Время': candidate.duration, 'Франшиза': candidate.franchise, 'Описание': candidate.description,
            tags: candidate.type === 'series' ? ['serial'] : ['movies']
        }, candidate.actors || []);
    const semantic = await embeddings(params, items, state, [target]);
    const prepared = state.engine.prepare(items, semantic.vectors);
    const training = await trainingFor(params, items, semantic, state, prepared);
    abort(params);
    const report = state.engine.forecast(items, target, semantic.vectors, training, {prepared, asOfDate: params.asOfDate});
    if (report.error) throw Error(report.error);
    report.models = semantic.models; report.model = semantic.models[0];
    report.training = {...report.training, parameterVersion: training?.version, parameterCreatedAt: training?.createdAt,
        inputFingerprint: training?.inputFingerprint, refresh: training?.refresh};
    report.input = {descriptionHash: await hash(text(target.description)), models: Object.fromEntries(MODEL_KEYS.map(key => {
        const cached = semantic.caches[key]?.entries?.[target.path];
        return [key, {status: semantic.vectors[key]?.[target.path] ? 'ready' : 'pending', tokens: cached?.tokens,
            usedTokens: cached?.usedTokens, truncated: cached ? Boolean(cached.truncated) : null}];
    }))};
    for (const key of MODEL_KEYS) if (report.plotVariants[key].raw == null && semantic.errors[key] && state.core.validDescription(target.description)) report.plotVariants[key].reason = semantic.errors[key];
    return report;
}
async function resume({app, obsidian = {}}) {
    if (await maintenanceBusy({app})) return;
    if (app.__kinoRatingUpdate || app.__kinoForecastResuming) return;
    const backfillLock = await readJson(app, `${BASE}/maintenance-lock.json`, null);
    if (backfillLock?.until > Date.now()) return {deferred: true};
    const state = await coreFor(app);
    if (state.resumed) return;
    const queue = await readJson(app, `${BASE}/queue.json`, {entries: {}});
    const files = Object.keys(queue.entries || {}).map(path => app.vault.getAbstractFileByPath(path)).filter(file => media(app, file));
    if (!files.length) return;
    state.resumed = true; app.__kinoForecastResuming = true;
    try {
        const result = await calculate({app, obsidian, forecastFiles: files});
        for (const estimate of result.results) if (!estimate.error) await persist({app, obsidian}, estimate);
    } finally { delete app.__kinoForecastResuming; }
}
async function single(params) {
    const result = await calculate({...params, forecastFiles: [params.targetFile || params.app.workspace.getActiveFile()]});
    const estimate = result.results[0];
    if (!estimate || result.cancelled) return null;
    if (!estimate.error) await persist(params, estimate);
    return estimate;
}
module.exports = {
    calculate: params => locked(params.app, () => calculate(params)),
    single: params => locked(params.app, () => single(params)),
    persist: (params, estimate) => locked(params.app, () => persist(params, estimate)),
    candidates: params => locked(params.app, () => candidates(params)),
    preview: params => locked(params.app, () => preview(params)),
    resume: params => locked(params.app, () => resume(params)),
    load, readJson, writeJson, hash, itemsFor, coreFor, media, trainingFor, maintenanceBusy
};
