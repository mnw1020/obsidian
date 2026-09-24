---
Название: "Happy End"
Основная карточка: "[[Кино/Happy End.md]]"
imdb Id: "tt12908084"
Кинопоиск ID: "1328036"
Жанр: ["Drama"]
Режисер: ["Evgeniy Sangadzhiev"]
Актеры: ["Aleksandr Gorchilin","Aleksandra Rebenok","Aleksey Agranovich","Aleksey Makarov","Daniil Vorobyov","Daniyar Alshinov","Darya Feklenko","Denis Vlasenko","Jonathan Salway","Lena Tronina","Lukerya Ilyashenko","Lyubov Tolkalina","Maksim Karushev"]
Роли актеров: ["British Businessman - Jonathan Salway","Dmitry - Aleksey Makarov","Edik - Daniil Vorobyov","Lera - Lena Tronina","Lera's dad - Aleksey Agranovich","Lera's mom - Darya Feklenko","Max / Vlad's friend - Aleksandr Gorchilin","Polina - Lyubov Tolkalina","Polina's friend - Aleksandra Rebenok","Polina's son / Rusik - Maksim Karushev","Shona - Daniyar Alshinov","Vlad - Denis Vlasenko","Yana - Lukerya Ilyashenko"]
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
