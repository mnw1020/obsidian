/* QuickAdd: User Script ПЕРЕД существующим Template/Capture. Шаблон сохраняется.
 * OMDb API Key сохраняется в прежних настройках. Для КП и Wikidata ключи не нужны.
 * Название в YAML остаётся оригинальным; имя файла берётся на русском.
 */
const API_KEY_OPTION = "OMDb API Key";
const ROOT = "Кино";
const SERIES = "Кино/Франшизы";
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const cache = new Map();
const cooldown = new Map();
let busy = false;

module.exports = {
    entry: async (params, settings) => {
        if (busy) return;
        busy = true;
        try {
            const ready = await addMovie(params, settings);
            if (!ready) {
                if (typeof params.abort === "function") params.abort();
                else { const error = new Error("Добавление отменено"); error.name = "MacroAbortError"; throw error; }
            }
        }
        finally { busy = false; }
    },
    settings: { name: "Movie Script", author: "Christian B. B. Houmann",
        options: { [API_KEY_OPTION]: { type: "text", defaultValue: "", placeholder: "OMDb API Key" } } }
};

async function addMovie(params, settings) {
    const { app, quickAddApi: qa, obsidian: ob } = params;
    const key = String(settings?.[API_KEY_OPTION] || "").trim();
    if (!key) { new ob.Notice("Укажи OMDb API Key в настройках скрипта."); return; }
    const query = await qa.inputPrompt("Название фильма или IMDb ID");
    if (!query?.trim()) return;
    const get = (url, values) => getJson(ob, url, values);
    const omdb = values => get("https://www.omdbapi.com/", { ...values, apikey: key });
    let movie;
    if (/^tt\d{7,12}$/i.test(query.trim())) movie = await omdb({ i: query.trim().toLowerCase(), plot: "full" });
    else {
        const result = await omdb({ s: query.trim() });
        const items = result?.Search || [];
        if (!items.length) { new ob.Notice("Введи IMDb ID фильма для точного поиска."); return; }
        const selected = await qa.suggester(items.map(x => `${x.Title} (${x.Year}, ${x.Type})`), items);
        if (!selected) return;
        movie = await omdb({ i: selected.imdbID, plot: "full" });
    }
    if (!movie || movie.Response === "False" || !/^tt\d{7,12}$/.test(movie.imdbID || "")) {
        new ob.Notice("Проверь IMDb ID и ключ OMDb."); return;
    }
    if (!["movie", "series"].includes(movie.Type)) {
        new ob.Notice("Выбери фильм или сериал целиком, а не отдельный эпизод."); return;
    }
    const existing = await findMovie(app, ob, movie.imdbID);
    if (existing) { await app.workspace.getLeaf(false).openFile(existing); new ob.Notice("Этот фильм уже есть в кинотеке."); return; }

    // Один точный запрос даёт русское название, ID КП, русскую статью и серии.
    const wiki = await wikidata(get, movie.imdbID);
    const kp = await kinopoisk(get, qa, movie, wiki);
    let russianTitle = russian(kp?.title) || russian(wiki.title);
    let description = russian(kp?.description) || russian(kp?.overview_ru);
    let descriptionSource = description ? `https://movie-planner.ru/f/${kp.kp_id}` : "";
    if (!description && wiki.article) {
        description = await wikiDescription(get, wiki.article);
        if (description) descriptionSource = wiki.article;
    }
    if (!russianTitle) {
        const input = await qa.inputPrompt("Название для файла на русском", "Введи русское название", "");
        if (!input?.trim()) return;
        russianTitle = input.trim();
    }
    if (!description) {
        const input = await qa.inputPrompt("Описание на русском", "Вставь описание или оставь пустым", "");
        if (input == null) return;
        description = input.trim();
    }
    const title = safeName(russianTitle);
    if (!title) return;
    const franchise = {};
    const yamlNumber = value => number(value) === null ? "null" : String(number(value));
    const linkList = value => links(value).map(x => "\n  - " + JSON.stringify(x)).join("");
    params.variables = {
        ...params.variables, ...movie,
        Plot: description.replace(/\s+/g," ").trim(),
        actorLinks: linkList(movie.Actors),
        genreLinks: linkList(movie.Genre),
        directorLink: linkList(movie.Director),
        fileName: title,
        typeLink: `[[${movie.Type === "movie" ? "Movies" : "Series"}]]`,
        languageLower: clean(movie.Language).toLowerCase(),
        kinopoiskRating: yamlNumber(kp?.rating_kp),
        kinopoiskVotes: yamlNumber(kp?.rating_kp_votes),
        imdbVotesNumber: yamlNumber(movie.imdbVotes),
        kinopoiskId: yamlNumber(kp?.kp_id),
        franchiseLink: franchise.path ? `[[${franchise.path.replace(/\.md$/,"")}]]` : "",
        franchisePart: franchise.part ?? ""
    };
    watchTemplate(params,movie,title,description,franchise);
    return true;
}

function clean(value) { return value && value !== "N/A" ? String(value).trim() : ""; }
function russian(value) { const text = clean(value); return /[а-яё]/i.test(text) ? text : ""; }
function number(value) {
    const text = clean(value).replace(/[,\s]/g, "");
    return text && Number.isFinite(Number(text)) ? Number(text) : null;
}
function links(value) { return clean(value).split(",").map(x => entityName(x)).filter(Boolean); }
function safeName(value) {
    let name = clean(value).replace(/[\\/:*?"<>|\[\]#^\x00-\x1f]/g, " ").replace(/\s+/g, " ").trim().replace(/[. ]+$/g, "").slice(0, 160).trim();
    if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name)) name = "_" + name;
    return name;
}
function normalized(value) { return clean(value).toLowerCase().replace(/ё/g, "е").replace(/[^a-zа-я0-9]/g, ""); }
async function frontmatter(app, ob, file) {
    const raw = await app.vault.read(file);
    const match = raw.match(/^\uFEFF?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
    try { return match ? ob.parseYaml(match[1]) || {} : {}; } catch { return {}; }
}
async function findMovie(app, ob, id) {
    for (const file of app.vault.getMarkdownFiles()) {
        if (!file.path.startsWith(ROOT + "/") || /\/((Просмотры|Сезоны|Франшизы|Служебное))\//.test(file.path)) continue;
        const fm = await frontmatter(app, ob, file);
        if (String(fm["imdb Id"] || "").trim().toLowerCase() === id) return file;
    }
    return null;
}
function availablePath(app, title, year, id) {
    const occupied = new Set(app.vault.getMarkdownFiles().map(f => f.path.toLowerCase()));
    for (const suffix of ["", ` (${safeName(year)})`, ` (${id})`]) {
        const path = `${ROOT}/${title}${suffix}.md`;
        if (!occupied.has(path.toLowerCase()) && !app.vault.getAbstractFileByPath(path)) return path;
    }
    for (let i = 2; ; i++) {
        const path = `${ROOT}/${title} (${id}, ${i}).md`;
        if (!occupied.has(path.toLowerCase()) && !app.vault.getAbstractFileByPath(path)) return path;
    }
}
async function ensureFolder(app, folder) {
    let path = "";
    for (const name of folder.split("/")) {
        path = path ? path + "/" + name : name;
        if (!app.vault.getAbstractFileByPath(path)) await app.vault.createFolder(path);
    }
}
async function askRating(qa) {
    while (true) {
        const value = await qa.inputPrompt("Моя оценка", "От 1 до 10; пусто - без оценки");
        if (value == null) return undefined;
        if (!value.trim()) return null;
        const n = Number(value.replace(",", "."));
        if (Number.isFinite(n) && n >= 1 && n <= 10) return n;
    }
}
async function askDate(qa) {
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
    while (true) {
        const value = await qa.inputPrompt("Дата просмотра", "ГГГГ-ММ-ДД или ДД.ММ.ГГГГ; пусто - еще не смотрел", today);
        if (value == null) return undefined;
        if (!value.trim()) return "";
        const text = value.trim().replace(/^(\d{2})\.(\d{2})\.(\d{4})$/, "$3-$2-$1");
        const date = new Date(text + "T12:00:00Z");
        if (/^\d{4}-\d{2}-\d{2}$/.test(text) && Number.isFinite(date.getTime()) && date.toISOString().startsWith(text)) return text;
    }
}

async function getJson(ob, base, params = {}) {
    const url = new URL(base);
    Object.entries(params).forEach(([key,value]) => url.searchParams.set(key,String(value)));
    const cached = cache.get(url.href);
    if (cached && cached.expires > Date.now()) return cached.data;
    const host = url.host;
    if ((cooldown.get(host) || 0) - Date.now() > 15000) return null;
    for (let attempt = 0; attempt < 2; attempt++) {
        await sleep(Math.max(0, (cooldown.get(host) || 0) - Date.now()));
        cooldown.set(host, Date.now() + 1200);
        let timer;
        try {
            const response = await Promise.race([
                ob.requestUrl({ url: url.href, method: "GET", throw: false,
                    headers: { Accept: "application/json", "User-Agent": "ObsidianKinoteka/2.0 (personal movie catalogue)" } }),
                new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("timeout")), 15000); })
            ]);
            if ([429,503].includes(response.status)) {
                const header = Object.entries(response.headers || {}).find(([k]) => k.toLowerCase() === "retry-after")?.[1];
                const pause = !header ? 5000 : Number.isFinite(Number(header)) ? Math.max(1000,Number(header)*1000) : Math.max(1000,Date.parse(header)-Date.now()) || 5000;
                cooldown.set(host,Date.now()+pause);
                if (attempt === 0 && pause <= 15000) continue;
                return null;
            }
            if (response.status !== 200) return null;
            const data = response.json;
            if (data?.Response === "False" || data?.error) return null;
            cache.set(url.href,{data,expires:Date.now()+300000});
            return data;
        } catch { cooldown.set(host,Date.now()+60000); return null; }
        finally { clearTimeout(timer); }
    }
    return null;
}

async function wikidata(get, id) {
    const query = `SELECT DISTINCT ?item ?kp ?ru ?article ?series ?seriesLabel WHERE {
      ?item wdt:P345 "${id}" .
      OPTIONAL { ?item wdt:P2603 ?kp . }
      OPTIONAL { ?item rdfs:label ?ru . FILTER(LANG(?ru)="ru") }
      OPTIONAL { ?article schema:about ?item; schema:isPartOf <https://ru.wikipedia.org/> . }

      SERVICE wikibase:label { bd:serviceParam wikibase:language "ru,en" . }
    } LIMIT 100`;
    return parseWikidata(await get("https://query.wikidata.org/sparql",{format:"json",query}));
}
function parseWikidata(data) {
    const rows = data?.results?.bindings || [];
    const empty = {title:"",kp:"",article:"",series:[]};
    if (rows.length >= 100 || new Set(rows.map(x=>x.item?.value)).size !== 1) return empty;
    const item = rows[0]?.item?.value;
    if (!/^https?:\/\/www\.wikidata\.org\/entity\/Q\d+$/.test(item || "")) return empty;
    const unique = key => [...new Set(rows.map(x=>x[key]?.value).filter(Boolean))];
    const kps = unique("kp");
    const series = new Map();
    for (const row of rows) {
        if (!/^https?:\/\/www\.wikidata\.org\/entity\/Q\d+$/.test(row.series?.value || "")) continue;
        const qid = row.series.value.split("/").pop(), name = row.seriesLabel?.value;
        if (name && name !== qid) series.set(qid,{name,origin:"Wikidata",url:`https://www.wikidata.org/wiki/${item.split("/").pop()}#P179`});
    }
    return { title:unique("ru")[0] || "", kp:kps.length === 1 && /^\d+$/.test(kps[0]) ? kps[0] : "",
        article:unique("article").find(x=>x.startsWith("https://ru.wikipedia.org/wiki/")) || "", series:[...series.values()] };
}

async function kinopoisk(get, qa, movie, wiki) {
    const base = "https://movie-planner.ru/api/public";
    if (wiki.kp) {
        const result = await get(`${base}/film/${wiki.kp}`);
        const film = result?.film;
        if (film && String(film.kp_id) === wiki.kp && (film.title || film.description)) return film;
    }
    const year = Number(movie.Year.match(/\d{4}/)?.[0]);
    const candidates = new Map();
    for (const q of [...new Set([wiki.title, `${movie.Title} ${year}`, movie.Title].filter(Boolean))]) {
        const result = await get(`${base}/search`, { q, limit:24, type:movie.Type === "series" ? "series" : "film",person_limit:0 });
        for (const item of result?.items || []) {
            // Разница премьер в один год допустима только после ручного выбора.
            if (Math.abs(Number(item.year)-year) <= 1 && Boolean(item.is_series) === (movie.Type === "series")) candidates.set(String(item.kp_id), item);
        }
        if (candidates.size) break;
    }
    if (!candidates.size) return null;
    const items = [...candidates.values()].slice(0,12);
    const skip = {skip:true};
    const chosen = await qa.suggester([...items.map(x=>`${x.title} (${x.year}) - КП ${x.kp_id}`),"Пропустить"],[...items,skip],`Подтверди фильм КП: ${movie.Title} (${movie.Year})`);
    if (!chosen || chosen.skip) return null;
    const result = await get(`${base}/film/${chosen.kp_id}`);
    return result?.film && String(result.film.kp_id) === String(chosen.kp_id) ? {...chosen,...result.film} : chosen;
}
async function wikiDescription(get, article) {
    const title = decodeURIComponent(new URL(article).pathname.slice(6)).replace(/_/g," ");
    const response = await get("https://ru.wikipedia.org/w/api.php",{action:"query",format:"json",prop:"extracts",titles:title,redirects:1,explaintext:1,exintro:1});
    const page = Object.values(response?.query?.pages || {})[0];
    return russian(page?.extract)?.trim() || "";
}

