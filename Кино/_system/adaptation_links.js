// Shared, read-only book/cinema relations. Only explicit links are followed.
const BOOK = 'Книги/', CINEMA = 'Кино/';
function values(value) {
    return (Array.isArray(value) ? value : [value]).flat().map(item => {
        if (item && typeof item === 'object' && typeof item.path === 'string') return `[[${item.path}${item.display ? `|${item.display}` : ''}]]`;
        return typeof item === 'string' ? item.trim() : '';
    }).filter(Boolean);
}
function parsed(raw) {
    const text = String(raw ?? '').trim(), wiki = text.match(/^\[\[([^\]|]+)(?:\|([^\]]+))?\]\]$/);
    const link = (wiki ? wiki[1] : text).split('#')[0].replace(/\\/g, '/').replace(/\.md$/i, '').trim();
    return { target: link, label: wiki?.[2]?.trim() || link.split('/').pop() || link, alias: Boolean(wiki?.[2]) };
}
const target = raw => parsed(raw).target;
function kind(file, fm = {}) {
    if (!file || !/\.md$/i.test(file.path || '') || file.basename === '_index' || /\/_index\.md$/i.test(file.path)) return null;
    if (file.path.startsWith(BOOK) && !/^Книги\/(?:_system|Цитаты|Конспекты|Идеи)\//.test(file.path) &&
        !['quote', 'summary', 'idea'].includes(String(fm.note_type ?? '')) && String(fm.title ?? '').trim() && values(fm.authors).length) return 'book';
    if (file.path.startsWith(CINEMA) && !/^Кино\/(?:Просмотры|Сезоны|_system)\//.test(file.path)) {
        const tags = values(fm.tags).map(tag => tag.replace(/^#/, ''));
        return tags.includes('serial') ? 'serial' : tags.includes('movies') ? 'movies' : null;
    }
    return null;
}
function resolve({ app, sourcePath = '', raw }) {
    const link = parsed(raw);
    if (!link.target || /^[a-z][a-z\d+.-]*:/i.test(link.target)) return null;
    const direct = app.vault.getAbstractFileByPath?.(link.target + '.md');
    if (direct && /\.md$/i.test(direct.path)) return direct;
    return app.metadataCache.getFirstLinkpathDest?.(link.target, sourcePath) || null;
}
function state(app) {
    if (!app.__kinoAdaptationFresh) {
        const saved = new Map();
        app.__kinoAdaptationFresh = { saved };
        // One listener per app, including when the shared script is loaded by both renderers.
        app.vault.on?.('modify', file => saved.delete(file.path));
        app.vault.on?.('delete', file => saved.delete(file.path));
        app.vault.on?.('rename', (file, oldPath) => { saved.delete(oldPath); saved.delete(file.path); });
    }
    return app.__kinoAdaptationFresh;
}
function remember(app, file, fm) {
    const cached = app.metadataCache.getFileCache(file)?.frontmatter || {};
    state(app).saved.set(file.path, { fm: { ...fm }, before: JSON.stringify(cached) });
    return fm;
}
function frontmatter(app, file, supplied) {
    const cached = app.metadataCache.getFileCache(file)?.frontmatter || {}, saved = state(app).saved.get(file.path);
    if (saved) {
        if (JSON.stringify(cached) === saved.before) return saved.fm;
        state(app).saved.delete(file.path);
    }
    return supplied || cached;
}
function related({ app, file, fm }) {
    if (!file) return [];
    fm = frontmatter(app, file, fm);
    const sourceType = kind(file, fm);
    if (!sourceType) return [];
    const all = app.vault.getMarkdownFiles?.() || [], result = new Map();
    const fields = type => type === 'book' ? ['adaptations', 'related'] : ['Первоисточники', 'adapted_from', 'related'];
    const allowed = (field, type, destType) => field === 'related' || (type === 'book' ? destType !== 'book' : destType === 'book');
    function add(destination, raw, expectedType) {
        const link = parsed(raw), destinationFm = destination ? frontmatter(app, destination) : {}, type = destination ? kind(destination, destinationFm) : expectedType;
        const canonical = destination ? destination.path.replace(/\.md$/i, '') : link.target;
        if (!type || !canonical || canonical === file.path.replace(/\.md$/i, '') || result.has(canonical)) return;
        const title = type === 'book' ? destinationFm.title : destination?.basename;
        const year = String(destinationFm.year || destinationFm['Релиз'] || '').match(/\b\d{4}\b/)?.[0] || '';
        result.set(canonical, { target: canonical, label: link.alias ? link.label : String(title || link.label), type,
            author: type === 'book' ? values(destinationFm.authors).join(', ') : '', year, file: destination || undefined, missing: !destination });
    }
    for (const field of fields(sourceType)) for (const raw of values(fm[field])) {
        const destination = resolve({ app, sourcePath: file.path, raw });
        const destinationType = destination ? kind(destination, frontmatter(app, destination)) : null;
        if (destination && (!destinationType || !allowed(field, sourceType, destinationType))) continue;
        const expected = field === 'related' ? (target(raw).startsWith(BOOK) ? 'book' : sourceType) : sourceType === 'book' ? 'movies' : 'book';
        add(destination, raw, expected);
    }
    for (const candidate of all) {
        if (candidate.path === file.path) continue;
        const meta = frontmatter(app, candidate), type = kind(candidate, meta);
        if (!type) continue;
        for (const field of fields(type)) {
            if (!allowed(field, type, sourceType)) continue;
            if (values(meta[field]).some(raw => resolve({ app, sourcePath: candidate.path, raw })?.path === file.path)) {
                add(candidate, `[[${candidate.path}]]`, type); break;
            }
        }
    }
    return [...result.values()];
}
module.exports = { related, values, target, resolve, kind, remember, frontmatter };
