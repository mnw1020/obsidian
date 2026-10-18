---
cssclasses:
  - books-library
  - books-home-page
obsidianUIMode: preview
---

```dataviewjs
// Fallback sections keep their layout anchors for Obsidian's preview scrolling.
const file = app.vault.getAbstractFileByPath("Книги/_system/library_home.js");
if (file) {
    try {
        const home = { exports: {} };
        new Function("module", await app.vault.read(file))(home);
        await home.exports({ dv, app, obsidian: typeof require === "function" ? require("obsidian") : {} });
    } catch (problem) {
        dv.paragraph("Не удалось открыть обзор библиотеки. Ссылки доступны ниже.");
    }
}
```

# 📚 Библиотека

<p class="books-actions-fallback"><a href="obsidian://quickadd?choice=Книги%20-%20Добавить%20книгу">+ Добавить</a> · <a href="obsidian://quickadd?choice=Книги%20-%20Добавить%20чтение">…чтение</a> · <a href="obsidian://quickadd?choice=Книги%20-%20Редактировать%20чтение">…редактировать</a> · <a href="obsidian://quickadd?choice=Книги%20-%20Поиск%20по%20библиотеке" aria-label="Поиск по библиотеке" title="Поиск по библиотеке">🔍</a></p>


<!-- BOOK-HOME-STATS:START -->
> [!quote] Библиотека
> **234 произведений** · **93 авторов** · **155 художественных** · **79 нон-фикшн** · **0 перечитано**
<!-- BOOK-HOME-STATS:END -->


## Обзор библиотеки

[👥 Авторы](obsidian://quickadd?choice=Книги%20-%20Авторы) · [🧩 Серии](obsidian://quickadd?choice=Книги%20-%20Серии) · [🎬 Экранизации](obsidian://quickadd?choice=Книги%20-%20Экранизации)

[[Книги/Стихи|✒ Стихи]] · [[Книги/Цитаты|Цитаты]]

[[Книги/_system/_Книги.base#Все|Таблица]] · [[Книги/_system/_Книги.base#Художественные|Художественные]] · [[Книги/_system/_Книги.base#Non-fiction|Non-fiction]] · [[Книги/_system/_Книги.base#Любимые|Любимые]] · [[Книги/_system/_Книги.base#По году|По году]] · [[Книги/_system/_Книги.base#По типу|По типу]]

### Недавние произведения

[[Книги/_system/_Книги.base#Главная|Последние 20 по дате чтения]]

### Перечитанные

[[Книги/_system/_Книги.base#Перечитанные|Все перечитанные произведения]]

## [[Книги/_system/Итоги чтения|Статистика]]

---

[[Книги/_system/Проверка библиотеки|🔎 Проверка]] · [[Книги/_system/Журнал изменений|📜 Журнал изменений]]

