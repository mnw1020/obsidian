---
Название: World War Z
Просмотрено: 2013-09-10
Оценка: "8"
Оценка Imdb: "7.0"
Оценка Кинопоиск: 7.0
Количество голосов Кинопоиск: 216815
Количество голосов Imdb: 794633
tags:
  - movies
Жанр:
  - "Sci-Fi"
Релиз: 2013-06-02
Время: 116 min
Режисер:
  - "Марк Форстер"
Актеры:
  - "Brad Pitt (Брэд Питт)"
  - "Mireille Enos (Мирей Инос)"
  - "Sterling Jerins (Стерлинг Джеринс)"
  - "Эбигейл Харгров"
  - "Даниэла Картес"
Описание: Бывший сотрудник ООН Джерри Лэйн оказывается в эпицентре эпидемии неизвестного вируса, который за считанные секунды превращает людей в зомби. Пытаясь найти противоядие против вируса, Лэйн путешествует вместе со своей группой почти по всему миру, поражённому эпидемией. Теперь судьба всего мира висит на волоске, и Джерри — его единственная надежда.
imdb Id: tt0816711
poster: https://m.media-amazon.com/images/M/MV5BODg3ZTM2YWQtZDE5Ny00NGNiLTkzYjgtYWVlYjNkOTg5NDI1XkEyXkFqcGc@._V1_SX300.jpg
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
        if (index) row.appendText(" · ");
        const link = row.createEl("a");
        link.textContent = group.label;
        link.href = kinoUri(choice, group.label);
        if (group.originals.some(original => original !== group.label)) {
            link.title = "В YAML: " + group.originals.join(" / ");
        }
    });
}
```

---

---
![](https://m.media-amazon.com/images/M/MV5BODg3ZTM2YWQtZDE5Ny00NGNiLTkzYjgtYWVlYjNkOTg5NDI1XkEyXkFqcGc@._V1_SX300.jpg)
