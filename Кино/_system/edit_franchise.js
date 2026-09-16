/*
 * QuickAdd: отдельный макрос «Франшиза» с одним шагом - этот скрипт.
 * Карточки произведений: Кино/. Карточки франшиз: Кино/Франшизы/.
 * Изменяет только Франшиза и Часть у выбранного произведения.
 * Таблица франшизы строится Dataview из актуальных карточек.
 */

const MEDIA_FOLDER = "Кино";
const FRANCHISE_FOLDER = "Кино/Франшизы";
const TABLE_MARKER = "<!-- FRANCHISE:TABLE:v1 -->";

module.exports = async function editFranchise(params) {
    const { app, quickAddApi, obsidian } = params;
    const notify = message => new obsidian.Notice(message, 5000);
    const cached = file => app.metadataCache.getFileCache(file)?.frontmatter ?? {};
    const allFiles = app.vault.getMarkdownFiles();
    const media = allFiles.filter(file => isMedia(file, cached(file)))
        .sort((a, b) => a.basename.localeCompare(b.basename, "ru"));

    async function readFrontmatter(file) {
        const raw = await app.vault.read(file);
        const match = raw.match(/^\uFEFF?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
        return match ? (obsidian.parseYaml(match[1]) ?? {}) : {};
    }

    function resolve(value, sourcePath) {
        const path = linkPath(value);
        return path ? app.metadataCache.getFirstLinkpathDest(path, sourcePath) : null;
    }

    // Берём открытую карточку; из сезона/просмотра переходим к оригиналу.
    const active = app.workspace.getActiveFile();
    let file = media.find(item => item.path === active?.path);
    if (!file && active?.extension === "md") {
        const fm = await readFrontmatter(active);
        const original = resolve(fm["Сериал"] || fm["Фильм"], active.path);
        file = media.find(item => item.path === original?.path);
    }
    if (!file) {
        if (!media.length) {
            notify("В папке Кино нет карточек с тегами movies или serial.");
            return;
        }
        file = await quickAddApi.suggester(
            media.map(item => `${item.basename} — ${item.path}`), media,
            "Какое произведение связать с франшизой?"
        );
        if (!file) return;
    }

    const before = await readFrontmatter(file);
    const oldLink = before["Франшиза"];
    const oldPage = resolve(oldLink, file.path);

    if (oldLink) {
        const action = await quickAddApi.suggester(
            ["Изменить франшизу / номер части", "Открыть франшизу", "Убрать связь с франшизой"],
            ["edit", "open", "remove"], file.basename
        );
        if (!action) return;
        if (action === "open") {
            if (oldPage) await app.workspace.getLeaf(false).openFile(oldPage);
            else notify("Карточка франшизы не найдена. Выбери «Изменить франшизу» для создания связи.");
            return;
        }
        if (action === "remove") {
            await app.fileManager.processFrontMatter(file, fm => {
                checkUnchanged(fm, before);
                delete fm["Франшиза"];
                delete fm["Часть"];
            });
            notify(`Связь убрана: ${file.basename}`);
            return;
        }
    }

    const pages = allFiles.filter(item =>
        item.path.startsWith(FRANCHISE_FOLDER + "/") || tags(cached(item)).includes("franchise")
    );
    // Учитываем и существующие ссылки, если страницы ещё не созданы.
    const choices = new Map();
    for (const page of pages) {
        choices.set(page.path, { name: page.basename, path: page.path, file: page });
    }
    for (const item of media) {
        const ref = cached(item)["Франшиза"];
        if (!ref || Array.isArray(ref)) continue;
        const target = resolve(ref, item.path);
        const name = linkPath(ref).split("/").pop();
        if (!name) continue;
        const path = target?.path || `${FRANCHISE_FOLDER}/${safeName(name)}.md`;
        if (!choices.has(path)) choices.set(path, { name, path, file: target });
    }
    const list = [...choices.values()].sort((a, b) =>
        Number(b.path === oldPage?.path) - Number(a.path === oldPage?.path) || a.name.localeCompare(b.name, "ru")
    );
    const create = { create: true };
    let choice = await quickAddApi.suggester(
        [...list.map(item => `${item.name} — ${item.path}`), "+ Новая франшиза"],
        [...list, create], "Выбери франшизу"
    );
    if (!choice) return;

    if (choice.create) {
        const input = await quickAddApi.inputPrompt("Название франшизы", "Например: Трансформеры");
        if (input == null || !String(input).trim()) return;
        const name = safeName(input);
        if (!name) throw new Error("Введи название, пригодное для имени файла.");
        const path = `${FRANCHISE_FOLDER}/${name}.md`;
        const existing = allFiles.find(item => item.path.toLowerCase() === path.toLowerCase());
        choice = { name: existing?.basename || name, path: existing?.path || path, file: existing };
    }

    // Отмена любого диалога до этого места ничего не записывает.
    const sameFranchise = oldPage?.path === choice.path;
    let part;
    while (true) {
        const input = await quickAddApi.inputPrompt(
            `Номер части: ${file.basename}`, "1, 2, 3… Пусто — без номера",
            sameFranchise ? String(before["Часть"] ?? "") : ""
        );
        if (input == null) return;
        if (!String(input).trim()) { part = null; break; }
        part = Number(String(input).trim().replace(",", "."));
        if (Number.isFinite(part) && part > 0) break;
        notify("Номер части должен быть положительным числом или пустым.");
    }

    let page = app.vault.getAbstractFileByPath(choice.path);
    if (page && page.extension !== "md") throw new Error("Путь франшизы занят папкой или другим файлом.");
    if (page) {
        const fm = await readFrontmatter(page);
        if (isMedia(page, fm) || fm["Фильм"] || fm["Сериал"] ||
            tags(fm).some(tag => ["movies", "serial", "season", "viewing"].includes(tag))) {
            throw new Error("Выбранная страница является произведением, сезоном или просмотром, а не франшизой.");
        }
    }

    // Проверяем конфликт до создания страницы и повторно при записи свойств.
    checkUnchanged(await readFrontmatter(file), before);
    if (!page) {
        const folders = choice.path.split("/").slice(0, -1);
        let path = "";
        for (const folder of folders) {
            path = path ? `${path}/${folder}` : folder;
            if (!app.vault.getAbstractFileByPath(path)) await app.vault.createFolder(path);
        }
        page = await app.vault.create(choice.path,
            `---\ntags:\n  - franchise\nПорядок: выход\n---\n\n# ${choice.name}\n\n## Общее впечатление\n\n\n` + tableBlock()
        );
    } else {
        // Добавляем таблицу один раз; существующий текст и YAML страницы сохраняются.
        await app.vault.process(page, text => text.includes(TABLE_MARKER) ? text : text.trimEnd() + "\n\n" + tableBlock());
    }

    await app.fileManager.processFrontMatter(file, fm => {
        checkUnchanged(fm, before);
        fm["Франшиза"] = `[[${page.path.replace(/\.md$/i, "")}]]`;
        if (part === null) delete fm["Часть"];
        else fm["Часть"] = part;
    });
    notify(`${file.basename} → ${page.basename}${part === null ? "" : `, часть ${part}`}`);
};

function tags(fm) {
    return (Array.isArray(fm.tags) ? fm.tags : [fm.tags])
        .filter(Boolean).map(value => String(value).trim().replace(/^#/, ""));
}

function isMedia(file, fm) {
    return file.extension === "md" && file.path.startsWith(MEDIA_FOLDER + "/") &&
        !["Просмотры", "Сезоны", "Франшизы"].some(folder => file.path.startsWith(`${MEDIA_FOLDER}/${folder}/`)) &&
        tags(fm).some(tag => tag === "movies" || tag === "serial");
}

function linkPath(value) {
    if (value && typeof value === "object" && value.path) return value.path.replace(/\.md$/i, "");
    return String(value ?? "").trim().replace(/^\[\[/, "").replace(/\]\]$/, "")
        .split("|")[0].split("#")[0].trim().replace(/\.md$/i, "");
}

function safeName(value) {
    const name = String(value).replace(/[\\/:*?"<>|\[\]#^\x00-\x1f]/g, " ")
        .replace(/\s+/g, " ").trim().replace(/[. ]+$/g, "");
    return /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name) ? `_${name}` : name;
}

function checkUnchanged(current, before) {
    for (const key of ["Франшиза", "Часть"]) {
        if (JSON.stringify(current[key]) !== JSON.stringify(before[key])) {
            throw new Error("Связь или номер части изменились во время ввода. Запусти команду заново.");
        }
    }
}

function tableBlock() {
    return TABLE_MARKER + "\n## Произведения\n\n```dataviewjs\n" +
        renderFranchise.toString() + "\nrenderFranchise(dv);\n```\n";
}

// Эта функция включается в карточку франшизы; внешние .js для её отображения не нужны.
function renderFranchise(dv) {
    const current = dv.current();
    function number(value) {
        if (value == null || String(value).trim() === "") return null;
        const result = Number(String(value).replace(",", "."));
        return Number.isFinite(result) ? result : null;
    }
    function release(value) {
        if (value?.toMillis) return value.toMillis();
        if (value instanceof Date) return value.getTime();
        const text = String(value ?? "").trim();
        if (/^\d{4}$/.test(text)) return Date.UTC(Number(text), 0, 1);
        const ru = text.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
        const result = ru ? Date.UTC(Number(ru[3]), Number(ru[2]) - 1, Number(ru[1])) : Date.parse(text);
        return Number.isFinite(result) ? result : Infinity;
    }
    function belongs(page) {
        const refs = Array.isArray(page["Франшиза"]) ? page["Франшиза"] : [page["Франшиза"]];
        return refs.some(ref => {
            if (!ref) return false;
            const path = typeof ref === "object" ? ref.path : String(ref).replace(/^\[\[/, "").replace(/\]\]$/, "").split("|")[0];
            return path && dv.page(path)?.file.path === current.file.path;
        });
    }
    const rows = dv.pages('"Кино"').array().filter(page => {
        if (["Просмотры", "Сезоны", "Франшизы"].some(folder => page.file.path.startsWith(`Кино/${folder}/`))) return false;
        const tags = (Array.isArray(page.tags) ? page.tags : [page.tags]).filter(Boolean)
            .map(tag => String(tag).replace(/^#/, ""));
        return tags.some(tag => tag === "movies" || tag === "serial") && belongs(page);
    });
    const byPart = String(current["Порядок"] ?? "").toLowerCase() === "части";
    rows.sort((a, b) => {
        const dates = release(a["Релиз"]) - release(b["Релиз"]);
        const parts = (number(a["Часть"]) ?? Infinity) - (number(b["Часть"]) ?? Infinity);
        return (byPart ? (parts || dates) : (dates || parts)) || a.file.name.localeCompare(b.file.name, "ru");
    });
    dv.paragraph(`Произведений: ${rows.length}. Порядок: ${byPart ? "по номерам частей" : "по дате выхода"}.`);
    if (!rows.length) {
        dv.paragraph("Добавь произведения командой QuickAdd «Франшиза».");
        return;
    }
    dv.table(["Часть", "Произведение", "Релиз", "Моя оценка", "КП", "IMDb"], rows.map(page => [
        number(page["Часть"]) ?? "—", page.file.link, page["Релиз"] ?? "—",
        number(page["Оценка"]) ?? "—", number(page["Оценка Кинопоиск"]) ?? "—",
        number(page["Оценка Imdb"]) ?? "—"
    ]));
}
