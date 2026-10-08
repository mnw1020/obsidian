---
cssclasses:
  - movies-dashboard
  - kino-page
  - kino-dashboard
  - kino-home-page
---
```dataviewjs
const file = app.vault.getAbstractFileByPath("Кино/_system/kino_home.js");
if (file) {
    try {
        const home = {exports:{}};
        new Function("module", await app.vault.read(file))(home);
        await home.exports({dv, app, obsidian: typeof require === "function" ? require("obsidian") : {}});
    } catch (error) {
        console.warn("Кино: главная временно недоступна", error);
        dv.paragraph("Не удалось загрузить главную. Каталог и команды доступны ниже.");
    }
}
```

# Кинотека

Фильмы, к которым хочется вернуться. Истории, которые ещё впереди.

[Добавить фильм или сериал](obsidian://quickadd?choice=movie_imdb) · [Добавить просмотр](obsidian://quickadd?choice=%D0%94%D0%BE%D0%B1%D0%B0%D0%B2%D0%B8%D1%82%D1%8C%20%D0%BF%D1%80%D0%BE%D1%81%D0%BC%D0%BE%D1%82%D1%80) · [Добавить сезон](obsidian://quickadd?choice=%D0%94%D0%BE%D0%B1%D0%B0%D0%B2%D0%B8%D1%82%D1%8C%20%D1%81%D0%B5%D0%B7%D0%BE%D0%BD)

[[Кино/_Кино.base#Карточки|Вся коллекция]] · [[Кино/_system/Рекомендации|Рекомендации]] · [[Кино/_system/Аналитика прогнозов|Аналитика]] · [[Кино/_system/README|Инструкция]]

## Последние просмотры

[[Кино/_Кино.base#Последние|Последние просмотры]] · [[Кино/_Кино.base#Перепросмотры|Перепросмотры]] · [[Кино/_Кино.base#Последние сериалы|Последние сериалы]]

## Обзор

[Актёры](obsidian://quickadd?choice=%D0%9A%D0%B8%D0%BD%D0%BE%20-%20%D0%9E%D1%82%D0%BA%D1%80%D1%8B%D1%82%D1%8C%20%D0%B0%D0%BA%D1%82%D0%B5%D1%80%D0%B0) · [Режиссёры](obsidian://quickadd?choice=%D0%9A%D0%B8%D0%BD%D0%BE%20-%20%D0%9E%D1%82%D0%BA%D1%80%D1%8B%D1%82%D1%8C%20%D1%80%D0%B5%D0%B6%D0%B8%D1%81%D1%81%D0%B5%D1%80%D0%B0) · [Жанры](obsidian://quickadd?choice=%D0%9A%D0%B8%D0%BD%D0%BE%20-%20%D0%9E%D1%82%D0%BA%D1%80%D1%8B%D1%82%D1%8C%20%D0%B6%D0%B0%D0%BD%D1%80) · [[Кино/_Кино.base#Карточки|Каталог]]

[[Кино/_Кино.base#Все|Все произведения]] · [[Кино/_Кино.base#Фильмы|Фильмы]] · [[Кино/_Кино.base#Сериалы|Сериалы]] · [[Кино/_Кино.base#По году релиза|По году релиза]] · [[Кино/_Кино.base#Сравнение оценок|Сравнение оценок]]

## Управление коллекцией

[Редактировать просмотр](obsidian://quickadd?choice=%D0%A0%D0%B5%D0%B4%D0%B0%D0%BA%D1%82%D0%B8%D1%80%D0%BE%D0%B2%D0%B0%D1%82%D1%8C%20%D0%BF%D1%80%D0%BE%D1%81%D0%BC%D0%BE%D1%82%D1%80) · [Редактировать сезон](obsidian://quickadd?choice=%D0%A0%D0%B5%D0%B4%D0%B0%D0%BA%D1%82%D0%B8%D1%80%D0%BE%D0%B2%D0%B0%D1%82%D1%8C%20%D1%81%D0%B5%D0%B7%D0%BE%D0%BD) · [Пересобрать карточку](obsidian://quickadd?choice=%D0%9F%D0%B5%D1%80%D0%B5%D1%81%D0%BE%D0%B1%D1%80%D0%B0%D1%82%D1%8C%20%D0%BA%D0%B0%D1%80%D1%82%D0%BE%D1%87%D0%BA%D1%83) · [Изменить франшизу](obsidian://quickadd?choice=%D0%A4%D1%80%D0%B0%D0%BD%D1%88%D0%B8%D0%B7%D0%B0)

[[Кино/_system/Проверка кинотеки|Проверка кинотеки]] · [[Кино/_system/Журнал изменений|Журнал изменений]]

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
