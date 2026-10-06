// Portable Obsidian persistence: section folders and one canonical copy of every quote.
const QUOTES_ROOT = "Книги/Цитаты";
const COLLECTION_NAME = "_Выписки.md";
const QUEUE_KEY = "__bookQuoteStorageV1";

function normalizeSectionPath(value) {
    const input = String(value ?? "").trim();
    if (!input) return "";
    if (/[\\:*?"<>|\x00-\x1f]/.test(input)) throw new Error("В названии раздела нельзя использовать \\, :, *, ?, кавычки, <, >, | или управляющие символы.");
    const parts = input.split("/").map(part => part.trim());
    if (parts.some(part => !part || part === "." || part === "..")) throw new Error("Укажите названия разделов через / без пустых уровней, . и ...");
    for (const part of parts) {
        if (part.endsWith(".")) throw new Error("Название раздела не должно заканчиваться точкой.");
        if (part.length > 255) throw new Error("Название одного раздела слишком длинное: максимум 255 символов.");
        if (/^(?:con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])(?:\..*)?$/i.test(part)) throw new Error(`Название «${part}» зарезервировано Windows. Выберите другое название раздела.`);
    }
    return parts.join("/");
}

const foldPath = value => String(value).toLocaleLowerCase("ru");
function existingAt(app, path) {
    const exact = app.vault.getAbstractFileByPath(path);
    if (exact) return exact;
    // Windows paths are case-insensitive. Reuse the spelling already present in the vault.
    const parentPath = path.slice(0, path.lastIndexOf("/"));
    const parent = app.vault.getAbstractFileByPath(parentPath);
    const candidates = app.vault.getAllLoadedFiles?.() || parent?.children || [];
    const matching = candidates.filter(file => foldPath(file.path) === foldPath(path));
    if (matching.length > 1) throw new Error(`В хранилище несколько путей с названием «${path}». Уточните регистр названия.`);
    return matching[0] || null;
}
function isFolder(file) {
    return Boolean(file && typeof file.extension !== "string" && (Array.isArray(file.children) || (!file.stat && !Object.prototype.hasOwnProperty.call(file, "text"))));
}
function requireFolder(file, path) {
    if (!isFolder(file)) throw new Error(`На месте папки «${path}» уже есть файл. Выберите другой раздел.`);
    return file.path;
}

async function ensureSectionFolders(app, section) {
    const normalized = normalizeSectionPath(section);
    if (!app?.vault?.getAbstractFileByPath || !app.vault.createFolder) throw new Error("Создание папок цитат недоступно.");
    const components = [...QUOTES_ROOT.split("/"), ...(normalized || "Неразобранное").split("/")];
    // Check every existing component first, so known file conflicts do not create partial folders.
    let proposed = "";
    for (const component of components) {
        proposed = proposed ? `${proposed}/${component}` : component;
        const existing = existingAt(app, proposed);
        if (existing) proposed = requireFolder(existing, proposed);
    }
    let path = "";
    for (const component of components) {
        const next = path ? `${path}/${component}` : component;
        let folder = existingAt(app, next);
        if (!folder) {
            let created;
            try { created = await app.vault.createFolder(next); }
            catch (error) {
                // Another window/process may have created the same folder while we awaited the API.
                folder = existingAt(app, next);
                if (!folder) throw error;
            }
            folder = folder || existingAt(app, next) || created;
            if (!folder) throw new Error(`Не удалось создать папку «${next}».`);
        }
        path = requireFolder(folder, next);
    }
    if (!foldPath(path).startsWith(foldPath(QUOTES_ROOT + "/"))) throw new Error("Папка раздела должна находиться внутри Книги/Цитаты.");
    return path;
}

function assertCollection(core, raw, path) {
    const fm = core.readFrontmatter(raw);
    if (fm.note_type !== "excerpt_collection" || !String(fm.title ?? "").trim()) throw new Error(`Файл «${path}» не является подборкой цитат. Он не будет изменён.`);
    return fm;
}
function requireCurrentFile(app, file, path) {
    if (!file || file.path !== path || app.vault.getAbstractFileByPath(path) !== file || isFolder(file)) throw new Error("Источник цитаты изменился или больше не доступен.");
}
function inSaveQueue(app, task) {
    const state = app[QUEUE_KEY] || (app[QUEUE_KEY] = { tail: Promise.resolve() });
    const operation = Promise.resolve(state.tail).catch(() => {}).then(task);
    state.tail = operation.then(() => undefined, () => undefined);
    return operation;
}

async function saveQuote({ app, knowledge, core, value = {} } = {}) {
    if (!app?.vault?.getAbstractFileByPath || !app.vault.process || !app.vault.read) throw new Error("Для безопасного сохранения требуется актуальная версия Obsidian.");
    if (!knowledge?.renderExcerpt || !knowledge.applyExcerpt || !knowledge.createId || !knowledge.parseExcerpts) throw new Error("Модуль цитат не поддерживает сохранение.");
    if (value.sourceKind !== "book" && value.sourceKind !== "free") throw new Error("Выберите книгу из библиотеки или произвольный источник.");
    const section = normalizeSectionPath(value.section);
    const input = {
        text: value.text, section, themes: value.themes, conclusion: value.conclusion, location: value.location,
        savedDate: String(value.savedDate ?? knowledge.localDate?.() ?? "").trim()
    };
    if (value.sourceKind === "free") {
        if (!core?.readFrontmatter || !app.vault.create) throw new Error("Создание подборки цитат недоступно.");
        input.sourceTitle = String(value.sourceTitle ?? "").replace(/[\r\n]+/g, " ").trim();
        input.sourceAuthors = knowledge.excerptAuthors ? knowledge.excerptAuthors(value.sourceAuthors) : (Array.isArray(value.sourceAuthors) ? value.sourceAuthors : String(value.sourceAuthors ?? "").split(/[;\n]+/)).map(author => String(author).trim()).filter(Boolean);
    } else if (!core?.isBook) throw new Error("Модуль библиотеки не поддерживает выбор книги.");
    // Validate text, date and metadata before any folder or note creation.
    knowledge.renderExcerpt({ ...input, id: "book-excerpt-storage-validation" });

    return inSaveQueue(app, async () => {
        if (value.sourceKind === "book") {
            const path = String(value.bookPath ?? "");
            const file = app.vault.getAbstractFileByPath(path);
            requireCurrentFile(app, file, path);
            if (!core.isBook(file)) throw new Error("Выбранная книга больше не доступна в библиотеке.");
            await ensureSectionFolders(app, section);
            requireCurrentFile(app, file, path);
            let id;
            await app.vault.process(file, raw => {
                requireCurrentFile(app, file, path);
                if (!core.isBook(file)) throw new Error("Выбранная книга больше не доступна в библиотеке.");
                id = knowledge.createId(raw);
                return knowledge.applyExcerpt(raw, { ...input, id });
            });
            return { file, path, id };
        }

        const folder = await ensureSectionFolders(app, section);
        const requestedPath = `${folder}/${COLLECTION_NAME}`;
        let file = existingAt(app, requestedPath);
        async function append(existing, pendingId) {
            const path = existing.path;
            requireCurrentFile(app, existing, path);
            let id = pendingId, fm;
            await app.vault.process(existing, raw => {
                requireCurrentFile(app, existing, path);
                fm = assertCollection(core, raw, path);
                if (id) {
                    const found = knowledge.parseExcerpts(raw).filter(entry => entry.id === id);
                    if (found.length > 1) throw new Error("Идентификатор цитаты повторяется. Сохранение отменено.");
                    if (found.length) return raw;
                } else id = knowledge.createId(raw);
                return knowledge.applyExcerpt(raw, { ...input, id });
            });
            core.remember?.(existing, fm);
            return { file: existing, path, id };
        }
        if (file) {
            if (isFolder(file)) throw new Error(`На месте файла «${requestedPath}» уже есть папка.`);
            return append(file);
        }
        const id = knowledge.createId("");
        const title = section.split("/").at(-1) || "Произвольные цитаты";
        const content = [
            "---", "note_type: excerpt_collection", `title: ${JSON.stringify(title)}`, "authors: []", `quote_section: ${JSON.stringify(section)}`,
            "cssclasses:", "  - book-knowledge", "obsidianUIMode: preview", "---", "", `# ${title}`, "", knowledge.renderExcerpt({ ...input, id })
        ].join("\n");
        const fm = assertCollection(core, content, requestedPath);
        try { file = await app.vault.create(requestedPath, content); }
        catch (error) {
            // Reconcile an external creator or a create API that failed after committing the file.
            file = existingAt(app, requestedPath);
            if (!file) throw error;
            if (isFolder(file)) throw new Error(`На месте файла «${requestedPath}» уже есть папка.`);
            const raw = await app.vault.read(file);
            const currentFm = assertCollection(core, raw, file.path);
            const found = knowledge.parseExcerpts(raw).filter(entry => entry.id === id);
            if (found.length > 1) throw new Error("Идентификатор цитаты повторяется. Сохранение отменено.");
            if (found.length) {
                core.remember?.(file, currentFm);
                return { file, path: file.path, id };
            }
            return append(file, id);
        }
        file = file || app.vault.getAbstractFileByPath(requestedPath);
        if (!file) throw new Error("Подборка сохранена, но Obsidian ещё не вернул её файл. Обновите страницу цитат.");
        core.remember?.(file, fm);
        return { file, path: file.path, id };
    });
}

module.exports = { normalizeSectionPath, ensureSectionFolders, saveQuote };
