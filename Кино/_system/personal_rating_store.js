"use strict";

// Rating changes update existing records; they never create a viewing or a season.
const MEDIA = "Кино/Media/";
const VIEWINGS = "Кино/Просмотры/";
const SEASONS = "Кино/Сезоны/";
const LANE = Symbol.for("kino.personal-rating.save-lane");
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const numeric = value => {
    if (value == null || String(value).trim() === "") return null;
    const result = Number(String(value).trim().replace(",", "."));
    return Number.isFinite(result) ? result : null;
};

function split(raw) {
    const match = String(raw).match(/^\ufeff?---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/);
    return { yaml: match?.[1] || "", body: match ? raw.slice(match[0].length) : String(raw) };
}

async function fields(app, obsidian, file) {
    if (typeof obsidian?.parseYaml !== "function") throw Error("Не удалось прочитать свойства карточки.");
    return obsidian.parseYaml(split(await app.vault.read(file)).yaml) || {};
}

function kindOf(file, fm) {
    if (!file || file.extension !== "md" || file.basename === "_index") return null;
    if (file.path.startsWith(VIEWINGS)) return "viewing";
    if (file.path.startsWith(SEASONS)) return "season";
    const tags = (Array.isArray(fm.tags) ? fm.tags : [fm.tags]).filter(Boolean).map(tag => String(tag).replace(/^#/, ""));
    if (file.path.startsWith(MEDIA) && tags.some(tag => tag === "movies" || tag === "serial")) return "media";
    return null;
}

function resolve(app, value, sourcePath) {
    let target = value?.path != null ? String(value.path) : String(value || "").trim();
    target = target.replace(/^\[\[|\]\]$/g, "").split("|")[0].split("#")[0].trim();
    if (!target) return null;
    const file = app.vault.getAbstractFileByPath(target) || app.vault.getAbstractFileByPath(target.replace(/\.md$/i, "") + ".md")
        || app.metadataCache?.getFirstLinkpathDest?.(target, sourcePath);
    return file?.extension === "md" ? file : null;
}

async function read({ app, obsidian, sourcePath }) {
    const file = app.vault.getAbstractFileByPath(sourcePath);
    if (!file || file.extension !== "md") throw Error("Карточка не найдена.");
    const fm = await fields(app, obsidian, file), kind = kindOf(file, fm);
    if (!kind) throw Error("Оценку можно менять только в карточке фильма, просмотра или сезона.");
    const mediaFile = kind === "media" ? file : resolve(app, fm[kind === "season" ? "Сериал" : "Фильм"], file.path);
    if (!mediaFile || kindOf(mediaFile, await fields(app, obsidian, mediaFile)) !== "media") {
        throw Error("Не найдена основная карточка фильма или сериала.");
    }
    return { file, mediaFile, kind, rating: numeric(fm["Оценка"]) };
}

function date(value) {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
    }
    const text = String(value || "").trim().replace(/^@date:/, "");
    const match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (match) return `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
    return /^\d{4}$/.test(text) ? `${text}-01-01` : null;
}

async function rowsFor(app, obsidian, mediaFile, layout) {
    const viewings = [], seasons = [];
    for (const file of app.vault.getMarkdownFiles()) {
        const kind = file.path.startsWith(VIEWINGS) ? "viewing" : file.path.startsWith(SEASONS) ? "season" : null;
        if (!kind || file.basename === "_index") continue;
        const raw = await app.vault.read(file), fm = obsidian.parseYaml(split(raw).yaml) || {};
        if (resolve(app, fm[kind === "season" ? "Сериал" : "Фильм"], file.path)?.path !== mediaFile.path) continue;
        const index = numeric(fm[kind === "season" ? "Сезон" : "Просмотр"]);
        if (!Number.isInteger(index) || index < 1) continue;
        let comment = own(fm, "Комментарий") ? String(fm["Комментарий"] ?? "").trim() : layout.personalBody(split(raw).body);
        if (kind === "viewing" && !own(fm, "Комментарий")) {
            comment = comment.replace(/^#{1,6}\s*просмотр\s*\d+(?:\s*\([^)]*\))?\s*\r?\n+/i, "")
                .replace(/\n?\s*---\s*\r?\n\s*\[\[[^\]\n]+\|←[^\]\n]+\]\]\s*$/i, "").trim();
        }
        const row = { file, number: index, season: index, date: date(fm["Дата"]), year: fm["Год"], rating: numeric(fm["Оценка"]), comment };
        (kind === "season" ? seasons : viewings).push(row);
    }
    viewings.sort((a, b) => a.number - b.number || String(a.date || "").localeCompare(String(b.date || "")) || a.file.path.localeCompare(b.file.path));
    seasons.sort((a, b) => a.season - b.season || a.file.path.localeCompare(b.file.path));
    return { viewings, seasons };
}

async function saveUnlocked(params, rating, repair = false) {
    const { app, obsidian } = params;
    const current = await read(params);
    const guarded = own(params, "expectedRating"), expected = numeric(params.expectedRating);
    const guard = fm => {
        if (guarded && numeric(fm["Оценка"]) !== expected) throw Error("Оценка уже изменилась. Открой изменение оценки заново.");
    };
    if (guarded && current.rating !== expected) throw Error("Оценка уже изменилась. Открой изменение оценки заново.");
    const mediaRatingBefore = current.kind === "media" ? current.rating : numeric((await fields(app, obsidian, current.mediaFile))["Оценка"]);
    const result = { ...current, rating, changed: false, mediaRatingChanged: false, changedFiles: [] };
    if (!repair && current.rating === rating) return result;

    const layoutFile = app.vault.getAbstractFileByPath("Кино/_system/card_layout.js");
    if (!layoutFile) throw Error("Не найден модуль оформления карточек Кино.");
    const loaded = { exports: {} };
    new Function("module", "exports", await app.vault.read(layoutFile))(loaded, loaded.exports);
    const layout = loaded.exports;
    const { viewings, seasons } = await rowsFor(app, obsidian, current.mediaFile, layout);
    const sourceRows = current.kind === "viewing" ? viewings : current.kind === "season" ? seasons : null;
    const sourceRow = sourceRows?.find(row => row.file.path === current.file.path);
    if (sourceRows && !sourceRow) throw Error("В карточке не указан корректный номер просмотра или сезона.");
    const changed = new Set();
    const patch = async (file, values, check) => {
        const fm = await fields(app, obsidian, file);
        check?.(fm);
        const differs = Object.entries(values).some(([key, value]) => value === undefined ? own(fm, key) : fm[key] !== value);
        if (!differs) return;
        await app.fileManager.processFrontMatter(file, next => {
            check?.(next);
            for (const [key, value] of Object.entries(values)) {
                if (value === undefined) delete next[key];
                else next[key] = value;
            }
        });
        changed.add(file);
    };

    const latest = viewings[viewings.length - 1];
    const previousMediaRatingChanged = repair && params.previousMediaRatingChanged === true;
    const intendedMainChange = (current.kind === "media" || (current.kind === "viewing" && sourceRow === latest))
        && mediaRatingBefore !== rating;
    try {
        // Guard the source again inside Obsidian's serialized frontmatter operation.
        await patch(current.file, { "Оценка": rating }, guard);
        if (sourceRow) sourceRow.rating = rating;
        if (current.kind === "media" && latest) {
            await patch(latest.file, { "Оценка": rating });
            latest.rating = rating;
        }
        if (current.kind === "viewing" && sourceRow === latest) await patch(current.mediaFile, { "Оценка": rating });

        if (current.kind !== "season" && viewings.length) {
            const previous = viewings[viewings.length - 2];
            for (const row of viewings) {
                const delta = row === latest && previous?.rating != null && row.rating != null;
                await patch(row.file, {
                    "Последний просмотр": row === latest,
                    "Предыдущая оценка": delta ? previous.rating : undefined,
                    "Изменение оценки": delta ? Number((row.rating - previous.rating).toFixed(2)) : undefined
                });
            }
        }
        if (current.kind === "season") {
            for (let i = 0; i < seasons.length; i++) {
                const row = seasons[i], previous = seasons[i - 1], delta = previous?.rating != null && row.rating != null;
                await patch(row.file, {
                    "Предыдущая оценка": delta ? previous.rating : undefined,
                    "Изменение оценки": delta ? Math.round((row.rating - previous.rating) * 10) / 10 : undefined
                });
            }
        }

        if (current.kind !== "media" || latest) {
            const chunks = [];
            if (seasons.length) {
                chunks.push("<!-- SEASONS:START -->");
                for (const row of seasons) {
                    chunks.push(`# Сезон ${row.season} (${row.rating == null ? "без оценки" : `${row.rating}/10`})`);
                    if (row.comment) chunks.push(row.comment);
                }
                chunks.push("<!-- SEASONS:END -->");
            }
            if (viewings.length) chunks.push(layout.viewingHistory(viewings));
            const original = await app.vault.read(current.mediaFile);
            const rebuilt = layout.rebuildCard(original, chunks.join("\n\n"), { parseYaml: obsidian.parseYaml });
            if (rebuilt !== original) {
                // process keeps unrelated edits made since the read used above.
                if (typeof app.vault.process === "function") {
                    let modified = false;
                    await app.vault.process(current.mediaFile, raw => {
                        const next = layout.rebuildCard(raw, chunks.join("\n\n"), { parseYaml: obsidian.parseYaml });
                        modified = next !== raw;
                        return next;
                    });
                    if (modified) changed.add(current.mediaFile);
                } else {
                    await app.vault.modify(current.mediaFile, rebuilt);
                    changed.add(current.mediaFile);
                }
            }
        }
        const mediaRatingAfter = numeric((await fields(app, obsidian, current.mediaFile))["Оценка"]);
        return { ...result, changed: changed.size > 0 || previousMediaRatingChanged,
            mediaRatingChanged: previousMediaRatingChanged || mediaRatingAfter !== mediaRatingBefore, changedFiles: [...changed] };
    } catch (caught) {
        const error = caught instanceof Error ? caught : Error(String(caught));
        if (changed.size > 0) {
            let mediaRatingChanged = intendedMainChange;
            try { mediaRatingChanged = numeric((await fields(app, obsidian, current.mediaFile))["Оценка"]) !== mediaRatingBefore; }
            catch (_) { /* The successful source write is known even if the follow-up read fails. */ }
            error.partialSave = { sourcePath: params.sourcePath, rating,
                mediaRatingChanged: previousMediaRatingChanged || mediaRatingChanged, changedFiles: [...changed] };
            error.message = "Оценка сохранена, но связанные записи обновлены не полностью: " + error.message;
        }
        throw error;
    }
}

async function serializedSave(params, repair) {
    const rating = numeric(params.rating);
    if (rating == null || rating < 1 || rating > 10) throw Error("Оценка должна быть от 1 до 10.");
    const previous = params.app[LANE] || Promise.resolve();
    let release;
    const lane = new Promise(resolve => { release = resolve; });
    params.app[LANE] = lane;
    await previous.catch(() => {});
    try { return await saveUnlocked(repair ? { ...params, expectedRating: rating } : params, rating, repair); }
    finally { release(); if (params.app[LANE] === lane) delete params.app[LANE]; }
}

module.exports = { read, save: params => serializedSave(params, false), reconcile: params => serializedSave(params, true) };
