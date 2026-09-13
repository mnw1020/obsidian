module.exports = async (params) => {
    const { app, quickAddApi, obsidian } = params;
    const { Notice, normalizePath, parseYaml } = obsidian;

    const MEDIA_FOLDER = "Кино";
    const VIEWINGS_FOLDER = "Кино/Просмотры";
    const SEASONS_FOLDER = "Кино/Сезоны";

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

    function cachedFm(file) {
        return app.metadataCache.getFileCache(file)?.frontmatter ?? {};
    }

    function getTags(fm) {
        const raw = fm?.tags;
        if (!raw) return [];
        return (Array.isArray(raw) ? raw : [raw])
            .map(v => String(v).trim().replace(/^#/, ""))
            .filter(Boolean);
    }

    function isMedia(file) {
        if (!file || file.extension !== "md") return false;
        if (!file.path.startsWith(MEDIA_FOLDER + "/")) return false;
        if (file.path.startsWith(VIEWINGS_FOLDER + "/")) return false;
        if (file.path.startsWith(SEASONS_FOLDER + "/")) return false;

        const tags = getTags(cachedFm(file));
        return tags.includes("movies") || tags.includes("serial");
    }

    function isViewing(file) {
        return (
            file &&
            file.extension === "md" &&
            file.path.startsWith(VIEWINGS_FOLDER + "/")
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

    async function mediaForViewing(file) {
        const fm = await readFm(file);
        return resolveLink(fm["Фильм"], file.path);
    }

    async function belongsTo(file, mediaFile) {
        const media = await mediaForViewing(file);
        return media?.path === mediaFile.path;
    }

    async function getViewingFiles(mediaFile) {
        const all = app.vault
            .getMarkdownFiles()
            .filter(isViewing);

        const result = [];
        for (const file of all) {
            if (await belongsTo(file, mediaFile)) {
                result.push(file);
            }
        }
        return result;
    }

    function safeName(name) {
        return String(name).replace(/[\\/:*?"<>|]/g, "-").trim();
    }

    function viewingPath(mediaFile, number, date) {
        return normalizePath(
            `${VIEWINGS_FOLDER}/${safeName(mediaFile.basename)}` +
            ` - просмотр ${number} - ${date}.md`
        );
    }

    async function getRows(mediaFile) {
        const files = await getViewingFiles(mediaFile);
        const rows = [];

        for (const file of files) {
            const fm = await readFm(file);
            rows.push({
                file,
                number: Math.trunc(toNumber(fm["Просмотр"]) ?? 0),
                date: normalizeDate(fm["Дата"]),
                rating: toNumber(fm["Оценка"]),
                comment: String(fm["Комментарий"] ?? "").trim()
            });
        }

        rows.sort((a, b) => {
            if (a.number !== b.number) return a.number - b.number;
            const x = (a.date ?? "").localeCompare(b.date ?? "");
            return x !== 0 ? x : a.file.path.localeCompare(b.file.path, "ru");
        });

        return rows;
    }

    async function rebuildViewingDeltas(mediaFile) {
        const rows = await getRows(mediaFile);

        for (const row of rows) {
            await app.fileManager.processFrontMatter(
                row.file,
                fm => {
                    fm["Последний просмотр"] = false;
                    delete fm["Предыдущая оценка"];
                    delete fm["Изменение оценки"];
                }
            );
        }

        if (rows.length === 0) return;

        const latest = rows[rows.length - 1];
        const previous =
            rows.length >= 2 ? rows[rows.length - 2] : null;

        await app.fileManager.processFrontMatter(
            latest.file,
            fm => {
                fm["Последний просмотр"] = true;

                if (
                    previous &&
                    previous.rating !== null &&
                    latest.rating !== null
                ) {
                    fm["Предыдущая оценка"] = previous.rating;
                    fm["Изменение оценки"] =
                        Math.round(
                            (latest.rating - previous.rating) * 10
                        ) / 10;
                }
            }
        );
    }

    async function hasSeasonFiles(mediaFile) {
        const all = app.vault
            .getMarkdownFiles()
            .filter(f => f.path.startsWith(SEASONS_FOLDER + "/"));

        for (const file of all) {
            const fm = await readFm(file);
            const serial = resolveLink(fm["Сериал"], file.path);
            if (serial?.path === mediaFile.path) return true;
        }

        return false;
    }

    async function rebuildMediaSummary(mediaFile) {
        const rows = await getRows(mediaFile);
        if (rows.length === 0) return;

        const latest = rows[rows.length - 1];
        const maxNumber = Math.max(
            rows.length,
            ...rows.map(r => r.number)
        );

        await app.fileManager.processFrontMatter(
            mediaFile,
            fm => {
                if (latest.date) {
                    fm["Просмотрено"] = latest.date;
                }

                fm["Количество просмотров"] = maxNumber;

                if (latest.rating !== null) {
                    fm["Оценка"] = latest.rating;
                }
            }
        );

        const tags = getTags(cachedFm(mediaFile));
        const isSerial = tags.includes("serial");

        // Если сериал уже ведется через Кино/Сезоны,
        // его нативное сезонное тело не заменяем Dataview-историей просмотров.
        if (isSerial && await hasSeasonFiles(mediaFile)) {
            return;
        }

        const raw = await app.vault.read(mediaFile);
        const parts = splitFrontmatter(raw);
        const fm = await readFm(mediaFile);
        const poster = String(fm.poster ?? "").trim();

        let result =
            parts.frontmatterText +
            "\n\n" +
            HISTORY_BLOCK +
            "\n";

        if (poster) {
            result += `\n![](${poster})\n`;
        }

        await app.vault.modify(mediaFile, result);
    }

    async function chooseViewing() {
        const active = app.workspace.getActiveFile();

        if (isViewing(active)) return active;

        if (isMedia(active)) {
            const rows = await getRows(active);

            if (rows.length === 0) {
                new Notice("У этой карточки нет записей просмотров.");
                return null;
            }

            return await quickAddApi.suggester(
                rows.map(r =>
                    `Просмотр #${r.number}` +
                    (r.date ? ` | ${r.date}` : "") +
                    (r.rating !== null ? ` | ${r.rating}/10` : "")
                ),
                rows.map(r => r.file),
                `Редактировать: ${active.basename}`
            );
        }

        const all = app.vault
            .getMarkdownFiles()
            .filter(isViewing);

        const rows = [];

        for (const file of all) {
            const fm = await readFm(file);
            const media = resolveLink(fm["Фильм"], file.path);

            rows.push({
                file,
                mediaName: media?.basename ?? "?",
                number: Math.trunc(toNumber(fm["Просмотр"]) ?? 0),
                date: normalizeDate(fm["Дата"]),
                rating: toNumber(fm["Оценка"])
            });
        }

        rows.sort((a, b) => {
            const x = a.mediaName.localeCompare(b.mediaName, "ru");
            return x !== 0 ? x : a.number - b.number;
        });

        if (rows.length === 0) {
            new Notice("В Кино/Просмотры нет записей.");
            return null;
        }

        return await quickAddApi.suggester(
            rows.map(r =>
                `🎬 ${r.mediaName} | #${r.number}` +
                (r.date ? ` | ${r.date}` : "") +
                (r.rating !== null ? ` | ${r.rating}/10` : "")
            ),
            rows.map(r => r.file),
            "Выбери просмотр для редактирования"
        );
    }

    let viewingFile = await chooseViewing();
    if (!viewingFile) return;

    const mediaFile = await mediaForViewing(viewingFile);

    if (!mediaFile || !isMedia(mediaFile)) {
        new Notice("Не удалось найти оригинальную карточку.");
        return;
    }

    const current = await readFm(viewingFile);
    const oldNumber = Math.trunc(toNumber(current["Просмотр"]) ?? 0);
    const oldDate = normalizeDate(current["Дата"]);
    const oldRating = toNumber(current["Оценка"]);
    const oldComment = String(current["Комментарий"] ?? "");

    const values = await quickAddApi.requestInputs([
        {
            id: "number",
            label: "Номер просмотра",
            type: "number",
            defaultValue: String(oldNumber),
            numericConfig: { min: 1, step: 1 }
        },
        {
            id: "date",
            label: "Дата просмотра",
            type: "date",
            dateFormat: "YYYY-MM-DD",
            defaultValue:
                oldDate ??
                quickAddApi.date.now("YYYY-MM-DD")
        },
        {
            id: "rating",
            label: "Оценка",
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

    const newNumber = Number(values.number);
    const newDate = normalizeDate(values.date);

    if (!Number.isInteger(newNumber) || newNumber < 1) {
        new Notice("Номер просмотра должен быть целым числом > 0.");
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

    const siblings = await getViewingFiles(mediaFile);

    for (const file of siblings) {
        if (file.path === viewingFile.path) continue;

        const fm = await readFm(file);
        const number = Math.trunc(toNumber(fm["Просмотр"]) ?? -1);

        if (number === newNumber) {
            new Notice(`Просмотр #${newNumber} уже существует.`);
            return;
        }
    }

    const newPath = viewingPath(
        mediaFile,
        newNumber,
        newDate
    );

    if (
        newPath !== viewingFile.path &&
        app.vault.getAbstractFileByPath(newPath)
    ) {
        new Notice(`Файл уже существует: ${newPath}`);
        return;
    }

    await app.fileManager.processFrontMatter(
        viewingFile,
        fm => {
            fm["Просмотр"] = newNumber;
            fm["Дата"] = newDate;
            fm["Год"] = Number(newDate.slice(0, 4));

            if (newRating !== null) {
                fm["Оценка"] = newRating;
            } else {
                fm["Оценка"] = null;
            }

            fm["Комментарий"] =
                String(values.comment ?? "").trim();

            const tags = getTags(fm);
            if (!tags.includes("viewing")) tags.push("viewing");
            fm.tags = tags;
        }
    );

    if (newPath !== viewingFile.path) {
        await app.fileManager.renameFile(viewingFile, newPath);
        viewingFile =
            app.vault.getAbstractFileByPath(newPath) ?? viewingFile;
    }

    await rebuildViewingDeltas(mediaFile);
    await rebuildMediaSummary(mediaFile);

    new Notice(
        `${mediaFile.basename}: просмотр #${oldNumber}` +
        (oldNumber !== newNumber ? ` → #${newNumber}` : "") +
        " обновлен."
    );

    await app.workspace.getLeaf(false).openFile(viewingFile);
};
