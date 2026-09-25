---
Название: Zombieland
Просмотрено: 2024-01-11
Оценка: "5"
Оценка Imdb: "7.5"
Оценка Кинопоиск: 7.5
Количество голосов Кинопоиск: 224842
Количество голосов Imdb: 674273
tags:
  - movies
Жанр:
  - Action
Релиз: 2009-10-02
Время: 88 min
Режисер:
  - Ruben Fleischer
Роли файл: "[[Кино/_system/Роли/Добро Пожаловать В Zомбилэнд.роли.md]]"
Описание: После нашествия зомби в США небольшая группа выживших скитается по стране от побережья к побережью, сражаясь с живыми мертвецами. Они решают остановиться в парке развлечений, надеясь, что там будут в безопасности.
imdb Id: tt1156398
poster: https://m.media-amazon.com/images/M/MV5BMTU5MDg0NTQ1N15BMl5BanBnXkFtZTcwMjA4Mjg3Mg@@._V1_SX300.jpg
Франшиза: "[[Кино/Франшизы/Зомбилэнд]]"
Кинопоиск ID: "427122"
Прогноз оценки: "6.0"
Прогноз уверенность: высокая
Прогноз метод: MovieLens + локальная интерполяция
Прогноз локальный: "7.4"
Прогноз MovieLens: "5.6"
---
проходной роад-мув, ничего особенного вообще.

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

![](https://m.media-amazon.com/images/M/MV5BMTU5MDg0NTQ1N15BMl5BanBnXkFtZTcwMjA4Mjg3Mg@@._V1_SX300.jpg)
