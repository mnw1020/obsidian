---
Название: Zомби каникулы
Просмотрено: 2013-10-09
Оценка: "1"
Оценка Imdb: "2.1"
Оценка Кинопоиск: 1.5
Количество голосов Кинопоиск: 15350
Количество голосов Imdb: 549
tags:
  - movies
Жанр:
  - Comedy
  - Horror
Релиз: 2013-08-15
Время: 95 min
Режисер:
  - Kirill Kemnits
Роли файл: "[[Кино/_system/Роли/Zомби каникулы.роли.md]]"
Описание: Группа молодых людей собирается на главную тусовку лета. Как и полагается, подготовка идёт полным ходом, но никто не догадывается, что судьба готовит им совершенно другую программу на афтепати. Оказавшись в эпицентре зомбоапокалипсиса, друзья обнаруживают, что «ходячие» охотятся только за теми, кто испытывает страх…
imdb Id: tt3039378
poster: https://m.media-amazon.com/images/M/MV5BZWU0NTRmMmYtNDA0Ni00ZmE1LTlmMWYtN2Y1NGRhNDNiMTI5XkEyXkFqcGc@._V1_.jpg
Кинопоиск ID: "659213"
Прогноз оценки: "1.0"
Прогноз уверенность: высокая
Прогноз метод: локальная интерполяция
Прогноз локальный: "1.0"
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

![](https://m.media-amazon.com/images/M/MV5BZWU0NTRmMmYtNDA0Ni00ZmE1LTlmMWYtN2Y1NGRhNDNiMTI5XkEyXkFqcGc@._V1_.jpg)
