---
Название: World War Z
Просмотрено: 2013-09-10
Оценка: "8"
Оценка Imdb: "7.0"
Оценка Кинопоиск: 7
Количество голосов Кинопоиск: 216815
Количество голосов Imdb: 794633
tags:
  - movies
Жанр:
  - Sci-Fi
Релиз: 2013-06-02
Время: 116 min
Режисер:
  - Marc Forster
Роли файл: "[[Кино/_system/Роли/Война миров Z.роли.md]]"
Описание: Бывший сотрудник ООН Джерри Лэйн оказывается в эпицентре эпидемии неизвестного вируса, который за считанные секунды превращает людей в зомби. Пытаясь найти противоядие против вируса, Лэйн путешествует вместе со своей группой почти по всему миру, поражённому эпидемией. Теперь судьба всего мира висит на волоске, и Джерри — его единственная надежда.
imdb Id: tt0816711
poster: https://m.media-amazon.com/images/M/MV5BODg3ZTM2YWQtZDE5Ny00NGNiLTkzYjgtYWVlYjNkOTg5NDI1XkEyXkFqcGc@._V1_SX300.jpg
Кинопоиск ID: "261636"
Прогноз оценки: "6.1"
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

![](https://m.media-amazon.com/images/M/MV5BODg3ZTM2YWQtZDE5Ny00NGNiLTkzYjgtYWVlYjNkOTg5NDI1XkEyXkFqcGc@._V1_SX300.jpg)


