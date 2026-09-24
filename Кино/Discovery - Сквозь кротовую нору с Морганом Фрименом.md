---
Название: Through the Wormhole
Просмотрено: 2014-02-06
Оценка: "9"
Оценка Imdb: "8.6"
Оценка Кинопоиск: 8.4
Количество голосов Кинопоиск: 6587
Количество голосов Imdb: 19471
tags:
  - serial
Жанр:
  - Documentary
Релиз: 2010-06-09
Время: 43 min
Режисер:
  - Anthony Lund
  - David Isser
  - David LaMattina
  - Geoffrey Sharp
  - James Younger
  - Kurt Sayenga
  - Laura Verklan
  - Lori McCreary
  - Robert Beemer
  - Robin Acutt
Роли файл: Кино/_system/Роли/Discovery - Сквозь кротовую нору с Морганом Фрименом.роли.md
Описание: Сериал исследует самые глубокие тайны существования - вопросы, которые всегда озадачивали человечество. Из чего мы сделаны? Что было перед началом всего? Действительно ли мы одиноки во вселенной? Есть ли создатель? Эти вопросы были обдуманы самыми изящными умами человеческого рода.Теперь, наука приблизилась к сути, в область где твердые факты и свидетельства могут быть в состоянии предоставить нам ответы, вместо философских теорий. «Через Червоточину» примирит самые яркие умы и лучшие идеи с самых передних краев наук, - астрофизики, астробиологии, квантовой механики, теории струн, и более - чтобы показать экстраординарную правду о нашей Вселенной.
imdb Id: tt1513168
poster: https://m.media-amazon.com/images/M/MV5BMGQyNDAzNGItZWM5MC00ZDAxLTg1YjItYzhkZmU5NGQzMWEzXkEyXkFqcGc@._V1_.jpg
Кинопоиск ID: "542041"
Прогноз оценки: "7.2"
Прогноз уверенность: высокая
Прогноз метод: локальная интерполяция
Прогноз локальный: "7.2"
---
Посмотрен s04ep10

---

<!-- KINO:ROLES:EMBED:V2 -->
<details class="kino-roles-details">
<summary>🎭 Роли</summary>

![[Кино/_system/Роли/Discovery - Сквозь кротовую нору с Морганом Фрименом.роли]]

</details>

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

![](https://m.media-amazon.com/images/M/MV5BMGQyNDAzNGItZWM5MC00ZDAxLTg1YjItYzhkZmU5NGQzMWEzXkEyXkFqcGc@._V1_.jpg)
