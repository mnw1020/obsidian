---
Название: "Project Power"
Основная карточка: "Кино/Проект Power.md"
imdb Id: "tt7550000"
Кинопоиск ID: "1190299"
Жанр: ["Sci-Fi","Action"]
Режисер: ["Ariel Schulman","Henry Joost"]
Актеры: ["Aaron Mitchell","Allen Maldonado","Amy Landecker","Andrene Ward-Hammond","Askia Bennett","Austin David Jones","Azhar Khan","Brian Held Jr.","C.J. LeBlanc","Carli McIntyre","Casey Neistat","CG Lewis","Chad Governale","Chika","Chip Carriere","Christopher Winchester","Colson Baker","Cory DeMeyers","Courtney B. Vance","Dane Rhodes","David Merriam","Dominique Fishback","Ethan Airhart","Gordon Dexheimer","Gregory Hobson","Jackie Jenkins Jr.","Jamie Foxx","Janet Rose Nguyen","Jazzy De Lisser","Jeanine Stander","Jelani Jeffries","Jim Klock","Jon Eyez","Joseph Gordon-Levitt","Joseph Poliquin","Keyana Rodney","Kim Baptiste","Kyanna Simone","Lenita Harris","Leopard Larry","Luke Hawx","Marjorie Parker","Michael Thomas","Michael Wozniak","Michelle Torres","Mike R. Moreau","Mike Seal","Mouche","Nile Memmezzwattay","Paul A Eubanks","Peter Jaymes Jr.","Rajko Scarabin","Rodrigo Santoro","Rose Bianco","Ruth O'Connor","Sam Malone","Sherry Kaye Pierre","Sienna Jeffries","Suzette Lange","Tait Fletcher","Terrell Batiste","Theodus Crane","Toney Chapman Steele","Tony DeMil","Wild Wayne","Yoshi Sudarso"]
Роли актеров: ["Akeela - Chika","Armored Truck Guard - Chip Carriere","Armored Truck Guard - Paul A Eubanks","Art - Jamie Foxx","Bicyclist - Ethan Airhart","Biggie - Rodrigo Santoro","Biggie's Assistant - Carli McIntyre","Black Suit Man - David Merriam","Bouncer - Luke Hawx","Candy aka Frozen Woman - Jazzy De Lisser","Captain Craine - Courtney B. Vance","Church's Chicken Server - Marjorie Parker","Cop - Lenita Harris","Cuello (Healer) - Azhar Khan","Deli Girl - Janet Rose Nguyen","Drummer Boy - Mouche","Elevator Bouncer - Sam Malone","EMT - Sherry Kaye Pierre","Frank - Joseph Gordon-Levitt","Gardner - Amy Landecker","Gate Guard - Jon Eyez","Grandfather - Gordon Dexheimer","Griff aka Camouflage Man - Cory DeMeyers","Guard Supervisor - Rajko Scarabin","Indo - Joseph Poliquin","Irene - Andrene Ward-Hammond","Jack - Jackie Jenkins Jr.","Knifebones - Yoshi Sudarso","Landry - Allen Maldonado","Leopard Larry - Leopard Larry","Little Kid 1 - Nile Memmezzwattay","Little Kid 2 - Austin David Jones","Looper - Jelani Jeffries","Looper - Sienna Jeffries","Matriarch - Rose Bianco","Med Tech - Peter Jaymes Jr.","Meme - Jeanine Stander","Miggs - C.J. LeBlanc","Military - Gregory Hobson","Moto - Casey Neistat","Newscaster - Kim Baptiste","Newt - Colson Baker","NOPD Detective - Toney Chapman Steele","Officer - Keyana Rodney","Orderly - Theodus Crane","Pedestrian - Brian Held Jr.","Robin - Dominique Fishback","Robin's Classmate - Askia Bennett","Scary Guard - Tony DeMil","School Principal - Michael Wozniak","Security Officer - Michael Thomas","Ship Captain - Dane Rhodes","Squatter at abandoned projects - Ruth O'Connor","Taylor - Mike Seal","Teacher - Jim Klock","Teacher - Suzette Lange","Telios Guard - Aaron Mitchell","Telios Guard - Chad Governale","Telios Guard - Mike R. Moreau","Telios Med Tech - Michelle Torres","Terrell - Terrell Batiste","Tommy - CG Lewis","Tracy - Kyanna Simone","Wallace - Tait Fletcher","Wallace Guard 1 - Christopher Winchester","Wild Wayne - Wild Wayne"]
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

