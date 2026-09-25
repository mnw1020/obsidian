---
Название: Kyle XY
Просмотрено: 2014-08-11
Оценка: "8"
Оценка Imdb: "7.4"
Оценка Кинопоиск: 7.6
Количество голосов Кинопоиск: 11863
Количество голосов Imdb: 52
tags:
  - serial
Жанр:
  - Sci-Fi
Релиз: 2006-01-01
Время: 43 min
Режисер:
  - Tony Dow
Роли файл: "[[Кино/_system/Роли/Кайл XY.роли.md]]"
Описание: Окружённый тайной, Кайл смотрит на мир глазами новорожденного ребёнка, увидит ли он, что опасности постоянно будут встречаться на его пути.Кайл приходит в себя посреди леса. Он не знает кто он, откуда, как сюда попал. На первой же минуте его новой (новой ли) жизни он встречается лицом к лицу с гремучей змеёй. Он не умеет говорить, есть, пить, спать. Он не умеет ничего. Он - новорожденный. Кроме всего прочего у него нет пупка.Кайл попадает в семью, где его окружают заботой и вниманием, но вокруг столько непонимания и опасностей.Его никто не ищет, но за ним следят.
imdb Id: tt0756500
poster: https://m.media-amazon.com/images/M/MV5BNjlmNDU4ZWYtZDZjNy00OTA0LWFiOGQtYzRmMDc2MmRiNzdmXkEyXkFqcGc@._V1_.jpg
Кинопоиск ID: "279077"
Прогноз оценки: "7.4"
Прогноз уверенность: высокая
Прогноз метод: локальная интерполяция
Прогноз локальный: "7.4"
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

![](https://m.media-amazon.com/images/M/MV5BNjlmNDU4ZWYtZDZjNy00OTA0LWFiOGQtYzRmMDc2MmRiNzdmXkEyXkFqcGc@._V1_.jpg)
