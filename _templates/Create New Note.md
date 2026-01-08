<%*
// Имя нового файла с текущей датой и временем
const folder = "_temp/new";
const fileName = tp.date.now("YYYY-MM-DD HH-mm");
const filePath = `${folder}/${fileName}.md`;

// Создаём новый файл
await tp.file.create_new(filePath);

// Вставляем содержимое конкретного шаблона (например Тег.md)
await tp.file.append(filePath, await tp.file.include("_templates/Тег.md"));

// Открываем новый файл
await tp.file.open(filePath);
%>
