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

    function isViewing(file) {
        return (
            file &&
            file.extension === "md" &&
            file.path.startsWith(
                VIEWINGS_FOLDER + "/"
            )
        );
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


    function viewingPath(
        mediaFile,
        number,
        date
    ) {
        return normalizePath(
            `${VIEWINGS_FOLDER}/` +
            `${safeName(mediaFile.basename)}` +
            ` - просмотр ${number}` +
            ` - ${date}.md`
        );
    }

    async function mediaForViewing(
        viewingFile
    ) {
        const fm =
            await readFm(
                viewingFile
            );

        return resolveLink(
            fm["Фильм"],
            viewingFile.path
        );
    }

    async function chooseViewing() {
        const active =
            app.workspace
                .getActiveFile();

        if (isViewing(active)) {
            return active;
        }

        if (isMedia(active)) {
            const rows =
                await getViewingRows(
                    active,
                    true
                );

            if (rows.length === 0) {
                new Notice(
                    "У этой карточки нет просмотров."
                );
                return null;
            }

            return await quickAddApi
                .suggester(
                    rows.map(row =>
                        `Просмотр #${row.number}` +
                        (row.date
                            ? ` | ${displayDate(row.date)}`
                            : "") +
                        (row.rating !== null
                            ? ` | ${row.rating}/10`
                            : "")
                    ),
                    rows.map(
                        row => row.file
                    ),
                    `Редактировать: ${active.basename}`
                );
        }

        const choices = [];

        for (
            const file of
            app.vault.getMarkdownFiles()
        ) {
            if (!isViewing(file)) {
                continue;
            }

            const fm =
                await readFm(file);

            const media =
                resolveLink(
                    fm["Фильм"],
                    file.path
                );

            choices.push({
                file,
                mediaName:
                    media?.basename ??
                    "?",
                number:
                    Math.trunc(
                        toNumber(
                            fm["Просмотр"]
                        ) ?? 0
                    ),
                date:
                    normalizeDate(
                        fm["Дата"]
                    ),
                rating:
                    toNumber(
                        fm["Оценка"]
                    )
            });
        }

        choices.sort(
            (a, b) => {
                const byMedia =
                    a.mediaName
                        .localeCompare(
                            b.mediaName,
                            "ru"
                        );

                return byMedia !== 0
                    ? byMedia
                    : a.number -
                        b.number;
            }
        );

        if (choices.length === 0) {
            new Notice(
                "В Кино/Просмотры нет записей."
            );
            return null;
        }

        return await quickAddApi
            .suggester(
                choices.map(row =>
                    `🎬 ${row.mediaName} | ` +
                    `Просмотр #${row.number}` +
                    (row.date
                        ? ` | ${displayDate(row.date)}`
                        : "") +
                    (row.rating !== null
                        ? ` | ${row.rating}/10`
                        : "")
                ),
                choices.map(
                    row => row.file
                ),
                "Выбери просмотр"
            );
    }

    let viewingFile =
        await chooseViewing();

    if (!viewingFile) return;

    await migrateViewingFile(
        viewingFile
    );

    const mediaFile =
        await mediaForViewing(
            viewingFile
        );

    if (
        !mediaFile ||
        !isMedia(mediaFile)
    ) {
        new Notice(
            "Не удалось найти оригинальную карточку."
        );
        return;
    }

    const current =
        await readFm(
            viewingFile
        );

    const oldNumber =
        Math.trunc(
            toNumber(
                current[
                    "Просмотр"
                ]
            ) ?? 0
        );

    const oldDate =
        normalizeDate(
            current["Дата"]
        );

    const oldRating =
        toNumber(
            current["Оценка"]
        );

    const oldComment =
        String(
            current[
                "Комментарий"
            ] ?? ""
        );

    const values =
        await quickAddApi.requestInputs([
            {
                id: "number",
                label: "Номер просмотра",
                type: "number",
                defaultValue:
                    String(oldNumber),
                numericConfig: {
                    min: 1,
                    step: 1
                }
            },
            {
                id: "date",
                label: "Дата просмотра",
                type: "date",
                dateFormat: "YYYY-MM-DD",
                defaultValue:
                    oldDate ??
                    quickAddApi.date.now(
                        "YYYY-MM-DD"
                    )
            },
            {
                id: "rating",
                label: "Оценка",
                type: "number",
                optional: true,
                defaultValue:
                    oldRating !== null
                        ? String(
                            oldRating
                        )
                        : "",
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
                defaultValue:
                    oldComment
            }
        ]);

    if (!values) return;

    const newNumber =
        Number(
            values.number
        );

    const newDate =
        normalizeDate(
            values.date
        );

    if (
        !Number.isInteger(
            newNumber
        ) ||
        newNumber < 1
    ) {
        new Notice(
            "Номер просмотра должен быть целым числом > 0."
        );
        return;
    }

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

    const siblings =
        await getViewingFiles(
            mediaFile
        );

    for (const file of siblings) {
        if (
            file.path ===
            viewingFile.path
        ) {
            continue;
        }

        const fm =
            await readFm(file);

        if (
            Math.trunc(
                toNumber(
                    fm["Просмотр"]
                ) ?? -1
            ) === newNumber
        ) {
            new Notice(
                `Просмотр #${newNumber} уже существует.`
            );
            return;
        }
    }

    const newPath =
        viewingPath(
            mediaFile,
            newNumber,
            newDate
        );

    if (
        newPath !== viewingFile.path &&
        app.vault
            .getAbstractFileByPath(
                newPath
            )
    ) {
        new Notice(
            `Файл уже существует: ${newPath}`
        );
        return;
    }

    await app.fileManager
        .processFrontMatter(
            viewingFile,
            fm => {
                fm["Просмотр"] =
                    newNumber;
                fm["Дата"] =
                    newDate;
                fm["Год"] =
                    Number(
                        newDate.slice(
                            0,
                            4
                        )
                    );

                if (
                    newRating !== null
                ) {
                    fm["Оценка"] =
                        newRating;
                } else {
                    fm["Оценка"] =
                        null;
                }

                fm["Комментарий"] =
                    String(
                        values.comment ??
                        ""
                    ).trim();

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

    if (
        newPath !==
        viewingFile.path
    ) {
        await app.fileManager
            .renameFile(
                viewingFile,
                newPath
            );

        viewingFile =
            app.vault
                .getAbstractFileByPath(
                    newPath
                ) ??
            viewingFile;
    }

    await migrateViewingFile(
        viewingFile
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
        `${mediaFile.basename}: ` +
        `просмотр #${oldNumber}` +
        (
            oldNumber !== newNumber
                ? ` → #${newNumber}`
                : ""
        ) +
        " обновлен."
    );

    await app.workspace
        .getLeaf(false)
        .openFile(viewingFile);
};
