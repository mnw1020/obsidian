---
Название: Наша Russia. 8 марта
Просмотрено: 2025-03-21
Оценка: "1"
Оценка Imdb: "3.6"
Оценка Кинопоиск: 6.6
Количество голосов Кинопоиск: 284651
Количество голосов Imdb: 164
tags:
  - movies
Жанр:
  - Comedy
  - Music
Релиз: 2025-03-07
Время: 86 min
Режисер:
  - David Kocharov
  - David Sahakyants
  - Gosha Evdokimov
  - Hayk Sahakyants
  - Ivan Glubokov
  - Katya Yak
  - Sasha Abdullaev
  - Shabad Jonathan
Актеры:
  - Aleksandr Garanin
  - Aleksandr Onipko
  - Aleksandr Serov
  - Aleksandra Buryanova
  - Aleksandra Nizhegorodova
  - Aleksei Voropanov
  - Anna Ukolova
  - Anna Yekaterininskaya
  - Antonina Medvedeva
  - Artur Kazberov
  - David Petrosyan
  - Demis Karibidis
  - Elena Melentyeva
  - Erik Yaralov
  - Garik Martirosyan
  - Gor Kosakyan
  - Grigoriy Leps
  - Irina Vybornova
  - Karen Egisapetov
  - Kirill Solomennikov
  - Lyubov Uspenskaya
  - Lyudmila Chebotina
  - Marina Bogatova
  - Mikhail Galustyan
  - Mikhail Pavlik
  - Oleg Malyshev
  - Pavel Prushchik
  - Philipp Kirkorov
  - Sasha Gross
  - Seda Khachatryan
  - Sergey Lazarev
  - Sergey Svetlakov
  - Stas Mikhaylov
  - Stepan Shevyakov
  - Svetlana Listova
  - Tatyana Lotova
  - Tatyana Mitienko
  - Vladimir Lukyanchikov
Описание: Бородач, честный гаишник и нечестные чиновники возвращаются. Комедия со звездными гостями. Смотрите онлайн фильм Наша Russia. 8 марта на Кинопоиске.
imdb Id: tt33094176
poster: https://m.media-amazon.com/images/M/MV5BZjhjNzEyMWMtNWVmMC00N2JhLTk4ODgtOTI1ZmEyZDc1NjAxXkEyXkFqcGc@._V1_SX300.jpg
Роли актеров:
  - Aleksandr Serov - Aleksandr Serov
  - Armyanin 1 - David Petrosyan
  - Armyanin 2 - Erik Yaralov
  - Borya - Vladimir Lukyanchikov
  - Denis - Kirill Solomennikov
  - Devushka - Elena Melentyeva
  - Devushka v avtomasterskoy - Tatyana Mitienko
  - Filipp Kirkorov - Philipp Kirkorov
  - Grigoriy Leps - Grigoriy Leps
  - Irishka - Anna Ukolova
  - Lyubov Uspenskaya - Lyubov Uspenskaya
  - Lyusya Chebotina - Lyudmila Chebotina
  - Nevesta - Aleksandra Buryanova
  - Ofitsiant - Karen Egisapetov
  - Politseyskiy - Oleg Malyshev
  - Politseyskiy v ROVD - Artur Kazberov
  - Prodavets tsvetov - Irina Vybornova
  - Rabotnik avtomasterskoy 1 - Mikhail Pavlik
  - Rabotnik avtomasterskoy 2 - Gor Kosakyan
  - Roditel 1 - Aleksei Voropanov
  - Roditel 2 - Marina Bogatova
  - Roditel 3 - Aleksandra Nizhegorodova
  - Rudik - Garik Martirosyan
  - Sergey Lazarev - Sergey Lazarev
  - Skvortsova - Sasha Gross
  - Stas Mikhaylov - Stas Mikhaylov
  - Styopa - Pavel Prushchik
  - Susanna - Seda Khachatryan
  - Syn Gaishnika - Stepan Shevyakov
  - Terentich - Aleksandr Onipko
  - Uchitelnitsa IZO - Anna Yekaterininskaya
  - Vakhitov - Demis Karibidis
  - Various - Mikhail Galustyan
  - Various - Sergey Svetlakov
  - Zhena Belyakova - Svetlana Listova
  - Zhena Gaishnika - Tatyana Lotova
  - Zhenikh - Aleksandr Garanin
  - Zritel kontserta - Antonina Medvedeva
Кинопоиск ID: "8370937"
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
![](https://m.media-amazon.com/images/M/MV5BZjhjNzEyMWMtNWVmMC00N2JhLTk4ODgtOTI1ZmEyZDc1NjAxXkEyXkFqcGc@._V1_SX300.jpg)
