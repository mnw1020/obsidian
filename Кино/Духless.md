---
Название: Духless
Просмотрено: 2013-01-07
Оценка: "6"
Оценка Imdb: "6.3"
Оценка Кинопоиск: 6.6
Количество голосов Кинопоиск: 98350
Количество голосов Imdb: 4491
tags:
  - movies
Жанр:
  - Comedy
  - Drama
Релиз: 2012-10-04
Время: 105 min
Режисер:
  - Roman Prygunov
Роли файл: Кино/_system/Роли/Духless.роли.md
Описание: "Главный герой фильма - 29-летний топ-менеджер крупного международного банка по имени Макс. Он уверен, что жизнь удалась, ведь у него есть то, о чём многие не могут даже и мечтать: дорогая машина, пентхаус и вечеринки. Свою жизнь Максим тратит на зарабатывание денег, а деньги - на ночные клубы, шикарных девушек, кокаин и прочие атрибуты гламурной жизни. Но в какой-то момент к герою приходит осознание того, что с его жизнью что-то не так. И его мир рушится подобно карточному домику."
imdb Id: tt1826660
poster: https://m.media-amazon.com/images/M/MV5BNDk1NGJhOWQtZGNmMi00ZDI1LThiMmQtZjI3OGFhN2UyNzQwXkEyXkFqcGc@._V1_.jpg
Кинопоиск ID: "395372"
Прогноз оценки: "5.7"
Прогноз уверенность: высокая
Прогноз метод: MovieLens + локальная интерполяция
Прогноз локальный: "6.2"
Прогноз MovieLens: "5.5"
---
<!-- KINO:ROLES:EMBED:V2 -->
<details class="kino-roles-details">
<summary>🎭 Роли</summary>

![[Кино/_system/Роли/Духless.роли]]

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

![](https://m.media-amazon.com/images/M/MV5BNDk1NGJhOWQtZGNmMi00ZDI1LThiMmQtZjI3OGFhN2UyNzQwXkEyXkFqcGc@._V1_.jpg)
