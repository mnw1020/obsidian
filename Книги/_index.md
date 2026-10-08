---
cssclasses:
  - books-library
  - books-home-page
---

```dataviewjs
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

<p class="books-actions-fallback"><a href="obsidian://quickadd?choice=Книги%20-%20Добавить%20книгу">➕ Записать произведение</a> · <a href="obsidian://quickadd?choice=Книги%20-%20Добавить%20чтение">📖 Записать чтение</a> · <a href="obsidian://quickadd?choice=Книги%20-%20Редактировать%20чтение">✏️ Редактировать чтение</a> · <a href="obsidian://quickadd?choice=Книги%20-%20Добавить%20выписку">✒️ Добавить цитату</a> · <a href="obsidian://quickadd?choice=Книги%20-%20Поиск%20по%20библиотеке" aria-label="Поиск по библиотеке" title="Поиск по библиотеке">🔍</a></p>


<!-- BOOK-HOME-STATS:START -->
> [!quote] Библиотека
> **202 произведений** · **93 авторов** · **123 художественных** · **79 нон-фикшн** · **0 перечитано**
<!-- BOOK-HOME-STATS:END -->


## Недавние произведения

Последние 20 по дате чтения. [[Книги/_system/_Книги.base#Список|Весь каталог]] · [[Книги/_system/_Книги.base#Все|Подробная таблица]]


## Чтение в цифрах

[[Книги/_system/Итоги чтения|Все итоги чтения]]


## Обзор

[👥 Авторы](obsidian://quickadd?choice=Книги%20-%20Авторы) · [🧩 Серии](obsidian://quickadd?choice=Книги%20-%20Серии) · [🎬 Экранизации](obsidian://quickadd?choice=Книги%20-%20Экранизации)

[[Книги/_system/_Книги.base#Любимые|⭐ Любимые]] · [[Книги/_system/_Книги.base#Без оценки|Без оценки]] · [[Книги/_system/_Книги.base#По году|По году]] · [[Книги/_system/_Книги.base#По типу|По типу]] · [[Книги/Стихи|✒ Стихи]]

### 🔁 Перечитанные


---

[[Книги/_system/Проверка библиотеки|🔎 Проверка]] · [[Книги/_system/Журнал изменений|📜 Журнал изменений]]

