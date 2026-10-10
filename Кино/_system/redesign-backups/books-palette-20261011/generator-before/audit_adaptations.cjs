// Read-only audit of stored relations. Does not infer links from titles or text.
const fs = require('node:fs'), path = require('node:path');
const { fromText } = require('../tests/yaml_fixture.cjs');
const list = value => [].concat(value || []).map(String).map(value => value.trim()).filter(Boolean);

function auditCollections({ library = path.resolve(__dirname, '../..'), vault = path.dirname(library) } = {}) {
    const notes = new Map(), issues = [], adaptations = new Set(), related = new Set(), continuations = new Set();
    function scan(folder) {
        for (const item of fs.readdirSync(folder, { withFileTypes: true })) {
            if (item.name.startsWith('.') || ['_system', 'Просмотры', 'Сезоны'].includes(item.name)) continue;
            const full = path.join(folder, item.name);
            if (item.isDirectory()) { scan(full); continue; }
            if (!item.name.endsWith('.md')) continue;
            const text = fs.readFileSync(full, 'utf8');
            const yaml = text.match(/^\uFEFF?---\r?\n([\s\S]*?)\r?\n---/)?.[1] || '';
            // Descriptions can use complex YAML; only relation/type fields are needed here.
            const selected = [...yaml.matchAll(/^(?:title|authors|tags|note_type|adaptations|Первоисточники|adapted_from|related|continues|continued_by):[^\r\n]*(?:\r?\n[ \t]+-[^\r\n]*)*/gm)].map(match => match[0]).join('\n');
            const fm = fromText('---\n' + selected + '\n---\n');
            const target = path.relative(vault, full).replaceAll('\\', '/').slice(0, -3);
            const book = target.startsWith('Книги/') && path.basename(target) !== '_index' &&
                !/^Книги\/(?:_system|Цитаты|Конспекты|Идеи)\//.test(target) &&
                !['quote', 'summary', 'idea'].includes(String(fm.note_type || '')) && !!fm.title && list(fm.authors).length > 0;
            const media = target.startsWith('Кино/') && list(fm.tags).some(tag => ['serial', 'movies'].includes(tag.replace(/^#/, '')));
            notes.set(target, { target, fm, book, media });
        }
    }
    scan(library); scan(path.join(vault, 'Кино'));

    function resolve(raw) {
        const target = raw.replace(/^\[\[([^\]|]+)(?:\|[^\]]+)?\]\]$/, '$1').replace(/\.md$/i, '');
        if (notes.has(target)) return notes.get(target);
        const matches = [...notes.values()].filter(note => note.target.endsWith('/' + target));
        return matches.length === 1 ? matches[0] : null;
    }
    const rules = [
        { field: 'adaptations', source: note => note.book, target: note => note.media, reverse: ['Первоисточники', 'adapted_from'], pairs: adaptations },
        { field: 'Первоисточники', source: note => note.media, target: note => note.book, reverse: ['adaptations'], pairs: adaptations },
        { field: 'adapted_from', source: note => note.media, target: note => note.book, reverse: ['adaptations'], pairs: adaptations },
        { field: 'related', source: note => note.book || note.media, target: note => note.book || note.media, reverse: ['related'], pairs: related },
        { field: 'continues', source: note => note.book, target: note => note.book, reverse: ['continued_by'], pairs: continuations },
        { field: 'continued_by', source: note => note.book, target: note => note.book, reverse: ['continues'], pairs: continuations }
    ];
    for (const note of notes.values()) {
        for (const rule of rules.filter(rule => rule.source(note))) {
            const seen = new Set();
            for (const raw of list(note.fm[rule.field])) {
                const dest = resolve(raw);
                if (!dest || !rule.target(dest)) { issues.push(`${note.target}: ${rule.field} — недоступная или неподходящая цель ${raw}`); continue; }
                if (seen.has(dest.target)) { issues.push(`${note.target}: ${rule.field} — дубль ${raw}`); continue; }
                seen.add(dest.target);
                const reverse = rule.reverse.flatMap(field => list(dest.fm[field]));
                if (!reverse.some(link => resolve(link)?.target === note.target)) {
                    issues.push(`${note.target} ↔ ${dest.target}: отсутствует обратная ссылка в ${rule.reverse.join(' / ')} (${rule.field})`);
                }
                const key = rule.pairs === continuations
                    ? (rule.field === 'continued_by' ? [note.target, dest.target] : [dest.target, note.target]).join(' → ')
                    : [note.target, dest.target].sort().join(' ↔ ');
                rule.pairs.add(key);
            }
        }
    }
    return {
        books: [...notes.values()].filter(note => note.book).length,
        media: [...notes.values()].filter(note => note.media).length,
        links: adaptations.size,
        relatedLinks: related.size,
        continuationLinks: continuations.size,
        issues
    };
}

function renderReport(summary, date = new Date()) {
    const day = new Intl.DateTimeFormat('ru-RU', { timeZone: 'Asia/Yekaterinburg' }).format(date);
    return '---\nobsidianUIMode: preview\n---\n\n# Проверка связей с кино\n\nПроверено ' + day + ': ' + summary.books + ' произведений, ' + summary.media + ' карточек кино.\n\n' +
        'Экранизаций: ' + summary.links + '. Связанных произведений: ' + summary.relatedLinks + '. Продолжений: ' + summary.continuationLinks + '.\n\n' +
        (summary.issues.length ? summary.issues.map(issue => '- ' + issue).join('\n') : 'Битых ссылок, дублей, неподходящих целей и пропущенных обратных ссылок не найдено.') +
        '\n\nПроверка структурная: adaptations ↔ Первоисточники / adapted_from, related ↔ related между книгами и кино, continued_by ↔ continues между книгами. Содержание связей сохраняется без изменений, совпадения названий автоматически не связываются.\n';
}

module.exports = { auditCollections, renderReport };
if (require.main === module) {
    const summary = auditCollections();
    console.log(JSON.stringify(summary, null, 2));
    if (process.argv.includes('--report')) fs.writeFileSync(path.resolve(__dirname, '../Проверка связей с кино.md'), renderReport(summary));
}
