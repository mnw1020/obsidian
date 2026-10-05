// Reading totals use history entries; month-only dates remain month-only.
const TYPE_LABELS = { book: "Книги", story: "Рассказы", lecture: "Лекции", article: "Статьи", other: "Другие" };
const MONTH_LABELS = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];

function availableYears(records) {
    const years = new Set();
    for (const record of records) {
        for (const entry of record.history || []) if (/^\d{4}(?:-|$)/.test(entry.date)) years.add(entry.date.slice(0, 4));
        for (const entry of record.excerpts || []) if (/^\d{4}-\d{2}-\d{2}$/.test(entry.savedDate || "")) years.add(entry.savedDate.slice(0, 4));
    }
    return [...years].sort((a, b) => b.localeCompare(a));
}

function buildDashboard(records, { now = new Date(), year = "", month = "" } = {}) {
    year = String(year ?? "");
    month = year ? String(month ?? "").padStart(2, "0").replace(/^00$/, "") : "";
    const period = month ? `${year}-${month}` : year;
    const readings = [], authors = new Map(), favorites = [], types = new Map(), years = new Map();
    const allReadings = [];
    let books = 0, ideas = 0, quotes = 0, reread = 0, imprecise = 0, invalidHistory = 0, undatedExcerpts = 0;
    for (const record of records) {
        const fm = record.fm;
        const names = [...new Set((Array.isArray(fm.authors) ? fm.authors : [fm.authors]).map(v => String(v ?? "").trim()).filter(Boolean))];
        const fullHistory = record.history || [];
        const history = period ? fullHistory.filter(entry => entry.date.startsWith(period)) : fullHistory;
        const fullExcerpts = record.excerpts || [];
        const excerpts = period ? fullExcerpts.filter(entry => entry.savedDate?.startsWith(period)) : fullExcerpts;
        const type = fm.work_type || "book";
        const kind = Object.hasOwn(TYPE_LABELS, type) ? type : "other";
        const title = String(fm.title || record.file.basename);
        if (record.historyError || record.error) invalidHistory++;
        undatedExcerpts += fullExcerpts.filter(entry => !entry.savedDate).length;
        const fiction = record.file.path.startsWith("Книги/Художественные/");
        for (const entry of fullHistory) {
            allReadings.push({ ...entry, file: record.file, title, authors: names, type: kind });
            const readingYear = entry.date.slice(0, 4);
            if (!years.has(readingYear)) years.set(readingYear, { year: readingYear, readings: 0, fiction: 0, nonfiction: 0 });
            const row = years.get(readingYear);
            row.readings++;
            row[fiction ? "fiction" : "nonfiction"]++;
        }
        if (year && !history.length && !excerpts.length) continue;
        books++;
        if (year ? history.some(entry => entry.number > 1) : history.length > 1) reread++;
        for (const excerpt of excerpts) excerpt.type === "idea" ? ideas++ : quotes++;
        const chronological = [...history].sort((a, b) => a.date.localeCompare(b.date) || a.number - b.number);
        const latestRating = [...chronological].reverse().find(entry => entry.rating !== null && entry.rating !== undefined)?.rating;
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
            if (entry.date.length < 10) imprecise++;
        }
    }
    const currentYear = now.getFullYear(), currentMonth = String(now.getMonth() + 1).padStart(2, "0");
    const monthKey = `${currentYear}-${currentMonth}`;
    const memoryMonth = month || currentMonth, memoryYear = year ? Number(year) : currentYear;
    return {
        books, authors: authors.size, readings: readings.length, reread, ideas, quotes, imprecise, invalidHistory, year, month, undatedExcerpts,
        readingRows: [...readings].sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title, "ru")),
        months: MONTH_LABELS.map((label, index) => ({ label, month: String(index + 1).padStart(2, "0"), count: readings.filter(entry => entry.date.slice(5, 7) === String(index + 1).padStart(2, "0")).length })),
        yearOnly: readings.filter(entry => entry.date.length === 4).length,
        currentMonth: allReadings.filter(entry => entry.date.startsWith(monthKey)).length,
        memoryMonth, memoryYear,
        earlierThisMonth: allReadings.filter(entry => entry.date.length >= 7 && Number(entry.date.slice(0, 4)) < memoryYear && entry.date.slice(5, 7) === memoryMonth)
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
    let selectedYear = mode === "home" ? String(new Date().getFullYear()) : "", selectedMonth = "", yearSelect, monthSelect;
    {
        const controls = element(root, "div", undefined, "book-knowledge-controls");
        const label = element(controls, "label", "Год ");
        yearSelect = element(label, "select");
        yearSelect.setAttribute("aria-label", "Год чтения");
        yearSelect.addEventListener("change", () => {
            selectedYear = yearSelect.value;
            if (!selectedYear) selectedMonth = "";
            if (monthSelect) { monthSelect.value = selectedMonth; monthSelect.disabled = !selectedYear; }
            draw();
        });
        if (mode === "home") {
            const monthLabel = element(controls, "label", "Месяц ");
            monthSelect = element(monthLabel, "select");
            monthSelect.setAttribute("aria-label", "Месяц чтения");
            element(monthSelect, "option", "Все месяцы").value = "";
            MONTH_LABELS.forEach((name, index) => { element(monthSelect, "option", name).value = String(index + 1).padStart(2, "0"); });
            monthSelect.addEventListener("change", () => { selectedMonth = monthSelect.value; draw(); });
        }
    }
    const content = element(root, "div");
    let disposed = false, timer, generation = 0, records = [];
    const file = app.vault.getAbstractFileByPath("Книги/_system/knowledge.js");
    if (!file) { status.textContent = "Не найден модуль библиотеки."; return; }
    const mod = { exports: {} };
    let service;
    try {
        new Function("module", await app.vault.read(file))(mod);
        service = await mod.exports.getService({ app, obsidian });
    } catch (error) { status.textContent = `Не удалось собрать итоги: ${error.message || error}`; return; }
    function draw() {
            const model = buildDashboard(records, { year: selectedYear, month: selectedMonth });
            content.replaceChildren();
            if (mode === "home") {
                status.textContent = selectedYear ? `${selectedMonth ? MONTH_LABELS[Number(selectedMonth) - 1] + " · " : ""}${selectedYear}` : "За всё время";
                if (model.invalidHistory) element(content, "p", `Не учтены повреждённые истории: ${model.invalidHistory}. Проверь библиотеку.`, "book-dashboard-warning");
                const metrics = element(content, "div", undefined, "book-dashboard-metrics");
                for (const [label, count] of [["Чтений за период", model.readings], ["Сохранено идей", model.ideas], ["Сохранено цитат", model.quotes]]) {
                    const metric = element(metrics, "div", undefined, "book-dashboard-metric");
                    element(metric, "strong", String(count));
                    element(metric, "span", label);
                }
                if (model.readings) {
                    element(content, "p", model.types.map(row => `${row.label}: ${row.count}`).join(" · "), "book-excerpt-meta");
                    if (selectedYear && !selectedMonth) {
                        const timeline = element(content, "div", undefined, "book-dashboard-months");
                        const max = Math.max(1, ...model.months.map(row => row.count));
                        for (const row of model.months) {
                            const button = element(timeline, "button", undefined, "book-dashboard-month");
                            button.setAttribute("aria-label", `${row.label}: ${row.count} чтений. Показать месяц`);
                            element(button, "span", row.label.slice(0, 3));
                            const bar = element(button, "span", undefined, "book-dashboard-month-bar");
                            bar.style.height = `${Math.round(row.count / max * 48)}px`;
                            element(button, "strong", String(row.count));
                            button.addEventListener("click", () => { selectedMonth = row.month; monthSelect.value = row.month; draw(); });
                        }
                        if (model.yearOnly) element(content, "p", `Ещё ${model.yearOnly} чтений записано только годом — без привязки к месяцу.`, "book-dashboard-warning");
                    }
                    element(content, "h4", "Прочитано за период");
                    const list = element(content, "ul");
                    for (const item of model.readingRows.slice(0, 8)) {
                        const row = element(list, "li");
                        link(row, item, app);
                        element(row, "span", ` · ${service.core.displayDate(item.date)}${item.number > 1 ? " · перечитывание" : ""}`);
                    }
                    if (model.readings > 8) element(content, "p", `Показаны последние 8 из ${model.readings} чтений.`, "book-excerpt-meta");
                } else element(content, "p", "За этот период чтения ещё не записаны.", "books-empty");
                if (selectedMonth) element(content, "p", "Чтения с датой только до года не входят в отдельный месяц.", "book-dashboard-warning");
                if (model.undatedExcerpts) element(content, "p", `Выписок без даты: ${model.undatedExcerpts}. ${selectedYear ? "В выбранный период они не включены." : "Они включены в общие итоги."}`, "book-dashboard-warning");
                element(content, "h4", `${selectedMonth ? "В выбранном месяце раньше" : "В этом месяце раньше"} · ${MONTH_LABELS[Number(model.memoryMonth) - 1].toLocaleLowerCase("ru")}`);
                if (!model.earlierThisMonth.length) element(content, "p", `До ${model.memoryYear} года в этом месяце чтения ещё не записаны.`, "books-empty");
                else {
                    const grouped = new Map();
                    for (const item of model.earlierThisMonth) {
                        const year = item.date.slice(0, 4);
                        if (!grouped.has(year)) grouped.set(year, []);
                        grouped.get(year).push(item);
                    }
                    for (const [year, items] of grouped) {
                        const group = element(content, "details", undefined, "book-dashboard-memory");
                        group.open = year === model.earlierThisMonth[0].date.slice(0, 4);
                        element(group, "summary", `${year} · чтений: ${items.length}`);
                        const list = element(group, "ul");
                        for (const item of items) {
                            const row = element(list, "li");
                            link(row, item, app);
                            element(row, "span", ` · ${service.core.displayDate(item.date)}${item.rating != null ? ` · ${item.rating}/10` : ""}${item.number > 1 ? " · перечитывание" : ""}`);
                        }
                    }
                }
                return;
            }
            status.textContent = `${selectedYear ? `За ${selectedYear}: ` : ""}${model.books} произведений · ${model.readings} чтений · ${model.authors} авторов · ${model.ideas} идей · ${model.quotes} цитат`;
            if (model.invalidHistory) element(content, "p", `Не учтены повреждённые истории: ${model.invalidHistory}. Проверь библиотеку; значения YAML не подставляются вместо истории.`, "book-dashboard-warning");
            const metrics = element(content, "div", undefined, "book-dashboard-metrics");
            for (const [label, count] of [[selectedYear ? `Чтений за ${selectedYear}` : "Чтений в этом месяце", selectedYear ? model.readings : model.currentMonth], [selectedYear ? "Перечитано в этом году" : "Перечитано произведений", model.reread], ["Любимых произведений (8–10)", model.favoriteBooks.length]]) {
                const metric = element(metrics, "div", undefined, "book-dashboard-metric");
                element(metric, "strong", String(count));
                element(metric, "span", label);
            }
            if (mode !== "home") {
                if (selectedYear) element(content, "p", "Произведения и авторы включены, если в этом году есть чтение или сохранённая выписка. Оценки и типы чтений учитываются только по истории выбранного года.");
                if (model.undatedExcerpts) element(content, "p", `Выписок без даты сохранения: ${model.undatedExcerpts}. Они входят в общие итоги, но не относятся к отдельному году автоматически.`);
                element(content, "h2", "История по годам");
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
    }
    async function reload() {
        const current = ++generation;
        try {
            const next = await service.snapshot();
            if (disposed || current !== generation) return;
            records = next;
            if (yearSelect) {
                const years = [...new Set([...availableYears(records), ...(mode === "home" ? [String(new Date().getFullYear())] : [])])].sort((a, b) => b.localeCompare(a));
                yearSelect.replaceChildren();
                element(yearSelect, "option", "За всё время").value = "";
                for (const year of years) element(yearSelect, "option", year).value = year;
                if (!years.includes(selectedYear)) selectedYear = "";
                yearSelect.value = selectedYear;
                if (monthSelect) { monthSelect.disabled = !selectedYear; monthSelect.value = selectedMonth; }
            }
            draw();
        } catch (error) { if (!disposed) status.textContent = `Не удалось собрать итоги: ${error.message || error}`; }
    }
    const unsubscribe = service.subscribe(() => { clearTimeout(timer); timer = setTimeout(reload, 200); });
    function dispose() { disposed = true; clearTimeout(timer); unsubscribe(); }
    dv.component?.register?.(dispose);
    await reload();
    return { reload, dispose };
}

module.exports = Object.assign(render, { buildDashboard, availableYears });
