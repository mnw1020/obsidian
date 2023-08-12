# по Названию
```dataview
TABLE WITHOUT ID 
	title AS "Название",
	autor AS "Автор",
	date AS "Дата",
	file.link AS "Файл"
FROM "Книги"
where !contains(file.folder,"_Мнение")
SORT title ASC
```
