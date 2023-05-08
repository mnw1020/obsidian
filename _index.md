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
<br><br>

|        hotkeys        |         comment          |
|:---------------------:|:------------------------:|
|       ***GIT***       ||
|   `ctrl + alt + g`    |        git commit        |
|   `ctrl + alt + p`    |         git push         |
|      `ctrl + s`       |         git save         |
|  `ctrl + shift + p`   |         git pull         |
|      ***Текст***      ||
|       `alt + ↑`       | переместить строку вверх |
|       `alt + ↓`       | переместить строку вниз  |
|       `alt + ё`       |  форматировать как код   |
|       `alt + #`       |           `#`            |
|   `alt + shift + \`   |           `|`            |
|     ***Прочее***      ||
|      `ctrl + t`       |  открыть файл в typora   |
| `ctrl + m (hotkey++)` |      чекбокс-список      |
|       `Ctrl+l`        |   Раскрывающийся блок    |
|      `shift + q`      |     вставить шаблон      |
|     `ctrl + 0-6`      |  превратить в заголовок  |
|       `alt + q`       |      развернуть все      |
|       `alt + w`       |       свернуть все       |
|        `alt+a`        |  @ переход на заголовок  |