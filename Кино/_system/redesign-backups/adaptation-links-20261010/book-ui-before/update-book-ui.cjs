const fs = require('node:fs'), path = require('node:path');
const vault = path.resolve(__dirname, '../../../../..');
const cardPath = path.join(vault, 'Книги/_system/book_card.js');
const cssPath = path.join(vault, 'Книги/_system/books-library.css');
let card = fs.readFileSync(cardPath, 'utf8');
const oldStart = `    const fm = app.metadataCache.getFileCache(file)?.frontmatter || {};
    const container = dv.container;`;
const newStart = `    const fm = app.metadataCache.getFileCache(file)?.frontmatter || {};
    const container = dv.container;
    // Each rendered pane owns its listeners. A late callback must never revive an unloaded card.
    dv.component?.__bookRelationsCleanup?.();
    const relationRefs = [];
    let relationsDisposed = false, relationTimer;
    const disposeRelations = () => {
        relationsDisposed = true;
        clearTimeout(relationTimer);
        for (const [owner, ref] of relationRefs.splice(0)) owner.offref?.(ref);
    };
    if (dv.component) {
        dv.component.__bookRelationsCleanup = disposeRelations;
        dv.component.register?.(() => {
            disposeRelations();
            if (dv.component.__bookRelationsCleanup === disposeRelations) delete dv.component.__bookRelationsCleanup;
        });
    }
    let relationCore;
    const relationFile = app.vault.getAbstractFileByPath('Кино/_system/adaptation_links.js');
    if (relationFile) {
        try {
            const relationModule = { exports: {} };
            new Function('module', 'exports', await app.vault.read(relationFile))(relationModule, relationModule.exports);
            if (typeof relationModule.exports.related === 'function') relationCore = relationModule.exports;
        } catch (_) { /* The independent fallback keeps books usable if cinema is unavailable. */ }
    }
    if (relationsDisposed) return;`;
if (!card.includes(oldStart)) throw new Error('Book renderer initialization no longer matches');
card = card.replace(oldStart, newStart);
const oldRelationStart = card.indexOf('    const renderAdaptations = (values = fm.adaptations) => {');
const oldRelationEnd = card.indexOf('    const actions = el(hero', oldRelationStart);
if (oldRelationStart < 0 || oldRelationEnd < 0) throw new Error('Book relations region not found');
const relationCode = `    let relationsFm = fm;
    const renderAdaptations = payload => {
        if (relationsDisposed) return;
        // The command returns the exact saved properties before Obsidian's cache catches up.
        if (payload?.bookPath === source && payload.bookFm) relationsFm = payload.bookFm;
        else if (Array.isArray(payload)) relationsFm = { ...relationsFm, adaptations: payload };
        const links = relationCore ? relationCore.related({ app, file, fm: relationsFm }) :
            adaptationLinks({ app, file, fm: relationsFm }).map(link => {
                const target = app.metadataCache.getFirstLinkpathDest?.(link.target, source) ||
                    app.vault.getAbstractFileByPath(link.target + '.md');
                const meta = target && app.metadataCache.getFileCache(target)?.frontmatter || {};
                const tags = [].concat(meta.tags || []).map(tag => String(tag).replace(/^#/, ''));
                return { ...link, type: tags.includes('serial') ? 'serial' : 'movies',
                    year: String(meta['Релиз'] || meta['Год'] || '').match(/\\d{4}/)?.[0], missing: !target };
            });
        adaptations.replaceChildren();
        adaptations.hidden = !links.length;
        if (!links.length) return;
        const heading = el(adaptations, 'div', 'book-card-adaptations-heading');
        el(heading, 'span', 'book-card-label', 'Связанные произведения');
        el(heading, 'span', 'book-card-adaptations-count', String(links.length));
        const items = el(adaptations, 'div', 'book-card-adaptation-links');
        const types = { book: 'Книга', movies: 'Фильм', serial: 'Сериал' };
        for (const link of links) {
            const item = internal(items, '', link.target, 'book-card-adaptation' + (link.missing ? ' is-missing' : ''));
            item.dataset.type = link.type || 'movies';
            el(item, 'span', 'book-card-adaptation-icon', link.type === 'book' ? '▤' : link.type === 'serial' ? '▦' : '▷').setAttribute('aria-hidden', 'true');
            const body = el(item, 'span', 'book-card-adaptation-main');
            el(body, 'span', 'book-card-adaptation-title', link.label);
            const meta = [types[link.type] || 'Произведение', link.author, link.year].filter(Boolean);
            if (link.missing) meta.push('Файл не найден');
            el(body, 'span', 'book-card-adaptation-meta', meta.join(' · '));
            el(item, 'span', 'book-card-adaptation-arrow', '↗').setAttribute('aria-hidden', 'true');
        }
    };
    const watchRelations = (owner, event, callback) => {
        if (owner?.on && owner?.offref) relationRefs.push([owner, owner.on(event, callback)]);
    };
    const scheduleRelations = () => {
        clearTimeout(relationTimer);
        relationTimer = setTimeout(() => renderAdaptations(), 80);
    };
    watchRelations(app.workspace, 'kino:adaptations-changed', payload => {
        if (payload?.bookPath === source) renderAdaptations(payload);
    });
    watchRelations(app.metadataCache, 'changed', changed => {
        if (changed?.path === source) relationsFm = app.metadataCache.getFileCache(file)?.frontmatter || {};
        if (changed?.path === source || changed?.path?.startsWith('Кино/')) scheduleRelations();
    });
    watchRelations(app.metadataCache, 'resolved', () => {
        relationsFm = app.metadataCache.getFileCache(file)?.frontmatter || {};
        scheduleRelations();
    });
    for (const event of ['create', 'delete', 'rename']) watchRelations(app.vault, event, changed => {
        if (changed?.path === source || changed?.path?.startsWith('Кино/')) scheduleRelations();
    });
    renderAdaptations();
`;
card = card.slice(0, oldRelationStart) + relationCode + card.slice(oldRelationEnd);
card = card.replace('bookAdaptationRequest: { path: source, onLinked: renderAdaptations }', 'adaptationRequest: { path: source, onLinked: renderAdaptations }');
fs.writeFileSync(cardPath, card);

