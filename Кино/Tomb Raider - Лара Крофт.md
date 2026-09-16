---
Название: Tomb Raider
Просмотрено: 2018-06-20
Оценка: "6"
Оценка Imdb: "6.3"
Оценка Кинопоиск: 6.2
Количество голосов Кинопоиск: 160324
Количество голосов Imdb: 244180
tags:
  - movies
Жанр:
  - "Fantasy"
Релиз: 2018-03-02
Время: 118 min
Режисер:
  - "Роар Утхауг"
Актеры:
  - "Алисия Викандер"
  - "Доминик Уэст"
  - "Уолтон Гоггинс"
  - "Дэниэл Ву"
  - "Кристин Скотт Томас"
Описание: Лара Крофт — весьма самостоятельная дочь эксцентричного искателя приключений, который пропал, едва она стала подростком. Теперь ей двадцать один, она бесцельно проживает свою жизнь, курьером рассекая на байке по забитым улицам восточного Лондона. Решительно настроенная пробиться сама, она отказывается брать на себя руководство глобальной империей отца, столь же категорично отвергая мысль о том, что он действительно пропал. Слыша советы о том, что ей нужно смириться с этим фактом и жить дальше после семи лет бесплодных поисков, Лара уже и сама не понимает, что же заставляет ее распутывать обстоятельства его таинственного исчезновения.
imdb Id: tt1365519
poster: https://m.media-amazon.com/images/M/MV5BMTIwNWU2NTEtMDQ0Yi00MjFkLThhN2UtMjJhOGVjN2UyYzFkXkEyXkFqcGc@._V1_.jpg
Франшиза: "[[Кино/Франшизы/Лара Крофт]]"
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
![](https://m.media-amazon.com/images/M/MV5BMTIwNWU2NTEtMDQ0Yi00MjFkLThhN2UtMjJhOGVjN2UyYzFkXkEyXkFqcGc@._V1_.jpg)
