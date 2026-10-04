// Lightweight home widgets; Bases components are unloaded when collapsed.
module.exports = async ({ dv, app, obsidian = {}, target, label, mode = "base", expanded = false }) => {
    let disposed = false;
    dv.component?.register(() => { disposed = true; });

    if (mode === "actions") {
        const api = app.plugins?.plugins?.quickadd?.api;
        if (!api?.executeChoice) return;
        const bar = dv.container.createDiv({ cls: "books-actionbar" });
        const actions = [
            ["➕ Записать произведение", "Книги - Добавить книгу"],
            ["📖 Записать чтение", "Книги - Добавить чтение"],
            ["✒️ Добавить выписку", "Книги - Добавить выписку"]
        ];
        const buttons = actions.map(([text]) => bar.createEl("button", { text, cls: "books-action" }));
        actions.forEach(([label, choice], index) => {
            const click = async () => {
                if (disposed || buttons.some(button => button.disabled)) return;
                buttons.forEach(button => { button.disabled = true; });
                try { await api.executeChoice(choice); }
                catch (error) {
                    if (/^Input cancel(?:led|ed) by user\.?$/i.test(String(error?.message || error))) return;
                    if (obsidian.Notice) new obsidian.Notice(`Не удалось открыть «${label}»: ${String(error?.message || error)}`);
                } finally { buttons.forEach(button => { button.disabled = false; }); }
            };
            buttons[index].addEventListener("click", click);
            dv.component?.register(() => buttons[index].removeEventListener("click", click));
        });
        const preview = dv.container.closest?.(".markdown-preview-view, .markdown-source-view");
        const fallback = preview?.querySelector?.(".books-actions-fallback");
        if (fallback) fallback.style.display = "none";
        return;
    }

    async function loadCore() {
        const file = app.vault.getAbstractFileByPath("Книги/_system/book_core.js");
        if (!file) throw new Error("Модуль библиотеки не найден.");
        const module = { exports: {} };
        new Function("module", await app.vault.read(file))(module);
        return module.exports({ app, obsidian });
    }

    function watch(render) {
        let timer = null;
        const schedule = () => {
            if (disposed) return;
            clearTimeout(timer);
            timer = setTimeout(() => { if (!disposed) render(); }, 120);
        };
        for (const [emitter, event] of [[app.metadataCache, "changed"], [app.vault, "delete"], [app.vault, "create"], [app.vault, "rename"]]) {
            if (emitter?.on && dv.component?.registerEvent) dv.component.registerEvent(emitter.on(event, schedule));
        }
        dv.component?.register(() => clearTimeout(timer));
    }

    if (mode === "stats") {
        try {
            const core = await loadCore();
            if (disposed) return;
            const grid = dv.container.createDiv({ cls: "books-stat-grid" });
            const metrics = [["books", "Произведений"], ["authors", "Авторов"], ["series", "Серий"], ["rated", "Оценено"], ["reread", "Перечитано"]];
            const values = metrics.map(([key, text]) => {
                const card = grid.createDiv({ cls: "books-stat-card" });
                const value = card.createEl("strong", { cls: "books-stat-value" });
                card.createEl("span", { text: ` ${text}`, cls: "books-stat-label" });
                return [key, value];
            });
            const render = () => {
                const stats = core.stats();
                for (const [key, element] of values) element.textContent = String(stats[key]);
                // Keep the Markdown snapshot available when Dataview is disabled.
                const preview = dv.container.closest?.(".markdown-preview-view, .markdown-source-view");
                const fallback = [...(preview?.querySelectorAll?.('.callout[data-callout="quote"]') || [])]
                    .find(node => node.querySelector?.(".callout-title-inner")?.textContent?.trim() === "Библиотека");
                if (fallback) fallback.style.display = "none";
            };
            render();
            watch(render);
        } catch (error) {
            dv.paragraph(`Статистика: ${String(error?.message || error)}`);
        }
        return;
    }

    let core = null;
    if (mode === "reread") {
        try { core = await loadCore(); }
        catch (_) { /* The normal Bases toggle remains available. */ }
        if (disposed) return;
    }
    const section = dv.container.createDiv({ cls: "books-base-section" });
    const empty = section.createEl("p", { text: "Перечитываний пока нет. Новое чтение сохранит отдельные впечатления и оценку.", cls: "books-empty" });
    const button = section.createEl("button", { text: `Показать ${label}`, cls: "books-base-toggle" });
    const content = section.createDiv({ cls: "books-base-content" });
    let child = null;
    let busy = false;

    function collapse() {
        if (child) dv.component?.removeChild(child);
        child = null;
        content.empty();
        button.textContent = `Показать ${label}`;
        button.setAttribute("aria-expanded", "false");
    }

    function renderEmptyState() {
        const isEmpty = mode === "reread" && core && core.stats().reread === 0;
        empty.style.display = isEmpty ? "" : "none";
        button.style.display = isEmpty ? "none" : "";
        if (isEmpty) collapse();
    }

    async function toggle() {
        if (busy || disposed) return;
        if (child) { collapse(); return; }
        if (!obsidian.MarkdownRenderer || !obsidian.Component || !dv.component) {
            content.empty();
            content.createEl("a", { text: "Открыть представление", href: `obsidian://open?file=${encodeURIComponent(target)}` });
            return;
        }
        busy = true;
        button.disabled = true;
        try {
            child = new obsidian.Component();
            dv.component.addChild(child);
            await obsidian.MarkdownRenderer.render(app, `![[${target}]]`, content, dv.current().file.path, child);
            if (disposed) { collapse(); return; }
            button.textContent = `Скрыть ${label}`;
            button.setAttribute("aria-expanded", "true");
        } catch (error) {
            collapse();
            content.textContent = `Не удалось показать таблицу: ${String(error?.message || error).slice(0, 160)}`;
        } finally {
            busy = false;
            button.disabled = false;
        }
    }

    button.setAttribute("aria-expanded", "false");
    button.addEventListener("click", toggle);
    dv.component?.register(() => { button.removeEventListener("click", toggle); collapse(); });
    renderEmptyState();
    if (core) watch(renderEmptyState);
    if (expanded && button.style.display !== "none") await toggle();
};
