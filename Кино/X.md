---
Название: X
Просмотрено: 2022-05-25
Оценка: "2"
Оценка Imdb: "6.5"
Оценка Кинопоиск:
Количество голосов Кинопоиск:
Количество голосов Imdb: 228747
tags:
  - movies
Жанр:
  - Horror
  - Mystery
Релиз: 2022-03-17
Время: 105 min
Режисер:
  - Ti West
Актеры:
  - Brittany Snow
  - Bryony Skillington
  - Geoff Dolan
  - James Gaylyn
  - Jenna Ortega
  - Kid Cudi
  - Martin Henderson
  - Matthew J. Saville
  - Mia Goth
  - Owen Campbell
  - Simon Prast
  - Stephen Ure
  - Suyash Pachauri
Описание: 1979 год, Техас. Компания из шести человек арендует небольшой дом у пожилой пары фермеров, чтобы снимать фильм для взрослых. Хотя хозяин недвижимости сразу предупреждает, чтобы приезжие не шумели и вели себя прилично, продюсер, разумеется, пренебрегает его просьбой. Вскоре выяснится, что старички не такие безобидные, как казалось на первый взгляд.
imdb Id: tt13560574
poster: https://m.media-amazon.com/images/M/MV5BODUwYTNhMTMtYWQ5Ny00YTdmLWIxOTAtNDczNzVlYzg2NDFkXkEyXkFqcGc@._V1_SX300.jpg
Роли актеров:
  - Brittany Snow
  - Bryony Skillington
  - Geoff Dolan
  - James Gaylyn
  - Jenna Ortega
  - Kid Cudi
  - Martin Henderson
  - Matthew J. Saville
  - Mia Goth
  - Owen Campbell
  - Simon Prast
  - Stephen Ure
  - Suyash Pachauri
Кинопоиск ID: "4382899"
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

---
![](https://m.media-amazon.com/images/M/MV5BODUwYTNhMTMtYWQ5Ny00YTdmLWIxOTAtNDczNzVlYzg2NDFkXkEyXkFqcGc@._V1_SX300.jpg)
