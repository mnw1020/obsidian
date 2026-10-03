# 📚 [[Книги/Книги.base#Все|Книги]]

`button-books-add` `button-books-reading` `button-books-edit-reading`

## Обзор
`button-books-authors` `button-books-series` `button-books-adaptations`

## Коллекции

[[Книги/Стихи|✒ Стихи]] · [[Книги/Цитата|💬 Цитаты]]

<!-- BOOK-HOME-STATS:START -->
> [!quote] Библиотека
> **193 произведений** · **93 авторов** · **12 серий** · **89 оценено** · **0 перечитано**
<!-- BOOK-HOME-STATS:END -->

```dataviewjs
const file = app.vault.getAbstractFileByPath("Книги/_system/lazy_base.js");
if (file) {
    const m = {exports:{}};
    new Function("module", await app.vault.read(file))(m);
    m.exports({dv, app, obsidian: typeof require === "function" ? require("obsidian") : {}, target: "Книги/Книги.base#Главная", label: "библиотеку"});
}
```
 
---
# 🔁 Перечитанные
```dataviewjs
const file = app.vault.getAbstractFileByPath("Книги/_system/lazy_base.js");
if (file) {
    const m = {exports:{}};
    new Function("module", await app.vault.read(file))(m);
    m.exports({dv, app, obsidian: typeof require === "function" ? require("obsidian") : {}, target: "Книги/Книги.base#Перечитанные", label: "перечитанные книги"});
}
```


<!-- BUTTON DEFINITIONS -->

```button
name ➕ Произведение
type command
action QuickAdd: Книги - Добавить книгу
width 10
height 1.4
align center middle
hidden true
```
^button-books-add

```button
name 📖 Чтение
type command
action QuickAdd: Книги - Добавить чтение
width 10
height 1.4
align center middle
hidden true
```
^button-books-reading

```button
name ✏️ Изменить
type command
action QuickAdd: Книги - Редактировать чтение
width 10
height 1.4
align center middle
hidden true
```
^button-books-edit-reading

```button
name 👥 Автор
type command
action QuickAdd: Книги - Авторы
width 10
height 1.4
align center middle
hidden true
```
^button-books-authors

```button
name 🧩 Серия
type command
action QuickAdd: Книги - Серии
width 10
height 1.4
align center middle
hidden true
```
^button-books-series

```button
name 🎬 Экранизация
type command
action QuickAdd: Книги - Экранизации
width 10
height 1.4
align center middle
hidden true
```
^button-books-adaptations
