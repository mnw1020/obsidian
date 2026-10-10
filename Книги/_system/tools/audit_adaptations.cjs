// Read-only audit of stored book/cinema links. Does not infer adaptations from titles.
const fs = require('node:fs'), path = require('node:path');
const { fromText } = require('../tests/yaml_fixture.cjs');
const library = path.resolve(__dirname, '../..'), vault = path.dirname(library);
const notes = new Map(), issues = [], pairs = new Set();
const list = value => [].concat(value || []).map(String).filter(Boolean);
function scan(folder) {
    for (const item of fs.readdirSync(folder, { withFileTypes: true })) {
        if (item.name.startsWith('.') || ['_system', 'Просмотры', 'Сезоны'].includes(item.name)) continue;
        const full = path.join(folder, item.name);
        if (item.isDirectory()) { scan(full); continue; }
        if (!item.name.endsWith('.md')) continue;
        const text = fs.readFileSync(full, 'utf8');
        const yaml = text.match(/^\uFEFF?---\r?\n([\s\S]*?)\r?\n---/)?.[1] || '';
        // Only relation/type fields are needed; descriptions may use complex YAML.
        const selected = [...yaml.matchAll(/^(?:title|authors|tags|adaptations|Первоисточники|adapted_from):[^\r\n]*(?:\r?\n[ \t]+-[^\r\n]*)*/gm)].map(match => match[0]).join('\n');
        const fm = fromText('---\n' + selected + '\n---\n');
        const target = path.relative(vault, full).replaceAll('\\', '/').slice(0, -3);
        notes.set(target, { target, fm, book: target.startsWith('Книги/') && !!fm.title && list(fm.authors).length > 0, media: target.startsWith('Кино/') && list(fm.tags).some(tag => ['serial', 'movies'].includes(tag.replace(/^#/, ''))) });
    }
}
scan(library); scan(path.join(vault, 'Кино'));
function resolve(raw) {
    const target = raw.replace(/^\[\[([^\]|]+)(?:\|[^\]]+)?\]\]$/, '$1').replace(/\.md$/i, '');
    if (notes.has(target)) return notes.get(target);
    const matches = [...notes.values()].filter(note => note.target.endsWith('/' + target));
    return matches.length === 1 ? matches[0] : null;
}
for (const note of notes.values()) {
    const fields = note.book ? ['adaptations'] : note.media ? ['Первоисточники', 'adapted_from'] : [];
    for (const field of fields) {
        const seen = new Set();
        for (const raw of list(note.fm[field])) {
            const dest = resolve(raw);
            if (!dest || !(note.book ? dest.media : dest.book)) { issues.push(`${note.target}: ${field} — недоступная или неподходящая цель ${raw}`); continue; }
            if (seen.has(dest.target)) issues.push(`${note.target}: ${field} — дубль ${raw}`);
            seen.add(dest.target);
            const reverse = note.book ? [...list(dest.fm['Первоисточники']), ...list(dest.fm.adapted_from)] : list(dest.fm.adaptations);
            if (!reverse.some(link => resolve(link)?.target === note.target)) issues.push(`${note.target} ↔ ${dest.target}: отсутствует обратная ссылка`);
            pairs.add([note.target, dest.target].sort().join(' ↔ '));
        }
    }
}
const summary = { books: [...notes.values()].filter(note => note.book).length, media: [...notes.values()].filter(note => note.media).length, links: pairs.size, issues };
console.log(JSON.stringify(summary, null, 2));
if (process.argv.includes('--report')) fs.writeFileSync(path.join(library, '_system/Проверка связей с кино.md'), '# Проверка связей с кино\n\nПроверено 10.10.2026: ' + summary.books + ' произведений, ' + summary.media + ' карточек кино.\n\nСуществующих связей: ' + summary.links + '.\n\n' + (issues.length ? issues.map(issue => '- ' + issue).join('\n') : 'Битых ссылок, дублей, неподходящих целей и пропущенных обратных ссылок не найдено.') + '\n\nПроверка структурная: содержание связей сохраняется без изменений, совпадения названий автоматически не связываются.\n');
