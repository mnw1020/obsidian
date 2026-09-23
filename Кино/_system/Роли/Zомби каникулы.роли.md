---
Название: "Zомби каникулы"
Основная карточка: "Кино/Zомби каникулы.md"
imdb Id: "tt3039378"
Кинопоиск ID: "659213"
Жанр: ["Comedy","Horror"]
Режисер: ["Kirill Kemnits"]
Актеры: ["Aleksandr Efremov","Alexander Leventschuk","Anton Zinovev","Darya Torchilina","Dasha Chagall","Denis Moiseychik","George W. Bush","Mikhail Efremov","Valeriy Shushkevich","Valeriy Zelenskiy","Violetta Nesterovich","Yuliya Volkova"]
Роли актеров: ["Chieff - Valeriy Shushkevich","Dasha - Violetta Nesterovich","Final Zombiehunter - George W. Bush","Ivan - Anton Zinovev","Kostya - Aleksandr Efremov","Natasha - Yuliya Volkova","Peter - Alexander Leventschuk","Professor Dudikov - Mikhail Efremov","Sanya - Valeriy Zelenskiy","Vadim - Denis Moiseychik","Victoria - Dasha Chagall","Vika - Darya Torchilina"]
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

