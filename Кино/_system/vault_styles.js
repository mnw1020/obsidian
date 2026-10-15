/* Global styles stored with their collections. No snippets or external requests. */
module.exports = async function startVaultStyles({ app, document = globalThis.document, onError = console.error }) {
    const paths = [
        'Кино/_system/movies-dashboard.css',
        'Книги/_system/bases-no-create.css',
        'Кино/_system/kino-entity-links.css',
        'Книги/_system/books-library.css',
        'Кино/_system/kino-design.css'
    ];
    const sources = new Map(), documents = new Map(), timers = new Map(), generations = new Map(), listeners = [];
    let disposed = false;
    function syncDocuments() {
        if (disposed) return;
        const current = new Set([document]);
        app.workspace.iterateAllLeaves?.(leaf => { if (leaf.containerEl?.ownerDocument) current.add(leaf.containerEl.ownerDocument); });
        for (const [doc, nodes] of documents) if (doc.defaultView?.closed || !current.has(doc)) {
            for (const node of nodes.values()) node.remove();
            documents.delete(doc);
        }
        for (const doc of current) {
            if (!doc?.head || doc.defaultView?.closed) continue;
            let nodes = documents.get(doc);
            if (!nodes) { nodes = new Map(); documents.set(doc, nodes); }
            for (const path of paths) {
                let node = nodes.get(path);
                if (!sources.has(path)) { node?.remove(); nodes.delete(path); continue; }
                if (!node) {
                    node = doc.createElement('style'); node.dataset.collectionStyle = path;
                    nodes.set(path, node);
                }
                const css = sources.get(path);
                if (node.textContent !== css) node.textContent = css;
                // Keep the original cascade order, including after a file returns.
                doc.head.appendChild(node);
            }
        }
    }
    async function refresh(path, generation) {
        try {
            const css = await app.vault.adapter.read(path);
            if (disposed || generation !== generations.get(path)) return;
            if (!css.trim()) throw Error('Файл стилей пуст: ' + path);
            sources.set(path, css);
        } catch (error) {
            if (disposed || generation !== generations.get(path)) return;
            // A failed sync/read retains the last working CSS. Confirmed deletion
            // removes it; a subsequent create/rename restores it automatically.
            let exists = true;
            try { exists = await app.vault.adapter.exists(path); } catch (_) { /* Keep working CSS while storage is unavailable. */ }
            if (!exists) sources.delete(path);
            if (disposed || generation !== generations.get(path)) return;
            onError('Не удалось загрузить оформление: ' + path, error);
        }
        syncDocuments();
    }
    function schedule(path) {
        if (disposed || !paths.includes(path)) return;
        const generation = (generations.get(path) || 0) + 1;
        generations.set(path, generation);
        clearTimeout(timers.get(path));
        timers.set(path, setTimeout(() => { timers.delete(path); void refresh(path, generation); }, 100));
    }
    function listen(owner, name, callback) {
        if (!owner?.on) return;
        const ref = owner.on(name, callback); listeners.push(() => owner.offref?.(ref));
    }
    function dispose() {
        if (disposed) return;
        disposed = true;
        for (const timer of timers.values()) clearTimeout(timer);
        timers.clear();
        for (const remove of listeners) remove();
        for (const nodes of documents.values()) for (const node of nodes.values()) node.remove();
        documents.clear(); sources.clear();
    }
    for (const name of ['create', 'modify', 'delete']) listen(app.vault, name, file => schedule(file?.path));
    listen(app.vault, 'rename', (file, oldPath) => { schedule(oldPath); schedule(file?.path); });
    for (const name of ['layout-change', 'active-leaf-change']) listen(app.workspace, name, syncDocuments);
    await Promise.all(paths.map(path => {
        generations.set(path, 1); return refresh(path, 1);
    }));
    syncDocuments();
    return { dispose, paths: [...paths], loaded: [...sources.keys()] };
};
