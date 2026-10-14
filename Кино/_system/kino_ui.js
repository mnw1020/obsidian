/* Shared reading-view presentation. Saved reports are read-only; opening a
   Kino page may resume the user's previously queued forecast work. */
module.exports = async function renderKino({ dv, app, obsidian = {}, kind = "media" }) {
    const container = dv?.container;
    if (!container?.ownerDocument) return;
    const doc = container.ownerDocument;
    const current = dv.current?.() ?? {};
    const sourcePath = String(current.file?.path ?? "");
    const file = app.vault.getAbstractFileByPath(sourcePath);
    const fm = (file ? app.metadataCache.getFileCache(file)?.frontmatter : null) ?? current;
    const view = container.closest(".markdown-preview-view, .markdown-source-view") ?? container;
    // A leaf can host several embedded renderers and can later show a non-Kino note.
    // Count each renderer's transient classes while keeping Obsidian's own cssclasses.
    const leases = view.kinoPresentationClassLeases ?? (view.kinoPresentationClassLeases = new Map());
    const ownedClasses = [];
    function acquireClass(cls) {
        if (ownedClasses.includes(cls)) return;
        const lease = leases.get(cls) ?? { count: 0, original: view.classList.contains(cls) };
        lease.count++; leases.set(cls, lease); ownedClasses.push(cls); view.classList.add(cls);
    }
    acquireClass("kino-page"); acquireClass(`kino-${kind}`);
    if (["media", "media-properties"].includes(kind)) acquireClass("kino-has-properties");
    const root = element(container, "section", "kino-ui-root");
    root.dataset.kind = kind;
    let disposed = false;
    const cleanups = [];
    function cleanup(fn) { cleanups.push(fn); }
    dv.component?.register?.(() => { disposed = true; for (const fn of cleanups) fn(); });
    cleanup(() => {
        root.remove();
        for (const cls of ownedClasses) {
            const lease = leases.get(cls);
            if (!lease || --lease.count > 0) continue;
            if (!lease.original) view.classList.remove(cls);
            leases.delete(cls);
        }
    });

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
        link.href = "obsidian://open?vault=" + encodeURIComponent(app.vault.getName()) + "&file=" + encodeURIComponent(ref.path);
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
    function durationLabel(value) {
        if (!present(value)) return "—";
        const raw = text(value).trim();
        const clock = raw.match(/^(\d+):(\d{2})$/);
        let minutes = clock && Number(clock[2]) < 60 ? Number(clock[1]) * 60 + Number(clock[2]) : null;
        if (minutes == null && /^\d+(?:\s*(?:min|mins|minutes?|мин(?:ут[аы]?)?\.?))?$/i.test(raw)) minutes = Number(raw.match(/^\d+/)[0]);
        return Number.isSafeInteger(minutes) && minutes > 0 ? `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}` : "—";
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
    function score(parent, label, value, className, url, voteCount) {
        const n = number(value), box = element(parent, url ? "a" : "div", `kino-score ${className ?? ""}`);
        if (url) { box.href = url; box.target = "_blank"; box.rel = "noopener noreferrer"; }
        element(box, "span", "kino-score-label", label);
        const valueEl = element(box, "span", "kino-score-value", n == null ? "—" : String(Math.round(n * 10) / 10));
        if (n != null) element(valueEl, "span", "kino-score-scale", " / 10");
        const votes = number(voteCount);
        if (votes != null && Number.isInteger(votes) && votes >= 0) {
            box.classList.add("kino-score-with-votes");
            const count = element(box, "span", "kino-score-votes", votes.toLocaleString("ru-RU"));
            count.title = `Количество голосов ${label}: ${count.textContent}`;
            count.setAttribute("aria-label", count.title);
        }
        return box;
    }
    function forecastScore(parent) {
        const value = number(fm["Прогноз оценки"]);
        const box = element(parent, "button", "kino-score kino-score-forecast");
        box.type = "button";
        if (obsidian.Modal) box.setAttribute("aria-haspopup", "dialog");
        box.title = "Открыть сохранённый расчёт прогноза";
        element(box, "span", "kino-score-label", "Прогноз");
        const main = element(box, "span", "kino-score-value", value == null ? "—" : String(Math.round(value * 10) / 10));
        if (value != null) element(main, "span", "kino-score-scale", " / 10");
        const parts = element(box, "span", "kino-forecast-parts");
        const currentSchema = /v4$/i.test(text(fm["Версия прогноза"]));
        for (const [label, key] of [[currentSchema ? "По данным · 155" : "По данным", "Прогноз по данным"],
            [currentSchema ? "По сюжету · Gemma" : "По сюжету", "Прогноз по сюжету"]]) {
            const row = element(parts, "span", "kino-forecast-part");
            row.dataset.branch = key;
            element(row, "span", "", label);
            const n = number(fm[key]);
            element(row, "strong", "", n == null ? "—" : String(Math.round(n * 10) / 10));
        }
        const state = text(fm["Статус прогноза"]).trim();
        if (state && !/^(?:готов|готово|завершён|завершен|complete|completed|ready)$/i.test(state)) {
            element(box, "span", "kino-forecast-status", state);
        }
        let loading = false, dialog = null, openDetails = null;
        cleanup(() => dialog?.close?.());
        box.addEventListener("click", async () => {
            if (disposed || loading || dialog?.isOpen?.()) return;
            loading = true; box.setAttribute("aria-busy", "true");
            try {
                if (!openDetails) {
                    const script = app.vault.getAbstractFileByPath("Кино/_system/forecast_details.js")
                        ?? app.vault.getAbstractFileByPath("_system/forecast_details.js");
                    if (!script) throw new Error("Модуль расчёта не найден: forecast_details.js");
                    const loaded = { exports: {} };
                    new Function("module", await app.vault.read(script))(loaded);
                    openDetails = loaded.exports;
                    if (typeof openDetails !== "function") throw new Error("Модуль расчёта недоступен");
                }
                if (disposed) return;
                dialog = await openDetails({ app, obsidian, doc, sourcePath,
                    reportReference: fm["Расчёт прогноза"], trigger: box, parent: root });
                if (disposed) dialog?.close?.();
            } catch (error) {
                if (!disposed) {
                    let message = root.querySelector(".kino-forecast-load-error");
                    if (!message) message = element(root, "p", "kino-forecast-load-error");
                    message.setAttribute("role", "alert");
                    message.textContent = "Не удалось открыть расчёт: " + (error.message || error);
                }
            } finally { loading = false; box.removeAttribute("aria-busy"); }
        });
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

    if (kind === "media-properties") {
        root.classList.add("kino-ui-properties");
        propertyDetails();
        return root;
    }

    async function relatedWorks(actionParent) {
        let api = null;
        const moduleFile = app.vault.getAbstractFileByPath("Кино/_system/adaptation_links.js");
        if (moduleFile) {
            try { const loaded = { exports: {} }; new Function("module", await app.vault.read(moduleFile))(loaded); api = loaded.exports; }
            catch (error) { console.warn("Кино: связи произведений", error); }
        }
        if (disposed) return;
        const slot = element(root, "div", "kino-related-slot"), actions = element(root, "div", "kino-related-actions");
        actions.hidden = true;
        const add = element(actionParent, "button", "kino-related-add kino-meta-link-book", "Связать с книгой"); add.type = "button";
        const message = element(actions, "p", "kino-related-message"); message.hidden = true; message.setAttribute("role", "status");
        let expanded = true, timer;
        function fallback() {
            const links = new Map();
            for (const value of [...values(fm["Первоисточники"]), ...values(fm.adapted_from), ...values(fm.related)]) {
                const ref = linkParts(value); if (!ref) continue;
                links.set(ref.path.replace(/\.md$/i, ""), { target: ref.path, label: ref.label, type: ref.path.startsWith("Книги/") ? "book" : "movies" });
            }
            return [...links.values()];
        }
        function draw(payload) {
            if (disposed) return;
            if (payload && api?.remember) for (const [path, data] of [[payload.bookPath, payload.bookFm], [payload.mediaPath, payload.mediaFm]]) {
                const target = path && app.vault.getAbstractFileByPath(path); if (target && data) api.remember(app, target, data);
            }
            const list = api?.related && file ? api.related({ app, file, fm: app.metadataCache.getFileCache(file)?.frontmatter || fm }) : fallback();
            const previous = slot.querySelector("details"); if (previous) expanded = previous.open;
            slot.replaceChildren();
            if (!list.length) return;
            const box = element(slot, "details", "kino-related-panel"); box.open = expanded;
            const summary = element(box, "summary"); element(summary, "span", "kino-related-heading", "Связанные произведения");
            element(summary, "span", "kino-related-count", list.length);
            const items = element(box, "div", "kino-related-list");
            for (const link of list) {
                const item = internalLink(items, { path: link.target, display: "" }); item.classList.add("kino-related-item");
                const icon = element(item, "span", "kino-related-icon", link.type === "book" ? "Аа" : link.type === "serial" ? "▣" : "▷"); icon.setAttribute("aria-hidden", "true");
                const main = element(item, "span", "kino-related-main"); element(main, "span", "kino-related-title", link.label);
                const type = link.type === "book" ? "Книга" : link.type === "serial" ? "Сериал" : "Фильм";
                element(main, "span", "kino-related-meta", [type, link.author, link.year, link.missing ? "Ссылка недоступна" : ""].filter(Boolean).join(" · "));
                element(item, "span", "kino-related-arrow", "↗").setAttribute("aria-hidden", "true");
            }
        }
        draw();
        add.addEventListener("click", async () => {
            if (add.disabled || disposed) return;
            add.disabled = true; message.hidden = true; actions.hidden = true;
            try {
                const quickAdd = app.plugins?.plugins?.quickadd?.api;
                if (!quickAdd?.executeChoice) throw new Error("Включи QuickAdd для добавления связи.");
                await quickAdd.executeChoice("Книги - Связать с кино", { adaptationRequest: { path: sourcePath, onLinked: draw } });
            } catch (error) { if (!disposed) { actions.hidden = false; message.hidden = false; message.textContent = "Не удалось добавить связь: " + (error.message || error); } }
            finally { if (!disposed) add.disabled = false; }
        });
        const schedule = changed => {
            if (changed?.path && !/^(?:Кино|Книги)\//.test(changed.path)) return;
            clearTimeout(timer); timer = setTimeout(draw, 100);
        };
        for (const [owner, events, handler] of [[app.workspace, ["kino:adaptations-changed"], draw], [app.metadataCache, ["changed"], schedule], [app.vault, ["create", "delete", "rename"], schedule]]) {
            if (!owner?.on) continue;
            for (const event of events) { const ref = owner.on(event, handler); cleanup(() => owner.offref?.(ref)); }
        }
        cleanup(() => clearTimeout(timer));
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

    if (!["dashboard", "system", "entity"].includes(kind)) {
        const header = element(root, "header", "kino-card-header" + (kind === "franchise" ? " kino-franchise-header" : ""));
        if (kind === "franchise") {
            const nav = element(header, "nav", "kino-franchise-nav");
            nav.setAttribute("aria-label", "Разделы кинотеки");
            for (const [path, label] of [["Кино/_index", "← Кинотека"], ["Кино/_Кино.base#Карточки", "Каталог"], ["Кино/_system/Итоги просмотров", "Итоги просмотров"]]) {
                internalLink(nav, { path, display: label });
            }
        }
        const tags = values(fm.tags).map(value => text(value).replace(/^#/, ""));
        const type = kind === "media" ? tags.includes("serial") ? "Сериал" : "Фильм"
            : kind === "franchise" ? "Франшиза" : kind === "season" ? "Сезон" : kind === "roles" ? "Роли и создатели" : "Просмотр";
        element(header, "div", "kino-eyebrow", type);
        const rawTitle = String(current.file?.name ?? file?.basename ?? "Кино");
        const title = kind === "roles" ? rawTitle.replace(/\.роли$/, "") : rawTitle;
        element(header, "h1", "kino-card-title", title);
        const original = text(fm["Название"]).trim();
        if (kind === "media" && original && original !== title) element(header, "p", "kino-original-title", original);
        const meta = element(header, "div", "kino-card-meta");
        if (kind === "franchise") {
            const byPart = text(fm["Порядок"]).trim().toLowerCase() === "части";
            element(meta, "span", "kino-franchise-order", "Порядок: " + (byPart ? "по номерам частей" : "по дате выхода"));
        }
        if (kind === "media") {
            meta.classList.add("kino-media-meta");
            meta.tabIndex = 0; meta.setAttribute("aria-label", "Релиз, просмотр, продолжительность и связь с книгой");
            const release = element(meta, "span", "kino-meta-chip", `Релиз: ${present(fm["Релиз"]) ? dateLabel(fm["Релиз"]) : "—"}`);
            if (present(fm["Релиз"]) && !/^\d{2}\.\d{2}\.\d{4}$/.test(dateLabel(fm["Релиз"]))) release.title = "Полная дата релиза в карточке не указана";
            element(meta, "span", "kino-meta-chip", `Просмотрено ${present(fm["Просмотрено"]) ? dateLabel(fm["Просмотрено"]) : "—"}`);
            element(meta, "span", "kino-meta-chip", `Продолжительность: ${durationLabel(fm["Время"])}`);
            if (number(fm["Количество сезонов"]) != null) element(element(header, "div", "kino-card-extra-meta"), "span", "kino-meta-chip", `Сезонов: ${text(fm["Количество сезонов"])}`);
        } else {
            const related = kind === "roles" ? fm["Основная карточка"] : fm["Фильм"] ?? fm["Сериал"];
            if (related) internalLink(meta, related);
            if (present(fm["Дата"]) || present(fm["Год"])) element(meta, "span", "kino-meta-chip", dateLabel(fm["Дата"] ?? fm["Год"]));
            if (kind === "season" && present(fm["Сезон"])) element(meta, "span", "kino-meta-chip", `Сезон ${text(fm["Сезон"])}`);
            if (kind === "viewing" && present(fm["Просмотр"])) element(meta, "span", "kino-meta-chip", `Просмотр ${text(fm["Просмотр"])}`);
            if (kind === "roles") {
                const count = values(fm["Роли актеров"]).filter(present).length;
                if (count) element(meta, "span", "kino-meta-chip", `Ролей: ${count}`);
            }
        }
        if (kind === "media") {
            const ratings = element(root, "div", "kino-scores");
            score(ratings, "Моя оценка", fm["Оценка"], "kino-score-personal");
            const imdb = text(fm["imdb Id"]).match(/^tt\d+$/)?.[0];
            const kp = text(fm["Кинопоиск ID"]).match(/^\d+$/)?.[0];
            score(ratings, "IMDb", fm["Оценка Imdb"], "", imdb ? `https://www.imdb.com/title/${imdb}/` : null, fm["Количество голосов Imdb"]);
            score(ratings, "Кинопоиск", fm["Оценка Кинопоиск"], "", kp ? `https://www.kinopoisk.ru/film/${kp}/` : null, fm["Количество голосов Кинопоиск"]);
            forecastScore(ratings);
            if (present(fm["Описание"])) {
                const synopsis = element(root, "section", "kino-synopsis");
                element(synopsis, "h2", "kino-section-label", "О фильме".replace("фильме", tags.includes("serial") ? "сериале" : "фильме"));
                await richText(synopsis, "kino-synopsis-text", fm["Описание"]);
            }
            const credits = element(root, "div", "kino-credits");
            for (const [key, label, choice] of [["Режисер", "Режиссёр", "Кино - Открыть режиссера"], ["Жанр", "Жанры", "Кино - Открыть жанр"], ["Франшиза", "Франшиза", null]]) {
                const list = values(fm[key]).filter(present);
                if (!list.length) continue;
                const row = element(credits, "div", "kino-credit-row" + (choice ? " kino-credit-row-featured" : ""));
                element(row, "span", "kino-credit-label", label);
                const links = element(row, "div", "kino-credit-values");
                list.forEach(value => choice ? entityLink(links, value, choice) : internalLink(links, value));
            }
            await relatedWorks(meta);
        } else if (number(fm["Оценка"]) != null) {
            score(element(root, "div", "kino-scores kino-scores-single"), "Моя оценка", fm["Оценка"], "kino-score-personal");
        }
    }
    if (["season", "viewing"].includes(kind) && present(fm["Комментарий"])) {
        const notes = element(root, "section", "kino-comment");
        element(notes, "h2", "kino-section-label", "Мои впечатления");
        await richText(notes, "kino-comment-text", fm["Комментарий"]);
    }
    if (!["media", "dashboard", "system", "entity"].includes(kind)) propertyDetails();
    if (kind === "media") roleDetails();
    if (disposed) return;
    for (const [selector, cls] of [[".kino-card-title", "kino-has-card-title"], [".kino-properties", "kino-has-properties"]]) {
        if (root.querySelector(selector)) acquireClass(cls);
    }
    if (!Object.keys(fm).some(key => !["position", "file", "cssclasses", "obsidianUIMode"].includes(key))) acquireClass("kino-cosmetic-properties");

    const duplicateTitles = new Set();
    cleanup(() => { for (const heading of duplicateTitles) heading.classList.remove("kino-duplicate-title"); });
    const markedPosters = new Set();
    cleanup(() => { for (const image of markedPosters) image.classList.remove("kino-card-poster"); });
    function markPoster() {
        if (kind !== "media" || !present(fm.poster)) return;
        const poster = text(fm.poster).trim();
        for (const image of view.querySelectorAll("img")) {
            if (image.closest(".markdown-embed, .kino-ui-root") || image.classList.contains("kino-card-poster")) continue;
            if (image.getAttribute("src") !== poster && image.getAttribute("data-src") !== poster) continue;
            image.classList.add("kino-card-poster"); markedPosters.add(image);
        }
    }
    function markDuplicateTitle() {
        if (kind !== "franchise") return;
        const title = root.querySelector(".kino-card-title")?.textContent.trim();
        const original = [...view.querySelectorAll(".markdown-preview-section h1")]
            .find(heading => !heading.closest(".kino-ui-root, .markdown-embed, .block-language-dataviewjs"));
        if (original?.textContent.trim() !== title || original.classList.contains("kino-duplicate-title")) return;
        original.classList.add("kino-duplicate-title"); duplicateTitles.add(original);
    }

    // Wrap read-only tables, including those Dataview renders after this block.
    function wrapTables() {
        for (const table of view.querySelectorAll("table")) {
            if (table.closest(".kino-table-wrap, .kino-forecast-table-wrap, .bases-view, .bases-table, .bases-cards, .cm-content")) continue;
            const wrapper = doc.createElement("div"); wrapper.className = "kino-table-wrap";
            wrapper.tabIndex = 0; wrapper.setAttribute("role", "region");
            wrapper.setAttribute("aria-label", "Таблица с горизонтальной прокруткой");
            table.before(wrapper); wrapper.appendChild(table);
        }
    }
    markDuplicateTitle();
    markPoster();
    wrapTables();
    const Observer = doc.defaultView?.MutationObserver;
    if (Observer) {
        let queued = false;
        const observer = new Observer(() => {
            if (queued || disposed) return;
            queued = true;
            Promise.resolve().then(() => { queued = false; if (!disposed) { markDuplicateTitle(); markPoster(); wrapTables(); } });
        });
        observer.observe(view, { childList: true, subtree: true });
        cleanup(() => observer.disconnect());
    }
    // Check deferred work on normal Kino openings, even if cancellation happened
    // before provisional scores were written. Empty queues never load the engine.
    // The service owns the session limit, backfill lock and actual computation.
    const resumeKey = Symbol.for("kino.forecast.ui-resume.v4");
    const queueFile = ["media", "system", "dashboard"].includes(kind)
        ? app.vault.getAbstractFileByPath("Кино/_system/Прогноз/queue.json")
            ?? app.vault.getAbstractFileByPath("_system/Прогноз/queue.json") : null;
    const provisional = /^Предварительный/i.test(text(fm["Статус прогноза"]).trim());
    if (["media", "system", "dashboard"].includes(kind) && (provisional || queueFile)) {
        Promise.resolve().then(async () => {
            if (disposed || app.__kinoRatingUpdate || app.__kinoForecastResuming) return;
            const state = app[resumeKey] && typeof app[resumeKey] === "object" ? app[resumeKey] : (app[resumeKey] = {});
            if (state.running) return;
            state.running = true;
            try {
                if (queueFile) {
                    const stamp = queueFile.stat ? `${queueFile.path}:${queueFile.stat.mtime}:${queueFile.stat.size}` : null;
                    if (stamp === null || stamp !== state.queueStamp) {
                        const queue = JSON.parse(await app.vault.read(queueFile));
                        state.queueHasWork = Boolean(queue?.entries && Object.keys(queue.entries).length);
                        state.queueStamp = stamp;
                    }
                    if (!state.queueHasWork) return;
                }
                if (disposed || app.__kinoRatingUpdate || app.__kinoForecastResuming) return;
                const script = app.vault.getAbstractFileByPath("Кино/_system/predict_rating.js")
                    ?? app.vault.getAbstractFileByPath("_system/predict_rating.js");
                if (!script) return;
                const version = script.stat?.mtime ?? 0;
                if (!state.api || state.version !== version) {
                    const loaded = { exports: {} };
                    new Function("module", await app.vault.read(script))(loaded);
                    state.api = loaded.exports; state.version = version;
                }
                await state.api.resume?.({ app, obsidian });
            } finally { state.running = false; }
        }).catch(error => console.warn("Кино: продолжение отложенного прогноза", error));
    }
    return root;
};
