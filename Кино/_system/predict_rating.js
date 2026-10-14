/* One entry point for existing QuickAdd commands and all forecast consumers. */
async function service(app) {
    const key = Symbol.for('kino.forecast.service.v4');
    const file = app.vault.getAbstractFileByPath('Кино/_system/forecast_service.js');
    if (!file) throw Error('Не найден forecast_service.js');
    const coreFile = app.vault.getAbstractFileByPath('Кино/_system/forecast_core.js');
    const ensembleFile = app.vault.getAbstractFileByPath('Кино/_system/forecast_ensemble.js');
    const runtimeFile = app.vault.getAbstractFileByPath('Кино/_system/semantic_runtime.js');
    const version = `${file.stat?.mtime ?? 0}:${coreFile?.stat?.mtime ?? 0}:${ensembleFile?.stat?.mtime ?? 0}:${runtimeFile?.stat?.mtime ?? 0}`;
    if (!app[key] || app[key].version !== version) {
        const module = {exports: {}};
        new Function('module', 'exports', await app.vault.read(file))(module, module.exports);
        app[key] = {version, api: module.exports};
    }
    return app[key].api;
}
async function predict(params) {
    const {app, obsidian = {}} = params;
    const api = await service(app);
    if (Array.isArray(params.forecastCandidates)) return api.candidates(params);
    const batch = Array.isArray(params.forecastFiles);
    const target = params.targetFile || app.workspace.getActiveFile();
    if (!batch && !api.media(app, target)) {
        if (!params.suppressNotice && obsidian.Notice) new obsidian.Notice('Открой основную карточку фильма или сериала.', 7000);
        return null;
    }
    let result;
    try { result = batch ? await api.calculate(params) : await api.single({...params, targetFile: target}); }
    catch (error) { if (error.name === 'AbortError') return batch ? {results: [], cancelled: true} : null; throw error; }
    if (batch) return result;
    const estimate = result;
    if (!estimate) return null;
    if (estimate.error) {
        if (!params.suppressNotice && obsidian.Notice) new obsidian.Notice(estimate.error, 9000);
        return null;
    }
    if (!params.suppressNotice && obsidian.Notice) new obsidian.Notice(`Прогноз: ${estimate.prediction.toFixed(1)}/10${estimate.report.final.provisional ? ' · предварительный' : ''}`, 9000);
    return estimate;
}
module.exports = predict;
module.exports.persist = async (params, estimate) => (await service(params.app)).persist(params, estimate);
module.exports.resume = async params => (await service(params.app)).resume(params);
module.exports.service = service;
