const fs = require('node:fs');
const path = require('node:path');
const target = path.join(__dirname, '../QuickAdd/add_book.js');
let source = fs.readFileSync(target, 'utf8');
source = source.replace('    const { Notice, normalizePath } = obsidian;', `    const { Notice, normalizePath } = obsidian;
    const coreFile = app.vault.getAbstractFileByPath("Книги/_system/book_core.js");
    if (!coreFile) throw new Error("Не найден общий модуль библиотеки.");
    const coreModule = { exports: {} };
    new Function("module", await app.vault.read(coreFile))(coreModule);
    const core = coreModule.exports({ app, obsidian });
    const bookSnapshot = core.snapshot();
    const bookFiles = bookSnapshot.map(item => item.file);`);
function replaceFunction(name, replacement) {
    const start = source.indexOf(`    function ${name}(`);
    const asyncStart = source.indexOf(`    async function ${name}(`);
    const offset = start >= 0 ? start : asyncStart;
    if (offset < 0) throw new Error(`Missing function ${name}`);
    const next = source.indexOf('\n    }', offset) + '\n    }'.length;
    source = source.slice(0, offset) + replacement + source.slice(next);
}
replaceFunction('getFrontmatter', '    const getFrontmatter = core.getFrontmatter;');
replaceFunction('isBook', '    const isBook = core.isBook;');
replaceFunction('isFiction', '    const isFiction = core.isFiction;');
replaceFunction('updateHomeStats', '    const updateHomeStats = core.updateHomeStats;');
replaceFunction('displayDate', '    const displayDate = core.displayDate;');
replaceFunction('isValidDate', '    const isValidDate = core.isValidDate;');
source = source.replaceAll('app.vault.getMarkdownFiles()', 'bookFiles');
source = source.replace('if (active?.path === AUTHOR_PAGE)', 'if (getFrontmatter(active).selected_author)');
source = source.replace('if (active?.path === SERIES_PAGE)', 'if (getFrontmatter(active).selected_series)');
const start = source.indexOf('    const workType = await quickAddApi.suggester(');
const finish = source.indexOf('    const matches = matchingBooks(title, authors);', start);
source = source.slice(0, start) + `    const form = [
        { id: "section", label: "Раздел", type: "dropdown", options: ["Художественные", "Non-fiction"], defaultValue: isFiction(active) || !isBook(active) ? "Художественные" : "Non-fiction" },
        { id: "workType", label: "Тип произведения", type: "dropdown", options: ["Книга", "Рассказ", "Лекция", "Статья"], defaultValue: "Книга" },
        { id: "authors", label: "Автор(ы)", type: "suggester", options: existingAuthorNames(), defaultValue: defaultAuthor, suggesterConfig: { allowCustomInput: true, multiSelect: true, caseSensitive: false } },
        { id: "title", label: "Название произведения", type: "text" },
        { id: "date", label: "Дата чтения", type: "text", defaultValue: quickAddApi.date.now("YYYY-MM-DD"), placeholder: "YYYY-MM-DD, YYYY-MM или YYYY" },
        { id: "rating", label: "Оценка художественного произведения", type: "number", optional: true, numericConfig: { min: 1, max: 10, step: 1 } },
        { id: "comment", label: "Впечатления от чтения", type: "textarea", optional: true },
        { id: "series", label: "Серия", type: "suggester", options: existingSeriesNames(), defaultValue: defaultSeries, optional: true, suggesterConfig: { allowCustomInput: true, caseSensitive: false } },
        { id: "seriesIndex", label: "Номер в серии", type: "number", optional: true, numericConfig: { min: 1, step: 1 }, description: "Пусто — следующий номер из имеющихся карточек." }
    ];
    let values = {}, title, authors, date, rating, comment, section, workType, series, seriesIndex;
    for (let attempt = 0; ; attempt++) {
        // QuickAdd caches answers by id. Fresh ids keep correction dialogs editable.
        const fields = form.map(field => ({ ...field, id: field.id + "__book_" + attempt, defaultValue: values[field.id] ?? field.defaultValue }));
        const answer = await quickAddApi.requestInputs(fields);
        if (!answer) return;
        values = Object.fromEntries(form.map(field => [field.id, answer[field.id + "__book_" + attempt] ?? answer[field.id] ?? ""]));
        title = String(values.title).trim();
        authors = String(values.authors).split(/[,;]+/).map(value => value.trim()).filter(Boolean);
        date = String(values.date).trim().replace(/^@date:/, "");
        section = values.section || "Художественные";
        workType = ({ Книга: "", Рассказ: "story", Лекция: "lecture", Статья: "article" })[values.workType || "Книга"];
        series = String(values.series).trim();
        const rawIndex = String(values.seriesIndex).trim();
        seriesIndex = series ? (rawIndex ? Number(rawIndex) : Math.max(0, ...bookFiles.map(file => getFrontmatter(file)).filter(fm => String(fm.series ?? "").trim() === series).map(fm => Number(fm.series_index)).filter(Number.isFinite)) + 1) : null;
        const rawRating = String(values.rating ?? "").trim();
        const numericRating = Number(rawRating);
        const errors = [];
        if (!title) errors.push("Укажи название произведения.");
        if (!authors.length) errors.push("Укажи автора.");
        if (!isValidDate(date)) errors.push("Дата: YYYY-MM-DD, YYYY-MM или YYYY.");
        if (!["Художественные", "Non-fiction"].includes(section) || workType === undefined) errors.push("Выбери раздел и тип произведения.");
        if (section === "Художественные" && rawRating && (!Number.isInteger(numericRating) || numericRating < 1 || numericRating > 10)) errors.push("Оценка должна быть целым числом от 1 до 10.");
        if (series && (!Number.isInteger(seriesIndex) || seriesIndex < 1)) errors.push("Номер в серии должен быть положительным целым числом.");
        if (!series && rawIndex) errors.push("Для номера сначала укажи серию.");
        if (errors.length) { new Notice(errors.join("\\n"), 7000); continue; }
        const confirmed = await confirmAuthors(authors);
        if (!confirmed) return;
        authors = confirmed;
        if (series) { series = await confirmNewSeries(series); if (!series) return; }
        rating = section === "Художественные" && rawRating ? numericRating : null;
        comment = String(values.comment).trim();
        break;
    }

` + source.slice(finish);
const seriesStart = source.indexOf('    // Серия выбирается ПОСЛЕ автора.');
const seriesEnd = source.indexOf('    const sectionFolder =', seriesStart);
source = source.slice(0, seriesStart) + `    if (series && bookFiles.some(file => {
        const fm = getFrontmatter(file);
        return String(fm.series ?? "").trim() === series && Number(fm.series_index) === seriesIndex;
    })) {
        new Notice("Этот номер уже занят в серии. Запиши произведение с другим номером.", 7000);
        return;
    }

` + source.slice(seriesEnd);
source = source.replace('await app.vault.rename(legacyFile, movedPath);', 'await app.fileManager.renameFile(legacyFile, movedPath);\n                    await appendStructureJournal(`Перенесена карточка: ${legacyFile.path} → ${movedPath}.`);');
source = source.replace('        const current = await app.vault.read(file);\n        await app.vault.modify(file, current.replace(/\\s*$/, "\\n\\n") + block);', '        await app.vault.process(file, current => current.replace(/\\s*$/, "\\n\\n") + block);');
source = source.replace(/        let fm = getFrontmatter\(bookFile\);\n        for \(let attempt = 0; attempt < 6 && !fm.title; attempt\+\+\) \{[\s\S]*?\n        \}/, '        const fm = await core.refreshFrontmatter(bookFile);');
source = source.replace('    const bookFile = await app.vault.create(filePath, content);', '    const bookFile = await app.vault.create(filePath, content);\n    await core.refreshFrontmatter(bookFile);');
source = source.replace('[📖 Чтение]', '[📖 Записать чтение]').replace('[✏️ Изменить]', '[✏️ Редактировать чтение]');
source = source.replace('const actions =\n', 'const actions =\n            "[💡 Сохранить выписку](obsidian://quickadd?choice=" + encodeURIComponent("Книги - Добавить выписку") + ") · " +\n');
fs.writeFileSync(target, source);
