---
Название: "Harry Potter and the Deathly Hallows: Part 2"
Просмотрено: 2012-06-04
Оценка: "7"
Оценка Imdb: "8.1"
Оценка Кинопоиск: 8.1
Количество голосов Кинопоиск: 411612
Количество голосов Imdb: 1062749
tags:
  - movies
Жанр:
  - Fantasy
Релиз: 2011-07-07
Время: 130 min
Режисер:
  - David Yates
Роли файл: "[[Кино/_system/Роли/Гарри Поттер и Дары Смерти - Часть II.роли.md]]"
Описание: В грандиозной последней главе битва между добрыми и злыми силами мира волшебников перерастает во всеобщую войну. Ставки ещё никогда не были так высоки, а поиск убежища — столь сложен. И быть может именно Гарри Поттеру придется пожертвовать всем в финальном сражении с Волан-де-Мортом. Способен ли наш герой спасти мир? И всё закончится здесь.
imdb Id: tt1201607
poster: https://m.media-amazon.com/images/M/MV5BOTA1Mzc2N2ItZWRiNS00MjQzLTlmZDQtMjU0NmY1YWRkMGQ4XkEyXkFqcGc@._V1_SX300.jpg
Франшиза: "[[Кино/Франшизы/Волшебный мир Гарри Поттера]]"
Кинопоиск ID: "407636"
Прогноз оценки: "8.0"

---
<!-- KINO:RECOMMEND:BUTTON:V2 -->
```dataviewjs
const currentPath = dv.current()?.file?.path || "";
const wrap = dv.container.createDiv({ cls: "kino-recommend-action" });
wrap.style.marginTop = "1em";
wrap.style.marginBottom = "1em";
const btn = wrap.createEl("button", { text: "🔎 Найти похожие" });
btn.style.cursor = "pointer";
btn.style.padding = "6px 12px";
btn.style.fontWeight = "600";
btn.onclick = async () => {
    const original = btn.textContent;
    btn.disabled = true;
    btn.textContent = "⏳ Ищу…";
    try {
        const statePath = "Кино/_system/Прогноз/рекомендации_state.json";
        const pagePath = "Кино/_system/рекомендации.md";
        const payload = JSON.stringify({
            reference: currentPath,
            updatedAt: new Date().toISOString()
        }, null, 2);
        let stateFile = app.vault.getAbstractFileByPath(statePath);
        if (stateFile) await app.vault.modify(stateFile, payload);
        else {
            const folderPath = "Кино/_system/Прогноз";
            if (!app.vault.getAbstractFileByPath(folderPath)) await app.vault.createFolder(folderPath);
            stateFile = await app.vault.create(statePath, payload);
        }
        const page = app.vault.getAbstractFileByPath(pagePath);
        if (!page) throw new Error("Не найдена Кино/_system/рекомендации.md");
        await app.workspace.getLeaf(false).openFile(page);
    } catch (e) {
        console.error("Кино: рекомендации", e);
        btn.textContent = "⚠ Ошибка";
        btn.title = String(e?.message || e);
        setTimeout(() => { btn.textContent = original; btn.disabled = false; }, 3500);
        return;
    }
    btn.textContent = original;
    btn.disabled = false;
};
```

![](https://m.media-amazon.com/images/M/MV5BOTA1Mzc2N2ItZWRiNS00MjQzLTlmZDQtMjU0NmY1YWRkMGQ4XkEyXkFqcGc@._V1_SX300.jpg)
