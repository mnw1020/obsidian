---
Название: "Harry Potter and the Deathly Hallows: Part 1"
Просмотрено: 2012-06-04
Оценка: "7"
Оценка Imdb: "7.7"
Оценка Кинопоиск: 7.8
Количество голосов Кинопоиск: 330515
Количество голосов Imdb: 674931
tags:
  - movies
Жанр:
  - Fantasy
Релиз: 2010-11-11
Время: 146 min
Режисер:
  - David Yates
Роли файл: "[[Кино/_system/Роли/Гарри Поттер и Дары Смерти - Часть I.роли.md]]"
Описание: Гарри Поттера ждёт самое страшное испытание в жизни — смертельная схватка с Волан-де-Мортом. Ждать помощи не от кого — Гарри одинок, как никогда… Друзья и враги Гарри предстают в совершенно неожиданном свете. Граница между Добром и Злом становится всё призрачнее…
imdb Id: tt0926084
poster: https://m.media-amazon.com/images/M/MV5BMTQ2OTE1Mjk0N15BMl5BanBnXkFtZTcwODE3MDAwNA@@._V1_SX300.jpg
Франшиза: "[[Кино/Франшизы/Волшебный мир Гарри Поттера]]"
Кинопоиск ID: "276762"
Прогноз оценки: "7.6"

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

![](https://m.media-amazon.com/images/M/MV5BMTQ2OTE1Mjk0N15BMl5BanBnXkFtZTcwODE3MDAwNA@@._V1_SX300.jpg)
