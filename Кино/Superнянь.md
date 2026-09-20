---
Название: Babysitting
Просмотрено: 2016-01-03
Оценка: "8"
Оценка Imdb: "6.8"
Оценка Кинопоиск: 7
Количество голосов Кинопоиск: 155281
Количество голосов Imdb: 13862
tags:
  - movies
Жанр:
  - Comedy
Релиз: 2014-04-16
Время: 84 min
Режисер:
  - Nicolas Benamou
  - Philippe Lacheau
Актеры:
  - Alice David
  - Alice Dufour
  - Azedine Kasri
  - Aziliz Le Guern
  - Charlotte Gabris
  - Cherley Raveau
  - Cindy Bonafini
  - Clotilde Courau
  - David Marsais
  - David Salles
  - Enzo Tomasini
  - Gérard Jugnot
  - Grégoire Ludig
  - Guillaume Doradoux
  - Julien Arruti
  - Laetitia Carrere
  - Marie Wadoux
  - Marvin Beyster
  - Michèle Raingeval
  - Nicolas Grandhomme
  - Pascal Boisson
  - Philippe Brigaud
  - Philippe Duquesne
  - Philippe Lacheau
  - Raphaël Hidrot
  - Sakhone Holaphong
  - Sylvia Fasolo
  - Tarek Boudali
  - Thomas Blumenthal
  - Vincent Desagnat
  - Vladimir Houbart
  - Yun Lai
Описание: Клэр и Марк уезжают на все выходные, оставив своего сына под присмотром «хорошего парня» Фрэнка. На следующее утро парочку будит звонок полицейского, который сообщает, что их дом перевернут верх дном, а сын исчез! На месте происшествия полиция находит камеру, на которой запечатлены все события предыдущей ночи. Только посмотрев видео родители смогут узнать куда исчез их сын и что случилось в эту ночь… когда Фрэнк праздновал 30-летие.
imdb Id: tt3013602
poster: https://m.media-amazon.com/images/M/MV5BMmFmNmRlNDctMDNlMi00ZjdhLWIwZjMtNDMyNzU4NDU5ODljXkEyXkFqcGc@._V1_SX300.jpg
Франшиза: "[[Кино/Франшизы/Superнянь]]"
Роли актеров:
  - Agent Caillaud - Philippe Duquesne
  - Alex - Julien Arruti
  - Anthony - Pascal Boisson
  - Appearing - Sakhone Holaphong
  - Commissaire Laville - David Salles
  - Copine Paul - Alice Dufour
  - Employé - Guillaume Doradoux
  - Enfant à la fête foraine - Marvin Beyster
  - Ernest - Vincent Desagnat
  - Estelle - Charlotte Gabris
  - Fêtard exta 1 - Azedine Kasri
  - Fêtard exta 2 - Thomas Blumenthal
  - Franck - Philippe Lacheau
  - Guest to the party - Cherley Raveau
  - Homme de la soirée - Yun Lai
  - Jean - David Marsais
  - La bombe atomique - Cindy Bonafini
  - La strip-teaseuse - Sylvia Fasolo
  - Le forain - Vladimir Houbart
  - Le policier téléphone - Raphaël Hidrot
  - M. Schaudel - Gérard Jugnot
  - Mme Schaudel - Clotilde Courau
  - Monsieur Monet - Philippe Brigaud
  - Paul - Grégoire Ludig
  - Policier caméra - Nicolas Grandhomme
  - Rémi - Enzo Tomasini
  - Sam - Tarek Boudali
  - Sonia - Alice David
  - uncredited - Aziliz Le Guern
  - uncredited - Laetitia Carrere
  - uncredited - Marie Wadoux
  - Une spectatrice - Michèle Raingeval
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
---

---
![](https://m.media-amazon.com/images/M/MV5BMmFmNmRlNDctMDNlMi00ZjdhLWIwZjMtNDMyNzU4NDU5ODljXkEyXkFqcGc@._V1_SX300.jpg)
