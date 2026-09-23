---
Название: "Project X"
Основная карточка: "Кино/Проект X - Дорвались.md"
imdb Id: "tt1636826"
Кинопоиск ID: "507440"
Жанр: ["Comedy"]
Режисер: ["Nima Nourizadeh"]
Актеры: ["Alexis Knapp","Allan Chanes","Andrew Harbour","Ayydé Vargas","Big Boy","Brady Hender","Brendan Miller","Brent Tarnol","Briana Mari Wilde","Caitlin Dulany","Catherine Lidstone","Chelsea Rutland","Chet Hanks","Chic Daniels","Ciara Hanna","Colleen Flynn","David Sanchez","Dax Flame","Donat","Frank Buckley","Gene 'Bean' Baxter","Henry Michaelson","Holden Morse","Jarod Einsohn","Jesse Marco","Jillian Barberie","Jimmy Kimmel","Jodi Harris","Jonathan Daniel Brown","Julian Evens","Kevin Dunigan","Kevin Ryder","Kirby Bliss Blanton","Kyle Kwasnick","Martin Klebba","Max Kronick","Michael C. Stretton","Miles Teller","Nichole Sakura","Nick Nervies","Oliver Cooper","Patrick Phan","Pete Gardner","Peter Mackenzie","Raz Gouneili","Rick Shapiro","Rob Evors","Robb Reesman","Rory Kelly","Sam Lant","Serene Branson","Sophia Santi","Sunshine Manderbach Johnson","Thai Fong","Thomas Mann","Vince Tomas","Zach Lasry"]
Роли актеров: ["Alexis - Alexis Knapp","Angry Little Person - Martin Klebba","Bean - Gene 'Bean' Baxter","Big Boy - Big Boy","Brendan - Brendan Miller","Channel 6 Reporter - Frank Buckley","Channel 8 Reporter - Serene Branson","Costa - Oliver Cooper","Dad - Peter Mackenzie","Dax - Dax Flame","DJ - Jesse Marco","Ecstasy Girl - Ciara Hanna","Everett - Brady Hender","Freshman Party Crasher - Henry Michaelson","Freshman Party Crasher - Sam Lant","Gym Class Girl / Popsicle Girl - Sunshine Manderbach Johnson","High School Student - Allan Chanes","High School Student - Andrew Harbour","High School Student - Ayydé Vargas","High School Student - Chelsea Rutland","High School Student - David Sanchez","High School Student - Holden Morse","High School Student - Michael C. Stretton","High School Student - Zach Lasry","Hippy Guy with Guitar - Max Kronick","Hispanic Neighbor - Sophia Santi","JB - Jonathan Daniel Brown","JB's Girl - Nichole Sakura","Jillian Barberie - Jillian Barberie","Jimmy Kimmel - Jimmy Kimmel","Kevin - Kevin Ryder","Kirby - Kirby Bliss Blanton","Locker Room Guy - Brent Tarnol","Locker Room Guy - Kyle Kwasnick","Locker Room Guy - Thai Fong","Miles - Miles Teller","Mom - Caitlin Dulany","Mrs. Stillson - Colleen Flynn","Older Guy - Pete Gardner","Older Guy's Wife - Jodi Harris","Party Goer - Briana Mari Wilde","Party Goer - Catherine Lidstone","Party Goer - Chet Hanks","Party Goer - Jarod Einsohn","Party Goer - Julian Evens","Party Goer - Patrick Phan","Party Goer - Raz Gouneili","Party Goer - Rory Kelly","Party Goer - Vince Tomas","Party Jock - Donat","Police Captain - Robb Reesman","Police Officer - Chic Daniels","Police Officer - Kevin Dunigan","Rob - Rob Evors","T-Rick - Rick Shapiro","Thomas - Thomas Mann","Tyler - Nick Nervies"]
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

