---
Название: V
Просмотрено: 2014-08-11
Оценка: "5"
Оценка Imdb: "6.8"
Оценка Кинопоиск: 7.1
Количество голосов Кинопоиск: 26427
Количество голосов Imdb: 61466
tags:
  - serial
Жанр:
  - Sci-Fi
  - Drama
Релиз: 2009-11-03
Время: 42 min
Режисер:
  - Bobby Roth
  - Bryan Spicer
  - David Barrett
  - Dean White
  - Frederick E.O. Toye
  - Jeff Woolnough
  - Jesse Warn
  - John Behring
  - Jonathan Frakes
  - Ralph Hemecker
  - Robert Duncan McNeill
  - Steve Shill
  - Yves Simoneau
Роли файл: "[[Кино/_system/Роли/Vизитеры.роли.md]]"
Описание: Сегодня весь мир проснулся и увидел, что над каждым городом парят космические корабли. Прибывшие утверждают что пришли с миром, и предлагают подарки в виде медицинских открытий и технологических усовершенствований. Они обещают, что не навредят. Они лгут. Большинство человечества верит, что чужие прибыли как раз тогда, когда мы в них нуждались. Люди с радостью принимают их помощь.
imdb Id: tt1307824
poster: https://m.media-amazon.com/images/M/MV5BMTYxNTQ5NTg2Ml5BMl5BanBnXkFtZTcwODUyNTY5Mg@@._V1_.jpg
Кинопоиск ID: "453372"
Прогноз оценки: "6.1"

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

![](https://m.media-amazon.com/images/M/MV5BMTYxNTQ5NTg2Ml5BMl5BanBnXkFtZTcwODUyNTY5Mg@@._V1_.jpg)
