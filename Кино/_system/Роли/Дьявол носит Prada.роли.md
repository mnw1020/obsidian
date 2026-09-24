---
Название: "The Devil Wears Prada"
Основная карточка: "[[Кино/Дьявол носит Prada.md]]"
imdb Id: "tt0458352"
Кинопоиск ID: "104992"
Жанр: ["Comedy","Drama"]
Режисер: ["David Frankel"]
Актеры: ["Adrian Grenier","Alexander Blaise","Alexie Gilmore","Alyssa Sutherland","Andie Karvelis","Andrea Bertola Shaw","Anne Hathaway","August Costa","Bobby Shue","Brandhyze Stanley","Bridget Hall","Carl Burrows","Carla Collado","Carrie Navarro","Colleen Dengel","Daniel Sunjata","Darren Pettis","David Callegati","David Marshall Grant","Denis McKeown","Donatella Versace","Dono Cunningham","Dutch Johnson","Emily Blunt","Emily Sandberg","Eric Seltzer","Frank Anello","George C. Wolfe","Gisele Bündchen","Guy A. Fortt","Hector Lincoln","Heidi Klum","Ilona Alexandra","Ines Rivero","Ingrid Sophie Schram","Ivan Magrin-Chagnolleau","James Cronin","James Naughton","Jennifer Scott","Jimena Hoyos","John Graham","Julie Jei","Justin Restivo","Kimberly Caines","L.J. Ganser","Laura D. Williams","Laura McDavid","Lauren Weisberger","Lindsay Brice","Mamie Gummer","Marie Brandt","Mateo Moreno","Matt Murray","Mauricio Alexander","Meryl Streep","Mira Tzur","Molyneau DuBelle","Nina Lisandrello","Pamela Fischer","Paul Keany","Rebecca Mader","Rich Sommer","Robert Stio","Robert Verdi","Rori Cannon","Rose Ritland","Scott Hatfield","Simon Baker","Stan Newman","Stanley Tucci","Stella Stark","Stephanie Szostak","Steve Benisty","Stuart Lopoten","Suzanne Dengel","Taylor Treadwell","Tibor Feldman","Tim Krueger","Tracie Thoms","Valentino Garavani","Vivian Kalinov","Wells Dixon"]
Роли актеров: ["Ambassador - James Cronin","Andy Sachs - Anne Hathaway","Bartender - August Costa","Black & White Ball Guest - Denis McKeown","Black & White Ball Guest - Vivian Kalinov","Black and White Gala guest - Dutch Johnson","Book Guy - John Graham","Bridget Hall - Bridget Hall","Businessman - Carl Burrows","Businessman - Mateo Moreno","Caroline - Colleen Dengel","Cassidy - Suzanne Dengel","Christian Thompson - Simon Baker","Clacker - Alexie Gilmore","Clacker - Alyssa Sutherland","Clacker - Emily Sandberg","Clacker - Ingrid Sophie Schram","Clacker - Nina Lisandrello","Clacker - Rose Ritland","Clacker in Elevator - Ines Rivero","Counter Girl - Jennifer Scott","Donatella Versace - Donatella Versace","Doug - Rich Sommer","Emily - Emily Blunt","Fashion Photographer - Dono Cunningham","Fashion Photographer - Steve Benisty","Fashion Reporter - Robert Verdi","Fashion Show Attendee - Marie Brandt","French Bellhop - Alexander Blaise","French Waiter - Justin Restivo","Fund Raiser - Tim Krueger","Gala Attendee - Laura McDavid","Gara Guest - Julie Jei","Girl - Carla Collado","Girl at Party - Rori Cannon","Girl in Cafe - Andie Karvelis","Guy Holding Drink In Hallway - Darren Pettis","Hector Lincoln - Hector Lincoln","Heidi Klum - Heidi Klum","Irv Ravitz - Tibor Feldman","Jacqueline Follet - Stephanie Szostak","James Holt - Daniel Sunjata","Jocelyn - Rebecca Mader","John Folger - Stan Newman","Lily - Tracie Thoms","Lobby Security Guard - Mauricio Alexander","Lucia - Jimena Hoyos","Marty - L.J. Ganser","Massimo - David Callegati","Miranda Priestly - Meryl Streep","Miranda's Driver - Wells Dixon","Miranda's New Assistant - Taylor Treadwell","Nate - Adrian Grenier","New York Mirror Reporter - Scott Hatfield","Nigel - Stanley Tucci","Paparazzo - Matt Murray","Paparazzo - Mira Tzur","Parisian Luncheon Guest - Ivan Magrin-Chagnolleau","Parisian Luncheon Guest - Molyneau DuBelle","Paul - George C. Wolfe","Photographer - Robert Stio","PR Woman - Lindsay Brice","Red Carpert Celebrity - Stuart Lopoten","Red Carpet Celebrity - Andrea Bertola Shaw","Red Carpet Celebrity - Ilona Alexandra","Restaurant Date - Stella Stark","Richard Sachs - David Marshall Grant","Roy - Eric Seltzer","Runway / Magazine Model - Carrie Navarro","Runway / Magazine Model - Kimberly Caines","Runway Magazine Model / Party Guest - Laura D. Williams","Runway Staff - Bobby Shue","Security - Frank Anello","Security - Guy A. Fortt","Serena - Gisele Bündchen","St. Regis Butler - Paul Keany","Starbucks Barista - Mamie Gummer","Stephen - James Naughton","Teacher - Pamela Fischer","The Twins' Nanny - Lauren Weisberger","Valentino Garavani - Valentino Garavani","Waitress - Brandhyze Stanley"]
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

