---
Название: "Rob the Mob"
Основная карточка: "Кино/Гангста Love.md"
imdb Id: "tt2481480"
Кинопоиск ID: "714718"
Жанр: ["Biography"]
Режисер: ["Raymond De Felitta"]
Актеры: ["Aida Turturro","Aimee Mullins","Ally Jones","Andy Garcia","Anthony Vincent","Bernie Rachelle","Bill Raymond","Brian Distance","Brian Tarantina","Bruce Altman","Burt Young","Cathy Moriarty","Charles Marti","Christine Vienna","Danielle Montezinos","Doug Drucker","Elli","Frank Whaley","Gaetano LoGiudice","Garry Pastore","Gilbert Soto","Giuseppe Ardizzone","Griffin Dunne","Ivy Jones","James Morricone","Jeff Roches","Jeremy Allen White","Joe Drago","John Buscemi","John Tormey","Joseph R. Gannascoli","Kevin Bielinski","Lorenzo De Felitta","Lou Irizarry","Luke Fava","Maria Di Angelis","Marshall Efron","Matthew Sean Blumm","Michael A. Russo","Michael Pitt","Michael Quinlan","Michael Rispoli","Myla Pitt","Nancy Ellen Shore","Nick Addeo","Nina Arianda","Peter Bucossi","Peter Falcetti","Ray Romano","Roger Brenner","Sabrina Iacobellis","Samira Wiley","Santo Fazio","Shawn Gonzalez","Silvestre Rasuk","Teddy Coluca","Terry Marks","Tony Vincent","Vava Buitenkant","Vincent Riviezzo","Volieda Webb","Yul Vazquez"]
Роли актеров: ["Agent Annie Bell - Samira Wiley","Agent Frank Hurd - Frank Whaley","Angelo - Joe Drago","Anna - Aida Turturro","Background - Sabrina Iacobellis","Bailiff - Brian Distance","Bartender Gunman - Nick Addeo","Big Al - Andy Garcia","Carrie - Aimee Mullins","Collection agent - Doug Drucker","Constance Uva - Cathy Moriarty","Courtroom Observer - Nancy Ellen Shore","Dave Lovell - Griffin Dunne","Defense Attorney - Michael Quinlan","Dom - Joseph R. Gannascoli","Fast Freddy - Charles Marti","Frank - Anthony Vincent","Frank Uva - Tony Vincent","Gotti Prosecutor - Bruce Altman","Homeless Man - Silvestre Rasuk","Italian Cashier - Maria Di Angelis","Italian Florist - Ivy Jones","Jerry Cardozo - Ray Romano","Jimmy One Eye - James Morricone","Jimmy One Eye's Enforcer - Peter Bucossi","Jimmy The Cheese - Santo Fazio","Joe Butch - Teddy Coluca","Joey D - Burt Young","Judge Glaser - Bernie Rachelle","Judge Goldberg - Myla Pitt","Jumela - Danielle Montezinos","Junkie - Jeff Roches","Little Anthony - Marshall Efron","Mafia Hoodlum - Gaetano LoGiudice","Mafia Wife - Christine Vienna","Marco - Matthew Sean Blumm","Miss Pussy - Terry Marks","NY Wise Guy - Kevin Bielinski","NY Wise Guy - Michael A. Russo","NY Wiseguy - John Buscemi","NY Wiseguy - Peter Falcetti","NY Wiseguy - Vincent Riviezzo","Pawnbroker - Elli","Pedestrian by Bar - Shawn Gonzalez","Priest - Bill Raymond","Prison guard - Roger Brenner","Ricky Lollipops - John Tormey","Robbie - Luke Fava","Robert Uva - Jeremy Allen White","Ronnie - Brian Tarantina","Rosie - Nina Arianda","Rosie's Lawyer - Gilbert Soto","Sal - Michael Rispoli","Sammy - Garry Pastore","Tommy Uva - Michael Pitt","Union Ave Social Club Member - Giuseppe Ardizzone","Veritas Employee - Volieda Webb","Vinny Gorgeous - Yul Vazquez","Wise Guy at Bar - Lou Irizarry","Yogi Office Colleague - Vava Buitenkant","Young Constance - Ally Jones","Young Tommy - Lorenzo De Felitta"]
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

