/*
 * QuickAdd Movie Script: OMDb + Kinopoisk API Unofficial.
 * Основа: Examples_Attachments_movies.js, Christian B. B. Houmann.
 *
 * Установка: заменить прежний .js, сохранив его имя и путь.
 * В настройках этого шага макроса оставить прежний OMDb API Key и заполнить
 * Kinopoisk API Key своим ключом с https://kinopoiskapiunofficial.tech/.
 * После замены перезапустить Obsidian, чтобы появилась новая настройка.
 * Это отдельный сервис; ключи других API Кинопоиска сюда не подходят.
 *
 * В YAML существующего шаблона добавить эти строки БЕЗ кавычек:
 * Оценка Кинопоиск: {{VALUE:kinopoiskRating}}
 * Количество голосов Кинопоиск: {{VALUE:kinopoiskVotes}}
 * Количество голосов Imdb: {{VALUE:imdbVotesNumber}}
 *
 * Все прежние переменные, включая imdbRating и исходную imdbVotes, сохранены.
 * Новые числовые переменные содержат число в виде строки или литерал "null"
 * для YAML. "null" также предотвращает лишний запрос VALUE в QuickAdd.
 * Дополнительно: kinopoiskId, kinopoiskFetchedAt, imdbVotesFetchedAt.
 * Даты означают получение ответа API, а не время обновления данных сайтом.
 *
 * Кэш: 24 часа; при временной недоступности - последний успешный ответ
 * не старше 7 дней. Кэш локален для хранилища и не содержит ключей API.
 * На Obsidian без loadLocalStorage кэш действует в пределах сеанса скрипта.
 * Не более одного запроса в секунду к каждому сервису, до 3 попыток.
 * Долгий Retry-After / исчерпание квоты включает паузу между запусками.
 * Без ключа КП или подтверждённого совпадения поля КП остаются null.
 * Скрипт передаёт переменные следующему шагу; сам заметки не изменяет.
 *
 * API: https://www.omdbapi.com/
 *      https://kinopoiskapiunofficial.tech/documentation/api/
 */

const API_KEY_OPTION = "OMDb API Key";
const KP_KEY_OPTION = "18560e74-f0bf-4ca5-9efc-5a9ebb547268";
const API_URL = "https://www.omdbapi.com/";
const KP_URL = "https://kinopoiskapiunofficial.tech/api/v2.2/films";
const CACHE_KEY = "quickadd-movie-script-cache-v2";
const DAY = 24 * 60 * 60 * 1000;
const CACHE_TTL = DAY;
const STALE_TTL = 7 * DAY;
const MAX_CACHE_ENTRIES = 200;
const REQUEST_GAP = 1000;
const REQUEST_TIMEOUT = 12000;
const MAX_RETRY_WAIT = 8000;
const MAX_ATTEMPTS = 3;
const vaultStates = new WeakMap();
let fallbackState;

module.exports = {
    entry: start,
    settings: {
        name: "Movie Script",
        author: "Christian B. B. Houmann",
        options: {
            [API_KEY_OPTION]: {
                type: "text",
                defaultValue: "",
                placeholder: "OMDb API Key",
            },
            [KP_KEY_OPTION]: {
                type: "text",
                defaultValue: "",
                placeholder: "Ключ с kinopoiskapiunofficial.tech",
                description: "Для рейтинга и количества голосов Кинопоиска.",
            },
        },
    },
};

