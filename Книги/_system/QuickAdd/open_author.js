module.exports = async (params) => {
    const { app, quickAddApi, obsidian, variables = {} } = params;
    const { Notice, normalizePath } = obsidian;
    const coreFile = app.vault.getAbstractFileByPath("Книги/_system/book_core.js");
    if (!coreFile) { new Notice("Модуль библиотеки не найден."); return; }
    const coreModule = { exports: {} };
    new Function("module", await app.vault.read(coreFile))(coreModule);
    const core = coreModule.exports({ app, obsidian });
    const authorsOf = fm => [...new Set((Array.isArray(fm.authors) ? fm.authors : [fm.authors]).map(value => String(value ?? "").trim()).filter(Boolean))];

    let author = String(variables.author ?? "").trim();
    if (!author) {
        const active = app.workspace.getActiveFile();
        if (core.isBook(active)) {
            const current = authorsOf(core.getFrontmatter(active));
            author = current.length === 1 ? current[0] : await quickAddApi.suggester(current, current, "Автор этого произведения");
            if (!author) return;
        } else {
            author = String(core.getFrontmatter(active)?.selected_author ?? "").trim();
        }
    }
    if (!author) {
        const names = [...new Set(core.snapshot().flatMap(({ fm }) => authorsOf(fm)))].sort((a, b) => a.localeCompare(b, "ru"));
        if (!names.length) { new Notice("Авторы не найдены."); return; }
        author = await quickAddApi.suggester(names, names, "Выбери автора");
        if (!author) return;
    }

    function entityName(value) {
        let hash = 2166136261;
        for (const char of value) { hash ^= char.charCodeAt(0); hash = Math.imul(hash, 16777619); }
        const safe = value.replace(/[\\/:*?"<>|\x00-\x1f]/g, "-").replace(/[. ]+$/g, "").slice(0, 96).trim() || "Автор";
        return `${safe}-${(hash >>> 0).toString(16).padStart(8, "0")}`;
    }
    const folder = "Книги/_system/Авторы";
    if (!app.vault.getAbstractFileByPath(folder)) await app.vault.createFolder(folder);
    const pagePath = normalizePath(`${folder}/${entityName(author)}.md`);
    const books = core.snapshot().filter(({ fm }) => authorsOf(fm).includes(author));
    const rated = books.filter(({ file }) => core.isFiction(file)).map(({ fm }) => Number(fm.rating)).filter(value => Number.isFinite(value) && value >= 1 && value <= 10);
    const average = rated.length ? (rated.reduce((sum, value) => sum + value, 0) / rated.length).toFixed(1) : "—";
    const favorites = rated.filter(value => value >= 8).length;
    const points = rated.reduce((sum, value) => sum + Math.max(0, value - 5), 0);
    const choice = name => `obsidian://quickadd?choice=${encodeURIComponent(name)}`;
    const generated = [
        "<!-- BOOK-AUTHOR-GENERATED:START -->",
        `# 👤 ${author.replace(/\r?\n/g, " ")}`,
        "",
        `[[Книги/_index|← Библиотека]] · [👥 Все авторы](${choice("Книги - Авторы")}) · [🧩 Серии](${choice("Книги - Серии")}) · [[Книги/_system/Идеи и цитаты|✒️ Выписки]]`,
        "",
        `[➕ Записать произведение](${choice("Книги - Добавить книгу")})`,
        "",
        "> [!abstract] Произведения и впечатления",
        `> **Произведений:** ${books.length} · **Средняя оценка:** ${average} · **Оценено:** ${rated.length} · **Любимые 8–10:** ${favorites} · **Баллы симпатии:** ${points}`,
        "",
        "Оценки — только для художественных произведений. Баллы симпатии: сумма превышения оценки над 5.",
        "",
        "![[Книги/Книги.base#Автор]]",
        "<!-- BOOK-AUTHOR-GENERATED:END -->"
    ].join("\n");
    const existing = app.vault.getAbstractFileByPath(pagePath);
    let content;
    if (existing) {
        content = await app.vault.read(existing);
        const region = /<!-- BOOK-AUTHOR-GENERATED:START -->[\s\S]*?<!-- BOOK-AUTHOR-GENERATED:END -->/;
        content = region.test(content) ? content.replace(region, () => generated) : content.replace(/\s*$/, "\n\n") + generated + "\n";
    } else {
        content = `---\nselected_author: ${JSON.stringify(author)}\ncssclasses:\n  - books-entity\nobsidianUIMode: preview\n---\n\n${generated}\n\n## Мои заметки\n\n`;
    }
    const page = await core.writeIfChanged(pagePath, content);
    await core.refreshFrontmatter?.(page);
    await app.workspace.getLeaf(false).openFile(page);
};
