module.exports = async ({ app, quickAddApi, obsidian }) => {
    try {
        const file = app.vault.getAbstractFileByPath("Книги/_system/quote_add.js");
        if (!file) throw new Error("Не найден модуль создания цитат.");
        const module = { exports: {} };
        new Function("module", await app.vault.read(file))(module);
        return await module.exports({ app, quickAddApi, obsidian });
    } catch (error) { if (obsidian?.Notice) new obsidian.Notice(error.message || String(error), 7000); }
};
