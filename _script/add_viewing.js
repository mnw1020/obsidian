module.exports = async (params) => {
    const { app, quickAddApi, obsidian } = params;
    const { Notice, normalizePath } = obsidian;

    const MEDIA_FOLDER = "Кино";
    const VIEWINGS_FOLDER = "Кино/Просмотры";

    function getFrontmatter(file) {
        return app.metadataCache.getFileCache(file)?.frontmatter ?? {};
    }

    function getTags(frontmatter) {
        const raw = frontmatter?.tags;
        if (!raw) return [];

        const tags = Array.isArray(raw) ? raw : [raw];

        return tags
            .map(tag => String(tag).trim().replace(/^#/, ""))
            .filter(Boolean);
    }

    function isMedia(file) {
        if (!file || file.extension !== "md") return false;

        if (!file.path.startsWith(MEDIA_FOLDER + "/")) return false;
        if (file.path.startsWith(VIEWINGS_FOLDER + "/")) return false;

        const fm = getFrontmatter(file);
        const tags = getTags(fm);

        return tags.includes("movies") || tags.includes("serial");
    }

    function getCurrentViewingCount(frontmatter) {
        const explicitCount = Number(frontmatter?.["Количество просмотров"]);

        if (Number.isFinite(explicitCount) && explicitCount >= 0) {
            return Math.floor(explicitCount);
        }

        // Если дата просмотра уже есть, но счетчика еще нет,
        // считаем, что первый просмотр уже был.
        if (frontmatter?.["Просмотрено"]) {
            return 1;
        }

        return 0;
    }

    function yamlString(value) {
        return JSON.stringify(String(value ?? ""));
    }

    function normalizeDate(value) {
        const text = String(value ?? "").trim().replace(/^@date:/, "");
        const match = text.match(/\d{4}-\d{2}-\d{2}/);
        return match ? match[0] : text;
    }

    function isValidDate(value) {
        const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!match) return false;

        const year = Number(match[1]);
        const month = Number(match[2]);
        const day = Number(match[3]);

        const date = new Date(Date.UTC(year, month - 1, day));

        return (
            date.getUTCFullYear() === year &&
            date.getUTCMonth() === month - 1 &&
            date.getUTCDate() === day
        );
    }

    // Если открыт фильм, используем его.
    // Иначе показываем список фильмов.
    let movieFile = app.workspace.getActiveFile();

    if (!isMedia(movieFile)) {
        const movies = app.vault
            .getMarkdownFiles()
            .filter(isMedia)
            .sort((a, b) => a.basename.localeCompare(b.basename, "ru"));

        if (movies.length === 0) {
            new Notice("В папке Кино не найдено файлов с тегом movies или serial.");
            return;
        }

        const displayNames = movies.map(file => {
            const fm = getFrontmatter(file);
            const tags = getTags(fm);
            const icon = tags.includes("serial") ? "📺" : "🎬";
            const originalTitle = fm["Название"];

            if (
                originalTitle &&
                String(originalTitle).trim() !== file.basename
            ) {
                return `${icon} ${file.basename} | ${originalTitle}`;
            }

            return `${icon} ${file.basename}`;
        });

        movieFile = await quickAddApi.suggester(
            displayNames,
            movies,
            "Выбери фильм"
        );

        if (!movieFile) return;
    }

    const fm = getFrontmatter(movieFile);

    const currentCount = getCurrentViewingCount(fm);
    const nextCount = currentCount + 1;

    const oldRating =
        fm["Оценка"] !== undefined && fm["Оценка"] !== null
            ? String(fm["Оценка"])
            : "";

    const values = await quickAddApi.requestInputs([
        {
            id: "date",
            label: "Дата просмотра",
            type: "date",
            dateFormat: "YYYY-MM-DD",
            defaultValue: quickAddApi.date.now("YYYY-MM-DD")
        },
        {
            id: "rating",
            label: "Оценка",
            type: "number",
            defaultValue: oldRating,
            optional: true,
            numericConfig: {
                min: 1,
                max: 10,
                step: 1
            }
        },
        {
            id: "comment",
            label: "Комментарий",
            type: "textarea",
            optional: true,
            placeholder: "Мысль после просмотра..."
        }
    ]);

    const viewingDate = normalizeDate(values.date);

    if (!isValidDate(viewingDate)) {
        new Notice(`Некорректная дата: ${viewingDate}`);
        return;
    }

    let rating = null;

    if (String(values.rating ?? "").trim() !== "") {
        rating = Number(values.rating);

        if (!Number.isFinite(rating) || rating < 1 || rating > 10) {
            new Notice("Оценка должна быть от 1 до 10.");
            return;
        }
    }

    const comment = String(values.comment ?? "").trim();
    const year = viewingDate.slice(0, 4);

    if (!app.vault.getAbstractFileByPath(VIEWINGS_FOLDER)) {
        await app.vault.createFolder(VIEWINGS_FOLDER);
    }

    const safeMovieName = movieFile.basename.replace(/[\\/:*?"<>|]/g, "-");

    const fileName =
        `${safeMovieName} - просмотр ${nextCount} - ${viewingDate}.md`;

    const viewingPath = normalizePath(
        `${VIEWINGS_FOLDER}/${fileName}`
    );

    if (app.vault.getAbstractFileByPath(viewingPath)) {
        new Notice(`Запись уже существует:\n${viewingPath}`);
        return;
    }

    const movieLink =
        `[[${movieFile.path.replace(/\.md$/i, "")}|${movieFile.basename}]]`;

    let content = "---\n";
    content += `Фильм: ${yamlString(movieLink)}\n`;
    content += `Дата: ${viewingDate}\n`;
    content += `Год: ${year}\n`;
    content += `Просмотр: ${nextCount}\n`;

    if (rating !== null) {
        content += `Оценка: ${rating}\n`;
    } else {
        content += "Оценка:\n";
    }

    content += `Комментарий: ${yamlString(comment)}\n`;
    content += "tags:\n";
    content += "  - viewing\n";
    content += "---\n\n";

    if (comment) {
        content += comment + "\n";
    }

    const viewingFile = await app.vault.create(
        viewingPath,
        content
    );

    await app.fileManager.processFrontMatter(
        movieFile,
        frontmatter => {
            frontmatter["Просмотрено"] = viewingDate;
            frontmatter["Количество просмотров"] = nextCount;

            if (rating !== null) {
                frontmatter["Оценка"] = rating;
            }
        }
    );

    new Notice(
        `${movieFile.basename}: добавлен просмотр #${nextCount}`
    );

    await app.workspace.getLeaf(false).openFile(viewingFile);
};
