---
Название: Project X
Просмотрено: 2013-08-27
Оценка: "4"
Оценка Imdb: "6.7"
Оценка Кинопоиск: 7
Количество голосов Кинопоиск: 112384
Количество голосов Imdb: 261850
tags:
  - movies
Жанр:
  - Comedy
Релиз: 2012-03-01
Время: 88 min
Режисер:
  - Nima Nourizadeh
Роли файл: "[[Кино/_system/Роли/Проект X - Дорвались.роли.md]]"
Описание: "Сюжет фильма рассказывает историю трех поначалу никому не известных старшеклассников, которые пытаются заявить о себе. Их задумка выглядит вполне невинно: надо просто организовать незабываемую вечеринку… но к такому они готовы не были. Молва разлетается слишком быстро, рушатся мечты, уже испорчена репутация, но одновременно зарождаются легенды."
imdb Id: tt1636826
poster: https://m.media-amazon.com/images/M/MV5BMTc1MTk0Njg4OF5BMl5BanBnXkFtZTcwODc0ODkyNw@@._V1_.jpg
Кинопоиск ID: "507440"
Прогноз оценки: "6.7"

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

![](https://m.media-amazon.com/images/M/MV5BMTc1MTk0Njg4OF5BMl5BanBnXkFtZTcwODc0ODkyNw@@._V1_.jpg)
