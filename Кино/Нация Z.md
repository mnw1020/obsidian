---
Название: Z Nation
Просмотрено: 2015-10-14
Оценка: "6"
Оценка Imdb: "6.7"
Оценка Кинопоиск: 6.8
Количество голосов Кинопоиск: 9942
Количество голосов Imdb: 42419
tags:
  - serial
Жанр:
  - Sci-Fi
  - Horror
Релиз: 2014-09-12
Время: 43 min
Режисер:
  - Abram Cox
  - Alexander Yellen
  - Andrew Drazek
  - Dan Merchant
  - J.D. McKee
  - Jared Briley
  - Jennifer Derwingson
  - Jodi Binstock
  - John Hyams
  - Juan A Mas
  - Keith Allan
  - Luis Prieto
  - Michael Robison
  - Nick Lyon
  - Rachel Lee Goldenberg
  - Steve Graham
  - Stuart Acher
  - Tim Andrew
  - Youssef Delara
Роли файл: "[[Кино/_system/Роли/Нация Z.роли.md]]"
Описание: Спустя три года после того, как вирус зомби распространился и уничтожил почти всю страну, команда должна перевезти оставшегося в живых от действия чумы из Нью-Йорка в Калифорнию, где последняя функционирующая вирусная лаборатория ждет его кровь. Хотя антитела, которыми он обладает, являются последней надеждой мира получить вакцину, этот человек скрывает мрачную тайну.
imdb Id: tt3843168
poster: https://m.media-amazon.com/images/M/MV5BYTc2YTJiZDItN2I4OS00M2MwLTlhZGYtNTM2ZjBjMDlkZjJlXkEyXkFqcGc@._V1_SX300.jpg
Кинопоиск ID: "841371"
Прогноз оценки: "6.0"
Прогноз уверенность: высокая
Прогноз метод: локальная интерполяция
Прогноз локальный: "6.0"
---
Просмотрено s02ep05

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

![](https://m.media-amazon.com/images/M/MV5BYTc2YTJiZDItN2I4OS00M2MwLTlhZGYtNTM2ZjBjMDlkZjJlXkEyXkFqcGc@._V1_SX300.jpg)
