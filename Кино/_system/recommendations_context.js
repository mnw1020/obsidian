/* A recommendation selection belongs to a workspace leaf, not a Dataview block.
   Markdown can replace that block while the leaf still shows the same page. */
const PAGE_PATH = "Кино/_system/Рекомендации.md";
const REGISTRY_KEY = Symbol.for("kino.recommendations.contexts.v1");
const LEGACY_KEY = Symbol.for("kino.recommendations.launch");
const pathOf = leaf => String(leaf?.view?.file?.path || "").replace(/\\/g, "/");

function allLeaves(workspace) {
    const leaves = new Set();
    let available = false;
    if (typeof workspace?.iterateAllLeaves === "function") {
        try { workspace.iterateAllLeaves(leaf => { leaves.add(leaf); }); available = true; } catch (_) {}
    }
    if (!available && typeof workspace?.getLeavesOfType === "function") {
        try { for (const leaf of workspace.getLeavesOfType("markdown") || []) leaves.add(leaf); available = true; } catch (_) {}
    }
    if (!available && workspace?.activeLeaf) leaves.add(workspace.activeLeaf);
    return { leaves, available };
}

function registry(app) {
    let contexts = app[REGISTRY_KEY];
    if (!(contexts instanceof Map)) contexts = app[REGISTRY_KEY] = new Map();
    if (!contexts.kinoListenersInstalled) {
        contexts.kinoListenersInstalled = true;
        const prune = () => {
            const live = allLeaves(app.workspace);
            for (const [owner, context] of contexts) {
                if (context.opening) continue;
                if (context.leaf) {
                    if ((live.available && !live.leaves.has(owner)) || pathOf(owner) !== PAGE_PATH) contexts.delete(owner);
                } else if (owner?.isConnected === false) contexts.delete(owner);
            }
        };
        app.workspace?.on?.("file-open", prune);
        app.workspace?.on?.("layout-change", prune);
    }
    return contexts;
}

function ownerFor(app, container) {
    if (!container) return null;
    const { leaves, available } = allLeaves(app.workspace);
    for (const leaf of leaves) {
        if (leaf.view?.containerEl?.contains?.(container) || leaf.containerEl?.contains?.(container)) {
            return { key: leaf, leaf };
        }
    }
    // Small standalone previews do not have a WorkspaceLeaf. Real Obsidian
    // renderers must resolve their leaf so that other panes cannot claim them.
    if (!available) {
        const view = container.closest?.(".markdown-preview-view, .markdown-source-view");
        if (view) return { key: view, leaf: null };
    }
    return null;
}

function blank(leaf, container) {
    return { leaf, container, state: null, viewSession: null, opening: false, refresh: null };
}

function current(options) {
    const { app, container, saved } = options;
    const owner = ownerFor(app, container);
    if (!owner) return null;
    const contexts = registry(app);
    let context = contexts.get(owner.key);
    if (owner.leaf && pathOf(owner.leaf) !== PAGE_PATH && !context?.opening) {
        contexts.delete(owner.key);
        return null;
    }
    // Old already-rendered buttons can still issue the former one-shot token.
    // Only the active destination may adopt it; a background pane cannot.
    if (owner.leaf && app.workspace?.activeLeaf === owner.leaf && saved?.reference &&
        saved.updatedAt && app[LEGACY_KEY] === saved.updatedAt) {
        delete app[LEGACY_KEY];
        context = { ...blank(owner.leaf, container), state: {
            ...saved, sourceSettings: { ...(saved.sourceSettings || {}), kp: false }
        } };
        contexts.set(owner.key, context);
    }
    if (!context) {
        context = blank(owner.leaf, container);
        contexts.set(owner.key, context);
    }
    // Calls from an old async render's isCurrent guard must remain read-only.
    if (!context.container || Object.prototype.hasOwnProperty.call(options, "saved")) context.container = container;
    return context;
}

async function open({ app, state, page, sourcePath }) {
    if (!state?.reference) throw new Error("Не выбран фильм для рекомендаций.");
    page ||= app.vault?.getAbstractFileByPath?.(PAGE_PATH);
    if (!page) throw new Error("Не найдена страница рекомендаций.");
    const workspace = app.workspace;
    const leaf = workspace?.getLeaf?.(false) || workspace?.activeLeaf;
    if (!leaf?.openFile) throw new Error("Не удалось выбрать окно для рекомендаций.");
    const contexts = registry(app);
    const previous = contexts.get(leaf);
    const canRefresh = pathOf(leaf) === PAGE_PATH && previous?.container &&
        previous.container.isConnected !== false && typeof previous.refresh === "function";
    const retainedRefresh = canRefresh ? previous.refresh : null;
    const context = { ...blank(leaf, null), state, opening: true, refresh: retainedRefresh };
    contexts.set(leaf, context);
    try {
        await leaf.openFile(page, { active: true });
        workspace.setActiveLeaf?.(leaf, { focus: true });
    } catch (error) {
        if (contexts.get(leaf) === context) {
            if (previous && pathOf(leaf) === PAGE_PATH) contexts.set(leaf, previous);
            else contexts.delete(leaf);
        }
        throw error;
    } finally { context.opening = false; }
    if (contexts.get(leaf) === context && retainedRefresh && context.refresh === retainedRefresh) {
        await retainedRefresh(context);
    }
    return context;
}

module.exports = { open, current };
