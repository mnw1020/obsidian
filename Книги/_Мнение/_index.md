---
obsidianUIMode: preview
---

```dataview
TABLE WITHOUT ID 
	title AS "Название",
	autor AS "Автор",
	rating AS "⭐",
	date AS "Дата",
	file.link AS "Файл"
FROM "Книги/_Мнение"
where title != null
SORT title ASC
```


```dataview
TABLE WITHOUT ID 
	title AS "Название",
	autor AS "Автор",
	rating AS "⭐",
	date AS "Дата",
	file.link AS "Файл"
FROM "Obsidi/Книги/_Мнение"
where title != null
SORT title ASC
```
