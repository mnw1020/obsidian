---
obsidianUIMode: preview
---

```dataview
TABLE WITHOUT ID 
	title AS "Название",
	autor AS "Автор",
	date AS "Дата",
	rating AS "⭐",
	file.link AS "Файл"
FROM "Книги/Non-fiction"
where title != null
SORT date DESC
```



```dataview
TABLE WITHOUT ID 
	title AS "Название",
	autor AS "Автор",
	date AS "Дата",
	rating AS "⭐",
	file.link AS "Файл"
FROM "Obsidi/Non-fiction"
where title != null
SORT date DESC
```
