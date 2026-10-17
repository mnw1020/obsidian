/* Dataview headings have no Markdown source positions. Feed their real DOM
   nodes to the existing Outline tree, scoped to the Markdown leaf that owns
   this page. No note text or MetadataCache entry is changed.

   Outline has no public dynamic-heading provider. The methods below are
   feature-detected on its existing view instances (Obsidian 1.14), and every
   instance method/event hook is restored when the last page is disposed. */
const KEY = Symbol.for("kino.recommendations.outline.v1");
const HEADING = Symbol("kino.recommendations.dom-heading");
const PAGE_PATH = "Кино/_system/Рекомендации.md";
const normalize = value => String(value || "").replace(/\\/g, "/").toLowerCase();

function markdownLeaves(workspace) {
    if (typeof workspace?.getLeavesOfType === "function") return workspace.getLeavesOfType("markdown") || [];
    const leaves = [];
    workspace?.iterateAllLeaves?.(leaf => { leaves.push(leaf); });
    return leaves;
}

function findOwner(app, container) {
    return markdownLeaves(app.workspace).find(leaf =>
        normalize(leaf.view?.file?.path) === normalize(PAGE_PATH) &&
        (leaf.view?.containerEl?.contains?.(container) || leaf.containerEl?.contains?.(container))
    ) || null;
}

function visibleHeading(node) {
    if (node.isConnected === false || node.closest?.("[hidden]")) return false;
    // A hidden result group must not leave an entry in the sidebar.
    return typeof node.getClientRects !== "function" || node.getClientRects().length > 0;
}

