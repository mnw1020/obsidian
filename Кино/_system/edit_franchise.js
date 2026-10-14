/*
 * QuickAdd: отдельный макрос «Франшиза» с одним шагом - этот скрипт.
 * Карточки произведений: Кино/Media/. Карточки франшиз: Кино/Франшизы/.
 * Меняет связь выбранного произведения и нумерует затронутые франшизы по релизу.
 * Таблица франшизы строится Dataview из актуальных карточек.
 */

const MEDIA_FOLDER = "Кино/Media";
const FRANCHISE_FOLDER = "Кино/Франшизы";

module.exports = async function editFranchise(params) {
    const { app, quickAddApi, obsidian } = params;
    const order = await loadFranchiseOrder(app);
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
            ["Изменить франшизу", "Открыть франшизу", "Убрать связь с франшизой"],
            ["edit", "open", "remove"], file.basename
        );
        if (!action) return;
        if (action === "open") {
            if (oldPage) await app.workspace.getLeaf(false).openFile(oldPage);
            else notify("Карточка франшизы не найдена. Выбери «Изменить франшизу» для создания связи.");
            return;
        }
        if (action === "remove") {
            let after;
            await app.fileManager.processFrontMatter(file, fm => {
                checkUnchanged(fm, before);
                delete fm["Франшиза"];
                delete fm["Часть"];
                after = { ...fm };
            });
            await order.renumber({ app, paths: [oldPage?.path || oldLink], overrides: new Map([[file.path, after]]) });
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
        page = await app.vault.create(choice.path, await withKinoLayout(app, obsidian,
            `---\ntags:\n  - franchise\nПорядок: выход\n---\n\n# ${choice.name}\n\n## Общее впечатление\n\n\n` + order.tableBlock(), "franchise")
        );
    } else {
        // Добавляем таблицу один раз; существующий текст и YAML страницы сохраняются.
        const decorate = await kinoLayoutDecorator(app, obsidian, "franchise");
        await app.vault.process(page, text => decorate(order.ensureTable(text)));
    }

    let after;
    await app.fileManager.processFrontMatter(file, fm => {
        checkUnchanged(fm, before);
        fm["Франшиза"] = `[[${page.path.replace(/\.md$/i, "")}]]`;
        delete fm["Часть"];
        after = { ...fm };
    });
    const result = await order.renumber({ app, paths: [oldPage?.path || oldLink, page.path], overrides: new Map([[file.path, after]]) });
    notify(`${file.basename} → ${page.basename}, часть ${result.parts.get(file.path)}`);
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

async function loadFranchiseOrder(app) {
    const file = app.vault.getAbstractFileByPath("Кино/_system/franchise_order.js");
    if (!file) throw new Error("Не найден скрипт порядка франшиз.");
    const module = { exports: {} };
    new Function("module", "exports", await app.vault.read(file))(module, module.exports);
    return module.exports;
}

// Add the shared presentation without rewriting the generated note's data.
async function withKinoLayout(app,obsidian,raw,kind){
    return (await kinoLayoutDecorator(app,obsidian,kind))(raw);
}
async function kinoLayoutDecorator(app,obsidian,kind){
    const file=app.vault.getAbstractFileByPath("Кино/_system/card_layout.js");
    if(!file)return raw=>raw;
    const module={exports:{}};
    new Function("module","exports",await app.vault.read(file))(module,module.exports);
    return raw=>module.exports.ensureLayout(raw,{kind,parseYaml:obsidian?.parseYaml});
}
