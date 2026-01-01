---
obsidianUIMode: preview
---

```dataview
TABLE WITHOUT ID 
	autor AS "Автор",
	title AS "Название",
	rating AS "⭐",
	date AS "Дата",
	file.link AS "Файл"
FROM "Книги/Художественные"
where title != null
SORT date DESC
```


```dataview
TABLE WITHOUT ID 
	title AS "Название",
	autor AS "Автор",
	rating AS "⭐",
	date AS "Дата",
	file.link AS "Файл"
FROM "Obsidi/Книги/Художественные"
where title != null
SORT date DESC
```
