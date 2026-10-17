/* Shared release order for franchise tables, media cards and QuickAdd commands.
 * Part numbers describe the chronological order of works present in this library.
 * This module uses only the Obsidian API and also runs in Dataview on Android.
 */
const MEDIA_FOLDER = "Кино/Media";
const FRANCHISE_FOLDER = "Кино/Франшизы";
const TABLE_MARKER = "<!-- FRANCHISE:TABLE:v2 -->";
const LANE = Symbol.for("kino.franchiseOrderLane");

function list(value) {
    return Array.isArray(value) ? value : value == null ? [] : [value];
}

function linkPath(value) {
    return String(value?.path ?? value ?? "").trim().replace(/^\[\[/, "").replace(/\]\]$/, "")
        .split("|")[0].split("#")[0].trim().replace(/\\/g, "/").replace(/\.md$/i, "");
}

function normalized(value) {
    return String(value ?? "").normalize("NFC").toLocaleLowerCase("ru");
}

function frontmatter(app, file, overrides) {
    const replacement = overrides instanceof Map ? overrides.get(file.path) : overrides?.[file.path];
    return replacement ?? app.metadataCache.getFileCache(file)?.frontmatter ?? {};
}

function isMedia(file, fm) {
    return file?.extension === "md" && file.path.startsWith(MEDIA_FOLDER + "/") &&
        list(fm.tags).some(tag => ["movies", "serial"].includes(String(tag).replace(/^#/, "")));
}

function canonicalPath({ app, value, sourcePath = "" }) {
    const path = linkPath(value);
    if (!path) return null;
    const resolved = app.metadataCache.getFirstLinkpathDest?.(path, sourcePath);
    if (resolved?.extension === "md") return resolved.path;
    const direct = app.vault.getAbstractFileByPath(path + ".md");
    if (direct?.extension === "md") return direct.path;
    // Aliases are useful even while Obsidian is rebuilding its link index.
    const key = normalized(path);
    const candidates = app.vault.getMarkdownFiles().filter(file => {
        const fm = app.metadataCache.getFileCache(file)?.frontmatter ?? {};
        const franchise = file.path.startsWith(FRANCHISE_FOLDER + "/") || list(fm.tags).includes("franchise");
        return franchise && [file.path.replace(/\.md$/i, ""), file.basename, ...list(fm.aliases)]
            .some(name => normalized(name) === key);
    });
    if (candidates.length === 1) return candidates[0].path;
    // A link can exist before its franchise note is created.
    return (path.includes("/") ? path : FRANCHISE_FOLDER + "/" + path) + ".md";
}

function releaseKey(value) {
    if (value?.toISODate) value = value.toISODate();
    if (value instanceof Date) return Number.isFinite(value.getTime())
        ? Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()) : Infinity;
    const text = String(value ?? "").trim();
    let year, month, day;
    let match = text.match(/^(\d{4})$/);
    if (match) { year = Number(match[1]); month = 1; day = 1; }
    else if ((match = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/))) {
        year = Number(match[1]); month = Number(match[2]); day = Number(match[3]);
    } else if ((match = text.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/))) {
        year = Number(match[3]); month = Number(match[2]); day = Number(match[1]);
    } else return Infinity;
    if (year < 100 || year > 9999 || month < 1 || month > 12 || day < 1 || day > 31) return Infinity;
    const timestamp = Date.UTC(year, month - 1, day);
    const date = new Date(timestamp);
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
        ? timestamp : Infinity;
}

function compareMembers(a, b) {
    const aDate = releaseKey(a.frontmatter?.["Релиз"]);
    const bDate = releaseKey(b.frontmatter?.["Релиз"]);
    if (aDate !== bDate) return aDate < bDate ? -1 : 1;
    const aTitle = String(a.file.basename ?? a.file.path.split("/").pop().replace(/\.md$/i, ""));
    const bTitle = String(b.file.basename ?? b.file.path.split("/").pop().replace(/\.md$/i, ""));
    return aTitle.localeCompare(bTitle, "ru", { sensitivity: "base", numeric: true }) ||
        a.file.path.localeCompare(b.file.path, "ru");
}

function belongs(app, file, fm, franchisePath) {
    return list(fm["Франшиза"]).some(value => canonicalPath({ app, value, sourcePath: file.path }) === franchisePath);
}

function ordered({ app, franchisePath, overrides }) {
    const path = canonicalPath({ app, value: franchisePath });
    if (!path) return [];
    return app.vault.getMarkdownFiles().map(file => ({ file, frontmatter: frontmatter(app, file, overrides) }))
        .filter(row => isMedia(row.file, row.frontmatter) && belongs(app, row.file, row.frontmatter, path))
        .sort(compareMembers).map((row, index) => ({ ...row, part: index + 1 }));
}

