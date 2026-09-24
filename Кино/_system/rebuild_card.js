module.exports = async (params) => {
    const { app, quickAddApi, obsidian } = params;
    const { Notice, parseYaml } = obsidian;

    const MEDIA_FOLDER = "Кино";
    const SEASONS_FOLDER = "Кино/Сезоны";
    const VIEWINGS_FOLDER = "Кино/Просмотры";
    const START = "<!-- SEASONS:START -->";
    const END = "<!-- SEASONS:END -->";

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
        if (file.path.startsWith(SEASONS_FOLDER + "/")) return false;
        if (file.path.startsWith(VIEWINGS_FOLDER + "/")) return false;

        const tags = getTags(cachedFm(file));
        return tags.includes("movies") || tags.includes("serial");
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
        if (!parts.frontmatterText) return {};

        const yaml = parts.frontmatterText
            .replace(/^---\s*\r?\n/, "")
            .replace(/\r?\n---\s*$/, "");

        return parseYaml(yaml) ?? {};
    }

    function toNumber(v) {
        if (
            v === null ||
            v === undefined ||
            String(v).trim() === ""
        ) return null;

        const n = Number(String(v).trim().replace(",", "."));
        return Number.isFinite(n) ? n : null;
    }

    function normalizeDate(v) {
        if (!v) return null;

        if (v instanceof Date && !Number.isNaN(v.getTime())) {
            const y = v.getFullYear();
            const m = String(v.getMonth() + 1).padStart(2, "0");
            const d = String(v.getDate()).padStart(2, "0");
            return `${y}-${m}-${d}`;
        }

        const s = String(v).trim();
        let m = s.match(/^(\d{4})$/);
        if (m) return `${m[1]}-01-01`;

        m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
        if (!m) return null;

        return (
            m[1] + "-" +
            String(Number(m[2])).padStart(2, "0") + "-" +
            String(Number(m[3])).padStart(2, "0")
        );
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

    async function resolveMediaFromActive(active) {
        if (!active) return null;
        if (isMedia(active)) return active;

        if (active.path.startsWith(SEASONS_FOLDER + "/")) {
            const fm = await readFm(active);
            return resolveLink(fm["Сериал"], active.path);
        }

        if (active.path.startsWith(VIEWINGS_FOLDER + "/")) {
            const fm = await readFm(active);
            return resolveLink(fm["Фильм"], active.path);
        }

        return null;
    }

    async function getSeasonRows(mediaFile) {
        const rows = [];

        for (const file of app.vault.getMarkdownFiles()) {
            if (!file.path.startsWith(SEASONS_FOLDER + "/")) continue;

            const fm = await readFm(file);
            const serial = resolveLink(fm["Сериал"], file.path);
            if (serial?.path !== mediaFile.path) continue;

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
        return rows;
    }

    async function rebuildSeries(mediaFile) {
        const rows = await getSeasonRows(mediaFile);
        if (rows.length === 0) return false;

        for (let i = 0; i < rows.length; i++) {
            const current = rows[i];
            const previous = i > 0 ? rows[i - 1] : null;

            await app.fileManager.processFrontMatter(
                current.file,
                fm => {
                    delete fm["Предыдущая оценка"];
                    delete fm["Изменение оценки"];

                    if (
                        previous &&
                        previous.rating !== null &&
                        current.rating !== null
                    ) {
                        fm["Предыдущая оценка"] = previous.rating;
                        fm["Изменение оценки"] =
                            Math.round(
                                (current.rating - previous.rating) * 10
                            ) / 10;
                    }
                }
            );
        }

        const dates = rows
            .map(r => r.date)
            .filter(Boolean)
            .sort();

        await app.fileManager.processFrontMatter(
            mediaFile,
            fm => {
                fm["Количество сезонов"] = rows.length;
                fm["Последний сезон"] =
                    Math.max(...rows.map(r => r.season));

                if (dates.length > 0) {
                    fm["Просмотрено"] = dates[dates.length - 1];
                }
            }
        );

        const raw = await app.vault.read(mediaFile);
        const parts = splitFrontmatter(raw);
        const persistent = extractPersistentCardBlocks(parts.body);
        const fm = await readFm(mediaFile);
        const poster = String(fm.poster ?? "").trim();

        const body = [START];

        for (const row of rows) {
            const rating =
                row.rating !== null
                    ? `${row.rating}/10`
                    : "без оценки";

            body.push(`# Сезон ${row.season} (${rating})`);

            if (row.comment) body.push(row.comment);
        }

        body.push(END);

        let result =
            parts.frontmatterText +
            "\n\n" +
            body.join("\n\n") +
            "\n";

        if (persistent) {
            result += `\n${persistent}\n`;
        }

        if (poster) {
            result += `\n---\n![](${poster})\n`;
        }

        await app.vault.modify(mediaFile, result);
        return true;
    }

    async function getViewingRows(mediaFile) {
        const rows = [];

        for (const file of app.vault.getMarkdownFiles()) {
            if (!file.path.startsWith(VIEWINGS_FOLDER + "/")) continue;

            const fm = await readFm(file);
            const media = resolveLink(fm["Фильм"], file.path);
            if (media?.path !== mediaFile.path) continue;

            rows.push({
                file,
                number: Math.trunc(toNumber(fm["Просмотр"]) ?? 0),
                date: normalizeDate(fm["Дата"]),
                rating: toNumber(fm["Оценка"])
            });
        }

        rows.sort((a, b) => {
            if (a.number !== b.number) return a.number - b.number;
            return (a.date ?? "").localeCompare(b.date ?? "");
        });

        return rows;
    }

    async function rebuildViewings(mediaFile, replaceBody) {
        const rows = await getViewingRows(mediaFile);
        if (rows.length === 0) return false;

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

        await app.fileManager.processFrontMatter(
            mediaFile,
            fm => {
                if (latest.date) fm["Просмотрено"] = latest.date;

                fm["Количество просмотров"] = Math.max(
                    rows.length,
                    ...rows.map(r => r.number)
                );

                if (latest.rating !== null) {
                    fm["Оценка"] = latest.rating;
                }
            }
        );

        if (!replaceBody) return true;

        const raw = await app.vault.read(mediaFile);
        const parts = splitFrontmatter(raw);
        const persistent = extractPersistentCardBlocks(parts.body);
        const fm = await readFm(mediaFile);
        const poster = String(fm.poster ?? "").trim();

        let result =
            parts.frontmatterText +
            "\n\n" +
            HISTORY_BLOCK +
            "\n";

        if (persistent) {
            result += `\n${persistent}\n`;
        }

        if (poster) {
            result += `\n![](${poster})\n`;
        }

        await app.vault.modify(mediaFile, result);
        return true;
    }

    let mediaFile = await resolveMediaFromActive(
        app.workspace.getActiveFile()
    );

    if (!mediaFile || !isMedia(mediaFile)) {
        const media = app.vault
            .getMarkdownFiles()
            .filter(isMedia)
            .sort((a, b) =>
                a.basename.localeCompare(b.basename, "ru")
            );

        if (media.length === 0) {
            new Notice("Не найдено карточек Кино.");
            return;
        }

        mediaFile = await quickAddApi.suggester(
            media.map(file => {
                const tags = getTags(cachedFm(file));
                return (
                    (tags.includes("serial") ? "📺 " : "🎬 ") +
                    file.basename
                );
            }),
            media,
            "Какую карточку пересобрать?"
        );

        if (!mediaFile) return;
    }

    const tags = getTags(cachedFm(mediaFile));
    const serial = tags.includes("serial");

    if (serial) {
        const rebuiltSeries = await rebuildSeries(mediaFile);

        // Если есть отдельные записи просмотров сериала,
        // их дельты/сводку тоже обновляем, но сезонное тело не затираем.
        await rebuildViewings(mediaFile, !rebuiltSeries);

        if (!rebuiltSeries) {
            const viewings = await getViewingRows(mediaFile);

            if (viewings.length === 0) {
                new Notice("У сериала нет ни сезонов, ни просмотров.");
                return;
            }
        }
    } else {
        const ok = await rebuildViewings(mediaFile, true);

        if (!ok) {
            new Notice("У фильма нет записей просмотров.");
            return;
        }
    }

    new Notice(`${mediaFile.basename}: карточка пересобрана.`);
    await app.workspace.getLeaf(false).openFile(mediaFile);
};
