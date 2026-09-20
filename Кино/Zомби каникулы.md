---
Название: Zомби каникулы
Просмотрено: 2013-10-09
Оценка: "1"
Оценка Imdb: "2.1"
Оценка Кинопоиск: 1.5
Количество голосов Кинопоиск: 15350
Количество голосов Imdb: 549
tags:
  - movies
Жанр:
  - Comedy
  - Horror
Релиз: 2013-08-15
Время: 95 min
Режисер:
  - Kirill Kemnits
Актеры:
  - Aleksandr Efremov
  - Alexander Leventschuk
  - Anton Zinovev
  - Darya Torchilina
  - Dasha Chagall
  - Denis Moiseychik
  - George W. Bush
  - Mikhail Efremov
  - Valeriy Shushkevich
  - Valeriy Zelenskiy
  - Violetta Nesterovich
  - Yuliya Volkova
Описание: Группа молодых людей собирается на главную тусовку лета. Как и полагается, подготовка идёт полным ходом, но никто не догадывается, что судьба готовит им совершенно другую программу на афтепати. Оказавшись в эпицентре зомбоапокалипсиса, друзья обнаруживают, что «ходячие» охотятся только за теми, кто испытывает страх…
imdb Id: tt3039378
poster: https://m.media-amazon.com/images/M/MV5BZWU0NTRmMmYtNDA0Ni00ZmE1LTlmMWYtN2Y1NGRhNDNiMTI5XkEyXkFqcGc@._V1_.jpg
Роли актеров:
  - Chieff - Valeriy Shushkevich
  - Dasha - Violetta Nesterovich
  - Final Zombiehunter - George W. Bush
  - Ivan - Anton Zinovev
  - Kostya - Aleksandr Efremov
  - Natasha - Yuliya Volkova
  - Peter - Alexander Leventschuk
  - Professor Dudikov - Mikhail Efremov
  - Sanya - Valeriy Zelenskiy
  - Vadim - Denis Moiseychik
  - Victoria - Dasha Chagall
  - Vika - Darya Torchilina
Кинопоиск ID: "659213"
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
![](https://m.media-amazon.com/images/M/MV5BZWU0NTRmMmYtNDA0Ni00ZmE1LTlmMWYtN2Y1NGRhNDNiMTI5XkEyXkFqcGc@._V1_.jpg)
