```dataview
TABLE WITHOUT ID 
	file.link AS "Файл",
	autor AS "Автор",
	title AS "Название"
FROM "Книги"
where !contains(file.folder,"_Мнение")
SORT title ASC
```
