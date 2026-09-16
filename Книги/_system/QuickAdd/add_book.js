module.exports = async (params) => {
    const { app, quickAddApi, obsidian } = params;
    const { Notice, normalizePath } = obsidian;

    const BOOKS_ROOT = "Книги";
    const AUTHOR_PAGE = "Книги/_system/Автор.md";
    const SERIES_PAGE = "Книги/_system/Серия.md";
    const CHANGELOG_PATH = "Книги/_system/Журнал изменений.md";
    const HISTORY_START = "<!-- BOOK-READINGS:START -->";
    const HISTORY_END = "<!-- BOOK-READINGS:END -->";
    const COMMENT_MARK = "<!-- BOOK-READING:COMMENT -->";

    const yamlString = value => JSON.stringify(String(value ?? ""));
    const safeName = value => String(value ?? "").replace(/[\\/:*?"<>|]/g, "-").trim();

    function getFrontmatter(file) {
        return app.metadataCache.getFileCache(file)?.frontmatter ?? {};
    }

    function isBook(file) {
        if (!file || file.extension !== "md") return false;
        if (file.basename === "_index") return false;
        if (!(
            file.path.startsWith("Книги/Художественные/") ||
            file.path.startsWith("Книги/Non-fiction/")
        )) return false;
        const fm = getFrontmatter(file);
        return Boolean(fm.title) && Boolean(fm.authors);
    }

    function isFiction(file) {
        return file.path.startsWith("Книги/Художественные/");
    }


    async function updateHomeStats() {
        const home = app.vault.getAbstractFileByPath("Книги/_index.md");
        if (!home) return;
        await new Promise(resolve => setTimeout(resolve, 100));
        const allBooks = app.vault.getMarkdownFiles().filter(isBook);
        const authors = new Set();
        const series = new Set();
        let rated = 0;
        let reread = 0;
        for (const file of allBooks) {
            const fm = getFrontmatter(file);
            const rawAuthors = Array.isArray(fm.authors) ? fm.authors : [fm.authors];
            for (const author of rawAuthors) {
                const value = String(author ?? "").trim();
                if (value) authors.add(value);
            }
            const seriesName = String(fm.series ?? "").trim();
            if (seriesName) series.add(seriesName);
            if (file.path.startsWith("Книги/Художественные/")) {
                const value = Number(fm.rating);
                if (Number.isFinite(value) && value >= 1 && value <= 10) rated++;
            }
            const count = Number(fm.read_count);
            if (Number.isInteger(count) && count > 1) reread++;
        }
        const block = `<!-- BOOK-HOME-STATS:START -->\n> [!abstract] Библиотека\n> **${allBooks.length} книг** · **${authors.size} авторов** · **${series.size} серий** · **${rated} оценено** · **${reread} перечитано**\n<!-- BOOK-HOME-STATS:END -->`;
        const current = await app.vault.read(home);
        const updated = /<!-- BOOK-HOME-STATS:START -->[\s\S]*?<!-- BOOK-HOME-STATS:END -->/.test(current)
            ? current.replace(/<!-- BOOK-HOME-STATS:START -->[\s\S]*?<!-- BOOK-HOME-STATS:END -->/, block)
            : current;
        if (updated !== current) await app.vault.modify(home, updated);
    }

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
            app.vault.getMarkdownFiles()
                .filter(isBook)
                .flatMap(file => authorList(getFrontmatter(file)))
        )].sort((a, b) => a.localeCompare(b, "ru"));
    }

    function existingSeriesNames() {
        return [...new Set(
            app.vault.getMarkdownFiles()
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

    function displayDate(value) {
        const text = String(value ?? "").trim();
        let m = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (m) return `${m[3]}.${m[2]}.${m[1]}`;
        m = text.match(/^(\d{4})-(\d{2})$/);
        if (m) return `${m[2]}.${m[1]}`;
        return text;
    }

    function isValidDate(value) {
        const text = String(value ?? "").trim();
        let m = text.match(/^(\d{4})$/);
        if (m) return Number(m[1]) >= 1;
        m = text.match(/^(\d{4})-(\d{2})$/);
        if (m) {
            const month = Number(m[2]);
            return month >= 1 && month <= 12;
        }
        m = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!m) return false;
        const year = Number(m[1]);
        const month = Number(m[2]);
        const day = Number(m[3]);
        const date = new Date(Date.UTC(year, month - 1, day));
        return (
            date.getUTCFullYear() === year &&
            date.getUTCMonth() === month - 1 &&
            date.getUTCDate() === day
        );
    }

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

        return [
            "<!-- BOOK-CARD-UI:START -->",
            "> [!abstract] Навигация",
            `> ${nav}`,
            "",
            "`button-book-add-reading` `button-book-edit-reading` `button-book-link-cinema`",
            "",
            "```button",
            "name 📖 Чтение",
            "type command",
            "action QuickAdd: Книги - Добавить чтение",
            "width 6.5",
            "height 1.3",
            "align center middle",
            "hidden true",
            "```",
            "^button-book-add-reading",
            "",
            "```button",
            "name ✏️ Изменить",
            "type command",
            "action QuickAdd: Книги - Редактировать чтение",
            "width 7",
            "height 1.3",
            "align center middle",
            "hidden true",
            "```",
            "^button-book-edit-reading",
            "",
            "```button",
            "name 🎬 Кино",
            "type command",
            "action QuickAdd: Книги - Связать с кино",
            "width 6.5",
            "height 1.3",
            "align center middle",
            "hidden true",
            "```",
            "^button-book-link-cinema",
            "<!-- BOOK-CARD-UI:END -->",
            ""
        ].join("\n");
    }


    async function lightCheckBook(bookFile, entries) {
        let fm = getFrontmatter(bookFile);
        for (let attempt = 0; attempt < 6 && !fm.title; attempt++) {
            await new Promise(resolve => setTimeout(resolve, 60));
            fm = getFrontmatter(bookFile);
        }
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
            const conflicts = app.vault.getMarkdownFiles()
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
        const current = await app.vault.read(file);
        await app.vault.modify(file, current.replace(/\s*$/, "\n\n") + block);
    }

    const active = app.workspace.getActiveFile();
    let defaultAuthor = "";
    let defaultSeries = "";

    if (active?.path === AUTHOR_PAGE) {
        defaultAuthor = String(getFrontmatter(active).selected_author ?? "").trim();
    }
    if (active?.path === SERIES_PAGE) {
        defaultSeries = String(getFrontmatter(active).selected_series ?? "").trim();

        // Если в серии сейчас только один автор, подставляем его автоматически.
        const seriesAuthors = [...new Set(
            app.vault.getMarkdownFiles()
                .filter(isBook)
                .filter(file => String(getFrontmatter(file).series ?? "").trim() === defaultSeries)
                .flatMap(file => authorList(getFrontmatter(file)))
        )];
        if (seriesAuthors.length === 1) defaultAuthor = seriesAuthors[0];
    }

    const section = await quickAddApi.suggester(
        ["Художественные", "Non-fiction"],
        ["Художественные", "Non-fiction"],
        "Раздел"
    );
    if (!section) return;

    const inputs = [
        { id: "title", label: "Название книги", type: "text" },
        {
            id: "authors",
            label: "Автор(ы), через запятую",
            type: "text",
            defaultValue: defaultAuthor
        },
        {
            id: "date",
            label: "Дата чтения",
            type: "text",
            defaultValue: quickAddApi.date.now("YYYY-MM-DD"),
            placeholder: "YYYY-MM-DD"
        }
    ];

    if (section === "Художественные") {
        inputs.push({
            id: "rating",
            label: "Оценка",
            type: "number",
            optional: true,
            numericConfig: { min: 1, max: 10, step: 1 }
        });
    }

    inputs.push({
        id: "comment",
        label: "Комментарий к чтению",
        type: "textarea",
        optional: true
    });

    const values = await quickAddApi.requestInputs(inputs);
    if (!values) return;

    const title = String(values.title ?? "").trim();
    let authors = String(values.authors ?? "")
        .split(/[,;]+/)
        .map(v => v.trim())
        .filter(Boolean);

    if (!title) {
        new Notice("Не указано название книги.");
        return;
    }
    if (authors.length === 0) {
        new Notice("Не указан автор.");
        return;
    }

    const confirmedAuthors = await confirmAuthors(authors);
    if (!confirmedAuthors) return;
    authors = confirmedAuthors;

    const date = String(values.date ?? "").trim().replace(/^@date:/, "");
    if (!isValidDate(date)) {
        new Notice("Некорректная дата. Используй YYYY-MM-DD, YYYY-MM или YYYY.");
        return;
    }

    const ratingRaw = Number(values.rating);
    const rating = section === "Художественные" && Number.isFinite(ratingRaw) && ratingRaw >= 1 && ratingRaw <= 10
        ? ratingRaw
        : null;
    const comment = String(values.comment ?? "").trim();

    // Серия выбирается ПОСЛЕ автора. Так нет опечаток и дубликатов названий серий.
    let series = defaultSeries;
    if (!series) {
        const authorSeries = [...new Set(
            app.vault.getMarkdownFiles()
                .filter(isBook)
                .filter(file => authorList(getFrontmatter(file)).includes(authors[0]))
                .map(file => String(getFrontmatter(file).series ?? "").trim())
                .filter(Boolean)
        )].sort((a, b) => a.localeCompare(b, "ru"));

        const labels = ["Без серии", ...authorSeries, "➕ Новая серия"];
        const valuesForChoice = ["", ...authorSeries, "__NEW__"];

        const seriesChoice = await quickAddApi.suggester(
            labels,
            valuesForChoice,
            "Серия"
        );
        if (seriesChoice === undefined || seriesChoice === null) return;

        if (seriesChoice === "__NEW__") {
            series = String(await quickAddApi.inputPrompt("Название новой серии") ?? "").trim();
            if (!series) return;
            series = await confirmNewSeries(series);
            if (!series) return;
        } else {
            series = String(seriesChoice).trim();
        }
    }

    let seriesIndex = null;
    if (series) {
        const existingIndexes = app.vault.getMarkdownFiles()
            .filter(isBook)
            .map(file => getFrontmatter(file))
            .filter(fm => String(fm.series ?? "").trim() === series)
            .map(fm => Number(fm.series_index))
            .filter(v => Number.isFinite(v) && v > 0);

        const suggestedIndex = existingIndexes.length
            ? Math.max(...existingIndexes) + 1
            : 1;

        const indexValues = await quickAddApi.requestInputs([
            {
                id: "seriesIndex",
                label: `Номер в серии "${series}"`,
                type: "number",
                defaultValue: String(suggestedIndex),
                numericConfig: { min: 1, step: 1 }
            }
        ]);
        if (!indexValues) return;

        const raw = Number(indexValues.seriesIndex);
        if (!Number.isFinite(raw) || raw < 1) {
            new Notice("Некорректный номер в серии.");
            return;
        }
        seriesIndex = Math.floor(raw);
    }

    const sectionFolder = normalizePath(`${BOOKS_ROOT}/${section}`);
    await ensureFolder(sectionFolder);

    // Сохраняем существующую физическую структуру. Если папка автора уже есть,
    // книга идет туда. Новые папки авторов автоматически не создаются.
    const authorFolder = normalizePath(`${sectionFolder}/${safeName(authors[0])}`);
    const hasAuthorFolder = !!app.vault.getAbstractFileByPath(authorFolder);
    const destinationFolder = hasAuthorFolder ? authorFolder : sectionFolder;

    const rawFileName = hasAuthorFolder ? title : `${authors[0]}. ${title}`;
    const filePath = normalizePath(`${destinationFolder}/${safeName(rawFileName)}.md`);

    if (app.vault.getAbstractFileByPath(filePath)) {
        new Notice(`Книга уже существует:\n${filePath}`);
        return;
    }

    let content = "---\n";
    content += `title: ${yamlString(title)}\n`;
    content += "authors:\n";
    for (const author of authors) content += `  - ${yamlString(author)}\n`;
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
    try {
        await appendStructureJournal(`Добавлена книга: **${title}** (${authors.join(", ")}) — \`${bookFile.path}\`.`);
    } catch (error) {
        new Notice(`Книга добавлена, но журнал не обновлен: ${error?.message || error}`, 7000);
    }
    const entries = [{ number: 1, date, rating }];
    await updateHomeStats();
    const issues = await lightCheckBook(bookFile, entries);
    if (issues.length) {
        new Notice(`${title}: книга добавлена. ⚠️ ${issues.join("; ")}. Запусти «Проверить библиотеку».`, 9000);
    } else {
        new Notice(`${title}: книга добавлена`);
    }
    await app.workspace.getLeaf(false).openFile(bookFile);
};
