---
cssclasses:
  - books-library
obsidianUIMode: preview
---

# 📚 Библиотека

<p class="books-actions-fallback"><a href="obsidian://quickadd?choice=Книги%20-%20Добавить%20книгу">➕ Записать произведение</a> · <a href="obsidian://quickadd?choice=Книги%20-%20Добавить%20чтение">📖 Записать чтение</a> · <a href="obsidian://quickadd?choice=Книги%20-%20Добавить%20выписку">✒️ Сохранить выписку</a> · <a href="obsidian://quickadd?choice=Книги%20-%20Редактировать%20чтение">✏️ Редактировать чтение</a></p>

```dataviewjs
const file = app.vault.getAbstractFileByPath("Книги/_system/lazy_base.js");
if (file) {
    const m = {exports:{}};
    new Function("module", await app.vault.read(file))(m);
    await m.exports({dv, app, obsidian: typeof require === "function" ? require("obsidian") : {}, mode: "actions"});
}
```

<!-- BOOK-HOME-STATS:START -->
> [!quote] Библиотека
> **202 произведений** · **93 авторов** · **12 серий** · **98 оценено** · **0 перечитано**
<!-- BOOK-HOME-STATS:END -->

```dataviewjs
const file = app.vault.getAbstractFileByPath("Книги/_system/lazy_base.js");
if (file) {
    const m = {exports:{}};
    new Function("module", await app.vault.read(file))(m);
    await m.exports({dv, app, obsidian: typeof require === "function" ? require("obsidian") : {}, mode: "stats"});
}
```

## Недавние произведения

Последние 20 по дате чтения. [[Книги/_system/_Книги.base#Список|Весь каталог]] · [[Книги/_system/_Книги.base#Все|Подробная таблица]] · [🔎 Поиск по библиотеке](obsidian://quickadd?choice=Книги%20-%20Поиск%20по%20библиотеке)

```dataviewjs
const file = app.vault.getAbstractFileByPath("Книги/_system/lazy_base.js");
if (file) {
    const m = {exports:{}};
    new Function("module", await app.vault.read(file))(m);
    await m.exports({dv, app, obsidian: typeof require === "function" ? require("obsidian") : {}, target: "Книги/_system/_Книги.base#Главная", label: "недавние 20", expanded: true});
}
```

## Из заметок

[[Книги/Цитаты|Цитаты]]

```dataviewjs
const file = app.vault.getAbstractFileByPath("Книги/_system/knowledge.js");
if (file) {
    const m = {exports:{}};
    new Function("module", await app.vault.read(file))(m);
    await m.exports({dv, app, obsidian: typeof require === "function" ? require("obsidian") : {}, mode: "home"});
}
```

## Чтение в цифрах

[[Книги/_system/Итоги чтения|Все итоги чтения]]

```dataviewjs
const file = app.vault.getAbstractFileByPath("Книги/_system/reading_dashboard.js");
if (file) {
    const m = {exports:{}};
    new Function("module", await app.vault.read(file))(m);
    await m.exports({dv, app, obsidian: typeof require === "function" ? require("obsidian") : {}, mode: "home"});
}
```

## Обзор

[👥 Авторы](obsidian://quickadd?choice=Книги%20-%20Авторы) · [🧩 Серии](obsidian://quickadd?choice=Книги%20-%20Серии) · [🎬 Экранизации](obsidian://quickadd?choice=Книги%20-%20Экранизации)

[[Книги/_system/_Книги.base#Любимые|⭐ Любимые]] · [[Книги/_system/_Книги.base#Без оценки|Без оценки]] · [[Книги/_system/_Книги.base#По году|По году]] · [[Книги/_system/_Книги.base#По типу|По типу]] · [[Книги/Стихи|✒ Стихи]]

### 🔁 Перечитанные

```dataviewjs
const file = app.vault.getAbstractFileByPath("Книги/_system/lazy_base.js");
if (file) {
    const m = {exports:{}};
    new Function("module", await app.vault.read(file))(m);
    await m.exports({dv, app, obsidian: typeof require === "function" ? require("obsidian") : {}, mode: "reread", target: "Книги/_system/_Книги.base#Перечитанные", label: "перечитанные"});
}
```

---

[[Книги/_system/Проверка библиотеки|🔎 Проверка]] · [[Книги/_system/Журнал изменений|📜 Журнал изменений]]

