---
Название: "El Camino: A Breaking Bad Movie"
Просмотрено: 2019-12-20
Оценка: "8"
Оценка Imdb: "7.3"
Оценка Кинопоиск: 7.2
Количество голосов Кинопоиск: 107880
Количество голосов Imdb: 352505
tags:
  - movies
Жанр:
  - Drama
  - Crime
Релиз: 2019-10-12
Время: 122 min
Режисер:
  - Vince Gilligan
Роли файл: "[[Кино/_system/Роли/El Camino - Фильм по мотивам сериала 'Во все тяжкие'.роли.md]]"
Описание: Джесси Пинкман сбежал от неонацистов. Не зная, куда ему податься, он скрывается от полиции, похитителей и прошлого. Теперь он должен понять, как ему жить дальше.
imdb Id: tt9243946
poster: https://m.media-amazon.com/images/M/MV5BYTYxMjI2YzUtODQ5Mi00M2JmLTlmNzItOTlkM2MyM2ExM2RlXkEyXkFqcGc@._V1_.jpg
Кинопоиск ID: "1209193"
Франшиза: "[[Кино/Франшизы/Во все тяжкие]]"
Прогноз оценки: "6.9"

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

![](https://m.media-amazon.com/images/M/MV5BYTYxMjI2YzUtODQ5Mi00M2JmLTlmNzItOTlkM2MyM2ExM2RlXkEyXkFqcGc@._V1_.jpg)
