module.exports = async (params) => {
    const { app, quickAddApi, obsidian } = params;
    const { Notice, normalizePath } = obsidian;

    const MEDIA_FOLDER = "Кино";
    const VIEWINGS_FOLDER = "Кино/Просмотры";

    const HISTORY_BLOCK = `\`\`\`dataview
TABLE WITHOUT ID
  Просмотр AS "№",
  choice(Дата != null, dateformat(Дата, "dd.MM.yyyy"), string(Год)) AS "Когда",
  Оценка AS "⭐",
  Комментарий AS "Мысль",
  file.link AS "Запись"
FROM "Кино/Просмотры"
WHERE Фильм = this.file.link
SORT Просмотр DESC, Год DESC, Дата DESC
\`\`\``;

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

        const tags = getTags(getFrontmatter(file));

        return tags.includes("movies") || tags.includes("serial");
    }

    function toNumber(value) {
        if (value === null || value === undefined || value === "") {
            return null;
        }

        if (typeof value === "number") {
            return Number.isFinite(value) ? value : null;
        }

        const normalized = String(value)
            .trim()
            .replace(",", ".");

        if (!normalized) return null;

        const result = Number(normalized);

        return Number.isFinite(result) ? result : null;
    }

    function normalizeDate(value) {
        if (value === null || value === undefined || value === "") {
            return null;
        }

        let text;

        if (value instanceof Date && !Number.isNaN(value.getTime())) {
            const y = value.getFullYear();
            const m = String(value.getMonth() + 1).padStart(2, "0");
            const d = String(value.getDate()).padStart(2, "0");
            return `${y}-${m}-${d}`;
        }

        text = String(value)
            .trim()
            .replace(/^@date:/, "");

        // Только год: 2021 -> 2021-01-01
        let match = text.match(/^(\d{4})$/);

        if (match) {
            return `${match[1]}-01-01`;
        }

        // ISO или почти ISO: 2021-8-3 -> 2021-08-03
        match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);

        if (match) {
            const year = Number(match[1]);
            const month = Number(match[2]);
            const day = Number(match[3]);

            if (isRealDate(year, month, day)) {
                return (
                    String(year).padStart(4, "0") +
                    "-" +
                    String(month).padStart(2, "0") +
                    "-" +
                    String(day).padStart(2, "0")
                );
            }
        }

        // На всякий случай поддерживаем старый вид 08 Jun 2018.
        match = text.match(
            /^(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})$/i
        );

        if (match) {
            const months = {
                jan: 1,
                feb: 2,
                mar: 3,
                apr: 4,
                may: 5,
                jun: 6,
                jul: 7,
                aug: 8,
                sep: 9,
                oct: 10,
                nov: 11,
                dec: 12
            };

            const day = Number(match[1]);
            const month = months[match[2].toLowerCase()];
            const year = Number(match[3]);

            if (isRealDate(year, month, day)) {
                return (
                    String(year).padStart(4, "0") +
                    "-" +
                    String(month).padStart(2, "0") +
                    "-" +
                    String(day).padStart(2, "0")
                );
            }
        }

        return null;
    }

    function isRealDate(year, month, day) {
        const date = new Date(Date.UTC(year, month - 1, day));

        return (
            date.getUTCFullYear() === year &&
            date.getUTCMonth() === month - 1 &&
            date.getUTCDate() === day
        );
    }

    function yamlString(value) {
        return JSON.stringify(String(value ?? ""));
    }

    function getLinkTarget(value) {
        if (!value) return "";

        if (typeof value === "object" && value.path) {
            return String(value.path).replace(/\.md$/i, "");
        }

        let text = String(value).trim();

        if (text.startsWith("[[") && text.endsWith("]]")) {
            text = text.slice(2, -2);
        }

        text = text.split("|")[0].trim();

        return text.replace(/\.md$/i, "");
    }

    function viewingBelongsToMedia(frontmatter, mediaFile) {
        const target = getLinkTarget(frontmatter?.["Фильм"]);

        if (!target) return false;

        const mediaPath = mediaFile.path.replace(/\.md$/i, "");
        const mediaName = mediaFile.basename;

        return (
            target === mediaPath ||
            target === mediaName ||
            target.endsWith("/" + mediaName)
        );
    }

    function getViewingFiles(mediaFile) {
        return app.vault
            .getMarkdownFiles()
            .filter(file => {
                if (!file.path.startsWith(VIEWINGS_FOLDER + "/")) {
                    return false;
                }

                const fm = getFrontmatter(file);

                return viewingBelongsToMedia(fm, mediaFile);
            });
    }

    function getViewingStats(files) {
        let maxViewing = 0;

        for (const file of files) {
            const fm = getFrontmatter(file);
            const number = toNumber(fm["Просмотр"]);

            if (
                number !== null &&
                Number.isInteger(number) &&
                number > maxViewing
            ) {
                maxViewing = number;
            }
        }

        return {
            count: files.length,
            maxViewing
        };
    }

    function splitFrontmatter(text) {
        const lines = text.split(/\r?\n/);

        if (lines[0]?.trim() !== "---") {
            return {
                frontmatterText: "",
                body: text
            };
        }

        let closingIndex = -1;

        for (let i = 1; i < lines.length; i++) {
            if (lines[i].trim() === "---") {
                closingIndex = i;
                break;
            }
        }

        if (closingIndex === -1) {
            return {
                frontmatterText: "",
                body: text
            };
        }

        return {
            frontmatterText: lines
                .slice(0, closingIndex + 1)
                .join("\n"),
            body: lines
                .slice(closingIndex + 1)
                .join("\n")
        };
    }

    function extractLegacyReview(body) {
        let result = String(body ?? "");

        // Уже вставленный блок истории не является отзывом.
        result = result.replace(
            /```dataview[\s\S]*?```/gi,
            ""
        );

        // Убираем отдельные строки с картинками-постерами.
        result = result.replace(
            /^\s*!\[[^\]]*\]\([^\n]*\)\s*$/gim,
            ""
        );

        result = result.replace(
            /^\s*!\[\[[^\n]*\]\]\s*$/gim,
            ""
        );

        // Старый разделитель перед постером тоже не нужен.
        result = result.replace(
            /^\s*(---|\*\*\*|___)\s*$/gm,
            ""
        );

        return result.trim();
    }

    async function normalizeViewingFile(file) {
        await app.fileManager.processFrontMatter(
            file,
            frontmatter => {
                const date = normalizeDate(frontmatter["Дата"]);

                if (date) {
                    frontmatter["Дата"] = date;
                    frontmatter["Год"] = Number(date.slice(0, 4));
                } else {
                    const year = toNumber(frontmatter["Год"]);

                    if (
                        year !== null &&
                        Number.isInteger(year) &&
                        year >= 1000 &&
                        year <= 9999
                    ) {
                        frontmatter["Год"] = year;
                        frontmatter["Дата"] = `${year}-01-01`;
                    }
                }

                const viewingNumber = toNumber(
                    frontmatter["Просмотр"]
                );

                if (viewingNumber !== null) {
                    frontmatter["Просмотр"] = Math.trunc(
                        viewingNumber
                    );
                }

                const rating = toNumber(frontmatter["Оценка"]);

                if (rating !== null) {
                    frontmatter["Оценка"] = rating;
                }

                const tags = getTags(frontmatter);

                if (!tags.includes("viewing")) {
                    tags.push("viewing");
                }

                frontmatter.tags = tags;

                if (
                    frontmatter["Комментарий"] === null ||
                    frontmatter["Комментарий"] === undefined
                ) {
                    frontmatter["Комментарий"] = "";
                }
            }
        );
    }

    async function normalizeOriginalFrontmatter(
        mediaFile,
        viewingDate,
        viewingCount,
        newRating
    ) {
        await app.fileManager.processFrontMatter(
            mediaFile,
            frontmatter => {
                const oldWatched = normalizeDate(
                    frontmatter["Просмотрено"]
                );

                frontmatter["Просмотрено"] =
                    viewingDate ?? oldWatched;

                frontmatter["Количество просмотров"] =
                    Math.trunc(viewingCount);

                const currentRating = toNumber(
                    frontmatter["Оценка"]
                );

                if (newRating !== null) {
                    frontmatter["Оценка"] = newRating;
                } else if (currentRating !== null) {
                    frontmatter["Оценка"] = currentRating;
                }

                const imdbRating = toNumber(
                    frontmatter["Оценка Imdb"]
                );

                if (imdbRating !== null) {
                    frontmatter["Оценка Imdb"] = imdbRating;
                }

                const release = normalizeDate(
                    frontmatter["Релиз"]
                );

                if (release) {
                    frontmatter["Релиз"] = release;
                }

                // Нормализуем оба распространенных варианта tags
                // в обычный YAML-массив.
                const tags = getTags(frontmatter);

                if (tags.length > 0) {
                    frontmatter.tags = tags;
                }
            }
        );
    }

    function buildMovieLink(mediaFile) {
        return (
            "[[" +
            mediaFile.path.replace(/\.md$/i, "") +
            "|" +
            mediaFile.basename +
            "]]"
        );
    }

    function buildViewingContent({
        mediaFile,
        date,
        viewingNumber,
        rating,
        comment
    }) {
        const year = Number(date.slice(0, 4));

        let content = "---\n";
        content += `Фильм: ${yamlString(buildMovieLink(mediaFile))}\n`;
        content += `Дата: ${date}\n`;
        content += `Год: ${year}\n`;
        content += `Просмотр: ${viewingNumber}\n`;

        if (rating !== null) {
            content += `Оценка: ${rating}\n`;
        } else {
            content += "Оценка:\n";
        }

        content += "tags:\n";
        content += "  - viewing\n";
        content += `Комментарий: ${yamlString(comment)}\n`;
        content += "---\n";

        return content;
    }

    function makeViewingPath(
        mediaFile,
        viewingNumber,
        date,
        suffix = ""
    ) {
        const safeName = mediaFile.basename.replace(
            /[\\/:*?"<>|]/g,
            "-"
        );

        const suffixText = suffix ? ` ${suffix}` : "";

        return normalizePath(
            `${VIEWINGS_FOLDER}/${safeName}` +
            ` - просмотр ${viewingNumber}` +
            ` - ${date}${suffixText}.md`
        );
    }

    async function createUniqueViewingFile({
        mediaFile,
        date,
        viewingNumber,
        rating,
        comment
    }) {
        let path = makeViewingPath(
            mediaFile,
            viewingNumber,
            date
        );

        if (app.vault.getAbstractFileByPath(path)) {
            let index = 2;

            while (
                app.vault.getAbstractFileByPath(
                    makeViewingPath(
                        mediaFile,
                        viewingNumber,
                        date,
                        `(${index})`
                    )
                )
            ) {
                index++;
            }

            path = makeViewingPath(
                mediaFile,
                viewingNumber,
                date,
                `(${index})`
            );
        }

        const content = buildViewingContent({
            mediaFile,
            date,
            viewingNumber,
            rating,
            comment
        });

        return await app.vault.create(path, content);
    }

    async function replaceOriginalBodyWithHistory(mediaFile) {
        const frontmatter = getFrontmatter(mediaFile);
        const poster = String(frontmatter?.poster ?? "").trim();

        const text = await app.vault.read(mediaFile);
        const parts = splitFrontmatter(text);

        if (!parts.frontmatterText) {
            throw new Error(
                "Не удалось найти YAML frontmatter в исходном файле."
            );
        }

        let newBody = "\n\n" + HISTORY_BLOCK + "\n";

        if (poster) {
            newBody += `\n![](${poster})\n`;
        }

        await app.vault.modify(
            mediaFile,
            parts.frontmatterText + newBody
        );
    }

    // 1. Если открыт фильм/сериал, используем его.
    // 2. Иначе предлагаем выбрать.
    let mediaFile = app.workspace.getActiveFile();

    if (!isMedia(mediaFile)) {
        const mediaFiles = app.vault
            .getMarkdownFiles()
            .filter(isMedia)
            .sort((a, b) =>
                a.basename.localeCompare(b.basename, "ru")
            );

        if (mediaFiles.length === 0) {
            new Notice(
                "В папке Кино не найдено файлов с тегом movies или serial."
            );
            return;
        }

        const labels = mediaFiles.map(file => {
            const fm = getFrontmatter(file);
            const tags = getTags(fm);
            const icon = tags.includes("serial") ? "📺" : "🎬";
            const originalTitle = fm["Название"];

            if (
                originalTitle &&
                String(originalTitle).trim() !== file.basename
            ) {
                return (
                    `${icon} ${file.basename}` +
                    ` | ${originalTitle}`
                );
            }

            return `${icon} ${file.basename}`;
        });

        mediaFile = await quickAddApi.suggester(
            labels,
            mediaFiles,
            "Выбери фильм или сериал"
        );

        if (!mediaFile) return;
    }

    const originalTextBeforeChanges =
        await app.vault.read(mediaFile);

    const originalParts = splitFrontmatter(
        originalTextBeforeChanges
    );

    const originalFrontmatter = getFrontmatter(mediaFile);
    const legacyReview = extractLegacyReview(
        originalParts.body
    );

    const oldWatchedDate = normalizeDate(
        originalFrontmatter["Просмотрено"]
    );

    const oldRating = toNumber(
        originalFrontmatter["Оценка"]
    );

    let viewingFiles = getViewingFiles(mediaFile);

    // Нормализуем уже существующие записи этого фильма.
    for (const file of viewingFiles) {
        await normalizeViewingFile(file);
    }

    viewingFiles = getViewingFiles(mediaFile);

    const stats = getViewingStats(viewingFiles);

    const explicitCount = toNumber(
        originalFrontmatter["Количество просмотров"]
    );

    // Старый файл без записей в Просмотры, но с Просмотрено,
    // считаем одним уже состоявшимся просмотром.
    const hasLegacyViewing =
        viewingFiles.length === 0 &&
        oldWatchedDate !== null;

    const currentCount = Math.max(
        explicitCount !== null
            ? Math.trunc(explicitCount)
            : 0,
        stats.count,
        stats.maxViewing,
        hasLegacyViewing ? 1 : 0
    );

    const nextCount = currentCount + 1;

    const values = await quickAddApi.requestInputs([
        {
            id: "date",
            label: "Дата нового просмотра",
            type: "date",
            dateFormat: "YYYY-MM-DD",
            defaultValue: quickAddApi.date.now(
                "YYYY-MM-DD"
            )
        },
        {
            id: "rating",
            label: "Новая оценка",
            type: "number",
            defaultValue:
                oldRating !== null
                    ? String(oldRating)
                    : "",
            optional: true,
            numericConfig: {
                min: 1,
                max: 10,
                step: 1
            }
        },
        {
            id: "comment",
            label: "Новый отзыв",
            type: "textarea",
            optional: true,
            placeholder: "Мысль после нового просмотра..."
        }
    ]);

    if (!values) return;

    const viewingDate = normalizeDate(values.date);

    if (!viewingDate) {
        new Notice(
            `Некорректная дата нового просмотра: ${values.date}`
        );
        return;
    }

    let newRating = null;

    if (String(values.rating ?? "").trim() !== "") {
        newRating = toNumber(values.rating);

        if (
            newRating === null ||
            newRating < 1 ||
            newRating > 10
        ) {
            new Notice(
                "Оценка должна быть числом от 1 до 10."
            );
            return;
        }
    }

    const newComment = String(
        values.comment ?? ""
    ).trim();

    if (
        hasLegacyViewing &&
        oldWatchedDate === null
    ) {
        new Notice(
            "У старого просмотра нет корректной даты. " +
            "Сначала исправь поле Просмотрено."
        );
        return;
    }

    if (
        !app.vault.getAbstractFileByPath(
            VIEWINGS_FOLDER
        )
    ) {
        await app.vault.createFolder(
            VIEWINGS_FOLDER
        );
    }

    let migratedLegacy = false;

    // Первый запуск на старой заметке:
    // переносим существующий отзыв и старую дату в просмотр #1.
    if (hasLegacyViewing) {
        await createUniqueViewingFile({
            mediaFile,
            date: oldWatchedDate,
            viewingNumber: 1,
            rating: oldRating,
            comment: legacyReview
        });

        migratedLegacy = true;
    }

    // Создаем новый просмотр в том же запуске.
    const newViewingFile =
        await createUniqueViewingFile({
            mediaFile,
            date: viewingDate,
            viewingNumber: nextCount,
            rating: newRating,
            comment: newComment
        });

    // Еще раз получаем записи уже после создания,
    // чтобы счетчик был основан на фактической истории.
    viewingFiles = getViewingFiles(mediaFile);

    for (const file of viewingFiles) {
        await normalizeViewingFile(file);
    }

    const finalStats = getViewingStats(
        getViewingFiles(mediaFile)
    );

    const finalCount = Math.max(
        nextCount,
        finalStats.count,
        finalStats.maxViewing
    );

    // Приводим YAML оригинальной карточки к нормальным типам
    // и ставим данные последнего просмотра.
    await normalizeOriginalFrontmatter(
        mediaFile,
        viewingDate,
        finalCount,
        newRating
    );

    // Вместо старого текста оставляем только историю + постер.
    await replaceOriginalBodyWithHistory(
        mediaFile
    );

    if (migratedLegacy) {
        new Notice(
            `${mediaFile.basename}: старый отзыв перенесен ` +
            `в просмотр #1, добавлен просмотр #${nextCount}`
        );
    } else {
        new Notice(
            `${mediaFile.basename}: добавлен просмотр #${nextCount}`
        );
    }

    await app.workspace
        .getLeaf(false)
        .openFile(newViewingFile);
};
