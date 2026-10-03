// Explicit maintenance action; regular audit never changes book metadata.
module.exports = async params => {
    const file = params.app.vault.getAbstractFileByPath("Книги/_system/QuickAdd/audit_library.js");
    if (!file) throw new Error("Не найден скрипт проверки библиотеки.");
    const m = { exports: {} };
    new Function("module", await params.app.vault.read(file))(m);
    await m.exports({ ...params, variables: { ...params.variables, bookNormalize: true } });
};
