module.exports = async ({ app, obsidian }) => {
    const coreFile = app.vault.getAbstractFileByPath("Книги/_system/book_core.js");
    const layoutFile = app.vault.getAbstractFileByPath("Книги/_system/series_pages.js");
    if (!coreFile || !layoutFile) { new obsidian.Notice("Модуль страниц серий не найден."); return; }
    const coreModule = { exports: {} }, layoutModule = { exports: {} };
    new Function("module", await app.vault.read(coreFile))(coreModule);
    new Function("module", await app.vault.read(layoutFile))(layoutModule);
    const core = coreModule.exports({ app, obsidian });
    const path = "Книги/_system/Серии.md";
    let page = app.vault.getAbstractFileByPath(path);
    if (page) {
        const raw = await app.vault.read(page);
        if (layoutModule.exports.mergeOverview(raw) !== raw) await app.vault.process(page, layoutModule.exports.mergeOverview);
    } else page = await core.writeIfChanged(path, layoutModule.exports.overviewPage());
    await core.refreshFrontmatter?.(page);
    await app.workspace.getLeaf(false).openFile(page);
};
