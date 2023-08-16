---
obsidianUIMode: preview
---

```dataview
TABLE WITHOUT ID 
	title AS "Название",
	autor AS "Автор",
	date AS "Дата",
	file.link AS "Файл"
FROM "Книги"
where !contains(file.folder,"_Мнение")
where title != null
SORT title ASC
```



```dataview
TABLE WITHOUT ID 
	title AS "Название",
	autor AS "Автор",
	date AS "Дата",
	file.link AS "Файл"
FROM "Obsidi/Книги"
where !contains(file.folder,"_Мнение")
where title != null
SORT title ASC
```
