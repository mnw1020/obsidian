const fs = require('node:fs'), path = require('node:path');
const file = path.resolve(__dirname, '../../../../Книги/_system/tests/library_home_ui.cjs');
const backup = path.join(__dirname, 'before/library_home_ui.cjs');
const source = fs.readFileSync(file, 'utf8');
if (!fs.existsSync(backup)) fs.writeFileSync(backup, source);
const before = "        assert(normalDistance / accentDistance > .47 && normalDistance / accentDistance < .63, 'Number color uses approximately 55% accent');";
const after = "        assert.deepEqual(number.color, [184, 151, 96], 'Numbers use the shared soft cinema gold (#b89760)');\n        assert.deepEqual(number.accent, [228, 164, 95], 'Interactive controls use the shared cinema accent (#e4a45f)');";
if (!source.includes(before)) throw new Error('Previous home palette expectation not found');
fs.writeFileSync(file, source.replace(before, after));
