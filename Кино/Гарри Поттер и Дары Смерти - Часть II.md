---
Название: "Harry Potter and the Deathly Hallows: Part 2"
Просмотрено: 2012-06-04
Оценка: "7"
Оценка Imdb: "8.1"
Оценка Кинопоиск: 8.1
Количество голосов Кинопоиск: 411612
Количество голосов Imdb: 1062749
tags:
  - movies
Жанр:
  - "Fantasy"
Релиз: 2011-07-07
Время: 130 min
Режисер:
  - "David Yates (Дэвид Йейтс)"
Актеры:
  - "Daniel Radcliffe (Дэниэл Рэдклифф)"
  - "Rupert Grint (Руперт Гринт)"
  - "Emma Watson (Эмма Уотсон)"
  - "Ralph Fiennes (Рэйф Файнс)"
  - "Helena Bonham Carter (Хелена Бонэм Картер)"
Описание: В грандиозной последней главе битва между добрыми и злыми силами мира волшебников перерастает во всеобщую войну. Ставки ещё никогда не были так высоки, а поиск убежища — столь сложен. И быть может именно Гарри Поттеру придется пожертвовать всем в финальном сражении с Волан-де-Мортом. Способен ли наш герой спасти мир? И всё закончится здесь.
imdb Id: tt1201607
poster: https://m.media-amazon.com/images/M/MV5BOTA1Mzc2N2ItZWRiNS00MjQzLTlmZDQtMjU0NmY1YWRkMGQ4XkEyXkFqcGc@._V1_SX300.jpg
Франшиза: "[[Кино/Франшизы/Волшебный мир Гарри Поттера]]"
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
![](https://m.media-amazon.com/images/M/MV5BOTA1Mzc2N2ItZWRiNS00MjQzLTlmZDQtMjU0NmY1YWRkMGQ4XkEyXkFqcGc@._V1_SX300.jpg)
