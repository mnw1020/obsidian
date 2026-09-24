---
Название: Happy End
Просмотрено: 2023-02-03
Оценка: "8"
Оценка Imdb: "7.1"
Оценка Кинопоиск:
Количество голосов Кинопоиск:
Количество голосов Imdb: 851
tags:
  - serial
Жанр:
  - Drama
Релиз: 2021-04-01
Время: 38 min
Режисер:
  - Evgeniy Sangadzhiev
Роли файл: Кино/_system/Роли/Happy End.роли.md
Описание: "Попасть в мир Webcam просто: достаточно нажать кнопку REC. в своем мобильном и начать снимать. С такого видео и начинается карьера 19-летних Леры и Влада, которые в поисках лучшей жизни и легких денег приходят к неожиданному решению — вебкам. Они совсем не подходят друг другу, их характеры противоположны, а ценности не совпадают: Лера — безрассудная оторва, которая легко идет по головам, Влад — замкнутый умник, готовый на все ради подруги. Но странным образом они дополняют друг друга, и, вместе преодолевая препятствия на пути к успеху, взрослеют и становятся все ближе.Но можно ли сохранить любовь, когда вся твоя личная жизнь — сплошное порно?"
imdb Id: tt12908084
poster: https://m.media-amazon.com/images/M/MV5BOWE4MDI4ZDQtZDM0NC00MzgyLWFiNzItY2EyZTI3NjIxM2QxXkEyXkFqcGc@._V1_SX300.jpg
Кинопоиск ID: "1328036"
Прогноз оценки: "5.9"
Прогноз уверенность: высокая
Прогноз метод: локальная интерполяция
Прогноз локальный: "5.9"
---
<!-- KINO:ROLES:EMBED:V2 -->
<details class="kino-roles-details">
<summary>🎭 Роли</summary>

![[Кино/_system/Роли/Happy End.роли]]

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

![](https://m.media-amazon.com/images/M/MV5BOWE4MDI4ZDQtZDM0NC00MzgyLWFiNzItY2EyZTI3NjIxM2QxXkEyXkFqcGc@._V1_SX300.jpg)
