---
Название: Духless
Просмотрено: 2013-01-07
Оценка: "6"
Оценка Imdb: "6.3"
Оценка Кинопоиск: 6.6
Количество голосов Кинопоиск: 98350
Количество голосов Imdb: 4491
tags:
  - movies
Жанр:
  - Comedy
  - Drama
Релиз: 2012-10-04
Время: 105 min
Режисер:
  - Roman Prygunov
Актеры:
  - Aleksey Shakhbanov
  - Aleksey Varnavskiy
  - Alena Orlova
  - Anatoliy Beliy
  - Anna Naumenko
  - Artur Smolyaninov
  - Artyom Mikhalkov
  - Daniil Vorobyov
  - Danila Kozlovskiy
  - Danila Polyakov
  - Darya Chichkina
  - Dmitriy Dorokhov
  - Dmitriy Fomin
  - Dmitriy Grachev
  - Egor Belov
  - Elena Chernyavskaya
  - Elena Safarova
  - Elizaveta Kyubler
  - Evgeniy Pilipenko
  - Gubanov Sergei
  - Igor Larin
  - Igor Voynarovskiy
  - Ildar Kuyanchiyev
  - Ivan Potekhin
  - Larisa Leyman
  - Mari Kuznetsova
  - Marina Kazankova
  - Mariya Andreeva
  - Mariya Kozhevnikova
  - Mikhail Efremov
  - Natalya Samolyotova
  - Nikita Makarov
  - Nikita Panfilov
  - Nikolay Efremov
  - Oksana Kutuzova
  - Oleg Blinov
  - Oleg Nazarov
  - Pavel Yasenok
  - Rinat Khairullin
  - Roman Demchenko
  - Roman Radov
  - Sacha Bourdo
  - Sergey Belogolovtsev
  - Sergey Krapiva
  - Svetlana Korchagina
  - Tatyana Bondareva
  - Timur Pshukov
  - Valeriya Lunina
  - Vladimir Sychyov
Описание: "Главный герой фильма - 29-летний топ-менеджер крупного международного банка по имени Макс. Он уверен, что жизнь удалась, ведь у него есть то, о чём многие не могут даже и мечтать: дорогая машина, пентхаус и вечеринки. Свою жизнь Максим тратит на зарабатывание денег, а деньги - на ночные клубы, шикарных девушек, кокаин и прочие атрибуты гламурной жизни. Но в какой-то момент к герою приходит осознание того, что с его жизнью что-то не так. И его мир рушится подобно карточному домику."
imdb Id: tt1826660
poster: https://m.media-amazon.com/images/M/MV5BNDk1NGJhOWQtZGNmMi00ZDI1LThiMmQtZjI3OGFhN2UyNzQwXkEyXkFqcGc@._V1_.jpg
Роли актеров:
  - Alena Suvorova - Oksana Kutuzova
  - Avdey - Artur Smolyaninov
  - Belobrysyy - Vladimir Sychyov
  - Danila - Danila Polyakov
  - Elvira - Mariya Kozhevnikova
  - Garrido - Sacha Bourdo
  - Girl in restaurant, covered in paint - Elena Chernyavskaya
  - Gulyakin - Sergey Belogolovtsev
  - Kavkazets - Rinat Khairullin
  - Kondratov - Mikhail Efremov
  - Kostya - Aleksey Shakhbanov
  - Maks - Danila Kozlovskiy
  - Malchik - Nikita Makarov
  - Menedzher - Ildar Kuyanchiyev
  - Menedzher No. 1 - Gubanov Sergei
  - Menedzher No. 2 - Roman Demchenko
  - Menedzher No. 3 - Oleg Nazarov
  - Misha Vudu - Nikita Panfilov
  - Mister Iks - Daniil Vorobyov
  - Mrachnyy muzhik No. 1 - Ivan Potekhin
  - Mrachnyy muzhik No. 2 - Aleksey Varnavskiy
  - Natalya Viktorovna - Marina Kazankova
  - Normann - Igor Larin
  - Oksana - Natalya Samolyotova
  - Paren - Dmitriy Fomin
  - Parkhomenko - Igor Voynarovskiy
  - Pasha - Anatoliy Beliy
  - Patlatyy - Roman Radov
  - Perevodchitsa - Mari Kuznetsova
  - Podruga Suvorovoy - Tatyana Bondareva
  - Radikal - Nikolay Efremov
  - Radikal-khaker - Oleg Blinov
  - Radikal-zdorovyak - Egor Belov
  - Radikal-zloy - Pavel Yasenok
  - Radikalka - Larisa Leyman
  - Regional - Elena Safarova
  - Regional - Evgeniy Pilipenko
  - Reporter - Darya Chichkina
  - Sasha - Dmitriy Dorokhov
  - Sekretarsha Katya - Anna Naumenko
  - Sergey Krapiventsev - Sergey Krapiva
  - Striptizersha - Alena Orlova
  - Striptizersha - Valeriya Lunina
  - Supermen - Dmitriy Grachev
  - Uchastnik gruppy Parkhomenko No. 1 - Timur Pshukov
  - Uchastnik gruppy Parkhomenko No. 2 - Svetlana Korchagina
  - Uchastnik gruppy Parkhomenko No. 3 - Elizaveta Kyubler
  - Vadim - Artyom Mikhalkov
  - Yulya - Mariya Andreeva
Кинопоиск ID: "395372"
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
![](https://m.media-amazon.com/images/M/MV5BNDk1NGJhOWQtZGNmMi00ZDI1LThiMmQtZjI3OGFhN2UyNzQwXkEyXkFqcGc@._V1_.jpg)
