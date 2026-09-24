---
Название: Into the Universe with Stephen Hawking
Просмотрено: 2013-12-20
Оценка: "6"
Оценка Imdb: "8.5"
Оценка Кинопоиск: 8.5
Количество голосов Кинопоиск: 5797
Количество голосов Imdb: 5704
tags:
  - serial
Жанр:
  - Documentary
Релиз: 2010-04-25
Время: 43 min
Режисер:
  - Iain Riddick
  - Martin Williams
  - Nathan Williams
Роли файл: Кино/_system/Роли/Discovery - Во Вселенную со Стивеном Хокингом.роли.md
Описание: Знаменитый физик, профессор Стивен Хокинг, который в 30 лет оказался практически полностью парализован из-за прогрессирующей болезни, делится мыслями о самых интригующих загадках Вселенной, таких как инопланетная жизнь или путешествие во времени.
imdb Id: tt1655078
poster: https://m.media-amazon.com/images/M/MV5BMTkyNTAwMTk2Ml5BMl5BanBnXkFtZTgwMDA2NjE0MzE@._V1_.jpg
Кинопоиск ID: "542489"
Прогноз оценки: "7.3"
Прогноз уверенность: высокая
Прогноз метод: локальная интерполяция
Прогноз локальный: "7.3"
---
Красиво, спору нет, но слишком все «по детски» что-ли.. ничего нового.. кроме того, его сильно заносит временами.

---

<!-- KINO:ROLES:EMBED:V2 -->
<details class="kino-roles-details">
<summary>🎭 Роли</summary>

![[Кино/_system/Роли/Discovery - Во Вселенную со Стивеном Хокингом.роли]]

</details>

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

![](https://m.media-amazon.com/images/M/MV5BMTkyNTAwMTk2Ml5BMl5BanBnXkFtZTgwMDA2NjE0MzE@._V1_.jpg)
