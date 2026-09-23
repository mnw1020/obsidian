---
Название: "El Camino: A Breaking Bad Movie"
Основная карточка: "Кино/El Camino - Фильм по мотивам сериала 'Во все тяжкие'.md"
imdb Id: "tt9243946"
Кинопоиск ID: "1209193"
Жанр: ["Drama","Crime"]
Режисер: ["Vince Gilligan"]
Актеры: ["Aaron Paul","Alison Law","Brendan Sexton III","Bryan Cranston","Carlos Sepulveda","Charles Baker","Chris Bylsma","Cody Renee Cameron","Danielle Todesco","David Mattey","Gabriela Alicia Ortega","Gloria Sandoval","Gregory Steven Soliz","Jesse Plemons","Johnny Ortiz","Jonathan Banks","Julie Pearl","Kevin Rankin","Krysten Ritter","Larry Hankin","Marla Gibbs","Matt Jones","Matthew Van Wettering","Michael Bofshever","Robert Forster","Scott MacArthur","Scott Shepherd","Simon Drobik","Tess Harper","Todd Terry","Tom Bower","Yvette Fazio-Delaney"]
Роли актеров: ["ADA Suzanne Ericsen - Julie Pearl","April - Gabriela Alicia Ortega","Badger - Matt Jones","Busboy - Johnny Ortiz","Candy - Cody Renee Cameron","Casey - Scott Shepherd","Clarence - David Mattey","Colin - Matthew Van Wettering","Ed - Robert Forster","Jane - Krysten Ritter","Jean - Marla Gibbs","Jesse - Aaron Paul","Kenny - Kevin Rankin","Kyle - Brendan Sexton III","Lou - Tom Bower","Mike - Jonathan Banks","Mr. Pinkman - Michael Bofshever","Mrs. Pinkman - Tess Harper","Neil - Scott MacArthur","Officer - Carlos Sepulveda","Old Joe - Larry Hankin","Reporter - Danielle Todesco","SAC Ramey - Todd Terry","Sean - Chris Bylsma","Senior Officer - Simon Drobik","Skinny Pete - Charles Baker","Sonia - Gloria Sandoval","Timelapse driver - Yvette Fazio-Delaney","Todd - Jesse Plemons","TV News Anchor - Gregory Steven Soliz","Walt - Bryan Cranston","Wanda - Alison Law"]
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

