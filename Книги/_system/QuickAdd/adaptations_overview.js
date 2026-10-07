module.exports = async ({ app, obsidian }) => {
    const { Notice, normalizePath } = obsidian;
    const coreFile = app.vault.getAbstractFileByPath("Книги/_system/book_core.js");
    if (!coreFile) { new Notice("Модуль библиотеки не найден."); return; }
    const coreModule = { exports: {} };
    new Function("module", await app.vault.read(coreFile))(coreModule);
    const core = coreModule.exports({ app, obsidian });
    const escape = value => String(value ?? "").replace(/\\/g, "\\\\").replace(/\|/g, "\\|").replace(/\r?\n/g, " ").trim();
    const list = value => (Array.isArray(value) ? value : [value]).map(item => String(item ?? "").trim()).filter(Boolean);
    const command = (label, choice, key, value) => {
        const uri = "obsidian://quickadd?choice=" + encodeURIComponent(choice) + (key ? "&value-" + key + "=" + encodeURIComponent(value).replace(/[!'()*]/g, char => "%" + char.charCodeAt(0).toString(16)) : "");
        return `[${escape(label)}](${uri})`;
    };
    const nav = [
        "[[Книги/_index|← Библиотека]]",
        command("👥 Авторы", "Книги - Авторы"),
        command("🧩 Серии", "Книги - Серии"),
        command("🎬 Экранизации", "Книги - Экранизации"),
        "[[Книги/Цитаты|✒️ Выписки]]",
        "[[Книги/_system/Проверка библиотеки|🔎 Проверка]]"
    ].join(" · ");
    const header = "---\ncssclasses:\n  - books-library\nobsidianUIMode: preview\n---\n\n";

    function isMedia(file) {
        if (!file || file.extension !== "md" || !file.path.startsWith("Кино/")) return false;
        if (["Кино/Просмотры/", "Кино/Сезоны/", "Кино/_system/"].some(prefix => file.path.startsWith(prefix))) return false;
        const tags = list(core.getFrontmatter(file).tags).map(value => value.replace(/^#/, ""));
        return tags.includes("movies") || tags.includes("serial");
    }
    function resolve(value, source) {
        const target = String(value ?? "").trim().replace(/^\[\[([^\]|]+)(?:\|[^\]]+)?\]\]$/, "$1").replace(/\.md$/i, "");
        if (!target) return null;
        const linked = app.metadataCache.getFirstLinkpathDest?.(target, source);
        return linked || app.vault.getAbstractFileByPath(normalizePath(target + ".md")) || app.vault.getAbstractFileByPath(normalizePath(target));
    }
    const rating = value => {
        const number = Number(value);
        return Number.isFinite(number) && number >= 1 && number <= 10 ? String(number) : "—";
    };
    const noteLink = (file, label) => `[[${file.path.replace(/\.md$/i, "")}\\|${escape(label || file.basename)}]]`;
    const rows = [];
    const linkedBooks = new Set();
    const linkedMedia = new Set();
    let unresolved = 0;
    for (const { file, fm } of core.snapshot()) {
        const seen = new Set();
        for (const link of list(fm.adaptations)) {
            const media = resolve(link, file.path);
            if (!media || !isMedia(media)) { unresolved++; continue; }
            if (seen.has(media.path)) continue;
            seen.add(media.path);
            const mediaFm = core.getFrontmatter(media);
            const serial = list(mediaFm.tags).some(value => value.replace(/^#/, "") === "serial");
            linkedBooks.add(file.path);
            linkedMedia.add(media.path);
            rows.push({ file, title: String(fm.title || file.basename), authors: list(fm.authors), bookRating: core.isFiction(file) ? rating(fm.rating) : "—", media, type: serial ? "📺 Сериал" : "🎬 Фильм", mediaRating: rating(mediaFm["Оценка"]) });
        }
    }
    rows.sort((a, b) => a.title.localeCompare(b.title, "ru") || a.media.basename.localeCompare(b.media.basename, "ru"));
    let text = header + "# 🎬 Экранизации\n\n" + nav + "\n\n" +
        `> [!info] Обзор\n> **Связей:** ${rows.length} · **Произведений:** ${linkedBooks.size} · **Экранизаций:** ${linkedMedia.size}\n\n`;
    if (unresolved) text += `> [!warning] Недоступные связи\n> Не удалось открыть ${unresolved} связей. Проверь пути к кино и отчёт проверки библиотеки.\n\n`;
    if (!rows.length) text += "_Связей книга ↔ кино пока нет. Связать произведение с кино можно из его карточки._\n";
    else {
        text += "| Произведение | Автор | Экранизация | Тип | Книга ⭐ | Кино ⭐ |\n| --- | --- | --- | --- | ---: | ---: |\n";
        for (const row of rows) {
            const authors = row.authors.map(author => command(author, "Книги - Открыть автора", "author", author)).join("<br>");
            text += `| ${noteLink(row.file, row.title)} | ${authors} | ${noteLink(row.media)} | ${row.type} | ${row.bookRating} | ${row.mediaRating} |\n`;
        }
    }
    const page = await core.writeIfChanged("Книги/_system/Экранизации.md", text);
    await app.workspace.getLeaf(false).openFile(page);
};
