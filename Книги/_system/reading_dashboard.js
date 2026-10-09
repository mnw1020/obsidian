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
    const readings = [], authors = new Map(), favorites = [], types = new Map(), years = new Map(), fictionTypes = new Map(), nonfictionTypes = new Map();
    const allReadings = [];
    let books = 0, quotes = 0, reread = 0, imprecise = 0, invalidHistory = 0, undatedExcerpts = 0, fictionReadings = 0, nonfictionReadings = 0;
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
        if (!record.collection && (record.historyError || record.error)) invalidHistory++;
        undatedExcerpts += fullExcerpts.filter(entry => !entry.savedDate).length;
        if (record.collection) {
            quotes += excerpts.length;
            continue;
        }
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
        quotes += excerpts.length;
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
            if (fiction) { fictionReadings++; fictionTypes.set(kind, (fictionTypes.get(kind) || 0) + 1); }
            else { nonfictionReadings++; nonfictionTypes.set(kind, (nonfictionTypes.get(kind) || 0) + 1); }
            if (entry.date.length < 10) imprecise++;
        }
    }
    const currentYear = now.getFullYear(), currentMonth = String(now.getMonth() + 1).padStart(2, "0");
    const monthKey = `${currentYear}-${currentMonth}`;
    const memoryMonth = month || currentMonth, memoryYear = year ? Number(year) : currentYear;
    return {
        books, authors: authors.size, readings: readings.length, reread, ideas: 0, quotes, imprecise, invalidHistory, year, month, undatedExcerpts,
        fictionReadings, nonfictionReadings,
        fictionTypes: Object.entries(TYPE_LABELS).filter(([type]) => fictionTypes.has(type)).map(([type, label]) => ({ type, label, count: fictionTypes.get(type) })),
        nonfictionTypes: Object.entries(TYPE_LABELS).filter(([type]) => nonfictionTypes.has(type)).map(([type, label]) => ({ type, label, count: nonfictionTypes.get(type) })),
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
    const home = mode === "home", now = new Date();
    const currentYear = String(now.getFullYear()), currentMonth = String(now.getMonth() + 1).padStart(2, "0");
    let disposed = false, timer, generation = 0, records = [], signature = null, unsubscribe = () => {};
    const component = dv.component, stateKey = "__bookReadingDashboard";
    let view = !home && component?.[stateKey];
    if (!home && !view && typeof component?.render === "function") {
        const original = component.render, container = dv.container;
        view = { root: null, dispose: null, year: "", month: "" };
        const state = view;
        const wrapped = function (...args) {
            // The service updates this view in place; avoid Dataview clearing it.
            if (state.root?.parentNode === container) return Promise.resolve();
            return original.apply(this, args);
        };
        component[stateKey] = state;
        component.render = wrapped;
        component.register(() => {
            state.unloaded = true;
            state.dispose?.();
            if (component.render === wrapped) component.render = original;
            delete component[stateKey];
        });
    }
    view?.dispose?.();
    const collapsed = view ? (view.collapsed ||= {}) : {};
    const sectionIdPrefix = "book-reading-" + Math.random().toString(36).slice(2, 10);
    const root = element(dv.container, "div", undefined, `book-reading-dashboard${home ? "" : " is-index"}`);
    if (view) { view.root = root; view.dispose = dispose; }
    else component?.register?.(dispose);
    if (view?.unloaded) dispose();
    if (disposed) return { dispose };
    const stylesheet = app.vault.getAbstractFileByPath("Книги/_system/reading-dashboard.css");
    if (stylesheet) element(root, "style", await app.vault.read(stylesheet));
    if (disposed) return { dispose };
    let masthead = root, summary;
    if (!home) {
        masthead = element(root, "header", undefined, "book-dashboard-masthead");
        const nav = element(masthead, "nav", undefined, "book-dashboard-nav");
        nav.setAttribute("aria-label", "Навигация библиотеки");
        for (const [title, path] of [["← Библиотека", "Книги/_index.md"], ["Цитаты", "Книги/Цитаты.md"], ["Стихи", "Книги/Стихи.md"]]) {
            link(nav, { file: { path } }, app, title);
        }
        element(masthead, "h1", "Итоги чтения", "book-dashboard-title");
        element(masthead, "p", "История чтений, произведения и впечатления", "book-dashboard-subtitle");
    }
    let selectedYear = home ? currentYear : view?.year || "", selectedMonth = home ? "" : view?.month || "", yearSelect, monthSelect, resetMonth;
    if (!home) {
        const controls = element(masthead, "div", undefined, "book-knowledge-controls book-dashboard-controls");
        yearSelect = element(element(controls, "label", "Год "), "select");
        yearSelect.setAttribute("aria-label", "Год чтения");
        monthSelect = element(element(controls, "label", "Месяц "), "select");
        monthSelect.setAttribute("aria-label", "Месяц чтения");
        element(monthSelect, "option", "Все месяцы").value = "";
        MONTH_LABELS.forEach((name, index) => { element(monthSelect, "option", name).value = String(index + 1).padStart(2, "0"); });
        yearSelect.addEventListener("change", () => setPeriod(yearSelect.value, selectedMonth));
        monthSelect.addEventListener("change", () => setPeriod(selectedYear, monthSelect.value));
        const thisMonth = element(controls, "button", "Этот месяц");
        thisMonth.addEventListener("click", () => setPeriod(currentYear, currentMonth));
        resetMonth = element(controls, "button", "Сбросить месяц");
        resetMonth.addEventListener("click", () => setPeriod(selectedYear, ""));
        const reset = element(controls, "button", "За всё время");
        reset.addEventListener("click", () => setPeriod("", ""));
    }
    const status = element(masthead, "p", "Считаю историю чтений…", "book-dashboard-period");
    status.setAttribute("role", "status");
    if (!home) summary = element(masthead, "div", undefined, "book-dashboard-summary");
    const content = element(root, "div", undefined, "book-dashboard-content");
    if (!home) {
        const footer = element(root, "footer", undefined, "book-dashboard-footer");
        for (const [title, path] of [["Проверка библиотеки", "Книги/_system/Проверка библиотеки.md"], ["Журнал изменений", "Книги/_system/Журнал изменений.md"]]) {
            link(footer, { file: { path } }, app, title);
        }
    }
    const file = app.vault.getAbstractFileByPath("Книги/_system/knowledge.js");
    if (!file) { status.textContent = "Не найден модуль библиотеки."; return; }
    const mod = { exports: {} };
    let service;
    try {
        new Function("module", await app.vault.read(file))(mod);
        if (disposed) return { dispose };
        service = await mod.exports.getService({ app, obsidian });
        if (disposed) return { dispose };
    } catch (error) { status.textContent = `Не удалось собрать итоги: ${error.message || error}`; return; }
    function setPeriod(year, month) {
        selectedYear = year;
        selectedMonth = year ? month : "";
        if (view) { view.year = selectedYear; view.month = selectedMonth; }
        if (yearSelect) {
            yearSelect.value = selectedYear;
            monthSelect.value = selectedMonth;
            monthSelect.disabled = !selectedYear;
            resetMonth.disabled = !selectedMonth;
        }
        draw();
    }
    function metrics(parent, rows) {
        const grid = element(parent, "div", undefined, "book-dashboard-metrics");
        for (const [label, count] of rows) {
            const metric = element(grid, "div", undefined, "book-dashboard-metric");
            element(metric, "strong", String(count));
            element(metric, "span", label);
        }
    }
    function panel(title, parent = content, kind = "") {
        const panel = element(parent, "section", undefined, `book-dashboard-section${kind ? " is-" + kind : ""}`);
        const heading = element(panel, home ? "h4" : "h2", home ? title : undefined);
        if (home) return { panel, heading, body: panel };
        panel.setAttribute("data-block", kind);
        const toggle = element(heading, "button", undefined, "book-dashboard-section-toggle");
        toggle.type = "button";
        element(toggle, "span", title, "book-dashboard-section-title");
        element(toggle, "span", undefined, "book-dashboard-section-chevron").setAttribute("aria-hidden", "true");
        const body = element(panel, "div", undefined, "book-dashboard-section-body");
        const id = `${sectionIdPrefix}-${kind}`;
        body.setAttribute("id", id);
        toggle.setAttribute("aria-controls", id);
        function update() {
            body.hidden = Boolean(collapsed[kind]);
            panel.setAttribute("data-collapsed", String(body.hidden));
            toggle.setAttribute("aria-expanded", String(!body.hidden));
            toggle.title = body.hidden ? "Развернуть блок" : "Свернуть блок";
        }
        toggle.addEventListener("click", () => { collapsed[kind] = !body.hidden; update(); });
        update();
        return { panel, heading, body };
    }
    function section(title, parent = content, kind = "") { return panel(title, parent, kind).body; }
    function breakdown(parent, model, title = "") {
        const groups = [["fiction", "Художественная", model.fictionReadings, model.fictionTypes], ["nonfiction", "Нон-фикшн", model.nonfictionReadings, model.nonfictionTypes]]
            .filter(([, , count]) => count > 0);
        if (!groups.length) return;
        const panel = element(parent, "section", undefined, "book-dashboard-breakdown-period");
        panel.setAttribute("data-period", model.year ? model.year + (model.month ? "-" + model.month : "") : "all");
        if (title) element(panel, home ? "h4" : "h3", title, "book-dashboard-breakdown-title");
        const body = element(panel, "div", undefined, "book-dashboard-breakdown-groups");
        for (const [genre, label, count, types] of groups) {
            const group = element(body, "section", undefined, "book-dashboard-breakdown-genre");
            group.setAttribute("data-genre", genre);
            const head = element(group, "div", undefined, "book-dashboard-breakdown-head");
            element(head, home ? "h5" : "h3", label, "book-dashboard-breakdown-label");
            element(head, "strong", String(count), "book-dashboard-breakdown-total");
            const list = element(group, "dl", undefined, "book-dashboard-breakdown-types");
            for (const row of types.filter(row => row.count > 0)) {
                const item = element(list, "div", undefined, "book-dashboard-breakdown-type");
                item.setAttribute("data-type", row.type);
                element(item, "dt", row.label);
                element(item, "dd", String(row.count), "book-dashboard-breakdown-count");
            }
        }
    }
    function memories(model) {
        const name = MONTH_LABELS[Number(model.memoryMonth) - 1].toLocaleLowerCase("ru");
        const card = panel(selectedMonth ? "В выбранном месяце раньше · " : "В этом месяце раньше · " + name, content, home ? "" : "memories");
        const { heading, body } = card;
        if (selectedMonth && !home) {
            const button = element(heading, "button", `${name} ×`, "book-dashboard-month-reset");
            button.setAttribute("aria-label", `Сбросить месяц: ${name}`);
            button.title = "Показать весь год";
            button.addEventListener("click", () => setPeriod(selectedYear, ""));
        }
        if (!model.earlierThisMonth.length) {
            element(body, "p", `До ${model.memoryYear} года в этом месяце чтения ещё не записаны.`, "books-empty");
            return;
        }
        if (home) {
            const list = element(body, "ul", undefined, "book-dashboard-reading-list");
            for (const item of model.earlierThisMonth.slice(0, 5)) {
                const row = element(list, "li");
                link(row, item, app);
                element(row, "span", ` · ${service.core.displayDate(item.date)}`);
            }
            return;
        }
        element(body, "p", `Чтения за этот месяц до ${model.memoryYear} года.`, "book-excerpt-meta");
        const grouped = new Map();
        for (const item of model.earlierThisMonth) {
            const year = item.date.slice(0, 4);
            if (!grouped.has(year)) grouped.set(year, []);
            grouped.get(year).push(item);
        }
        for (const [year, items] of grouped) {
            const group = element(body, "details", undefined, "book-dashboard-memory");
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
    function draw() {
        const model = buildDashboard(records, { now, year: selectedYear, month: selectedMonth });
        content.replaceChildren();
        status.textContent = home ? "Текущий месяц и год" : selectedYear ? `${selectedMonth ? MONTH_LABELS[Number(selectedMonth) - 1] + " · " : ""}${selectedYear}` : "За всё время";
        if (model.invalidHistory) element(content, "p", `Не учтены повреждённые истории: ${model.invalidHistory}. Проверь библиотеку.`, "book-dashboard-warning");
        if (home) {
            const month = buildDashboard(records, { now, year: currentYear, month: currentMonth });
            metrics(content, [["Чтений в этом месяце", month.readings], ["Чтений в этом году", model.readings], ["Цитат в этом месяце", month.quotes]]);
            if (month.readings || model.readings) {
                const breakdowns = element(content, "div", undefined, "book-dashboard-breakdowns");
                breakdown(breakdowns, month, `В этом месяце · ${MONTH_LABELS[Number(currentMonth) - 1].toLocaleLowerCase("ru")}`);
                breakdown(breakdowns, model, `В этом году · ${currentYear}`);
            }
            memories(model);
            return;
        }
        summary.replaceChildren();
        metrics(summary, [["Чтений за период", model.readings], ["Произведений", model.books], ["Авторов", model.authors], ["Перечитано произведений", model.reread], ["Сохранено цитат", model.quotes]]);
        const overview = element(content, "div", undefined, "book-dashboard-overview");
        const activity = section(selectedYear ? `Активность · ${selectedYear}` : "История по годам", overview, "activity");
        if (selectedYear) {
            const previousYear = String(Number(selectedYear) - 1);
            const previous = buildDashboard(records, { now, year: previousYear, month: selectedMonth });
            const diff = model.readings - previous.readings;
            element(activity, "p", `${selectedMonth ? MONTH_LABELS[Number(selectedMonth) - 1] + " " : ""}${previousYear}: ${previous.readings} чтений · ${diff > 0 ? "+" : ""}${diff} к этому периоду.`, "book-dashboard-comparison");
        }
        if (selectedYear) {
            const annual = buildDashboard(records, { now, year: selectedYear });
            const timeline = element(activity, "div", undefined, "book-dashboard-months");
            const max = Math.max(1, ...annual.months.map(row => row.count));
            for (const row of annual.months) {
                const active = selectedMonth === row.month;
                const button = element(timeline, "button", undefined, `book-dashboard-month${active ? " is-selected" : ""}`);
                button.setAttribute("aria-label", `${row.label}: ${row.count} чтений. ${active ? "Сбросить месяц" : "Показать месяц"}`);
                button.setAttribute("aria-pressed", String(active));
                element(button, "span", row.label.slice(0, 3));
                const bar = element(button, "span", undefined, "book-dashboard-month-bar");
                bar.style.height = `${Math.round(row.count / max * 48)}px`;
                element(button, "strong", String(row.count));
                button.addEventListener("click", () => setPeriod(selectedYear, active ? "" : row.month));
            }
            element(activity, "p", "Нажми месяц для подробностей; повторное нажатие вернёт весь год.", "book-excerpt-meta");
            if (annual.yearOnly) element(activity, "p", `Ещё ${annual.yearOnly} чтений записано только годом — без привязки к месяцу.`, "book-dashboard-warning");
            const history = element(activity, "details");
            element(history, "summary", "Все годы");
            yearHistory(history, model);
        } else yearHistory(activity, model);
        const types = section("Что читалось", overview, "types");
        if (model.readings) {
            breakdown(types, model);
        } else element(types, "p", "За этот период чтения ещё не записаны.", "books-empty");
        const readings = section("Прочитано за период", content, "readings");
        if (model.readings) table(readings, ["Дата", "Произведение", "Автор", "Тип", "Оценка", "Чтение"], model.readingRows.map(item => [service.core.displayDate(item.date), cell => link(cell, item, app), item.authors.join(", "), TYPE_LABELS[item.type], item.rating == null ? "—" : `${item.rating}/10`, item.number > 1 ? `№${item.number} · повторное` : "Первое"]));
        else element(readings, "p", "Пока нет записей за выбранный период.", "books-empty");
        const details = element(content, "div", undefined, "book-dashboard-details-grid");
        const authors = section("Авторы за период", details, "authors");
        if (model.authorRows.length) table(authors, ["Автор", "Произведений", "Чтений", "Средняя оценка художественных"], model.authorRows.map(row => [row.name, row.books, row.readings, row.average === null ? "—" : row.average.toFixed(1)]));
        else element(authors, "p", "В этом периоде авторов пока нет.", "books-empty");
        const favorites = section("Любимые произведения · 8–10", details, "favorites");
        if (model.favoriteBooks.length) table(favorites, ["Произведение", "Автор", "Оценка"], model.favoriteBooks.map(item => [cell => link(cell, item, app), item.authors.join(", "), item.rating]));
        else element(favorites, "p", "Пока нет оценок 8–10 у художественных произведений за период.", "books-empty");
        memories(model);
        const methodology = element(content, "details", undefined, "book-dashboard-methodology");
        element(methodology, "summary", "Как считаются итоги и точность дат");
        element(methodology, "p", "Каждое чтение считается по истории карточки. В произведения и авторов входят также карточки с сохранённой выпиской за период. Цитаты учитываются по дате сохранения. Средние оценки авторов и любимые произведения используют последнюю доступную оценку художественного произведения за период.");
        element(methodology, "p", "Сравнение по сохранённой истории; отсутствие записей не означает отсутствие чтения. Текущий год или месяц может быть ещё не завершён.");
        if (model.imprecise) element(methodology, "p", `Чтений с датой до месяца или года: ${model.imprecise}. Отсутствующие дни не восстанавливаются.`);
        if (selectedMonth) element(methodology, "p", "Чтения с датой только до года не входят в отдельный месяц.");
        if (model.undatedExcerpts) element(methodology, "p", `Выписок без даты сохранения: ${model.undatedExcerpts}. ${selectedYear ? "В выбранный период они не включены." : "Они включены в общие итоги."}`);
    }
    function yearHistory(parent, model) {
        if (!model.years.length) { element(parent, "p", "История чтений пока пуста.", "books-empty"); return; }
        table(parent, ["Год", "Чтений", "Художественных", "Нон-фикшн"], model.years.map(row => [cell => {
            const button = element(cell, "button", row.year, "book-dashboard-year-link");
            button.addEventListener("click", () => setPeriod(row.year, ""));
        }, row.readings, row.fiction, row.nonfiction]));
    }
    async function reload() {
        const current = ++generation;
        try {
            const next = await service.snapshot({ includeCollections: true });
            if (disposed || current !== generation) return;
            // TFile has circular parent/vault references; compare visible data.
            const nextSignature = JSON.stringify(next.map(record => [record.file.path, record.file.basename,
                record.fm.title, record.fm.authors, record.fm.work_type, Boolean(record.collection),
                (record.history || []).map(entry => [entry.date, entry.number, entry.rating]),
                (record.excerpts || []).map(entry => entry.savedDate || ""), record.historyError, record.error]));
            if (signature === nextSignature) return;
            signature = nextSignature;
            records = next;
            if (yearSelect) {
                const years = [...new Set([...availableYears(records), currentYear])].sort((a, b) => b.localeCompare(a));
                yearSelect.replaceChildren();
                element(yearSelect, "option", "За всё время").value = "";
                for (const year of years) element(yearSelect, "option", year).value = year;
                if (!years.includes(selectedYear)) { selectedYear = ""; selectedMonth = ""; }
                yearSelect.value = selectedYear;
                monthSelect.disabled = !selectedYear;
                monthSelect.value = selectedMonth;
                resetMonth.disabled = !selectedMonth;
                if (view) { view.year = selectedYear; view.month = selectedMonth; }
            }
            draw();
        } catch (error) { if (!disposed) status.textContent = `Не удалось собрать итоги: ${error.message || error}`; }
    }
    unsubscribe = service.subscribe(() => { clearTimeout(timer); timer = setTimeout(reload, 200); });
    function dispose() {
        if (disposed) return;
        disposed = true; generation++; clearTimeout(timer); unsubscribe();
        if (view?.root === root) view.root = null;
        root.remove?.();
    }
    await reload();
    if (!disposed) root.setAttribute("data-ready", "true");
    return { reload, dispose };
}

module.exports = Object.assign(render, { buildDashboard, availableYears });
