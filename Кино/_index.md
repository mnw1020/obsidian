---
obsidianUIMode: preview
cssclasses: cards
---


```button
name 🎬 Добавить
type command
action QuickAdd: movie_imdb
color blue 
```

---
# Фильм
```dataview
table without id
	("![|64](" + poster + ")") as "Poster",
	file.link as "Название",
	dateformat(Просмотрено, "dd.MM.yyyy") as "Просмотрено",
	Оценка as "⭐"
from "Кино"
where poster != null
WHERE contains(tags, "movies")
Sort file.link ASC
```

# Сериал
```dataview
table without id
	("![|64](" + poster + ")") as "Poster",
	file.link as "Название",
	dateformat(Просмотрено, "dd.MM.yyyy") as "Просмотрено",
	Оценка as "⭐"
from "Кино"
where poster != null
WHERE contains(tags, "serial")
Sort file.link ASC
```
