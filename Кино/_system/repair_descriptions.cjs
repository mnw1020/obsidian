// Audit frontmatter throughout the library; repair only physical line breaks
// inside quoted descriptions. Never reserialize unrelated properties or bodies.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const YAML = require(process.env.KINO_YAML_MODULE || 'yaml');
const backup = path.join(__dirname, 'redesign-backups', 'descriptions-20261011');
function files(dir) {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
        if (['redesign-backups', 'node_modules', '.git'].includes(e.name)) return [];
        const full = path.join(dir, e.name);
        return e.isDirectory() ? files(full) : e.name.endsWith('.md') ? [full] : [];
    });
}
function repair(raw) {
    const fm = raw.match(/^(\ufeff?---[^\S\r\n]*\r?\n)([\s\S]*?)(\r?\n---[^\S\r\n]*(?:\r?\n|$))/);
    if (!fm) return { raw, yaml: null, changed: false };
    let yaml = fm[2];
    const ids = [...yaml.matchAll(/^Кинопоиск ID:[^\r\n]*(?:\r?\n|$)/gm)];
    if (ids.length > 1 && ids.every(m => m[0].trim() === ids[0][0].trim())) {
        for (const duplicate of ids.slice(1).reverse()) {
            yaml = yaml.slice(0, duplicate.index) + yaml.slice(duplicate.index + duplicate[0].length);
        }
    }
    const start = /^(?:Описание|"Описание"|'Описание'):[ \t]*(["'])/m.exec(yaml);
    if (start) {
        const quote = start[1], valueStart = start.index + start[0].length - 1;
        let end = valueStart + 1;
        for (; end < yaml.length; end++) {
            if (quote === '"' && yaml[end] === '\\') { end++; continue; }
            if (yaml[end] !== quote) continue;
            if (quote === "'" && yaml[end + 1] === "'") { end++; continue; }
            break;
        }
        if (end === yaml.length) throw Error('Unclosed description');
        const literal = yaml.slice(valueStart, end + 1);
        if (/\r?\n/.test(literal)) {
            const folded = literal.replace(/[ \t]*\r?\n[ \t]*/g, ' ');
            const value = YAML.parse('Описание: ' + folded)['Описание'];
            assert.equal(typeof value, 'string');
            const replacement = JSON.stringify(value);
            yaml = yaml.slice(0, valueStart) + replacement + yaml.slice(end + 1);
            assert.deepEqual(YAML.parse(yaml)['Описание'], value);
        }
    }
    return { raw: fm[1] + yaml + fm[3] + raw.slice(fm[0].length), yaml, changed: yaml !== fm[2] };
}
const apply = process.argv.includes('--apply');
const report = { scanned: 0, frontmatter: 0, descriptions: 0, repairs: [], errors: [] };
const plans = [];
for (const file of files(root)) {
    const relative = path.relative(root, file), raw = fs.readFileSync(file, 'utf8');
    report.scanned++;
    try {
        const result = repair(raw);
        if (result.yaml !== null) {
            report.frontmatter++;
            const parsed = YAML.parse(result.yaml);
            if (Object.hasOwn(parsed || {}, 'Описание')) report.descriptions++;
        }
        if (result.changed) {
            assert.equal(repair(result.raw).raw, result.raw);
            report.repairs.push(relative);
            plans.push({ file, relative, raw, result });
        }
    } catch (error) { report.errors.push({ file: relative, error: error.message }); }
}
if (apply) {
    for (const p of plans) {
        assert.equal(fs.readFileSync(p.file, 'utf8'), p.raw);
        const saved = path.join(backup, 'before', p.relative);
        fs.mkdirSync(path.dirname(saved), { recursive: true });
        if (fs.existsSync(saved)) assert.equal(fs.readFileSync(saved, 'utf8'), p.raw);
        else fs.writeFileSync(saved, p.raw);
        fs.writeFileSync(p.file, p.result.raw);
        assert.equal(fs.readFileSync(p.file, 'utf8'), p.result.raw);
    }
    fs.mkdirSync(backup, { recursive: true });
    fs.writeFileSync(path.join(backup, 'verification.json'), JSON.stringify(report, null, 2));
}
console.log(JSON.stringify(report, null, 2));
if (report.errors.length) process.exitCode = 1;
