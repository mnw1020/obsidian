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

> [!info]- Как устроена главная
> Статистика выше считается маленьким DataviewJS-блоком только по метаданным. Списки, сортировки и постеры ниже строит Obsidian Bases. Поэтому Dataview больше не рендерит тысячу строк и тысячу изображений.

## 🕐 Последние просмотры

![[Кино_v3.base#Последние]]

## ⭐ Лучшие

![[Кино_v3.base#Лучшие]]

## 📺 Последние сериалы

![[Кино_v3.base#Последние сериалы]]

## 🆕 Самые новые по дате релиза

![[Кино_v3.base#Новые релизы]]

---

## 🔎 Каталог

Открой [[Кино_v3.base]] и выбери нужное представление:

- **Фильмы** - последние просмотренные фильмы.
- **Сериалы** - последние просмотренные сериалы.
- **По году релиза** - группировка по году, от новых к старым.
- **Все** - полный каталог без необходимости рендерить все постеры.
- **Выше IMDb** - где твоя оценка сильнее всего отличается от IMDb в плюс.
- **Проблемные даты** - записи, у которых `Релиз` не удалось автоматически распознать.
