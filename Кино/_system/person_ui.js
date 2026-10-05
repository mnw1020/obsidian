/* Actor/director/genre reading-view presentation. Input rows and notes are never modified. */
module.exports = async function renderPerson({ dv, app, obsidian = {}, kind = "actor", selected, rows, baseSource = "" }) {
    const container = dv?.container;
    if (!container?.ownerDocument) return;
    const doc = container.ownerDocument;
    const current = dv.current?.() ?? {};
    const sourcePath = String(current.file?.path ?? "");
    const isGenre = kind === "genre";
    const isActor = !isGenre && kind !== "director";
    const profession = isGenre ? "Жанр" : isActor ? "Актёр" : "Режиссёр";
    const choice = isGenre ? "Кино - Открыть жанр" : isActor ? "Кино - Открыть актера" : "Кино - Открыть режиссера";
    const chooseLabel = isGenre ? "Выбрать жанр" : isActor ? "Выбрать актёра" : "Выбрать режиссёра";
    const view = container.closest(".markdown-preview-view, .markdown-source-view") ?? container;
    const leases = view.kinoPresentationClassLeases ?? (view.kinoPresentationClassLeases = new Map());
    const lease = leases.get("kino-person-page") ?? { count: 0, original: view.classList.contains("kino-person-page") };
    const root = element(container, "section", "kino-person");
    root.dataset.kind = isGenre ? "genre" : isActor ? "actor" : "director";
    let disposed = false;
    const cleanups = [];

    function element(parent, tag, cls, content) {
        const el = doc.createElement(tag);
        if (cls) el.className = cls;
        if (content !== undefined) el.textContent = String(content);
        parent.appendChild(el);
        return el;
    }
    function listen(target, event, callback) {
        target.addEventListener(event, callback);
        cleanups.push(() => target.removeEventListener(event, callback));
    }
    function values(value) {
        if (value == null) return [];
        if (typeof value.array === "function") return value.array();
        return Array.isArray(value) ? value : [value];
    }
    function text(value) {
        if (value == null) return "";
        if (value instanceof Date) return Number.isNaN(value.getTime()) ? "" : value.toISOString().slice(0, 10);
        if (typeof value.toISODate === "function") return value.toISODate() ?? "";
        if (typeof value === "object" && value.path) return value.display ?? String(value.path).split("/").pop().replace(/\.md$/i, "");
        if (typeof value === "object") {
            if (value.year && value.month && value.day) return `${value.year}-${String(value.month).padStart(2, "0")}-${String(value.day).padStart(2, "0")}`;
            try { return JSON.stringify(value); } catch { return String(value); }
        }
        return String(value);
    }
    function present(value) { return value != null && !/^(?:\s*|N\/?A|null|undefined)$/i.test(text(value).trim()); }
    function numeric(value) {
        if (!present(value)) return null;
        const number = Number(text(value).trim().replace(",", "."));
        return Number.isFinite(number) ? number : null;
    }
    function scoreText(value) {
        const number = numeric(value);
        return number == null ? present(value) ? text(value) : "—" : String(Math.round(number * 10) / 10).replace(".", ",");
    }
    function releaseInfo(value) {
        const raw = text(value).trim();
        const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/);
        const local = raw.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
        const year = Number((iso ? iso[1] : local ? local[3] : raw.match(/\b(?:18|19|20|21)\d{2}\b/)?.[0]) ?? 0);
        const timestamp = iso ? Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]))
            : local ? Date.UTC(Number(local[3]), Number(local[2]) - 1, Number(local[1])) : year ? Date.UTC(year, 0, 1) : null;
        return { label: iso ? `${iso[3]}.${iso[2]}.${iso[1]}` : present(value) ? raw : "—", year: year || null, timestamp };
    }
    function linkParts(value) {
        if (value && typeof value === "object" && value.path) return { path: String(value.path), label: text(value) };
        const raw = text(value).trim().replace(/^(["'])(.*)\1$/, "$2");
        const match = raw.match(/^\[\[([^\]]+)\]\]$/);
        if (!match) return null;
        const [path, ...label] = match[1].split("|");
        return { path, label: label.join("|") || path.split("/").pop().replace(/\.md$/i, "") };
    }
    function vaultName() { try { return app?.vault?.getName?.() ?? ""; } catch { return ""; } }
    function internalLink(parent, ref, label) {
        if (!ref?.path) return element(parent, "span", "", label ?? ref?.label ?? "");
        const link = element(parent, "a", "internal-link", label ?? ref.label);
        link.dataset.href = ref.path;
        link.href = "obsidian://open?vault=" + encodeURIComponent(vaultName()) + "&file=" + encodeURIComponent(ref.path);
        listen(link, "click", event => {
            if (!app?.workspace?.openLinkText) return;
            event.preventDefault();
            app.workspace.openLinkText(ref.path, sourcePath, Boolean(event.ctrlKey || event.metaKey));
        });
        return link;
    }
    function choose(parent) {
        const link = element(parent, "a", "kino-person-change", chooseLabel);
        link.href = "obsidian://quickadd?vault=" + encodeURIComponent(vaultName()) + "&choice=" + encodeURIComponent(choice);
        return link;
    }
    function plural(number) {
        const tail = number % 100, last = number % 10;
        return tail >= 11 && tail <= 14 ? "произведений" : last === 1 ? "произведение" : last >= 2 && last <= 4 ? "произведения" : "произведений";
    }
    function searchable(value) { return text(value).toLocaleLowerCase("ru").replace(/ё/g, "е").trim(); }
    function nameParts(value) {
        const name = text(value).trim();
        const match = name.match(/^(.+?)\s+\(([^()]+)\)$/);
        return { name: match ? match[1].trim() : name, subtitle: match ? match[2].trim() : "" };
    }

    const selectedName = selected ?? current["Выбрано"];
    const name = isGenre ? { name: text(selectedName).trim(), subtitle: "" } : nameParts(selectedName);
    const hasSelection = present(name.name);
    const header = element(root, "header", "kino-person-header");
    const identity = element(header, "div", "kino-person-identity");
    const monogram = element(identity, "div", "kino-person-monogram", hasSelection
        ? name.name.split(/[\s-]+/).filter(Boolean).slice(0, 2).map(part => Array.from(part)[0]).join("").toLocaleUpperCase("ru") : isGenre ? "Ж" : isActor ? "А" : "Р");
    monogram.setAttribute("aria-hidden", "true");
    const heading = element(identity, "div", "kino-person-heading");
    element(heading, "div", "kino-person-eyebrow", `Кинотека / ${profession}`);
    element(heading, "h1", "kino-person-name", hasSelection ? name.name : profession);
    if (name.subtitle) element(heading, "p", "kino-person-subtitle", name.subtitle);
    else if (!hasSelection) element(heading, "p", "kino-person-subtitle", isGenre ? "Фильмы и сериалы по жанрам" : isActor ? "Роли и истории в вашей коллекции" : "Фильмы и сериалы в вашей коллекции");
    choose(header);

    const items = values(rows).map((row, index) => {
        const page = row?.page ?? {};
        const tags = [...values(page.tags), ...values(page.file?.tags)].map(tag => text(tag).replace(/^#/, "").toLowerCase());
        const type = tags.includes("serial") ? "series" : "films";
        const fileLink = linkParts(page.file?.link);
        const path = String(page.file?.path ?? fileLink?.path ?? "");
        const title = text(page.file?.name ?? fileLink?.label ?? page["Название"]).trim() || "Без названия";
        const franchises = values(page["Франшиза"]).filter(present);
        const role = values(row?.role).filter(present).map(text).join(" · ");
        const release = releaseInfo(page["Релиз"]);
        return { page, index, title, path, type, role, franchises, release, rating: numeric(page["Оценка"]),
            search: searchable([title, text(page["Название"]), role, type === "series" ? "сериал" : "фильм", release.label, ...franchises.map(text)].join(" ")) };
    });

    if (hasSelection) {
        const stats = element(root, "div", "kino-person-stats");
        const ratings = items.map(item => item.rating).filter(value => value != null && value >= 1 && value <= 10);
        const years = items.map(item => item.release.year).filter(value => value != null);
        const minYear = years.length ? Math.min(...years) : null, maxYear = years.length ? Math.max(...years) : null;
        const yearsLabel = minYear == null ? "—" : minYear === maxYear ? String(minYear) : `${minYear}–${maxYear}`;
        const average = ratings.length ? (ratings.reduce((sum, value) => sum + value, 0) / ratings.length).toFixed(2).replace(".", ",") : "—";
        for (const [label, value] of [["В коллекции", items.length], ["Фильмы", items.filter(item => item.type === "films").length],
            ["Сериалы", items.filter(item => item.type === "series").length], ["Средняя моя оценка", average], ["Годы релизов", yearsLabel]]) {
            const stat = element(stats, "div", "kino-person-stat");
            element(stat, "span", "kino-person-stat-value", value);
            element(stat, "span", "kino-person-stat-label", label);
        }
    }

    const filmography = element(root, "section", "kino-person-filmography");
    const sectionHeading = element(filmography, "div", "kino-person-section-heading");
    element(sectionHeading, "h2", "kino-person-section-title", isGenre ? "Произведения" : "Фильмография");
    const count = element(sectionHeading, "span", "kino-person-result-count");
    count.setAttribute("aria-live", "polite");
    const controls = element(filmography, "div", "kino-person-controls");
    const searchLabel = element(controls, "label", "kino-person-search");
    element(searchLabel, "span", "kino-person-control-label", isGenre ? "Поиск в жанре" : "Поиск в фильмографии");
    const search = element(searchLabel, "input", "kino-person-search-input");
    search.type = "search"; search.autocomplete = "off";
    search.placeholder = isActor ? "Название фильма, сериала или роль" : "Название фильма или сериала";
    const filters = element(controls, "div", "kino-person-filters");
    filters.setAttribute("role", "group"); filters.setAttribute("aria-label", "Тип произведений");
    let activeFilter = "all";
    const filterButtons = [];
    for (const [key, label] of [["all", "Все"], ["films", "Фильмы"], ["series", "Сериалы"], ["best", "Лучшие"]]) {
        const button = element(filters, "button", "kino-person-filter", label);
        button.type = "button"; button.dataset.filter = key;
        button.setAttribute("aria-pressed", key === activeFilter ? "true" : "false");
        if (key === "best") button.title = "Моя оценка от 8";
        filterButtons.push(button);
        listen(button, "click", () => {
            activeFilter = key;
            for (const candidate of filterButtons) candidate.setAttribute("aria-pressed", candidate.dataset.filter === key ? "true" : "false");
            renderCards();
        });
    }
    const sortLabel = element(controls, "label", "kino-person-sort");
    element(sortLabel, "span", "kino-person-control-label", "Сортировка");
    const sort = element(sortLabel, "select", "kino-person-sort-select");
    for (const [value, label] of [["newest", "Сначала новые"], ["name", "По названию"], ["myrating", "По моей оценке"]]) {
        const option = element(sort, "option", "", label); option.value = value;
    }
    const grid = element(filmography, "div", "kino-person-grid kino-person-rows");
    let cardListeners = [];
    function cardLink(parent, ref, label) {
        const link = internalLink(parent, ref, label);
        // Cards are replaced when searching or sorting; release their handlers immediately.
        if (link.tagName === "A") cardListeners.push(cleanups.pop());
        return link;
    }
    function renderCards() {
        if (disposed) return;
        for (const cleanup of cardListeners) cleanup();
        cardListeners = [];
        grid.replaceChildren();
        const query = searchable(search.value);
        const shown = items.filter(item => (activeFilter === "all" || activeFilter === "best" ? activeFilter !== "best" || item.rating != null && item.rating >= 8 : item.type === activeFilter)
            && (!query || item.search.includes(query)));
        const collate = (a, b) => a.title.localeCompare(b.title, "ru", { sensitivity: "base", numeric: true }) || a.index - b.index;
        shown.sort(sort.value === "name" ? collate : sort.value === "myrating"
            ? (a, b) => (b.rating ?? -Infinity) - (a.rating ?? -Infinity) || collate(a, b)
            : (a, b) => (b.release.timestamp ?? -Infinity) - (a.release.timestamp ?? -Infinity) || collate(a, b));
        count.textContent = `${shown.length} ${plural(shown.length)}`;
        if (!hasSelection || !items.length || !shown.length) {
            const empty = element(grid, "div", "kino-person-empty");
            element(empty, "h3", "", !hasSelection ? isGenre ? "Какой жанр вам интересен?" : isActor ? "Чья фильмография вам интересна?" : "Чьи работы вам интересны?"
                : !items.length ? "В коллекции пока нет произведений" : "Ничего не найдено");
            element(empty, "p", "", !hasSelection ? isGenre ? "Выберите жанр, чтобы увидеть фильмы и сериалы." : isActor ? "Выберите актёра, чтобы увидеть фильмы, сериалы и роли." : "Выберите режиссёра, чтобы увидеть фильмы и сериалы."
                : !items.length ? "Когда появятся связанные карточки, они будут здесь." : "Попробуйте другой запрос или фильтр.");
            return;
        }
        shown.forEach((item, index) => {
            const card = element(grid, "article", "kino-person-card kino-person-row"); card.dataset.type = item.type;
            element(card, "span", "kino-person-card-number", String(index + 1).padStart(2, "0"));
            const main = element(card, "div", "kino-person-row-main");
            const title = element(main, "h3", "kino-person-card-title");
            cardLink(title, { path: item.path, label: item.title }, item.title);
            const meta = element(main, "div", "kino-person-card-meta kino-person-row-meta");
            element(meta, "span", "kino-person-card-type", item.type === "series" ? "Сериал" : "Фильм");
            element(meta, "span", "kino-person-card-meta-label", "Релиз");
            element(meta, "span", "kino-person-card-release", item.release.label);
            if (isActor) {
                const role = element(main, "div", "kino-person-card-role");
                element(role, "span", "kino-person-card-label", "Роль");
                element(role, "span", "kino-person-card-role-value", item.role || "—");
            }
            const scores = element(card, "div", "kino-person-card-scores");
            for (const [label, key, personal] of [["Моя", "Оценка", true], ["IMDb", "Оценка Imdb", false], ["КП", "Оценка Кинопоиск", false]]) {
                const score = element(scores, "div", "kino-person-card-score" + (personal ? " kino-person-card-score-personal" : ""));
                element(score, "span", "kino-person-card-score-label", label);
                element(score, "span", "kino-person-card-score-value", scoreText(item.page[key]));
            }
            if (item.franchises.length) {
                const franchise = element(main, "div", "kino-person-card-franchise");
                element(franchise, "span", "kino-person-card-label", "Франшиза");
                const links = element(franchise, "div", "kino-person-card-franchise-values");
                item.franchises.forEach((value, valueIndex) => {
                    if (valueIndex) element(links, "span", "kino-person-value-separator", " · ");
                    const ref = linkParts(value);
                    if (ref) cardLink(links, ref); else element(links, "span", "", text(value));
                });
            }
        });
    }
    listen(search, "input", renderCards);
    listen(sort, "change", renderCards);
    cleanups.push(() => { for (const cleanup of cardListeners) cleanup(); cardListeners = []; });
    if (!hasSelection || !items.length) controls.hidden = true;
    renderCards();

    if (baseSource && hasSelection) {
        const details = element(root, "details", "kino-person-table kino-details");
        element(details, "summary", "", "Таблица и представления");
        const body = element(details, "div", "kino-person-table-body");
        let request = 0, active = null;
        function release() {
            request++;
            if (active?.component) dv.component?.removeChild?.(active.component);
            active = null;
            body.replaceChildren(); body.removeAttribute("aria-busy");
        }
        async function load() {
            if (disposed || !details.open || active) return;
            body.replaceChildren();
            if (!obsidian.MarkdownRenderer?.render || !obsidian.Component || !dv.component?.addChild || !dv.component?.removeChild) {
                element(body, "p", "kino-person-table-error", "Не удалось открыть таблицу в этом режиме."); return;
            }
            const id = ++request, component = new obsidian.Component();
            const holder = element(body, "div", "kino-person-table-content");
            active = { component, id }; dv.component.addChild(component);
            body.setAttribute("aria-busy", "true");
            try {
                await obsidian.MarkdownRenderer.render(app, baseSource, holder, sourcePath, component);
                if (disposed || id !== request || !details.open) { holder.remove(); return; }
                body.removeAttribute("aria-busy");
            } catch (error) {
                if (disposed || id !== request) return;
                dv.component.removeChild(component); active = null;
                body.replaceChildren(); body.removeAttribute("aria-busy");
                element(body, "p", "kino-person-table-error", "Не удалось открыть таблицу. Попробуйте ещё раз.").title = String(error?.message ?? error);
                const retry = element(body, "button", "kino-person-table-retry", "Повторить"); retry.type = "button";
                listen(retry, "click", load);
            }
        }
        listen(details, "toggle", () => { if (details.open) void load(); else release(); });
        cleanups.push(release);
    }

    const legacyHeadings = [];
    if (view.classList.contains("markdown-preview-view")) {
        const scope = container.closest(".markdown-preview-section") ?? view;
        const expected = isGenre ? /^Жанр$/ : isActor ? /^(?:Актер|Актёр)$/ : /^(?:Режиссер|Режиссёр)$/;
        for (const title of scope.querySelectorAll("h1")) {
            if (root.contains(title) || !expected.test(title.textContent.trim())) continue;
            const titleLease = title.kinoPersonHeadingLease ?? (title.kinoPersonHeadingLease = { count: 0, original: title.classList.contains("kino-person-legacy-heading") });
            titleLease.count++; title.classList.add("kino-person-legacy-heading");
            legacyHeadings.push(title);
        }
    }
    const sourceFile = app?.vault?.getAbstractFileByPath?.(sourcePath);
    const frontmatter = (sourceFile ? app?.metadataCache?.getFileCache?.(sourceFile)?.frontmatter : null) ?? current;
    const simpleProperties = !Object.keys(frontmatter).some(key => !["position", "file", "cssclasses", "Выбрано"].includes(key));
    let propertiesLease;
    if (simpleProperties) {
        propertiesLease = leases.get("kino-person-simple-properties") ?? { count: 0, original: view.classList.contains("kino-person-simple-properties") };
        propertiesLease.count++; leases.set("kino-person-simple-properties", propertiesLease);
        view.classList.add("kino-person-simple-properties");
    }
    lease.count++; leases.set("kino-person-page", lease); view.classList.add("kino-person-page");
    dv.component?.register?.(() => {
        if (disposed) return;
        disposed = true;
        for (const cleanup of cleanups) cleanup();
        root.remove();
        for (const title of legacyHeadings) {
            const titleLease = title.kinoPersonHeadingLease;
            if (titleLease && --titleLease.count === 0) {
                if (!titleLease.original) title.classList.remove("kino-person-legacy-heading");
                delete title.kinoPersonHeadingLease;
            }
        }
        const currentLease = leases.get("kino-person-page");
        if (currentLease && --currentLease.count === 0) {
            if (!currentLease.original) view.classList.remove("kino-person-page");
            leases.delete("kino-person-page");
        }
        if (propertiesLease && --propertiesLease.count === 0) {
            if (!propertiesLease.original) view.classList.remove("kino-person-simple-properties");
            leases.delete("kino-person-simple-properties");
        }
    });
    return { root };
};
