---
Название: The King's Man
Просмотрено: 2022-03-15
Оценка: "3"
Оценка Imdb: "6.3"
Оценка Кинопоиск: 5.9
Количество голосов Кинопоиск: 112556
Количество голосов Imdb: 198742
tags:
  - movies
Жанр:
  - экранизация комикса
  - 1900-е
Релиз: 2021-12-06
Время: 131 min
Режисер:
  - Matthew Vaughn
Роли файл: "[[Кино/_system/Роли/King’s Man - Начало.роли.md]]"
Описание: 1914 год. Несколько лет назад герцог Оксфордский потерял любимую жену, поэтому теперь трясётся над единственным сыном Конрадом и пытается уберечь его ото всякого рода опасностей. Но парень горит желанием служить короне и напрашивается с отцом в командировку в Сараево, где прямо у них на глазах убивают эрцгерцога австрийского Франца Фердинанда. Начинается Первая мировая. Получив письмо от шпиона при дворе императора Николая II, Оксфорды с верными помощниками отправляются в Россию ликвидировать Распутина, который имеет на монарха сильное влияние и убеждает его не вступать в войну.
imdb Id: tt6856242
poster: https://m.media-amazon.com/images/M/MV5BNjY3YTY3MGMtMjVmYS00ZmM3LWIxMDAtYWVhZTAyZDMwNmMwXkEyXkFqcGc@._V1_SX300.jpg
Франшиза: "[[Кино/Франшизы/Kingsman]]"
Кинопоиск ID: "1045056"
Прогноз оценки: "4.8"

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

![](https://m.media-amazon.com/images/M/MV5BNjY3YTY3MGMtMjVmYS00ZmM3LWIxMDAtYWVhZTAyZDMwNmMwXkEyXkFqcGc@._V1_SX300.jpg)
