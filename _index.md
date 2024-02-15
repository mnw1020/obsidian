а
```button
name new ввnote
type note(_temp/2023-08-15) template
templater true
action Тег
color blue
```

```button
name new note (Android)
type note(Obsidi/_temp/2023-08-15) template
templater true
action Тег
color blue
```

---
# Измененные заметки:
```dataview
TABLE file.mtime as Edited 
FROM ""
WHERE date(now) - file.mtime <= dur(3 days) and file.name != "_index"
SORT file.mtime desc
```

---
# Новые заметки:
```dataview
TABLE file.ctime as Created
FROM ""
WHERE date(now) - file.ctime <= dur(3 days)
SORT file.ctime desc
```

---
# Hotkey:

|        hotkeys        |         comment          |
|:---------------------:|:------------------------:|
|       ***GIT***       |                          |
|   `ctrl + alt + g`    |        git commit        |
|   `ctrl + alt + p`    |         git push         |
|      `ctrl + s`       |         git save         |
|  `ctrl + shift + p`   |         git pull         |
|      ***Текст***      |                          |
|       `alt + ↑`       | переместить строку вверх |
|       `alt + ↓`       | переместить строку вниз  |
|       `alt + ё`       |  форматировать как код   |
|       `alt + #`       |           `#`            |
|   `alt + shift + \`   |           `|`            |
|     ***Прочее***      |                          |
|      `ctrl + t`       |  открыть файл в typora   |
| `ctrl + m (hotkey++)` |      чекбокс-список      |
|       `Ctrl+l`        |   Раскрывающийся блок    |
|      `shift + q`      |     вставить шаблон      |
|     `ctrl + 0-6`      |  превратить в заголовок  |
|       `alt + q`       |      развернуть все      |
|       `alt + w`       |       свернуть все       |
|        `alt+a`        |  @ переход на заголовок  |


# Help
## dataview
TABLE WITHOUT ID // TABLE или LIST
	title AS "Название", // Колонки
	autor AS "Автор",
	file.link AS "Файл"
FROM "Книги" // Откуда брать инфу
where !contains(file.folder,"Мнение") // Что исключать
where title != null
SORT title ASC // Сортировка

# Символы
—