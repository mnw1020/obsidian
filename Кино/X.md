---
Название: X
Просмотрено: 2022-05-25
Оценка: "2"
Оценка Imdb: "6.5"
Оценка Кинопоиск:
Количество голосов Кинопоиск:
Количество голосов Imdb: 228747
tags:
  - movies
Жанр:
  - Horror
  - Mystery
Релиз: 2022-03-17
Время: 105 min
Режисер:
  - Ti West
Роли файл: "[[Кино/_system/Роли/X.роли.md]]"
Описание: 1979 год, Техас. Компания из шести человек арендует небольшой дом у пожилой пары фермеров, чтобы снимать фильм для взрослых. Хотя хозяин недвижимости сразу предупреждает, чтобы приезжие не шумели и вели себя прилично, продюсер, разумеется, пренебрегает его просьбой. Вскоре выяснится, что старички не такие безобидные, как казалось на первый взгляд.
imdb Id: tt13560574
poster: https://m.media-amazon.com/images/M/MV5BODUwYTNhMTMtYWQ5Ny00YTdmLWIxOTAtNDczNzVlYzg2NDFkXkEyXkFqcGc@._V1_SX300.jpg
Кинопоиск ID: "4382899"
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

![](https://m.media-amazon.com/images/M/MV5BODUwYTNhMTMtYWQ5Ny00YTdmLWIxOTAtNDczNzVlYzg2NDFkXkEyXkFqcGc@._V1_SX300.jpg)
