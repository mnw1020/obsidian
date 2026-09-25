const ROOT = "Кино";
const EXCLUSION_PATH = `${ROOT}/_system/Исключения.md`;
const AUDIT_CHOICE = "Кино - Проверить кинотеку";

module.exports = async params => {
    const { app, obsidian } = params;
    const { Notice, normalizePath } = obsidian;
    const vars = params.variables || {};
    let targetPath = String(vars.path || vars["value-path"] || vars.entity || "").trim();
    targetPath = targetPath.replace(/^\[\[|\]\]$/g, "");
    if (targetPath && !targetPath.endsWith(".md")) targetPath += ".md";
    const action = String(vars.action || vars["value-action"] || "toggle").toLowerCase();

    if (!targetPath) {
        const candidates = app.vault.getMarkdownFiles()
            .filter(f => f.path.startsWith(`${ROOT}/`) && !f.path.slice(ROOT.length + 1).includes("/"));
        targetPath = await params.quickAddApi?.suggester?.(
            candidates.map(f => f.basename), candidates.map(f => f.path), "Выбери карточку для исключения");
        if (!targetPath) return;
    }
    if (!targetPath.startsWith(`${ROOT}/`) || targetPath.slice(ROOT.length + 1).includes("/")) {
        new Notice("Можно исключать только карточки фильмов и сериалов из корня папки Кино.", 7000);
        return;
    }

    const file = app.vault.getAbstractFileByPath(normalizePath(targetPath));
    if (!file || file.extension !== "md") {
        new Notice(`Карточка не найдена: ${targetPath}`, 7000);
        return;
    }
    const exclusionFile = app.vault.getAbstractFileByPath(normalizePath(EXCLUSION_PATH));
    let content = exclusionFile ? await app.vault.read(exclusionFile) :
        "# Исключения проверки кинотеки\n\nКарточки в этом списке аудит пропускает. Ссылка «вернуть» удаляет карточку из исключений.\n\n";
    const paths = new Set();
    for (const m of content.matchAll(/\[\[(Кино\/[^\]|]+)(?:\|[^\]]+)?\]\]/g)) {
        const p = m[1].endsWith(".md") ? m[1] : `${m[1]}.md`;
        paths.add(p);
    }
    const has = paths.has(targetPath);
    const exclude = action === "exclude" ? true : action === "include" ? false : !has;
    if (exclude) paths.add(targetPath); else paths.delete(targetPath);

    const choice = encodeURIComponent("Кино - Переключить исключение аудита");
    const lines = [...paths].sort((a,b) => a.localeCompare(b, "ru")).map(p => {
        const basename = p.split("/").pop().replace(/\.md$/i, "");
        const encoded = encodeURIComponent(p);
        const verb = paths.has(p) ? "include" : "exclude";
        return `- [[${p}|${basename}]] [\\[ ${verb === "include" ? "вернуть" : "исключить"} \\]](obsidian://quickadd?choice=${choice}&value-path=${encoded}&value-action=${verb})`;
    });
    const header = "# Исключения проверки кинотеки\n\nКарточки в этом списке аудит пропускает. Ссылка «вернуть» удаляет карточку из исключений.\n\n";
    const next = header + (lines.length ? lines.join("\n") + "\n" : "Список пуст.\n");
    if (exclusionFile) await app.vault.modify(exclusionFile, next);
    else await app.vault.create(normalizePath(EXCLUSION_PATH), next);

    new Notice(exclude ? `Исключено из проверки: ${file.basename}` : `Возвращено в проверку: ${file.basename}`, 5000);
    const report = app.vault.getAbstractFileByPath(normalizePath(`${ROOT}/_Проверка кинотеки.md`));
    const command = Object.values(app.commands?.commands || {}).find(c =>
        /Кино - Проверить кинотеку/i.test(String(c.name || c.id || "")));
    if (command?.id) app.commands.executeCommandById(command.id);
    else if (report) await app.workspace.getLeaf(false).openFile(report);
};
