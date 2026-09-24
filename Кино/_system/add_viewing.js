module.exports = async (params) => {
    const { app, quickAddApi, obsidian } = params;
    const { Notice, normalizePath, parseYaml } = obsidian;

    const MEDIA_FOLDER = "Кино";
    const VIEWINGS_FOLDER = "Кино/Просмотры";
    const SEASONS_FOLDER = "Кино/Сезоны";

    const VIEWINGS_START = "<!-- VIEWINGS:START -->";
    const VIEWINGS_END = "<!-- VIEWINGS:END -->";
    const SEASONS_START = "<!-- SEASONS:START -->";
    const SEASONS_END = "<!-- SEASONS:END -->";


    function getCachedFm(file) {
        return app.metadataCache.getFileCache(file)?.frontmatter ?? {};
    }

    function getTags(fm) {
        const raw = fm?.tags;
        if (!raw) return [];

        return (Array.isArray(raw) ? raw : [raw])
            .map(v => String(v).trim().replace(/^#/, ""))
            .filter(Boolean);
    }

    function toNumber(value) {
        if (
            value === null ||
            value === undefined ||
            String(value).trim() === ""
        ) {
            return null;
        }

        const n = Number(
            String(value).trim().replace(",", ".")
        );

        return Number.isFinite(n) ? n : null;
    }

    function isRealDate(year, month, day) {
        const date = new Date(
            Date.UTC(year, month - 1, day)
        );

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

        if (
            value instanceof Date &&
            !Number.isNaN(value.getTime())
        ) {
            const y = value.getFullYear();
            const m = String(
                value.getMonth() + 1
            ).padStart(2, "0");
            const d = String(
                value.getDate()
            ).padStart(2, "0");

            return `${y}-${m}-${d}`;
        }

        const text = String(value)
            .trim()
            .replace(/^@date:/, "");

        let match = text.match(/^(\d{4})$/);

        if (match) {
            return `${match[1]}-01-01`;
        }

        match = text.match(
            /^(\d{4})-(\d{1,2})-(\d{1,2})/
        );

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

        const months = {
            jan: 1, feb: 2, mar: 3, apr: 4,
            may: 5, jun: 6, jul: 7, aug: 8,
            sep: 9, oct: 10, nov: 11, dec: 12
        };

        match = text.match(
            /^(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})$/i
        );

        if (match) {
            const day = Number(match[1]);
            const month =
                months[match[2].toLowerCase()];
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

    function displayDate(value) {
        const date = normalizeDate(value);

        if (!date) return "";

        const [y, m, d] = date.split("-");
        return `${d}.${m}.${y}`;
    }

    function splitFrontmatter(text) {
        const lines =
            String(text ?? "").split(/\r?\n/);

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


    function extractPersistentCardBlocks(body) {
        const text = String(body ?? "");
        const blocks = [];
        const role = text.match(/<!-- KINO:ROLES:EMBED:V2 -->\r?\n<details[^>]*class=["']kino-roles-details["'][^>]*>[\s\S]*?<\/details>/m);
        const recommend = text.match(/<!-- KINO:RECOMMEND:BUTTON:V2 -->\r?\n```dataviewjs\r?\n[\s\S]*?^```[ \t]*$/m);
        if (role?.[0]) blocks.push(role[0].trim());
        if (recommend?.[0]) blocks.push(recommend[0].trim());
        return blocks.join("\n\n");
    }

    async function readFm(file) {
        const raw = await app.vault.read(file);
        const parts = splitFrontmatter(raw);

        if (!parts.frontmatterText) {
            return {};
        }

        const yaml = parts.frontmatterText
            .replace(/^---\s*\r?\n/, "")
            .replace(/\r?\n---\s*$/, "");

        return parseYaml(yaml) ?? {};
    }

    function yamlString(value) {
        return JSON.stringify(
            String(value ?? "")
        );
    }

    function yamlMultiline(value) {
        const text = String(value ?? "")
            .replace(/\r\n/g, "\n");

        if (!text) {
            return 'Комментарий: ""\n';
        }

        const indented = text
            .split("\n")
            .map(line => "  " + line)
            .join("\n");

        return (
            "Комментарий: |-\n" +
            indented +
            "\n"
        );
    }

    function linkTarget(value) {
        if (!value) return "";

        if (
            typeof value === "object" &&
            value.path
        ) {
            return String(value.path)
                .replace(/\.md$/i, "");
        }

        let text = String(value).trim();

        if (
            text.startsWith("[[") &&
            text.endsWith("]]")
        ) {
            text = text.slice(2, -2);
        }

        return text
            .split("|")[0]
            .trim()
            .replace(/\.md$/i, "");
    }

    function resolveLink(value, sourcePath) {
        const target = linkTarget(value);

        if (!target) return null;

        const direct =
            app.vault.getAbstractFileByPath(
                target + ".md"
            ) ??
            app.vault.getAbstractFileByPath(
                target
            );

        if (direct?.extension === "md") {
            return direct;
        }

        return app.metadataCache
            .getFirstLinkpathDest(
                target,
                sourcePath
            );
    }

    function safeName(name) {
        return String(name)
            .replace(/[\\/:*?"<>|]/g, "-")
            .trim();
    }

    function makeMediaLink(mediaFile) {
        return (
            "[[" +
            mediaFile.path.replace(/\.md$/i, "") +
            "|" +
            mediaFile.basename +
            "]]"
        );
    }


    function isMedia(file) {
        if (!file || file.extension !== "md") return false;
        if (!file.path.startsWith(MEDIA_FOLDER + "/")) return false;
        if (file.path.startsWith(VIEWINGS_FOLDER + "/")) return false;
        if (file.path.startsWith(SEASONS_FOLDER + "/")) return false;

        const tags = getTags(getCachedFm(file));
        return tags.includes("movies") || tags.includes("serial");
    }


    async function getViewingFiles(mediaFile) {
        const result = [];

        for (
            const file of
            app.vault.getMarkdownFiles()
        ) {
            if (
                !file.path.startsWith(
                    VIEWINGS_FOLDER + "/"
                )
            ) {
                continue;
            }

            const fm = await readFm(file);
            const linked = resolveLink(
                fm["Фильм"],
                file.path
            );

            if (
                linked?.path ===
                mediaFile.path
            ) {
                result.push(file);
            }
        }

        return result;
    }

    async function getSeasonFiles(mediaFile) {
        const result = [];

        for (
            const file of
            app.vault.getMarkdownFiles()
        ) {
            if (
                !file.path.startsWith(
                    SEASONS_FOLDER + "/"
                )
            ) {
                continue;
            }

            const fm = await readFm(file);
            const linked = resolveLink(
                fm["Сериал"],
                file.path
            );

            if (
                linked?.path ===
                mediaFile.path
            ) {
                result.push(file);
            }
        }

        return result;
    }

    async function readLegacyViewingBody(file) {
        const raw = await app.vault.read(file);
        const parts = splitFrontmatter(raw);

        let body = parts.body.trim();

        body = body.replace(
            /^#{1,6}\s*просмотр\s*\d+(?:\s*\([^)]*\))?\s*\r?\n+/i,
            ""
        );

        body = body.replace(
            /\n?\s*---\s*\r?\n\s*\[\[[^\]\n]+\|←[^\]\n]+\]\]\s*$/i,
            ""
        );

        return body.trim();
    }

    async function migrateViewingFile(file) {
        const before = await readFm(file);

        const yamlComment =
            String(
                before["Комментарий"] ?? ""
            ).trim();

        const bodyComment =
            await readLegacyViewingBody(file);

        const finalComment =
            yamlComment || bodyComment;

        await app.fileManager
            .processFrontMatter(
                file,
                fm => {
                    const date =
                        normalizeDate(
                            fm["Дата"]
                        );

                    if (date) {
                        fm["Дата"] = date;
                        fm["Год"] =
                            Number(
                                date.slice(0, 4)
                            );
                    }

                    const number =
                        toNumber(
                            fm["Просмотр"]
                        );

                    if (number !== null) {
                        fm["Просмотр"] =
                            Math.trunc(number);
                    }

                    const rating =
                        toNumber(
                            fm["Оценка"]
                        );

                    if (rating !== null) {
                        fm["Оценка"] =
                            rating;
                    }

                    fm["Комментарий"] =
                        finalComment;

                    const tags =
                        getTags(fm);

                    if (
                        !tags.includes(
                            "viewing"
                        )
                    ) {
                        tags.push(
                            "viewing"
                        );
                    }

                    fm.tags = tags;
                }
            );

        const updated =
            await app.vault.read(file);

        const parts =
            splitFrontmatter(updated);

        if (parts.frontmatterText) {
            await app.vault.modify(
                file,
                parts.frontmatterText + "\n"
            );
        }
    }

    async function getViewingRows(
        mediaFile,
        migrate = true
    ) {
        const files =
            await getViewingFiles(
                mediaFile
            );

        const rows = [];

        for (const file of files) {
            if (migrate) {
                await migrateViewingFile(
                    file
                );
            }

            const fm =
                await readFm(file);

            const number =
                toNumber(
                    fm["Просмотр"]
                );

            if (number === null) {
                continue;
            }

            rows.push({
                file,
                number:
                    Math.trunc(number),
                date:
                    normalizeDate(
                        fm["Дата"]
                    ),
                rating:
                    toNumber(
                        fm["Оценка"]
                    ),
                comment:
                    String(
                        fm["Комментарий"] ??
                        ""
                    ).trim()
            });
        }

        rows.sort((a, b) => {
            if (
                a.number !== b.number
            ) {
                return (
                    a.number -
                    b.number
                );
            }

            return (
                (a.date ?? "")
                    .localeCompare(
                        b.date ?? ""
                    )
            );
        });

        return rows;
    }

    async function getSeasonRows(
        mediaFile
    ) {
        const files =
            await getSeasonFiles(
                mediaFile
            );

        const rows = [];

        for (const file of files) {
            const fm =
                await readFm(file);

            const season =
                toNumber(
                    fm["Сезон"]
                );

            if (season === null) {
                continue;
            }

            let comment =
                String(
                    fm["Комментарий"] ??
                    ""
                ).trim();

            if (!comment) {
                const raw =
                    await app.vault.read(
                        file
                    );

                const parts =
                    splitFrontmatter(raw);

                comment =
                    parts.body.trim();
            }

            rows.push({
                file,
                season:
                    Math.trunc(season),
                date:
                    normalizeDate(
                        fm["Дата"]
                    ),
                rating:
                    toNumber(
                        fm["Оценка"]
                    ),
                comment
            });
        }

        rows.sort(
            (a, b) =>
                a.season -
                b.season
        );

        return rows;
    }

    async function rebuildViewingDeltas(
        mediaFile
    ) {
        const rows =
            await getViewingRows(
                mediaFile,
                true
            );

        for (const row of rows) {
            await app.fileManager
                .processFrontMatter(
                    row.file,
                    fm => {
                        fm[
                            "Последний просмотр"
                        ] = false;

                        delete fm[
                            "Предыдущая оценка"
                        ];

                        delete fm[
                            "Изменение оценки"
                        ];
                    }
                );
        }

        if (rows.length === 0) {
            return;
        }

        const latest =
            rows[
                rows.length - 1
            ];

        const previous =
            rows.length >= 2
                ? rows[
                    rows.length - 2
                ]
                : null;

        await app.fileManager
            .processFrontMatter(
                latest.file,
                fm => {
                    fm[
                        "Последний просмотр"
                    ] = true;

                    if (
                        previous &&
                        previous.rating !== null &&
                        latest.rating !== null
                    ) {
                        fm[
                            "Предыдущая оценка"
                        ] =
                            previous.rating;

                        fm[
                            "Изменение оценки"
                        ] =
                            Number(
                                (
                                    latest.rating -
                                    previous.rating
                                ).toFixed(2)
                            );
                    }
                }
            );
    }

    async function updateMediaSummary(
        mediaFile
    ) {
        const viewings =
            await getViewingRows(
                mediaFile,
                false
            );

        const seasons =
            await getSeasonRows(
                mediaFile
            );

        if (
            viewings.length === 0 &&
            seasons.length === 0
        ) {
            return;
        }

        const dates = [
            ...viewings
                .map(r => r.date),
            ...seasons
                .map(r => r.date)
        ]
            .filter(Boolean)
            .sort();

        const latestViewing =
            viewings.length > 0
                ? viewings[
                    viewings.length - 1
                ]
                : null;

        await app.fileManager
            .processFrontMatter(
                mediaFile,
                fm => {
                    if (
                        dates.length > 0
                    ) {
                        fm["Просмотрено"] =
                            dates[
                                dates.length - 1
                            ];
                    }

                    if (
                        viewings.length > 0
                    ) {
                        fm[
                            "Количество просмотров"
                        ] =
                            Math.max(
                                viewings.length,
                                ...viewings.map(
                                    r => r.number
                                )
                            );

                        if (
                            latestViewing
                                .rating !== null
                        ) {
                            fm["Оценка"] =
                                latestViewing
                                    .rating;
                        }
                    }

                    if (
                        seasons.length > 0
                    ) {
                        fm[
                            "Количество сезонов"
                        ] =
                            seasons.length;

                        fm[
                            "Последний сезон"
                        ] =
                            Math.max(
                                ...seasons.map(
                                    r => r.season
                                )
                            );
                    }

                    const imdb =
                        toNumber(
                            fm[
                                "Оценка Imdb"
                            ]
                        );

                    if (imdb !== null) {
                        fm[
                            "Оценка Imdb"
                        ] = imdb;
                    }

                    const tags =
                        getTags(fm);

                    if (
                        tags.length > 0
                    ) {
                        fm.tags = tags;
                    }
                }
            );
    }

    async function rebuildOriginalNative(
        mediaFile
    ) {
        const viewings =
            await getViewingRows(
                mediaFile,
                false
            );

        const seasons =
            await getSeasonRows(
                mediaFile
            );

        const raw =
            await app.vault.read(
                mediaFile
            );

        const parts =
            splitFrontmatter(raw);
        const persistent = extractPersistentCardBlocks(parts.body);

        if (!parts.frontmatterText) {
            throw new Error(
                "В оригинальном файле нет YAML frontmatter."
            );
        }

        const fm =
            await readFm(
                mediaFile
            );

        const poster =
            String(
                fm.poster ?? ""
            ).trim();

        const chunks = [];

        if (seasons.length > 0) {
            chunks.push(
                SEASONS_START
            );

            for (
                const row of
                seasons
            ) {
                const rating =
                    row.rating !== null
                        ? `${row.rating}/10`
                        : "без оценки";

                chunks.push(
                    `# Сезон ${row.season} (${rating})`
                );

                if (row.comment) {
                    chunks.push(
                        row.comment
                    );
                }
            }

            chunks.push(
                SEASONS_END
            );
        }

        if (viewings.length > 0) {
            chunks.push(
                VIEWINGS_START
            );

            for (
                const row of
                viewings
            ) {
                const rating =
                    row.rating !== null
                        ? `${row.rating}/10`
                        : "без оценки";

                chunks.push(
                    `# Просмотр ${row.number} (${rating})`
                );

                if (row.date) {
                    chunks.push(
                        `*${displayDate(row.date)}*`
                    );
                }

                if (row.comment) {
                    chunks.push(
                        row.comment
                    );
                }
            }

            chunks.push(
                VIEWINGS_END
            );
        }

        let result =
            parts.frontmatterText;

        if (chunks.length > 0) {
            result +=
                "\n\n" +
                chunks.join("\n\n") +
                "\n";
        } else {
            result += "\n";
        }

        if (persistent) {
            result += "\n" + persistent + "\n";
        }

        if (poster) {
            result +=
                "\n---\n" +
                `![](${poster})\n`;
        }

        await app.vault.modify(
            mediaFile,
            result
        );
    }


    function removeGeneratedBlocks(body) {
        let result = String(body ?? "");

        result = result.replace(/<!-- KINO:ROLES:EMBED:V2 -->[\s\S]*?<\/details>/gi, "");
        result = result.replace(/<!-- KINO:RECOMMEND:BUTTON:V2 -->\s*```dataviewjs[\s\S]*?```/gi, "");

        result = result.replace(
            /<!-- VIEWINGS:START -->[\s\S]*?<!-- VIEWINGS:END -->/gi,
            ""
        );

        result = result.replace(
            /<!-- SEASONS:START -->[\s\S]*?<!-- SEASONS:END -->/gi,
            ""
        );

        result = result.replace(
            /```dataviewjs[\s\S]*?```/gi,
            ""
        );

        result = result.replace(
            /```dataview[\s\S]*?```/gi,
            ""
        );

        return result;
    }

    function extractLegacyReview(body, poster) {
        let result =
            removeGeneratedBlocks(body);

        if (poster) {
            const escaped =
                String(poster)
                    .replace(
                        /[.*+?^${}()|[\]\\]/g,
                        "\\$&"
                    );

            result = result.replace(
                new RegExp(
                    "^\\s*!\\[[^\\]]*\\]\\(" +
                    escaped +
                    "\\)\\s*$",
                    "gim"
                ),
                ""
            );
        }

        result = result.replace(
            /^\s*!\[[^\]]*\]\([^\n]*\)\s*$/gim,
            ""
        );

        result = result.replace(
            /^\s*(---|\*\*\*|___)\s*$/gm,
            ""
        );

        result = result.replace(
            /^\s*\^[A-Za-z0-9_-]+\s*$/gm,
            ""
        );

        return result.trim();
    }

    function viewingPath(
        mediaFile,
        number,
        date
    ) {
        return normalizePath(
            `${VIEWINGS_FOLDER}/` +
            `${safeName(mediaFile.basename)}` +
            ` - v${number}.md`
        );
    }

    function buildViewingContent({
        mediaFile,
        number,
        date,
        rating,
        comment
    }) {
        let content = "---\n";
        content +=
            `Фильм: ${yamlString(makeMediaLink(mediaFile))}\n`;
        content += `Дата: ${date}\n`;
        content +=
            `Год: ${Number(date.slice(0, 4))}\n`;
        content +=
            `Просмотр: ${number}\n`;

        if (rating !== null) {
            content +=
                `Оценка: ${rating}\n`;
        } else {
            content += "Оценка:\n";
        }

        content += "Последний просмотр: false\n";
        content += "tags:\n";
        content += "  - viewing\n";
        content += yamlMultiline(comment);
        content += "---\n";

        return content;
    }

    async function createViewingFile(args) {
        let path = viewingPath(
            args.mediaFile,
            args.number,
            args.date
        );

        if (
            app.vault
                .getAbstractFileByPath(path)
        ) {
            let suffix = 2;

            while (
                app.vault
                    .getAbstractFileByPath(
                        path.replace(
                            /\.md$/i,
                            ` (${suffix}).md`
                        )
                    )
            ) {
                suffix++;
            }

            path = path.replace(
                /\.md$/i,
                ` (${suffix}).md`
            );
        }

        return await app.vault.create(
            path,
            buildViewingContent(args)
        );
    }

    let mediaFile =
        app.workspace.getActiveFile();

    if (!isMedia(mediaFile)) {
        const media =
            app.vault
                .getMarkdownFiles()
                .filter(isMedia)
                .sort(
                    (a, b) =>
                        a.basename
                            .localeCompare(
                                b.basename,
                                "ru"
                            )
                );

        if (media.length === 0) {
            new Notice(
                "В папке Кино не найдено фильмов/сериалов."
            );
            return;
        }

        mediaFile =
            await quickAddApi.suggester(
                media.map(file => {
                    const tags =
                        getTags(
                            getCachedFm(file)
                        );

                    const icon =
                        tags.includes("serial")
                            ? "📺"
                            : "🎬";

                    const title =
                        getCachedFm(file)[
                            "Название"
                        ];

                    return title
                        ? `${icon} ${file.basename} | ${title}`
                        : `${icon} ${file.basename}`;
                }),
                media,
                "Выбери фильм или сериал"
            );

        if (!mediaFile) return;
    }

    const originalFm =
        await readFm(mediaFile);

    const originalRaw =
        await app.vault.read(
            mediaFile
        );

    const originalParts =
        splitFrontmatter(
            originalRaw
        );

    const oldDate =
        normalizeDate(
            originalFm[
                "Просмотрено"
            ]
        );

    const oldRating =
        toNumber(
            originalFm[
                "Оценка"
            ]
        );

    const poster =
        String(
            originalFm.poster ?? ""
        ).trim();

    let viewingFiles =
        await getViewingFiles(
            mediaFile
        );

    for (const file of viewingFiles) {
        await migrateViewingFile(
            file
        );
    }

    viewingFiles =
        await getViewingFiles(
            mediaFile
        );

    let migrated = false;

    // Если просмотров еще нет, старый отзыв оригинального
    // фильма превращаем в просмотр #1.
    // Для сериала, который уже ведется через Кино/Сезоны,
    // сезонный текст НЕ считаем отзывом полного просмотра.
    if (viewingFiles.length === 0) {
        const seasonFiles =
            await getSeasonFiles(
                mediaFile
            );

        const mayMigrateLegacy =
            seasonFiles.length === 0 &&
            oldDate !== null;

        if (mayMigrateLegacy) {
            const legacyReview =
                extractLegacyReview(
                    originalParts.body,
                    poster
                );

            await createViewingFile({
                mediaFile,
                number: 1,
                date: oldDate,
                rating: oldRating,
                comment: legacyReview
            });

            migrated = true;
        }
    }

    let rows =
        await getViewingRows(
            mediaFile,
            true
        );

    const nextNumber =
        rows.length > 0
            ? Math.max(
                ...rows.map(
                    r => r.number
                )
            ) + 1
            : 1;

    const values =
        await quickAddApi.requestInputs([
            {
                id: "date",
                label: "Дата нового просмотра",
                type: "date",
                dateFormat: "YYYY-MM-DD",
                defaultValue:
                    quickAddApi.date.now(
                        "YYYY-MM-DD"
                    )
            },
            {
                id: "rating",
                label: "Новая оценка",
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
                label: "Новый отзыв",
                type: "textarea",
                optional: true,
                placeholder:
                    "Мысль после просмотра..."
            }
        ]);

    if (!values) return;

    const newDate =
        normalizeDate(
            values.date
        );

    if (!newDate) {
        new Notice(
            "Некорректная дата."
        );
        return;
    }

    let newRating = null;

    if (
        String(
            values.rating ?? ""
        ).trim() !== ""
    ) {
        newRating =
            toNumber(
                values.rating
            );

        if (
            newRating === null ||
            newRating < 1 ||
            newRating > 10
        ) {
            new Notice(
                "Оценка должна быть от 1 до 10."
            );
            return;
        }
    }

    const newComment =
        String(
            values.comment ?? ""
        ).trim();

    const created =
        await createViewingFile({
            mediaFile,
            number: nextNumber,
            date: newDate,
            rating: newRating,
            comment: newComment
        });

    await migrateViewingFile(
        created
    );

    await rebuildViewingDeltas(
        mediaFile
    );

    await updateMediaSummary(
        mediaFile
    );

    await rebuildOriginalNative(
        mediaFile
    );

    new Notice(
        migrated
            ? `${mediaFile.basename}: старый отзыв перенесен в просмотр #1; добавлен просмотр #${nextNumber}.`
            : `${mediaFile.basename}: добавлен просмотр #${nextNumber}.`
    );

    await app.workspace
        .getLeaf(false)
        .openFile(created);
};
