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

    function isSerial(file) {
        if (!file || file.extension !== "md") return false;
        if (!file.path.startsWith(MEDIA_FOLDER + "/")) return false;
        if (file.path.startsWith(VIEWINGS_FOLDER + "/")) return false;

        const fm = getFrontmatter(file);
        return getTags(fm).includes("serial");
    }

    function getExplicitViewingCount(frontmatter) {
        const value = Number(frontmatter?.["Количество просмотров"]);

        if (Number.isFinite(value) && value >= 0) {
            return Math.floor(value);
        }

        return null;
    }

    function viewingBelongsToSerial(frontmatter, serialFile) {
        const raw = frontmatter?.["Фильм"];
        if (!raw) return false;

        const text = String(raw);
        const pathWithoutExt = serialFile.path.replace(/\.md$/i, "");

        return (
            text.includes(pathWithoutExt) ||
            text.includes(serialFile.basename)
        );
    }

    function getViewingStats(serialFile) {
        let maxSeason = 0;
        let recordCount = 0;
        let maxViewingNumber = 0;

        const files = app.vault
            .getMarkdownFiles()
            .filter(file => file.path.startsWith(VIEWINGS_FOLDER + "/"));

        for (const file of files) {
            const fm = getFrontmatter(file);

            if (!viewingBelongsToSerial(fm, serialFile)) {
                continue;
            }

            recordCount++;

            const season = Number(fm["Сезон"]);
            if (Number.isInteger(season) && season > maxSeason) {
                maxSeason = season;
            }

            const viewingNumber = Number(fm["Просмотр"]);
            if (
                Number.isInteger(viewingNumber) &&
                viewingNumber > maxViewingNumber
            ) {
                maxViewingNumber = viewingNumber;
            }
        }

        return {
            maxSeason,
            recordCount,
            maxViewingNumber
        };
    }

    async function getMaxSeasonFromSerialBody(serialFile) {
        const text = await app.vault.read(serialFile);

        let maxSeason = 0;

        const patterns = [
            /^#{1,6}\s*(\d+)\s*сезон\b/gim,
            /^#{1,6}\s*сезон\s*(\d+)\b/gim
        ];

        for (const pattern of patterns) {
            for (const match of text.matchAll(pattern)) {
                const season = Number(match[1]);

                if (Number.isInteger(season) && season > maxSeason) {
                    maxSeason = season;
                }
            }
        }

        return maxSeason;
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

    let serialFile = app.workspace.getActiveFile();

    if (!isSerial(serialFile)) {
        const serials = app.vault
            .getMarkdownFiles()
            .filter(isSerial)
            .sort((a, b) => a.basename.localeCompare(b.basename, "ru"));

        if (serials.length === 0) {
            new Notice("В папке Кино не найдено файлов с тегом serial.");
            return;
        }

        const displayNames = serials.map(file => {
            const fm = getFrontmatter(file);
            const originalTitle = fm["Название"];

            if (
                originalTitle &&
                String(originalTitle).trim() !== file.basename
            ) {
                return `📺 ${file.basename} | ${originalTitle}`;
            }

            return `📺 ${file.basename}`;
        });

        serialFile = await quickAddApi.suggester(
            displayNames,
            serials,
            "Выбери сериал"
        );

        if (!serialFile) return;
    }

    const fm = getFrontmatter(serialFile);

    const viewingStats = getViewingStats(serialFile);
    const maxSeasonFromBody = await getMaxSeasonFromSerialBody(serialFile);

    const knownMaxSeason = Math.max(
        viewingStats.maxSeason,
        maxSeasonFromBody
    );

    const suggestedSeason = knownMaxSeason > 0
        ? knownMaxSeason + 1
        : 1;

    const explicitCount = getExplicitViewingCount(fm);

    let currentViewingCount;

    if (explicitCount !== null) {
        currentViewingCount = explicitCount;
    } else {
        currentViewingCount = Math.max(
            viewingStats.maxViewingNumber,
            viewingStats.recordCount,
            knownMaxSeason,
            fm["Просмотрено"] ? 1 : 0
        );
    }

    const nextViewingCount = currentViewingCount + 1;

    const values = await quickAddApi.requestInputs([
        {
            id: "season",
            label: "Сезон",
            type: "number",
            defaultValue: String(suggestedSeason),
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
            defaultValue: quickAddApi.date.now("YYYY-MM-DD")
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
            placeholder: "Короткая мысль о сезоне..."
        }
    ]);

    const season = Number(values.season);

    if (!Number.isInteger(season) || season < 1) {
        new Notice("Номер сезона должен быть целым числом больше 0.");
        return;
    }

    const viewingDate = normalizeDate(values.date);

    if (!isValidDate(viewingDate)) {
        new Notice(`Некорректная дата: ${viewingDate}`);
        return;
    }

    let rating = null;

    if (String(values.rating ?? "").trim() !== "") {
        rating = Number(values.rating);

        if (!Number.isFinite(rating) || rating < 1 || rating > 10) {
            new Notice("Оценка сезона должна быть от 1 до 10.");
            return;
        }
    }

    const comment = String(values.comment ?? "").trim();
    const year = viewingDate.slice(0, 4);

    if (!app.vault.getAbstractFileByPath(VIEWINGS_FOLDER)) {
        await app.vault.createFolder(VIEWINGS_FOLDER);
    }

    const safeSerialName = serialFile.basename.replace(/[\\/:*?"<>|]/g, "-");

    let fileName =
        `${safeSerialName} - сезон ${season}` +
        ` - просмотр ${nextViewingCount}` +
        ` - ${viewingDate}.md`;

    let viewingPath = normalizePath(
        `${VIEWINGS_FOLDER}/${fileName}`
    );

    // Если такой файл уже существует, добавляем числовой суффикс,
    // чтобы не потерять повторный просмотр того же сезона в ту же дату.
    if (app.vault.getAbstractFileByPath(viewingPath)) {
        let suffix = 2;

        while (
            app.vault.getAbstractFileByPath(
                normalizePath(
                    `${VIEWINGS_FOLDER}/` +
                    `${safeSerialName} - сезон ${season}` +
                    ` - просмотр ${nextViewingCount}` +
                    ` - ${viewingDate} (${suffix}).md`
                )
            )
        ) {
            suffix++;
        }

        fileName =
            `${safeSerialName} - сезон ${season}` +
            ` - просмотр ${nextViewingCount}` +
            ` - ${viewingDate} (${suffix}).md`;

        viewingPath = normalizePath(
            `${VIEWINGS_FOLDER}/${fileName}`
        );
    }

    const serialLink =
        `[[${serialFile.path.replace(/\.md$/i, "")}|${serialFile.basename}]]`;

    let content = "---\n";
    content += `Фильм: ${yamlString(serialLink)}\n`;
    content += `Дата: ${viewingDate}\n`;
    content += `Год: ${year}\n`;
    content += `Просмотр: ${nextViewingCount}\n`;
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

    const viewingFile = await app.vault.create(
        viewingPath,
        content
    );

    await app.fileManager.processFrontMatter(
        serialFile,
        frontmatter => {
            frontmatter["Просмотрено"] = viewingDate;
            frontmatter["Количество просмотров"] = nextViewingCount;
        }
    );

    new Notice(
        `${serialFile.basename}: сезон ${season}, просмотр #${nextViewingCount}`
    );

    await app.workspace.getLeaf(false).openFile(viewingFile);
};
