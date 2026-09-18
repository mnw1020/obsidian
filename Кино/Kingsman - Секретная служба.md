---
Название: "Kingsman: The Secret Service"
Просмотрено: 2015-05-21
Оценка: "7"
Оценка Imdb: "7.7"
Оценка Кинопоиск: 7.7
Количество голосов Кинопоиск: 552111
Количество голосов Imdb: 784503
tags:
  - movies
Жанр:
  - "экранизация комикса"
  - "сцена после титров"
Релиз: 2015-01-24
Время: 129 min
Режисер:
  - "Matthew Vaughn (Мэттью Вон)"
Актеры:
  - "Colin Firth (Колин Ферт)"
  - "Samuel L. Jackson (Сэмюэл Л. Джексон)"
  - "Michael Caine (Майкл Кейн)"
  - "Taron Egerton (Тэрон Эджертон)"
  - "Mark Strong (Марк Стронг)"
Описание: Эггси — молодой парень, который прошел службу в морской пехоте и имеет очень высокий уровень интеллекта. Он мог бы добиться многого, но выбрал другой путь и стал мелким преступником. Однажды он знакомится с Гарри Хартом, которому его отец когда-то спас жизнь. Этот человек решил сделать все возможное, чтобы сделать жизнь Эггси лучше и открыть для него новые возможности. Гарри рассказал ему, что является агентом секретной независимой организации, которая стоит на защите всего мира. Он предложил парню пройти обучение и стать новым членом их команды. Эггси принял предложение Харта, но сможет ли он справиться со всеми испытаниями и оправдать его надежды?..
imdb Id: tt2802144
poster: https://m.media-amazon.com/images/M/MV5BODk1MTYwNTAtYmI5Zi00OWYyLWE0MzQtOWE4NDIxZmU2MjMwXkEyXkFqcGc@._V1_SX300.jpg
Франшиза: "[[Кино/Франшизы/Kingsman]]"
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
![](https://m.media-amazon.com/images/M/MV5BODk1MTYwNTAtYmI5Zi00OWYyLWE0MzQtOWE4NDIxZmU2MjMwXkEyXkFqcGc@._V1_SX300.jpg)
