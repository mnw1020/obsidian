---
Название: Tomb Raider
Просмотрено: 2018-06-20
Оценка: "6"
Оценка Imdb: "6.3"
Оценка Кинопоиск: 6.2
Количество голосов Кинопоиск: 160324
Количество голосов Imdb: 244180
tags:
  - movies
Жанр:
  - Fantasy
Релиз: 2018-03-02
Время: 118 min
Режисер:
  - Roar Uthaug
Роли файл: "[[Кино/_system/Роли/Tomb Raider - Лара Крофт.роли.md]]"
Описание: Лара Крофт — весьма самостоятельная дочь эксцентричного искателя приключений, который пропал, едва она стала подростком. Теперь ей двадцать один, она бесцельно проживает свою жизнь, курьером рассекая на байке по забитым улицам восточного Лондона. Решительно настроенная пробиться сама, она отказывается брать на себя руководство глобальной империей отца, столь же категорично отвергая мысль о том, что он действительно пропал. Слыша советы о том, что ей нужно смириться с этим фактом и жить дальше после семи лет бесплодных поисков, Лара уже и сама не понимает, что же заставляет ее распутывать обстоятельства его таинственного исчезновения.
imdb Id: tt1365519
poster: https://m.media-amazon.com/images/M/MV5BMTIwNWU2NTEtMDQ0Yi00MjFkLThhN2UtMjJhOGVjN2UyYzFkXkEyXkFqcGc@._V1_.jpg
Франшиза: "[[Кино/Франшизы/Лара Крофт]]"
Кинопоиск ID: "446136"
Прогноз оценки: "4.9"
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

![](https://m.media-amazon.com/images/M/MV5BMTIwNWU2NTEtMDQ0Yi00MjFkLThhN2UtMjJhOGVjN2UyYzFkXkEyXkFqcGc@._V1_.jpg)



