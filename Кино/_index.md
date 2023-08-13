```dataview
table without id
	("![](" + poster + ")") as "Poster",
	file.link as "Название",
	released as "Дата",
	director as "Режисер",
	scoreImdb as "⭐ IMDB",
	rating as "⭐",
	string(genre) as "Жанр",
	category as "Тип"
from "Кино"
where poster != null
Sort watchlist ASC
```

```button
name Добавить
type comand
action "QuickAdd: movie_imdb
color blue
```
