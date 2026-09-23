---
Название: "Doom"
Основная карточка: "Кино/Doom.md"
imdb Id: "tt0419706"
Кинопоиск ID: "84140"
Жанр: ["Sci-Fi"]
Режисер: ["Andrzej Bartkowiak"]
Актеры: ["Al Weaver","Barbara Nedeljakova","Ben Daniels","Blanka Jarosova","Brian Steele","Daniel York Loh","Deobia Oparei","Dexter Fletcher","Doug Jones","Dwayne Johnson","Ian Hughes","Jaroslav Pšenička","Karl Urban","Marek Motlicek","Petr Hnetkovský","Rana Morrison","Razaaq Adoti","Richard Brake","Robert Nelson","Robert Russell","Rosamund Pike","Sara Houghton","Tanoai Reed","Vladislav Dyntera","Yao Chin"]
Роли актеров: ["Dead Scientist Shot - Tanoai Reed","Destroyer - Deobia Oparei","Dr. Carmack - Robert Russell","Dr. Carmack Imp / Sewer Imp - Doug Jones","Dr. Clay - Marek Motlicek","Dr. Hillary Tallman / Imp - Blanka Jarosova","Dr. Jenna Willits - Sara Houghton","Dr. Olsen - Petr Hnetkovský","Dr. Steve Willits - Vladislav Dyntera","Dr. Thurman - Jaroslav Pšenička","Duke - Razaaq Adoti","Female Evacuee - Rana Morrison","Girl at Bar - Barbara Nedeljakova","Goat - Ben Daniels","Hell Knight - Brian Steele","John Grimm - Karl Urban","Lt. Hunegs - Daniel York Loh","Mac - Yao Chin","Pinky - Dexter Fletcher","Portman - Richard Brake","Samantha Grimm - Rosamund Pike","Sanford Crosby - Ian Hughes","Sarge - Dwayne Johnson","Security Guard - Robert Nelson","The Kid - Al Weaver"]
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

