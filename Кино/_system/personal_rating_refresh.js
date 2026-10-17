/* Refresh dependent forecasts after a personal rating has been saved.
   The queue belongs to the app so card rerenders cannot cancel saved changes. */
const KEY = Symbol.for("kino.personal-rating-refresh.v1");
const CONTEXTS = Symbol.for("kino.recommendations.contexts.v1");
const DEBOUNCE_MS = 300;
const CACHE_TIMEOUT_MS = 12000;
const GENERATED = new Set([
    "position", "Прогноз оценки", "Прогноз по данным", "Прогноз по сюжету",
    "Расчёт прогноза", "Статус прогноза", "Дата прогноза", "Версия прогноза",
    "Прогноз данные 55", "Прогноз данные 100", "Прогноз данные 155",
    "Прогноз E5-small", "Прогноз E5-base", "Прогноз EmbeddingGemma"
]);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const own = (value, key) => Object.prototype.hasOwnProperty.call(value || {}, key);

function canonical(value) {
    if (value instanceof Date) return value.toISOString().replace(/T00:00:00\.000Z$/, "");
    if (Array.isArray(value)) return value.map(canonical);
    if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
    return value;
}
function inputs(frontmatter) {
    return JSON.stringify(canonical(Object.fromEntries(Object.entries(frontmatter || {}).filter(([key]) => !GENERATED.has(key)))));
}
function rating(value) {
    if (value == null || String(value).trim() === "") return null;
    const number = Number(String(value).replace(",", "."));
    return Number.isFinite(number) ? number : null;
}
function entryFor(app, value) {
    const candidate = value?.file || value;
    const file = typeof candidate === "string" ? app.vault.getAbstractFileByPath(candidate) : candidate;
    if (!file?.path) return null;
    const expectedRating = own(value, "expectedRating") ? value.expectedRating : own(value, "rating") ? value.rating : undefined;
    return { file, expectedRating };
}
function notice(state, message, duration = 0) {
    clearTimeout(state.noticeTimer);
    if (!state.notice && state.obsidian.Notice) state.notice = new state.obsidian.Notice(message, 0);
    else state.notice?.setMessage?.(message);
    if (duration) state.noticeTimer = setTimeout(() => {
        state.notice?.hide?.(); state.notice = null; state.noticeTimer = null;
    }, duration);
}
async function expectedFrontmatter(state, entry) {
    const raw = await state.app.vault.read(entry.file);
    const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
    if (state.obsidian.parseYaml && match) {
        const fm = state.obsidian.parseYaml(match[1]) || {};
        if (entry.expectedRating !== undefined) fm["Оценка"] = entry.expectedRating;
        return { frontmatter: fm };
    }
    const rawRating = match?.[1].match(/^Оценка:\s*([^\r\n]*)$/m)?.[1].replace(/^["']|["']$/g, "");
    return { rating: entry.expectedRating !== undefined ? rating(entry.expectedRating) : rating(rawRating) };
}
async function synchronize(state, entries, revision) {
    const expected = await Promise.all(entries.map(async entry => ({ ...entry, expected: await expectedFrontmatter(state, entry) })));
    const deadline = Date.now() + CACHE_TIMEOUT_MS;
    while (state.revision === revision) {
        const pending = expected.filter(entry => {
            if (state.app.vault.getAbstractFileByPath(entry.file.path) !== entry.file) throw Error("Карточка перемещена до обновления прогнозов.");
            const cached = state.app.metadataCache.getFileCache(entry.file)?.frontmatter;
            if (!cached) return true;
            return entry.expected.frontmatter
                ? inputs(cached) !== inputs(entry.expected.frontmatter)
                : rating(cached["Оценка"]) !== entry.expected.rating;
        });
        if (!pending.length) return true;
        if (Date.now() >= deadline) throw Error("Obsidian ещё не обновил свойства: " + pending.map(entry => entry.file.basename || entry.file.path).join(", ") + ".");
        await sleep(60);
    }
    return false;
}
async function updater(state) {
    const file = state.app.vault.getAbstractFileByPath("Кино/_system/update_ratings.js");
    if (!file) throw Error("Не найден модуль обновления прогнозов.");
    const version = file.stat?.mtime;
    if (!state.update || state.updateVersion !== version) {
        const mod = { exports: {} };
        new Function("module", "exports", await state.app.vault.read(file))(mod, mod.exports);
        if (typeof mod.exports !== "function") throw Error("Недоступно обновление прогнозов.");
        state.update = mod.exports; state.updateVersion = version;
    }
    return state.update;
}
async function refreshRecommendations(state) {
    const contexts = state.app[CONTEXTS];
    if (!(contexts instanceof Map)) return;
    const failures = [];
    for (const context of contexts.values()) {
        if (!context.state?.reference || context.opening) continue;
        context.personalRatingRevision = (Number(context.personalRatingRevision) || 0) + 1;
        if (typeof context.refresh !== "function" || context.container?.isConnected === false) continue;
        try { await context.refresh(context); }
        catch (error) { failures.push(String(error?.message || error)); }
    }
    if (failures.length) throw Error("Не удалось обновить открытые рекомендации: " + failures[0]);
}
function complete(state, revision, result) {
    state.completedRevision = revision;
    for (const [path, entry] of state.changed) if (entry.revision <= revision) state.changed.delete(path);
    const waiting = state.waiting; state.waiting = [];
    for (const request of waiting) {
        if (request.revision <= revision) request.resolve(result);
        else state.waiting.push(request);
    }
}
async function drain(state) {
    if (state.running) return;
    state.running = true; state.timer = null;
    try {
        while (state.completedRevision < state.revision) {
            while (Date.now() < state.nextDue) await sleep(Math.min(100, state.nextDue - Date.now()));
            const revision = state.revision;
            const entries = [...state.changed.values()].filter(entry => entry.revision <= revision);
            let result, failure, cacheReady = false;
            notice(state, "Оценка сохранена. Обновляю связанные прогнозы…");
            try {
                if (!await synchronize(state, entries, revision)) continue;
                cacheReady = true;
                const update = await updater(state);
                while (state.revision === revision) {
                    if (state.app.__kinoRatingUpdate) {
                        notice(state, "Оценка сохранена. Жду текущий пересчёт…");
                        await sleep(150); continue;
                    }
                    result = await update({
                        app: state.app, obsidian: state.obsidian, scope: "all",
                        prepareDescriptions: false, suppressNotice: true,
                        shouldCancel: () => state.revision !== revision,
                        onProgress: value => {
                            const phases = { descriptions: "Дополняю описания", model: "Загружаю локальную модель", embeddings: "Анализирую сюжеты", training: "Обновляю параметры", validating: "Проверяю точность", trained: "Параметры обновлены", predicting: "Пересчитываю прогнозы", writing: "Сохраняю прогнозы" };
                            const count = Number.isFinite(value.completed) && Number.isFinite(value.total) ? ": " + value.completed + " / " + value.total : "…";
                            notice(state, (phases[value.phase] || value.stage || "Обновляю прогнозы") + count);
                        }
                    });
                    if (!result?.busy) break;
                    await sleep(150);
                }
                if (state.revision !== revision) continue;
                if (!result || result.cancelled || result.failed?.length || result.total === 0) {
                    const detail = result?.failed?.[0]?.error;
                    throw Error(detail || (result?.cancelled ? "Пересчёт отменён." : "Не все прогнозы удалось обновить."));
                }
            } catch (error) { failure = error; }
            // A newer save supersedes this run, including transient stale-card errors.
            if (state.revision !== revision) continue;
            try { if (cacheReady) await refreshRecommendations(state); }
            catch (error) { failure ||= error; }
            if (state.revision !== revision) continue;
            if (failure) {
                const error = String(failure?.message || failure);
                notice(state, "Оценка сохранена. Пересчёт не завершён: " + error, 9000);
                complete(state, revision, { ok: false, error, result });
            } else {
                notice(state, "Оценка сохранена. Прогнозы обновлены: " + result.updated + (result.provisional ? ". Предварительных: " + result.provisional : "") + ".", 3000);
                complete(state, revision, { ok: true, result });
            }
        }
    } finally {
        state.running = false;
        if (state.completedRevision < state.revision && !state.timer) state.timer = setTimeout(() => { void drain(state); }, Math.max(0, state.nextDue - Date.now()));
    }
}
function schedule({ app, obsidian = {}, changedFiles = [], mediaFile }) {
    if (!app?.vault || !app.metadataCache) throw Error("Недоступно хранилище для обновления прогнозов.");
    let state = app[KEY];
    if (!state) state = app[KEY] = { app, obsidian, revision: 0, completedRevision: 0, changed: new Map(), waiting: [], timer: null, running: false, nextDue: 0, notice: null, noticeTimer: null };
    state.obsidian = { ...state.obsidian, ...obsidian };
    const revision = ++state.revision;
    for (const value of [...(Array.isArray(changedFiles) ? changedFiles : [changedFiles]), mediaFile].filter(Boolean)) {
        const entry = entryFor(app, value);
        if (entry) state.changed.set(entry.file.path, { ...entry, revision });
    }
    state.nextDue = Date.now() + DEBOUNCE_MS;
    const completion = new Promise(resolve => state.waiting.push({ revision, resolve }));
    if (!state.running) {
        clearTimeout(state.timer);
        state.timer = setTimeout(() => { void drain(state); }, DEBOUNCE_MS);
    }
    return { completion };
}

module.exports = { schedule };