async function start(params, settings = {}) {
    // Контекст отдельный для каждого запуска: параллельные макросы не смешиваются.
    const client = makeClient(params);
    const omdbKey = String(settings[API_KEY_OPTION] ?? "").trim();
    const kpKey = String(settings[KP_KEY_OPTION] ?? "").trim();
    if (!omdbKey) return stopMacro(params, "Укажи OMDb API Key в настройках Movie Script.");

    const input = await params.quickAddApi.inputPrompt("Название фильма или IMDb ID / ссылка:");
    const query = String(input ?? "").trim();
    if (!query) return stopMacro(params);

    let imdbId = extractImdbId(query);
    if (!imdbId) {
        const search = await client.get("omdb", API_URL, { s: query }, omdbKey);
        const results = (Array.isArray(search?.data?.Search) ? search.data.Search : [])
            .filter(item => item && extractImdbId(item.imdbID) && cleanText(item.Title));
        if (!results.length) {
            return stopMacro(params, "Уточни название или вставь ссылку IMDb.");
        }
        const choice = await params.quickAddApi.suggester(results.map(formatTitleForSuggestion), results);
        if (!choice) return stopMacro(params);
        imdbId = extractImdbId(choice.imdbID);
    }

    const movie = await client.get("omdb", API_URL, { i: imdbId }, omdbKey);
    const selectedShow = movie?.data;
    if (!cleanText(selectedShow?.Title) || extractImdbId(selectedShow?.imdbID) !== imdbId) {
        return stopMacro(params, "Повтори добавление позже: OMDb пока не вернул карточку фильма.");
    }

    // КП - дополнительный источник: его недоступность не прерывает основной макрос.
    const kp = kpKey ? await getKinopoisk(client, imdbId, kpKey) : null;
    const omdbVotes = parseVotes(selectedShow.imdbVotes);
    const imdbVotes = omdbVotes ?? parseVotes(kp?.data?.ratingImdbVoteCount);

    params.variables = {
        ...params.variables,
        ...selectedShow,
        actorLinks: linkifyList(selectedShow.Actors),
        genreLinks: linkifyList(selectedShow.Genre),
        directorLink: linkifyList(selectedShow.Director),
        fileName: replaceIllegalFileNameCharactersInString(selectedShow.Title) || imdbId,
        typeLink: `[[${selectedShow.Type === "movie" ? "Movies" : "Series"}]]`,
        languageLower: cleanText(selectedShow.Language).toLowerCase(),
        kinopoiskRating: yamlNumber(parseRating(kp?.data?.ratingKinopoisk)),
        kinopoiskVotes: yamlNumber(parseVotes(kp?.data?.ratingKinopoiskVoteCount)),
        imdbVotesNumber: yamlNumber(imdbVotes),
        kinopoiskId: yamlNumber(parseVotes(kp?.data?.kinopoiskId)),
        kinopoiskFetchedAt: fetchedDate(kp),
        imdbVotesFetchedAt: fetchedDate(imdbVotes === null ? null : omdbVotes !== null ? movie : kp),
    };
}

async function getKinopoisk(client, imdbId, key) {
    const search = await client.get("kp", KP_URL, { imdbId }, key);
    if (!Array.isArray(search?.data?.items)) return null;

    // Никаких совпадений по похожему названию или году: только тот же IMDb ID.
    const matches = search.data.items.filter(item =>
        item && extractImdbId(item.imdbId) === imdbId && parseVotes(item.kinopoiskId) > 0
    );
    const ids = [...new Set(matches.map(item => Number(item.kinopoiskId)))];
    if (ids.length !== 1) return null;

    const details = await client.get("kp", `${KP_URL}/${ids[0]}`, {}, key);
    if (details) {
        if (extractImdbId(details.data?.imdbId) !== imdbId || Number(details.data?.kinopoiskId) !== ids[0]) {
            return null;
        }
        return details;
    }
    // В выдаче есть оценка, но нет числа голосов. Не подменяем его другими счётчиками.
    return { data: matches[0], fetchedAt: search.fetchedAt };
}

function extractImdbId(value) {
    const text = String(value ?? "").trim();
    if (/^tt\d+$/i.test(text)) return text.toLowerCase();
    try {
        const url = new URL(text);
        if (!/^(?:www\.|m\.)?imdb\.com$/i.test(url.hostname)) return null;
        return url.pathname.match(/^\/title\/(tt\d+)(?:\/|$)/i)?.[1].toLowerCase() ?? null;
    } catch (_) {
        return null;
    }
}

function formatTitleForSuggestion(item) {
    return `(${item.Type === "movie" ? "M" : "TV"}) ${item.Title} (${item.Year})`;
}

function cleanText(value) {
    const text = String(value ?? "").trim();
    return /^(?:N\/A|null|undefined)$/i.test(text) ? "" : text;
}

function linkifyList(value) {
    return cleanText(value).split(",").map(cleanText).filter(Boolean)
        .map(item => `\n  - ${JSON.stringify(`[[${item}]]`)}`).join("");
}

