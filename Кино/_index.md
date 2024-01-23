---
cssClasses: cards, cards-cover, cards-1-1, table-max, cards-cols-4
---


```button
name 🎬 Добавить
type command
action QuickAdd: movie_imdb
color blue 
```

```dataview
table without id
	("![|64](" + poster + ")") as "Poster",
	file.link as "Название",
	watchlist as "Просмотрено",
	scoreImdb as "⭐ IMDB",
	rating as "⭐"
from "Кино"
where poster != null
where completed = "да"
Sort watchlist ASC
```

```dataview
table without id
	("![](" + poster + ")") as "Poster",
	file.link as "Название",
	watchlist as "Просмотрено",
	scoreImdb as "⭐ IMDB",
	rating as "⭐"
from "Obsidi/Кино"
where poster != null
where completed = "да"
Sort watchlist ASC
```

