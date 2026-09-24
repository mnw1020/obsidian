---
Название: Doom
Просмотрено: 2015-05-26
Оценка: "5"
Оценка Imdb: "5.2"
Оценка Кинопоиск: 5.9
Количество голосов Кинопоиск: 104893
Количество голосов Imdb: 125032
tags:
  - movies
Жанр:
  - Sci-Fi
Релиз: 2005-10-20
Время: 105 min
Режисер:
  - Andrzej Bartkowiak
Роли файл: "[[Кино/_system/Роли/Doom.роли.md]]"
Описание: 2045 год. После того как из далёкой научной лаборатории Олдуай был получен сигнал о помощи, на Марс прибывает отряд космического спецназа и обнаруживает разгромленную станцию. Вскоре выясняется, что на людей здесь охотятся полчища ужасных мутантов.
imdb Id: tt0419706
poster: https://m.media-amazon.com/images/M/MV5BYjA5ZGQ1MDQtMGI0ZC00ZDY4LTg1NmYtNzgwNGE3MjQ0MzYyXkEyXkFqcGc@._V1_SX300.jpg
Кинопоиск ID: "84140"
Прогноз оценки: "4.7"
Прогноз уверенность: высокая
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

![](https://m.media-amazon.com/images/M/MV5BYjA5ZGQ1MDQtMGI0ZC00ZDY4LTg1NmYtNzgwNGE3MjQ0MzYyXkEyXkFqcGc@._V1_SX300.jpg)


