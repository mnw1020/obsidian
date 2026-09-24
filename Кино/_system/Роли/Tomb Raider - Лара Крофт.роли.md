---
Название: "Tomb Raider"
Основная карточка: "[[Кино/Tomb Raider - Лара Крофт.md]]"
imdb Id: "tt1365519"
Кинопоиск ID: "446136"
Жанр: ["Fantasy"]
Режисер: ["Roar Uthaug"]
Актеры: ["Adrian Collins","Alex Jaep","Alexandre Willaume","Alicia Vikander","Alwyn Marx","Andrian Mazive","Andy Mihalache","Annabel Elizabeth Wood","Antonio Aakeel","Bernardo Santos","Billy Postlethwaite","Brendan McCoy","Celina Nessa","Civic Chung","Conny Stadler","Dan Burns","Daniel Wu","Derek Jacobi","Dominic West","Doug Berry","Duncan Airlie James","Ekran Mustafa","Elena Valdameri","Emily Carey","Eric Coco","Felix Orion","Francois Groenewald","Gintare Beinoraviciute","Gordon Chow","Hannah John-Kamen","Jaime Winstone","James Heron","James Pimenta","Jandre le Roux","Josef Altin","Kateryna Globa","Keenan Arrison","Kenneth Fok","Kristin Scott Thomas","Maisy De Freitas","Marian Lorencik","Maruwan Gasant","Matteo Paciletti","Michael Chapman","Michael Obiora","Michael Thyx","Milton Schorr","Nick Frost","Peter Waison","Phelim Kelly","Rae Lim","Raj Awasti","Rekha John-Cheriyan","Roger Jean Nsengiyumva","Rowan Polonski","Samuel Mak","Shekhar Varma","Sky Yang","Steve Broad","Tamer Burjaq","Vash Singh","Vere Tindale","Vinita Petrus","Walton Goggins"]
Роли актеров: ["Alan - Pawnbroker - Nick Frost","Ana Miller - Kristin Scott Thomas","Baxter - Michael Obiora","Biker - Eric Coco","Bill - Billy Postlethwaite","Boxing Trainer - Brendan McCoy","Bruce the Boss - Josef Altin","Bus Passenger - Elena Valdameri","Bus Passenger - James Heron","Business Executive - Andy Mihalache","Businessman - Alex Jaep","Businessman - Doug Berry","Businessman - James Pimenta","Businessman - Michael Chapman","Businessman - Phelim Kelly","Businessman - Raj Awasti","Businessman - Steve Broad","Chinese Kid - Civic Chung","Chinese Kid - Samuel Mak","Chinese Kid - Sky Yang","City Worker - Marian Lorencik","City Worker - Matteo Paciletti","Cyclist - Celina Nessa","Digger - Vash Singh","Digger in Camp - Maruwan Gasant","Digger in Woods - Kenneth Fok","Girl - Conny Stadler","Heli Co-Pilot - Vere Tindale","Heli Pilot - Jandre le Roux","Himiko's Grave Worshipper - Rae Lim","Lara Croft - Alicia Vikander","Lara's Flatmate - Dan Burns","Lara's Flatmate - Rowan Polonski","Lieutenant - Alexandre Willaume","Lu Ren - Daniel Wu","Mathias Vogel - Walton Goggins","Mercenary - Adrian Collins","Mercenary - Alwyn Marx","Mercenary - Andrian Mazive","Mercenary - Francois Groenewald","Mercenary - Keenan Arrison","Mercenary - Milton Schorr","Mercenary - Tamer Burjaq","Mercenary - Vinita Petrus","Mr. Ahuja - Shekhar Varma","Mr. Yaffe - Derek Jacobi","Mrs. Ahuja - Rekha John-Cheriyan","Nitin - Antonio Aakeel","Nomad Park Goer - Gintare Beinoraviciute","Pamela - Jaime Winstone","Passerby - Ekran Mustafa","Police Officer - Bernardo Santos","Police Officer - Felix Orion","Policeman - Michael Thyx","Restaurant Guest - Kateryna Globa","Richard Croft - Dominic West","Rog - Roger Jean Nsengiyumva","Rose - Annabel Elizabeth Wood","Sickly Old Digger - Gordon Chow","Sophie - Hannah John-Kamen","Taxi Driver - Peter Waison","Terry - Trainer - Duncan Airlie James","Young Lara - 14 Years Old - Emily Carey","Young Lara - 7 Years Old - Maisy De Freitas"]
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

