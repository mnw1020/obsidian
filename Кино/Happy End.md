---
Название: Happy End
Просмотрено: 2023-02-03
Оценка: "8"
Оценка Imdb: "7.1"
Оценка Кинопоиск:
Количество голосов Кинопоиск:
Количество голосов Imdb: 851
tags:
  - serial
Жанр:
  - Drama
Релиз: 2021-04-01
Время: 38 min
Режисер:
  - Evgeniy Sangadzhiev
Актеры:
  - Aleksandr Gorchilin
  - Aleksey Agranovich
  - Daniil Vorobev
  - Darya Feklenko
  - Denis Vlasenko
  - Dmitriy Mulyar
  - Evgeniya Afonskaya
  - Gosha Kutsenko
  - Lena Tronina
  - Lukerya Ilyashenko
  - Lyubov Tolkalina
  - Maksim Karushev
  - Margarita Abroskina
  - Nikolay Shrayber
  - Oksana Streltsova
  - Pavel Tabakov
  - Petr Skvortsov
  - Safiya Yarullina
  - Stasya Miloslavskaya
  - Yuliya Temnaya
Описание: "Попасть в мир Webcam просто: достаточно нажать кнопку REC. в своем мобильном и начать снимать. С такого видео и начинается карьера 19-летних Леры и Влада, которые в поисках лучшей жизни и легких денег приходят к неожиданному решению — вебкам. Они совсем не подходят друг другу, их характеры противоположны, а ценности не совпадают: Лера — безрассудная оторва, которая легко идет по головам, Влад — замкнутый умник, готовый на все ради подруги. Но странным образом они дополняют друг друга, и, вместе преодолевая препятствия на пути к успеху, взрослеют и становятся все ближе.Но можно ли сохранить любовь, когда вся твоя личная жизнь — сплошное порно?"
imdb Id: tt12908084
poster: https://m.media-amazon.com/images/M/MV5BOWE4MDI4ZDQtZDM0NC00MzgyLWFiNzItY2EyZTI3NjIxM2QxXkEyXkFqcGc@._V1_SX300.jpg
Роли актеров:
  - Dmitriy Mulyar
  - Gosha Kutsenko
  - Margarita Abroskina
  - Nikolay Shrayber
  - Oksana Streltsova
  - Petr Skvortsov
  - Stasya Miloslavskaya
  - Варя - Yuliya Temnaya
  - Влад - Denis Vlasenko
  - Влад - Pavel Tabakov
  - Лера - Lena Tronina
  - Лера - Safiya Yarullina
  - Макс - Aleksandr Gorchilin
  - мама Леры - Darya Feklenko
  - папа Леры - Aleksey Agranovich
  - Полина - Lyubov Tolkalina
  - Русик - Maksim Karushev
  - старшая сестра Влада - Evgeniya Afonskaya
  - Эдик - Daniil Vorobev
  - Яна - Lukerya Ilyashenko
Кинопоиск ID: "1328036"
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
![](https://m.media-amazon.com/images/M/MV5BOWE4MDI4ZDQtZDM0NC00MzgyLWFiNzItY2EyZTI3NjIxM2QxXkEyXkFqcGc@._V1_SX300.jpg)
