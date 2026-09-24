---
Название: Last Vegas
Просмотрено: 2014-01-28
Оценка: "7"
Оценка Imdb: "6.6"
Оценка Кинопоиск: 7
Количество голосов Кинопоиск: 206396
Количество голосов Imdb: 140897
tags:
  - movies
Жанр:
  - Comedy
Релиз: 2013-10-31
Время: 105 min
Режисер:
  - Jon Turteltaub
Роли файл: "[[Кино/_system/Роли/Starперцы.роли.md]]"
Описание: Билли, Пэдди, Арчи и Сэм дружат больше полувека. И когда убежденный холостяк Билли наконец-то делает предложение своей юной подружке, великолепная четверка отправляется в Лас-Вегас, чтобы скинуть с себя груз прожитого и зажечь как в последний раз. Великовозрастные гуляки и не подозревают, как за десятилетия эволюционировал Город Грехов…
imdb Id: tt1204975
poster: https://m.media-amazon.com/images/M/MV5BMTQ2ODg2MTIyNF5BMl5BanBnXkFtZTgwMzU2NjgwMDE@._V1_.jpg
Кинопоиск ID: "468571"
Прогноз оценки: "5.6"
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

![](https://m.media-amazon.com/images/M/MV5BMTQ2ODg2MTIyNF5BMl5BanBnXkFtZTgwMzU2NjgwMDE@._V1_.jpg)