function partNumber({ app, file, franchisePath, overrides }) {
    const fm = frontmatter(app, file, overrides);
    const path = franchisePath || list(fm["Франшиза"])[0];
    if (!path) return null;
    return ordered({ app, franchisePath: path, overrides }).find(row => row.file.path === file.path)?.part ?? null;
}

async function renumber({ app, paths, overrides }) {
    const previous = app[LANE] ?? Promise.resolve();
    const job = previous.catch(() => {}).then(async () => {
        const groups = [...new Set(list(paths).filter(Boolean).map(value => canonicalPath({ app, value })).filter(Boolean))];
        const parts = new Map();
        let changed = 0;
        for (const franchisePath of groups) {
            const rows = ordered({ app, franchisePath, overrides });
            for (const row of rows) {
                parts.set(row.file.path, row.part);
                if (Number(row.frontmatter["Часть"]) === row.part && typeof row.frontmatter["Часть"] === "number") continue;
                await app.fileManager.processFrontMatter(row.file, fm => {
                    if (!belongs(app, row.file, fm, franchisePath) || releaseKey(fm["Релиз"]) !== releaseKey(row.frontmatter["Релиз"])) {
                        throw new Error("Франшиза или дата релиза изменились во время перенумерации. Повтори команду «Франшиза».");
                    }
                    fm["Часть"] = row.part;
                });
                changed++;
            }
        }
        return { changed, parts };
    });
    app[LANE] = job;
    return job;
}

function tableBlock() {
    return TABLE_MARKER + "\n## Произведения\n\n```dataviewjs\n" +
        'const file = app.vault.getAbstractFileByPath("Кино/_system/franchise_order.js");\n' +
        'if (!file) throw new Error("Не найден скрипт порядка франшиз.");\n' +
        'const mod = { exports: {} };\n' +
        'new Function("module", "exports", await app.vault.read(file))(mod, mod.exports);\n' +
        'await mod.exports.render({ dv, app });\n```\n';
}

function ensureTable(raw) {
    const generated = /<!-- FRANCHISE:TABLE:v[12] -->\s*\r?\n## Произведения\s*\r?\n```dataviewjs\r?\n[\s\S]*?\r?\n```(?:\r?\n|$)/;
    return generated.test(raw) ? raw.replace(generated, tableBlock()) : raw.trimEnd() + "\n\n" + tableBlock();
}

function displayRelease(value) {
    if (value?.toISODate) value = value.toISODate();
    if (value instanceof Date) value = value.toISOString().slice(0, 10);
    const text = String(value ?? "").trim();
    const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/);
    return iso ? `${iso[3]}.${iso[2]}.${iso[1]}` : text || "—";
}

async function render({ dv, app }) {
    const rows = ordered({ app, franchisePath: dv.current().file.path });
    const number = value => value == null || String(value).trim() === "" ? "—" : Number.isFinite(Number(value)) ? Number(value) : "—";
    const doc=dv.container.ownerDocument;
    const summary=doc.createElement("div");summary.className="kino-franchise-collection-summary";
    const count=doc.createElement("span");count.className="kino-franchise-collection-count";count.textContent=String(rows.length);
    const label=doc.createElement("span"),last=rows.length%10,hundred=rows.length%100;label.textContent=hundred>=11&&hundred<=14?"произведений":last===1?"произведение":last>=2&&last<=4?"произведения":"произведений";
    summary.append(count,label);
    const years=rows.map(row=>String(row.frontmatter["Релиз"]??"").match(/(?:18|19|20)\d{2}/)?.[0]).filter(Boolean).sort();
    if(years.length){const span=doc.createElement("span");span.className="kino-franchise-collection-years";span.textContent=years[0]===years[years.length-1]?years[0]:years[0]+"–"+years[years.length-1];summary.append(span);}
    const order=doc.createElement("span");order.className="kino-franchise-collection-order";order.textContent="По дате релиза";summary.append(order);
    dv.container.append(summary);
    if (!rows.length) { dv.paragraph("Добавь произведения командой QuickAdd «Франшиза»."); return; }
    dv.table(["Часть", "Произведение", "Релиз", "Моя оценка", "КП", "IMDb"], rows.map(({ file, frontmatter: fm, part }) => [
        part, dv.fileLink(file.path, false, file.basename), displayRelease(fm["Релиз"]),
        number(fm["Оценка"]), number(fm["Оценка Кинопоиск"]), number(fm["Оценка Imdb"])
    ]));
}

module.exports = { TABLE_MARKER, canonicalPath, releaseKey, compareMembers, ordered, partNumber, renumber, tableBlock, ensureTable, render };
