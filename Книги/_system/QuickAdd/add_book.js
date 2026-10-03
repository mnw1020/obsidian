module.exports = async (params) => {
    const { app, quickAddApi, obsidian } = params;
    const { Notice, normalizePath } = obsidian;
    const coreFile = app.vault.getAbstractFileByPath("Книги/_system/book_core.js");
    if (!coreFile) throw new Error("Не найден общий модуль библиотеки.");
    const coreModule = { exports: {} };
    new Function("module", await app.vault.read(coreFile))(coreModule);
    const core = coreModule.exports({ app, obsidian });
    const bookSnapshot = core.snapshot();
    const bookFiles = bookSnapshot.map(item => item.file);

    const BOOKS_ROOT = "Книги";
    const AUTHOR_PAGE = "Книги/_system/Автор.md";
    const SERIES_PAGE = "Книги/_system/Серия.md";
    const CHANGELOG_PATH = "Книги/_system/Журнал изменений.md";
    const HISTORY_START = "<!-- BOOK-READINGS:START -->";
    const HISTORY_END = "<!-- BOOK-READINGS:END -->";
    const COMMENT_MARK = "<!-- BOOK-READING:COMMENT -->";

    const yamlString = value => JSON.stringify(String(value ?? ""));
    const safeName = value => String(value ?? "").replace(/[\\/:*?"<>|]/g, "-").trim();

    const getFrontmatter = core.getFrontmatter;

    const isBook = core.isBook;

    const isFiction = core.isFiction;


    const updateHomeStats = core.updateHomeStats;

    function authorList(frontmatter) {
        const raw = frontmatter?.authors;
        if (!raw) return [];
        return (Array.isArray(raw) ? raw : [raw])
            .map(v => String(v).trim())
            .filter(Boolean);
    }

    function normalizeEntity(value) {
        return String(value ?? "")
            .trim()
            .toLocaleLowerCase("ru")
            .replace(/ё/g, "е")
            .replace(/[‐‑‒–—―]/g, "-")
            .replace(/[“”„«»'’`]/g, "")
            .replace(/[.,:;!?]+$/g, "")
            .replace(/\s+/g, " ")
            .trim();
    }

    function authorTokenSignature(value) {
        return normalizeEntity(value)
            .split(" ")
            .map(part => part.trim())
            .filter(Boolean)
            .sort((a, b) => a.localeCompare(b, "ru"))
            .join(" ");
    }

    function authorSetSignature(authors) {
        return JSON.stringify([...new Set(authors.map(normalizeEntity).filter(Boolean))].sort());
    }

    function matchingBooks(title, authors) {
        const normalizedTitle = normalizeEntity(title);
        const authorSignature = authorSetSignature(authors);
        return bookFiles
            .filter(isBook)
            .filter(file => {
                const fm = getFrontmatter(file);
                return normalizeEntity(fm.title) === normalizedTitle &&
                    authorSetSignature(authorList(fm)) === authorSignature;
            })
            .sort((a, b) => a.path.localeCompare(b.path, "ru"));
    }

    function levenshtein(a, b) {
        const left = String(a ?? "");
        const right = String(b ?? "");
        if (left === right) return 0;
        if (!left.length) return right.length;
        if (!right.length) return left.length;
        const prev = Array.from({ length: right.length + 1 }, (_, i) => i);
        const curr = new Array(right.length + 1);
        for (let i = 1; i <= left.length; i++) {
            curr[0] = i;
            for (let j = 1; j <= right.length; j++) {
                const cost = left[i - 1] === right[j - 1] ? 0 : 1;
                curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
            }
            for (let j = 0; j <= right.length; j++) prev[j] = curr[j];
        }
        return prev[right.length];
    }

    function existingAuthorNames() {
        return [...new Set(
            bookFiles
                .filter(isBook)
                .flatMap(file => authorList(getFrontmatter(file)))
        )].sort((a, b) => a.localeCompare(b, "ru"));
    }

    function existingSeriesNames() {
        return [...new Set(
            bookFiles
                .filter(isBook)
                .map(file => String(getFrontmatter(file).series ?? "").trim())
                .filter(Boolean)
        )].sort((a, b) => a.localeCompare(b, "ru"));
    }

    function similarAuthors(input, knownNames) {
        const norm = normalizeEntity(input);
        const tokens = authorTokenSignature(input);
        return knownNames
            .filter(name => name !== input)
            .map(name => {
                const otherNorm = normalizeEntity(name);
                const exactish = norm === otherNorm || (tokens && tokens === authorTokenSignature(name));
                const distance = Math.abs(norm.length - otherNorm.length) <= 2 && Math.min(norm.length, otherNorm.length) >= 7
                    ? levenshtein(norm, otherNorm)
                    : 99;
                return { name, exactish, distance };
            })
            .filter(item => item.exactish || (item.distance > 0 && item.distance <= 2))
            .sort((a, b) => Number(b.exactish) - Number(a.exactish) || a.distance - b.distance || a.name.localeCompare(b.name, "ru"))
            .map(item => item.name);
    }

    function similarSeries(input, knownNames) {
        const norm = normalizeEntity(input);
        return knownNames
            .filter(name => name !== input)
            .map(name => {
                const otherNorm = normalizeEntity(name);
                const exactish = norm === otherNorm;
                const distance = Math.abs(norm.length - otherNorm.length) <= 2 && Math.min(norm.length, otherNorm.length) >= 6
                    ? levenshtein(norm, otherNorm)
                    : 99;
                return { name, exactish, distance };
            })
            .filter(item => item.exactish || (item.distance > 0 && item.distance <= 2))
            .sort((a, b) => Number(b.exactish) - Number(a.exactish) || a.distance - b.distance || a.name.localeCompare(b.name, "ru"))
            .map(item => item.name);
    }

    async function confirmAuthors(authors) {
        const known = existingAuthorNames();
        const result = [];
        for (const author of authors) {
            if (known.includes(author)) {
                result.push(author);
                continue;
            }
            const matches = similarAuthors(author, known);
            if (!matches.length) {
                result.push(author);
                continue;
            }
            const labels = [
                ...matches.map(name => `✓ Использовать существующего: ${name}`),
                `➕ Оставить новым: ${author}`
            ];
            const values = [...matches, author];
            const chosen = await quickAddApi.suggester(
                labels,
                values,
                `Похожий автор уже существует: ${author}`
            );
            if (!chosen) return null;
            result.push(String(chosen));
        }
        return [...new Set(result)];
    }

    async function confirmNewSeries(series) {
        const known = existingSeriesNames();
        if (!series || known.includes(series)) return series;
        const matches = similarSeries(series, known);
        if (!matches.length) return series;
        const labels = [
            ...matches.map(name => `✓ Использовать существующую: ${name}`),
            `➕ Оставить новой: ${series}`
        ];
        const chosen = await quickAddApi.suggester(
            labels,
            [...matches, series],
            `Похожая серия уже существует: ${series}`
        );
        return chosen ? String(chosen) : null;
    }

    async function ensureFolder(path) {
        const normalized = normalizePath(path);
        if (!app.vault.getAbstractFileByPath(normalized)) {
            await app.vault.createFolder(normalized);
        }
    }

    const displayDate = core.displayDate;

    const isValidDate = core.isValidDate;

    function renderEntry(number, date, rating, comment) {
        const ratingAttr = rating === null || rating === undefined ? "" : String(rating);
        let out = `<!-- BOOK-READING:START number="${number}" date="${date}" rating="${ratingAttr}" -->\n`;
        out += `### Чтение ${number}${date ? ` - ${displayDate(date)}` : ""}\n\n`;
        if (rating !== null && rating !== undefined) {
            out += `**Оценка:** ${rating}/10\n\n`;
        }
        out += `${COMMENT_MARK}\n`;
        if (comment) out += `${comment.trim()}\n`;
        out += "<!-- BOOK-READING:END -->";
        return out;
    }

    function historyBlock(date, rating, comment) {
        let content = `## История чтений\n\n${HISTORY_START}\n\n`;
        if (date) content += renderEntry(1, date, rating, comment) + "\n\n";
        else content += "_История пока пуста._\n\n";
        content += HISTORY_END + "\n";
        return content;
    }

    function cardPanel(hasSeries) {
        let nav =
            "[[Книги/_index|← Книги]] · " +
            "[👤 Автор](obsidian://quickadd?choice=%D0%9A%D0%BD%D0%B8%D0%B3%D0%B8%20-%20%D0%9E%D1%82%D0%BA%D1%80%D1%8B%D1%82%D1%8C%20%D0%B0%D0%B2%D1%82%D0%BE%D1%80%D0%B0)";
        if (hasSeries) {
            nav += " · [🧩 Серия](obsidian://quickadd?choice=%D0%9A%D0%BD%D0%B8%D0%B3%D0%B8%20-%20%D0%9E%D1%82%D0%BA%D1%80%D1%8B%D1%82%D1%8C%20%D1%81%D0%B5%D1%80%D0%B8%D1%8E)";
        }
        nav += " · [🎬 Экранизации](obsidian://quickadd?choice=%D0%9A%D0%BD%D0%B8%D0%B3%D0%B8%20-%20%D0%AD%D0%BA%D1%80%D0%B0%D0%BD%D0%B8%D0%B7%D0%B0%D1%86%D0%B8%D0%B8)";

        const actions =
            "[💡 Сохранить выписку](obsidian://quickadd?choice=" + encodeURIComponent("Книги - Добавить выписку") + ") · " +
            "[📖 Записать чтение](obsidian://quickadd?choice=%D0%9A%D0%BD%D0%B8%D0%B3%D0%B8%20-%20%D0%94%D0%BE%D0%B1%D0%B0%D0%B2%D0%B8%D1%82%D1%8C%20%D1%87%D1%82%D0%B5%D0%BD%D0%B8%D0%B5) · " +
            "[✏️ Редактировать чтение](obsidian://quickadd?choice=%D0%9A%D0%BD%D0%B8%D0%B3%D0%B8%20-%20%D0%A0%D0%B5%D0%B4%D0%B0%D0%BA%D1%82%D0%B8%D1%80%D0%BE%D0%B2%D0%B0%D1%82%D1%8C%20%D1%87%D1%82%D0%B5%D0%BD%D0%B8%D0%B5) · " +
            "[🎬 Кино](obsidian://quickadd?choice=%D0%9A%D0%BD%D0%B8%D0%B3%D0%B8%20-%20%D0%A1%D0%B2%D1%8F%D0%B7%D0%B0%D1%82%D1%8C%20%D1%81%20%D0%BA%D0%B8%D0%BD%D0%BE)";

        return [
            "> [!info] 🧭 Навигация",
            `> ${nav}`,
            "",
            "> [!abstract] ⚡ Действия",
            `> ${actions}`,
            "",
            ""
        ].join("\n");
    }

    async function lightCheckBook(bookFile, entries) {
        const fm = await core.refreshFrontmatter(bookFile);
        const issues = [];
        const title = String(fm.title ?? "").trim();
        const authorsRaw = Array.isArray(fm.authors) ? fm.authors : [fm.authors];
        const authors = authorsRaw.map(v => String(v ?? "").trim()).filter(Boolean);
        const series = String(fm.series ?? "").trim();
        const hasSeriesIndex = fm.series_index !== undefined && String(fm.series_index ?? "").trim() !== "";
        const seriesIndex = Number(fm.series_index);

        if (!title) issues.push("нет title");
        if (!authors.length) issues.push("нет authors");
        if (series && !hasSeriesIndex) issues.push("у серии нет series_index");
        if (!series && hasSeriesIndex) issues.push("series_index есть без series");
        if (series && hasSeriesIndex && (!Number.isInteger(seriesIndex) || seriesIndex < 1)) {
            issues.push("некорректный series_index");
        }

        const readCount = Number(fm.read_count);
        if (!Number.isInteger(readCount) || readCount !== entries.length) {
            issues.push(`read_count=${String(fm.read_count ?? "пусто")}, записей=${entries.length}`);
        }

        for (const entry of entries) {
            if (!isValidDate(String(entry.date ?? ""))) issues.push(`ошибка даты чтения #${entry.number}`);
        }

        const chronological = [...entries].sort((a, b) => {
            const byDate = String(a.date ?? "").localeCompare(String(b.date ?? ""));
            return byDate !== 0 ? byDate : Number(a.number) - Number(b.number);
        });
        const latest = chronological.length ? chronological[chronological.length - 1] : null;
        const latestRated = [...chronological].reverse().find(entry => entry.rating !== null && entry.rating !== undefined) || null;

        if (latest && String(fm.date ?? "").trim() !== String(latest.date ?? "").trim()) {
            issues.push("date не совпадает с последним чтением");
        }
        if (isFiction(bookFile)) {
            const fmRating = fm.rating === undefined || fm.rating === "" ? null : Number(fm.rating);
            const expectedRating = latestRated ? Number(latestRated.rating) : null;
            if (fmRating !== expectedRating) issues.push("rating не совпадает с последней оценкой");
        } else if (Object.prototype.hasOwnProperty.call(fm, "rating")) {
            issues.push("rating у Non-fiction");
        }

        let text = "";
        try {
            text = await app.vault.read(bookFile);
        } catch (error) {
            issues.push("файл не читается");
        }
        if (text) {
            const starts = (text.match(/<!-- BOOK-READING:START /g) || []).length;
            const ends = (text.match(/<!-- BOOK-READING:END -->/g) || []).length;
            if (!text.includes(HISTORY_START) || !text.includes(HISTORY_END)) issues.push("нет блока BOOK-READINGS");
            if (starts !== entries.length || ends !== entries.length) issues.push("маркеры чтений не совпадают с историей");
        }

        if (series && Number.isInteger(seriesIndex) && seriesIndex > 0) {
            const conflicts = bookFiles
                .filter(isBook)
                .filter(file => file.path !== bookFile.path)
                .filter(file => {
                    const other = getFrontmatter(file);
                    return String(other.series ?? "").trim() === series && Number(other.series_index) === seriesIndex;
                });
            if (conflicts.length) issues.push(`номер ${seriesIndex} уже есть в серии «${series}»`);
        }

        return [...new Set(issues)];
    }

    async function appendStructureJournal(line) {
        const now = new Date();
        const pad = value => String(value).padStart(2, "0");
        const iso = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
        const stamp = `${pad(now.getDate())}.${pad(now.getMonth() + 1)}.${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
        let block = `<!-- BOOK-LIBRARY-EVENT at="${iso}" normalization="false" structure="true" -->\n`;
        block += `## ${stamp}\n\n- ${line}\n\n`;
        const path = normalizePath(CHANGELOG_PATH);
        let file = app.vault.getAbstractFileByPath(path);
        if (!file) {
            file = await app.vault.create(path, "# Журнал изменений\n\n[[Книги/_index|← Книги]] · [👥 Авторы](obsidian://quickadd?choice=%D0%9A%D0%BD%D0%B8%D0%B3%D0%B8%20-%20%D0%90%D0%B2%D1%82%D0%BE%D1%80%D1%8B) · [🧩 Серии](obsidian://quickadd?choice=%D0%9A%D0%BD%D0%B8%D0%B3%D0%B8%20-%20%D0%A1%D0%B5%D1%80%D0%B8%D0%B8) · [🎬 Экранизации](obsidian://quickadd?choice=%D0%9A%D0%BD%D0%B8%D0%B3%D0%B8%20-%20%D0%AD%D0%BA%D1%80%D0%B0%D0%BD%D0%B8%D0%B7%D0%B0%D1%86%D0%B8%D0%B8) · [[Книги/_system/Проверка библиотеки|🔎 Проверка]] · [[Книги/_system/Журнал изменений|📜 Журнал]]\n\n> Автоматическая история обслуживания книжной базы.\n\n" + block);
            return;
        }
        await app.vault.process(file, current => current.replace(/\s*$/, "\n\n") + block);
    }

    const active = app.workspace.getActiveFile();
    let defaultAuthor = "";
    let defaultSeries = "";

    if (getFrontmatter(active).selected_author) {
        defaultAuthor = String(getFrontmatter(active).selected_author ?? "").trim();
    }
    if (getFrontmatter(active).selected_series) {
        defaultSeries = String(getFrontmatter(active).selected_series ?? "").trim();

        // Если в серии сейчас только один автор, подставляем его автоматически.
        const seriesAuthors = [...new Set(
            bookFiles
                .filter(isBook)
                .filter(file => String(getFrontmatter(file).series ?? "").trim() === defaultSeries)
                .flatMap(file => authorList(getFrontmatter(file)))
        )];
        if (seriesAuthors.length === 1) defaultAuthor = seriesAuthors[0];
    }

    const form = [
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
        if (errors.length) { new Notice(errors.join("\n"), 7000); continue; }
        const confirmed = await confirmAuthors(authors);
        if (!confirmed) return;
        authors = confirmed;
        if (series) { series = await confirmNewSeries(series); if (!series) return; }
        rating = section === "Художественные" && rawRating ? numericRating : null;
        comment = String(values.comment).trim();
        break;
    }

    const matches = matchingBooks(title, authors);
    if (matches.length) {
        const existing = matches.length === 1 ? matches[0] : await quickAddApi.suggester(
            matches.map(file => `${getFrontmatter(file).title} — ${file.path}`),
            matches,
            "Найдено несколько карточек. Выбери книгу для нового чтения"
        );
        if (!existing) return;
        const action = await quickAddApi.suggester(
            ["Добавить новое чтение", "Отмена"],
            ["reading", "cancel"],
            `Книга уже есть: ${getFrontmatter(existing).title}\n${existing.path}`
        );
        if (action !== "reading") return;
        await quickAddApi.executeChoice("Книги - Добавить чтение", {
            bookReadingRequest: {
                path: existing.path,
                values: { date, rating: values.rating, comment }
            }
        });
        return;
    }

    if (series && bookFiles.some(file => {
        const fm = getFrontmatter(file);
        return String(fm.series ?? "").trim() === series && Number(fm.series_index) === seriesIndex;
    })) {
        new Notice("Этот номер уже занят в серии. Запиши произведение с другим номером.", 7000);
        return;
    }

    const sectionFolder = normalizePath(`${BOOKS_ROOT}/${section}`);
    await ensureFolder(sectionFolder);

    // Если папка автора есть, новые книги идут в неё как «Название.md».
    // Если папки ещё нет, сначала проверяем старый файл «Автор. Название.md».
    // При его наличии создаём папку, переносим старый файл внутрь и сохраняем новую книгу там же.
    const authorFolder = normalizePath(`${sectionFolder}/${safeName(authors[0])}`);
    let destinationFolder = sectionFolder;
    let filePath = normalizePath(`${sectionFolder}/${safeName(`${authors[0]}. ${title}`)}.md`);
    const authorFolderFile = app.vault.getAbstractFileByPath(authorFolder);
    if (authorFolderFile) {
        destinationFolder = authorFolder;
        filePath = normalizePath(`${authorFolder}/${safeName(title)}.md`);
    } else {
        const legacyPrefix = `${safeName(authors[0])}. `;
        const legacyFiles = bookFiles
            .filter(file => file.parent?.path === sectionFolder && file.basename.startsWith(legacyPrefix));
        if (legacyFiles.length) {
            await ensureFolder(authorFolder);
            for (const legacyFile of legacyFiles) {
                const legacyTitle = legacyFile.basename.slice(legacyPrefix.length);
                const movedPath = normalizePath(`${authorFolder}/${safeName(legacyTitle)}.md`);
                if (!app.vault.getAbstractFileByPath(movedPath)) {
                    await app.fileManager.renameFile(legacyFile, movedPath);
                    await appendStructureJournal(`Перенесена карточка: ${legacyFile.path} → ${movedPath}.`);
                }
            }
            destinationFolder = authorFolder;
            filePath = normalizePath(`${authorFolder}/${safeName(title)}.md`);
        }
    }

    if (app.vault.getAbstractFileByPath(filePath)) {
        new Notice(`Произведение уже существует:\n${filePath}`);
        return;
    }

    let content = "---\n";
    content += `title: ${yamlString(title)}\n`;
    content += "authors:\n";
    for (const author of authors) content += `  - ${yamlString(author)}\n`;
    if (workType) content += `work_type: ${workType}\n`;
    content += `date: ${yamlString(date)}\n`;
    if (rating !== null) content += `rating: ${rating}\n`;
    content += "read_count: 1\n";
    if (series) {
        content += `series: ${yamlString(series)}\n`;
        content += `series_index: ${seriesIndex}\n`;
    }
    content += "---\n\n";
    content += cardPanel(Boolean(series)) + "\n";
    content += `# ${title}\n\n`;
    content += "## Заметки\n\n";
    content += historyBlock(date, rating, comment);

    const bookFile = await app.vault.create(filePath, content);
    await core.refreshFrontmatter(bookFile);
    try {
        await appendStructureJournal(`Добавлено произведение: **${title}** (${authors.join(", ")}) — \`${bookFile.path}\`.`);
    } catch (error) {
        new Notice(`Произведение добавлено, но журнал не обновлен: ${error?.message || error}`, 7000);
    }
    const entries = [{ number: 1, date, rating }];
    await updateHomeStats();
    const issues = await lightCheckBook(bookFile, entries);
    if (issues.length) {
        new Notice(`${title}: произведение добавлено. ⚠️ ${issues.join("; ")}. Запусти «Проверить библиотеку».`, 9000);
    } else {
        new Notice(`${title}: произведение добавлено`);
    }
    await app.workspace.getLeaf(false).openFile(bookFile);
};
