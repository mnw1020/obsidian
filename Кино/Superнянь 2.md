---
Название: Babysitting 2
Просмотрено: 2016-01-03
Оценка: "5"
Оценка Imdb: "6.4"
Оценка Кинопоиск: 7.0
Количество голосов Кинопоиск: 76640
Количество голосов Imdb: 8662
tags:
  - movies
Жанр:
  - "Comedy"
Релиз: 2015-10-14
Время: 93 min
Режисер:
  - "Nicolas Benamou (Николя Бенаму)"
  - "Philippe Lacheau (Филипп Лашо)"
Актеры:
  - "Philippe Lacheau (Филипп Лашо)"
  - "Alice David (Алис Давид)"
  - "Vincent Desagnat (Венсан Дезанья)"
  - "Tarek Boudali (Тарек Будали)"
  - "Julien Arruti (Жюльен Аррути)"
Описание: Влюбленная парочка Фрэнк и Соня приглашают своих друзей на отдых в Бразилию, в роскошный отель богатенького папы Сони. Планировалось, что это будет отдых мечты, а Фрэнк сделает Соне предложение посреди всей этой экзотики. Но его попытки получить одобрение отца оборачиваются полным провалом. Ведь с такими друзьями, как у него, и враги не нужны! Но настоящая катастрофа – впереди. Когда друзья – сексуально озабоченный Сэм, наивный чудак Эрнест и умственно отсталый Алекс – вместе с беднягой Фрэнком собрались на экскурсию, ушлый папаша пользуется возможностью и засылает в джунгли с этой бандой свою крикливую и надоедливую старушку. В общем, Амазонка и ее девственные леса еще никогда не были в такой опасности!
imdb Id: tt4400058
poster: https://m.media-amazon.com/images/M/MV5BOGQzY2QxY2EtMzM0NS00NzgzLWI1YzEtMDNiODBkYTk1MjQ3XkEyXkFqcGc@._V1_SX300.jpg
Франшиза: "[[Кино/Франшизы/Superнянь]]"
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

---
![](https://m.media-amazon.com/images/M/MV5BOGQzY2QxY2EtMzM0NS00NzgzLWI1YzEtMDNiODBkYTk1MjQ3XkEyXkFqcGc@._V1_SX300.jpg)
