// Small fixture parser: the fixture subset is deliberately explicit.
// Production code always uses Obsidian.parseYaml.
const scalar = value => {
    value = value.trim().replace(/\s+#.*$/, '');
    if (!value || value === 'null' || value === '~') return null;
    if (value.startsWith('"') || value.startsWith('[') || value.startsWith('{')) return JSON.parse(value);
    if (value.startsWith("'")) return value.slice(1, -1).replace(/''/g, "'");
    if (value === 'true' || value === 'false') return value === 'true';
    if (/^-?\d+(?:\.\d+)?$/.test(value)) return Number(value);
    return value;
};
function parseYaml(yaml) {
    const result = {};
    let key;
    for (const line of yaml.split(/\r?\n/)) {
        if (!line.trim() || /^\s*#/.test(line)) continue;
        const item = line.match(/^\s+-\s+(.*)$/);
        if (item) { if (!key) throw new Error('Unattached YAML list'); if (!Array.isArray(result[key])) result[key] = []; result[key].push(scalar(item[1])); continue; }
        const prop = line.match(/^([^\s][^:]*):(?:\s+(.*))?$/);
        if (!prop) throw new Error('Unsupported fixture YAML: ' + line);
        key = prop[1]; result[key] = prop[2] === undefined ? [] : scalar(prop[2]);
    }
    return result;
}
const stringifyYaml = fm => Object.entries(fm).map(([key, value]) => `${key}: ${JSON.stringify(value)}`).join('\n');
const fromText = text => { const match = text.match(/^\uFEFF?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/); return match ? parseYaml(match[1]) : {}; };
module.exports = { parseYaml, stringifyYaml, fromText };
