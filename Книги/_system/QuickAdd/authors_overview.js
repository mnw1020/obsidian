module.exports = async ({ app, obsidian }) => {
    const { Notice } = obsidian;
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
        "[[Книги/_system/Идеи и цитаты|✒️ Выписки]]",
        "[[Книги/_system/Проверка библиотеки|🔎 Проверка]]"
    ].join(" · ");
    const header = "---\ncssclasses:\n  - books-library\nobsidianUIMode: preview\n---\n\n";

    const books = core.snapshot();
    function aggregate(source) {
        const result = new Map();
        for (const { file, fm } of source) {
            for (const author of new Set(list(fm.authors))) {
                if (!result.has(author)) result.set(author, { author, count: 0, ratings: [], points: 0 });
                const item = result.get(author);
                item.count++;
                const rating = Number(fm.rating);
                if (core.isFiction(file) && Number.isFinite(rating) && rating >= 1 && rating <= 10) {
                    item.ratings.push(rating);
                    item.points += Math.max(0, rating - 5);
                }
            }
        }
        return [...result.values()].sort((a, b) => b.points - a.points || a.author.localeCompare(b.author, "ru"));
    }
    function section(title, source, ratings) {
        const items = aggregate(source);
        let text = `## ${title}\n\n`;
        if (!items.length) return text + "_Произведений пока нет._\n\n";
        text += ratings
            ? "| Автор | Произведений | ⭐ ср. | Любимые 8–10 | Баллы симпатии |\n| --- | ---: | ---: | ---: | ---: |\n"
            : "| Автор | Произведений |\n| --- | ---: |\n";
        for (const item of items) {
            const link = command(item.author, "Книги - Открыть автора", "author", item.author);
            if (!ratings) text += `| ${link} | ${item.count} |\n`;
            else {
                const average = item.ratings.length ? (item.ratings.reduce((sum, value) => sum + value, 0) / item.ratings.length).toFixed(1) : "—";
                text += `| ${link} | ${item.count} | ${average} | ${item.ratings.filter(value => value >= 8).length} | ${item.points} |\n`;
            }
        }
        return text + "\n";
    }
    const authors = new Set(books.flatMap(({ fm }) => list(fm.authors)));
    const text = header + "# 👥 Авторы\n\n" + nav + "\n\n" +
        `> [!info] Обзор\n> **Авторов:** ${authors.size} · **Произведений:** ${books.length}\n\n` +
        "Оценки учитываются только для художественных произведений. Баллы симпатии: сумма превышения оценки над 5. Нажми на автора, чтобы открыть его постоянную страницу и личные заметки.\n\n" +
        section("Художественные", books.filter(({ file }) => core.isFiction(file)), true) +
        section("Non-fiction", books.filter(({ file }) => !core.isFiction(file)), false);
    const page = await core.writeIfChanged("Книги/_system/Авторы.md", text);
    await app.workspace.getLeaf(false).openFile(page);
};
