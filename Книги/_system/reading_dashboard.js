// Reading totals use history entries; month-only dates remain month-only.
const TYPE_LABELS = { book: "Книги", story: "Рассказы", lecture: "Лекции", article: "Статьи", other: "Другие" };

function buildDashboard(records, { now = new Date() } = {}) {
    const readings = [], authors = new Map(), favorites = [], types = new Map(), years = new Map();
    let ideas = 0, quotes = 0, reread = 0, imprecise = 0, invalidHistory = 0;
    for (const record of records) {
        const fm = record.fm;
        const names = [...new Set((Array.isArray(fm.authors) ? fm.authors : [fm.authors]).map(v => String(v ?? "").trim()).filter(Boolean))];
        const history = record.history || [];
        const type = fm.work_type || "book";
        const kind = Object.hasOwn(TYPE_LABELS, type) ? type : "other";
        const title = String(fm.title || record.file.basename);
        if (record.historyError || record.error) invalidHistory++;
        if (history.length > 1) reread++;
        for (const excerpt of record.excerpts || []) excerpt.type === "idea" ? ideas++ : quotes++;
        const chronological = [...history].sort((a, b) => a.date.localeCompare(b.date) || a.number - b.number);
        const latestRating = [...chronological].reverse().find(entry => entry.rating !== null && entry.rating !== undefined)?.rating;
        const fiction = record.file.path.startsWith("Книги/Художественные/");
        if (fiction && Number(latestRating) >= 8 && Number(latestRating) <= 10) favorites.push({ file: record.file, title, authors: names, rating: Number(latestRating) });
        for (const author of names) {
            if (!authors.has(author)) authors.set(author, { name: author, books: 0, readings: 0, ratings: [] });
            const row = authors.get(author);
            row.books++;
            row.readings += history.length;
            if (fiction && Number(latestRating) >= 1 && Number(latestRating) <= 10) row.ratings.push(Number(latestRating));
        }
        for (const entry of history) {
            const reading = { ...entry, file: record.file, title, authors: names, type: kind };
            readings.push(reading);
            types.set(kind, (types.get(kind) || 0) + 1);
            const year = entry.date.slice(0, 4);
            if (!years.has(year)) years.set(year, { year, readings: 0, fiction: 0, nonfiction: 0 });
            const row = years.get(year);
            row.readings++;
            row[fiction ? "fiction" : "nonfiction"]++;
            if (entry.date.length < 10) imprecise++;
        }
    }
    const currentYear = now.getFullYear(), currentMonth = String(now.getMonth() + 1).padStart(2, "0");
    const monthKey = `${currentYear}-${currentMonth}`;
    return {
        books: records.length, authors: authors.size, readings: readings.length, reread, ideas, quotes, imprecise, invalidHistory,
        currentMonth: readings.filter(entry => entry.date.startsWith(monthKey)).length,
        earlierThisMonth: readings.filter(entry => entry.date.length >= 7 && Number(entry.date.slice(0, 4)) < currentYear && entry.date.slice(5, 7) === currentMonth)
            .sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title, "ru")),
        types: [...types].map(([type, count]) => ({ type, label: TYPE_LABELS[type], count })),
        years: [...years.values()].sort((a, b) => b.year.localeCompare(a.year)),
        favoriteBooks: favorites.sort((a, b) => b.rating - a.rating || a.title.localeCompare(b.title, "ru")),
        authorRows: [...authors.values()].map(row => ({ ...row, average: row.ratings.length ? row.ratings.reduce((sum, n) => sum + n, 0) / row.ratings.length : null }))
            .sort((a, b) => b.readings - a.readings || b.books - a.books || a.name.localeCompare(b.name, "ru"))
    };
}

function element(parent, tag, text, cls) {
    const el = parent.ownerDocument.createElement(tag);
    if (text !== undefined) el.textContent = text;
    if (cls) el.className = cls;
    parent.appendChild(el);
    return el;
}

function link(parent, item, app, label = item.title) {
    const target = item.file.path.replace(/\.md$/i, "");
    const anchor = element(parent, "a", label, "internal-link");
    anchor.href = target;
    anchor.setAttribute("data-href", target);
    anchor.addEventListener("click", event => {
        event.preventDefault();
        if (app.vault.getAbstractFileByPath(item.file.path)) app.workspace.openLinkText(target, item.file.path, event.ctrlKey || event.metaKey);
        else anchor.textContent = "Карточка больше не доступна";
    });
}

