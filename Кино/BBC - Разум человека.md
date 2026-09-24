---
Название: "BBC: The Human Mind"
Просмотрено: 2013-10-27
Оценка: "4"
Оценка Imdb: "6.1"
Оценка Кинопоиск: 7.4
Количество голосов Кинопоиск: 185
Количество голосов Imdb: 20
tags:
  - serial
Жанр:
  - Documentary
Релиз: 2003-10-01
Время: 49 min
Режисер:
  - Diana Hill
Роли файл: "[[Кино/_system/Роли/BBC - Разум человека.роли.md]]"
Описание: 📺 Почему один человек чувствует опасность, а другой нет? Как может опыт подсказать нам, стоит ли доверять людям? И как дети осваивают сложные движения, просто думая о них? Ответ кроется в самой удивительной части каждого из нас, в нашем разуме. Каждую секунду бодрствования, хотя мы даже и не осознаем этого, наш разум работает, изучая окружающий мир. Но наша способность к познанию даже больше, чем мы думаем. Изучая принципы работы разума мы можем улучшить нашу познавательную способность и раскрыть свой истинный потенциал. Человек добился огромных успехов в изучении своего тела. Но разум человека до сих пор остается загадкой. Новый документальный фильм ВВС попытается найти ответ, как работает разум человека, и как его можно использовать с максимальной эффективностью.
imdb Id: tt10073724
poster: https://m.media-amazon.com/images/M/MV5BMTM5NzRiYjEtZmQwMC00YmVhLWI1NTMtMjc2MDFmMWYxNmY5XkEyXkFqcGc@._V1_FMjpg_UX1000_.jpg
Кинопоиск ID: "690014"
Прогноз оценки: "6.3"
Прогноз уверенность: высокая
Прогноз метод: локальная интерполяция
Прогноз локальный: "6.3"
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

![](https://m.media-amazon.com/images/M/MV5BMTM5NzRiYjEtZmQwMC00YmVhLWI1NTMtMjc2MDFmMWYxNmY5XkEyXkFqcGc@._V1_FMjpg_UX1000_.jpg)
