```dataview
TABLE WITHOUT ID 
	title AS "Название",
	autor AS "Автор",
	file.link AS "Файл"
FROM "Книги"
where !contains(file.folder,"_Мнение")
SORT title ASC
```
