const fs = require('node:fs');
const path = require('node:path');
const library = path.resolve(__dirname, '../..');
const vault = path.dirname(library);
const bookTarget = 'Книги/Художественные/Айзек Азимов/Все грехи мира';
const films = ['Кино/Media/Особое мнение (2002)', 'Кино/Media/Особое мнение'];
const changes = [[bookTarget, 'adaptations', films], ...films.map(film => [film, 'Первоисточники', [bookTarget]])];
function removeExactLinks(text, key, targets) {
    const fm = text.match(/^(\uFEFF?---\r?\n)([\s\S]*?)(\r?\n---(?:\r?\n|$))/);
    if (!fm) throw new Error('Missing YAML');
    const nl = text.includes('\r\n') ? '\r\n' : '\n';
    const lines = fm[2].split(/\r?\n/);
    const index = lines.findIndex(line => line === key + ':');
    if (index < 0) return text;
    let end = index + 1;
    while (end < lines.length && /^\s+-\s+/.test(lines[end])) end++;
    const remaining = lines.slice(index + 1, end).filter(line => !targets.some(target => line.trim() === '- "[[' + target + ']]"' || line.trim() === '- [[' + target + ']]'));
    if (remaining.length === end - index - 1) return text;
    lines.splice(index, end - index, ...(remaining.length ? [key + ':', ...remaining] : []));
    return fm[1] + lines.join(nl) + fm[3] + text.slice(fm[0].length);
}
for (const [target, property, links] of changes) {
    const filename = path.resolve(vault, target + '.md');
    if (!filename.startsWith(vault + path.sep)) throw new Error('Target escaped vault');
    const text = fs.readFileSync(filename, 'utf8');
    const updated = removeExactLinks(text, property, links);
    if (text === updated) continue;
    console.log(`${target}: remove incorrect ${property} link(s)`);
    if (process.argv.includes('--apply')) {
        const backup = path.join(library, '_system', 'backups', path.relative(vault, filename).replace(/[\\/:]/g, '_') + '.before');
        fs.mkdirSync(path.dirname(backup), { recursive: true });
        if (!fs.existsSync(backup)) fs.writeFileSync(backup, text);
        if (fs.readFileSync(filename, 'utf8') !== text) throw new Error('Concurrent edit; correction stopped');
        fs.writeFileSync(filename, updated);
    }
}
