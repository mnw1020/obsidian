---
cssclasses:
  - movies-dashboard
---
# 🎬 [[_Кино.base|Кинотека]]  

[[Кино/_system/Проверка кинотеки|🔎 Проверка кинотеки]] · [[Кино/_system/Журнал изменений|📜 Журнал изменений]]

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

Редактировать `^button-edit-season` `^button-edit-viewing` `^button-rebuild-card` `^button-kino-franshise`

## 🕐 Последние просмотры
![[_Кино.base#Последние]]
## 🔁 Перепросмотры
![[_Кино.base#Перепросмотры]]
## 📺 Последние сериалы
![[_Кино.base#Последние сериалы]]
## 📊 Сравнение оценок
![[_Кино.base#Сравнение оценок]]

---

```button
name 🎬 Добавить
type command
action QuickAdd: movie_imdb
color purple
width 10
height 1
align center middle
hidden true
```
^button-add-movie

```button
name ...просмотр
type command
action QuickAdd: Добавить просмотр
color gray
width 10
height 1
align center middle
hidden true
```
^button-add-viewing

```button
name ...сезон
type command
action QuickAdd: Добавить сезон
color gray
width 10
height 1
align center middle
hidden true
```
^button-add-season

```button
name Сезон
type command
action QuickAdd: Редактировать сезон
color blue
width 5
height 1
align center middle
hidden true
```
^button-edit-season

```button
name Просмотр
type command
action QuickAdd: Редактировать просмотр
color blue
width 5
height 1
align center middle
hidden true
```
^button-edit-viewing

```button
name Карту
type command
action QuickAdd: Пересобрать карточку
color blue
width 5
height 1
align center middle
hidden true
```
^button-rebuild-card


```button
name Франшизу
type command
action QuickAdd: Франшиза
color blue
width 5
height 1
align center middle
hidden true
```
^button-kino-franshise
