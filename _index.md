```dataview
TABLE file.mtime as Edited 
FROM ""
WHERE date(now) - file.mtime <= dur(3 days) and file.name != "_index"
SORT file.mtime desc
```
<br>

```dataview
TABLE file.ctime as Created
FROM ""
WHERE date(now) - file.ctime <= dur(3 days)
SORT file.ctime desc
```

-tx-
|        hotkeys        |         comment          |
|:---------------------:|:------------------------:|
|       ***GIT***       ||
|   `ctrl + alt + g`    |        git commit        |
|    `trl + alt + p`    |         git push         |
|  `ctrl + shift + p`   |         git pull         |
|      ***Текст***      ||
|       `alt + ↑`       | переместить строку вверх |
|       `alt + ↓`       | переместить строку вниз  |
|       `alt + ё`       |  форматировать как код   |
|      `shift + h`      |     подсветка текста     |
|      `ctrl + h`       |      поиск и замена      |
|   `alt + shift + \`   |    вертикальная черта    |
|     ***Прочее***      ||
|      `ctrl + t`       |  открыть файл в typora   |
| `ctrl + m (hotkey++)` |      чекбокс-список      |
|      `shift + q`      |     вставить шаблон      |
|     `ctrl + 0-6`      |  превратить в заголовок  |
|       `alt + q`       |      развернуть все      |
|       `alt + w`       |       свернуть все       |
|       ++alt+a++       |  @ переход на заголовок  |