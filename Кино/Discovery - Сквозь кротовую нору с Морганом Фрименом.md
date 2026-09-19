---
Название: Through the Wormhole
Просмотрено: 2014-02-06
Оценка: "9"
Оценка Imdb: "8.6"
Оценка Кинопоиск: 8.4
Количество голосов Кинопоиск: 6587
Количество голосов Imdb: 19471
tags:
  - serial
Жанр:
  - "Documentary"
Релиз: 2010-06-09
Время: 43 min
Режисер:
  - "Kurt Sayenga (Курт Сайенга)"
  - "Jeffrey Sharp (Джеффри Шарп)"
  - "Entoni Land (Энтони Ланд)"
  - "Dzheyms Yanger (Джеймс Янгер)"
  - "Devid Lamattina (Дэвид Ламаттина)"
Актеры:
  - "Albert Eynshteyn (Альберт Эйнштейн)"
  - "Max Tegmark (Макс Тегмарк)"
  - "Michio Kaku (Митио Каку)"
  - "Morgan Freeman (Морган Фриман)"
  - "Sean M. Carroll (Шон Кэрролл)"
Описание: Сериал исследует самые глубокие тайны существования - вопросы, которые всегда озадачивали человечество. Из чего мы сделаны? Что было перед началом всего? Действительно ли мы одиноки во вселенной? Есть ли создатель? Эти вопросы были обдуманы самыми изящными умами человеческого рода.Теперь, наука приблизилась к сути, в область где твердые факты и свидетельства могут быть в состоянии предоставить нам ответы, вместо философских теорий. «Через Червоточину» примирит самые яркие умы и лучшие идеи с самых передних краев наук, - астрофизики, астробиологии, квантовой механики, теории струн, и более - чтобы показать экстраординарную правду о нашей Вселенной.
imdb Id: tt1513168
poster: https://m.media-amazon.com/images/M/MV5BMGQyNDAzNGItZWM5MC00ZDAxLTg1YjItYzhkZmU5NGQzMWEzXkEyXkFqcGc@._V1_.jpg
---
<!-- KINO:ENTITY:LINKS:V2 -->
```dataviewjs
const KINO_GENRE_ALIASES = {"Боевик":["Action","Боевик"],"Приключения":["Adventure","Приключения"],"Анимация":["Animation","Анимация","Мультфильм"],"Биография":["Biography","Биография"],"Комедия":["Comedy","Комедия"],"Криминал":["Crime","Криминал"],"Документальный":["Documentary","Документальный","Документальное"],"Драма":["Drama","Драма"],"Семейный":["Family","Семейный"],"Фэнтези":["Fantasy","Фэнтези"],"История":["History","История"],"Ужасы":["Horror","Ужасы"],"Музыка":["Music","Музыка"],"Мюзикл":["Musical","Мюзикл"],"Мистика":["Mystery","Мистика"],"Мелодрама":["Romance","Мелодрама"],"Фантастика":["Sci-Fi","Science Fiction","Фантастика"],"Короткометражка":["Short","Short Film","Короткометражка"],"Спорт":["Sport","Sports","Спорт"],"Триллер":["Thriller","Триллер"],"Военный":["War","Военный"],"Реалити-шоу":["Reality-TV","Reality TV","Реалити-шоу"],"Вестерн":["Western","Вестерн"]};
const KINO_ENTITY_FIELDS = [
    ["Режисер", "Режиссер", "Кино - Открыть режиссера"],
    ["Актеры", "Актеры", "Кино - Открыть актера"],
    ["Жанр", "Жанры", "Кино - Открыть жанр"]
];

function kinoEntityText(value) {
    return String(value ?? "").trim().normalize("NFC");
}

function kinoPersonName(value) {
    return kinoEntityText(value).replace(/\s+-\s+.+$/, "").trim();
}

function kinoEntityKey(value) {
    return kinoEntityText(value).toLocaleLowerCase("ru").replace(/ё/g, "е");
}

function kinoCanonicalGenre(value) {
    const text = kinoEntityText(value);
    const key = kinoEntityKey(text);
    for (const [canonical, aliases] of Object.entries(KINO_GENRE_ALIASES)) {
        if ([canonical, ...aliases].some(alias => kinoEntityKey(alias) === key)) return canonical;
    }
    return text;
}

function kinoValues(value) {
    return [...new Set((Array.isArray(value) ? value : [value])
        .map(kinoEntityText).filter(Boolean))];
}

function kinoCanonical(field, value) {
    return field === "Жанр" ? kinoCanonicalGenre(value) : kinoEntityText(value);
}

function kinoUri(choice, value) {
    return "obsidian://quickadd?vault=" + encodeURIComponent(app.vault.getName())
        + "&choice=" + encodeURIComponent(choice)
        + "&value-entity=" + encodeURIComponent(value);
}

const kinoRoot = dv.container.createDiv({ cls: "kino-entity-links" });
for (const [field, label, choice] of KINO_ENTITY_FIELDS) {
    const groups = new Map();
    for (const original of kinoValues(dv.current()[field])) {
        const canonical = kinoCanonical(field, original);
        const key = kinoEntityKey(canonical);
        if (!groups.has(key)) groups.set(key, { label: canonical, originals: [] });
        groups.get(key).originals.push(original);
    }
    const row = kinoRoot.createDiv({ cls: "kino-entity-links-row" });
    row.createEl("strong", { text: label + ": " });
    if (!groups.size) {
        row.appendText("Не указано");
        continue;
    }
    [...groups.values()].forEach((group, index) => {
        if (field !== "Актеры" && index) row.appendText(" · ");
        const target = field === "Актеры" ? kinoPersonName(group.label) : group.label;
        const linkRow = field === "Актеры" ? row.createDiv({ cls: "kino-entity-link-line" }) : row;
        const link = linkRow.createEl("a");
        link.textContent = group.label;
        link.href = kinoUri(choice, target);
        if (group.originals.some(original => original !== group.label)) {
            link.title = "В YAML: " + group.originals.join(" / ");
        }
    });
}
```
---
![](https://m.media-amazon.com/images/M/MV5BMGQyNDAzNGItZWM5MC00ZDAxLTg1YjItYzhkZmU5NGQzMWEzXkEyXkFqcGc@._V1_.jpg)
