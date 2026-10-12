// One-time migration of the journal only; saves its exact original contents.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const system = path.resolve(__dirname, '../..');
const ui = require(path.join(system, 'journal_ui.js'));
const note = path.join(system, 'Журнал изменений.md');
const backup = path.join(__dirname, 'before', 'Журнал изменений.md');
if (fs.existsSync(backup)) throw Error('Journal migration has already run. Do not repeat.');
const raw = fs.readFileSync(note, 'utf8');
fs.mkdirSync(path.dirname(backup), { recursive: true });
fs.copyFileSync(note, backup);
const cleaned = ui.clearEntries(raw).replace(' · [[Кино/_system/Журнал изменений|📜 Журнал]]', '');
const result = ui.ensureLayout(cleaned);
if (ui.entries(result).length || ui.ensureLayout(result) !== result) throw Error('Journal migration verification failed');
fs.writeFileSync(note, result, 'utf8');
const sha = text => crypto.createHash('sha256').update(text).digest('hex');
const verification = { date: '2026-10-12', cleared: ui.entries(raw).length,
    backup, originalSHA256: sha(raw), backupSHA256: sha(fs.readFileSync(backup, 'utf8')),
    journalSHA256: sha(result), remaining: ui.entries(result).length };
fs.writeFileSync(path.join(__dirname, 'verification.json'), JSON.stringify(verification, null, 2) + '\n');
console.log(JSON.stringify(verification, null, 2));
