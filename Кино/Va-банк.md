---
Название: Runner Runner
Просмотрено: 2014-03-30
Оценка: "4"
Оценка Imdb: "5.6"
Оценка Кинопоиск: 6.1
Количество голосов Кинопоиск: 68862
Количество голосов Imdb: 67553
tags:
  - movies
Жанр:
  - Crime
  - Mystery
Релиз: 2013-09-25
Время: 88 min
Режисер:
  - Brad Furman
Роли файл: "[[Кино/_system/Роли/Va-банк.роли.md]]"
Описание: Чтобы оплачивать учёбу в колледже, Ричи погружается в мир азартных игр онлайн. Когда удача изменяет ему, он отправляется на Коста-Рику, чтобы помериться силами с настоящим асом игрового бизнеса. Тот видит в Ричи родственную душу и вводит его в свою игру. Но когда степень опасности возрастает, а ставки достигают невероятных высот, Ричи вдруг отчётливо понимает, что его новый босс вот-вот совершит непоправимое, и пытается поменяться с ним ролями.
imdb Id: tt2364841
poster: https://m.media-amazon.com/images/M/MV5BMTU5OTA0MjI4Ml5BMl5BanBnXkFtZTgwMTgxOTQwMDE@._V1_.jpg
Кинопоиск ID: "677880"
Прогноз оценки: "5.3"

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

![](https://m.media-amazon.com/images/M/MV5BMTU5OTA0MjI4Ml5BMl5BanBnXkFtZTgwMTgxOTQwMDE@._V1_.jpg)
