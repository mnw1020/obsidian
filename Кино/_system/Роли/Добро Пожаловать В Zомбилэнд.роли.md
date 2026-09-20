---
Название: "Zombieland"
Основная карточка: "Кино/Добро Пожаловать В Zомбилэнд.md"
imdb Id: "tt1156398"
Кинопоиск ID: "427122"
Жанр: ["Action"]
Режисер: ["Ruben Fleischer"]
Актеры: ["Abigail Breslin","Amir Kovacs","Amir R. Khan","Anthony Samples","April Rich","Barry Hopkins","Bill Murray","Blaise Corrigan","Brandon Germaine","Brian Luallen","Brian Stretch","Cameron Jacob Alpert","Carey Beckerdite","Cesar Aguirre","Chris Burns","Christina Klein","Clay Walker","Cody Rowlett","Dalton Cole","Daniel Burnley","Danny Derrick","Darian O'Rear","Derek Graf","Devin Ray","Elle Alexander","Emma Stone","Ernest Dancy","Ernie Hudson","Gilbert Landras","Hunter Aldridge","Jacob G. Akins","Jade Moser","Jeh Howell","Jessalin Torres","Jesse Eisenberg","Joan Schuermeyer","Jon Gould","Justin Price","Kurt McNew","Lynn McArthur","Melanie Booth","Michael August","Michelle Sebek","Mike White","Ming Qiu","Nathan M. Wright","Quinton Campbell","Rhett Reese","Robert Hatch","Scott M. Yaffee","Sean Hilton Stephens","Shaun Lynch","Sonya Thompson","Stephen Prouty","Steve Warren","Steven Stadler","Sydnie Dawson","Tammy Luthi Retzlaff","Travis Grant","Travis Young","Victory Van Tuyl","William Riggs","Woody Harrelson"]
Роли актеров: ["Achilles Business Woman - Ming Qiu","Amusement Park Guest - Carey Beckerdite","Amusement Park Zombie - Danny Derrick","Amusement Park Zombie - Kurt McNew","Amusement Park Zombie - Scott M. Yaffee","Amusement Park Zombie - Travis Grant","Banjo Zombie - Jacob G. Akins","Bathroom Zombie - Anthony Samples","Best Man - Hunter Aldridge","Bicycle Zombie - Chris Burns","Bike Guy - Sean Hilton Stephens","Bill Murray - Bill Murray","Birthday Princess - Darian O'Rear","Bubbie & Pee Paw's Grandson - Dalton Cole","Bubby & Pee Paw's Granddaughter - Victory Van Tuyl","Businessman - Gilbert Landras","Businessman Zombie - Ernest Dancy","Businesswoman Zombie - Michelle Sebek","Cardio Zombie - Shaun Lynch","Clown Zombie - Brandon Germaine","Clown Zombie - Derek Graf","College Student Zombie - Jessalin Torres","Columbus - Jesse Eisenberg","Cowboy - Steven Stadler","Customer at the Pump - Cesar Aguirre","Cynthia Knickerbocker - Joan Schuermeyer","DC Zombie - Brian Stretch","Frightened Pedestrian - Daniel Burnley","Girl on Cell Phone - Lynn McArthur","Grocery Store Zombie - Travis Young","Groom - Blaise Corrigan","Hippie Girl - Melanie Booth","Hot Mom - April Rich","Little Rock - Abigail Breslin","Lunchroom Lady Zombie - Sonya Thompson","Mansion Zombie - William Riggs","Mechanic - Clay Walker","Metro Station Zombie - Steve Warren","Panicked Pedestrian - Barry Hopkins","Panicked Pedestrian - Cody Rowlett","Pedestrian in Decatur - Jon Gould","Point-Blank Zombie - Amir R. Khan","Police Officer Zombie - Michael August","Princess Zombie - Sydnie Dawson","Punched in Face Zombie - Stephen Prouty","Riot Zombie - Brian Luallen","Rule #1- Cardio - Nathan M. Wright","Schoolboy - Devin Ray","Sprint Zombie - Justin Price","Tallahassee - Woody Harrelson","Tuxedo Guy with AK-47 - Rhett Reese","Victim in Bathroom - Mike White","Wichita - Emma Stone","Winston Zeddemore - Ernie Hudson","Woman Attacked by Zombies - Tammy Luthi Retzlaff","Yellow Truck Girl - Jade Moser","Yuppie Zombie - Robert Hatch","Zombie - Amir Kovacs","Zombie - Cameron Jacob Alpert","Zombie - Christina Klein","Zombie - Jeh Howell","Zombie - Quinton Campbell","Zombie Meter Maid - Elle Alexander"]
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

