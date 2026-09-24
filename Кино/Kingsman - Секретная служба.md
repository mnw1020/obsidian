---
Название: "Kingsman: The Secret Service"
Просмотрено: 2015-05-21
Оценка: "7"
Оценка Imdb: "7.7"
Оценка Кинопоиск: 7.7
Количество голосов Кинопоиск: 552111
Количество голосов Imdb: 784503
tags:
  - movies
Жанр:
  - экранизация комикса
  - сцена после титров
Релиз: 2015-01-24
Время: 129 min
Режисер:
  - Matthew Vaughn
Роли файл: "[[Кино/_system/Роли/Kingsman - Секретная служба.роли.md]]"
Описание: Эггси — молодой парень, который прошел службу в морской пехоте и имеет очень высокий уровень интеллекта. Он мог бы добиться многого, но выбрал другой путь и стал мелким преступником. Однажды он знакомится с Гарри Хартом, которому его отец когда-то спас жизнь. Этот человек решил сделать все возможное, чтобы сделать жизнь Эггси лучше и открыть для него новые возможности. Гарри рассказал ему, что является агентом секретной независимой организации, которая стоит на защите всего мира. Он предложил парню пройти обучение и стать новым членом их команды. Эггси принял предложение Харта, но сможет ли он справиться со всеми испытаниями и оправдать его надежды?..
imdb Id: tt2802144
poster: https://m.media-amazon.com/images/M/MV5BODk1MTYwNTAtYmI5Zi00OWYyLWE0MzQtOWE4NDIxZmU2MjMwXkEyXkFqcGc@._V1_SX300.jpg
Франшиза: "[[Кино/Франшизы/Kingsman]]"
Кинопоиск ID: "749540"
Прогноз оценки: "6.2"
Прогноз уверенность: высокая
---
ярко, но глуповато

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

![](https://m.media-amazon.com/images/M/MV5BODk1MTYwNTAtYmI5Zi00OWYyLWE0MzQtOWE4NDIxZmU2MjMwXkEyXkFqcGc@._V1_SX300.jpg)


