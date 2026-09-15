/*
 * QuickAdd: фильмы и сериалы из OMDb + рейтинг Кинопоиска без ключа КП.
 *
 * В шаблоне должны быть строки:
 * Оценка Кинопоиск: {{VALUE:kinopoiskRating}}
 * Количество голосов Кинопоиск: {{VALUE:kinopoiskVotes}}
 * Количество голосов Imdb: {{VALUE:imdbVotesNumber}}
 */

const API_KEY_OPTION = "OMDb API Key";
const OMDB_URL = "https://www.omdbapi.com/";
const KP_URL = "https://movie-planner.ru/api/public";
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

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
        },
    },
};

async function start(params, settings) {
    const apiKey = String(settings[API_KEY_OPTION] || "").trim();
    if (!apiKey) throw new Error("Укажи OMDb API Key в настройках скрипта.");

    const query = String(await params.quickAddApi.inputPrompt(
        "Название фильма или IMDb ID:"
    ) || "").trim();
    if (!query) return;

    let selectedShow;
    if (isImdbId(query)) {
        selectedShow = await getOmdb({ i: query }, apiKey);
    } else {
        const search = await getOmdb({ s: query }, apiKey);
        const results = Array.isArray(search.Search) ? search.Search : [];
        if (!results.length) throw new Error("Фильм не найден.");

        const choice = await params.quickAddApi.suggester(
            results.map(formatTitleForSuggestion),
            results
        );
        if (!choice) return;
        selectedShow = await getOmdb({ i: choice.imdbID }, apiKey);
    }

    if (!selectedShow || selectedShow.Response === "False") {
        throw new Error("Фильм не найден.");
    }

    const kp = await getKinopoisk(selectedShow, params.quickAddApi);

    params.variables = {
        ...selectedShow,
        actorLinks: linkifyList(selectedShow.Actors),
        genreLinks: linkifyList(selectedShow.Genre),
        directorLink: linkifyList(selectedShow.Director),
        fileName: replaceIllegalFileNameCharactersInString(selectedShow.Title),
        typeLink: `[[${selectedShow.Type === "movie" ? "Movies" : "Series"}]]`,
        languageLower: clean(selectedShow.Language).toLowerCase(),
        kinopoiskRating: yamlNumber(kp?.rating_kp),
        kinopoiskVotes: yamlNumber(kp?.rating_kp_votes),
        imdbVotesNumber: yamlNumber(selectedShow.imdbVotes),
        kinopoiskId: yamlNumber(kp?.kp_id),
    };
}

async function getOmdb(params, apiKey) {
    return getJson(OMDB_URL, { ...params, apikey: apiKey });
}

async function getKinopoisk(movie, quickAddApi) {
    try {
        const year = Number(String(movie.Year || "").match(/\d{4}/)?.[0]);
        if (!year) return null;

        const result = await getJson(`${KP_URL}/search`, {
            q: `${movie.Title} ${year}`,
            limit: 24,
            type: movie.Type === "movie" ? "film" : "series",
            person_limit: 0,
        });

        const candidates = (Array.isArray(result.items) ? result.items : [])
            .filter(item => Number(item.year) === year)
            .filter(item => Boolean(item.is_series) === (movie.Type !== "movie"))
            .slice(0, 8);
        if (!candidates.length) return null;

        let details = await getKpDetails(candidates[0].kp_id);
        if (sameTitle(movie.Title, details?.title_en) || sameTitle(movie.Title, details?.title)) {
            return details;
        }

        const choice = await quickAddApi.suggester(
            candidates.map(item =>
                `${item.title} (${item.year})${item.rating_kp ? ` - КП ${item.rating_kp}` : ""}`
            ),
            candidates
        );
        if (!choice) return null;
        details = await getKpDetails(choice.kp_id);
        return details;
    } catch (error) {
        console.warn("Данные Кинопоиска временно недоступны:", error);
        return null;
    }
}

async function getKpDetails(id) {
    const result = await getJson(`${KP_URL}/film/${id}`);
    return result?.film || null;
}

async function getJson(base, params = {}) {
    const url = new URL(base);
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));

    let lastError;
    for (let attempt = 0; attempt < 2; attempt++) {
        if (attempt) await wait(1200);
        try {
            const text = await request({
                url: url.href,
                method: "GET",
                headers: { Accept: "application/json" },
            });
            return JSON.parse(text);
        } catch (error) {
            lastError = error;
        }
    }
    throw lastError;
}

function isImdbId(value) {
    return /^tt\d+$/i.test(value);
}

function formatTitleForSuggestion(item) {
    return `(${item.Type === "movie" ? "M" : "TV"}) ${item.Title} (${item.Year})`;
}

function clean(value) {
    const text = String(value || "").trim();
    return text === "N/A" ? "" : text;
}

function normalizeTitle(value) {
    return clean(value)
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/&/g, "and")
        .replace(/[^a-zа-яё0-9]+/gi, " ")
        .trim();
}

function sameTitle(left, right) {
    return normalizeTitle(left) && normalizeTitle(left) === normalizeTitle(right);
}

function linkifyList(value) {
    const items = clean(value).split(",").map(item => item.trim()).filter(Boolean);
    return items.map(item => `\n  - "[[${item.replace(/"/g, '\\"')}]]"`).join("");
}

function replaceIllegalFileNameCharactersInString(value) {
    return clean(value).replace(/[\\,#%&{}/*<>$'":@?|]/g, "").trim();
}

function yamlNumber(value) {
    const text = String(value ?? "").replace(/[,\s]/g, "");
    if (!text) return "null";
    const number = Number(text);
    return Number.isFinite(number) ? String(number) : "null";
}
