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
        "[[Книги/Цитаты/_Идеи и цитаты|✒️ Выписки]]",
        "[[Книги/_system/Проверка библиотеки|🔎 Проверка]]"
    ].join(" · ");
    const header = "---\ncssclasses:\n  - books-library\nobsidianUIMode: preview\n---\n\n";

    const groups = new Map();
    let total = 0;
    let readTotal = 0;
    let ratedTotal = 0;
    function dateKey(value) {
        const text = String(value ?? "").trim();
        if (!core.isValidDate(text)) return "";
        return text.length === 4 ? text + "-00-00" : text.length === 7 ? text + "-00" : text;
    }
    for (const { file, fm } of core.snapshot()) {
        const name = String(fm.series ?? "").trim();
        if (!name) continue;
        if (!groups.has(name)) groups.set(name, { name, authors: new Set(), count: 0, read: 0, ratings: [], latest: null });
        const group = groups.get(name);
        group.count++;
        total++;
        for (const author of list(fm.authors)) group.authors.add(author);
        const read = Number(fm.read_count) > 0;
        if (read) { group.read++; readTotal++; }
        const rating = Number(fm.rating);
        if (core.isFiction(file) && Number.isFinite(rating) && rating >= 1 && rating <= 10) { group.ratings.push(rating); ratedTotal++; }
        const key = dateKey(fm.date);
        if (read && key && (!group.latest || key > group.latest.key || (key === group.latest.key && String(fm.title).localeCompare(group.latest.title, "ru") < 0))) {
            group.latest = { file, key, title: String(fm.title || file.basename), date: fm.date };
        }
    }
    let text = header + "# 🧩 Серии\n\n" + nav + "\n\n" +
        `> [!info] Обзор\n> **Серий:** ${groups.size} · **Произведений:** ${total} · **Прочитано:** ${readTotal} · **С оценкой:** ${ratedTotal}\n\n` +
        "Количество относится к карточкам в библиотеке, а не ко всем выпущенным частям. Средняя оценка — по оценённым художественным произведениям.\n\n";
    if (!groups.size) text += "_Серий пока нет._\n";
    else {
        text += "| Серия | Автор(ы) | В библиотеке | Прочитано | ⭐ ср. | Последнее чтение |\n| --- | --- | ---: | ---: | ---: | --- |\n";
        for (const group of [...groups.values()].sort((a, b) => a.name.localeCompare(b.name, "ru"))) {
            const series = command(group.name, "Книги - Открыть серию", "series", group.name);
            const authors = [...group.authors].sort((a, b) => a.localeCompare(b, "ru")).map(author => command(author, "Книги - Открыть автора", "author", author)).join("<br>");
            const average = group.ratings.length ? (group.ratings.reduce((sum, value) => sum + value, 0) / group.ratings.length).toFixed(1) : "—";
            const latest = group.latest ? `[[${group.latest.file.path.replace(/\.md$/i, "")}\\|${escape(group.latest.title + " · " + core.displayDate(group.latest.date))}]]` : "—";
            text += `| ${series} | ${authors} | ${group.count} | ${group.read} | ${average} | ${latest} |\n`;
        }
    }
    const page = await core.writeIfChanged("Книги/_system/Серии.md", text);
    await app.workspace.getLeaf(false).openFile(page);
};
