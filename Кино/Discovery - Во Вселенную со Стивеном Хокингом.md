---
Название: Into the Universe with Stephen Hawking
Просмотрено: 2013-12-20
Оценка: "6"
Оценка Imdb: "8.5"
Оценка Кинопоиск: 8.5
Количество голосов Кинопоиск: 5797
Количество голосов Imdb: 5704
tags:
  - serial
Жанр:
  - Documentary
Релиз: 2010-04-25
Время: 43 min
Режисер:
  - Iain Riddick
  - Martin Williams
  - Nathan Williams
Актеры:
  - Benedict Cumberbatch
  - Christopher Goh
  - Leon Mitchell
  - Melissa Ricci
  - Phoebe Haines
  - Simon Haines
  - Stephen Hawking
Описание: Знаменитый физик, профессор Стивен Хокинг, который в 30 лет оказался практически полностью парализован из-за прогрессирующей болезни, делится мыслями о самых интригующих загадках Вселенной, таких как инопланетная жизнь или путешествие во времени.
imdb Id: tt1655078
poster: https://m.media-amazon.com/images/M/MV5BMTkyNTAwMTk2Ml5BMl5BanBnXkFtZTgwMDA2NjE0MzE@._V1_.jpg
Роли актеров:
  - Laura Jesson - Melissa Ricci
  - Mad Scientist - Christopher Goh
  - Richard Feynman - Leon Mitchell
  - Self - Stephen Hawking
  - Stephen Hawking - Benedict Cumberbatch
  - Young Juliet - Phoebe Haines
  - Young Romeo - Simon Haines
Кинопоиск ID: "542489"
---
<!-- KINO:ENTITY:LINKS:V3 -->
```dataviewjs
const KINO_ENTITY_FIELDS = [
    ["Режисер", "Режиссер", "Кино - Открыть режиссера"],
    ["Актеры", "Актеры", "Кино - Открыть актера"],
    ["Жанр", "Жанры", "Кино - Открыть жанр"]
];

function kinoText(value) { return String(value ?? "").trim().normalize("NFC"); }
function kinoValues(value) {
    return [...new Set((Array.isArray(value) ? value : [value]).map(kinoText).filter(Boolean))];
}
function kinoName(value) {
    const text = kinoText(value);
    const actorNames = kinoValues(dv.current()["Актеры"]);
    const known = actorNames.find(name =>
        text === name || text.startsWith(name + " - ") || text.endsWith(" - " + name)
    );
    if (known) return known;
    return text.includes(" - ") ? text.split(/\s+-\s+/).slice(-1)[0].trim() : text;
}
function kinoUri(choice, value) {
    return "obsidian://quickadd?vault=" + encodeURIComponent(app.vault.getName())
        + "&choice=" + encodeURIComponent(choice)
        + "&value-entity=" + encodeURIComponent(value);
}

const actorRoles = kinoValues(dv.current()["Роли актеров"]);
const root = dv.container.createDiv({ cls: "kino-entity-links" });
for (const [field, label, choice] of KINO_ENTITY_FIELDS) {
    const row = root.createDiv({ cls: "kino-entity-links-row" });
    row.createEl("strong", { text: label + ": " });
    const values = field === "Актеры"
        ? (actorRoles.length ? actorRoles : kinoValues(dv.current()[field]))
        : kinoValues(dv.current()[field]);
    if (!values.length) { row.appendText("Не указано"); continue; }
    if (field === "Актеры") {
        values.forEach(value => {
            const line = row.createDiv({ cls: "kino-entity-link-line" });
            const link = line.createEl("a");
            link.textContent = value;
            link.href = kinoUri(choice, kinoName(value));
        });
        continue;
    }
    values.forEach((value, index) => {
        if (index) row.appendText(" · ");
        const link = row.createEl("a");
        link.textContent = value;
        link.href = kinoUri(choice, value);
    });
}
```
---
![](https://m.media-amazon.com/images/M/MV5BMTkyNTAwMTk2Ml5BMl5BanBnXkFtZTgwMDA2NjE0MzE@._V1_.jpg)
