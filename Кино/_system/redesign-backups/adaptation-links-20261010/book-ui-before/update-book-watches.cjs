const fs = require('node:fs'), path = require('node:path');
const target = path.resolve(__dirname, '../../../../../Книги/_system/book_card.js');
let source = fs.readFileSync(target, 'utf8');
const anchor = "    watchRelations(app.workspace, 'kino:adaptations-changed', payload => {";
const replacement = `    const isBookRelationFile = candidate => {
        const meta = candidate && app.metadataCache.getFileCache(candidate)?.frontmatter || {};
        if (relationCore?.kind) return relationCore.kind(candidate, meta) === 'book';
        return candidate?.path?.startsWith('Книги/') && /\\.md$/i.test(candidate.path) &&
            !/^Книги\\/(?:_system|Цитаты|Конспекты|Идеи)\\//.test(candidate.path) &&
            candidate.basename !== '_index' && String(meta.title || '').trim() && [].concat(meta.authors || []).some(Boolean);
    };
    // Keep known paths as well: after a deletion the metadata can already be unavailable.
    const relatedBookPaths = new Set((app.vault.getMarkdownFiles?.() || []).filter(isBookRelationFile).map(candidate => candidate.path));
    const needsRelationRefresh = (changed, oldPath) => {
        const path = changed?.path;
        const wasBook = relatedBookPaths.has(path) || relatedBookPaths.has(oldPath);
        if (oldPath) relatedBookPaths.delete(oldPath);
        const isBook = isBookRelationFile(changed);
        if (isBook) relatedBookPaths.add(path);
        return path === source || oldPath === source || path?.startsWith('Кино/') || oldPath?.startsWith('Кино/') || wasBook || isBook;
    };
${anchor}`;
if (!source.includes(anchor)) throw new Error('Book renderer watches not found');
source = source.replace(anchor, replacement);
source = source.replaceAll("if (changed?.path === source || changed?.path?.startsWith('Кино/')) scheduleRelations();", "if (needsRelationRefresh(changed)) scheduleRelations();");
source = source.replace("watchRelations(app.vault, event, changed => {\n        if (needsRelationRefresh(changed)) scheduleRelations();", "watchRelations(app.vault, event, (changed, oldPath) => {\n        if (needsRelationRefresh(changed, oldPath)) scheduleRelations();");
fs.writeFileSync(target, source);
