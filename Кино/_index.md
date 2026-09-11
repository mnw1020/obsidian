---
cssclasses:
  - movies-dashboard
---
# 🎬 Кинотека

```dataviewjs
const all = dv.pages('"Кино"').array();

function hasTag(page, tag) {
    const raw = page?.file?.tags ?? [];
    const tags = Array.from(raw).map(t => String(t).replace(/^#/, ""));
    return tags.includes(tag);
}

const media = all.filter(p => hasTag(p, "movies") || hasTag(p, "serial"));
const movies = media.filter(p => hasTag(p, "movies"));
const serials = media.filter(p => hasTag(p, "serial"));
const watched = media.filter(p => p["Просмотрено"] != null);

const ratings = media
    .map(p => Number(p["Оценка"]))
    .filter(v => Number.isFinite(v));

const average = ratings.length
    ? (ratings.reduce((sum, v) => sum + v, 0) / ratings.length).toFixed(2)
    : "–";

const stats = [
    ["🎞️", "Просмотрено", watched.length],
    ["🎬", "Фильмы", movies.length],
    ["📺", "Сериалы", serials.length],
    ["⭐", "Средняя оценка", average]
];

const grid = document.createElement("div");
grid.className = "movie-stats-grid";
dv.container.appendChild(grid);

for (const [icon, label, value] of stats) {
    const card = document.createElement("div");
    card.className = "movie-stat-card";

    const iconEl = document.createElement("div");
    iconEl.className = "movie-stat-icon";
    iconEl.textContent = icon;

    const valueEl = document.createElement("div");
    valueEl.className = "movie-stat-value";
    valueEl.textContent = value;

    const labelEl = document.createElement("div");
    labelEl.className = "movie-stat-label";
    labelEl.textContent = label;

    card.append(iconEl, valueEl, labelEl);
    grid.appendChild(card);
}
```

`button-add-movie` `button-add-viewing` `button-add-season`

## 🕐 Последние просмотры

![[_Кино.base#Последние]]

## 🔁 Перепросмотры

![[_Кино.base#Перепросмотры]]

## 📺 Последние сериалы

![[_Кино.base#Последние сериалы]]

## 🆕 Самые новые по дате релиза

![[_Кино.base#Новые релизы]]

---

## 🔎 Каталог
[[_Кино.base]]  
- **Фильмы** - последние просмотренные фильмы.
- **Сериалы** - последние просмотренные сериалы.
- **По году релиза** - группировка по году, от новых к старым.
- **Все** - полный каталог без необходимости рендерить все постеры.
- **Выше IMDb** - где твоя оценка сильнее всего отличается от IMDb в плюс.
- **Проблемные даты** - записи, у которых `Релиз` не удалось автоматически распознать.
- **Повторные просмотры** - [[Просмотры/Просмотры.base#Повторные просмотры|открыть только просмотры №2 и дальше]].

```button
name 🎬 Добавить
type command
action QuickAdd: movie_imdb
color purple
```
^button-add-movie

```button
name ...просмотр
type command
action QuickAdd: Добавить просмотр
color gray
```
^button-add-viewing

```button
name ...сезон
type command
action QuickAdd: Добавить сезон
color gray
```
^button-add-season
