module.exports = async (params) => {
    const { app, quickAddApi, obsidian } = params;
    const { Notice, normalizePath, parseYaml } = obsidian;

    const MEDIA_FOLDER = "Кино";
    const SEASONS_FOLDER = "Кино/Сезоны";
    const START = "<!-- SEASONS:START -->";
    const END = "<!-- SEASONS:END -->";

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

    function isSerial(file) {
        if (!file || file.extension !== "md") return false;
        if (!file.path.startsWith(MEDIA_FOLDER + "/")) return false;
        if (file.path.startsWith(SEASONS_FOLDER + "/")) return false;
        return getTags(getCachedFm(file)).includes("serial");
    }

    function isSeasonFile(file) {
        return (
            file &&
            file.extension === "md" &&
            file.path.startsWith(SEASONS_FOLDER + "/")
        );
    }

    function toNumber(value) {
        if (
            value === null ||
            value === undefined ||
            String(value).trim() === ""
        ) return null;

        const n = Number(String(value).trim().replace(",", "."));
        return Number.isFinite(n) ? n : null;
    }

    function normalizeDate(value) {
        if (!value) return null;

        if (value instanceof Date && !Number.isNaN(value.getTime())) {
            const y = value.getFullYear();
            const m = String(value.getMonth() + 1).padStart(2, "0");
            const d = String(value.getDate()).padStart(2, "0");
            return `${y}-${m}-${d}`;
        }

        const text = String(value).trim().replace(/^@date:/, "");

        let m = text.match(/^(\d{4})$/);
        if (m) return `${m[1]}-01-01`;

        m = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
        if (!m) return null;

        const y = Number(m[1]);
        const mo = Number(m[2]);
        const d = Number(m[3]);
        const test = new Date(Date.UTC(y, mo - 1, d));

        if (
            test.getUTCFullYear() !== y ||
            test.getUTCMonth() !== mo - 1 ||
            test.getUTCDate() !== d
        ) return null;

        return (
            String(y).padStart(4, "0") + "-" +
            String(mo).padStart(2, "0") + "-" +
            String(d).padStart(2, "0")
        );
    }

    function splitFrontmatter(text) {
        const lines = String(text ?? "").split(/\r?\n/);
        if (lines[0]?.trim() !== "---") {
            return { frontmatterText: "", body: text };
        }

        let end = -1;
        for (let i = 1; i < lines.length; i++) {
            if (lines[i].trim() === "---") {
                end = i;
                break;
            }
        }

        if (end === -1) {
            return { frontmatterText: "", body: text };
        }

        return {
            frontmatterText: lines.slice(0, end + 1).join("\n"),
            body: lines.slice(end + 1).join("\n")
        };
    }

    async function readFm(file) {
        const raw = await app.vault.read(file);
        const parts = splitFrontmatter(raw);
        if (!parts.frontmatterText) return {};

        const yaml = parts.frontmatterText
            .replace(/^---\s*\r?\n/, "")
            .replace(/\r?\n---\s*$/, "");

        return parseYaml(yaml) ?? {};
    }

    function linkTarget(value) {
        if (!value) return "";
        if (typeof value === "object" && value.path) {
            return String(value.path).replace(/\.md$/i, "");
        }

        let s = String(value).trim();
        if (s.startsWith("[[") && s.endsWith("]]")) {
            s = s.slice(2, -2);
        }
        return s.split("|")[0].trim().replace(/\.md$/i, "");
    }

    function resolveLink(value, sourcePath) {
        const target = linkTarget(value);
        if (!target) return null;

        const direct =
            app.vault.getAbstractFileByPath(target + ".md") ??
            app.vault.getAbstractFileByPath(target);

        if (direct?.extension === "md") return direct;

        return app.metadataCache.getFirstLinkpathDest(
            target,
            sourcePath
        );
    }

    async function getSerialForSeason(file) {
        const fm = await readFm(file);
        return resolveLink(fm["Сериал"], file.path);
    }

    async function seasonBelongsTo(file, serialFile) {
        const fm = await readFm(file);
        const serial = resolveLink(fm["Сериал"], file.path);
        return serial?.path === serialFile.path;
    }

    async function getSeasonFiles(serialFile) {
        const all = app.vault
            .getMarkdownFiles()
            .filter(isSeasonFile);

        const result = [];
        for (const file of all) {
            if (await seasonBelongsTo(file, serialFile)) {
                result.push(file);
            }
        }
        return result;
    }

    function safeName(name) {
        return String(name).replace(/[\\/:*?"<>|]/g, "-").trim();
    }

    function seasonPath(serialFile, season) {
        return normalizePath(
            `${SEASONS_FOLDER}/${safeName(serialFile.basename)}` +
            ` - s${String(season).padStart(2, "0")}.md`
        );
    }

    async function rebuildDeltas(serialFile) {
        const files = await getSeasonFiles(serialFile);
        const rows = [];

        for (const file of files) {
            const fm = await readFm(file);
            const season = toNumber(fm["Сезон"]);
            if (season === null) continue;

            rows.push({
                file,
                season: Math.trunc(season),
                rating: toNumber(fm["Оценка"])
            });
        }

        rows.sort((a, b) => a.season - b.season);

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const previous = i > 0 ? rows[i - 1] : null;

            await app.fileManager.processFrontMatter(
                row.file,
                fm => {
                    delete fm["Предыдущая оценка"];
                    delete fm["Изменение оценки"];

                    if (
                        previous &&
                        previous.rating !== null &&
                        row.rating !== null
                    ) {
                        fm["Предыдущая оценка"] = previous.rating;
                        fm["Изменение оценки"] =
                            Math.round(
                                (row.rating - previous.rating) * 10
                            ) / 10;
                    }
                }
            );
        }
    }

    async function rebuildOriginal(serialFile) {
        const files = await getSeasonFiles(serialFile);
        const rows = [];

        for (const file of files) {
            const fm = await readFm(file);
            const season = toNumber(fm["Сезон"]);
            if (season === null) continue;

            rows.push({
                file,
                season: Math.trunc(season),
                date: normalizeDate(fm["Дата"]),
                rating: toNumber(fm["Оценка"]),
                comment: String(fm["Комментарий"] ?? "").trim()
            });
        }

        rows.sort((a, b) => a.season - b.season);

        const validDates = rows
            .map(r => r.date)
            .filter(Boolean)
            .sort();

        const latestDate =
            validDates.length > 0
                ? validDates[validDates.length - 1]
                : null;

        const maxSeason =
            rows.length > 0
                ? Math.max(...rows.map(r => r.season))
                : 0;

        await app.fileManager.processFrontMatter(
            serialFile,
            fm => {
                fm["Количество сезонов"] = rows.length;
                fm["Последний сезон"] = maxSeason;

                if (latestDate) {
                    fm["Просмотрено"] = latestDate;
                }
            }
        );

        const freshOriginal = await app.vault.read(serialFile);
        const parts = splitFrontmatter(freshOriginal);

        if (!parts.frontmatterText) {
            throw new Error("В оригинальном сериале нет YAML.");
        }

        const originalFm = await readFm(serialFile);
        const poster = String(originalFm.poster ?? "").trim();

        const body = [];
        body.push(START);

        for (const row of rows) {
            const rating =
                row.rating !== null
                    ? `${row.rating}/10`
                    : "без оценки";

            body.push(`# Сезон ${row.season} (${rating})`);

            if (row.comment) {
                body.push(row.comment);
            }
        }

        body.push(END);

        let result =
            parts.frontmatterText +
            "\n\n" +
            body.join("\n\n") +
            "\n";

        if (poster) {
            result += `\n---\n![](${poster})\n`;
        }

        await app.vault.modify(serialFile, result);
    }

    async function chooseSeasonFile() {
        const active = app.workspace.getActiveFile();

        if (isSeasonFile(active)) {
            return active;
        }

        if (isSerial(active)) {
            const files = await getSeasonFiles(active);

            if (files.length === 0) {
                new Notice("У этого сериала пока нет файлов сезонов.");
                return null;
            }

            const rows = [];
            for (const file of files) {
                const fm = await readFm(file);
                rows.push({
                    file,
                    season: toNumber(fm["Сезон"]) ?? 0,
                    rating: toNumber(fm["Оценка"])
                });
            }

            rows.sort((a, b) => a.season - b.season);

            return await quickAddApi.suggester(
                rows.map(r =>
                    `Сезон ${r.season}` +
                    (r.rating !== null ? ` | ${r.rating}/10` : "")
                ),
                rows.map(r => r.file),
                `Редактировать: ${active.basename}`
            );
        }

        const all = app.vault
            .getMarkdownFiles()
            .filter(isSeasonFile);

        const rows = [];

        for (const file of all) {
            const fm = await readFm(file);
            const serial = resolveLink(fm["Сериал"], file.path);
            const season = toNumber(fm["Сезон"]) ?? 0;
            const rating = toNumber(fm["Оценка"]);

            rows.push({
                file,
                serialName: serial?.basename ?? "?",
                season,
                rating
            });
        }

        rows.sort((a, b) => {
            const x = a.serialName.localeCompare(b.serialName, "ru");
            return x !== 0 ? x : a.season - b.season;
        });

        if (rows.length === 0) {
            new Notice("В Кино/Сезоны нет записей.");
            return null;
        }

        return await quickAddApi.suggester(
            rows.map(r =>
                `📺 ${r.serialName} | Сезон ${r.season}` +
                (r.rating !== null ? ` | ${r.rating}/10` : "")
            ),
            rows.map(r => r.file),
            "Выбери сезон для редактирования"
        );
    }

    let seasonFile = await chooseSeasonFile();
    if (!seasonFile) return;

    const serialFile = await getSerialForSeason(seasonFile);

    if (!serialFile || !isSerial(serialFile)) {
        new Notice("Не удалось найти оригинальный файл сериала.");
        return;
    }

    const current = await readFm(seasonFile);

    const oldSeason = Math.trunc(toNumber(current["Сезон"]) ?? 0);
    const oldDate = normalizeDate(current["Дата"]);
    const oldRating = toNumber(current["Оценка"]);
    const oldComment = String(current["Комментарий"] ?? "");

    const values = await quickAddApi.requestInputs([
        {
            id: "season",
            label: "Сезон",
            type: "number",
            defaultValue: String(oldSeason),
            numericConfig: { min: 1, step: 1 }
        },
        {
            id: "date",
            label: "Дата окончания сезона",
            type: "date",
            dateFormat: "YYYY-MM-DD",
            defaultValue:
                oldDate ??
                quickAddApi.date.now("YYYY-MM-DD")
        },
        {
            id: "rating",
            label: "Оценка сезона",
            type: "number",
            optional: true,
            defaultValue:
                oldRating !== null ? String(oldRating) : "",
            numericConfig: { min: 1, max: 10, step: 1 }
        },
        {
            id: "comment",
            label: "Комментарий",
            type: "textarea",
            optional: true,
            defaultValue: oldComment
        }
    ]);

    if (!values) return;

    const newSeason = Number(values.season);
    const newDate = normalizeDate(values.date);

    if (!Number.isInteger(newSeason) || newSeason < 1) {
        new Notice("Номер сезона должен быть целым числом > 0.");
        return;
    }

    if (!newDate) {
        new Notice("Некорректная дата.");
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
            new Notice("Оценка должна быть от 1 до 10.");
            return;
        }
    }

    const siblings = await getSeasonFiles(serialFile);

    for (const file of siblings) {
        if (file.path === seasonFile.path) continue;

        const fm = await readFm(file);
        if (Math.trunc(toNumber(fm["Сезон"]) ?? -1) === newSeason) {
            new Notice(`Сезон ${newSeason} уже существует.`);
            return;
        }
    }

    const newPath = seasonPath(serialFile, newSeason);

    if (
        newPath !== seasonFile.path &&
        app.vault.getAbstractFileByPath(newPath)
    ) {
        new Notice(`Файл уже существует: ${newPath}`);
        return;
    }

    await app.fileManager.processFrontMatter(
        seasonFile,
        fm => {
            fm["Сезон"] = newSeason;
            fm["Дата"] = newDate;

            if (newRating !== null) {
                fm["Оценка"] = newRating;
            } else {
                fm["Оценка"] = null;
            }

            fm["Комментарий"] =
                String(values.comment ?? "").trim();

            const tags = getTags(fm);
            if (!tags.includes("season")) tags.push("season");
            fm.tags = tags;
        }
    );

    if (newPath !== seasonFile.path) {
        await app.fileManager.renameFile(seasonFile, newPath);
        seasonFile =
            app.vault.getAbstractFileByPath(newPath) ?? seasonFile;
    }

    // Архитектура сезонов YAML-only: тело очищаем.
    const updated = await app.vault.read(seasonFile);
    const updatedParts = splitFrontmatter(updated);

    await app.vault.modify(
        seasonFile,
        updatedParts.frontmatterText + "\n"
    );

    await rebuildDeltas(serialFile);
    await rebuildOriginal(serialFile);

    new Notice(
        `${serialFile.basename}: сезон ${oldSeason}` +
        (oldSeason !== newSeason ? ` → ${newSeason}` : "") +
        " обновлен."
    );

    await app.workspace.getLeaf(false).openFile(seasonFile);
};
