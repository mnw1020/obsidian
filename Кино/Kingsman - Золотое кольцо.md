---
Название: "Kingsman: The Golden Circle"
Просмотрено: 2017-12-29
Оценка: "4"
Оценка Imdb: "6.7"
Оценка Кинопоиск: 7
Количество голосов Кинопоиск: 324135
Количество голосов Imdb: 406035
tags:
  - movies
Жанр:
  - Action
Релиз: 2017-09-20
Время: 141 min
Режисер:
  - Matthew Vaughn
Роли файл: Кино/_system/Роли/Kingsman - Золотое кольцо.роли.md
Описание: Когда штаб-квартиры секретной службы Kingsman уничтожены, и весь мир оказался в заложниках у неизвестных, британские суперагенты обнаруживают, что в один день вместе с их организацией была еще создана американская разведка — Statesman. Теперь эти две элитные спецслужбы должны объединиться и бросить вызов общему безжалостному врагу, чтобы спасти мир, то есть заняться тем, что для Эггси становится обычным делом…
imdb Id: tt4649466
poster: https://m.media-amazon.com/images/M/MV5BMjQ3OTgzMzY4NF5BMl5BanBnXkFtZTgwOTc4OTQyMzI@._V1_.jpg
Франшиза: "[[Кино/Франшизы/Kingsman]]"
Кинопоиск ID: "906654"
Прогноз оценки: "5.4"
Прогноз уверенность: высокая
Прогноз метод: MovieLens + локальная интерполяция
Прогноз локальный: "6.4"
Прогноз MovieLens: "5.1"
---
<!-- KINO:ROLES:EMBED:V2 -->
<details class="kino-roles-details">
<summary>🎭 Роли</summary>

![[Кино/_system/Роли/Kingsman - Золотое кольцо.роли]]

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

![](https://m.media-amazon.com/images/M/MV5BMjQ3OTgzMzY4NF5BMl5BanBnXkFtZTgwOTc4OTQyMzI@._V1_.jpg)
