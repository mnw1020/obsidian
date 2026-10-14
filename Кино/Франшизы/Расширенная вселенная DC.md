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

# Расширенная вселенная DC

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

Общие фильмы вселенной; серии об Аквамене, Чудо-женщине и Шазаме — на связанных страницах.

[Источник: Расширенная вселенная DC](https://en.wikipedia.org/wiki/DC_Extended_Universe)

## Связанные циклы и вселенные

- [[Кино/Франшизы/Аквамен|Аквамен]]
- [[Кино/Франшизы/Чудо-женщина|Чудо-женщина]]
- [[Кино/Франшизы/Шазам|Шазам]]
