---
Название: The Lost City of Z
Просмотрено: 2018-06-30
Оценка: "5"
Оценка Imdb: "6.6"
Оценка Кинопоиск: 6.4
Количество голосов Кинопоиск: 35758
Количество голосов Imdb: 107086
tags:
  - movies
Жанр:
  - Adventure
Релиз: 2017-03-15
Время: 141 min
Режисер:
  - James Gray
Роли файл: "[[Кино/_system/Роли/Затерянный город Z.роли.md]]"
Описание: Эльдорадо, таинственная столица инков, загадочный Город Z. Вымысел или реальность? В 1925 году экспедиция полковника Фоссета, члена Королевского Географического общества, бесследно исчезла в джунглях Амазонии в поисках Города Z.
imdb Id: tt1212428
poster: https://m.media-amazon.com/images/M/MV5BZmU2ODIyMWItMjU3Zi00ZmVhLWIyNDAtMWE5OWU2ZDExMGFiXkEyXkFqcGc@._V1_SX300.jpg
Кинопоиск ID: "432794"
Прогноз оценки: "4.2"
Прогноз уверенность: высокая
Прогноз метод: MovieLens + локальная интерполяция
Прогноз локальный: "5.9"
---
растянуто и скучно

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

![](https://m.media-amazon.com/images/M/MV5BZmU2ODIyMWItMjU3Zi00ZmVhLWIyNDAtMWE5OWU2ZDExMGFiXkEyXkFqcGc@._V1_SX300.jpg)

