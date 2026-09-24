---
Название: "Zombieland: Double Tap"
Основная карточка: "[[Кино/Zомбилэнд - Контрольный выстрел.md]]"
imdb Id: "tt1560220"
Кинопоиск ID: "489414"
Жанр: ["Action"]
Режисер: ["Ruben Fleischer"]
Актеры: ["Abigail Breslin","Al Roker","Andrew R. McCallister","Anthony Dilio","Ari Loeb","Avan Jogia","Bill Murray","Brianna Gardner","David Fleischer","Devin Mojica","Emma Stone","Evan J. Mackey","Felix Betancourt","Gianni Biasetti Jr.","Grace Randolph","Heng Theng","Ian Gregg","Isabelle Fretheim","Jason M. White","Jenin Gonzalez","Jess Durham","Jesse Eisenberg","Jessica Medina","John Dixon","Josh Horowitz","Julia Vasi","Julian B Lin","Kandis Hargrave","Kyra Elise Gardner","Lewis Wright","Lili Estefan","Louie g Maldonado","Lucas Fleischer","Luke Endyan","Luke Wilson","Michael A. Martinez","MWW Michael Wilkerson","Nathan W. Collins","NeShaunda Mays","Oscar Rodriguez III","Rachel Luttrell","Ronny Mathew","Rosario Dawson","Ruben Vidal","Sergio Briones","Thomas Middleditch","Tim McAdams","Timothy Carr","Victor Rivera","Victoria Hall","Woody Harrelson","Zara McDowell","Zoey Deutch"]
Роли актеров: ["Albuquerque - Luke Wilson","Arcade Employee - Heng - Heng Theng","Babylonian Gatekeeper - Victoria Hall","Beatrix Hawking - Jess Durham","Berkeley - Avan Jogia","Bill Murray - Bill Murray","Bowel Blast Guy - Ian Gregg","Cameraman - Tim McAdams","Civil War Bearded Guy - Victor Rivera","Columbus - Jesse Eisenberg","Cool Hat Guy - Devin Mojica","Dave Sanderman - Lucas Fleischer","Dept. Store Female Zombie - Kandis Hargrave","Exoculated Scientist - David Fleischer","Flagstaff - Thomas Middleditch","Haybale Z - Gianni Biasetti Jr.","Homer Zombie in Snow - John Dixon","Hotel Guest - Isabelle Fretheim","Indian Poker Player - Ruben Vidal","Little Rock - Abigail Breslin","Madison - Zoey Deutch","Matteo Bianchi - Anthony Dilio","Nevada - Rosario Dawson","Ninja Zombie - Felix Betancourt","Publicist - Julia Vasi","Reporter - Al Roker","Reporter - Grace Randolph","Reporter - Josh Horowitz","Reporter - Lili Estefan","Scared Lab Tech - Ronny Mathew","Straggler Zombie - Louie g Maldonado","Survivor with Flashlight - Jenin Gonzalez","T-800 - Sergio Briones","T-800 Attack Zombie - Brianna Gardner","T-800 Attack Zombie - Kyra Elise Gardner","T-800 Z - Ari Loeb","T-800 Zombie - Evan J. Mackey","T-800 Zombie - Julian B Lin","T-800 Zombie - Luke Endyan","T-800 Zombie - MWW Michael Wilkerson","T-800 Zombie - NeShaunda Mays","T-800 Zombie - Timothy Carr","T800 - Andrew R. McCallister","Tallahassee - Woody Harrelson","Terrified Woman in Snow - Rachel Luttrell","White House Zombie - Jason M. White","White House Zombie - Jessica Medina","White House Zombie - Michael A. Martinez","Wichita - Emma Stone","Zombie - Lewis Wright","Zombie - Nathan W. Collins","Zombie - Zara McDowell","Zombie / T800 - Oscar Rodriguez III"]
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

