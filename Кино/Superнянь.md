---
Название: Babysitting
Просмотрено: 2016-01-03
Оценка: "8"
Оценка Imdb: "6.8"
Оценка Кинопоиск: 7
Количество голосов Кинопоиск: 155281
Количество голосов Imdb: 13862
tags:
  - movies
Жанр:
  - Comedy
Релиз: 2014-04-16
Время: 84 min
Режисер:
  - Nicolas Benamou
  - Philippe Lacheau
Роли файл: "[[Кино/_system/Роли/Superнянь.роли.md]]"
Описание: Клэр и Марк уезжают на все выходные, оставив своего сына под присмотром «хорошего парня» Фрэнка. На следующее утро парочку будит звонок полицейского, который сообщает, что их дом перевернут верх дном, а сын исчез! На месте происшествия полиция находит камеру, на которой запечатлены все события предыдущей ночи. Только посмотрев видео родители смогут узнать куда исчез их сын и что случилось в эту ночь… когда Фрэнк праздновал 30-летие.
imdb Id: tt3013602
poster: https://m.media-amazon.com/images/M/MV5BMmFmNmRlNDctMDNlMi00ZjdhLWIwZjMtNDMyNzU4NDU5ODljXkEyXkFqcGc@._V1_SX300.jpg
Франшиза: "[[Кино/Франшизы/Superнянь]]"
Кинопоиск ID: "777091"
Прогноз оценки: "6.7"
Прогноз уверенность: высокая
Прогноз метод: MovieLens + локальная интерполяция
Прогноз локальный: "6.4"
Прогноз MovieLens: "6.8"
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

![](https://m.media-amazon.com/images/M/MV5BMmFmNmRlNDctMDNlMi00ZjdhLWIwZjMtNDMyNzU4NDU5ODljXkEyXkFqcGc@._V1_SX300.jpg)