async function ensureFranchise(app, ob, choice, id) {
    let file = app.vault.getAbstractFileByPath(choice.path);
    const marker = "<!-- FRANCHISE:TABLE:v1 -->";
    const table = marker + "\n## Произведения\n\n```dataviewjs\n" + renderFranchise.toString() + "\nrenderFranchise(dv);\n```\n";
    if (file) {
        if (file.extension !== "md") throw new Error("Путь франшизы занят папкой.");
        const fm = await frontmatter(app, ob, file);
        const tags = Array.isArray(fm.tags) ? fm.tags : [fm.tags];
        if (fm["imdb Id"] || fm["Фильм"] || fm["Сериал"] || tags.some(x=>["movies","serial","season","viewing"].includes(String(x).replace(/^#/,"")))) throw new Error("Выбранная страница не является франшизой.");
    } else {
        await ensureFolder(app,choice.path.split("/").slice(0,-1).join("/"));
        file = await app.vault.create(choice.path,"---\ntags:\n  - franchise\nПорядок: выход\n---\n\n# " + safeName(choice.name) + "\n\n## Общее впечатление\n\n" + table);
    }
    await app.vault.process(file,raw=>{
        if (!raw.includes(marker)) raw=raw.trimEnd()+"\n\n"+table;
        const sourceMarker=`<!-- FRANCHISE:SOURCE:${id} -->`;
        if (choice.url && !raw.includes(sourceMarker)) raw=raw.trimEnd()+`\n\n${sourceMarker}\nИсточник связи для IMDb ${id}: [${choice.origin}](${choice.url}).\n`;
        return raw;
    });
}

function renderFranchise(dv) {
    const current = dv.current();
    function number(value) {
        if (value == null || String(value).trim() === "") return null;
        const result = Number(String(value).replace(",", "."));
        return Number.isFinite(result) ? result : null;
    }
    function release(value) {
        if (value?.toMillis) return value.toMillis();
        if (value instanceof Date) return value.getTime();
        const text = String(value ?? "").trim();
        if (/^\d{4}$/.test(text)) return Date.UTC(Number(text), 0, 1);
        const ru = text.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
        const result = ru ? Date.UTC(Number(ru[3]), Number(ru[2]) - 1, Number(ru[1])) : Date.parse(text);
        return Number.isFinite(result) ? result : Infinity;
    }
    function belongs(page) {
        const refs = Array.isArray(page["Франшиза"]) ? page["Франшиза"] : [page["Франшиза"]];
        return refs.some(ref => {
            if (!ref) return false;
            const path = typeof ref === "object" ? ref.path : String(ref).replace(/^\[\[/, "").replace(/\]\]$/, "").split("|")[0];
            return path && dv.page(path)?.file.path === current.file.path;
        });
    }
    const rows = dv.pages('"Кино"').array().filter(page => {
        if (["Просмотры", "Сезоны", "Франшизы"].some(folder => page.file.path.startsWith(`Кино/${folder}/`))) return false;
        const tags = (Array.isArray(page.tags) ? page.tags : [page.tags]).filter(Boolean)
            .map(tag => String(tag).replace(/^#/, ""));
        return tags.some(tag => tag === "movies" || tag === "serial") && belongs(page);
    });
    const byPart = String(current["Порядок"] ?? "").toLowerCase() === "части";
    rows.sort((a, b) => {
        const dates = release(a["Релиз"]) - release(b["Релиз"]);
        const parts = (number(a["Часть"]) ?? Infinity) - (number(b["Часть"]) ?? Infinity);
        return (byPart ? (parts || dates) : (dates || parts)) || a.file.name.localeCompare(b.file.name, "ru");
    });
    dv.paragraph(`Произведений: ${rows.length}. Порядок: ${byPart ? "по номерам частей" : "по дате выхода"}.`);
    if (!rows.length) {
        dv.paragraph("Добавь произведения командой QuickAdd «Франшиза».");
        return;
    }
    dv.table(["Часть", "Произведение", "Релиз", "Моя оценка", "КП", "IMDb"], rows.map(page => [
        number(page["Часть"]) ?? "-", page.file.link, page["Релиз"] ?? "-",
        number(page["Оценка"]) ?? "-", number(page["Оценка Кинопоиск"]) ?? "-",
        number(page["Оценка Imdb"]) ?? "-"
    ]));
}



const CATALOG = {
  "tt0364146": [
    {
      "name": "10.5 баллов",
      "url": "https://en.wikipedia.org/wiki/10.5%3A_Apocalypse",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0463850": [
    {
      "name": "10.5 баллов",
      "url": "https://en.wikipedia.org/wiki/10.5%3A_Apocalypse",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0240772": [
    {
      "name": "Друзья Оушена",
      "url": "https://en.wikipedia.org/wiki/Ocean%27s_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0349903": [
    {
      "name": "Друзья Оушена",
      "url": "https://en.wikipedia.org/wiki/Ocean%27s_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0496806": [
    {
      "name": "Друзья Оушена",
      "url": "https://en.wikipedia.org/wiki/Ocean%27s_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt5164214": [
    {
      "name": "Друзья Оушена",
      "url": "https://en.wikipedia.org/wiki/Ocean%27s_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0414852": [
    {
      "name": "13-й район",
      "url": "https://en.wikipedia.org/wiki/District_13",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1247640": [
    {
      "name": "13-й район",
      "url": "https://en.wikipedia.org/wiki/District_13",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1430612": [
    {
      "name": "13-й район",
      "url": "https://en.wikipedia.org/wiki/District_13",
      "origin": "каталог кинотеки"
    }
  ],
  "tt4427076": [
    {
      "name": "14+",
      "url": "https://ru.wikipedia.org/wiki/14%2B",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0289043": [
    {
      "name": "28 дней спустя",
      "url": "https://en.wikipedia.org/wiki/28_Days_Later_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0091635": [
    {
      "name": "Девять с половиной недель",
      "url": "https://en.wikipedia.org/wiki/Another_9%C2%BD_Weeks",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1846473": [
    {
      "name": "Всё включено",
      "url": "https://ru.wikipedia.org/wiki/%D0%92%D1%81%D1%91_%D0%B2%D0%BA%D0%BB%D1%8E%D1%87%D0%B5%D0%BD%D0%BE_2",
      "origin": "каталог кинотеки"
    }
  ],
  "tt3194426": [
    {
      "name": "Всё включено",
      "url": "https://ru.wikipedia.org/wiki/%D0%92%D1%81%D1%91_%D0%B2%D0%BA%D0%BB%D1%8E%D1%87%D0%B5%D0%BD%D0%BE_2",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0419706": [
    {
      "name": "Doom",
      "url": "https://en.wikipedia.org/wiki/Doom_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0903747": [
    {
      "name": "Во все тяжкие",
      "url": "https://en.wikipedia.org/wiki/Breaking_Bad_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt3032476": [
    {
      "name": "Во все тяжкие",
      "url": "https://en.wikipedia.org/wiki/Breaking_Bad_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt9243946": [
    {
      "name": "Во все тяжкие",
      "url": "https://en.wikipedia.org/wiki/Breaking_Bad_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1046173": [
    {
      "name": "G.I. Joe",
      "url": "https://en.wikipedia.org/wiki/G.I._Joe_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1583421": [
    {
      "name": "G.I. Joe",
      "url": "https://en.wikipedia.org/wiki/G.I._Joe_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt7737786": [
    {
      "name": "Гренландия",
      "url": "https://en.wikipedia.org/wiki/Greenland%3A_Migration",
      "origin": "каталог кинотеки"
    }
  ],
  "tt2802144": [
    {
      "name": "Kingsman",
      "url": "https://en.wikipedia.org/wiki/Kingsman_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt4649466": [
    {
      "name": "Kingsman",
      "url": "https://en.wikipedia.org/wiki/Kingsman_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt6856242": [
    {
      "name": "Kingsman",
      "url": "https://en.wikipedia.org/wiki/Kingsman_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt3013602": [
    {
      "name": "Superнянь",
      "url": "https://en.wikipedia.org/wiki/Babysitting_2",
      "origin": "каталог кинотеки"
    }
  ],
  "tt4400058": [
    {
      "name": "Superнянь",
      "url": "https://en.wikipedia.org/wiki/Babysitting_2",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0146316": [
    {
      "name": "Лара Крофт",
      "url": "https://en.wikipedia.org/wiki/Tomb_Raider_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0325703": [
    {
      "name": "Лара Крофт",
      "url": "https://en.wikipedia.org/wiki/Tomb_Raider_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1365519": [
    {
      "name": "Лара Крофт",
      "url": "https://en.wikipedia.org/wiki/Tomb_Raider_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1307824": [
    {
      "name": "V",
      "url": "https://en.wikipedia.org/wiki/V_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt13560574": [
    {
      "name": "X",
      "url": "https://en.wikipedia.org/wiki/X_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1156398": [
    {
      "name": "Зомбилэнд",
      "url": "https://en.wikipedia.org/wiki/Zombieland_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1560220": [
    {
      "name": "Зомбилэнд",
      "url": "https://en.wikipedia.org/wiki/Zombieland_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0499549": [
    {
      "name": "Аватар",
      "url": "https://en.wikipedia.org/wiki/Avatar_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1630029": [
    {
      "name": "Аватар",
      "url": "https://en.wikipedia.org/wiki/Avatar_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1757678": [
    {
      "name": "Аватар",
      "url": "https://en.wikipedia.org/wiki/Avatar_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0274166": [
    {
      "name": "Джонни Инглиш",
      "url": "https://en.wikipedia.org/wiki/Johnny_English_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1634122": [
    {
      "name": "Джонни Инглиш",
      "url": "https://en.wikipedia.org/wiki/Johnny_English_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt6921996": [
    {
      "name": "Джонни Инглиш",
      "url": "https://en.wikipedia.org/wiki/Johnny_English_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0313911": [
    {
      "name": "Агент Коди Бэнкс",
      "url": "https://en.wikipedia.org/wiki/Agent_Cody_Banks_2%3A_Destination_London",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0358349": [
    {
      "name": "Агент Коди Бэнкс",
      "url": "https://en.wikipedia.org/wiki/Agent_Cody_Banks_2%3A_Destination_London",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1638355": [
    {
      "name": "Агенты А.Н.К.Л.",
      "url": "https://en.wikipedia.org/wiki/The_Man_from_U.N.C.L.E._%28film%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0479884": [
    {
      "name": "Адреналин",
      "url": "https://en.wikipedia.org/wiki/Crank%3A_High_Voltage",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1121931": [
    {
      "name": "Адреналин",
      "url": "https://en.wikipedia.org/wiki/Crank%3A_High_Voltage",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1477834": [
    {
      "name": "Аквамен",
      "url": "https://en.wikipedia.org/wiki/Aquaman_and_the_Lost_Kingdom",
      "origin": "каталог кинотеки"
    }
  ],
  "tt6139732": [
    {
      "name": "Аладдин",
      "url": "https://en.wikipedia.org/wiki/Aladdin_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0415481": [
    {
      "name": "Три богатыря",
      "url": "https://ru.wikipedia.org/wiki/%D0%A2%D1%80%D0%B8_%D0%B1%D0%BE%D0%B3%D0%B0%D1%82%D1%8B%D1%80%D1%8F_%28%D1%84%D1%80%D0%B0%D0%BD%D1%88%D0%B8%D0%B7%D0%B0%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0465967": [
    {
      "name": "Три богатыря",
      "url": "https://ru.wikipedia.org/wiki/%D0%A2%D1%80%D0%B8_%D0%B1%D0%BE%D0%B3%D0%B0%D1%82%D1%8B%D1%80%D1%8F_%28%D1%84%D1%80%D0%B0%D0%BD%D1%88%D0%B8%D0%B7%D0%B0%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1189893": [
    {
      "name": "Три богатыря",
      "url": "https://ru.wikipedia.org/wiki/%D0%A2%D1%80%D0%B8_%D0%B1%D0%BE%D0%B3%D0%B0%D1%82%D1%8B%D1%80%D1%8F_%28%D1%84%D1%80%D0%B0%D0%BD%D1%88%D0%B8%D0%B7%D0%B0%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1796657": [
    {
      "name": "Три богатыря",
      "url": "https://ru.wikipedia.org/wiki/%D0%A2%D1%80%D0%B8_%D0%B1%D0%BE%D0%B3%D0%B0%D1%82%D1%8B%D1%80%D1%8F_%28%D1%84%D1%80%D0%B0%D0%BD%D1%88%D0%B8%D0%B7%D0%B0%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt2592484": [
    {
      "name": "Три богатыря",
      "url": "https://ru.wikipedia.org/wiki/%D0%A2%D1%80%D0%B8_%D0%B1%D0%BE%D0%B3%D0%B0%D1%82%D1%8B%D1%80%D1%8F_%28%D1%84%D1%80%D0%B0%D0%BD%D1%88%D0%B8%D0%B7%D0%B0%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt4544278": [
    {
      "name": "Три богатыря",
      "url": "https://ru.wikipedia.org/wiki/%D0%A2%D1%80%D0%B8_%D0%B1%D0%BE%D0%B3%D0%B0%D1%82%D1%8B%D1%80%D1%8F_%28%D1%84%D1%80%D0%B0%D0%BD%D1%88%D0%B8%D0%B7%D0%B0%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt6389344": [
    {
      "name": "Три богатыря",
      "url": "https://ru.wikipedia.org/wiki/%D0%A2%D1%80%D0%B8_%D0%B1%D0%BE%D0%B3%D0%B0%D1%82%D1%8B%D1%80%D1%8F_%28%D1%84%D1%80%D0%B0%D0%BD%D1%88%D0%B8%D0%B7%D0%B0%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt7548114": [
    {
      "name": "Три богатыря",
      "url": "https://ru.wikipedia.org/wiki/%D0%A2%D1%80%D0%B8_%D0%B1%D0%BE%D0%B3%D0%B0%D1%82%D1%8B%D1%80%D1%8F_%28%D1%84%D1%80%D0%B0%D0%BD%D1%88%D0%B8%D0%B7%D0%B0%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt8682096": [
    {
      "name": "Три богатыря",
      "url": "https://ru.wikipedia.org/wiki/%D0%A2%D1%80%D0%B8_%D0%B1%D0%BE%D0%B3%D0%B0%D1%82%D1%8B%D1%80%D1%8F_%28%D1%84%D1%80%D0%B0%D0%BD%D1%88%D0%B8%D0%B7%D0%B0%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt13811736": [
    {
      "name": "Три богатыря",
      "url": "https://ru.wikipedia.org/wiki/%D0%A2%D1%80%D0%B8_%D0%B1%D0%BE%D0%B3%D0%B0%D1%82%D1%8B%D1%80%D1%8F_%28%D1%84%D1%80%D0%B0%D0%BD%D1%88%D0%B8%D0%B7%D0%B0%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt14469640": [
    {
      "name": "Три богатыря",
      "url": "https://ru.wikipedia.org/wiki/%D0%A2%D1%80%D0%B8_%D0%B1%D0%BE%D0%B3%D0%B0%D1%82%D1%8B%D1%80%D1%8F_%28%D1%84%D1%80%D0%B0%D0%BD%D1%88%D0%B8%D0%B7%D0%B0%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt27526478": [
    {
      "name": "Три богатыря",
      "url": "https://ru.wikipedia.org/wiki/%D0%A2%D1%80%D0%B8_%D0%B1%D0%BE%D0%B3%D0%B0%D1%82%D1%8B%D1%80%D1%8F_%28%D1%84%D1%80%D0%B0%D0%BD%D1%88%D0%B8%D0%B7%D0%B0%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt37167782": [
    {
      "name": "Три богатыря",
      "url": "https://ru.wikipedia.org/wiki/%D0%A2%D1%80%D0%B8_%D0%B1%D0%BE%D0%B3%D0%B0%D1%82%D1%8B%D1%80%D1%8F_%28%D1%84%D1%80%D0%B0%D0%BD%D1%88%D0%B8%D0%B7%D0%B0%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0090390": [
    {
      "name": "Альф",
      "url": "https://en.wikipedia.org/wiki/Project_ALF",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0163651": [
    {
      "name": "Американский пирог",
      "url": "https://en.wikipedia.org/wiki/American_Pie_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0252866": [
    {
      "name": "Американский пирог",
      "url": "https://en.wikipedia.org/wiki/American_Pie_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0328828": [
    {
      "name": "Американский пирог",
      "url": "https://en.wikipedia.org/wiki/American_Pie_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0436058": [
    {
      "name": "Американский пирог",
      "url": "https://en.wikipedia.org/wiki/American_Pie_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0808146": [
    {
      "name": "Американский пирог",
      "url": "https://en.wikipedia.org/wiki/American_Pie_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0974959": [
    {
      "name": "Американский пирог",
      "url": "https://en.wikipedia.org/wiki/American_Pie_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1407050": [
    {
      "name": "Американский пирог",
      "url": "https://en.wikipedia.org/wiki/American_Pie_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1605630": [
    {
      "name": "Американский пирог",
      "url": "https://en.wikipedia.org/wiki/American_Pie_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt11771594": [
    {
      "name": "Американский пирог",
      "url": "https://en.wikipedia.org/wiki/American_Pie_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0144084": [
    {
      "name": "Американский психопат",
      "url": "https://en.wikipedia.org/wiki/American_Psycho_2",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0283877": [
    {
      "name": "Американский психопат",
      "url": "https://en.wikipedia.org/wiki/American_Psycho_2",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0382625": [
    {
      "name": "Роберт Лэнгдон",
      "url": "https://en.wikipedia.org/wiki/Robert_Langdon_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0808151": [
    {
      "name": "Роберт Лэнгдон",
      "url": "https://en.wikipedia.org/wiki/Robert_Langdon_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt3062096": [
    {
      "name": "Роберт Лэнгдон",
      "url": "https://en.wikipedia.org/wiki/Robert_Langdon_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt10478054": [
    {
      "name": "Роберт Лэнгдон",
      "url": "https://en.wikipedia.org/wiki/Robert_Langdon_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0993840": [
    {
      "name": "Армия мертвецов",
      "url": "https://en.wikipedia.org/wiki/Army_of_the_Dead_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt13024674": [
    {
      "name": "Армия мертвецов",
      "url": "https://en.wikipedia.org/wiki/Army_of_the_Dead_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0133385": [
    {
      "name": "Астерикс и Обеликс",
      "url": "https://en.wikipedia.org/wiki/List_of_Asterix_films",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0250223": [
    {
      "name": "Астерикс и Обеликс",
      "url": "https://en.wikipedia.org/wiki/List_of_Asterix_films",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0463872": [
    {
      "name": "Астерикс и Обеликс",
      "url": "https://en.wikipedia.org/wiki/List_of_Asterix_films",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1597522": [
    {
      "name": "Астерикс и Обеликс",
      "url": "https://en.wikipedia.org/wiki/List_of_Asterix_films",
      "origin": "каталог кинотеки"
    }
  ],
  "tt11210390": [
    {
      "name": "Астерикс и Обеликс",
      "url": "https://en.wikipedia.org/wiki/List_of_Asterix_films",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0480239": [
    {
      "name": "Атлант расправил плечи",
      "url": "https://en.wikipedia.org/wiki/Atlas_Shrugged_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1985017": [
    {
      "name": "Атлант расправил плечи",
      "url": "https://en.wikipedia.org/wiki/Atlas_Shrugged_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt2800038": [
    {
      "name": "Атлант расправил плечи",
      "url": "https://en.wikipedia.org/wiki/Atlas_Shrugged_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0418279": [
    {
      "name": "Трансформеры",
      "url": "https://en.wikipedia.org/wiki/Transformers_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1055369": [
    {
      "name": "Трансформеры",
      "url": "https://en.wikipedia.org/wiki/Transformers_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1399103": [
    {
      "name": "Трансформеры",
      "url": "https://en.wikipedia.org/wiki/Transformers_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt2109248": [
    {
      "name": "Трансформеры",
      "url": "https://en.wikipedia.org/wiki/Transformers_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt3371366": [
    {
      "name": "Трансформеры",
      "url": "https://en.wikipedia.org/wiki/Transformers_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt4701182": [
    {
      "name": "Трансформеры",
      "url": "https://en.wikipedia.org/wiki/Transformers_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt5090568": [
    {
      "name": "Трансформеры",
      "url": "https://en.wikipedia.org/wiki/Transformers_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt14111652": [
    {
      "name": "Батя",
      "url": "https://ru.wikipedia.org/wiki/%D0%91%D0%B0%D1%82%D1%8F_%28%D1%84%D0%B8%D0%BB%D1%8C%D0%BC%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1790864": [
    {
      "name": "Бегущий в лабиринте",
      "url": "https://en.wikipedia.org/wiki/Maze_Runner_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt4046784": [
    {
      "name": "Бегущий в лабиринте",
      "url": "https://en.wikipedia.org/wiki/Maze_Runner_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt4500922": [
    {
      "name": "Бегущий в лабиринте",
      "url": "https://en.wikipedia.org/wiki/Maze_Runner_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0412915": [
    {
      "name": "Библиотекарь",
      "url": "https://en.wikipedia.org/wiki/The_Librarian_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0455596": [
    {
      "name": "Библиотекарь",
      "url": "https://en.wikipedia.org/wiki/The_Librarian_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1146438": [
    {
      "name": "Библиотекарь",
      "url": "https://en.wikipedia.org/wiki/The_Librarian_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0800320": [
    {
      "name": "Битва титанов",
      "url": "https://en.wikipedia.org/wiki/Clash_of_the_Titans_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1646987": [
    {
      "name": "Битва титанов",
      "url": "https://en.wikipedia.org/wiki/Clash_of_the_Titans_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0250494": [
    {
      "name": "Блондинка в законе",
      "url": "https://en.wikipedia.org/wiki/Legally_Blonde_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0333780": [
    {
      "name": "Блондинка в законе",
      "url": "https://en.wikipedia.org/wiki/Legally_Blonde_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt7605074": [
    {
      "name": "Блуждающая Земля",
      "url": "https://en.wikipedia.org/wiki/The_Wandering_Earth_2",
      "origin": "каталог кинотеки"
    }
  ],
  "tt13539646": [
    {
      "name": "Блуждающая Земля",
      "url": "https://en.wikipedia.org/wiki/The_Wandering_Earth_2",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1520211": [
    {
      "name": "Ходячие мертвецы",
      "url": "https://en.wikipedia.org/wiki/The_Walking_Dead_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt3743822": [
    {
      "name": "Ходячие мертвецы",
      "url": "https://en.wikipedia.org/wiki/The_Walking_Dead_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt9859436": [
    {
      "name": "Ходячие мертвецы",
      "url": "https://en.wikipedia.org/wiki/The_Walking_Dead_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt13062500": [
    {
      "name": "Ходячие мертвецы",
      "url": "https://en.wikipedia.org/wiki/The_Walking_Dead_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt18546730": [
    {
      "name": "Ходячие мертвецы",
      "url": "https://en.wikipedia.org/wiki/The_Walking_Dead_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0348333": [
    {
      "name": "Большая жратва",
      "url": "https://en.wikipedia.org/wiki/Still_Waiting...",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0208003": [
    {
      "name": "Дом большой мамочки",
      "url": "https://en.wikipedia.org/wiki/Big_Momma%27s_House_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0421729": [
    {
      "name": "Дом большой мамочки",
      "url": "https://en.wikipedia.org/wiki/Big_Momma%27s_House_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1464174": [
    {
      "name": "Дом большой мамочки",
      "url": "https://en.wikipedia.org/wiki/Big_Momma%27s_House_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0337898": [
    {
      "name": "Бригада",
      "url": "https://ru.wikipedia.org/wiki/%D0%91%D1%80%D0%B8%D0%B3%D0%B0%D0%B4%D0%B0%3A_%D0%9D%D0%B0%D1%81%D0%BB%D0%B5%D0%B4%D0%BD%D0%B8%D0%BA",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1765729": [
    {
      "name": "Бригада",
      "url": "https://ru.wikipedia.org/wiki/%D0%91%D1%80%D0%B8%D0%B3%D0%B0%D0%B4%D0%B0%3A_%D0%9D%D0%B0%D1%81%D0%BB%D0%B5%D0%B4%D0%BD%D0%B8%D0%BA",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0243155": [
    {
      "name": "Бриджит Джонс",
      "url": "https://en.wikipedia.org/wiki/Bridget_Jones_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0317198": [
    {
      "name": "Бриджит Джонс",
      "url": "https://en.wikipedia.org/wiki/Bridget_Jones_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0315327": [
    {
      "name": "Брюс и Эван Всемогущие",
      "url": "https://en.wikipedia.org/wiki/Evan_Almighty",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0413099": [
    {
      "name": "Брюс и Эван Всемогущие",
      "url": "https://en.wikipedia.org/wiki/Evan_Almighty",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1173907": [
    {
      "name": "Жизнь после людей",
      "url": "https://en.wikipedia.org/wiki/Life_After_People",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1433058": [
    {
      "name": "Жизнь после людей",
      "url": "https://en.wikipedia.org/wiki/Life_After_People",
      "origin": "каталог кинотеки"
    }
  ],
  "tt2975590": [
    {
      "name": "Расширенная вселенная DC",
      "url": "https://en.wikipedia.org/wiki/DC_Extended_Universe",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0974015": [
    {
      "name": "Расширенная вселенная DC",
      "url": "https://en.wikipedia.org/wiki/DC_Extended_Universe",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0770828": [
    {
      "name": "Расширенная вселенная DC",
      "url": "https://en.wikipedia.org/wiki/DC_Extended_Universe",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1386697": [
    {
      "name": "Расширенная вселенная DC",
      "url": "https://en.wikipedia.org/wiki/DC_Extended_Universe",
      "origin": "каталог кинотеки"
    }
  ],
  "tt7713068": [
    {
      "name": "Расширенная вселенная DC",
      "url": "https://en.wikipedia.org/wiki/DC_Extended_Universe",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0439572": [
    {
      "name": "Расширенная вселенная DC",
      "url": "https://en.wikipedia.org/wiki/DC_Extended_Universe",
      "origin": "каталог кинотеки"
    }
  ],
  "tt9362930": [
    {
      "name": "Расширенная вселенная DC",
      "url": "https://en.wikipedia.org/wiki/DC_Extended_Universe",
      "origin": "каталог кинотеки"
    }
  ],
  "tt6015328": [
    {
      "name": "В погоне за драконами",
      "url": "https://en.wikipedia.org/wiki/Chasing_the_Dragon_II%3A_Wild_Wild_Bunch",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1075417": [
    {
      "name": "Ведьмина гора",
      "url": "https://en.wikipedia.org/wiki/Witch_Mountain_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0455944": [
    {
      "name": "Великий уравнитель",
      "url": "https://en.wikipedia.org/wiki/The_Equalizer_2",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1270797": [
    {
      "name": "Веном",
      "url": "https://en.wikipedia.org/wiki/Venom_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt7097896": [
    {
      "name": "Веном",
      "url": "https://en.wikipedia.org/wiki/Venom_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt9032400": [
    {
      "name": "Киновселенная Marvel",
      "url": "https://en.wikipedia.org/wiki/Marvel_Cinematic_Universe",
      "origin": "каталог кинотеки"
    }
  ],
  "tt20969586": [
    {
      "name": "Киновселенная Marvel",
      "url": "https://en.wikipedia.org/wiki/Marvel_Cinematic_Universe",
      "origin": "каталог кинотеки"
    }
  ],
  "tt10857160": [
    {
      "name": "Киновселенная Marvel",
      "url": "https://en.wikipedia.org/wiki/Marvel_Cinematic_Universe",
      "origin": "каталог кинотеки"
    }
  ],
  "tt9140554": [
    {
      "name": "Киновселенная Marvel",
      "url": "https://en.wikipedia.org/wiki/Marvel_Cinematic_Universe",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0800080": [
    {
      "name": "Киновселенная Marvel",
      "url": "https://en.wikipedia.org/wiki/Marvel_Cinematic_Universe",
      "origin": "каталог кинотеки"
    }
  ],
  "tt3480822": [
    {
      "name": "Киновселенная Marvel",
      "url": "https://en.wikipedia.org/wiki/Marvel_Cinematic_Universe",
      "origin": "каталог кинотеки"
    }
  ],
  "tt9376612": [
    {
      "name": "Киновселенная Marvel",
      "url": "https://en.wikipedia.org/wiki/Marvel_Cinematic_Universe",
      "origin": "каталог кинотеки"
    }
  ],
  "tt2261227": [
    {
      "name": "Видоизменённый углерод",
      "url": "https://en.wikipedia.org/wiki/Altered_Carbon%3A_Resleeved",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0120737": [
    {
      "name": "Средиземье",
      "url": "https://en.wikipedia.org/wiki/Middle-earth_in_film",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0167261": [
    {
      "name": "Средиземье",
      "url": "https://en.wikipedia.org/wiki/Middle-earth_in_film",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0167260": [
    {
      "name": "Средиземье",
      "url": "https://en.wikipedia.org/wiki/Middle-earth_in_film",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0903624": [
    {
      "name": "Средиземье",
      "url": "https://en.wikipedia.org/wiki/Middle-earth_in_film",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1170358": [
    {
      "name": "Средиземье",
      "url": "https://en.wikipedia.org/wiki/Middle-earth_in_film",
      "origin": "каталог кинотеки"
    }
  ],
  "tt2310332": [
    {
      "name": "Средиземье",
      "url": "https://en.wikipedia.org/wiki/Middle-earth_in_film",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0080453": [
    {
      "name": "Голубая лагуна",
      "url": "https://en.wikipedia.org/wiki/Blue_Lagoon%3A_The_Awakening",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0102782": [
    {
      "name": "Голубая лагуна",
      "url": "https://en.wikipedia.org/wiki/Blue_Lagoon%3A_The_Awakening",
      "origin": "каталог кинотеки"
    }
  ],
  "tt2287663": [
    {
      "name": "Голубая лагуна",
      "url": "https://en.wikipedia.org/wiki/Blue_Lagoon%3A_The_Awakening",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0054189": [
    {
      "name": "Том Рипли",
      "url": "https://en.wikipedia.org/wiki/Tom_Ripley",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0134119": [
    {
      "name": "Том Рипли",
      "url": "https://en.wikipedia.org/wiki/Tom_Ripley",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0265651": [
    {
      "name": "Том Рипли",
      "url": "https://en.wikipedia.org/wiki/Tom_Ripley",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0219171": [
    {
      "name": "Том Рипли",
      "url": "https://en.wikipedia.org/wiki/Tom_Ripley",
      "origin": "каталог кинотеки"
    }
  ],
  "tt11016042": [
    {
      "name": "Том Рипли",
      "url": "https://en.wikipedia.org/wiki/Tom_Ripley",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0133152": [
    {
      "name": "Планета обезьян",
      "url": "https://en.wikipedia.org/wiki/Planet_of_the_Apes",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1318514": [
    {
      "name": "Планета обезьян",
      "url": "https://en.wikipedia.org/wiki/Planet_of_the_Apes",
      "origin": "каталог кинотеки"
    }
  ],
  "tt2103281": [
    {
      "name": "Планета обезьян",
      "url": "https://en.wikipedia.org/wiki/Planet_of_the_Apes",
      "origin": "каталог кинотеки"
    }
  ],
  "tt3450958": [
    {
      "name": "Планета обезьян",
      "url": "https://en.wikipedia.org/wiki/Planet_of_the_Apes",
      "origin": "каталог кинотеки"
    }
  ],
  "tt11389872": [
    {
      "name": "Планета обезьян",
      "url": "https://en.wikipedia.org/wiki/Planet_of_the_Apes",
      "origin": "каталог кинотеки"
    }
  ],
  "tt2356464": [
    {
      "name": "Восточный ветер",
      "url": "https://en.wikipedia.org/wiki/Windstorm_%28film%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt3849938": [
    {
      "name": "Восточный ветер",
      "url": "https://en.wikipedia.org/wiki/Windstorm_%28film%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt5311972": [
    {
      "name": "Восточный ветер",
      "url": "https://en.wikipedia.org/wiki/Windstorm_%28film%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt9182284": [
    {
      "name": "Восточный ветер",
      "url": "https://en.wikipedia.org/wiki/Windstorm_%28film%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt11560730": [
    {
      "name": "Восточный ветер",
      "url": "https://en.wikipedia.org/wiki/Windstorm_%28film%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1456635": [
    {
      "name": "Вышибала",
      "url": "https://en.wikipedia.org/wiki/Goon%3A_Last_of_the_Enforcers",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1323594": [
    {
      "name": "Гадкий я и Миньоны",
      "url": "https://en.wikipedia.org/wiki/Despicable_Me",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1690953": [
    {
      "name": "Гадкий я и Миньоны",
      "url": "https://en.wikipedia.org/wiki/Despicable_Me",
      "origin": "каталог кинотеки"
    }
  ],
  "tt2293640": [
    {
      "name": "Гадкий я и Миньоны",
      "url": "https://en.wikipedia.org/wiki/Despicable_Me",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0366551": [
    {
      "name": "Гарольд и Кумар",
      "url": "https://en.wikipedia.org/wiki/Harold_%26_Kumar",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0481536": [
    {
      "name": "Гарольд и Кумар",
      "url": "https://en.wikipedia.org/wiki/Harold_%26_Kumar",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1268799": [
    {
      "name": "Гарольд и Кумар",
      "url": "https://en.wikipedia.org/wiki/Harold_%26_Kumar",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0241527": [
    {
      "name": "Волшебный мир Гарри Поттера",
      "url": "https://en.wikipedia.org/wiki/Wizarding_World",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0295297": [
    {
      "name": "Волшебный мир Гарри Поттера",
      "url": "https://en.wikipedia.org/wiki/Wizarding_World",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0304141": [
    {
      "name": "Волшебный мир Гарри Поттера",
      "url": "https://en.wikipedia.org/wiki/Wizarding_World",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0330373": [
    {
      "name": "Волшебный мир Гарри Поттера",
      "url": "https://en.wikipedia.org/wiki/Wizarding_World",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0373889": [
    {
      "name": "Волшебный мир Гарри Поттера",
      "url": "https://en.wikipedia.org/wiki/Wizarding_World",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0417741": [
    {
      "name": "Волшебный мир Гарри Поттера",
      "url": "https://en.wikipedia.org/wiki/Wizarding_World",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0926084": [
    {
      "name": "Волшебный мир Гарри Поттера",
      "url": "https://en.wikipedia.org/wiki/Wizarding_World",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1201607": [
    {
      "name": "Волшебный мир Гарри Поттера",
      "url": "https://en.wikipedia.org/wiki/Wizarding_World",
      "origin": "каталог кинотеки"
    }
  ],
  "tt3183660": [
    {
      "name": "Волшебный мир Гарри Поттера",
      "url": "https://en.wikipedia.org/wiki/Wizarding_World",
      "origin": "каталог кинотеки"
    }
  ],
  "tt4123430": [
    {
      "name": "Волшебный мир Гарри Поттера",
      "url": "https://en.wikipedia.org/wiki/Wizarding_World",
      "origin": "каталог кинотеки"
    }
  ],
  "tt4123432": [
    {
      "name": "Волшебный мир Гарри Поттера",
      "url": "https://en.wikipedia.org/wiki/Wizarding_World",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0473705": [
    {
      "name": "На игре",
      "url": "https://ru.wikipedia.org/wiki/%D0%93%D0%B5%D0%B9%D0%BC%D0%B5%D1%80%D1%8B",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1620549": [
    {
      "name": "На игре",
      "url": "https://ru.wikipedia.org/wiki/%D0%93%D0%B5%D0%B9%D0%BC%D0%B5%D1%80%D1%8B",
      "origin": "каталог кинотеки"
    }
  ],
  "tt4216630": [
    {
      "name": "На игре",
      "url": "https://ru.wikipedia.org/wiki/%D0%93%D0%B5%D0%B9%D0%BC%D0%B5%D1%80%D1%8B",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0813715": [
    {
      "name": "Герои",
      "url": "https://en.wikipedia.org/wiki/Heroes_Reborn_%28miniseries%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt3556944": [
    {
      "name": "Герои",
      "url": "https://en.wikipedia.org/wiki/Heroes_Reborn_%28miniseries%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0172495": [
    {
      "name": "Гладиатор",
      "url": "https://en.wikipedia.org/wiki/Gladiator_II",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0831387": [
    {
      "name": "Годзилла - MonsterVerse",
      "url": "https://en.wikipedia.org/wiki/MonsterVerse",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1392170": [
    {
      "name": "Голодные игры",
      "url": "https://en.wikipedia.org/wiki/The_Hunger_Games_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0087363": [
    {
      "name": "Гремлины",
      "url": "https://en.wikipedia.org/wiki/Gremlins_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0099700": [
    {
      "name": "Гремлины",
      "url": "https://en.wikipedia.org/wiki/Gremlins_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt9624470": [
    {
      "name": "Громкая связь",
      "url": "https://ru.wikipedia.org/wiki/%D0%9E%D0%B1%D1%80%D0%B0%D1%82%D0%BD%D0%B0%D1%8F_%D1%81%D0%B2%D1%8F%D0%B7%D1%8C_%28%D1%84%D0%B8%D0%BB%D1%8C%D0%BC%2C_2020%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt13652420": [
    {
      "name": "Громкая связь",
      "url": "https://ru.wikipedia.org/wiki/%D0%9E%D0%B1%D1%80%D0%B0%D1%82%D0%BD%D0%B0%D1%8F_%D1%81%D0%B2%D1%8F%D0%B7%D1%8C_%28%D1%84%D0%B8%D0%BB%D1%8C%D0%BC%2C_2020%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0187636": [
    {
      "name": "Далеко во Вселенной",
      "url": "https://en.wikipedia.org/wiki/Farscape%3A_The_Peacekeeper_Wars",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1568346": [
    {
      "name": "Миллениум",
      "url": "https://en.wikipedia.org/wiki/The_Girl_in_the_Spider%27s_Web_%28film%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0773262": [
    {
      "name": "Декстер",
      "url": "https://en.wikipedia.org/wiki/Dexter_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt14164730": [
    {
      "name": "Декстер",
      "url": "https://en.wikipedia.org/wiki/Dexter_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt33043892": [
    {
      "name": "Декстер",
      "url": "https://en.wikipedia.org/wiki/Dexter_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0918511": [
    {
      "name": "Деннис-мучитель",
      "url": "https://en.wikipedia.org/wiki/A_Dennis_the_Menace_Christmas",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0428144": [
    {
      "name": "День катастрофы",
      "url": "https://en.wikipedia.org/wiki/Category_7%3A_The_End_of_the_World",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0468988": [
    {
      "name": "День катастрофы",
      "url": "https://en.wikipedia.org/wiki/Category_7%3A_The_End_of_the_World",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0116629": [
    {
      "name": "День независимости",
      "url": "https://en.wikipedia.org/wiki/Independence_Day_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1628841": [
    {
      "name": "День независимости",
      "url": "https://en.wikipedia.org/wiki/Independence_Day_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0227538": [
    {
      "name": "Дети шпионов",
      "url": "https://en.wikipedia.org/wiki/Spy_Kids",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0287717": [
    {
      "name": "Дети шпионов",
      "url": "https://en.wikipedia.org/wiki/Spy_Kids",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0338459": [
    {
      "name": "Дети шпионов",
      "url": "https://en.wikipedia.org/wiki/Spy_Kids",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1517489": [
    {
      "name": "Дети шпионов",
      "url": "https://en.wikipedia.org/wiki/Spy_Kids",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0258463": [
    {
      "name": "Джейсон Борн",
      "url": "https://en.wikipedia.org/wiki/Bourne_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0372183": [
    {
      "name": "Джейсон Борн",
      "url": "https://en.wikipedia.org/wiki/Bourne_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0440963": [
    {
      "name": "Джейсон Борн",
      "url": "https://en.wikipedia.org/wiki/Bourne_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1194173": [
    {
      "name": "Джейсон Борн",
      "url": "https://en.wikipedia.org/wiki/Bourne_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt4196776": [
    {
      "name": "Джейсон Борн",
      "url": "https://en.wikipedia.org/wiki/Bourne_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt8367814": [
    {
      "name": "Джентльмены",
      "url": "https://en.wikipedia.org/wiki/The_Gentlemen_%282024_TV_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0263488": [
    {
      "name": "Джиперс Криперс",
      "url": "https://en.wikipedia.org/wiki/Jeepers_Creepers_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0301470": [
    {
      "name": "Джиперс Криперс",
      "url": "https://en.wikipedia.org/wiki/Jeepers_Creepers_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1139592": [
    {
      "name": "Джиперс Криперс",
      "url": "https://en.wikipedia.org/wiki/Jeepers_Creepers_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt14121726": [
    {
      "name": "Джиперс Криперс",
      "url": "https://en.wikipedia.org/wiki/Jeepers_Creepers_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt2283362": [
    {
      "name": "Джуманджи",
      "url": "https://en.wikipedia.org/wiki/Jumanji_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt7975244": [
    {
      "name": "Джуманджи",
      "url": "https://en.wikipedia.org/wiki/Jumanji_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1840309": [
    {
      "name": "Дивергент",
      "url": "https://en.wikipedia.org/wiki/The_Divergent_Series",
      "origin": "каталог кинотеки"
    }
  ],
  "tt2908446": [
    {
      "name": "Дивергент",
      "url": "https://en.wikipedia.org/wiki/The_Divergent_Series",
      "origin": "каталог кинотеки"
    }
  ],
  "tt3410834": [
    {
      "name": "Дивергент",
      "url": "https://en.wikipedia.org/wiki/The_Divergent_Series",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0439358": [
    {
      "name": "Диверсант",
      "url": "https://ru.wikipedia.org/wiki/%D0%94%D0%B8%D0%B2%D0%B5%D1%80%D1%81%D0%B0%D0%BD%D1%82_%28%D1%82%D0%B5%D0%BB%D0%B5%D1%81%D0%B5%D1%80%D0%B8%D0%B0%D0%BB%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0835007": [
    {
      "name": "Диверсант",
      "url": "https://ru.wikipedia.org/wiki/%D0%94%D0%B8%D0%B2%D0%B5%D1%80%D1%81%D0%B0%D0%BD%D1%82_%28%D1%82%D0%B5%D0%BB%D0%B5%D1%81%D0%B5%D1%80%D0%B8%D0%B0%D0%BB%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt12274782": [
    {
      "name": "Диверсант",
      "url": "https://ru.wikipedia.org/wiki/%D0%94%D0%B8%D0%B2%D0%B5%D1%80%D1%81%D0%B0%D0%BD%D1%82_%28%D1%82%D0%B5%D0%BB%D0%B5%D1%81%D0%B5%D1%80%D0%B8%D0%B0%D0%BB%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt28511577": [
    {
      "name": "Диверсант",
      "url": "https://ru.wikipedia.org/wiki/%D0%94%D0%B8%D0%B2%D0%B5%D1%80%D1%81%D0%B0%D0%BD%D1%82_%28%D1%82%D0%B5%D0%BB%D0%B5%D1%81%D0%B5%D1%80%D0%B8%D0%B0%D0%BB%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0378109": [
    {
      "name": "Добро пожаловать в рай",
      "url": "https://en.wikipedia.org/wiki/Into_the_Blue_2%3A_The_Reef",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0865907": [
    {
      "name": "Добро пожаловать в рай",
      "url": "https://en.wikipedia.org/wiki/Into_the_Blue_2%3A_The_Reef",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0118998": [
    {
      "name": "Доктор Дулиттл",
      "url": "https://en.wikipedia.org/wiki/Dr._Dolittle_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0240462": [
    {
      "name": "Доктор Дулиттл",
      "url": "https://en.wikipedia.org/wiki/Dr._Dolittle_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt8085790": [
    {
      "name": "Доктор Дулиттл",
      "url": "https://en.wikipedia.org/wiki/Dr._Dolittle_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1211837": [
    {
      "name": "Доктор Стрэндж",
      "url": "https://en.wikipedia.org/wiki/Doctor_Strange_in_the_Multiverse_of_Madness",
      "origin": "каталог кинотеки"
    }
  ],
  "tt9419884": [
    {
      "name": "Доктор Стрэндж",
      "url": "https://en.wikipedia.org/wiki/Doctor_Strange_in_the_Multiverse_of_Madness",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0097523": [
    {
      "name": "Дорогая, я уменьшил детей",
      "url": "https://en.wikipedia.org/wiki/Honey%2C_I_Shrunk_the_Kids_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0104437": [
    {
      "name": "Дорогая, я уменьшил детей",
      "url": "https://en.wikipedia.org/wiki/Honey%2C_I_Shrunk_the_Kids_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0119310": [
    {
      "name": "Дорогая, я уменьшил детей",
      "url": "https://en.wikipedia.org/wiki/Honey%2C_I_Shrunk_the_Kids_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0215129": [
    {
      "name": "Дорожное приключение",
      "url": "https://en.wikipedia.org/wiki/Road_Trip%3A_Beer_Pong",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1319733": [
    {
      "name": "Дорожное приключение",
      "url": "https://en.wikipedia.org/wiki/Road_Trip%3A_Beer_Pong",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0374102": [
    {
      "name": "Открытое море",
      "url": "https://en.wikipedia.org/wiki/Open_Water_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0470055": [
    {
      "name": "Открытое море",
      "url": "https://en.wikipedia.org/wiki/Open_Water_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0377092": [
    {
      "name": "Дрянные девчонки",
      "url": "https://en.wikipedia.org/wiki/Mean_Girls_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1679235": [
    {
      "name": "Дрянные девчонки",
      "url": "https://en.wikipedia.org/wiki/Mean_Girls_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1826660": [
    {
      "name": "Духless",
      "url": "https://en.wikipedia.org/wiki/Soulless_2",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0348914": [
    {
      "name": "Дэдвуд",
      "url": "https://en.wikipedia.org/wiki/Deadwood%3A_The_Movie",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1431045": [
    {
      "name": "Дэдпул",
      "url": "https://en.wikipedia.org/wiki/Deadpool_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt5463162": [
    {
      "name": "Дэдпул",
      "url": "https://en.wikipedia.org/wiki/Deadpool_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt6263850": [
    {
      "name": "Дэдпул",
      "url": "https://en.wikipedia.org/wiki/Deadpool_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0085995": [
    {
      "name": "Каникулы Гризволдов",
      "url": "https://en.wikipedia.org/wiki/National_Lampoon%27s_Vacation_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0089670": [
    {
      "name": "Каникулы Гризволдов",
      "url": "https://en.wikipedia.org/wiki/National_Lampoon%27s_Vacation_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0097958": [
    {
      "name": "Каникулы Гризволдов",
      "url": "https://en.wikipedia.org/wiki/National_Lampoon%27s_Vacation_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0120434": [
    {
      "name": "Каникулы Гризволдов",
      "url": "https://en.wikipedia.org/wiki/National_Lampoon%27s_Vacation_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0367623": [
    {
      "name": "Каникулы Гризволдов",
      "url": "https://en.wikipedia.org/wiki/National_Lampoon%27s_Vacation_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1524930": [
    {
      "name": "Каникулы Гризволдов",
      "url": "https://en.wikipedia.org/wiki/National_Lampoon%27s_Vacation_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1034314": [
    {
      "name": "Железное небо",
      "url": "https://en.wikipedia.org/wiki/Iron_Sky%3A_The_Coming_Race",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0371746": [
    {
      "name": "Железный человек",
      "url": "https://en.wikipedia.org/wiki/Iron_Man_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1228705": [
    {
      "name": "Железный человек",
      "url": "https://en.wikipedia.org/wiki/Iron_Man_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1300854": [
    {
      "name": "Железный человек",
      "url": "https://en.wikipedia.org/wiki/Iron_Man_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0088011": [
    {
      "name": "Роман с камнем",
      "url": "https://en.wikipedia.org/wiki/The_Jewel_of_the_Nile",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0089370": [
    {
      "name": "Роман с камнем",
      "url": "https://en.wikipedia.org/wiki/The_Jewel_of_the_Nile",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0057076": [
    {
      "name": "Джеймс Бонд",
      "url": "https://en.wikipedia.org/wiki/List_of_James_Bond_films",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0071807": [
    {
      "name": "Джеймс Бонд",
      "url": "https://en.wikipedia.org/wiki/List_of_James_Bond_films",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0097742": [
    {
      "name": "Джеймс Бонд",
      "url": "https://en.wikipedia.org/wiki/List_of_James_Bond_films",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0113189": [
    {
      "name": "Джеймс Бонд",
      "url": "https://en.wikipedia.org/wiki/List_of_James_Bond_films",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0120347": [
    {
      "name": "Джеймс Бонд",
      "url": "https://en.wikipedia.org/wiki/List_of_James_Bond_films",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0143145": [
    {
      "name": "Джеймс Бонд",
      "url": "https://en.wikipedia.org/wiki/List_of_James_Bond_films",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0246460": [
    {
      "name": "Джеймс Бонд",
      "url": "https://en.wikipedia.org/wiki/List_of_James_Bond_films",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0381061": [
    {
      "name": "Джеймс Бонд",
      "url": "https://en.wikipedia.org/wiki/List_of_James_Bond_films",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0830515": [
    {
      "name": "Джеймс Бонд",
      "url": "https://en.wikipedia.org/wiki/List_of_James_Bond_films",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1074638": [
    {
      "name": "Джеймс Бонд",
      "url": "https://en.wikipedia.org/wiki/List_of_James_Bond_films",
      "origin": "каталог кинотеки"
    }
  ],
  "tt2379713": [
    {
      "name": "Джеймс Бонд",
      "url": "https://en.wikipedia.org/wiki/List_of_James_Bond_films",
      "origin": "каталог кинотеки"
    }
  ],
  "tt2382320": [
    {
      "name": "Джеймс Бонд",
      "url": "https://en.wikipedia.org/wiki/List_of_James_Bond_films",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0815138": [
    {
      "name": "Заложница",
      "url": "https://en.wikipedia.org/wiki/Taken_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1397280": [
    {
      "name": "Заложница",
      "url": "https://en.wikipedia.org/wiki/Taken_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt2446042": [
    {
      "name": "Заложница",
      "url": "https://en.wikipedia.org/wiki/Taken_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt5232792": [
    {
      "name": "Затерянные в космосе",
      "url": "https://en.wikipedia.org/wiki/Lost_in_Space_%282018_TV_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0457400": [
    {
      "name": "Затерянный мир - Land of the Lost",
      "url": "https://en.wikipedia.org/wiki/Land_of_the_Lost_%28film%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt3438354": [
    {
      "name": "Захочу и соскочу",
      "url": "https://en.wikipedia.org/wiki/I_Can_Quit_Whenever_I_Want",
      "origin": "каталог кинотеки"
    }
  ],
  "tt5897288": [
    {
      "name": "Захочу и соскочу",
      "url": "https://en.wikipedia.org/wiki/I_Can_Quit_Whenever_I_Want",
      "origin": "каталог кинотеки"
    }
  ],
  "tt5897292": [
    {
      "name": "Захочу и соскочу",
      "url": "https://en.wikipedia.org/wiki/I_Can_Quit_Whenever_I_Want",
      "origin": "каталог кинотеки"
    }
  ],
  "tt2987732": [
    {
      "name": "Зачётный препод",
      "url": "https://en.wikipedia.org/wiki/Fack_ju_G%C3%B6hte",
      "origin": "каталог кинотеки"
    }
  ],
  "tt3702996": [
    {
      "name": "Зачётный препод",
      "url": "https://en.wikipedia.org/wiki/Fack_ju_G%C3%B6hte",
      "origin": "каталог кинотеки"
    }
  ],
  "tt6471264": [
    {
      "name": "Зачётный препод",
      "url": "https://en.wikipedia.org/wiki/Fack_ju_G%C3%B6hte",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0111282": [
    {
      "name": "Звёздные врата",
      "url": "https://en.wikipedia.org/wiki/Stargate",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0118480": [
    {
      "name": "Звёздные врата",
      "url": "https://en.wikipedia.org/wiki/Stargate",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0374455": [
    {
      "name": "Звёздные врата",
      "url": "https://en.wikipedia.org/wiki/Stargate",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0942903": [
    {
      "name": "Звёздные врата",
      "url": "https://en.wikipedia.org/wiki/Stargate",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0929629": [
    {
      "name": "Звёздные врата",
      "url": "https://en.wikipedia.org/wiki/Stargate",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1286039": [
    {
      "name": "Звёздные врата",
      "url": "https://en.wikipedia.org/wiki/Stargate",
      "origin": "каталог кинотеки"
    }
  ],
  "tt7161862": [
    {
      "name": "Звёздные врата",
      "url": "https://en.wikipedia.org/wiki/Stargate",
      "origin": "каталог кинотеки"
    }
  ],
  "tt2948356": [
    {
      "name": "Зверополис",
      "url": "https://en.wikipedia.org/wiki/Zootopia_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0498381": [
    {
      "name": "Звонок",
      "url": "https://en.wikipedia.org/wiki/The_Ring_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0120201": [
    {
      "name": "Звёздный десант",
      "url": "https://en.wikipedia.org/wiki/Starship_Troopers_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0212338": [
    {
      "name": "Знакомство с родителями",
      "url": "https://en.wikipedia.org/wiki/Meet_the_Parents_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0290002": [
    {
      "name": "Знакомство с родителями",
      "url": "https://en.wikipedia.org/wiki/Meet_the_Parents_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0970866": [
    {
      "name": "Знакомство с родителями",
      "url": "https://en.wikipedia.org/wiki/Meet_the_Parents_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0090887": [
    {
      "name": "Зубастики",
      "url": "https://en.wikipedia.org/wiki/Critters_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0094919": [
    {
      "name": "Зубастики",
      "url": "https://en.wikipedia.org/wiki/Critters_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0101627": [
    {
      "name": "Зубастики",
      "url": "https://en.wikipedia.org/wiki/Critters_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0808510": [
    {
      "name": "Зубная фея",
      "url": "https://en.wikipedia.org/wiki/Tooth_Fairy_2",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1935929": [
    {
      "name": "Зубная фея",
      "url": "https://en.wikipedia.org/wiki/Tooth_Fairy_2",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1670345": [
    {
      "name": "Иллюзия обмана",
      "url": "https://en.wikipedia.org/wiki/Now_You_See_Me_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt3110958": [
    {
      "name": "Иллюзия обмана",
      "url": "https://en.wikipedia.org/wiki/Now_You_See_Me_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt4712810": [
    {
      "name": "Иллюзия обмана",
      "url": "https://en.wikipedia.org/wiki/Now_You_See_Me_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0082971": [
    {
      "name": "Индиана Джонс",
      "url": "https://en.wikipedia.org/wiki/Indiana_Jones",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0087469": [
    {
      "name": "Индиана Джонс",
      "url": "https://en.wikipedia.org/wiki/Indiana_Jones",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0097576": [
    {
      "name": "Индиана Джонс",
      "url": "https://en.wikipedia.org/wiki/Indiana_Jones",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0367882": [
    {
      "name": "Индиана Джонс",
      "url": "https://en.wikipedia.org/wiki/Indiana_Jones",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1462764": [
    {
      "name": "Индиана Джонс",
      "url": "https://en.wikipedia.org/wiki/Indiana_Jones",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0987918": [
    {
      "name": "Ирония судьбы",
      "url": "https://en.wikipedia.org/wiki/The_Irony_of_Fate_2",
      "origin": "каталог кинотеки"
    }
  ],
  "tt4154664": [
    {
      "name": "Капитан Марвел",
      "url": "https://en.wikipedia.org/wiki/The_Marvels",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1155076": [
    {
      "name": "Карате-пацан и Кобра Кай",
      "url": "https://en.wikipedia.org/wiki/The_Karate_Kid_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt7221388": [
    {
      "name": "Карате-пацан и Кобра Кай",
      "url": "https://en.wikipedia.org/wiki/The_Karate_Kid_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0096684": [
    {
      "name": "Квантовый скачок",
      "url": "https://en.wikipedia.org/wiki/Quantum_Leap_%282022_TV_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt17043230": [
    {
      "name": "Квантовый скачок",
      "url": "https://en.wikipedia.org/wiki/Quantum_Leap_%282022_TV_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0837563": [
    {
      "name": "Кладбище домашних животных",
      "url": "https://en.wikipedia.org/wiki/Pet_Sematary%3A_Bloodlines",
      "origin": "каталог кинотеки"
    }
  ],
  "tt2395695": [
    {
      "name": "Космос",
      "url": "https://en.wikipedia.org/wiki/Cosmos%3A_A_Spacetime_Odyssey",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0126029": [
    {
      "name": "Шрек и Кот в сапогах",
      "url": "https://en.wikipedia.org/wiki/Shrek_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0298148": [
    {
      "name": "Шрек и Кот в сапогах",
      "url": "https://en.wikipedia.org/wiki/Shrek_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0413267": [
    {
      "name": "Шрек и Кот в сапогах",
      "url": "https://en.wikipedia.org/wiki/Shrek_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0892791": [
    {
      "name": "Шрек и Кот в сапогах",
      "url": "https://en.wikipedia.org/wiki/Shrek_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0448694": [
    {
      "name": "Шрек и Кот в сапогах",
      "url": "https://en.wikipedia.org/wiki/Shrek_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt3915174": [
    {
      "name": "Шрек и Кот в сапогах",
      "url": "https://en.wikipedia.org/wiki/Shrek_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0123755": [
    {
      "name": "Куб",
      "url": "https://en.wikipedia.org/wiki/Cube_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0285492": [
    {
      "name": "Куб",
      "url": "https://en.wikipedia.org/wiki/Cube_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0377713": [
    {
      "name": "Куб",
      "url": "https://en.wikipedia.org/wiki/Cube_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt2930610": [
    {
      "name": "Кухня",
      "url": "https://ru.wikipedia.org/wiki/%D0%9A%D1%83%D1%85%D0%BD%D1%8F_%28%D1%82%D0%B5%D0%BB%D0%B5%D1%81%D0%B5%D1%80%D0%B8%D0%B0%D0%BB%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt6841500": [
    {
      "name": "Кухня",
      "url": "https://ru.wikipedia.org/wiki/%D0%9A%D1%83%D1%85%D0%BD%D1%8F_%28%D1%82%D0%B5%D0%BB%D0%B5%D1%81%D0%B5%D1%80%D0%B8%D0%B0%D0%BB%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0268380": [
    {
      "name": "Ледниковый период",
      "url": "https://en.wikipedia.org/wiki/Ice_Age_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0438097": [
    {
      "name": "Ледниковый период",
      "url": "https://en.wikipedia.org/wiki/Ice_Age_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1080016": [
    {
      "name": "Ледниковый период",
      "url": "https://en.wikipedia.org/wiki/Ice_Age_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1667889": [
    {
      "name": "Ледниковый период",
      "url": "https://en.wikipedia.org/wiki/Ice_Age_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt3416828": [
    {
      "name": "Ледниковый период",
      "url": "https://en.wikipedia.org/wiki/Ice_Age_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt13634480": [
    {
      "name": "Ледниковый период",
      "url": "https://en.wikipedia.org/wiki/Ice_Age_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt3758814": [
    {
      "name": "Ледяной драйв",
      "url": "https://en.wikipedia.org/wiki/Ice_Road%3A_Vengeance",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0120903": [
    {
      "name": "Люди Икс",
      "url": "https://en.wikipedia.org/wiki/X-Men_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0290334": [
    {
      "name": "Люди Икс",
      "url": "https://en.wikipedia.org/wiki/X-Men_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0376994": [
    {
      "name": "Люди Икс",
      "url": "https://en.wikipedia.org/wiki/X-Men_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0458525": [
    {
      "name": "Люди Икс",
      "url": "https://en.wikipedia.org/wiki/X-Men_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1270798": [
    {
      "name": "Люди Икс",
      "url": "https://en.wikipedia.org/wiki/X-Men_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1430132": [
    {
      "name": "Люди Икс",
      "url": "https://en.wikipedia.org/wiki/X-Men_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1877832": [
    {
      "name": "Люди Икс",
      "url": "https://en.wikipedia.org/wiki/X-Men_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt3385516": [
    {
      "name": "Люди Икс",
      "url": "https://en.wikipedia.org/wiki/X-Men_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt3315342": [
    {
      "name": "Люди Икс",
      "url": "https://en.wikipedia.org/wiki/X-Men_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt6565702": [
    {
      "name": "Люди Икс",
      "url": "https://en.wikipedia.org/wiki/X-Men_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0178725": [
    {
      "name": "Любить по-русски",
      "url": "https://ru.wikipedia.org/wiki/%D0%9B%D1%8E%D0%B1%D0%B8%D1%82%D1%8C_%D0%BF%D0%BE-%D1%80%D1%83%D1%81%D1%81%D0%BA%D0%B8",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0127011": [
    {
      "name": "Любить по-русски",
      "url": "https://ru.wikipedia.org/wiki/%D0%9B%D1%8E%D0%B1%D0%B8%D1%82%D1%8C_%D0%BF%D0%BE-%D1%80%D1%83%D1%81%D1%81%D0%BA%D0%B8",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0415952": [
    {
      "name": "Любить по-русски",
      "url": "https://ru.wikipedia.org/wiki/%D0%9B%D1%8E%D0%B1%D0%B8%D1%82%D1%8C_%D0%BF%D0%BE-%D1%80%D1%83%D1%81%D1%81%D0%BA%D0%B8",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0119654": [
    {
      "name": "Люди в чёрном",
      "url": "https://en.wikipedia.org/wiki/Men_in_Black_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0120912": [
    {
      "name": "Люди в чёрном",
      "url": "https://en.wikipedia.org/wiki/Men_in_Black_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1409024": [
    {
      "name": "Люди в чёрном",
      "url": "https://en.wikipedia.org/wiki/Men_in_Black_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt2283336": [
    {
      "name": "Люди в чёрном",
      "url": "https://en.wikipedia.org/wiki/Men_in_Black_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0351283": [
    {
      "name": "Мадагаскар",
      "url": "https://en.wikipedia.org/wiki/Madagascar_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0479952": [
    {
      "name": "Мадагаскар",
      "url": "https://en.wikipedia.org/wiki/Madagascar_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1277953": [
    {
      "name": "Мадагаскар",
      "url": "https://en.wikipedia.org/wiki/Madagascar_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1911658": [
    {
      "name": "Мадагаскар",
      "url": "https://en.wikipedia.org/wiki/Madagascar_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1587310": [
    {
      "name": "Малефисента",
      "url": "https://en.wikipedia.org/wiki/Maleficent%3A_Mistress_of_Evil",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1411697": [
    {
      "name": "Мальчишник",
      "url": "https://en.wikipedia.org/wiki/The_Hangover_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1951261": [
    {
      "name": "Мальчишник",
      "url": "https://en.wikipedia.org/wiki/The_Hangover_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0133093": [
    {
      "name": "Матрица",
      "url": "https://en.wikipedia.org/wiki/The_Matrix_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0234215": [
    {
      "name": "Матрица",
      "url": "https://en.wikipedia.org/wiki/The_Matrix_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0242653": [
    {
      "name": "Матрица",
      "url": "https://en.wikipedia.org/wiki/The_Matrix_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt10838180": [
    {
      "name": "Матрица",
      "url": "https://en.wikipedia.org/wiki/The_Matrix_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0985694": [
    {
      "name": "Мачете",
      "url": "https://en.wikipedia.org/wiki/Machete_Kills",
      "origin": "каталог кинотеки"
    }
  ],
  "tt2002718": [
    {
      "name": "Мачете",
      "url": "https://en.wikipedia.org/wiki/Machete_Kills",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1232829": [
    {
      "name": "Мачо и ботан",
      "url": "https://en.wikipedia.org/wiki/Jump_Street_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt2294449": [
    {
      "name": "Мачо и ботан",
      "url": "https://en.wikipedia.org/wiki/Jump_Street_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt4779682": [
    {
      "name": "Мег",
      "url": "https://en.wikipedia.org/wiki/Meg_2%3A_The_Trench",
      "origin": "каталог кинотеки"
    }
  ],
  "tt9224104": [
    {
      "name": "Мег",
      "url": "https://en.wikipedia.org/wiki/Meg_2%3A_The_Trench",
      "origin": "каталог кинотеки"
    }
  ],
  "tt3522806": [
    {
      "name": "Механик",
      "url": "https://en.wikipedia.org/wiki/Mechanic%3A_Resurrection",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0369610": [
    {
      "name": "Парк и Мир Юрского периода",
      "url": "https://en.wikipedia.org/wiki/Jurassic_Park",
      "origin": "каталог кинотеки"
    }
  ],
  "tt4881806": [
    {
      "name": "Парк и Мир Юрского периода",
      "url": "https://en.wikipedia.org/wiki/Jurassic_Park",
      "origin": "каталог кинотеки"
    }
  ],
  "tt8041270": [
    {
      "name": "Парк и Мир Юрского периода",
      "url": "https://en.wikipedia.org/wiki/Jurassic_Park",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0117060": [
    {
      "name": "Миссия невыполнима",
      "url": "https://en.wikipedia.org/wiki/Mission%3A_Impossible_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0120755": [
    {
      "name": "Миссия невыполнима",
      "url": "https://en.wikipedia.org/wiki/Mission%3A_Impossible_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0317919": [
    {
      "name": "Миссия невыполнима",
      "url": "https://en.wikipedia.org/wiki/Mission%3A_Impossible_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1229238": [
    {
      "name": "Миссия невыполнима",
      "url": "https://en.wikipedia.org/wiki/Mission%3A_Impossible_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt2381249": [
    {
      "name": "Миссия невыполнима",
      "url": "https://en.wikipedia.org/wiki/Mission%3A_Impossible_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt4912910": [
    {
      "name": "Миссия невыполнима",
      "url": "https://en.wikipedia.org/wiki/Mission%3A_Impossible_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1408253": [
    {
      "name": "Совместная поездка",
      "url": "https://en.wikipedia.org/wiki/Ride_Along_2",
      "origin": "каталог кинотеки"
    }
  ],
  "tt2869728": [
    {
      "name": "Совместная поездка",
      "url": "https://en.wikipedia.org/wiki/Ride_Along_2",
      "origin": "каталог кинотеки"
    }
  ],
  "tt3717490": [
    {
      "name": "Могучие рейнджеры",
      "url": "https://en.wikipedia.org/wiki/Power_Rangers_%28film%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0848228": [
    {
      "name": "Мстители",
      "url": "https://en.wikipedia.org/wiki/Avengers_%28Marvel_Cinematic_Universe%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt2395427": [
    {
      "name": "Мстители",
      "url": "https://en.wikipedia.org/wiki/Avengers_%28Marvel_Cinematic_Universe%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt4154756": [
    {
      "name": "Мстители",
      "url": "https://en.wikipedia.org/wiki/Avengers_%28Marvel_Cinematic_Universe%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt4154796": [
    {
      "name": "Мстители",
      "url": "https://en.wikipedia.org/wiki/Avengers_%28Marvel_Cinematic_Universe%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt30612313": [
    {
      "name": "Мы из будущего",
      "url": "https://ru.wikipedia.org/wiki/%D0%9C%D1%8B_%D0%B8%D0%B7_%D0%B1%D1%83%D0%B4%D1%83%D1%89%D0%B5%D0%B3%D0%BE_2",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1590125": [
    {
      "name": "Мы из будущего",
      "url": "https://ru.wikipedia.org/wiki/%D0%9C%D1%8B_%D0%B8%D0%B7_%D0%B1%D1%83%D0%B4%D1%83%D1%89%D0%B5%D0%B3%D0%BE_2",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0088763": [
    {
      "name": "Назад в будущее",
      "url": "https://en.wikipedia.org/wiki/Back_to_the_Future_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0096874": [
    {
      "name": "Назад в будущее",
      "url": "https://en.wikipedia.org/wiki/Back_to_the_Future_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0099088": [
    {
      "name": "Назад в будущее",
      "url": "https://en.wikipedia.org/wiki/Back_to_the_Future_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0425061": [
    {
      "name": "Напряги извилины",
      "url": "https://en.wikipedia.org/wiki/Get_Smart_%28film%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt3843168": [
    {
      "name": "Нация Z",
      "url": "https://en.wikipedia.org/wiki/Black_Summer_%28TV_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0454848": [
    {
      "name": "Не пойман - не вор",
      "url": "https://en.wikipedia.org/wiki/Inside_Man%3A_Most_Wanted",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1499658": [
    {
      "name": "Несносные боссы",
      "url": "https://en.wikipedia.org/wiki/Horrible_Bosses_2",
      "origin": "каталог кинотеки"
    }
  ],
  "tt2170439": [
    {
      "name": "Несносные боссы",
      "url": "https://en.wikipedia.org/wiki/Horrible_Bosses_2",
      "origin": "каталог кинотеки"
    }
  ],
  "tt3063516": [
    {
      "name": "Чудаки",
      "url": "https://en.wikipedia.org/wiki/Jackass_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt6237612": [
    {
      "name": "Несчастный случай",
      "url": "https://en.wikipedia.org/wiki/Accident_Man%3A_Hitman%27s_Holiday",
      "origin": "каталог кинотеки"
    }
  ],
  "tt9669176": [
    {
      "name": "Несчастный случай",
      "url": "https://en.wikipedia.org/wiki/Accident_Man%3A_Hitman%27s_Holiday",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1320253": [
    {
      "name": "Неудержимые",
      "url": "https://en.wikipedia.org/wiki/The_Expendables_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1764651": [
    {
      "name": "Неудержимые",
      "url": "https://en.wikipedia.org/wiki/The_Expendables_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt2333784": [
    {
      "name": "Неудержимые",
      "url": "https://en.wikipedia.org/wiki/The_Expendables_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt3291150": [
    {
      "name": "Неудержимые",
      "url": "https://en.wikipedia.org/wiki/The_Expendables_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1820225": [
    {
      "name": "Сваты",
      "url": "https://ru.wikipedia.org/wiki/%D0%A1%D0%B2%D0%B0%D1%82%D1%8B",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1820565": [
    {
      "name": "Сваты",
      "url": "https://ru.wikipedia.org/wiki/%D0%A1%D0%B2%D0%B0%D1%82%D1%8B",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0948470": [
    {
      "name": "Новый Человек-паук",
      "url": "https://en.wikipedia.org/wiki/The_Amazing_Spider-Man_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1872181": [
    {
      "name": "Новый Человек-паук",
      "url": "https://en.wikipedia.org/wiki/The_Amazing_Spider-Man_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt2692250": [
    {
      "name": "Ночь в музее",
      "url": "https://en.wikipedia.org/wiki/Night_at_the_Museum_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1219289": [
    {
      "name": "Области тьмы",
      "url": "https://en.wikipedia.org/wiki/Limitless_%28TV_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt4422836": [
    {
      "name": "Области тьмы",
      "url": "https://en.wikipedia.org/wiki/Limitless_%28TV_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0099785": [
    {
      "name": "Один дома",
      "url": "https://en.wikipedia.org/wiki/Home_Alone_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0104431": [
    {
      "name": "Один дома",
      "url": "https://en.wikipedia.org/wiki/Home_Alone_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1375670": [
    {
      "name": "Одноклассники",
      "url": "https://en.wikipedia.org/wiki/Grown_Ups_2",
      "origin": "каталог кинотеки"
    }
  ],
  "tt2191701": [
    {
      "name": "Одноклассники",
      "url": "https://en.wikipedia.org/wiki/Grown_Ups_2",
      "origin": "каталог кинотеки"
    }
  ],
  "tt5526028": [
    {
      "name": "Одноклассницы",
      "url": "https://ru.wikipedia.org/wiki/%D0%9E%D0%B4%D0%BD%D0%BE%D0%BA%D0%BB%D0%B0%D1%81%D1%81%D0%BD%D0%B8%D1%86%D1%8B_%28%D1%84%D0%B8%D0%BB%D1%8C%D0%BC%2C_2016%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1396484": [
    {
      "name": "Оно",
      "url": "https://en.wikipedia.org/wiki/Welcome_to_Derry",
      "origin": "каталог кинотеки"
    }
  ],
  "tt7349950": [
    {
      "name": "Оно",
      "url": "https://en.wikipedia.org/wiki/Welcome_to_Derry",
      "origin": "каталог кинотеки"
    }
  ],
  "tt19244304": [
    {
      "name": "Оно",
      "url": "https://en.wikipedia.org/wiki/Welcome_to_Derry",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1538403": [
    {
      "name": "Орудия смерти",
      "url": "https://en.wikipedia.org/wiki/The_Mortal_Instruments",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0181689": [
    {
      "name": "Особое мнение",
      "url": "https://en.wikipedia.org/wiki/Minority_Report_%28TV_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt4450826": [
    {
      "name": "Особое мнение",
      "url": "https://en.wikipedia.org/wiki/Minority_Report_%28TV_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0175142": [
    {
      "name": "Очень страшное кино",
      "url": "https://en.wikipedia.org/wiki/Scary_Movie_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0257106": [
    {
      "name": "Очень страшное кино",
      "url": "https://en.wikipedia.org/wiki/Scary_Movie_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0306047": [
    {
      "name": "Очень страшное кино",
      "url": "https://en.wikipedia.org/wiki/Scary_Movie_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0362120": [
    {
      "name": "Очень страшное кино",
      "url": "https://en.wikipedia.org/wiki/Scary_Movie_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0795461": [
    {
      "name": "Очень страшное кино",
      "url": "https://en.wikipedia.org/wiki/Scary_Movie_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt2302755": [
    {
      "name": "Падение Олимпа",
      "url": "https://en.wikipedia.org/wiki/Has_Fallen",
      "origin": "каталог кинотеки"
    }
  ],
  "tt3300542": [
    {
      "name": "Падение Олимпа",
      "url": "https://en.wikipedia.org/wiki/Has_Fallen",
      "origin": "каталог кинотеки"
    }
  ],
  "tt2548396": [
    {
      "name": "Кловерфилд",
      "url": "https://en.wikipedia.org/wiki/Cloverfield_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1190634": [
    {
      "name": "Пацаны",
      "url": "https://en.wikipedia.org/wiki/The_Boys_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt13159924": [
    {
      "name": "Пацаны",
      "url": "https://en.wikipedia.org/wiki/The_Boys_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0458339": [
    {
      "name": "Первый мститель",
      "url": "https://en.wikipedia.org/wiki/Captain_America_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1843866": [
    {
      "name": "Первый мститель",
      "url": "https://en.wikipedia.org/wiki/Captain_America_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt3498820": [
    {
      "name": "Первый мститель",
      "url": "https://en.wikipedia.org/wiki/Captain_America_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0293662": [
    {
      "name": "Перевозчик",
      "url": "https://en.wikipedia.org/wiki/Transporter_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0388482": [
    {
      "name": "Перевозчик",
      "url": "https://en.wikipedia.org/wiki/Transporter_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1129442": [
    {
      "name": "Перевозчик",
      "url": "https://en.wikipedia.org/wiki/Transporter_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1885102": [
    {
      "name": "Перевозчик",
      "url": "https://en.wikipedia.org/wiki/Transporter_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt2938956": [
    {
      "name": "Перевозчик",
      "url": "https://en.wikipedia.org/wiki/Transporter_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1754738": [
    {
      "name": "Пипец",
      "url": "https://en.wikipedia.org/wiki/Kick-Ass_2_%28film%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1650554": [
    {
      "name": "Пипец",
      "url": "https://en.wikipedia.org/wiki/Kick-Ass_2_%28film%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0325980": [
    {
      "name": "Пираты Карибского моря",
      "url": "https://en.wikipedia.org/wiki/Pirates_of_the_Caribbean_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0383574": [
    {
      "name": "Пираты Карибского моря",
      "url": "https://en.wikipedia.org/wiki/Pirates_of_the_Caribbean_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0449088": [
    {
      "name": "Пираты Карибского моря",
      "url": "https://en.wikipedia.org/wiki/Pirates_of_the_Caribbean_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1298650": [
    {
      "name": "Пираты Карибского моря",
      "url": "https://en.wikipedia.org/wiki/Pirates_of_the_Caribbean_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1790809": [
    {
      "name": "Пираты Карибского моря",
      "url": "https://en.wikipedia.org/wiki/Pirates_of_the_Caribbean_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1211956": [
    {
      "name": "План побега",
      "url": "https://en.wikipedia.org/wiki/Escape_Plan_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt6513656": [
    {
      "name": "План побега",
      "url": "https://en.wikipedia.org/wiki/Escape_Plan_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt5491994": [
    {
      "name": "Планета Земля",
      "url": "https://en.wikipedia.org/wiki/Planet_Earth_II",
      "origin": "каталог кинотеки"
    }
  ],
  "tt8228288": [
    {
      "name": "Платформа",
      "url": "https://en.wikipedia.org/wiki/The_Platform_2",
      "origin": "каталог кинотеки"
    }
  ],
  "tt27729779": [
    {
      "name": "Платформа",
      "url": "https://en.wikipedia.org/wiki/The_Platform_2",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0112442": [
    {
      "name": "Плохие парни",
      "url": "https://en.wikipedia.org/wiki/Bad_Boys_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0172156": [
    {
      "name": "Плохие парни",
      "url": "https://en.wikipedia.org/wiki/Bad_Boys_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1502397": [
    {
      "name": "Плохие парни",
      "url": "https://en.wikipedia.org/wiki/Bad_Boys_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt4919268": [
    {
      "name": "Плохие парни",
      "url": "https://en.wikipedia.org/wiki/Bad_Boys_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0307987": [
    {
      "name": "Плохой Санта",
      "url": "https://en.wikipedia.org/wiki/Bad_Santa_2",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1798603": [
    {
      "name": "Плохой Санта",
      "url": "https://en.wikipedia.org/wiki/Bad_Santa_2",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0455275": [
    {
      "name": "Побег",
      "url": "https://en.wikipedia.org/wiki/Prison_Break%3A_The_Final_Break",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1131748": [
    {
      "name": "Побег",
      "url": "https://en.wikipedia.org/wiki/Prison_Break%3A_The_Final_Break",
      "origin": "каталог кинотеки"
    }
  ],
  "tt2906216": [
    {
      "name": "Подземелья и драконы",
      "url": "https://en.wikipedia.org/wiki/Dungeons_%26_Dragons_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0094898": [
    {
      "name": "Поездка в Америку",
      "url": "https://en.wikipedia.org/wiki/Coming_2_America",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0086960": [
    {
      "name": "Полицейский из Беверли-Хиллз",
      "url": "https://en.wikipedia.org/wiki/Beverly_Hills_Cop_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0092644": [
    {
      "name": "Полицейский из Беверли-Хиллз",
      "url": "https://en.wikipedia.org/wiki/Beverly_Hills_Cop_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0109254": [
    {
      "name": "Полицейский из Беверли-Хиллз",
      "url": "https://en.wikipedia.org/wiki/Beverly_Hills_Cop_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0808096": [
    {
      "name": "Портал юрского периода",
      "url": "https://en.wikipedia.org/wiki/Primeval%3A_New_World",
      "origin": "каталог кинотеки"
    }
  ],
  "tt2295953": [
    {
      "name": "Портал юрского периода",
      "url": "https://en.wikipedia.org/wiki/Primeval%3A_New_World",
      "origin": "каталог кинотеки"
    }
  ],
  "tt6175394": [
    {
      "name": "Последний богатырь",
      "url": "https://ru.wikipedia.org/wiki/%D0%9F%D0%BE%D1%81%D0%BB%D0%B5%D0%B4%D0%BD%D0%B8%D0%B9_%D0%B1%D0%BE%D0%B3%D0%B0%D1%82%D1%8B%D1%80%D1%8C",
      "origin": "каталог кинотеки"
    }
  ],
  "tt13606158": [
    {
      "name": "Последний богатырь",
      "url": "https://ru.wikipedia.org/wiki/%D0%9F%D0%BE%D1%81%D0%BB%D0%B5%D0%B4%D0%BD%D0%B8%D0%B9_%D0%B1%D0%BE%D0%B3%D0%B0%D1%82%D1%8B%D1%80%D1%8C",
      "origin": "каталог кинотеки"
    }
  ],
  "tt13769630": [
    {
      "name": "Последний богатырь",
      "url": "https://ru.wikipedia.org/wiki/%D0%9F%D0%BE%D1%81%D0%BB%D0%B5%D0%B4%D0%BD%D0%B8%D0%B9_%D0%B1%D0%BE%D0%B3%D0%B0%D1%82%D1%8B%D1%80%D1%8C",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0259324": [
    {
      "name": "Призрачный гонщик",
      "url": "https://en.wikipedia.org/wiki/Ghost_Rider%3A_Spirit_of_Vengeance",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1071875": [
    {
      "name": "Призрачный гонщик",
      "url": "https://en.wikipedia.org/wiki/Ghost_Rider%3A_Spirit_of_Vengeance",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0790736": [
    {
      "name": "Призрачный патруль",
      "url": "https://en.wikipedia.org/wiki/R.I.P.D._2%3A_Rise_of_the_Damned",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1109624": [
    {
      "name": "Паддингтон",
      "url": "https://en.wikipedia.org/wiki/Paddington_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0115320": [
    {
      "name": "Притворщик",
      "url": "https://en.wikipedia.org/wiki/The_Pretender_2001",
      "origin": "каталог кинотеки"
    }
  ],
  "tt4731148": [
    {
      "name": "Притяжение",
      "url": "https://en.wikipedia.org/wiki/Invasion_%282020_film%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt6284064": [
    {
      "name": "Притяжение",
      "url": "https://en.wikipedia.org/wiki/Invasion_%282020_film%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0108500": [
    {
      "name": "Пришельцы",
      "url": "https://en.wikipedia.org/wiki/Les_Visiteurs",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0120882": [
    {
      "name": "Пришельцы",
      "url": "https://en.wikipedia.org/wiki/Les_Visiteurs",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0189192": [
    {
      "name": "Пришельцы",
      "url": "https://en.wikipedia.org/wiki/Les_Visiteurs",
      "origin": "каталог кинотеки"
    }
  ],
  "tt2441982": [
    {
      "name": "Пришельцы",
      "url": "https://en.wikipedia.org/wiki/Les_Visiteurs",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1446714": [
    {
      "name": "Чужой",
      "url": "https://en.wikipedia.org/wiki/Alien_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt11947406": [
    {
      "name": "Простоквашино",
      "url": "https://ru.wikipedia.org/wiki/%D0%9F%D1%80%D0%BE%D1%81%D1%82%D0%BE%D0%BA%D0%B2%D0%B0%D1%88%D0%B8%D0%BD%D0%BE_%28%D0%BC%D1%83%D0%BB%D1%8C%D1%82%D1%81%D0%B5%D1%80%D0%B8%D0%B0%D0%BB%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1397514": [
    {
      "name": "Путешествие к центру Земли",
      "url": "https://en.wikipedia.org/wiki/Journey_2%3A_The_Mysterious_Island",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1837341": [
    {
      "name": "Реальные пацаны",
      "url": "https://ru.wikipedia.org/wiki/%D0%A0%D0%B5%D0%B0%D0%BB%D1%8C%D0%BD%D1%8B%D0%B5_%D0%BF%D0%B0%D1%86%D0%B0%D0%BD%D1%8B_%D0%BF%D1%80%D0%BE%D1%82%D0%B8%D0%B2_%D0%B7%D0%BE%D0%BC%D0%B1%D0%B8",
      "origin": "каталог кинотеки"
    }
  ],
  "tt13872708": [
    {
      "name": "Реальные пацаны",
      "url": "https://ru.wikipedia.org/wiki/%D0%A0%D0%B5%D0%B0%D0%BB%D1%8C%D0%BD%D1%8B%D0%B5_%D0%BF%D0%B0%D1%86%D0%B0%D0%BD%D1%8B_%D0%BF%D1%80%D0%BE%D1%82%D0%B8%D0%B2_%D0%B7%D0%BE%D0%BC%D0%B1%D0%B8",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1899353": [
    {
      "name": "Рейд",
      "url": "https://en.wikipedia.org/wiki/The_Raid_2",
      "origin": "каталог кинотеки"
    }
  ],
  "tt2265171": [
    {
      "name": "Рейд",
      "url": "https://en.wikipedia.org/wiki/The_Raid_2",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1234721": [
    {
      "name": "Робокоп",
      "url": "https://en.wikipedia.org/wiki/RoboCop_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt2990140": [
    {
      "name": "Рождественские хроники",
      "url": "https://en.wikipedia.org/wiki/The_Christmas_Chronicles_2",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1245526": [
    {
      "name": "РЭД",
      "url": "https://en.wikipedia.org/wiki/Red_2_%28film%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1821694": [
    {
      "name": "РЭД",
      "url": "https://en.wikipedia.org/wiki/Red_2_%28film%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0111070": [
    {
      "name": "Санта-Клаус",
      "url": "https://en.wikipedia.org/wiki/The_Santa_Clause_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0304669": [
    {
      "name": "Санта-Клаус",
      "url": "https://en.wikipedia.org/wiki/The_Santa_Clause_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0452681": [
    {
      "name": "Санта-Клаус",
      "url": "https://en.wikipedia.org/wiki/The_Santa_Clause_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt17047510": [
    {
      "name": "Санта-Клаус",
      "url": "https://en.wikipedia.org/wiki/The_Santa_Clause_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1409069": [
    {
      "name": "Универ",
      "url": "https://ru.wikipedia.org/wiki/%D0%A3%D0%BD%D0%B8%D0%B2%D0%B5%D1%80_%28%D1%82%D0%B5%D0%BB%D0%B5%D1%81%D0%B5%D1%80%D0%B8%D0%B0%D0%BB%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt3752220": [
    {
      "name": "Универ",
      "url": "https://ru.wikipedia.org/wiki/%D0%A3%D0%BD%D0%B8%D0%B2%D0%B5%D1%80_%28%D1%82%D0%B5%D0%BB%D0%B5%D1%81%D0%B5%D1%80%D0%B8%D0%B0%D0%BB%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt16233524": [
    {
      "name": "Универ",
      "url": "https://ru.wikipedia.org/wiki/%D0%A3%D0%BD%D0%B8%D0%B2%D0%B5%D1%80_%28%D1%82%D0%B5%D0%BB%D0%B5%D1%81%D0%B5%D1%80%D0%B8%D0%B0%D0%BB%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt3608112": [
    {
      "name": "Универ",
      "url": "https://ru.wikipedia.org/wiki/%D0%A3%D0%BD%D0%B8%D0%B2%D0%B5%D1%80_%28%D1%82%D0%B5%D0%BB%D0%B5%D1%81%D0%B5%D1%80%D0%B8%D0%B0%D0%BB%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0460681": [
    {
      "name": "Сверхъестественное",
      "url": "https://en.wikipedia.org/wiki/Supernatural_%28American_TV_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt16431870": [
    {
      "name": "Семейный план",
      "url": "https://en.wikipedia.org/wiki/The_Family_Plan_2",
      "origin": "каталог кинотеки"
    }
  ],
  "tt34276058": [
    {
      "name": "Семейный план",
      "url": "https://en.wikipedia.org/wiki/The_Family_Plan_2",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0096697": [
    {
      "name": "Симпсоны",
      "url": "https://en.wikipedia.org/wiki/The_Simpsons_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1564585": [
    {
      "name": "Скайлайн",
      "url": "https://en.wikipedia.org/wiki/Skyline_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt3102440": [
    {
      "name": "Скандинавский форсаж",
      "url": "https://en.wikipedia.org/wiki/B%C3%B8rning_2",
      "origin": "каталог кинотеки"
    }
  ],
  "tt4956984": [
    {
      "name": "Скандинавский форсаж",
      "url": "https://en.wikipedia.org/wiki/B%C3%B8rning_2",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0111257": [
    {
      "name": "Скорость",
      "url": "https://en.wikipedia.org/wiki/Speed_2%3A_Cruise_Control",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0120179": [
    {
      "name": "Скорость",
      "url": "https://en.wikipedia.org/wiki/Speed_2%3A_Cruise_Control",
      "origin": "каталог кинотеки"
    }
  ],
  "tt6235122": [
    {
      "name": "Слуга народа",
      "url": "https://en.wikipedia.org/wiki/Servant_of_the_People_2",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1842127": [
    {
      "name": "Смертельная битва",
      "url": "https://en.wikipedia.org/wiki/Mortal_Kombat%3A_Legacy",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0452608": [
    {
      "name": "Смертельная гонка",
      "url": "https://en.wikipedia.org/wiki/Death_Race_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1500491": [
    {
      "name": "Смертельная гонка",
      "url": "https://en.wikipedia.org/wiki/Death_Race_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1988591": [
    {
      "name": "Смертельная гонка",
      "url": "https://en.wikipedia.org/wiki/Death_Race_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt3807900": [
    {
      "name": "Смертельная гонка",
      "url": "https://en.wikipedia.org/wiki/Death_Race_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt3590190": [
    {
      "name": "Смерть шпионам",
      "url": "https://www.kinopoisk.ru/series/737999/",
      "origin": "каталог кинотеки"
    }
  ],
  "tt3590264": [
    {
      "name": "Смерть шпионам",
      "url": "https://www.kinopoisk.ru/series/737999/",
      "origin": "каталог кинотеки"
    }
  ],
  "tt3590236": [
    {
      "name": "Смерть шпионам",
      "url": "https://www.kinopoisk.ru/series/737999/",
      "origin": "каталог кинотеки"
    }
  ],
  "tt3590252": [
    {
      "name": "Смерть шпионам",
      "url": "https://www.kinopoisk.ru/series/737999/",
      "origin": "каталог кинотеки"
    }
  ],
  "tt3590208": [
    {
      "name": "Смерть шпионам",
      "url": "https://www.kinopoisk.ru/series/737999/",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0368891": [
    {
      "name": "Сокровище нации",
      "url": "https://en.wikipedia.org/wiki/National_Treasure_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0465234": [
    {
      "name": "Сокровище нации",
      "url": "https://en.wikipedia.org/wiki/National_Treasure_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt12580982": [
    {
      "name": "Сокровище нации",
      "url": "https://en.wikipedia.org/wiki/National_Treasure_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt3794354": [
    {
      "name": "Соник",
      "url": "https://en.wikipedia.org/wiki/Sonic_the_Hedgehog_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt12412888": [
    {
      "name": "Соник",
      "url": "https://en.wikipedia.org/wiki/Sonic_the_Hedgehog_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt2004420": [
    {
      "name": "Соседи",
      "url": "https://en.wikipedia.org/wiki/Neighbors_2%3A_Sorority_Rising",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1469304": [
    {
      "name": "Спасатели Малибу",
      "url": "https://en.wikipedia.org/wiki/Baywatch_%28film%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0166813": [
    {
      "name": "Спирит",
      "url": "https://en.wikipedia.org/wiki/Spirit_Untamed",
      "origin": "каталог кинотеки"
    }
  ],
  "tt2113681": [
    {
      "name": "Столетний старик",
      "url": "https://en.wikipedia.org/wiki/The_101-Year-Old_Man_Who_Skipped_Out_on_the_Bill_and_Disappeared",
      "origin": "каталог кинотеки"
    }
  ],
  "tt2015381": [
    {
      "name": "Стражи Галактики",
      "url": "https://en.wikipedia.org/wiki/Guardians_of_the_Galaxy_%28film%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0113492": [
    {
      "name": "Судья Дредд",
      "url": "https://en.wikipedia.org/wiki/Dredd",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1343727": [
    {
      "name": "Судья Дредд",
      "url": "https://en.wikipedia.org/wiki/Dredd",
      "origin": "каталог кинотеки"
    }
  ],
  "tt5308322": [
    {
      "name": "Счастливого дня смерти",
      "url": "https://en.wikipedia.org/wiki/Happy_Death_Day_2U",
      "origin": "каталог кинотеки"
    }
  ],
  "tt8155288": [
    {
      "name": "Счастливого дня смерти",
      "url": "https://en.wikipedia.org/wiki/Happy_Death_Day_2U",
      "origin": "каталог кинотеки"
    }
  ],
  "tt2418558": [
    {
      "name": "Таймлесс",
      "url": "https://en.wikipedia.org/wiki/Ruby_Red_%28film%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt3260022": [
    {
      "name": "Таймлесс",
      "url": "https://en.wikipedia.org/wiki/Ruby_Red_%28film%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt4960934": [
    {
      "name": "Таймлесс",
      "url": "https://en.wikipedia.org/wiki/Ruby_Red_%28film%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt6218010": [
    {
      "name": "Вий",
      "url": "https://en.wikipedia.org/wiki/Viy_2%3A_Journey_to_China",
      "origin": "каталог кинотеки"
    }
  ],
  "tt2709768": [
    {
      "name": "Тайная жизнь домашних животных",
      "url": "https://en.wikipedia.org/wiki/The_Secret_Life_of_Pets_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt7238392": [
    {
      "name": "Такси",
      "url": "https://en.wikipedia.org/wiki/Taxi_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1959563": [
    {
      "name": "Телохранитель киллера",
      "url": "https://en.wikipedia.org/wiki/Hitman%27s_Wife%27s_Bodyguard",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0088247": [
    {
      "name": "Терминатор",
      "url": "https://en.wikipedia.org/wiki/Terminator_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0103064": [
    {
      "name": "Терминатор",
      "url": "https://en.wikipedia.org/wiki/Terminator_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0181852": [
    {
      "name": "Терминатор",
      "url": "https://en.wikipedia.org/wiki/Terminator_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0438488": [
    {
      "name": "Терминатор",
      "url": "https://en.wikipedia.org/wiki/Terminator_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1340138": [
    {
      "name": "Терминатор",
      "url": "https://en.wikipedia.org/wiki/Terminator_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt6450804": [
    {
      "name": "Терминатор",
      "url": "https://en.wikipedia.org/wiki/Terminator_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1663662": [
    {
      "name": "Тихоокеанский рубеж",
      "url": "https://en.wikipedia.org/wiki/Pacific_Rim_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0800369": [
    {
      "name": "Тор",
      "url": "https://en.wikipedia.org/wiki/Thor_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1981115": [
    {
      "name": "Тор",
      "url": "https://en.wikipedia.org/wiki/Thor_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt3501632": [
    {
      "name": "Тор",
      "url": "https://en.wikipedia.org/wiki/Thor_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt10648342": [
    {
      "name": "Тор",
      "url": "https://en.wikipedia.org/wiki/Thor_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1637725": [
    {
      "name": "Третий лишний",
      "url": "https://en.wikipedia.org/wiki/Ted_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt2637276": [
    {
      "name": "Третий лишний",
      "url": "https://en.wikipedia.org/wiki/Ted_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0295701": [
    {
      "name": "Три икса",
      "url": "https://en.wikipedia.org/wiki/XXX_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0329774": [
    {
      "name": "Три икса",
      "url": "https://en.wikipedia.org/wiki/XXX_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1293847": [
    {
      "name": "Три икса",
      "url": "https://en.wikipedia.org/wiki/XXX_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt11116912": [
    {
      "name": "Тролль",
      "url": "https://en.wikipedia.org/wiki/Troll_2_%282025_film%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0084827": [
    {
      "name": "Трон",
      "url": "https://en.wikipedia.org/wiki/Tron_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1104001": [
    {
      "name": "Трон",
      "url": "https://en.wikipedia.org/wiki/Tron_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt2720566": [
    {
      "name": "Туман",
      "url": "https://ru.wikipedia.org/wiki/%D0%A2%D1%83%D0%BC%D0%B0%D0%BD_%28%D1%84%D0%B8%D0%BB%D1%8C%D0%BC%2C_2010%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0109686": [
    {
      "name": "Тупой и ещё тупее",
      "url": "https://en.wikipedia.org/wiki/Dumb_and_Dumber_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt2096672": [
    {
      "name": "Тупой и ещё тупее",
      "url": "https://en.wikipedia.org/wiki/Dumb_and_Dumber_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1860353": [
    {
      "name": "Турбо",
      "url": "https://en.wikipedia.org/wiki/Turbo_Fast",
      "origin": "каталог кинотеки"
    }
  ],
  "tt3713166": [
    {
      "name": "Убрать из друзей",
      "url": "https://en.wikipedia.org/wiki/Unfriended%3A_Dark_Web",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0111999": [
    {
      "name": "Геракл",
      "url": "https://en.wikipedia.org/wiki/Hercules%3A_The_Legendary_Journeys",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0095631": [
    {
      "name": "Успеть до полуночи",
      "url": "https://en.wikipedia.org/wiki/Midnight_Run_for_Your_Life",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0092345": [
    {
      "name": "Утиные истории",
      "url": "https://en.wikipedia.org/wiki/DuckTales_%281987_TV_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0120667": [
    {
      "name": "Фантастическая четвёрка",
      "url": "https://en.wikipedia.org/wiki/Fantastic_Four_in_film",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0486576": [
    {
      "name": "Фантастическая четвёрка",
      "url": "https://en.wikipedia.org/wiki/Fantastic_Four_in_film",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1502712": [
    {
      "name": "Фантастическая четвёрка",
      "url": "https://en.wikipedia.org/wiki/Fantastic_Four_in_film",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0111964": [
    {
      "name": "Флиппер",
      "url": "https://en.wikipedia.org/wiki/Flipper_%281996_film%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt3107288": [
    {
      "name": "Вселенная Стрелы",
      "url": "https://en.wikipedia.org/wiki/Arrowverse",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1596343": [
    {
      "name": "Форсаж",
      "url": "https://en.wikipedia.org/wiki/Fast_%26_Furious",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1905041": [
    {
      "name": "Форсаж",
      "url": "https://en.wikipedia.org/wiki/Fast_%26_Furious",
      "origin": "каталог кинотеки"
    }
  ],
  "tt2820852": [
    {
      "name": "Форсаж",
      "url": "https://en.wikipedia.org/wiki/Fast_%26_Furious",
      "origin": "каталог кинотеки"
    }
  ],
  "tt4630562": [
    {
      "name": "Форсаж",
      "url": "https://en.wikipedia.org/wiki/Fast_%26_Furious",
      "origin": "каталог кинотеки"
    }
  ],
  "tt6806448": [
    {
      "name": "Форсаж",
      "url": "https://en.wikipedia.org/wiki/Fast_%26_Furious",
      "origin": "каталог кинотеки"
    }
  ],
  "tt5433138": [
    {
      "name": "Форсаж",
      "url": "https://en.wikipedia.org/wiki/Fast_%26_Furious",
      "origin": "каталог кинотеки"
    }
  ],
  "tt5433140": [
    {
      "name": "Форсаж",
      "url": "https://en.wikipedia.org/wiki/Fast_%26_Furious",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0167190": [
    {
      "name": "Хеллбой",
      "url": "https://en.wikipedia.org/wiki/Hellboy%3A_The_Crooked_Man",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0411477": [
    {
      "name": "Хеллбой",
      "url": "https://en.wikipedia.org/wiki/Hellboy%3A_The_Crooked_Man",
      "origin": "каталог кинотеки"
    }
  ],
  "tt2274648": [
    {
      "name": "Хеллбой",
      "url": "https://en.wikipedia.org/wiki/Hellboy%3A_The_Crooked_Man",
      "origin": "каталог кинотеки"
    }
  ],
  "tt26757462": [
    {
      "name": "Хеллбой",
      "url": "https://en.wikipedia.org/wiki/Hellboy%3A_The_Crooked_Man",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0465494": [
    {
      "name": "Хитмэн",
      "url": "https://en.wikipedia.org/wiki/Hitman%3A_Agent_47",
      "origin": "каталог кинотеки"
    }
  ],
  "tt11418452": [
    {
      "name": "Холоп",
      "url": "https://ru.wikipedia.org/wiki/%D0%A5%D0%BE%D0%BB%D0%BE%D0%BF_2",
      "origin": "каталог кинотеки"
    }
  ],
  "tt20721318": [
    {
      "name": "Холоп",
      "url": "https://ru.wikipedia.org/wiki/%D0%A5%D0%BE%D0%BB%D0%BE%D0%BF_2",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0134847": [
    {
      "name": "Риддик",
      "url": "https://en.wikipedia.org/wiki/The_Chronicles_of_Riddick_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0296572": [
    {
      "name": "Риддик",
      "url": "https://en.wikipedia.org/wiki/The_Chronicles_of_Riddick_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt2121377": [
    {
      "name": "Хулиган с белым воротничком",
      "url": "https://www.screendaily.com/production/white-collar-hooligan-2-to-kick-off-in-spain-momentum-boards-uk/5044640.article",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0120812": [
    {
      "name": "Час пик",
      "url": "https://en.wikipedia.org/wiki/Rush_Hour_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0266915": [
    {
      "name": "Час пик",
      "url": "https://en.wikipedia.org/wiki/Rush_Hour_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0293564": [
    {
      "name": "Час пик",
      "url": "https://en.wikipedia.org/wiki/Rush_Hour_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt4085584": [
    {
      "name": "Час пик",
      "url": "https://en.wikipedia.org/wiki/Rush_Hour_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0756683": [
    {
      "name": "Человек с Земли",
      "url": "https://en.wikipedia.org/wiki/The_Man_from_Earth%3A_Holocene",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0478970": [
    {
      "name": "Человек-муравей",
      "url": "https://en.wikipedia.org/wiki/Ant-Man_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt5095030": [
    {
      "name": "Человек-муравей",
      "url": "https://en.wikipedia.org/wiki/Ant-Man_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt10954600": [
    {
      "name": "Человек-муравей",
      "url": "https://en.wikipedia.org/wiki/Ant-Man_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt2250912": [
    {
      "name": "Человек-паук - MCU",
      "url": "https://en.wikipedia.org/wiki/Spider-Man%3A_Homecoming",
      "origin": "каталог кинотеки"
    }
  ],
  "tt6320628": [
    {
      "name": "Человек-паук - MCU",
      "url": "https://en.wikipedia.org/wiki/Spider-Man%3A_Homecoming",
      "origin": "каталог кинотеки"
    }
  ],
  "tt10872600": [
    {
      "name": "Человек-паук - MCU",
      "url": "https://en.wikipedia.org/wiki/Spider-Man%3A_Homecoming",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1291150": [
    {
      "name": "Черепашки-ниндзя",
      "url": "https://en.wikipedia.org/wiki/Teenage_Mutant_Ninja_Turtles_in_film",
      "origin": "каталог кинотеки"
    }
  ],
  "tt3949660": [
    {
      "name": "Черепашки-ниндзя",
      "url": "https://en.wikipedia.org/wiki/Teenage_Mutant_Ninja_Turtles_in_film",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1825683": [
    {
      "name": "Чёрная пантера",
      "url": "https://en.wikipedia.org/wiki/Black_Panther%3A_Wakanda_Forever",
      "origin": "каталог кинотеки"
    }
  ],
  "tt9114286": [
    {
      "name": "Чёрная пантера",
      "url": "https://en.wikipedia.org/wiki/Black_Panther%3A_Wakanda_Forever",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1390932": [
    {
      "name": "Четыре таксиста и собака",
      "url": "https://ru.wikipedia.org/wiki/%D0%A7%D0%B5%D1%82%D1%8B%D1%80%D0%B5_%D1%82%D0%B0%D0%BA%D1%81%D0%B8%D1%81%D1%82%D0%B0_%D0%B8_%D1%81%D0%BE%D0%B1%D0%B0%D0%BA%D0%B0",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0117218": [
    {
      "name": "Чокнутый профессор",
      "url": "https://en.wikipedia.org/wiki/The_Nutty_Professor_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0144528": [
    {
      "name": "Чокнутый профессор",
      "url": "https://en.wikipedia.org/wiki/The_Nutty_Professor_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0108988": [
    {
      "name": "Чудеса науки",
      "url": "https://en.wikipedia.org/wiki/Weird_Science_%28TV_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0451279": [
    {
      "name": "Чудо-женщина",
      "url": "https://en.wikipedia.org/wiki/Wonder_Woman_1984",
      "origin": "каталог кинотеки"
    }
  ],
  "tt2741602": [
    {
      "name": "Чёрный список",
      "url": "https://en.wikipedia.org/wiki/The_Blacklist%3A_Redemption",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0448115": [
    {
      "name": "Шазам",
      "url": "https://en.wikipedia.org/wiki/Shazam%21_Fury_of_the_Gods",
      "origin": "каталог кинотеки"
    }
  ],
  "tt6443346": [
    {
      "name": "Шазам",
      "url": "https://en.wikipedia.org/wiki/Shazam%21_Fury_of_the_Gods",
      "origin": "каталог кинотеки"
    }
  ],
  "tt10456740": [
    {
      "name": "Шальная пуля",
      "url": "https://en.wikipedia.org/wiki/Lost_Bullet_2",
      "origin": "каталог кинотеки"
    }
  ],
  "tt14465706": [
    {
      "name": "Шальная пуля",
      "url": "https://en.wikipedia.org/wiki/Lost_Bullet_2",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1475582": [
    {
      "name": "Шерлок Холмс",
      "url": "https://en.wikipedia.org/wiki/Sherlock_Holmes_in_film",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0988045": [
    {
      "name": "Шерлок Холмс",
      "url": "https://en.wikipedia.org/wiki/Sherlock_Holmes_in_film",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1515091": [
    {
      "name": "Шерлок Холмс",
      "url": "https://en.wikipedia.org/wiki/Sherlock_Holmes_in_film",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1937133": [
    {
      "name": "Шутки в сторону",
      "url": "https://en.wikipedia.org/wiki/The_Takedown",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0289879": [
    {
      "name": "Эффект бабочки",
      "url": "https://en.wikipedia.org/wiki/The_Butterfly_Effect_2",
      "origin": "каталог кинотеки"
    }
  ],
  "tt4189022": [
    {
      "name": "Зловещие мертвецы",
      "url": "https://en.wikipedia.org/wiki/Evil_Dead",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1712170": [
    {
      "name": "Алекс Кросс",
      "url": "https://en.wikipedia.org/wiki/Alex_Cross_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt5519340": [
    {
      "name": "Яркость",
      "url": "https://en.wikipedia.org/wiki/Bright%3A_Samurai_Soul",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1782568": [
    {
      "name": "Ёлки",
      "url": "https://en.wikipedia.org/wiki/Yolki",
      "origin": "каталог кинотеки"
    }
  ],
  "tt2124096": [
    {
      "name": "Ёлки",
      "url": "https://en.wikipedia.org/wiki/Yolki",
      "origin": "каталог кинотеки"
    }
  ],
  "tt3121434": [
    {
      "name": "Ёлки",
      "url": "https://en.wikipedia.org/wiki/Yolki",
      "origin": "каталог кинотеки"
    }
  ],
  "tt3877844": [
    {
      "name": "Ёлки",
      "url": "https://en.wikipedia.org/wiki/Yolki",
      "origin": "каталог кинотеки"
    }
  ],
  "tt5840988": [
    {
      "name": "Ёлки",
      "url": "https://en.wikipedia.org/wiki/Yolki",
      "origin": "каталог кинотеки"
    }
  ],
  "tt6907804": [
    {
      "name": "Ёлки",
      "url": "https://en.wikipedia.org/wiki/Yolki",
      "origin": "каталог кинотеки"
    }
  ],
  "tt9615680": [
    {
      "name": "Ёлки",
      "url": "https://en.wikipedia.org/wiki/Yolki",
      "origin": "каталог кинотеки"
    }
  ],
  "tt16148580": [
    {
      "name": "Ёлки",
      "url": "https://en.wikipedia.org/wiki/Yolki",
      "origin": "каталог кинотеки"
    }
  ],
  "tt22059202": [
    {
      "name": "Ёлки",
      "url": "https://en.wikipedia.org/wiki/Yolki",
      "origin": "каталог кинотеки"
    }
  ],
  "tt37660303": [
    {
      "name": "Шекер",
      "url": "https://ru.wikipedia.org/wiki/%D0%A8%D0%B5%D0%BA%D0%B5%D1%80_%28%D1%81%D0%B5%D1%80%D0%B8%D0%B0%D0%BB%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0100802": [
    {
      "name": "Вспомнить всё",
      "url": "https://en.wikipedia.org/wiki/Total_Recall_%281990_film%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1386703": [
    {
      "name": "Вспомнить всё",
      "url": "https://en.wikipedia.org/wiki/Total_Recall_%281990_film%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0365748": [
    {
      "name": "Трилогия Корнетто",
      "url": "https://en.wikipedia.org/wiki/Three_Flavours_Cornetto",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0060584": [
    {
      "name": "Приключения Шурика",
      "url": "https://ru.wikipedia.org/wiki/%D0%A8%D1%83%D1%80%D0%B8%D0%BA",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0070233": [
    {
      "name": "Приключения Шурика",
      "url": "https://ru.wikipedia.org/wiki/%D0%A8%D1%83%D1%80%D0%B8%D0%BA",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0055400": [
    {
      "name": "Трус, Балбес и Бывалый",
      "url": "https://ru.wikipedia.org/wiki/%D0%A2%D1%80%D1%83%D1%81%2C_%D0%91%D0%B0%D0%BB%D0%B1%D0%B5%D1%81_%D0%B8_%D0%91%D1%8B%D0%B2%D0%B0%D0%BB%D1%8B%D0%B9",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0077594": [
    {
      "name": "Игра смерти",
      "url": "https://en.wikipedia.org/wiki/Game_of_Death_II",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0475784": [
    {
      "name": "Мир Дикого Запада",
      "url": "https://en.wikipedia.org/wiki/Westworld_%28TV_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0452046": [
    {
      "name": "Мыслить как преступник",
      "url": "https://en.wikipedia.org/wiki/Criminal_Minds_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt7587890": [
    {
      "name": "Новичок",
      "url": "https://en.wikipedia.org/wiki/The_Rookie%3A_Feds",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0407456": [
    {
      "name": "Участок",
      "url": "https://ru.wikipedia.org/wiki/%D0%97%D0%B0%D0%BA%D0%BE%D0%BB%D0%B4%D0%BE%D0%B2%D0%B0%D0%BD%D0%BD%D1%8B%D0%B9_%D1%83%D1%87%D0%B0%D1%81%D1%82%D0%BE%D0%BA",
      "origin": "каталог кинотеки"
    }
  ],
  "tt4574604": [
    {
      "name": "Училка",
      "url": "https://ru.wikipedia.org/wiki/%D0%9F%D0%BE%D1%81%D0%BB%D0%B5%D0%B4%D0%BD%D0%B5%D0%B5_%D0%B8%D1%81%D0%BF%D1%8B%D1%82%D0%B0%D0%BD%D0%B8%D0%B5",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1706620": [
    {
      "name": "Сквозь снег",
      "url": "https://en.wikipedia.org/wiki/Snowpiercer_%28TV_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0822854": [
    {
      "name": "Стрелок",
      "url": "https://en.wikipedia.org/wiki/Shooter_%28TV_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt13802014": [
    {
      "name": "Небесный суд",
      "url": "https://ru.wikipedia.org/wiki/%D0%9D%D0%B5%D0%B1%D0%B5%D1%81%D0%BD%D1%8B%D0%B9_%D1%81%D1%83%D0%B4",
      "origin": "каталог кинотеки"
    }
  ],
  "tt2303367": [
    {
      "name": "Дирк Джентли",
      "url": "https://en.wikipedia.org/wiki/Dirk_Gently%27s_Holistic_Detective_Agency_%28TV_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt5076054": [
    {
      "name": "Старики-разведчики",
      "url": "https://www.bild.de/service/regio/kundschafter-des-friedens-2-ruestige-ex-spione-mischen-kuba-auf-6790f2a780e66176bf9c2c07",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0139654": [
    {
      "name": "Тренировочный день",
      "url": "https://en.wikipedia.org/wiki/Training_Day_%28TV_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt2085059": [
    {
      "name": "Чёрное зеркало",
      "url": "https://en.wikipedia.org/wiki/Black_Mirror%3A_Bandersnatch",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0251075": [
    {
      "name": "Эволюция",
      "url": "https://en.wikipedia.org/wiki/Alienators%3A_Evolution_Continues",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1182345": [
    {
      "name": "Луна 2112",
      "url": "https://en.wikipedia.org/wiki/Mute_%282018_film%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0356910": [
    {
      "name": "Мистер и миссис Смит",
      "url": "https://en.wikipedia.org/wiki/Mr._%26_Mrs._Smith_%282024_TV_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0305224": [
    {
      "name": "Управление гневом",
      "url": "https://en.wikipedia.org/wiki/Anger_Management_%28TV_series%29",
      "origin": "каталог кинотеки"
    }
  ]
};

// Ожидаем только НОВУЮ карточку выбранного фильма, которую создаёт старый Template.
// Никаких изменений существующих фильмов и самого шаблона.
const pendingImports = new WeakMap();
function watchTemplate(params, movie, title, description, franchise) {
    const {app, obsidian:ob} = params;
    pendingImports.get(app)?.();
    const previousFiles = new Set(app.vault.getMarkdownFiles());
    const created = new Set();
    const timers = new Map();
    const refs = [];
    let finished = false;
    let processing = false;
    let expiry;
    function cleanup() {
        finished = true;
        clearTimeout(expiry);
        timers.forEach(clearTimeout);
        refs.forEach(ref => app.vault.offref(ref));
        if (pendingImports.get(app) === cleanup) pendingImports.delete(app);
    }
    async function finish(file) {
        if (finished || processing || !created.has(file)) return;
        processing = true;
        try {
            const original = await app.vault.read(file);
            const replacement = patchTemplate(original, ob, movie.imdbID, description, franchise);
            if (replacement === null) return;
            // Перепроверяем путь: исходный файл обязан находиться среди созданных этим ожиданием.
            if (app.vault.getAbstractFileByPath(file.path) !== file) return;
            if (franchise.path) await ensureFranchise(app, ob, franchise, movie.imdbID);
            let applied = false;
            await app.vault.process(file, text => {
                if (text !== original) return text;
                applied = true;
                return replacement;
            });
            if (!applied) { schedule(file); return; }
            // Template мог использовать Title, а не fileName: исправляем имя после записи.
            if (file.basename !== title) {
                const folder = file.path.slice(0,file.path.lastIndexOf('/'));
                const candidates = [title, `${title} (${safeName(movie.Year)})`, `${title} (${movie.imdbID})`];
                const used = new Set(app.vault.getMarkdownFiles().filter(x=>x!==file).map(x=>x.path.toLowerCase()));
                for (const candidate of candidates) {
                    const path = `${folder}/${candidate}.md`;
                    if (!used.has(path.toLowerCase()) && !app.vault.getAbstractFileByPath(path)) {
                        await app.fileManager.renameFile(file,path);
                        break;
                    }
                }
            }
            cleanup();
            queueFranchise(params,movie,file);
        } catch (error) {
            // Карточка уже создана шаблоном. Не запускаем бесконечные записи.
            cleanup();
            new ob.Notice("Карточка сохранена. Проверь её имя и поле Франшиза.");
        } finally { processing = false; }
    }
    function schedule(file) {
        if (finished || !created.has(file)) return;
        clearTimeout(timers.get(file));
        timers.set(file,setTimeout(()=>{ timers.delete(file); void finish(file); },750));
    }
    refs.push(app.vault.on('create',file=>{
        if (previousFiles.has(file) || file.extension !== 'md' || !file.path.startsWith(ROOT+'/') ||
            /\/(Просмотры|Сезоны|Франшизы|Служебное)\//.test(file.path)) return;
        created.add(file); schedule(file);
    }));
    refs.push(app.vault.on('modify',schedule));
    refs.push(app.vault.on('rename',schedule));
    expiry = setTimeout(cleanup,30*60*1000);
    pendingImports.set(app,cleanup);
    return cleanup;
}

function patchTemplate(raw, ob, id, description, franchise) {
    const match = raw.match(/^(\uFEFF?---\r?\n)([\s\S]*?)(\r?\n---(?:\r?\n|$))/);
    if (!match) return null;
    let yaml = match[2];
    // Проверяем IMDb до разбора YAML: старый неэкранированный Plot мог содержать двоеточия.
    const imdb = yaml.match(/^(?:imdb Id|"imdb Id"|'imdb Id'):\s*["']?(tt\d+)["']?\s*(?:#.*)?$/m);
    if (!imdb || imdb[1] !== id) return null;
    const newline = raw.includes('\r\n') ? '\r\n' : '\n';
    function set(key,value) {
        const expression = new RegExp('^(?:'+key+'|"'+key+'"|\''+key+'\'):[^\\r\\n]*(?:\\r?\\n(?:[ \\t]+[^\\r\\n]*|(?=\\r?$)))*','m');
        const line = `${key}: ${JSON.stringify(value)}`;
        yaml = expression.test(yaml) ? yaml.replace(expression,()=>line) : yaml.trimEnd()+newline+line;
    }
    set('Описание',description);
    let fm;
    try { fm=ob.parseYaml(yaml); } catch { return null; }
    if (String(fm?.['imdb Id']) !== id) return null;
    if (franchise.path && !fm['Франшиза']) {
        set('Франшиза',`[[${franchise.path.replace(/\.md$/,'')}]]`);
        if (franchise.part != null && fm['Часть'] == null) set('Часть',franchise.part);
    }
    return migrateEntities(match[1]+yaml+match[3]+raw.slice(match[0].length), ob);
}

const SERIES_ALIASES = {
  "Друзья Оушена": [
    "Оушен",
    "Оушены"
  ],
  "Расширенная вселенная DC": [
    "DCEU"
  ],
  "Киновселенная Marvel": [
    "MCU",
    "Кинематографическая вселенная Marvel"
  ],
  "Средиземье": [
    "Властелин колец"
  ],
  "Гадкий я и Миньоны": [
    "Гадкий я"
  ],
  "Волшебный мир Гарри Поттера": [
    "Гарри Поттер",
    "Волшебный мир"
  ],
  "Джейсон Борн": [
    "Борн"
  ],
  "Шрек и Кот в сапогах": [
    "Шрек"
  ],
  "Мальчишник": [
    "Мальчишник в Вегасе"
  ],
  "Парк и Мир Юрского периода": [
    "Парк Юрского периода",
    "Юрский период"
  ]
};


const franchiseJobs = new WeakMap();
function queueFranchise(params,movie,file) {
    const previous=franchiseJobs.get(params.app)||Promise.resolve();
    const job=previous.catch(()=>{}).then(()=>afterTemplateFranchise(params,movie,file)).catch(()=>{
        new params.obsidian.Notice('Карточка сохранена. Франшизу можно назначить отдельной командой.');
    });
    franchiseJobs.set(params.app,job);
    return job;
}

async function afterTemplateFranchise(params,movie,file) {
    const {app,obsidian:ob,quickAddApi:qa}=params;
    if(app.vault.getAbstractFileByPath(file.path)!==file)return;
    const before=await frontmatter(app,ob,file);
    if(before['imdb Id']!==movie.imdbID || before['Франшиза'])return;
    await app.workspace.getLeaf(false).openFile(file);
    const notice=new ob.Notice('Карточка создана. Проверяю франшизу…',0);
    let result;
    try { result=await lookupFranchise(ob,movie.imdbID); }
    finally { notice.hide?.(); }
    const {pages,proposals}=await franchiseInventory(app,ob,result.suggestions);
    const choice=await franchiseDialog(app,ob,file.basename,pages,proposals,result.status);
    if(!choice)return;
    let part;
    while(true) {
        const value=await qa.inputPrompt('Номер части','Пусто - без номера');
        if(value==null)return;
        if(!value.trim()){part=null;break;}
        const n=Number(value.replace(',','.'));
        if(Number.isFinite(n)&&n>0){part=n;break;}
    }
    // Пока открыт диалог, пользователь может поменять карточку вручную.
    const current=await frontmatter(app,ob,file);
    if(current['imdb Id']!==movie.imdbID || current['Франшиза'])return;
    choice.part=part;
    await ensureFranchise(app,ob,choice,movie.imdbID);
    await app.fileManager.processFrontMatter(file,fm=>{
        if(fm['imdb Id']!==movie.imdbID || fm['Франшиза'])return;
        fm['Франшиза']=`[[${choice.path.replace(/\.md$/,'')}]]`;
        if(part!=null && fm['Часть']==null)fm['Часть']=part;
    });
}

async function lookupFranchise(ob,id) {
    // Отдельный запрос ПОСЛЕ создания карточки. Старый каталог его не отменяет.
    const query=`SELECT DISTINCT ?item ?series ?seriesLabel WHERE {
      ?item wdt:P345 "${id}" .
      OPTIONAL {
        { ?item wdt:P179 ?series } UNION { ?item wdt:P8345 ?series }
        FILTER NOT EXISTS { ?series wdt:P31 wd:Q13406463 }
      }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "ru,en" . }
    } LIMIT 100`;
    const data=await getJson(ob,'https://query.wikidata.org/sparql',{format:'json',query});
    const parsed=parseWikidata(data);
    const direct=parsed.series.filter(s=>! /^(список |перечень |list of |filmography)/i.test(s.name)).map(s=>({...s,url:s.url.replace("#P179", "")}));
    // Локально проверенные связи показываются с отдельной пометкой, не как ответ интернета.
    const known=CATALOG[id]||[];
    const suggestions=[...direct,...known.filter(k=>!direct.some(d=>normalized(d.name)===normalized(k.name)))];
    return {suggestions,status:direct.length?'В интернете найдены связи с сериями. Выбери нужную.':
        known.length?'В интернете явная связь не найдена. Есть подсказки из ранее проверенного каталога.':
        'Принадлежность к франшизе не подтверждена. Это не означает, что продолжений нет. Можно выбрать вручную или пропустить.'};
}

function franchiseRef(value) {
    return String(value?.path||value||'').trim().replace(/^\[\[/,'').replace(/\]\]$/,'').split('|')[0].split('#')[0].replace(/\.md$/,'').trim();
}
function alphabetical(a,b) {
    return a.name.localeCompare(b.name,'ru',{sensitivity:'base',numeric:true})||a.path.localeCompare(b.path,'ru');
}
async function franchiseInventory(app,ob,suggestions) {
    const entries=[];
    for(const file of app.vault.getMarkdownFiles())entries.push({file,fm:await frontmatter(app,ob,file)});
    const pages=new Map();
    const add=(file,fm={},missing=false)=>{
        if(fm['imdb Id']||fm['Фильм']||fm['Сериал'])return;
        if(!pages.has(file.path))pages.set(file.path,{name:file.basename,path:file.path,fm,missing});
    };
    for(const {file,fm} of entries) {
        const tags=(Array.isArray(fm.tags)?fm.tags:[fm.tags]).map(x=>String(x||'').replace(/^#/,''));
        // Каталог франшиз может находиться вне Кино/ и иметь вложенные папки.
        if(file.path.split('/').slice(0,-1).some(x=>/^(франшизы|franchises)$/i.test(x)) || tags.includes('franchise'))add(file,fm);
    }
    const memberships=[];
    for(const {file,fm} of entries) {
        const refs=Array.isArray(fm['Франшиза'])?fm['Франшиза']:[fm['Франшиза']];
        for(const ref of refs.filter(Boolean)) {
            const path=franchiseRef(ref);
            if(!path)continue;
            const target=app.metadataCache.getFirstLinkpathDest(path,file.path);
            if(target?.extension==='md') {
                add(target,entries.find(x=>x.file.path===target.path)?.fm||{});
                memberships.push({id:fm['imdb Id'],path:target.path});
            } else {
                const dest=(path.includes('/')?path:`${SERIES}/${safeName(path)}`)+'.md';
                add({path:dest,basename:path.split('/').pop()},{},true);
                memberships.push({id:fm['imdb Id'],path:dest});
            }
        }
    }
    const list=[...pages.values()].sort(alphabetical);
    const proposals=[];
    for(const suggestion of suggestions) {
        const names=new Set([suggestion.name,...(SERIES_ALIASES[suggestion.name]||[])].map(normalized));
        const matches=list.filter(p=>{
            const aliases=Array.isArray(p.fm.aliases)?p.fm.aliases:[p.fm.aliases];
            return [p.name,...aliases.filter(Boolean)].some(x=>names.has(normalized(x))) ||
                memberships.some(m=>m.path===p.path&&(CATALOG[m.id]||[]).some(x=>names.has(normalized(x.name))));
        });
        if(matches.length)proposals.push(...matches.map(p=>({...suggestion,name:p.name,path:p.path})));
        else proposals.push({...suggestion,create:true});
    }
    return {pages:list,proposals};
}

function franchiseDialog(app,ob,title,pages,proposals,status) {
    return new Promise(resolve=>{
        class Picker extends ob.Modal {
            constructor(){super(app);this.result=null;}
            onOpen(){
                const el=this.contentEl;
                el.createEl('h2',{text:`Франшиза: ${title}`});
                el.createEl('p',{text:status});
                for(const p of proposals) {
                    const line=el.createEl('div');
                    line.createEl('span',{text:p.path?`Подходит существующая: ${p.name} `:`Предложенное название: ${p.name} `});
                    if(p.url)line.createEl('a',{text:'Источник',href:p.url,attr:{target:'_blank',rel:'noopener'}});
                }
                el.createEl('p',{text:'Название новой франшизы (можно изменить):'});
                const name=el.createEl('input',{type:'text'});
                name.style.width='100%';name.value=proposals.find(x=>!x.path)?.name||proposals[0]?.name||'';
                const create=el.createEl('button',{text:'Создать с этим названием'});
                create.onclick=()=>{
                    const value=safeName(name.value);
                    if(!value){name.focus();return;}
                    const existing=pages.filter(p=>normalized(p.name)===normalized(value));
                    if(existing.length===1){this.select(existing[0]);return;}
                    if(existing.length>1){search.value=value;render();return;}
                    const proposed=proposals.find(p=>normalized(p.name)===normalized(value));
                    this.select({...proposed,name:value,path:`${SERIES}/${value}.md`});
                };
                el.createEl('h3',{text:`Все существующие франшизы (${pages.length}), А–Я`});
                const search=el.createEl('input',{type:'search',placeholder:'Поиск по списку'});search.style.width='100%';
                const list=el.createEl('div');Object.assign(list.style,{maxHeight:'35vh',overflowY:'auto',display:'flex',flexDirection:'column',gap:'4px',marginTop:'8px'});
                const render=()=>{
                    list.empty();
                    for(const page of pages.filter(p=>normalized(p.name+' '+p.path).includes(normalized(search.value)))) {
                        const proposal=proposals.find(p=>p.path===page.path);
                        const row=list.createEl('button',{text:`${page.name}${proposal?' ✓':''}${page.missing?' (создать страницу)':''}`});
                        row.title=page.path;row.style.textAlign='left';
                        row.onclick=()=>this.select({...page,...proposal,name:page.name,path:page.path});
                    }
                };
                search.oninput=render;render();
                const skip=el.createEl('button',{text:'Оставить без франшизы'});skip.style.marginTop='12px';skip.onclick=()=>this.close();
            }
            select(choice){this.result=choice;this.close();}
            onClose(){this.contentEl.empty();resolve(this.result);}
        }
        new Picker().open();
    });
}

// Строковые сущности: общая нормализация без создания страниц людей/жанров.
const ENTITY_FIELDS = ['Режисер','Актеры','Жанр'];
function entityName(value) {
    if (typeof value !== 'string') throw new Error('Ожидалась строка имени сущности');
    const text=value.trim();
    const link=text.match(/^\[\[([\s\S]+?)\]\]$/);
    if(!link)return text.normalize('NFC');
    if(link[1]==='N/A')return 'N/A';
    const parts=link[1].split('|');
    return (parts.length>1?parts.slice(1).join('|'):parts[0].split('#')[0].replace(/\.md$/i,'').split('/').pop()).trim().normalize('NFC');
}
function normalizeEntityField(value) {
    if(value==null)return value;
    return Array.isArray(value)?value.map(entityName):entityName(value);
}
function yamlParts(raw) {
    const m=raw.match(/^(\uFEFF?---\r?\n)([\s\S]*?)(\r?\n---(?:\r?\n|$))/);
    return m?{prefix:m[1],yaml:m[2],end:m[3],body:raw.slice(m[0].length)}:null;
}
function propertyBlock(yaml,key) {
    const exp=new RegExp('^(?:'+key+'|"'+key+'"|\''+key+'\'):[^\\r\\n]*(?:\\r?\\n(?![^ \\t\\r\\n#][^\\r\\n]*:)[^\\r\\n]*)*','m');
    return yaml.match(exp);
}
function migrateEntities(raw,ob) {
    const parts=yamlParts(raw);
    if(!parts)return raw;
    let yaml=parts.yaml;
    const newline=raw.includes('\r\n')?'\r\n':'\n';
    for(const key of ENTITY_FIELDS) {
        const block=propertyBlock(yaml,key);
        if(!block)continue;
        const value=ob.parseYaml(block[0])?.[key];
        const result=normalizeEntityField(value);
        if(JSON.stringify(value)===JSON.stringify(result))continue;
        const replacement=Array.isArray(result)?key+':'+(result.length?newline+result.map(x=>'  - '+JSON.stringify(x)).join(newline):' []'):key+': '+JSON.stringify(result);
        yaml=yaml.slice(0,block.index)+replacement+yaml.slice(block.index+block[0].length);
    }
    return parts.prefix+yaml+parts.end+parts.body;
}
function originalMediaPath(path) {
    return path.startsWith('Кино/') && path.endsWith('.md') && !/^Кино\/(Просмотры|Сезоны|Франшизы|Служебное|_system)\//.test(path);
}
function isMediaRaw(path,raw,ob) {
    if(!originalMediaPath(path))return false;
    const parts=yamlParts(raw);
    if(!parts)return false;
    const block=propertyBlock(parts.yaml,'tags');
    const tags=block?ob.parseYaml(block[0])?.tags:[];
    return (Array.isArray(tags)?tags:[tags]).some(x=>['movies','serial'].includes(String(x).replace(/^#/,'')));
}
async function makeFolders(app,path) {
    let current='';
    for(const part of path.split('/').slice(0,-1)) {
        current=current?current+'/'+part:part;
        if(!app.vault.getAbstractFileByPath(current))await app.vault.createFolder(current);
    }
}
