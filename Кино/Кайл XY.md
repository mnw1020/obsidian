---
Название: Kyle XY
Просмотрено: 2014-08-11
Оценка: "8"
Оценка Imdb: "7.4"
Оценка Кинопоиск: 7.6
Количество голосов Кинопоиск: 11863
Количество голосов Imdb: 52
tags:
  - serial
Жанр:
  - Sci-Fi
Релиз: 2006-01-01
Время: 43 min
Режисер:
  - Tony Dow
Актеры:
  - Alan David
  - David Ross
  - Ella Kenion
  - Ivan Kaye
  - Jack Doolan
  - John Challis
  - Peter Heppelthwaite
  - Sue Holderness
Описание: Окружённый тайной, Кайл смотрит на мир глазами новорожденного ребёнка, увидит ли он, что опасности постоянно будут встречаться на его пути.Кайл приходит в себя посреди леса. Он не знает кто он, откуда, как сюда попал. На первой же минуте его новой (новой ли) жизни он встречается лицом к лицу с гремучей змеёй. Он не умеет говорить, есть, пить, спать. Он не умеет ничего. Он - новорожденный. Кроме всего прочего у него нет пупка.Кайл попадает в семью, где его окружают заботой и вниманием, но вокруг столько непонимания и опасностей.Его никто не ищет, но за ним следят.
imdb Id: tt0756500
poster: https://m.media-amazon.com/images/M/MV5BNjlmNDU4ZWYtZDZjNy00OTA0LWFiOGQtYzRmMDc2MmRiNzdmXkEyXkFqcGc@._V1_.jpg
Роли актеров:
  - Boycie - John Challis
  - Bryan - Ivan Kaye
  - Elgin - David Ross
  - Jed - Peter Heppelthwaite
  - Llewellyn - Alan David
  - Marlene - Sue Holderness
  - Mrs. Cakeworthy - Ella Kenion
  - Tyler - Jack Doolan
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
![](https://m.media-amazon.com/images/M/MV5BNjlmNDU4ZWYtZDZjNy00OTA0LWFiOGQtYzRmMDc2MmRiNzdmXkEyXkFqcGc@._V1_.jpg)
