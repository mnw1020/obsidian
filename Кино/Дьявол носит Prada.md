---
Название: The Devil Wears Prada
Просмотрено: 2026-02-09
Оценка: "8"
Оценка Imdb: "7.0"
Оценка Кинопоиск: 7.6
Количество голосов Кинопоиск: 239833
Количество голосов Imdb: 572341
tags:
  - movies
Жанр:
  - Comedy
  - Drama
Релиз: 2006-06-30
Время: 109 min
Режисер:
  - David Frankel
Роли файл: "[[Кино/_system/Роли/Дьявол носит Prada.роли.md]]"
Описание: Мечтающая стать журналисткой провинциальная девушка Энди по окончании университета получает должность помощницы всесильной Миранды Пристли, деспотичного редактора одного из крупнейших нью-йоркских журналов мод. Энди всегда мечтала о такой работе, не зная, с каким нервным напряжением это будет связано...
imdb Id: tt0458352
poster: https://m.media-amazon.com/images/M/MV5BOWM3NTI3YWEtYjJmMy00M2U5LWI1NzEtZWM3ZDY2ZWNjOGRiXkEyXkFqcGc@._V1_SX300.jpg
Кинопоиск ID: "104992"
Прогноз оценки: "6.2"
---
Успех всегда требует платы. Вопрос - готов ли ты платить именно такую цену? Работа мечты может оказаться ловушкой. Легко потерять себя в угоду "ценностям компании".  
Компромисс с собой происходит незаметно - сначала мелочь, потом норма, а в конце ты уже не помнишь, где был твой выбор. Система редко ломает сразу - она приучает. И в этом ее главная сила.

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

![](https://m.media-amazon.com/images/M/MV5BOWM3NTI3YWEtYjJmMy00M2U5LWI1NzEtZWM3ZDY2ZWNjOGRiXkEyXkFqcGc@._V1_SX300.jpg)



