---
Название: Happy End
Просмотрено: 2023-02-03
Оценка: "8"
Оценка Imdb: "7.1"
Оценка Кинопоиск: null
Количество голосов Кинопоиск: null
Количество голосов Imdb: 851
tags:
  - serial
Жанр:
  - "Drama"
Релиз: 2021-04-01
Время: 38 min
Режисер:
  - "Evgeniy Sangadzhiev (Евгений Владимирович Сангаджиев)"
Актеры:
  - "Елена Тронина"
  - "Denis Vlasenko (Денис Владимирович Власенко)"
  - "Aleksandr Gorchilin (Горчилин, Александр Михайлович)"
  - "Lyubov Tolkalina (Любовь Николаевна Толкалина)"
  - "Daniil Vorobyov (Даниил Воробьёв)"
Описание: "Попасть в мир Webcam просто: достаточно нажать кнопку REC. в своем мобильном и начать снимать. С такого видео и начинается карьера 19-летних Леры и Влада, которые в поисках лучшей жизни и легких денег приходят к неожиданному решению — вебкам. Они совсем не подходят друг другу, их характеры противоположны, а ценности не совпадают: Лера — безрассудная оторва, которая легко идет по головам, Влад — замкнутый умник, готовый на все ради подруги. Но странным образом они дополняют друг друга, и, вместе преодолевая препятствия на пути к успеху, взрослеют и становятся все ближе.Но можно ли сохранить любовь, когда вся твоя личная жизнь — сплошное порно?"
imdb Id: tt12908084
poster: https://m.media-amazon.com/images/M/MV5BOWE4MDI4ZDQtZDM0NC00MzgyLWFiNzItY2EyZTI3NjIxM2QxXkEyXkFqcGc@._V1_SX300.jpg
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
![](https://m.media-amazon.com/images/M/MV5BOWE4MDI4ZDQtZDM0NC00MzgyLWFiNzItY2EyZTI3NjIxM2QxXkEyXkFqcGc@._V1_SX300.jpg)
