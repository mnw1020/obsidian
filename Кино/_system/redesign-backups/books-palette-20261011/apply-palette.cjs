const fs = require('node:fs'), path = require('node:path');
const vault = path.resolve(__dirname, '../../../..');
const file = path.join(vault, 'Книги/_system/books-library.css');
const palette = fs.readFileSync(path.join(__dirname, 'palette.css'), 'utf8');
const before = fs.readFileSync(file, 'utf8');
const next = before.includes('/* BOOKS:PALETTE:START') ? before.replace(/\/\* BOOKS:PALETTE:START[\s\S]*?\/\* BOOKS:PALETTE:END \*\//, palette.trimEnd()) : before.trimEnd() + '\n\n' + palette;
fs.writeFileSync(file, next);
fs.copyFileSync(file, path.join(vault, '.obsidian/snippets/books-library.css'));
process.stdout.write('Updated the source and active snippet palette.\n');
