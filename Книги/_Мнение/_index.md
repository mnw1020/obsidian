# по Названию 
```dataview
TABLE WITHOUT ID 
	title AS "Название",
	autor AS "Автор",
	raiting AS "Рейтинг",
	date AS "Дата",
	file.link AS "Файл"
FROM "Книги/_Мнение"
SORT title ASC
```
# по Автору
```dataview
TABLE WITHOUT ID 
	title AS "Название",
	autor AS "Автор",
	raiting AS "Рейтинг",
	date AS "Дата",
	file.link AS "Файл"
FROM "Книги/_Мнение"
SORT autor ASC
```
# по Рейтингу
```dataview
TABLE WITHOUT ID 
	title AS "Название",
	autor AS "Автор",
	raiting AS "Рейтинг",
	date AS "Дата",
	file.link AS "Файл"
FROM "Книги/_Мнение"
SORT raiting ASC
```
# по Дате
```dataview
TABLE WITHOUT ID 
	title AS "Название",
	autor AS "Автор",
	raiting AS "Рейтинг",
	date AS "Дата",
	file.link AS "Файл"
FROM "Книги/_Мнение"
SORT date ASC
```