function replaceIllegalFileNameCharactersInString(value) {
    const name = String(value ?? "")
        .replace(/[\\,#%&{}/*<>$'":@?|\x00-\x1f\x7f]/g, "")
        .trim().replace(/[. ]+$/g, "");
    return /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name) ? `_${name}` : name;
}

function parseVotes(value) {
    if (typeof value !== "string" && typeof value !== "number") return null;
    const text = cleanText(value).replace(/[,\s\u00a0\u202f]/g, "");
    if (!/^\d+$/.test(text)) return null;
    const number = Number(text);
    return Number.isSafeInteger(number) && number >= 0 ? number : null;
}

function parseRating(value) {
    if (typeof value !== "string" && typeof value !== "number") return null;
    const number = Number(cleanText(value).replace(",", "."));
    return Number.isFinite(number) && number > 0 && number <= 10 ? number : null;
}

function yamlNumber(value) {
    return value === null ? "null" : String(value);
}

function fetchedDate(result) {
    return Number.isFinite(result?.fetchedAt) ? new Date(result.fetchedAt).toISOString() : "null";
}

function stopMacro(params, message) {
    if (message) {
        const NoticeClass = params.obsidian?.Notice ?? (typeof Notice === "function" ? Notice : null);
        if (NoticeClass) new NoticeClass(message, 5000);
    }
    if (typeof params.abort === "function") return params.abort();
    // Старый QuickAdd без abort: исключение необходимо, иначе запустится пустой шаблон.
    throw new Error(message || "Добавление отменено.");
}

function getState(app) {
    if (app && vaultStates.has(app)) return vaultStates.get(app);
    if (!app && fallbackState) return fallbackState;
    let saved;
    try { saved = app?.loadLocalStorage?.(CACHE_KEY); } catch (_) { /* Кэш необязателен. */ }
    const state = { app, entries: {}, providers: {}, inFlight: new Map() };
    if (saved?.version === 2 && saved.entries && typeof saved.entries === "object") {
        for (const [key, entry] of Object.entries(saved.entries)) {
            if (/^(omdb|kp):https:\/\//.test(key) && entry?.data && typeof entry.data === "object" &&
                Number.isFinite(entry.fetchedAt) && Date.now() >= entry.fetchedAt &&
                Date.now() - entry.fetchedAt <= STALE_TTL) {
                state.entries[key] = entry;
            }
        }
    }
    for (const name of ["omdb", "kp"]) {
        const cooldown = saved?.cooldowns?.[name];
        state.providers[name] = {
            tail: Promise.resolve(), nextRequest: 0, busy: false, credential: undefined,
            cooldown: Number.isFinite(cooldown) ? cooldown : 0,
        };
    }
    if (app) vaultStates.set(app, state);
    else fallbackState = state;
    return state;
}

function saveState(state) {
    const entries = Object.entries(state.entries)
        .filter(([, value]) => Date.now() - value.fetchedAt <= STALE_TTL)
        .sort((a, b) => b[1].fetchedAt - a[1].fetchedAt).slice(0, MAX_CACHE_ENTRIES);
    state.entries = Object.fromEntries(entries);
    try {
        state.app?.saveLocalStorage?.(CACHE_KEY, {
            version: 2, entries: state.entries,
            cooldowns: { omdb: state.providers.omdb.cooldown, kp: state.providers.kp.cooldown },
        });
    } catch (_) { /* Нет места / старый Obsidian: остаётся кэш в памяти. */ }
}

function makeClient(params) {
    const state = getState(params.app);
    const requestUrlFn = params.obsidian?.requestUrl ?? (typeof requestUrl === "function" ? requestUrl : null);
    const requestFn = params.obsidian?.request ?? (typeof request === "function" ? request : null);

    async function get(providerName, base, data, credential) {
        const url = new URL(base);
        Object.entries(data).forEach(([key, value]) => url.searchParams.set(key, value));
        // Вычисляем ключ кэша ДО добавления apikey. В кэше нет заголовков или ключей API.
        const cacheId = `${providerName}:${url.href}`;
        const cached = () => {
            const entry = state.entries[cacheId];
            return entry && Date.now() - entry.fetchedAt <= STALE_TTL ? entry : null;
        };
        const existing = cached();
        if (existing && Date.now() - existing.fetchedAt < CACHE_TTL) return existing;
        if (state.inFlight.has(cacheId)) return state.inFlight.get(cacheId);

        const provider = state.providers[providerName];
        if (provider.credential !== undefined && provider.credential !== credential) provider.cooldown = 0;
        provider.credential = credential;
        const headers = { Accept: "application/json" };
        if (providerName === "omdb") url.searchParams.set("apikey", credential);
        else headers["X-API-KEY"] = credential;

        const task = provider.tail.then(async () => {
            if (provider.cooldown > Date.now() || provider.busy) return cached();
            for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
                await sleep(Math.max(0, provider.nextRequest - Date.now()));
                provider.nextRequest = Date.now() + REQUEST_GAP;
                let response;
                try {
                    provider.busy = true;
                    const pending = Promise.resolve().then(() => {
                        const options = { url: url.href, method: "GET", headers, throw: false };
                        if (requestUrlFn) return requestUrlFn(options);
                        if (requestFn) return requestFn(options).then(text => ({ status: 200, text, headers: {} }));
                        throw Object.assign(new Error("HTTP API unavailable"), { permanent: true });
                    });
                    // requestUrl нельзя отменить: пока он не завершён, новые запросы не запускаем.
                    pending.then(() => { provider.busy = false; }, () => { provider.busy = false; });
                    response = await withTimeout(pending);
                } catch (error) {
                    if (error?.timeout) {
                        provider.cooldown = Date.now() + 60000;
                        saveState(state);
                        return cached();
                    }
                    if (error?.permanent) return cached();
                    const status = Number(error?.status ?? error?.statusCode) ||
                        Number(String(error?.message ?? "").match(/\b(40[12349]|429|5\d\d)\b/)?.[1]) || 503;
                    response = { status, headers: error?.headers ?? {} };
                }

                let status = Number(response?.status) || 503;
                let body;
                if (status >= 200 && status < 300) {
                    try {
                        body = typeof response.text === "string" ? JSON.parse(response.text) : response.json;
                        if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Invalid JSON");
                    } catch (_) { status = 503; }
                }
                if (body?.Response === "False" || body?.Response === false) {
                    const error = String(body.Error ?? "");
                    if (/limit|quota/i.test(error)) status = 402;
                    else if (/api.?key|unauthori[sz]ed/i.test(error)) status = 401;
                    else return null;
                }
                if (status >= 200 && status < 300) {
                    const valid = providerName === "omdb"
                        ? (Array.isArray(body.Search) || (cleanText(body.Title) && extractImdbId(body.imdbID)))
                        : (Array.isArray(body.items) || parseVotes(body.kinopoiskId) > 0);
                    if (!valid) return cached();
                    const entry = { data: body, fetchedAt: Date.now() };
                    state.entries[cacheId] = entry;
                    provider.cooldown = 0;
                    saveState(state);
                    return entry;
                }

                const serverWait = retryAfter(response?.headers);
                if ([401, 402, 403].includes(status)) {
                    provider.cooldown = Date.now() + (serverWait ?? (status === 402 ? DAY : 60000));
                    saveState(state);
                    return cached();
                }
                if (status !== 429 && status !== 408 && status < 500) return null;
                const delay = Math.max(1000 * (2 ** attempt), serverWait ?? (status === 429 ? 30000 : 0));
                provider.cooldown = Date.now() + delay;
                saveState(state);
                if (attempt + 1 >= MAX_ATTEMPTS || delay > MAX_RETRY_WAIT) return cached();
                await sleep(delay);
            }
            return cached();
        });
        provider.tail = task.then(() => undefined, () => undefined);
        state.inFlight.set(cacheId, task);
        try { return await task; }
        finally { state.inFlight.delete(cacheId); }
    }

    return { get };
}

function retryAfter(headers = {}) {
    const value = Object.entries(headers ?? {}).find(([key]) => key.toLowerCase() === "retry-after")?.[1];
    if (value === undefined || String(value).trim() === "") return null;
    const seconds = Number(value);
    if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
    const date = Date.parse(String(value));
    return Number.isFinite(date) ? Math.max(0, date - Date.now()) : null;
}

function sleep(milliseconds) {
    return milliseconds > 0 ? new Promise(resolve => setTimeout(resolve, milliseconds)) : Promise.resolve();
}

async function withTimeout(promise) {
    let timer;
    try {
        return await Promise.race([
            promise,
            new Promise((_, reject) => {
                timer = setTimeout(() => reject(Object.assign(new Error("Request timeout"), { timeout: true })), REQUEST_TIMEOUT);
            }),
        ]);
    } finally { clearTimeout(timer); }
}
