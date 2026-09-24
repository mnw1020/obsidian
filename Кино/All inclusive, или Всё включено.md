---
Название: All inclusive, или Всё включено
Просмотрено: 2012-11-15
Оценка: "3"
Оценка Imdb: "4.6"
Оценка Кинопоиск: 5.1
Количество голосов Кинопоиск: 23144
Количество голосов Imdb: 456
tags:
  - movies
Жанр:
  - Comedy
  - Romance
Релиз: 2011-06-09
Время: 96 min
Режисер:
  - Eduard Radzyukevich
Роли файл: Кино/_system/Роли/All inclusive, или Всё включено.роли.md
Описание: "Жизнь Андрея – владельца дорогой и востребованной ветеринарной клиники для домашних животных с Рублевки – определенно удалась. Мало того, он не обделен вниманием и прекрасных хозяек милых зверюшек. Но страстная ночь с женой олигарха Эвелиной меняет все: ревнивый муж Эдик очень доходчиво объясняет, что изменит сладкую жизнь успешного бизнесмена.Единственный выход – это побег из страны. И Андрей уезжает в Турцию по программе «Все включено», не подозревая, что в нее включено намного больше, чем кажется на первый взгляд. За ним по пятам следует австрийский киллер Рудольф, а солнечные пляжи таят самое главное испытание в жизни…"
imdb Id: tt1846473
poster: https://m.media-amazon.com/images/M/MV5BYWE1NTU4NzAtYzdiYy00M2U2LTk3MGItN2VmNjk1NjBkYzRkXkEyXkFqcGc@._V1_.jpg
Франшиза: "[[Кино/Франшизы/Всё включено]]"
Кинопоиск ID: "521637"
Прогноз оценки: "4.5"
Прогноз уверенность: высокая
Прогноз метод: локальная интерполяция
Прогноз локальный: "4.5"
---
<!-- KINO:ROLES:EMBED:V1 -->
![[Кино/_system/Роли/All inclusive, или Всё включено.роли]]
<!-- KINO:RECOMMEND:BUTTON:V1 -->
```dataviewjs
const currentPath = dv.current()?.file?.path || "";
const wrap = dv.container.createDiv({ cls: "kino-recommend-action" });
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
![](https://m.media-amazon.com/images/M/MV5BYWE1NTU4NzAtYzdiYy00M2U2LTk3MGItN2VmNjk1NjBkYzRkXkEyXkFqcGc@._V1_.jpg)
