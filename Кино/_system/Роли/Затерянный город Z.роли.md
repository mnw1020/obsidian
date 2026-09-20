---
Название: "The Lost City of Z"
Основная карточка: "Кино/Затерянный город Z.md"
imdb Id: "tt1212428"
Кинопоиск ID: "432794"
Жанр: ["Adventure"]
Режисер: ["James Gray"]
Актеры: ["Aaron Hartley","Aaron Rolph","Adam Bellamy","Adam Siviter","Aleksandar Jovanovic","Andrew McNeill","Angus Macfadyen","Anthony Boyle","Bethan Coomber","Bill Hurst","Bobby Smalldridge","Brian Matthews Murphy","Charlie Hunnam","Chrissie Harris","Clive Francis","Colin Carnegie","Corey Millar","Daniel Huttlestone","David Calder","David Coon","Derek Dubery","Derek Mayne","Devlin Lloyd","Edward Ashley","Elena Solovey","Fernando Vigui","Francisco Gaspar","Franco Nero","Frank Cannon","Frank Clem","Gary Crossan","Gustavo Duque","Harry Melling","Hugh Irvine","Ian McDiarmid","Jack Dawson","Johann Myers","John Sackville","Jose Pereira","Mark Joslin","Mark Quigley","Matthew Cassidy","Matthew McMillan","Matthew Sunderland","Michael Ford-FitzGerald","Michael Jenn","Michael McLaughlin","Murray Melvin","Nathaniel Bates Fisher","Neil Bromley","Niall Cusack","Nicholas Agnew","Nick Sampson","Nickolas Grace","Pat Mooney","Patrick McBrearty","Pedro Coello","Raquel Arraes","Richard Croxford","Robert Fawsitt","Robert Pattinson","Ruairí Heading","Sanjay Ghosh","Shane McNaughton","Sienna Miller","Siennah Buck","Simon Millar","Stacy Shane","Stuart Bradford","Tamsin Greene Barker","Tom Holland","Tom Mulheron","Tyrone Kearns"]
Роли актеров: ["American Reporter - Stacy Shane","Archduke Franz Ferdinand - Brian Matthews Murphy","Arthur Manley - Edward Ashley","Ballroom Dancer - Adam Siviter","Ballroom Dancer - Stuart Bradford","Baron De Gondoriz - Franco Nero","Bolivian Lady - Raquel Arraes","Brian Fawcett (15 Yr Old) - Daniel Huttlestone","Brian Fawcett (7 Yr Old) - Nathaniel Bates Fisher","Brig. Gen. Thorton - Michael Jenn","British Army Bombardier - Jack Dawson","British Soldier - Aaron Hartley","British Soldier - Andrew McNeill","British Soldier - Mark Quigley","British Soldier - Matthew McMillan","British Soldier - Michael McLaughlin","Butcher - Derek Mayne","Cecil Gosling - Adam Bellamy","Chief Guarayo - Jose Pereira","Crew Member - Francisco Gaspar","Crew Member - Gustavo Duque","Dan - Matthew Sunderland","Dancer - Mark Joslin","Diminutive Latino Man - Fernando Vigui","Doctor - Nick Sampson","Henry Costin - Robert Pattinson","Hunt Leader - Michael Ford-FitzGerald","Hunter Soldier - Matthew Cassidy","Jack Fawcett - Tom Holland","Jack Fawcett (3 Yr Old) - Tom Mulheron","Jack Fawcett (7 Yr Old) - Bobby Smalldridge","James Murray - Angus Macfadyen","Joan Fawcett (7 Yr Old) - Bethan Coomber","John Coundley - Nicholas Agnew","Lord James Bernard - Murray Melvin","Lord Lillis - Derek Dubery","Madame Kumel - Elena Solovey","Man on Docks - Tyrone Kearns","Minister baptising Jack - Nickolas Grace","Nina Fawcett - Sienna Miller","Noblewoman - Tamsin Greene Barker","Officer Thomas Busby - Richard Croxford","Other Soldier 1 - Ruairí Heading","Peasant Child - Siennah Buck","Percy Fawcett - Charlie Hunnam","Prostitute - Chrissie Harris","Random Man at Port - Robert Fawsitt","Random Man At Port - Shane McNaughton","Random Scientist - Niall Cusack","Random Scientist 2 - Colin Carnegie","Random Scientist 3 - Pat Mooney","Random Scientist 4 - David Coon","Reporter 1 - Bill Hurst","Reporter 2 - Neil Bromley","RGS Member - Frank Cannon","RGS Member - Hugh Irvine","Savage Club Waiter - Devlin Lloyd","Secretary Bryce - David Calder","Simon Beauclerk - John Sackville","Sir George Goldie - Ian McDiarmid","Sir John Scott Keltie - Clive Francis","Soldier - Corey Millar","Soldier - Sanjay Ghosh","Soldier - Simon Millar","Tadjui - Pedro Coello","Texan Gunman - Frank Clem","Trench Runner - Anthony Boyle","Urquhart - Aleksandar Jovanovic","Waiter @ Savage Club - Gary Crossan","Whipping Officer - Patrick McBrearty","William Barclay - Harry Melling","Willis - Johann Myers","WWI Captain - Aaron Rolph"]
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

