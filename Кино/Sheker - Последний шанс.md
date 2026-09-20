---
Название: Sheker. Poslednij shans
Просмотрено: 2025-01-02
Оценка: "6"
Оценка Imdb: "6.5"
Оценка Кинопоиск: 6.7
Количество голосов Кинопоиск: 72852
Количество голосов Imdb: 32
tags:
  - movies
Жанр:
  - Drama
  - Crime
Релиз: 2024-11-07
Время: 88 min
Режисер:
  - Tulegenov Darkhan
Актеры:
  - Ansar Ilyasov
  - Azat Zhumadil
  - Berik Aytzhanov
  - Gani Kulzhanov
  - Willy Zogo
  - Yerzhan Tusupov
Описание: Алдик и Кана снова в центре рискованного бизнеса. Экшен-продолжение культового сериала. Смотрите онлайн фильм SHEKER. Последний шанс на Кинопоиске.
imdb Id: tt37660303
poster: https://m.media-amazon.com/images/M/MV5BZWIzZjc3ZjEtMDRhZS00YjY4LWI0OGQtODEyYWIwYWZlOWUzXkEyXkFqcGc@._V1_SX300.jpg
Роли актеров:
  - Aldik - Azat Zhumadil
  - Azat - Gani Kulzhanov
  - Berik - Berik Aytzhanov
  - Dauren - Yerzhan Tusupov
  - Kana - Ansar Ilyasov
  - Kidnapper at the airport - Willy Zogo
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
![](https://m.media-amazon.com/images/M/MV5BZWIzZjc3ZjEtMDRhZS00YjY4LWI0OGQtODEyYWIwYWZlOWUzXkEyXkFqcGc@._V1_SX300.jpg)
