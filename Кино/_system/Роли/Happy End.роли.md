---
Название: "Happy End"
Основная карточка: "Кино/Happy End.md"
imdb Id: "tt12908084"
Кинопоиск ID: "1328036"
Жанр: ["Drama"]
Режисер: ["Evgeniy Sangadzhiev"]
Актеры: ["Aleksandr Gorchilin","Aleksey Agranovich","Daniil Vorobev","Darya Feklenko","Denis Vlasenko","Dmitriy Mulyar","Evgeniya Afonskaya","Gosha Kutsenko","Lena Tronina","Lukerya Ilyashenko","Lyubov Tolkalina","Maksim Karushev","Margarita Abroskina","Nikolay Shrayber","Oksana Streltsova","Pavel Tabakov","Petr Skvortsov","Safiya Yarullina","Stasya Miloslavskaya","Yuliya Temnaya"]
Роли актеров: ["Dmitriy Mulyar","Gosha Kutsenko","Margarita Abroskina","Nikolay Shrayber","Oksana Streltsova","Petr Skvortsov","Stasya Miloslavskaya","Варя - Yuliya Temnaya","Влад - Denis Vlasenko","Влад - Pavel Tabakov","Лера - Lena Tronina","Лера - Safiya Yarullina","Макс - Aleksandr Gorchilin","мама Леры - Darya Feklenko","папа Леры - Aleksey Agranovich","Полина - Lyubov Tolkalina","Русик - Maksim Karushev","старшая сестра Влада - Evgeniya Afonskaya","Эдик - Daniil Vorobev","Яна - Lukerya Ilyashenko"]
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