function table(parent, headings, rows) {
    const wrapper = element(parent, "div", undefined, "book-dashboard-table");
    const tab = element(wrapper, "table");
    const tr = element(element(tab, "thead"), "tr");
    for (const heading of headings) element(tr, "th", heading);
    const body = element(tab, "tbody");
    for (const cells of rows) {
        const row = element(body, "tr");
        for (const value of cells) {
            const cell = element(row, "td");
            if (typeof value === "function") value(cell);
            else cell.textContent = String(value);
        }
    }
}

async function render({ dv, app, obsidian, mode = "index" }) {
    const root = element(dv.container, "div", undefined, "book-reading-dashboard");
    const status = element(root, "p", "Считаю историю чтений…");
    const content = element(root, "div");
    let disposed = false, timer, generation = 0;
    const file = app.vault.getAbstractFileByPath("Книги/_system/knowledge.js");
    if (!file) { status.textContent = "Не найден модуль библиотеки."; return; }
    const mod = { exports: {} };
    new Function("module", await app.vault.read(file))(mod);
    const service = await mod.exports.getService({ app, obsidian });
    async function reload() {
        const current = ++generation;
        try {
            const records = await service.snapshot();
            if (disposed || current !== generation) return;
            const model = buildDashboard(records);
            content.replaceChildren();
            status.textContent = `${model.books} произведений · ${model.readings} чтений · ${model.authors} авторов · ${model.ideas} идей · ${model.quotes} цитат`;
            if (model.invalidHistory) element(content, "p", `Не учтены повреждённые истории: ${model.invalidHistory}. Проверь библиотеку; значения YAML не подставляются вместо истории.`, "book-dashboard-warning");
            const metrics = element(content, "div", undefined, "book-dashboard-metrics");
            for (const [label, count] of [["Чтений в этом месяце", model.currentMonth], ["Перечитано произведений", model.reread], ["Любимых произведений (8–10)", model.favoriteBooks.length]]) {
                const metric = element(metrics, "div", undefined, "book-dashboard-metric");
                element(metric, "strong", String(count));
                element(metric, "span", label);
            }
            if (mode !== "home") {
                element(content, "h2", "По годам");
                table(content, ["Год", "Чтений", "Художественных", "Non-fiction"], model.years.map(row => [row.year, row.readings, row.fiction, row.nonfiction]));
                if (model.imprecise) element(content, "p", `Чтений с датой до месяца или года: ${model.imprecise}. Отсутствующие дни не восстанавливаются.`);
                element(content, "h2", "Что читалось");
                table(content, ["Тип", "Чтений"], model.types.map(row => [row.label, row.count]));
                element(content, "h2", "Авторы");
                table(content, ["Автор", "Произведений", "Чтений", "Средняя оценка fiction"], model.authorRows.map(row => [row.name, row.books, row.readings, row.average === null ? "—" : row.average.toFixed(1)]));
                element(content, "h2", "Любимые произведения");
                if (model.favoriteBooks.length) table(content, ["Произведение", "Автор", "Оценка"], model.favoriteBooks.map(item => [cell => link(cell, item, app), item.authors.join(", "), item.rating]));
                else element(content, "p", "Пока нет оценок 8–10 в истории художественных произведений.");
            }
            element(content, mode === "home" ? "h4" : "h2", "В этом месяце раньше");
            if (!model.earlierThisMonth.length) element(content, "p", "В прошлые годы в этом месяце чтения ещё не записаны.");
            else {
                const list = element(content, "ul");
                for (const item of model.earlierThisMonth.slice(0, mode === "home" ? 5 : model.earlierThisMonth.length)) {
                    const row = element(list, "li");
                    link(row, item, app);
                    element(row, "span", ` · ${service.core.displayDate(item.date)}`);
                }
            }
        } catch (error) { if (!disposed) status.textContent = `Не удалось собрать итоги: ${error.message || error}`; }
    }
    const unsubscribe = service.subscribe(() => { clearTimeout(timer); timer = setTimeout(reload, 200); });
    function dispose() { disposed = true; clearTimeout(timer); unsubscribe(); }
    dv.component?.register?.(dispose);
    await reload();
    return { reload, dispose };
}

module.exports = Object.assign(render, { buildDashboard });
