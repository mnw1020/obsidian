module.exports = async (params) => {
    const { app, quickAddApi, obsidian } = params;
    const { Notice, normalizePath, parseYaml } = obsidian;

    const MEDIA_FOLDER = "Кино";
    const SEASONS_FOLDER = "Кино/Сезоны";

    const SEASONS_START = "<!-- SEASONS:START -->";
    const SEASONS_END = "<!-- SEASONS:END -->";

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
        if (file.path.startsWith(SEASONS_FOLDER + "/")) return false;

        return getTags(getFrontmatter(file)).includes("serial");
    }

    function toNumber(value) {
        if (
            value === null ||
            value === undefined ||
            String(value).trim() === ""
        ) {
            return null;
        }

        if (typeof value === "number") {
            return Number.isFinite(value) ? value : null;
        }

        const result = Number(
            String(value)
                .trim()
                .replace(",", ".")
        );

        return Number.isFinite(result) ? result : null;
    }

    function formatNumber(value) {
        const number = toNumber(value);

        if (number === null) {
            return "";
        }

        return Number.isInteger(number)
            ? String(number)
            : String(number);
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
        if (
            value === null ||
            value === undefined ||
            String(value).trim() === ""
        ) {
            return null;
        }

        if (value instanceof Date && !Number.isNaN(value.getTime())) {
            const y = value.getFullYear();
            const m = String(value.getMonth() + 1).padStart(2, "0");
            const d = String(value.getDate()).padStart(2, "0");

            return `${y}-${m}-${d}`;
        }

        const text = String(value)
            .trim()
            .replace(/^@date:/, "");

        // Только год: 2021 -> 2021-01-01
        let match = text.match(/^(\d{4})$/);

        if (match) {
            return `${match[1]}-01-01`;
        }

        // YYYY-M-D / YYYY-MM-DD
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

        // Старый формат: 09 Jun 2021
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

    function splitFrontmatter(text) {
        const lines = String(text ?? "").split(/\r?\n/);

        if (lines[0]?.trim() !== "---") {
            return {
                frontmatterText: "",
                body: String(text ?? "")
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
                body: String(text ?? "")
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

    function yamlString(value) {
        return JSON.stringify(String(value ?? ""));
    }

    function yamlMultiline(value) {
        const text = String(value ?? "").replace(/\r\n/g, "\n");

        if (!text) {
            return 'Комментарий: ""\n';
        }

        const indented = text
            .split("\n")
            .map(line => "  " + line)
            .join("\n");

        return "Комментарий: |-\n" + indented + "\n";
    }

    function getLinkTarget(value) {
        if (!value) return "";

        if (typeof value === "object" && value.path) {
            return String(value.path)
                .replace(/\.md$/i, "")
                .trim();
        }

        let text = String(value).trim();

        if (text.startsWith("[[") && text.endsWith("]]")) {
            text = text.slice(2, -2);
        }

        text = text.split("|")[0].trim();

        return text.replace(/\.md$/i, "");
    }

    function seasonBelongsToSerial(frontmatter, serialFile) {
        const target = getLinkTarget(frontmatter?.["Сериал"]);

        if (!target) return false;

        const serialPath = serialFile.path.replace(/\.md$/i, "");

        return (
            target === serialPath ||
            target === serialFile.basename ||
            target.endsWith("/" + serialFile.basename)
        );
    }

    function getSeasonFiles(serialFile) {
        return app.vault
            .getMarkdownFiles()
            .filter(file => {
                if (!file.path.startsWith(SEASONS_FOLDER + "/")) {
                    return false;
                }

                return seasonBelongsToSerial(
                    getFrontmatter(file),
                    serialFile
                );
            });
    }

    function getSeasonNumber(file) {
        const value = toNumber(
            getFrontmatter(file)["Сезон"]
        );

        if (
            value === null ||
            !Number.isInteger(value) ||
            value < 1
        ) {
            return null;
        }

        return value;
    }

    function hasSeason(files, seasonNumber) {
        return files.some(
            file => getSeasonNumber(file) === seasonNumber
        );
    }

    function parseHeadingRating(text) {
        if (!text) return null;

        const match = String(text).match(
            /(\d+(?:[.,]\d+)?)\s*(?:\/\s*10)?/
        );

        if (!match) return null;

        const rating = Number(
            match[1].replace(",", ".")
        );

        if (
            !Number.isFinite(rating) ||
            rating < 1 ||
            rating > 10
        ) {
            return null;
        }

        return rating;
    }

    function removeExactPoster(body, posterUrl) {
        let result = String(body ?? "");

        if (posterUrl) {
            const escaped = String(posterUrl)
                .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

            const imageRegex = new RegExp(
                "^\\s*!\\[[^\\]]*\\]\\(" +
                escaped +
                "\\)\\s*$",
                "gim"
            );

            result = result.replace(imageRegex, "");
        }

        // Конечный разделитель, который обычно стоит перед постером.
        result = result.replace(
            /\n\s*(?:---|\*\*\*|___)\s*$/m,
            ""
        );

        return result.trim();
    }

    function removeOldGeneratedBlocks(body) {
        let result = String(body ?? "");

        // Старый DataviewJS-блок из предыдущей версии.
        result = result.replace(
            /```dataviewjs[\s\S]*?```/gi,
            ""
        );

        // Старый Dataview-блок, если он когда-то использовался.
        result = result.replace(
            /```dataview[\s\S]*?```/gi,
            ""
        );

        // Нативный блок, если по какой-то причине сезоны надо мигрировать заново.
        const start = result.indexOf(SEASONS_START);
        const end = result.indexOf(SEASONS_END);

        if (start !== -1 && end !== -1 && end > start) {
            result =
                result.slice(0, start) +
                result.slice(end + SEASONS_END.length);
        }

        return result.trim();
    }

    function cleanSeasonBody(text, posterUrl) {
        let result = removeOldGeneratedBlocks(text);
        result = removeExactPoster(result, posterUrl);

        // Старый block-id переносить в файл сезона не нужно.
        result = result.replace(
            /^\s*\^[A-Za-z0-9_-]+\s*$/gm,
            ""
        );

        return result.trim();
    }

    function parseLegacySeasons(body, posterUrl) {
        const cleanBody = cleanSeasonBody(body, posterUrl);

        // Поддерживает:
        // # 1 Сезон
        // # Сезон 1
        // # Сезон 1 (9)
        // # Сезон 1 (9/10)
        const regex =
            /^#{1,6}\s*(?:(\d+)\s*сезон|сезон\s*(\d+))(?:\s*\(([^)]*)\))?\s*$/gim;

        const matches = [...cleanBody.matchAll(regex)];

        if (matches.length === 0) {
            return [];
        }

        const result = [];

        const preamble = cleanSeasonBody(
            cleanBody.slice(0, matches[0].index),
            posterUrl
        );

        for (let i = 0; i < matches.length; i++) {
            const current = matches[i];
            const next = matches[i + 1];

            const season = Number(
                current[1] ?? current[2]
            );

            const rating = parseHeadingRating(
                current[3]
            );

            const start =
                current.index + current[0].length;

            const end = next
                ? next.index
                : cleanBody.length;

            let comment = cleanSeasonBody(
                cleanBody.slice(start, end),
                posterUrl
            );

            if (i === 0 && preamble) {
                comment =
                    preamble +
                    (comment ? "\n\n" + comment : "");
            }

            if (
                Number.isInteger(season) &&
                season > 0
            ) {
                result.push({
                    season,
                    rating,
                    comment
                });
            }
        }

        return result;
    }

    function getPlainLegacySeason(body, posterUrl) {
        const clean = cleanSeasonBody(
            body,
            posterUrl
        );

        if (!clean) return null;

        return {
            season: 1,
            rating: null,
            comment: clean
        };
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

    function safeName(name) {
        return String(name)
            .replace(/[\\/:*?"<>|]/g, "-")
            .trim();
    }

    function makeSeasonPath(serialFile, seasonNumber) {
        const padded = String(seasonNumber).padStart(2, "0");

        return normalizePath(
            `${SEASONS_FOLDER}/` +
            `${safeName(serialFile.basename)} - сезон ${padded}.md`
        );
    }

    function buildSeasonContent({
        serialFile,
        seasonNumber,
        date,
        rating,
        comment
    }) {
        let content = "---\n";
        content += `Сериал: ${yamlString(makeSerialLink(serialFile))}\n`;
        content += `Сезон: ${seasonNumber}\n`;
        content += `Дата: ${date}\n`;

        if (rating !== null) {
            content += `Оценка: ${rating}\n`;
        } else {
            content += "Оценка:\n";
        }

        content += "tags:\n";
        content += "  - season\n";
        content += yamlMultiline(comment);
        content += "---\n";

        return content;
    }

    async function createSeasonFile({
        serialFile,
        seasonNumber,
        date,
        rating,
        comment
    }) {
        const path = makeSeasonPath(
            serialFile,
            seasonNumber
        );

        if (app.vault.getAbstractFileByPath(path)) {
            throw new Error(
                `Файл сезона уже существует: ${path}`
            );
        }

        return await app.vault.create(
            path,
            buildSeasonContent({
                serialFile,
                seasonNumber,
                date,
                rating,
                comment
            })
        );
    }

    async function normalizeSeasonFile(file) {
        await app.fileManager.processFrontMatter(
            file,
            frontmatter => {
                const season = toNumber(frontmatter["Сезон"]);

                if (season !== null) {
                    frontmatter["Сезон"] = Math.trunc(season);
                }

                const date = normalizeDate(frontmatter["Дата"]);

                if (date) {
                    frontmatter["Дата"] = date;
                }

                const rating = toNumber(frontmatter["Оценка"]);

                if (rating !== null) {
                    frontmatter["Оценка"] = rating;
                }

                const tags = getTags(frontmatter);

                if (!tags.includes("season")) {
                    tags.push("season");
                }

                frontmatter.tags = tags;
            }
        );
    }

    function sortSeasonFiles(files) {
        return [...files]
            .filter(file => getSeasonNumber(file) !== null)
            .sort(
                (a, b) =>
                    getSeasonNumber(a) -
                    getSeasonNumber(b)
            );
    }

    async function rebuildSeasonDeltas(serialFile) {
        const files = sortSeasonFiles(
            getSeasonFiles(serialFile)
        );

        for (const file of files) {
            await normalizeSeasonFile(file);
            await migrateSeasonFileToYaml(file);
        }

        for (let i = 0; i < files.length; i++) {
            const file = files[i];

            await app.fileManager.processFrontMatter(
                file,
                frontmatter => {
                    delete frontmatter["Предыдущая оценка"];
                    delete frontmatter["Изменение оценки"];

                    if (i === 0) {
                        return;
                    }

                    const currentRating = toNumber(
                        frontmatter["Оценка"]
                    );

                    const previousRating = toNumber(
                        getFrontmatter(files[i - 1])["Оценка"]
                    );

                    if (
                        currentRating === null ||
                        previousRating === null
                    ) {
                        return;
                    }

                    frontmatter["Предыдущая оценка"] =
                        previousRating;

                    frontmatter["Изменение оценки"] =
                        Number(
                            (
                                currentRating -
                                previousRating
                            ).toFixed(2)
                        );
                }
            );
        }
    }

    async function normalizeOriginalFrontmatter(
        serialFile,
        latestDate
    ) {
        const seasonFiles = sortSeasonFiles(
            getSeasonFiles(serialFile)
        );

        const maxSeason =
            seasonFiles.length > 0
                ? Math.max(
                    ...seasonFiles.map(getSeasonNumber)
                )
                : 0;

        await app.fileManager.processFrontMatter(
            serialFile,
            frontmatter => {
                if (latestDate) {
                    frontmatter["Просмотрено"] = latestDate;
                } else {
                    const watched = normalizeDate(
                        frontmatter["Просмотрено"]
                    );

                    if (watched) {
                        frontmatter["Просмотрено"] = watched;
                    }
                }

                frontmatter["Количество сезонов"] =
                    seasonFiles.length;

                frontmatter["Последний сезон"] =
                    maxSeason;

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

    async function readSeasonYamlComment(file) {
        const raw = await app.vault.read(file);
        const parts = splitFrontmatter(raw);

        if (!parts.frontmatterText) {
            return "";
        }

        const yamlText = parts.frontmatterText
            .replace(/^---\s*\r?\n/, "")
            .replace(/\r?\n---\s*$/, "");

        const parsed = parseYaml(yamlText) ?? {};
        const value = parsed["Комментарий"];

        if (
            value === null ||
            value === undefined
        ) {
            return "";
        }

        return String(value).trim();
    }

    async function readLegacySeasonBody(file) {
        const raw = await app.vault.read(file);
        const parts = splitFrontmatter(raw);

        let body = parts.body.trim();

        // Старый wikilink-backlink.
        body = body.replace(
            /\n?\s*---\s*\r?\n\s*\[\[[^\]\n]+\|←[^\]\n]+\]\]\s*$/i,
            ""
        );

        // Старый Markdown-backlink.
        body = body.replace(
            /\n?\s*---\s*\r?\n\s*\[←[^\]\n]+\]\([^)]+\)\s*$/i,
            ""
        );

        // Старые версии могли писать заголовок сезона в тело.
        body = body.replace(
            /^#{1,6}\s*(?:(?:\d+)\s*сезон|сезон\s*(?:\d+))(?:\s*\([^)]*\))?\s*\r?\n+/i,
            ""
        );

        return body.trim();
    }

    async function migrateSeasonFileToYaml(file) {
        const yamlComment =
            await readSeasonYamlComment(file);

        const legacyBody =
            await readLegacySeasonBody(file);

        // YAML - единственный источник.
        // Если YAML уже заполнен, старое тело не перезаписывает его.
        const finalComment =
            yamlComment || legacyBody;

        await app.fileManager.processFrontMatter(
            file,
            frontmatter => {
                frontmatter["Комментарий"] =
                    finalComment;
            }
        );

        // Полностью очищаем тело файла сезона.
        const updated =
            await app.vault.read(file);

        const parts =
            splitFrontmatter(updated);

        if (!parts.frontmatterText) {
            throw new Error(
                `Не найден YAML frontmatter: ${file.path}`
            );
        }

        await app.vault.modify(
            file,
            parts.frontmatterText + "\n"
        );
    }

    async function readSeasonComment(file) {
        return await readSeasonYamlComment(file);
    }

    async function syncSeasonComments(serialFile) {
        const files = sortSeasonFiles(
            getSeasonFiles(serialFile)
        );

        for (const file of files) {
            await migrateSeasonFileToYaml(file);
        }
    }

    async function rebuildOriginalMarkdown(serialFile) {
        const seasonFiles = sortSeasonFiles(
            getSeasonFiles(serialFile)
        );

        const fm = getFrontmatter(serialFile);
        const poster = String(fm.poster ?? "").trim();

        const originalText =
            await app.vault.read(serialFile);

        const parts = splitFrontmatter(
            originalText
        );

        if (!parts.frontmatterText) {
            throw new Error(
                "В оригинальном файле не найден YAML frontmatter."
            );
        }

        const chunks = [];

        chunks.push(SEASONS_START);

        for (const file of seasonFiles) {
            const season = getSeasonNumber(file);
            const seasonFm = getFrontmatter(file);
            const rating = toNumber(
                seasonFm["Оценка"]
            );

            const heading =
                rating !== null
                    ? `# Сезон ${season} (${formatNumber(rating)}/10)`
                    : `# Сезон ${season} (без оценки)`;

            const comment =
                await readSeasonComment(file);

            chunks.push(heading);

            if (comment) {
                chunks.push(comment);
            }
        }

        chunks.push(SEASONS_END);

        let body =
            "\n\n" +
            chunks.join("\n\n") +
            "\n";

        // Постер всегда в самом низу оригинального файла.
        if (poster) {
            body +=
                "\n---\n" +
                `![](${poster})\n`;
        }

        await app.vault.modify(
            serialFile,
            parts.frontmatterText + body
        );
    }

    // -------------------------------------------------
    // 1. Выбор сериала
    // -------------------------------------------------

    let serialFile = app.workspace.getActiveFile();

    if (!isSerial(serialFile)) {
        const serials = app.vault
            .getMarkdownFiles()
            .filter(isSerial)
            .sort(
                (a, b) =>
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

    const poster =
        String(originalFm.poster ?? "").trim();

    let seasonFiles =
        getSeasonFiles(serialFile);

    // -------------------------------------------------
    // 2. Встроенная миграция старого оригинального файла
    //    выполняется только если файлов сезонов еще нет.
    // -------------------------------------------------

    let legacySeasons = [];

    if (seasonFiles.length === 0) {
        legacySeasons = parseLegacySeasons(
            originalParts.body,
            poster
        );

        if (legacySeasons.length === 0) {
            const plain =
                getPlainLegacySeason(
                    originalParts.body,
                    poster
                );

            if (plain) {
                legacySeasons = [plain];
            }
        }
    }

    const originalDate =
        normalizeDate(
            originalFm["Просмотрено"]
        );

    const originalRating =
        toNumber(
            originalFm["Оценка"]
        );

    const existingNumbers = seasonFiles
        .map(getSeasonNumber)
        .filter(value => value !== null);

    const legacyNumbers = legacySeasons
        .map(item => item.season);

    const maxKnownSeason = Math.max(
        0,
        ...existingNumbers,
        ...legacyNumbers
    );

    const suggestedSeason =
        maxKnownSeason > 0
            ? maxKnownSeason + 1
            : 2;

    // -------------------------------------------------
    // 3. Ввод нового сезона
    // -------------------------------------------------

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
                    "Мысль после сезона..."
            }
        ]);

    if (!values) return;

    const newSeason =
        Number(values.season);

    if (
        !Number.isInteger(newSeason) ||
        newSeason < 1
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
        newRating =
            toNumber(values.rating);

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

    seasonFiles =
        getSeasonFiles(serialFile);

    if (
        hasSeason(
            seasonFiles,
            newSeason
        )
    ) {
        new Notice(
            `${serialFile.basename}: сезон ${newSeason} уже существует.`
        );
        return;
    }

    if (
        seasonFiles.length === 0 &&
        legacySeasons.length > 0 &&
        !originalDate
    ) {
        new Notice(
            "Для переноса старого сезона нет корректного " +
            "поля Просмотрено в оригинальной карточке."
        );
        return;
    }

    if (
        !app.vault.getAbstractFileByPath(
            SEASONS_FOLDER
        )
    ) {
        await app.vault.createFolder(
            SEASONS_FOLDER
        );
    }

    // -------------------------------------------------
    // 4. Первая миграция
    // -------------------------------------------------

    let migrated = 0;

    if (seasonFiles.length === 0) {
        const sortedLegacy =
            [...legacySeasons]
                .sort(
                    (a, b) =>
                        a.season - b.season
                );

        const maxLegacyNumber =
            sortedLegacy.length > 0
                ? Math.max(
                    ...sortedLegacy.map(
                        item => item.season
                    )
                )
                : 0;

        for (const item of sortedLegacy) {
            let legacyRating =
                item.rating;

            // Если старый файл был просто одним отзывом,
            // старая общая оценка становится оценкой сезона 1.
            // Если старых сезонных разделов несколько,
            // общую оценку относим только к последнему старому сезону,
            // если в заголовках не было собственных оценок.
            if (legacyRating === null) {
                if (
                    sortedLegacy.length === 1
                ) {
                    legacyRating =
                        originalRating;
                } else if (
                    item.season ===
                    maxLegacyNumber
                ) {
                    legacyRating =
                        originalRating;
                }
            }

            const migratedFile =
                await createSeasonFile({
                    serialFile,
                    seasonNumber:
                        item.season,
                    date:
                        originalDate,
                    rating:
                        legacyRating,
                    comment:
                        item.comment
                });

            await normalizeSeasonFile(
                migratedFile
            );

            migrated++;
        }

        const afterMigration =
            getSeasonFiles(serialFile);

        // Если введенный "новый" сезон уже был найден
        // в старом оригинальном тексте - дубль не создаем,
        // но все равно переводим оригинал в нативную схему.
        if (
            hasSeason(
                afterMigration,
                newSeason
            )
        ) {
            await rebuildSeasonDeltas(
                serialFile
            );

            await normalizeOriginalFrontmatter(
                serialFile,
                null
            );

            await syncSeasonComments(
                serialFile
            );

            await rebuildOriginalMarkdown(
                serialFile
            );

            new Notice(
                `${serialFile.basename}: перенесено старых сезонов: ${migrated}. ` +
                `Сезон ${newSeason} уже существовал, дубль не создан.`
            );

            return;
        }
    }

    // -------------------------------------------------
    // 5. Создание нового сезона
    // -------------------------------------------------

    const created =
        await createSeasonFile({
            serialFile,
            seasonNumber:
                newSeason,
            date:
                newDate,
            rating:
                newRating,
            comment:
                newComment
        });

    await normalizeSeasonFile(
        created
    );

    // Дельта относительно предыдущего сезона.
    await rebuildSeasonDeltas(
        serialFile
    );

    // Нормализуем YAML оригинала + количество сезонов.
    await normalizeOriginalFrontmatter(
        serialFile,
        newDate
    );

    // YAML `Комментарий` - единственный источник отзыва.
    // Старые тела файлов при необходимости мигрируются автоматически.
    await syncSeasonComments(
        serialFile
    );

    // ВАЖНО:
    // оригинальный файл каждый раз собирается НАТИВНЫМ Markdown.
    // Никакого Dataview/DataviewJS внутри него больше нет.
    await rebuildOriginalMarkdown(
        serialFile
    );

    if (migrated > 0) {
        new Notice(
            `${serialFile.basename}: перенесено старых сезонов: ${migrated}; ` +
            `добавлен сезон ${newSeason}; оригинальная карточка пересобрана.`
        );
    } else {
        new Notice(
            `${serialFile.basename}: добавлен сезон ${newSeason}; ` +
            `оригинальная карточка пересобрана.`
        );
    }

    await app.workspace
        .getLeaf(false)
        .openFile(created);
};
