---
autor: Name
title: Name
date: <% tp.date.now("YYYY-MM-DD") %>
rating: 0-10
modify: <%tp.date.now("YYYY-MM-DD HH:mm")%>
---

Date: <% tp.date.now("YYYY-MM-DD") %>
Modified: <%* tp.date.now("YYYY-MM-DD HH:mm") %>

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
>[\_\_index](__index.md#^s001)  
>[\_\_index](__index.md#^s002)  
>[\_\_index](__index.md#^s003)  
>[\_\_index](__index.md#^s004)  
>[\_\_index](__index.md#^s005)  
>[\_\_index](__index.md#^s006)  
>[\_\_index](__index.md#^s007)  
>[\_\_index](__index.md#^s008)  
>[\_\_index](__index.md#^s009)  
>[\_\_index](__index.md#^s010)  
>[\_\_index](__index.md#^s011)  
>[\_\_index](__index.md#^s012)  
>[\_\_index](__index.md#^s013)  
>[\_\_index](__index.md#^s014)  
>[\_\_index](__index.md#^s015)  
>[\_\_index](__index.md#^s016)  
>[\_\_index](__index.md#^s017)  
>[\_\_index](__index.md#^s018)  
>[\_\_index](__index.md#^s019)  
>[\_\_index](__index.md#^s020)  
>[\_\_index](__index.md#^s021)  
>[\_\_index](__index.md#^s022)  
>[\_\_index](__index.md#^s023)  
>[\_\_index](__index.md#^s024)  
>[\_\_index](__index.md#^s025)  
>[\_\_index](__index.md#^s026)  
>[\_\_index](__index.md#^s027)  
>[\_\_index](__index.md#^s028)  
>[\_\_index](__index.md#^s029)  
>[\_\_index](__index.md#^s030)  
>[\_\_index](__index.md#^s031)  
>[\_\_index](__index.md#^s032)  
>[\_\_index](__index.md#^s033)  
>[\_\_index](__index.md#^s034)  
>[\_\_index](__index.md#^s035)  
>[\_\_index](__index.md#^s036)  
>[\_\_index](__index.md#^s037)  
>[\_\_index](__index.md#^s038)  
>[\_\_index](__index.md#^s039)  
>[\_\_index](__index.md#^s040)  
>[\_\_index](__index.md#^s041)  
>[\_\_index](__index.md#^s042)  
>[\_\_index](__index.md#^s043)  
>[\_\_index](__index.md#^s044)  
>[\_\_index](__index.md#^s045)  
>[\_\_index](__index.md#^s046)  
>[\_\_index](__index.md#^s047)  
>[\_\_index](__index.md#^s048)  
>[\_\_index](__index.md#^s049)  
>[\_\_index](__index.md#^s050)

