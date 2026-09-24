---
Название: "G.I. Joe: Retaliation"
Просмотрено: 2013-07-17
Оценка: "6"
Оценка Imdb: "5.7"
Оценка Кинопоиск: 5.8
Количество голосов Кинопоиск: 87972
Количество голосов Imdb: 194115
tags:
  - movies
Жанр:
  - Sci-Fi
Релиз: 2013-03-11
Время: 110 min
Режисер:
  - Jon M. Chu
Роли файл: "[[Кино/_system/Роли/G.I. Joe - Бросок кобры 2.роли.md]]"
Описание: Во второй части отряд «G.I. Joe» вновь объявит вызов группировке «Кобра» и вступит в противостояние с правительством.
imdb Id: tt1583421
poster: https://m.media-amazon.com/images/M/MV5BNzk5ODM0OTQ0N15BMl5BanBnXkFtZTcwODg2ODE4OA@@._V1_.jpg
Франшиза: "[[Кино/Франшизы/G.I. Joe]]"
Кинопоиск ID: "494839"
Прогноз оценки: "5.1"
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

![](https://m.media-amazon.com/images/M/MV5BNzk5ODM0OTQ0N15BMl5BanBnXkFtZTcwODg2ODE4OA@@._V1_.jpg)


