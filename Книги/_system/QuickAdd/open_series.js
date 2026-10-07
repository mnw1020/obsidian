module.exports = async (params) => {
    const { app, quickAddApi, obsidian, variables = {} } = params;
    const { Notice, normalizePath } = obsidian;
    const coreFile = app.vault.getAbstractFileByPath("Книги/_system/book_core.js");
    if (!coreFile) { new Notice("Модуль библиотеки не найден."); return; }
    const coreModule = { exports: {} };
    new Function("module", await app.vault.read(coreFile))(coreModule);
    const core = coreModule.exports({ app, obsidian });

    let series = String(variables.series ?? "").trim();
    if (!series) {
        const active = app.workspace.getActiveFile();
        if (core.isBook(active)) {
            series = String(core.getFrontmatter(active).series ?? "").trim();
            if (!series) { new Notice("У этого произведения серия не указана."); return; }
        } else {
            series = String(core.getFrontmatter(active)?.selected_series ?? "").trim();
        }
    }
    if (!series) {
        const names = [...new Set(core.snapshot().map(({ fm }) => String(fm.series ?? "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ru"));
        if (!names.length) { new Notice("Серии не найдены."); return; }
        series = await quickAddApi.suggester(names, names, "Выбери серию");
        if (!series) return;
    }

    function entityName(value) {
        let hash = 2166136261;
        for (const char of value) { hash ^= char.charCodeAt(0); hash = Math.imul(hash, 16777619); }
        const safe = value.replace(/[\\/:*?"<>|\x00-\x1f]/g, "-").replace(/[. ]+$/g, "").slice(0, 96).trim() || "Серия";
        return `${safe}-${(hash >>> 0).toString(16).padStart(8, "0")}`;
    }
    const folder = "Книги/_system/Серии";
    if (!app.vault.getAbstractFileByPath(folder)) await app.vault.createFolder(folder);
    const pagePath = normalizePath(`${folder}/${entityName(series)}.md`);
    const books = core.snapshot().filter(({ fm }) => String(fm.series ?? "").trim() === series);
    const read = books.filter(({ fm }) => Number(fm.read_count) > 0).length;
    const choice = name => `obsidian://quickadd?choice=${encodeURIComponent(name)}`;
    const generated = [
        "<!-- BOOK-SERIES-GENERATED:START -->",
        `# 🧩 ${series.replace(/\r?\n/g, " ")}`,
        "",
        `[[Книги/_index|← Библиотека]] · [🧩 Все серии](${choice("Книги - Серии")}) · [👥 Авторы](${choice("Книги - Авторы")}) · [[Книги/Цитаты|✒️ Выписки]]`,
        "",
        `[➕ Записать произведение в серии](${choice("Книги - Добавить книгу")})`,
        "",
        "> [!info] В библиотеке",
        `> **Произведений:** ${books.length} · **Прочитано:** ${read}`,
        "",
        "Счётчик относится к карточкам в библиотеке, а не ко всем выпущенным частям серии.",
        "",
        "![[Книги/_system/_Книги.base#Серия]]",
        "<!-- BOOK-SERIES-GENERATED:END -->"
    ].join("\n");
    const existing = app.vault.getAbstractFileByPath(pagePath);
    let page;
    if (existing) {
        const region = /<!-- BOOK-SERIES-GENERATED:START -->[\s\S]*?<!-- BOOK-SERIES-GENERATED:END -->/;
        const merge = content => region.test(content) ? content.replace(region, () => generated) : content.replace(/\s*$/, "\n\n") + generated + "\n";
        const original = await app.vault.read(existing);
        // Merge against the newest text inside the atomic Vault callback.
        if (merge(original) !== original) await app.vault.process(existing, merge);
        page = existing;
    } else {
        const content = `---\nselected_series: ${JSON.stringify(series)}\ncssclasses:\n  - books-entity\nobsidianUIMode: preview\n---\n\n${generated}\n\n## Мои заметки\n\n`;
        page = await core.writeIfChanged(pagePath, content);
    }
    await core.refreshFrontmatter?.(page);
    await app.workspace.getLeaf(false).openFile(page);
};
