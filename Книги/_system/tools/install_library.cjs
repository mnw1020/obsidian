// Scoped installation of the approved library commands and stylesheet.
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const library = path.resolve(__dirname, '../..');
const vault = path.dirname(library);
const backup = path.join(library, '_system', 'backups');
fs.mkdirSync(backup, { recursive: true });
function preserve(filename) {
    const name = path.relative(vault, filename).replace(/[\\/:]/g, '_');
    const target = path.join(backup, name + '.before');
    if (!fs.existsSync(target)) fs.copyFileSync(filename, target);
}
function writeIfChanged(filename, observed, next) {
    if (observed === next) return;
    const current = fs.existsSync(filename) ? fs.readFileSync(filename, 'utf8') : null;
    if (current !== observed) throw new Error(`Concurrent edit; installation stopped: ${filename}`);
    if (current !== null) preserve(filename);
    fs.writeFileSync(filename, next);
}
const settingsPath = path.join(vault, '.obsidian', 'plugins', 'quickadd', 'data.json');
const settingsText = fs.readFileSync(settingsPath, 'utf8');
const settings = JSON.parse(settingsText);
for (const [name, script] of [
    ['Книги - Добавить выписку', 'add_excerpt'],
    ['Книги - Поиск по библиотеке', 'library_search'],
    ['Книги - Нормализовать библиотеку', 'normalize_library']
]) {
    if (settings.choices.some(choice => choice.name === name)) continue;
    const scriptPath = `Книги/_system/QuickAdd/${script}.js`;
    if (!fs.existsSync(path.join(vault, scriptPath))) throw new Error(`Script missing: ${scriptPath}`);
    settings.choices.push({ id: randomUUID(), name, type: 'Macro', command: true, runOnStartup: false,
        macro: { name, id: randomUUID(), commands: [{ name: script, type: 'UserScript', id: randomUUID(), path: scriptPath, settings: {} }] } });
}
writeIfChanged(settingsPath, settingsText, JSON.stringify(settings, null, 2) + '\n');
const appearancePath = path.join(vault, '.obsidian', 'appearance.json');
const appearanceText = fs.readFileSync(appearancePath, 'utf8');
const appearance = JSON.parse(appearanceText);
const cssPath = path.join(vault, '.obsidian', 'snippets', 'books-library.css');
const css = fs.readFileSync(path.join(library, '_system', 'books-library.css'), 'utf8');
writeIfChanged(cssPath, fs.existsSync(cssPath) ? fs.readFileSync(cssPath, 'utf8') : null, css);
appearance.enabledCssSnippets = [...new Set([...(appearance.enabledCssSnippets || []).filter(name => name !== 'books-bases-no-new'), 'books-library'])];
writeIfChanged(appearancePath, appearanceText, JSON.stringify(appearance, null, 2) + '\n');
console.log('Installed 3 library commands and books-library stylesheet. Existing choices preserved.');
