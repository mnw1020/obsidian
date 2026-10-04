---
cssclasses:
  - movies-dashboard
  - kino-page
  - kino-dashboard
---
```dataviewjs
const uiFile = app.vault.getAbstractFileByPath("Кино/_system/kino_ui.js");
if (uiFile) {
    const ui = {exports:{}};
    new Function("module", await app.vault.read(uiFile))(ui);
    await ui.exports({dv, app, obsidian: typeof require === "function" ? require("obsidian") : {}, kind: "dashboard"});
}

const header = dv.container.createDiv({cls: "kino-dashboard-header"});
header.createDiv({cls: "kino-eyebrow", text: "ЛИЧНАЯ КОЛЛЕКЦИЯ"});
header.createEl("h1", {text: "Кинотека"});
header.createEl("p", {cls: "kino-subtitle", text: "Фильмы, к которым хочется вернуться. Истории, которые ещё впереди."});
const nav = header.createEl("nav", {cls: "kino-nav"});
nav.setAttribute("aria-label", "Разделы кинотеки");
function internalLink(parent, text, target) {
    const link = parent.createEl("a", {cls: "internal-link", text, href: target});
    link.setAttribute("data-href", target);
    link.addEventListener("click", event => {
        event.preventDefault();
        app.workspace.openLinkText(target, dv.current().file.path, event.ctrlKey || event.metaKey);
    });
    return link;
}
for (const [label, target] of [
    ["Вся коллекция", "Кино/_Кино.base#Карточки"],
    ["Рекомендации", "Кино/_system/Рекомендации"],
    ["Аналитика", "Кино/_system/Аналитика прогнозов"],
    ["Проверка", "Кино/_system/Проверка кинотеки"],
    ["Инструкция", "Кино/_system/README"],
    ["Журнал", "Кино/_system/Журнал изменений"]
]) internalLink(nav, label, target);

const all = app.vault.getMarkdownFiles()
    .filter(f => f.path.startsWith("Кино/Media/") && !f.path.slice(11).includes("/"))
    .map(f => ({...app.metadataCache.getFileCache(f)?.frontmatter, file: {tags: app.metadataCache.getFileCache(f)?.frontmatter?.tags || []}}));

function hasTag(page, tag) {
    const raw = page?.file?.tags ?? [];
    const tags = (Array.isArray(raw) ? raw : [raw]).map(t => String(t).replace(/^#/, ""));
    return tags.includes(tag);
}

const media = all.filter(p => hasTag(p, "movies") || hasTag(p, "serial"));
const movies = media.filter(p => hasTag(p, "movies"));
const serials = media.filter(p => hasTag(p, "serial"));
const watched = media.filter(p => p["Просмотрено"] != null);

const ratings = media
    .filter(p => p["Оценка"] != null && p["Оценка"] !== "")
    .map(p => Number(String(p["Оценка"]).replace(",", ".")))
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

function commandLink(parent, label, choice, primary = false) {
    const link = parent.createEl("a", {text: label, href: `obsidian://quickadd?choice=${encodeURIComponent(choice)}`, cls: primary ? "kino-action kino-action-primary" : "kino-action"});
    return link;
}
const actions = dv.container.createDiv({cls: "kino-actions"});
commandLink(actions, "Добавить фильм или сериал", "movie_imdb", true);
commandLink(actions, "Добавить просмотр", "Добавить просмотр");
commandLink(actions, "Добавить сезон", "Добавить сезон");
const editing = dv.container.createEl("details", {cls: "kino-edit-actions"});
editing.createEl("summary", {text: "Управление коллекцией"});
const editActions = editing.createDiv({cls: "kino-actions"});
for (const [label, choice] of [["Редактировать сезон", "Редактировать сезон"], ["Редактировать просмотр", "Редактировать просмотр"], ["Пересобрать карточку", "Пересобрать карточку"], ["Изменить франшизу", "Франшиза"]]) commandLink(editActions, label, choice);
```

## Последние просмотры

Недавно просмотренное — впечатления и оценки рядом с постерами.

```dataviewjs
const file = app.vault.getAbstractFileByPath("Кино/_system/lazy_base.js");
if (file) {
    const m = {exports:{}};
    new Function("module", await app.vault.read(file))(m);
    m.exports({dv, app, obsidian: typeof require === "function" ? require("obsidian") : {}, target: "Кино/_Кино.base#Последние", label: "последние просмотры"});
}
```
## Хочется пересмотреть

Любимые истории, к которым ты уже возвращался.

```dataviewjs
const file = app.vault.getAbstractFileByPath("Кино/_system/lazy_base.js");
if (file) {
    const m = {exports:{}};
    new Function("module", await app.vault.read(file))(m);
    m.exports({dv, app, obsidian: typeof require === "function" ? require("obsidian") : {}, target: "Кино/_Кино.base#Перепросмотры", label: "перепросмотры"});
}
```
## Последние сериалы

Продолжения и новые сезоны твоих сериалов.

```dataviewjs
const file = app.vault.getAbstractFileByPath("Кино/_system/lazy_base.js");
if (file) {
    const m = {exports:{}};
    new Function("module", await app.vault.read(file))(m);
    m.exports({dv, app, obsidian: typeof require === "function" ? require("obsidian") : {}, target: "Кино/_Кино.base#Последние сериалы", label: "последние сериалы"});
}
```
## [[_Кино.base#Сравнение оценок|Сравнение оценок]]

Личные впечатления, прогноз, IMDb и Кинопоиск в одной таблице.

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