let css = fs.readFileSync(cssPath, 'utf8');
const cssStart = css.indexOf('.book-card .book-card-adaptations {');
const cssEnd = css.indexOf('.book-card.markdown-preview-view {', cssStart);
if (cssStart < 0 || cssEnd < 0) throw new Error('Book relation styles not found');
const relationCss = `.book-card .book-card-adaptations { margin: 22px 0 24px; padding-top: 20px; border-top: 1px solid var(--background-modifier-border); }
.book-card .book-card-adaptations[hidden] { display: none; }
.book-card .book-card-adaptations-heading { display: flex; align-items: center; gap: 9px; margin-bottom: 12px; }
.book-card .book-card-adaptations-count { color: var(--book-card-accent); font-size: .7em; line-height: 1.5; font-variant-numeric: tabular-nums; }
.book-card .book-card-adaptation-links { display: flex; flex-direction: column; gap: 7px; min-width: 0; }
.book-card a.book-card-adaptation { display: grid; grid-template-columns: 34px minmax(0, 1fr) 16px; align-items: center; gap: 12px; min-height: 60px; max-width: 100%; padding: 10px 13px; border: 1px solid var(--background-modifier-border); border-radius: 11px; background: color-mix(in srgb, var(--background-primary) 78%, transparent); color: var(--text-normal); text-decoration: none; font-size: .9em; line-height: 1.35; transition: border-color .15s, background-color .15s; }
.book-card a.book-card-adaptation:hover, .book-card a.book-card-adaptation:focus-visible { border-color: color-mix(in srgb, var(--book-card-accent) 65%, var(--background-modifier-border)); background: var(--background-primary); }
.book-card .book-card-adaptation-icon { display: grid; place-items: center; width: 34px; height: 36px; border-radius: 8px; border: 1px solid color-mix(in srgb, var(--book-card-accent) 25%, var(--background-modifier-border)); background: color-mix(in srgb, var(--book-card-accent) 7%, transparent); color: var(--book-card-accent); font-size: 1.2em; }
.book-card .book-card-adaptation[data-type="serial"] .book-card-adaptation-icon { color: #baa9d5; border-color: color-mix(in srgb, #baa9d5 30%, var(--background-modifier-border)); background: color-mix(in srgb, #baa9d5 7%, transparent); }
.book-card .book-card-adaptation-main { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.book-card .book-card-adaptation-title { color: var(--text-normal); font-weight: 500; overflow-wrap: anywhere; min-width: 0; }
.book-card .book-card-adaptation-meta { color: var(--text-muted); font-size: .76em; line-height: 1.4; overflow-wrap: anywhere; }
.book-card .book-card-adaptation-arrow { color: var(--text-muted); font-size: .9em; text-align: right; }
.book-card .book-card-adaptation.is-missing .book-card-adaptation-meta { color: var(--text-warning, var(--text-muted)); }
`;
css = css.slice(0, cssStart) + relationCss + css.slice(cssEnd);
fs.writeFileSync(cssPath, css);
fs.copyFileSync(cssPath, path.join(vault, '.obsidian/snippets/books-library.css'));
process.stdout.write(JSON.stringify({ card: cardPath, styles: cssPath, syncedSnippet: true }) + '\n');
