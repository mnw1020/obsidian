---
autor: Name
title: Name
date: <% tp.date.now("YYYY-MM-DD") %>
rating: 0-10
modify: <%tp.date.now("YYYY-MM-DD HH:mm")%>
---
а
```button
name Создать заметку
type note(_temp/<% tp.date.now("YYYY-MM-DD HH-mm") %>)
template
templater true
action Тег
color blue
```

```button
name Создать заметку2
type command
action "templater-templates:insert-templater-template"
templater true
color blue
```

---
# Измененные заметки:
```dataview
TABLE dateformat(file.mtime, "dd.MM.yyyy HH:mm") as "Редактировано"
FROM ""
WHERE date(now) - file.mtime <= dur(3 days) and file.name != "_index"
SORT file.mtime desc
```


---
# Новые заметки:
```dataview
TABLE dateformat(file.mtime, "dd.MM.yyyy HH:mm") as "Создано"
FROM ""
WHERE date(now) - file.ctime <= dur(3 days)
SORT file.ctime desc
```

---
# Hotkey:

|        hotkeys        |         comment          |     |
| :-------------------: | :----------------------: | --- |
|       ***GIT***       |                          |     |
|   `ctrl + alt + g`    |        git commit        |     |
|   `ctrl + alt + p`    |         git push         |     |
|      `ctrl + s`       |         git save         |     |
|  `ctrl + shift + p`   |         git pull         |     |
|      ***Текст***      |                          |     |
|       `alt + ↑`       | переместить строку вверх |     |
|       `alt + ↓`       | переместить строку вниз  |     |
|       `alt + ё`       |  форматировать как код   |     |
|       `alt + #`       |           `#`            |     |
|   `alt + shift + \`   |            `             | `   |
|     ***Прочее***      |                          |     |
|      `ctrl + t`       |  открыть файл в typora   |     |
| `ctrl + m (hotkey++)` |      чекбокс-список      |     |
|       `Ctrl+l`        |   Раскрывающийся блок    |     |
|      `shift + q`      |     вставить шаблон      |     |
|     `ctrl + 0-6`      |  превратить в заголовок  |     |
|       `alt + q`       |      развернуть все      |     |
|       `alt + w`       |       свернуть все       |     |
|        `alt+a`        |  @ переход на заголовок  |     |

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

# Оглавление
>[!abstract]+ Оглавление
>[](#^s001)  
>[](#^s002)  
>[](#^s003)  
>[](#^s004)  
>[](#^s005)  
>[](#^s006)  
>[](#^s007)  
>[](#^s008)  
>[](#^s009)  
>[](#^s010)  
>[](#^s011)  
>[](#^s012)  
>[](#^s013)  
>[](#^s014)  
>[](#^s015)  
>[](#^s016)  
>[](#^s017)  
>[](#^s018)  
>[](#^s019)  
>[](#^s020)  
>[](#^s021)  
>[](#^s022)  
>[](#^s023)  
>[](#^s024)  
>[](#^s025)  
>[](#^s026)  
>[](#^s027)  
>[](#^s028)  
>[](#^s029)  
>[](#^s030)  
>[](#^s031)  
>[](#^s032)  
>[](#^s033)  
>[](#^s034)  
>[](#^s035)  
>[](#^s036)  
>[](#^s037)  
>[](#^s038)  
>[](#^s039)  
>[](#^s040)  
>[](#^s041)  
>[](#^s042)  
>[](#^s043)  
>[](#^s044)  
>[](#^s045)  
>[](#^s046)  
>[](#^s047)  
>[](#^s048)  
>[](#^s049)  
>[](#^s050)