function createCoordinator(app, win) {
    const sessions = new Map();
    const patches = new Map();
    const events = [];
    let timer = null;
    let destroyed = false;

    function contextFor(view) {
        if (normalize(view.file?.path) !== normalize(PAGE_PATH)) return null;
        let leaf;
        try { leaf = view.findCorrespondingLeaf(); } catch (_) { return null; }
        const session = sessions.get(leaf);
        if (!session || session.disposed || session.container.isConnected === false ||
            normalize(leaf?.view?.file?.path) !== normalize(PAGE_PATH)) return null;
        return session;
    }

    function headingsFor(session) {
        return Array.from(session.container.querySelectorAll("h1,h2,h3,h4,h5,h6"))
            .filter(visibleHeading)
            .map(node => ({
                heading: node.textContent.trim(), level: Number(node.tagName.slice(1)),
                [HEADING]: { session, node }
            })).filter(heading => heading.heading);
    }

    function scrollTo(view, item, event) {
        const target = item.heading?.[HEADING];
        if (!target || contextFor(view) !== target.session || target.node.isConnected === false) return false;
        event?.preventDefault?.();
        app.workspace.setActiveLeaf?.(target.session.leaf, { focus: true });
        // DOM navigation, including Ctrl/keyboard activation, always returns to
        // this particular source pane instead of an identically named note.
        target.node.scrollIntoView({ block: "start", behavior: "smooth" });
        view.setHighlightedItem?.(item);
        return true;
    }

    function install(view) {
        if (patches.has(view)) return;
        const names = ["getHeadings", "createItemDom", "findActiveHeading"];
        if (!names.every(name => typeof view[name] === "function") ||
            typeof view.findCorrespondingLeaf !== "function" ||
            typeof view.update !== "function" || !Array.isArray(view.cachedHeadingDom) ||
            !view.contentEl?.addEventListener) return;

        const originals = new Map(names.map(name => [name, {
            descriptor: Object.getOwnPropertyDescriptor(view, name), method: view[name]
        }]));
        const items = new Map();
        const wrapItem = item => {
            if (!item?.heading?.[HEADING] || items.has(item)) return;
            const descriptor = Object.getOwnPropertyDescriptor(item, "onSelfClick");
            const original = item.onSelfClick;
            item.onSelfClick = function (event) {
                if (scrollTo(view, this, event)) return;
                // A reused native item may already have a real cached
                // Markdown heading after the user switched to another note.
                if (!this.heading?.[HEADING]) return original.call(this, event);
            };
            items.set(item, { descriptor, original });
        };
        const wrappers = {
            getHeadings(...args) {
                const session = contextFor(this);
                return session ? headingsFor(session) : originals.get("getHeadings").method.apply(this, args);
            },
            createItemDom(heading, ...args) {
                const item = originals.get("createItemDom").method.call(this, heading, ...args);
                wrapItem(item);
                return item;
            },
            findActiveHeading(...args) {
                const session = contextFor(this);
                if (!session) {
                    if (this.cachedHeadingDom.some(item => item.heading?.[HEADING])) return null;
                    return originals.get("findActiveHeading").method.apply(this, args);
                }
                const viewport = session.container.closest?.(".markdown-preview-view,.markdown-source-view") ||
                    session.leaf.view?.contentEl || session.container;
                const top = viewport.getBoundingClientRect().top + 48;
                let active = null;
                for (const item of this.cachedHeadingDom) {
                    const target = item.heading?.[HEADING];
                    if (!target || target.session !== session || !visibleHeading(target.node)) continue;
                    if (!active || target.node.getBoundingClientRect().top <= top) active = item;
                }
                return active;
            }
        };
        for (const name of names) view[name] = wrappers[name];

        // Dynamic headings have no source range to rearrange or link-preview.
        // Keep native collapse/search behavior, but block source-editing DnD
        // and hover previews that would otherwise resolve a nonexistent anchor.
        const stopDynamic = event => {
            const self = event.target?.closest?.(".tree-item-self");
            if (!self) return;
            const dynamic = view.cachedHeadingDom.some(item =>
                item.selfEl === self && item.heading?.[HEADING] && contextFor(view)
            );
            if (dynamic) { event.preventDefault(); event.stopImmediatePropagation(); }
        };
        view.contentEl.addEventListener("dragstart", stopDynamic, true);
        view.contentEl.addEventListener("pointerover", stopDynamic, true);
        const restoreItem = (item, state) => {
            if (state.descriptor) Object.defineProperty(item, "onSelfClick", state.descriptor);
            else delete item.onSelfClick;
        };
        const restore = () => {
            view.contentEl.removeEventListener("dragstart", stopDynamic, true);
            view.contentEl.removeEventListener("pointerover", stopDynamic, true);
            for (const [item, state] of items) restoreItem(item, state);
            items.clear();
            for (const [name, state] of originals) {
                if (view[name] !== wrappers[name]) continue;
                if (state.descriptor) Object.defineProperty(view, name, state.descriptor);
                else delete view[name];
            }
            // Old synthetic tree items must not pass through source-line
            // navigation after the adapter has been removed.
            view.cachedHeadingDom = [];
            view.activeEl = null;
            try { view.update(); } catch (_) { /* A closing view may already be unloaded. */ }
        };
        restore.prune = () => {
            const live = new Set(view.cachedHeadingDom);
            // Native Outline also reuses items created before this adapter was
            // mounted. They may acquire a DOM heading without createItemDom
            // running, so adopt every live dynamic item after its update.
            for (const item of live) wrapItem(item);
            for (const [item, state] of items) if (!live.has(item)) {
                restoreItem(item, state);
                items.delete(item);
            }
        };
        patches.set(view, restore);
    }

    function flush() {
        timer = null;
        if (destroyed) return;
        for (const session of Array.from(sessions.values())) {
            if (session.container.isConnected === false ||
                normalize(session.leaf.view?.file?.path) !== normalize(PAGE_PATH)) session.dispose();
        }
        if (destroyed) return;
        const live = new Set((app.workspace.getLeavesOfType?.("outline") || []).map(leaf => leaf.view));
        for (const [view, restore] of patches) if (!live.has(view)) { restore(); patches.delete(view); }
        for (const view of live) {
            install(view);
            if (patches.has(view)) {
                try { view.update(); patches.get(view).prune(); } catch (_) { /* Fail closed if Outline internals changed. */ }
            }
        }
    }

    function schedule() {
        if (!destroyed && timer === null) timer = win.setTimeout(flush, 0);
    }

    const coordinator = {
        sessions, schedule,
        destroy() {
            if (destroyed) return;
            destroyed = true;
            if (timer !== null) win.clearTimeout(timer);
            timer = null;
            for (const event of events) app.workspace.offref?.(event);
            events.length = 0;
            for (const restore of patches.values()) restore();
            patches.clear();
            if (app[KEY] === coordinator) delete app[KEY];
        }
    };
    for (const name of ["layout-change", "active-leaf-change", "file-open"]) {
        const event = app.workspace.on?.(name, schedule);
        if (event) events.push(event);
    }
    return coordinator;
}

module.exports = function mountRecommendationsOutline({ app, container, component }) {
    const noop = () => {};
    if (!container?.ownerDocument || !app?.workspace) return noop;
    let leaf = findOwner(app, container);
    const win = container.ownerDocument.defaultView;
    if (!leaf || !win?.MutationObserver) return noop;
    const coordinator = app[KEY] || (app[KEY] = createCoordinator(app, win));
    const previous = coordinator.sessions.get(leaf);
    const session = { leaf, container, disposed: false, dispose: null };
    const observer = new win.MutationObserver(() => {
        if (session.disposed) return;
        if (container.isConnected === false) session.dispose();
        else coordinator.schedule();
    });
    session.dispose = () => {
        if (session.disposed) return;
        session.disposed = true;
        observer.disconnect();
        if (coordinator.sessions.get(leaf) === session) coordinator.sessions.delete(leaf);
        if (coordinator.sessions.size) coordinator.schedule();
        else coordinator.destroy();
        session.container = null;
        session.leaf = null;
        container = null;
        leaf = null;
    };
    session.dispose.refresh = coordinator.schedule;
    // Register the replacement first: disposal of the prior Dataview root must
    // neither remove this pane's new session nor tear down its shared hooks.
    coordinator.sessions.set(leaf, session);
    previous?.dispose();
    component?.register?.(session.dispose);
    observer.observe(container, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["hidden", "style"] });
    if (container.parentNode) observer.observe(container.parentNode, { childList: true });
    coordinator.schedule();
    return session.dispose;
};
