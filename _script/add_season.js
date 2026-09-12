module.exports = async (params) => {
    const { app, quickAddApi, obsidian } = params;
    const { Notice, normalizePath } = obsidian;

    const MEDIA_FOLDER = "Кино";
    const VIEWINGS_FOLDER = "Кино/Просмотры";

    const HISTORY_BLOCK = `\`\`\`dataview
TABLE WITHOUT ID
  Сезон AS "Сезон",
  Просмотр AS "№",
  choice(Дата != null, dateformat(Дата, "dd.MM.yyyy"), string(Год)) AS "Когда",
  Оценка AS "⭐",
  Комментарий AS "Мысль",
  file.link AS "Запись"
FROM "Кино/Просмотры"
WHERE Фильм = this.file.link
SORT Просмотр DESC, Год DESC, Дата DESC
\`\`\``;

    const HISTORY_BLOCK_REGEX =
        /```dataview\s*\n[\s\S]*?FROM\s+"Кино\/Просмотры"[\s\S]*?WHERE\s+Фильм\s*=\s*this\.file\.link[\s\S]*?```/gi;

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

    function isSerial(file) {
        if (!file || file.extension !== "md") return false;
        if (!file.path.startsWith(MEDIA_FOLDER + "/")) return false;
        if (file.path.startsWith(VIEWINGS_FOLDER + "/")) return false;

        return getTags(getFrontmatter(file)).includes("serial");
    }

    function toNumber(value) {
        if (value === null || value === undefined || value === "") {
            return null;
        }

        if (typeof value === "number") {
            return Number.isFinite(value) ? value : null;
        }

        const normalized = String(value).trim().replace(",", ".");
        if (!normalized) return null;

        const result = Number(normalized);
        return Number.isFinite(result) ? result : null;
    }

    function isRealDate(year, month, day) {
        const date = new Date(Date.UTC(year, month - 1, day));

        return (
            date.getUTCFullYear() === year &&
            date.getUTCMonth() === month - 1 &&
            date.getUTCDate() === day
        );
    }

    function normalizeDate(value) {
        if (value === null || value === undefined || value === "") {
            return null;
        }

        if (value instanceof Date && !Number.isNaN(value.getTime())) {
            const y = value.getFullYear();
            const m = String(value.getMonth() + 1).padStart(2, "0");
            const d = String(value.getDate()).padStart(2, "0");
            return `${y}-${m}-${d}`;
        }

        const text = String(value).trim().replace(/^@date:/, "");

        let match = text.match(/^(\d{4})$/);

        if (match) {
            return `${match[1]}-01-01`;
        }

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

        match = text.match(
            /^(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})$/i
        );

        if (match) {
            const months = {
                jan: 1, feb: 2, mar: 3, apr: 4,
                may: 5, jun: 6, jul: 7, aug: 8,
                sep: 9, oct: 10, nov: 11, dec: 12
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

    function yamlString(value) {
        return JSON.stringify(String(value ?? ""));
    }

    function splitFrontmatter(text) {
        const lines = String(text ?? "").split(/\r?\n/);

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

    function hasHistoryBlock(body) {
        HISTORY_BLOCK_REGEX.lastIndex = 0;
        return HISTORY_BLOCK_REGEX.test(String(body ?? ""));
    }

    function removeHistoryBlocks(body) {
        HISTORY_BLOCK_REGEX.lastIndex = 0;
        return String(body ?? "").replace(HISTORY_BLOCK_REGEX, "");
    }

    function cleanLegacyComment(text) {
        let result = String(text ?? "");

        result = result.replace(
            /^\s*!\[[^\]]*\]\([^\n]*\)\s*$/gim,
            ""
        );

        result = result.replace(
            /^\s*!\[\[[^\n]*\]\]\s*$/gim,
            ""
        );

        result = result.replace(
            /^\s*(---|\*\*\*|___)\s*$/gm,
            ""
        );

        // Obsidian block IDs старого текста в отдельную запись не нужны.
        result = result.replace(
            /^\s*\^[A-Za-z0-9_-]+\s*$/gm,
            ""
        );

        return result.trim();
    }

    function parseLegacySeasonSections(body) {
        const source = removeHistoryBlocks(body);

        const regex =
            /^#{1,6}\s*(?:(\d+)\s*сезон|сезон\s*(\d+))\s*$/gim;

        const matches = [...source.matchAll(regex)];

        if (matches.length === 0) {
            return [];
        }

        const result = [];

        for (let i = 0; i < matches.length; i++) {
            const current = matches[i];
            const next = matches[i + 1];

            const season = Number(
                current[1] ?? current[2]
            );

            const start =
                current.index + current[0].length;

            const end = next
                ? next.index
                : source.length;

            const comment = cleanLegacyComment(
                source.slice(start, end)
            );

            if (
                Number.isInteger(season) &&
                season > 0
            ) {
                result.push({
                    season,
                    comment
                });
            }
        }

        return result;
    }

    function getPlainLegacyReview(body) {
        let source = removeHistoryBlocks(body);

        // Если есть сезонные заголовки, этот fallback не используем.
        if (
            /^#{1,6}\s*(?:(\d+)\s*сезон|сезон\s*(\d+))\s*$/im.test(source)
        ) {
            return "";
        }

        return cleanLegacyComment(source);
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

    function viewingBelongsToSerial(frontmatter, serialFile) {
        const target = getLinkTarget(frontmatter?.["Фильм"]);

        if (!target) return false;

        const serialPath =
            serialFile.path.replace(/\.md$/i, "");

        return (
            target === serialPath ||
            target === serialFile.basename ||
            target.endsWith("/" + serialFile.basename)
        );
    }

    function getViewingFiles(serialFile) {
        return app.vault
            .getMarkdownFiles()
            .filter(file => {
                if (
                    !file.path.startsWith(
                        VIEWINGS_FOLDER + "/"
                    )
                ) {
                    return false;
                }

                return viewingBelongsToSerial(
                    getFrontmatter(file),
                    serialFile
                );
            });
    }

    function getStats(files) {
        let maxViewing = 0;
        let maxSeason = 0;

        for (const file of files) {
            const fm = getFrontmatter(file);

            const viewing = toNumber(fm["Просмотр"]);
            const season = toNumber(fm["Сезон"]);

            if (
                viewing !== null &&
                Number.isInteger(viewing) &&
                viewing > maxViewing
            ) {
                maxViewing = viewing;
            }

            if (
                season !== null &&
                Number.isInteger(season) &&
                season > maxSeason
            ) {
                maxSeason = season;
            }
        }

        return {
            count: files.length,
            maxViewing,
            maxSeason
        };
    }

    function hasSeasonRecord(files, season) {
        return files.some(file => {
            const value = toNumber(
                getFrontmatter(file)["Сезон"]
            );

            return (
                value !== null &&
                Number.isInteger(value) &&
                value === season
            );
        });
    }

    function makeSerialLink(serialFile) {
        return (
            "[[" +
            serialFile.path.replace(/\.md$/i, "") +
            "|" +
            serialFile.basename +
            "]]"
        );
    }

    function makeViewingPath(
        serialFile,
        season,
        viewingNumber,
        date,
        suffix = ""
    ) {
        const safeName = serialFile.basename.replace(
            /[\\/:*?"<>|]/g,
            "-"
        );

        const suffixText = suffix
            ? ` ${suffix}`
            : "";

        return normalizePath(
            `${VIEWINGS_FOLDER}/${safeName}` +
            ` - сезон ${season}` +
            ` - просмотр ${viewingNumber}` +
            ` - ${date}${suffixText}.md`
        );
    }

    function buildViewingContent({
        serialFile,
        season,
        date,
        viewingNumber,
        rating,
        comment
    }) {
        const year = Number(date.slice(0, 4));

        let content = "---\n";
        content += `Фильм: ${yamlString(makeSerialLink(serialFile))}\n`;
        content += `Дата: ${date}\n`;
        content += `Год: ${year}\n`;
        content += `Просмотр: ${viewingNumber}\n`;
        content += `Сезон: ${season}\n`;

        if (rating !== null) {
            content += `Оценка: ${rating}\n`;
        } else {
            content += "Оценка:\n";
        }

        content += `Комментарий: ${yamlString(comment)}\n`;
        content += "tags:\n";
        content += "  - viewing\n";
        content += "  - season\n";
        content += "---\n\n";
        content += `# Сезон ${season}\n\n`;

        if (comment) {
            content += comment + "\n";
        }

        return content;
    }

    async function createViewingFile({
        serialFile,
        season,
        date,
        viewingNumber,
        rating,
        comment
    }) {
        let path = makeViewingPath(
            serialFile,
            season,
            viewingNumber,
            date
        );

        if (app.vault.getAbstractFileByPath(path)) {
            let suffix = 2;

            while (
                app.vault.getAbstractFileByPath(
                    makeViewingPath(
                        serialFile,
                        season,
                        viewingNumber,
                        date,
                        `(${suffix})`
                    )
                )
            ) {
                suffix++;
            }

            path = makeViewingPath(
                serialFile,
                season,
                viewingNumber,
                date,
                `(${suffix})`
            );
        }

        return await app.vault.create(
            path,
            buildViewingContent({
                serialFile,
                season,
                date,
                viewingNumber,
                rating,
                comment
            })
        );
    }

    async function normalizeViewingFile(file) {
        await app.fileManager.processFrontMatter(
            file,
            frontmatter => {
                const date = normalizeDate(
                    frontmatter["Дата"]
                );

                if (date) {
                    frontmatter["Дата"] = date;
                    frontmatter["Год"] =
                        Number(date.slice(0, 4));
                }

                const viewing = toNumber(
                    frontmatter["Просмотр"]
                );

                if (viewing !== null) {
                    frontmatter["Просмотр"] =
                        Math.trunc(viewing);
                }

                const season = toNumber(
                    frontmatter["Сезон"]
                );

                if (season !== null) {
                    frontmatter["Сезон"] =
                        Math.trunc(season);
                }

                const rating = toNumber(
                    frontmatter["Оценка"]
                );

                if (rating !== null) {
                    frontmatter["Оценка"] = rating;
                }

                const tags = getTags(frontmatter);

                if (!tags.includes("viewing")) {
                    tags.push("viewing");
                }

                if (!tags.includes("season")) {
                    tags.push("season");
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

    function sortViewingFiles(files) {
        return [...files].sort((a, b) => {
            const afm = getFrontmatter(a);
            const bfm = getFrontmatter(b);

            const av = toNumber(afm["Просмотр"]) ?? 0;
            const bv = toNumber(bfm["Просмотр"]) ?? 0;

            if (av !== bv) {
                return av - bv;
            }

            const ad =
                normalizeDate(afm["Дата"]) ?? "";
            const bd =
                normalizeDate(bfm["Дата"]) ?? "";

            return ad.localeCompare(bd);
        });
    }

    async function rebuildRatingDelta(serialFile) {
        const files = sortViewingFiles(
            getViewingFiles(serialFile)
        );

        for (let i = 0; i < files.length; i++) {
            const file = files[i];

            await app.fileManager.processFrontMatter(
                file,
                frontmatter => {
                    frontmatter["Последний просмотр"] =
                        i === files.length - 1;

                    delete frontmatter[
                        "Предыдущая оценка"
                    ];

                    delete frontmatter[
                        "Изменение оценки"
                    ];
                }
            );
        }

        if (files.length < 2) return;

        const latest = files[files.length - 1];
        const previous = files[files.length - 2];

        const latestRating = toNumber(
            getFrontmatter(latest)["Оценка"]
        );

        const previousRating = toNumber(
            getFrontmatter(previous)["Оценка"]
        );

        if (
            latestRating === null ||
            previousRating === null
        ) {
            return;
        }

        await app.fileManager.processFrontMatter(
            latest,
            frontmatter => {
                frontmatter["Предыдущая оценка"] =
                    previousRating;

                frontmatter["Изменение оценки"] =
                    Number(
                        (
                            latestRating -
                            previousRating
                        ).toFixed(2)
                    );
            }
        );
    }

    async function normalizeOriginal(
        serialFile,
        latestDate,
        finalCount
    ) {
        await app.fileManager.processFrontMatter(
            serialFile,
            frontmatter => {
                frontmatter["Просмотрено"] =
                    latestDate;

                frontmatter[
                    "Количество просмотров"
                ] = Math.trunc(finalCount);

                const rating = toNumber(
                    frontmatter["Оценка"]
                );

                if (rating !== null) {
                    frontmatter["Оценка"] = rating;
                }

                const imdb = toNumber(
                    frontmatter["Оценка Imdb"]
                );

                if (imdb !== null) {
                    frontmatter["Оценка Imdb"] = imdb;
                }

                const release = normalizeDate(
                    frontmatter["Релиз"]
                );

                if (release) {
                    frontmatter["Релиз"] = release;
                }

                const tags = getTags(frontmatter);

                if (tags.length > 0) {
                    frontmatter.tags = tags;
                }
            }
        );
    }

    async function ensureSingleHistoryBlock(
        serialFile,
        hadLegacySections
    ) {
        const frontmatter = getFrontmatter(serialFile);
        const poster =
            String(frontmatter?.poster ?? "").trim();

        const text = await app.vault.read(serialFile);
        const parts = splitFrontmatter(text);

        if (!parts.frontmatterText) {
            throw new Error(
                "Не найден YAML frontmatter."
            );
        }

        const alreadyHasHistory =
            hasHistoryBlock(parts.body);

        let body;

        if (alreadyHasHistory) {
            // Не добавляем второй блок.
            // Существующий совместимый блок лишь заменяем
            // на актуальную версию с колонкой "Сезон".
            body = parts.body.replace(
                HISTORY_BLOCK_REGEX,
                HISTORY_BLOCK
            );

            // На случай, если когда-то появились дубли,
            // оставляем только первый.
            let found = false;

            body = body.replace(
                HISTORY_BLOCK_REGEX,
                match => {
                    if (found) return "";
                    found = true;
                    return HISTORY_BLOCK;
                }
            );

            await app.vault.modify(
                serialFile,
                parts.frontmatterText +
                "\n" +
                body.trim() +
                "\n"
            );

            return;
        }

        // Первый переход со старого формата.
        // После миграции старые сезонные тексты убираем,
        // оставляя одну живую таблицу истории.
        if (hadLegacySections) {
            body = "\n" + HISTORY_BLOCK + "\n";

            if (poster) {
                body += `\n![](${poster})\n`;
            }

            await app.vault.modify(
                serialFile,
                parts.frontmatterText + body
            );

            return;
        }

        // Старых сезонных разделов нет, но истории еще нет.
        // Добавляем блок один раз и сохраняем прочий текст.
        let cleanBody = parts.body.trim();

        if (poster) {
            cleanBody = cleanBody.replace(
                /^\s*!\[[^\]]*\]\([^\n]*\)\s*$/gim,
                ""
            ).trim();
        }

        body = "\n\n" + HISTORY_BLOCK + "\n";

        if (cleanBody) {
            body += "\n" + cleanBody + "\n";
        }

        if (poster) {
            body += `\n![](${poster})\n`;
        }

        await app.vault.modify(
            serialFile,
            parts.frontmatterText + body
        );
    }

    // ----------------------------
    // Выбор сериала
    // ----------------------------

    let serialFile = app.workspace.getActiveFile();

    if (!isSerial(serialFile)) {
        const serials = app.vault
            .getMarkdownFiles()
            .filter(isSerial)
            .sort((a, b) =>
                a.basename.localeCompare(
                    b.basename,
                    "ru"
                )
            );

        if (serials.length === 0) {
            new Notice(
                "В папке Кино не найдено файлов с тегом serial."
            );
            return;
        }

        const labels = serials.map(file => {
            const fm = getFrontmatter(file);
            const originalTitle = fm["Название"];

            if (
                originalTitle &&
                String(originalTitle).trim() !==
                    file.basename
            ) {
                return (
                    `📺 ${file.basename}` +
                    ` | ${originalTitle}`
                );
            }

            return `📺 ${file.basename}`;
        });

        serialFile = await quickAddApi.suggester(
            labels,
            serials,
            "Выбери сериал"
        );

        if (!serialFile) return;
    }

    const originalText =
        await app.vault.read(serialFile);

    const originalParts =
        splitFrontmatter(originalText);

    const originalFm =
        getFrontmatter(serialFile);

    const oldWatchedDate =
        normalizeDate(originalFm["Просмотрено"]);

    const originalRating =
        toNumber(originalFm["Оценка"]);

    const alreadyHadHistory =
        hasHistoryBlock(originalParts.body);

    const legacySections =
        parseLegacySeasonSections(
            originalParts.body
        );

    const plainLegacyReview =
        getPlainLegacyReview(
            originalParts.body
        );

    let viewingFiles =
        getViewingFiles(serialFile);

    for (const file of viewingFiles) {
        await normalizeViewingFile(file);
    }

    viewingFiles =
        getViewingFiles(serialFile);

    const stats = getStats(viewingFiles);

    let maxLegacySeason = 0;

    for (const section of legacySections) {
        maxLegacySeason = Math.max(
            maxLegacySeason,
            section.season
        );
    }

    const hasPlainLegacy =
        !alreadyHadHistory &&
        legacySections.length === 0 &&
        viewingFiles.length === 0 &&
        oldWatchedDate !== null &&
        plainLegacyReview.length > 0;

    const knownMaxSeason = Math.max(
        stats.maxSeason,
        maxLegacySeason
    );

    const suggestedSeason =
        knownMaxSeason > 0
            ? knownMaxSeason + 1
            : hasPlainLegacy
                ? 2
                : 1;

    const explicitCount =
        toNumber(
            originalFm["Количество просмотров"]
        );

    const legacyMissingCount =
        legacySections.filter(
            section =>
                !hasSeasonRecord(
                    viewingFiles,
                    section.season
                )
        ).length;

    const inferredLegacyCount =
        legacySections.length > 0
            ? legacySections.length
            : hasPlainLegacy
                ? 1
                : 0;

    const currentCountBeforeNew =
        Math.max(
            explicitCount !== null
                ? Math.trunc(explicitCount)
                : 0,
            stats.count,
            stats.maxViewing,
            inferredLegacyCount
        );

    const predictedNewViewingNumber =
        currentCountBeforeNew + 1;

    const values =
        await quickAddApi.requestInputs([
            {
                id: "season",
                label: "Сезон",
                type: "number",
                defaultValue:
                    String(suggestedSeason),
                numericConfig: {
                    min: 1,
                    step: 1
                }
            },
            {
                id: "date",
                label: "Дата окончания сезона",
                type: "date",
                dateFormat: "YYYY-MM-DD",
                defaultValue:
                    quickAddApi.date.now(
                        "YYYY-MM-DD"
                    )
            },
            {
                id: "rating",
                label: "Оценка сезона",
                type: "number",
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
                placeholder:
                    "Короткая мысль о сезоне..."
            }
        ]);

    if (!values) return;

    const season = Number(values.season);

    if (
        !Number.isInteger(season) ||
        season < 1
    ) {
        new Notice(
            "Номер сезона должен быть целым числом больше 0."
        );
        return;
    }

    const newDate =
        normalizeDate(values.date);

    if (!newDate) {
        new Notice(
            `Некорректная дата: ${values.date}`
        );
        return;
    }

    let newRating = null;

    if (
        String(values.rating ?? "").trim() !==
        ""
    ) {
        newRating = toNumber(values.rating);

        if (
            newRating === null ||
            newRating < 1 ||
            newRating > 10
        ) {
            new Notice(
                "Оценка сезона должна быть от 1 до 10."
            );
            return;
        }
    }

    const newComment =
        String(values.comment ?? "").trim();

    // Если надо переносить старые отзывы,
    // но исходной даты нет - не выдумываем ее.
    if (
        !alreadyHadHistory &&
        (legacyMissingCount > 0 ||
            hasPlainLegacy) &&
        !oldWatchedDate
    ) {
        new Notice(
            "Найдены старые отзывы сезонов, " +
            "но в оригинальном файле нет корректного " +
            "поля Просмотрено."
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

    let migrated = 0;

    // ----------------------------
    // Миграция старых # N Сезон
    // ----------------------------

    if (
        !alreadyHadHistory &&
        legacySections.length > 0
    ) {
        viewingFiles =
            getViewingFiles(serialFile);

        let nextLegacyViewing =
            getStats(viewingFiles).maxViewing + 1;

        const sectionsToMigrate =
            [...legacySections]
                .sort(
                    (a, b) =>
                        a.season - b.season
                );

        for (const section of sectionsToMigrate) {
            if (
                hasSeasonRecord(
                    viewingFiles,
                    section.season
                )
            ) {
                continue;
            }

            // В старом файле нет отдельной даты/оценки
            // для каждого сезона. Имеющуюся дату используем
            // как дату старой записи. Общую оценку сериала
            // переносим только в последний старый сезон.
            const isLastLegacySeason =
                section.season ===
                maxLegacySeason;

            const created =
                await createViewingFile({
                    serialFile,
                    season: section.season,
                    date: oldWatchedDate,
                    viewingNumber:
                        nextLegacyViewing,
                    rating:
                        isLastLegacySeason
                            ? originalRating
                            : null,
                    comment: section.comment
                });

            await normalizeViewingFile(created);

            viewingFiles =
                getViewingFiles(serialFile);

            nextLegacyViewing++;
            migrated++;
        }
    } else if (
        !alreadyHadHistory &&
        hasPlainLegacy
    ) {
        // Старый одиночный отзыв без заголовка сезона.
        // Если сейчас добавляется сезон N, считаем старую
        // запись предыдущим сезоном N-1.
        const previousSeason =
            Math.max(1, season - 1);

        if (
            !hasSeasonRecord(
                getViewingFiles(serialFile),
                previousSeason
            )
        ) {
            const viewingNumber =
                getStats(
                    getViewingFiles(serialFile)
                ).maxViewing + 1;

            const created =
                await createViewingFile({
                    serialFile,
                    season: previousSeason,
                    date: oldWatchedDate,
                    viewingNumber,
                    rating: originalRating,
                    comment: plainLegacyReview
                });

            await normalizeViewingFile(created);
            migrated++;
        }
    }

    // ----------------------------
    // Новый сезон
    // ----------------------------

    viewingFiles =
        getViewingFiles(serialFile);

    const afterMigrationStats =
        getStats(viewingFiles);

    const actualNewViewingNumber =
        Math.max(
            predictedNewViewingNumber,
            afterMigrationStats.maxViewing + 1,
            afterMigrationStats.count + 1
        );

    const newViewingFile =
        await createViewingFile({
            serialFile,
            season,
            date: newDate,
            viewingNumber:
                actualNewViewingNumber,
            rating: newRating,
            comment: newComment
        });

    await normalizeViewingFile(
        newViewingFile
    );

    // Сравнение последней и предпоследней оценки,
    // совместимо с View "Изменение оценки".
    await rebuildRatingDelta(serialFile);

    viewingFiles =
        getViewingFiles(serialFile);

    const finalStats =
        getStats(viewingFiles);

    const finalCount =
        Math.max(
            finalStats.count,
            finalStats.maxViewing
        );

    await normalizeOriginal(
        serialFile,
        newDate,
        finalCount
    );

    // ВАЖНО: блок истории всегда один.
    await ensureSingleHistoryBlock(
        serialFile,
        legacySections.length > 0 ||
            hasPlainLegacy
    );

    if (migrated > 0) {
        new Notice(
            `${serialFile.basename}: перенесено старых сезонов: ${migrated}; ` +
            `добавлен сезон ${season}, просмотр #${actualNewViewingNumber}`
        );
    } else {
        new Notice(
            `${serialFile.basename}: добавлен сезон ${season}, ` +
            `просмотр #${actualNewViewingNumber}`
        );
    }

    await app.workspace
        .getLeaf(false)
        .openFile(newViewingFile);
};
