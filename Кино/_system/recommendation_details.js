// Recommendation groups belong to the current view; nothing is saved into the note.
module.exports = async function renderRecommendationDetails({
    app, container, groups = [], component, sourcePath = "", isCurrent = () => true
}) {
    let disposed = false;
    const cleanups = [];
    let content = null;
    const current = () => !disposed && isCurrent();
    const dispose = () => {
        if (disposed) return;
        disposed = true;
        for (const cleanup of cleanups.splice(0)) {
            try { cleanup(); } catch (_) { /* Continue removing the remaining listeners. */ }
        }
        // A previous render must never remove the next render's content.
        if (content?.parentNode === container) {
            content.remove();
            if (!container.childNodes.length) container.hidden = true;
        }
    };
    component?.register?.(dispose);
    if (!current()) return dispose;

    const visibleGroups = groups.filter(group => Array.isArray(group?.entries) && group.entries.length);
    if (!visibleGroups.length) {
        container.replaceChildren();
        container.hidden = true;
        return dispose;
    }

    const file = app.vault.getAbstractFileByPath("Кино/_system/recommendation_tables.js");
    if (!file) throw new Error("Не найден recommendation_tables.js");
    const source = await app.vault.read(file);
    if (!current()) return dispose;
    const tableModule = { exports: {} };
    new Function("module", source)(tableModule);
    if (typeof tableModule.exports.render !== "function") throw new Error("Не найден интерфейс таблиц рекомендаций");

    const doc = container.ownerDocument;
    content = doc.createElement("div");
    content.className = "kino-recommendation-details";
    const add = (parent, tag, text, className) => {
        const element = doc.createElement(tag);
        if (text !== undefined) element.textContent = String(text);
        if (className) element.className = className;
        parent.appendChild(element);
        return element;
    };
    const tableComponent = {
        register(cleanup) {
            if (typeof cleanup !== "function") return;
            if (disposed) cleanup();
            else cleanups.push(cleanup);
        }
    };
    const titleOf = film => film.ruTitle || film.enTitle || film.kpId || "Фильм";
    const filmUrl = film => {
        if (film.sourceUrl || film.url) return film.sourceUrl || film.url;
        if (film.kpId) return `https://www.kinopoisk.ru/${film.type === "series" ? "series" : "film"}/${encodeURIComponent(film.kpId)}/`;
        if (film.imdbId) return `https://www.imdb.com/title/${encodeURIComponent(film.imdbId)}/`;
        return "https://www.kinopoisk.ru/";
    };

    try {
        for (const group of visibleGroups) {
            if (!current()) { dispose(); return dispose; }
            const section = add(content, "section", undefined, "kino-recommendation-group");
            add(section, "h2", group.title || "Похожие фильмы");
            add(section, "p", "Почему предложены:");
            const reasonsList = add(section, "ul");
            const rows = [];
            for (const entry of group.entries) {
                const film = entry.film || {};
                const reasons = Array.isArray(entry.reasons) ? entry.reasons.filter(Boolean).map(String) : [];
                if (reasons.length) {
                    const reason = add(reasonsList, "li");
                    add(reason, "strong", titleOf(film));
                    reason.appendChild(doc.createTextNode(`: ${reasons.join("; ")}`));
                }
                rows.push({
                    ruTitle: titleOf(film), enTitle: film.enTitle || "", year: film.year || "",
                    libraryPath: film.libraryPath || "", url: filmUrl(film),
                    kpRating: film.kpRating ?? null, forecast: film.forecast ?? null,
                    description: String(film.description || film.local?.description || "").trim()
                });
            }
            if (!reasonsList.childNodes.length) reasonsList.remove();
            const tableHost = add(section, "div", undefined, "kino-recommendation-group-table");
            tableModule.exports.render({
                container: tableHost, current: () => ({ file: { path: sourcePath } }), component: tableComponent
            }, rows, app);
        }
        if (!current()) { dispose(); return dispose; }
        container.replaceChildren(content);
        container.hidden = false;
        return dispose;
    } catch (error) {
        dispose();
        throw error;
    }
};
