---
obsidianUIMode: preview
tags:
  - franchise
Порядок: выход
cssclasses: ["kino-page","kino-franchise"]
---

<!-- KINO:UI:START -->
```dataviewjs
try {
    const file = app.vault.getAbstractFileByPath("Кино/_system/kino_ui.js");
    if (!file) throw new Error("Не найден интерфейс кинотеки");
    const kinoModule = { exports: {} };
    new Function("module", "exports", await app.vault.read(file))(kinoModule, kinoModule.exports);
    await kinoModule.exports({ dv, app, obsidian: typeof require === 'function' ? require('obsidian') : {}, kind: "franchise" });
} catch (error) {
    dv.paragraph("Интерфейс кинотеки временно недоступен. Данные карточки сохранены.");
    console.warn("Кино: интерфейс", error);
}
```
<!-- KINO:UI:END -->

# Киновселенная Marvel

## Общее впечатление

<!-- FRANCHISE:TABLE:v2 -->
## Произведения

```dataviewjs
const file = app.vault.getAbstractFileByPath("Кино/_system/franchise_order.js");
if (!file) throw new Error("Не найден скрипт порядка франшиз.");
const mod = { exports: {} };
new Function("module", "exports", await app.vault.read(file))(mod, mod.exports);
await mod.exports.render({ dv, app });
```

<!-- FRANCHISE:SOURCES:2026-09 -->
## О связи произведений

Здесь отдельные произведения MCU; циклы о конкретных героях доступны по ссылкам ниже.

[Источник: Киновселенная Marvel](https://en.wikipedia.org/wiki/Marvel_Cinematic_Universe)

## Связанные циклы и вселенные

- [[Кино/Франшизы/Железный человек|Железный человек]]
- [[Кино/Франшизы/Тор|Тор]]
- [[Кино/Франшизы/Первый мститель|Первый мститель]]
- [[Кино/Франшизы/Мстители|Мстители]]
- [[Кино/Франшизы/Доктор Стрэндж|Доктор Стрэндж]]
- [[Кино/Франшизы/Капитан Марвел|Капитан Марвел]]
- [[Кино/Франшизы/Человек-паук — MCU|Человек-паук — MCU]]
- [[Кино/Франшизы/Человек-муравей|Человек-муравей]]
- [[Кино/Франшизы/Чёрная пантера|Чёрная пантера]]
- [[Кино/Франшизы/Стражи Галактики|Стражи Галактики]]
- [[Кино/Франшизы/Дэдпул|Дэдпул]]
