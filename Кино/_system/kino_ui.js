/* Shared reading-view presentation. This module never writes notes or settings. */
module.exports = async function renderKino({ dv, app, obsidian = {}, kind = "media" }) {
    const container = dv?.container;
    if (!container?.ownerDocument) return;
    const doc = container.ownerDocument;
    const current = dv.current?.() ?? {};
    const sourcePath = String(current.file?.path ?? "");
    const file = app.vault.getAbstractFileByPath(sourcePath);
    const fm = app.metadataCache.getFileCache(file)?.frontmatter ?? current;
    const view = container.closest(".markdown-preview-view, .markdown-source-view") ?? container;
    view.classList.add("kino-page", `kino-${kind}`);
    const root = element(container, "section", "kino-ui-root");
    root.dataset.kind = kind;
    let disposed = false;
    const cleanups = [];
    function cleanup(fn) { cleanups.push(fn); }
    dv.component?.register?.(() => { disposed = true; for (const fn of cleanups) fn(); });

    function element(parent, tag, cls, text) {
        const el = doc.createElement(tag);
        if (cls) el.className = cls;
        if (text !== undefined) el.textContent = String(text);
        parent.appendChild(el);
        return el;
    }
    function values(value) {
        if (value?.array) return value.array();
        return Array.isArray(value) ? value : value == null ? [] : [value];
    }
    function text(value) {
        if (value == null) return "";
        if (value instanceof Date) return Number.isNaN(value.getTime()) ? "" : value.toISOString().slice(0, 10);
        if (value?.toISODate) return value.toISODate() ?? "";
        if (typeof value === "object" && value.path) return value.display ?? String(value.path).split("/").pop().replace(/\.md$/i, "");
        if (typeof value === "object") { try { return JSON.stringify(value); } catch { return String(value); } }
        return String(value);
    }
    function present(value) { return value != null && !/^(?:\s*|N\/?A|null|undefined)$/i.test(text(value).trim()); }
    function number(value) {
        if (!present(value)) return null;
        const n = Number(text(value).trim().replace(",", "."));
        return Number.isFinite(n) ? n : null;
    }
    function linkParts(value) {
        if (value && typeof value === "object" && value.path) return { path: value.path, label: text(value) };
        const match = text(value).match(/^\[\[([^\]]+)\]\]$/);
        if (!match) return null;
        const [path, ...label] = match[1].split("|");
        return { path, label: label.join("|") || path.split("/").pop().replace(/\.md$/i, "") };
    }
    function internalLink(parent, value) {
        const ref = linkParts(value);
        if (!ref) return element(parent, "span", "", text(value));
        const link = element(parent, "a", "internal-link", ref.label);
        link.dataset.href = ref.path;
        link.href = ref.path;
        link.addEventListener("click", event => {
            event.preventDefault();
            app.workspace.openLinkText(ref.path, sourcePath, Boolean(event.ctrlKey || event.metaKey));
        });
        return link;
    }
    function valueDisplay(parent, value) {
        const list = values(value);
        if (!list.length) { element(parent, "span", "kino-muted", "—"); return; }
        list.forEach((item, index) => {
            if (index) element(parent, "span", "kino-value-separator", " · ");
            if (linkParts(item)) internalLink(parent, item);
            else if (/^https?:\/\//i.test(text(item).trim())) {
                const link = element(parent, "a", "external-link", text(item));
                link.href = text(item); link.target = "_blank"; link.rel = "noopener noreferrer";
            } else element(parent, "span", "", text(item));
        });
    }
    function dateLabel(value) {
        const raw = text(value).trim(), match = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:T|$)/);
        return match ? `${match[3]}.${match[2]}.${match[1]}` : raw;
    }
    function entityLink(parent, name, choice) {
        if (linkParts(name)) return internalLink(parent, name);
        const link = element(parent, "a", "kino-entity-link", text(name));
        link.href = "obsidian://quickadd?vault=" + encodeURIComponent(app.vault.getName())
            + "&choice=" + encodeURIComponent(choice) + "&value-entity=" + encodeURIComponent(text(name));
        return link;
    }
    async function markdown(markdownText, holder, child) {
        if (obsidian.MarkdownRenderer?.render && child) {
            await obsidian.MarkdownRenderer.render(app, markdownText, holder, sourcePath, child);
        } else element(holder, "div", "kino-markdown-fallback", markdownText);
    }
    function childComponent() {
        if (!obsidian.Component || !dv.component?.addChild) return null;
        const child = new obsidian.Component(); dv.component.addChild(child);
        return child;
    }
    async function richText(parent, cls, content) {
        const holder = element(parent, "div", cls), child = childComponent();
        cleanup(() => { if (child) dv.component.removeChild(child); });
        await markdown(text(content), holder, child);
        return holder;
    }
    function score(parent, label, value, className, url) {
        const n = number(value), box = element(parent, url ? "a" : "div", `kino-score ${className ?? ""}`);
        if (url) { box.href = url; box.target = "_blank"; box.rel = "noopener noreferrer"; }
        element(box, "span", "kino-score-label", label);
        const valueEl = element(box, "span", "kino-score-value", n == null ? "—" : String(Math.round(n * 10) / 10));
        if (n != null) element(valueEl, "span", "kino-score-scale", " / 10");
        return box;
    }
    function propertyDetails() {
        const details = element(root, "details", "kino-details kino-properties");
        element(details, "summary", "", "Все свойства");
        const body = element(details, "div", "kino-details-body");
        let rendered = false;
        details.addEventListener("toggle", () => {
            if (!details.open || rendered) return;
            rendered = true;
            const list = element(body, "dl", "kino-property-list");
            for (const [key, value] of Object.entries(fm)) {
                if (["position", "file"].includes(key)) continue;
                element(list, "dt", "", key);
                valueDisplay(element(list, "dd", ""), value);
            }
            if (!list.children.length) element(body, "p", "kino-muted", "Свойства не заполнены.");
        });
    }
    function roleDetails() {
        const ref = linkParts(fm["Роли файл"]);
        if (!ref) return;
        const details = element(root, "details", "kino-details kino-roles-details");
        element(details, "summary", "", "Роли и создатели");
        const body = element(details, "div", "kino-details-body kino-roles-content");
        let child = null, token = 0;
        function release() {
            token++;
            if (child) { dv.component.removeChild(child); child = null; }
            body.replaceChildren();
        }
        cleanup(release);
        details.addEventListener("toggle", async () => {
            if (!details.open) { release(); return; }
            if (child || disposed) return;
            const request = ++token;
            const destination = app.metadataCache.getFirstLinkpathDest?.(ref.path, sourcePath)
                ?? app.vault.getAbstractFileByPath(ref.path) ?? app.vault.getAbstractFileByPath(ref.path + ".md");
            if (!destination) {
                element(body, "p", "kino-muted", "Файл ролей не найден. Проверь ссылку в свойствах.");
                internalLink(body, fm["Роли файл"]); return;
            }
            const source = element(body, "div", "kino-role-source");
            internalLink(source, fm["Роли файл"]);
            if (!obsidian.MarkdownRenderer?.render || !obsidian.Component || !dv.component?.addChild) {
                element(body, "p", "kino-muted", "Открой полный список по ссылке."); return;
            }
            child = childComponent();
            const activeChild = child, content = element(body, "div", "kino-role-embed");
            content.setAttribute("aria-busy", "true");
            try {
                await markdown(`![[${destination.path}]]`, content, activeChild);
                if (disposed || request !== token) { content.remove(); return; }
                content.removeAttribute("aria-busy");
            } catch (error) {
                if (request !== token || disposed) return;
                if (child) { dv.component.removeChild(child); child = null; }
                content.replaceChildren();
                element(content, "p", "kino-muted", "Не удалось загрузить роли. Открой файл по ссылке выше.");
                content.title = String(error?.message ?? error);
            }
        });
    }

    if (!["dashboard", "system", "roles", "entity"].includes(kind)) {
        const header = element(root, "header", "kino-card-header");
        const tags = values(fm.tags).map(value => text(value).replace(/^#/, ""));
        const type = kind === "media" ? tags.includes("serial") ? "Сериал" : "Фильм"
            : kind === "franchise" ? "Франшиза" : kind === "season" ? "Сезон" : "Просмотр";
        element(header, "div", "kino-eyebrow", type);
        const title = current.file?.name ?? file?.basename ?? "Кино";
        element(header, "h1", "kino-card-title", title);
        const original = text(fm["Название"]).trim();
        if (kind === "media" && original && original !== title) element(header, "p", "kino-original-title", original);
        const meta = element(header, "div", "kino-card-meta");
        if (kind === "media") {
            const year = text(fm["Релиз"]).match(/\d{4}/)?.[0];
            if (year) element(meta, "span", "kino-meta-chip", year);
            if (present(fm["Время"])) element(meta, "span", "kino-meta-chip", text(fm["Время"]));
            if (number(fm["Количество сезонов"]) != null) element(meta, "span", "kino-meta-chip", `Сезонов: ${text(fm["Количество сезонов"])}`);
            if (present(fm["Просмотрено"])) element(meta, "span", "kino-meta-chip kino-meta-muted", `Просмотрено ${dateLabel(fm["Просмотрено"])}`);
        } else {
            const related = fm["Фильм"] ?? fm["Сериал"];
            if (related) internalLink(meta, related);
            if (present(fm["Дата"]) || present(fm["Год"])) element(meta, "span", "kino-meta-chip", dateLabel(fm["Дата"] ?? fm["Год"]));
            if (kind === "season" && present(fm["Сезон"])) element(meta, "span", "kino-meta-chip", `Сезон ${text(fm["Сезон"])}`);
            if (kind === "viewing" && present(fm["Просмотр"])) element(meta, "span", "kino-meta-chip", `Просмотр ${text(fm["Просмотр"])}`);
        }
        if (kind === "media") {
            const ratings = element(root, "div", "kino-scores");
            score(ratings, "Моя оценка", fm["Оценка"], "kino-score-personal");
            const imdb = text(fm["imdb Id"]).match(/^tt\d+$/)?.[0];
            const kp = text(fm["Кинопоиск ID"]).match(/^\d+$/)?.[0];
            score(ratings, "IMDb", fm["Оценка Imdb"], "", imdb ? `https://www.imdb.com/title/${imdb}/` : null);
            score(ratings, "Кинопоиск", fm["Оценка Кинопоиск"], "", kp ? `https://www.kinopoisk.ru/film/${kp}/` : null);
            score(ratings, "Прогноз", fm["Прогноз оценки"], "kino-score-forecast").title = "Прогноз личной оценки из свойств карточки";
            if (present(fm["Описание"])) {
                const synopsis = element(root, "section", "kino-synopsis");
                element(synopsis, "h2", "kino-section-label", "О фильме".replace("фильме", tags.includes("serial") ? "сериале" : "фильме"));
                await richText(synopsis, "kino-synopsis-text", fm["Описание"]);
            }
            const credits = element(root, "div", "kino-credits");
            for (const [key, label, choice] of [["Режисер", "Режиссёр", "Кино - Открыть режиссера"], ["Жанр", "Жанры", "Кино - Открыть жанр"], ["Франшиза", "Франшиза", null]]) {
                const list = values(fm[key]).filter(present);
                if (!list.length) continue;
                const row = element(credits, "div", "kino-credit-row");
                element(row, "span", "kino-credit-label", label);
                const links = element(row, "div", "kino-credit-values");
                list.forEach(value => choice ? entityLink(links, value, choice) : internalLink(links, value));
            }
        } else if (number(fm["Оценка"]) != null) {
            score(element(root, "div", "kino-scores kino-scores-single"), "Моя оценка", fm["Оценка"], "kino-score-personal");
        }
    }
    if (["season", "viewing"].includes(kind) && present(fm["Комментарий"])) {
        const notes = element(root, "section", "kino-comment");
        element(notes, "h2", "kino-section-label", "Мои впечатления");
        await richText(notes, "kino-comment-text", fm["Комментарий"]);
    }
    if (!["dashboard", "system", "entity", "roles"].includes(kind)) propertyDetails();
    if (kind === "media") roleDetails();
    if (root.querySelector(".kino-card-title")) view.classList.add("kino-has-card-title");
    if (root.querySelector(".kino-properties")) view.classList.add("kino-has-properties");

    // Wrap read-only tables, including those Dataview renders after this block.
    function wrapTables() {
        for (const table of view.querySelectorAll("table")) {
            if (table.closest(".kino-table-wrap, .bases-view, .bases-table, .bases-cards, .cm-content")) continue;
            const wrapper = doc.createElement("div"); wrapper.className = "kino-table-wrap";
            wrapper.tabIndex = 0; wrapper.setAttribute("role", "region");
            wrapper.setAttribute("aria-label", "Таблица с горизонтальной прокруткой");
            table.before(wrapper); wrapper.appendChild(table);
        }
    }
    wrapTables();
    const Observer = doc.defaultView?.MutationObserver;
    if (Observer) {
        let queued = false;
        const observer = new Observer(() => {
            if (queued || disposed) return;
            queued = true;
            Promise.resolve().then(() => { queued = false; if (!disposed) wrapTables(); });
        });
        observer.observe(view, { childList: true, subtree: true });
        cleanup(() => observer.disconnect());
    }
    return root;
};
