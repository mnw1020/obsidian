---
Название: "Zombieland: Double Tap"
Просмотрено: 2024-01-11
Оценка: "7"
Оценка Imdb: "6.6"
Оценка Кинопоиск: 6.7
Количество голосов Кинопоиск: 206554
Количество голосов Imdb: 229654
tags:
  - movies
Жанр:
  - Action
Релиз: 2019-10-09
Время: 99 min
Режисер:
  - Ruben Fleischer
Роли файл: "[[Кино/_system/Роли/Zомбилэнд - Контрольный выстрел.роли.md]]"
Описание: Беспощадная и бесстрашная четверка охотников на зомби продолжает свое путешествие в глубь страны. На этот раз им предстоит сразиться не только с новыми видами живых мертвецов, но и познакомиться с другими выжившими. Кроме того, в собственных рядах наших героев намечается серьезный разлад.
imdb Id: tt1560220
poster: https://m.media-amazon.com/images/M/MV5BOTViNDc4NTgtYzVlNi00YmY3LWFiNDgtODJlNGU1YzI1MGExXkEyXkFqcGc@._V1_SX300.jpg
Франшиза: "[[Кино/Франшизы/Зомбилэнд]]"
Кинопоиск ID: "489414"
Прогноз оценки: "6.2"

---
Продолжение на порядок лучше. Сколько самоиронии и юморного
 легкого сарказма, просто класс. Спецэффекты на уровне.

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

![](https://m.media-amazon.com/images/M/MV5BOTViNDc4NTgtYzVlNi00YmY3LWFiNDgtODJlNGU1YzI1MGExXkEyXkFqcGc@._V1_SX300.jpg)
