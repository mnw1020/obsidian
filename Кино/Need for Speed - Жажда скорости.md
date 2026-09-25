---
Название: Need for Speed
Просмотрено: 2014-10-14
Оценка: "9"
Оценка Imdb: "6.4"
Оценка Кинопоиск: 6.8
Количество голосов Кинопоиск: 151376
Количество голосов Imdb: 188293
tags:
  - movies
Жанр:
  - Action
Релиз: 2014-03-12
Время: 130 min
Режисер:
  - Scott Waugh
Роли файл: "[[Кино/_system/Роли/Need for Speed - Жажда скорости.роли.md]]"
Описание: История Тоби Маршалла, гениального автомеханика, чьей единственной отдушиной является участие в подпольных гонках. Чтобы сохранить семейную мастерскую, Тоби вынужден взять в партнеры богатого и заносчивого бывшего гонщика IndyCar Дино Брюстера. Когда дела Тоби наконец-то начинают идти в гору, Дино подставляет партнера, и Тоби обвиняют в преступлении, которого он не совершал. Спустя два года Тоби выходит из тюрьмы с мыслью о мести. Чтобы достичь своей цели, ему придется совершить невозможное и доказать, что даже в мире броских суперкаров самый невзрачный гонщик может финишировать первым.
imdb Id: tt2369135
poster: https://m.media-amazon.com/images/M/MV5BMTQ3ODY4NzYzOF5BMl5BanBnXkFtZTgwNjI3OTE4MDE@._V1_.jpg
Кинопоиск ID: "678975"
Прогноз оценки: "6.4"

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

![](https://m.media-amazon.com/images/M/MV5BMTQ3ODY4NzYzOF5BMl5BanBnXkFtZTgwNjI3OTE4MDE@._V1_.jpg)
