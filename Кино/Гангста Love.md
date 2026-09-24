---
Название: Rob the Mob
Просмотрено: 2014-12-03
Оценка: "4"
Оценка Imdb: "6.3"
Оценка Кинопоиск: 6.4
Количество голосов Кинопоиск: 4615
Количество голосов Imdb: 12456
tags:
  - movies
Жанр:
  - Biography
Релиз: 2015-01-12
Время: 100 min
Режисер:
  - Raymond De Felitta
Роли файл: Кино/_system/Роли/Гангста Love.роли.md
Описание: Парочка молодых влюбленных, мечтая скопить деньги на свадьбу, решает совершить серию дерзких ограблений клубов, где собираются мафиози. Их план прост – чтобы они ни натворили, мафия не будет жаловаться в полицию. Местные «братаны» не могут поверить своим глазам, когда их обчищают до нитки какие-то «сопляки». Больше того, случайно, у них похищают важную улику, которой очень интересуется ФБР. Теперь за налетчиками начинается настоящая охота...
imdb Id: tt2481480
poster: https://m.media-amazon.com/images/M/MV5BMjE4MTE4MTEyNl5BMl5BanBnXkFtZTgwMjIwNTgwMTE@._V1_.jpg
Кинопоиск ID: "714718"
Прогноз оценки: "5.7"
Прогноз уверенность: высокая
Прогноз метод: локальная интерполяция
Прогноз локальный: "5.7"
---
скука

---

<!-- KINO:ROLES:EMBED:V2 -->
<details class="kino-roles-details">
<summary>🎭 Роли</summary>

![[Кино/_system/Роли/Гангста Love.роли]]

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

![](https://m.media-amazon.com/images/M/MV5BMjE4MTE4MTEyNl5BMl5BanBnXkFtZTgwMjIwNTgwMTE@._V1_.jpg)
