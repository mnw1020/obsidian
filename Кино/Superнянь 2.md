---
Название: Babysitting 2
Просмотрено: 2016-01-03
Оценка: "5"
Оценка Imdb: "6.4"
Оценка Кинопоиск: 7
Количество голосов Кинопоиск: 76640
Количество голосов Imdb: 8662
tags:
  - movies
Жанр:
  - Comedy
Релиз: 2015-10-14
Время: 93 min
Режисер:
  - Nicolas Benamou
  - Philippe Lacheau
Актеры:
  - Afranio Marquês de Andrade
  - Aílton Carmo
  - Alice David
  - Beto Benites
  - Chanel Hoxha
  - Charlotte Gabris
  - Christian Clavier
  - David Marsais
  - Dylan Monmont
  - Elisa Bachir Bey
  - Élodie Fontan
  - Gil Cruz
  - Grégoire Ludig
  - Jamie Stewart-Granger
  - Jean-Luc Couchard
  - Jean-Michel Correia
  - Jérôme Commandeur
  - João Salomão
  - Joséphine Draï
  - Julien Arruti
  - Ken Samuels
  - Kunue Paje
  - Luis Eduardo dos Reis Pachêco
  - Marcelo Moraes
  - Maryale
  - Philippe Lacheau
  - Porfirio Rocha
  - Robin Guillaume Castel
  - Steven Monmont
  - Tarek Boudali
  - Valériane de Villeneuve
  - Valérie Karsenti
  - Vincent Desagnat
Описание: Влюбленная парочка Фрэнк и Соня приглашают своих друзей на отдых в Бразилию, в роскошный отель богатенького папы Сони. Планировалось, что это будет отдых мечты, а Фрэнк сделает Соне предложение посреди всей этой экзотики. Но его попытки получить одобрение отца оборачиваются полным провалом. Ведь с такими друзьями, как у него, и враги не нужны! Но настоящая катастрофа – впереди. Когда друзья – сексуально озабоченный Сэм, наивный чудак Эрнест и умственно отсталый Алекс – вместе с беднягой Фрэнком собрались на экскурсию, ушлый папаша пользуется возможностью и засылает в джунгли с этой бандой свою крикливую и надоедливую старушку. В общем, Амазонка и ее девственные леса еще никогда не были в такой опасности!
imdb Id: tt4400058
poster: https://m.media-amazon.com/images/M/MV5BOGQzY2QxY2EtMzM0NS00NzgzLWI1YzEtMDNiODBkYTk1MjQ3XkEyXkFqcGc@._V1_SX300.jpg
Франшиза: "[[Кино/Франшизы/Superнянь]]"
Роли актеров:
  - Alain - Christian Clavier
  - Alex - Julien Arruti
  - Chanteur local - Afranio Marquês de Andrade
  - Erika - Elisa Bachir Bey
  - Ernest - Vincent Desagnat
  - Estelle - Charlotte Gabris
  - Ex-petit copain de Sonia - João Salomão
  - Fillette Orly - Chanel Hoxha
  - Fils Marco 1 - Dylan Monmont
  - Flis Marco 2 - Steven Monmont
  - Franck - Philippe Lacheau
  - Garçon sur la photo - Robin Guillaume Castel
  - Jean - David Marsais
  - Joao - Luis Eduardo dos Reis Pachêco
  - John - Ken Samuels
  - Joséphine - Joséphine Draï
  - Julie - Élodie Fontan
  - La fille de Massieye - Maryale
  - Le chef des secouristes - Beto Benites
  - Le chef indien - Kunue Paje
  - Le régisseur - Marcelo Moraes
  - Le shaman - Porfirio Rocha
  - Le vigile à l'aéroport - Jean-Michel Correia
  - Livreur de fruits - Gil Cruz
  - Marco - Jean-Luc Couchard
  - Michel - Jérôme Commandeur
  - Mme Massieye - Valérie Karsenti
  - Parapentiste - Jamie Stewart-Granger
  - Paul - Grégoire Ludig
  - Pedro - Aílton Carmo
  - Sam - Tarek Boudali
  - Sonia - Alice David
  - Yolande - Valériane de Villeneuve
Кинопоиск ID: "887519"
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
![](https://m.media-amazon.com/images/M/MV5BOGQzY2QxY2EtMzM0NS00NzgzLWI1YzEtMDNiODBkYTk1MjQ3XkEyXkFqcGc@._V1_SX300.jpg)
