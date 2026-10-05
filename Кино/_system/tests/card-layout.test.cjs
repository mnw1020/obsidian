'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const layout = require('../card_layout.js');
const source = name => fs.readFileSync(path.join(__dirname, '..', name + '.js'), 'utf8');
const poster = 'https://example.test/poster_(film).jpg';
const personal = 'Моя заметка с **выделением**.  \n\n> Цитата\n\n[[Книги/Заметка#^original|Ссылка]]\n\n^keep-me\n\n```dataview\nLIST FROM "Личное"\n```\n\n![Личное изображение](local-image.png)';
const button = '<!-- KINO:RECOMMEND:BUTTON:V2 -->\n```dataviewjs\n// A retained working recommendation action.\nconst keep = true;\n```';
const customYaml = 'Произвольное: {"nested":["значение",7],"link":"[[Личное#^id]]"}\nЛичный текст: |-\n  Первая строка: с двоеточием\n  Вторая строка';

// Deliberately small Obsidian YAML mock: fixtures use JSON-compatible scalars,
// ordinary lists and literal comments. No production YAML parser is substituted.
function parseYaml(yaml) {
    const lines = String(yaml).split(/\r?\n/), result = {};
    const scalar = raw => {
        const text = raw.trim();
        if (!text || text === 'null') return null;
        try { return JSON.parse(text); } catch (_) {}
        if (text.startsWith("'") && text.endsWith("'")) return text.slice(1, -1).replace(/''/g, "'");
        if (text.startsWith('[') && text.endsWith(']')) return text.slice(1, -1).split(',').map(scalar);
        return text;
    };
    for (let i = 0; i < lines.length; i++) {
        const match = lines[i].match(/^([^\s#][^:]*):[ \t]*(.*)$/);
        if (!match) continue;
        let key = match[1].replace(/^["']|["']$/g, ''), value = match[2];
        if (/^[|>][+-]?$/.test(value)) {
            const body = [];
            while (i + 1 < lines.length && (/^[ \t]+/.test(lines[i + 1]) || !lines[i + 1])) body.push(lines[++i].replace(/^  /, ''));
            result[key] = body.join('\n').replace(/\n+$/, '');
        } else if (!value && i + 1 < lines.length && /^\s*-\s*/.test(lines[i + 1])) {
            const values = [];
            while (i + 1 < lines.length && /^\s*-\s*/.test(lines[i + 1])) values.push(scalar(lines[++i].replace(/^\s*-\s*/, '')));
            result[key] = values;
        } else result[key] = scalar(value);
    }
    return result;
}

function note(fields, body = '', newline = '\n') {
    return ('---\n' + Object.entries(fields).map(([key, value]) => key + ': ' + JSON.stringify(value)).join('\n') + '\n' + customYaml + '\n---\n\n' + body + '\n').replace(/\n/g, newline);
}
function count(text, value) { return text.split(value).length - 1; }
function assertLayout(text, kind, hasPoster = false) {
    assert.equal(count(text, layout.UI_START), 1, 'one generated interface');
    assert.equal(count(text, layout.UI_END), 1, 'one matching interface end');
    assert.ok(parseYaml(layout.splitRaw(text).yaml).cssclasses.includes('kino-' + kind));
    if (hasPoster) assert.ok(text.trimEnd().endsWith('![](' + poster + ')'), 'poster is the very last block');
    assert.equal(layout.ensureLayout(text, { kind, parseYaml }), text, 'layout is idempotent');
}

function mockVault(initial, activePath, values) {
    const files = new Map(), texts = new Map(), events = new Map(), notices = [];
    const fileFor = path => ({ path, name: path.split('/').pop(), basename: path.split('/').pop().replace(/\.[^.]+$/, ''), extension: path.split('.').pop() });
    for (const [p, text] of Object.entries(initial)) { files.set(p, fileFor(p)); texts.set(p, text); }
    files.set('Кино/_system/card_layout.js', fileFor('Кино/_system/card_layout.js'));
    texts.set('Кино/_system/card_layout.js', source('card_layout'));
    const emit = (event, file) => { for (const handler of events.get(event) || []) handler(file); };
    const app = {
        vault: {
            getAbstractFileByPath: p => files.get(p) || null,
            getMarkdownFiles: () => [...files.values()].filter(file => file.extension === 'md'),
            getName: () => 'Test Vault',
            read: async file => { assert.ok(texts.has(file.path), 'read an existing file'); return texts.get(file.path); },
            modify: async (file, text) => { texts.set(file.path, text); emit('modify', file); },
            process: async (file, fn) => { const text = fn(texts.get(file.path)); texts.set(file.path, text); emit('modify', file); return text; },
            create: async (p, text) => { assert.ok(!files.has(p), 'create without replacing another file'); const file = fileFor(p); files.set(p, file); texts.set(p, text); emit('create', file); return file; },
            createFolder: async p => files.set(p, { path: p, extension: '' }),
            on: (event, handler) => { if (!events.has(event)) events.set(event, []); events.get(event).push(handler); return { event, handler }; },
            offref: ref => events.set(ref.event, (events.get(ref.event) || []).filter(handler => handler !== ref.handler))
        },
        metadataCache: {
            getFileCache: file => ({ frontmatter: parseYaml(layout.splitRaw(texts.get(file.path)).yaml) }),
            getFirstLinkpathDest: target => [...files.values()].find(file => file.path.replace(/\.md$/, '') === target || file.basename === target) || null
        },
        fileManager: {
            processFrontMatter: async (file, fn) => {
                const raw = texts.get(file.path), parts = layout.splitRaw(raw), nl = raw.includes('\r\n') ? '\r\n' : '\n';
                const before = parseYaml(parts.yaml), after = structuredClone(before); fn(after);
                let yaml = parts.yaml;
                for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
                    if (JSON.stringify(before[key]) === JSON.stringify(after[key])) continue;
                    const safe = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    const regex = new RegExp('^' + safe + ':[^\\r\\n]*(?:\\r?\\n(?:[ \\t]+[^\\r\\n]*|-(?:[ \\t]+[^\\r\\n]*)?))*', 'm');
                    const block = key in after ? key + ': ' + JSON.stringify(after[key]) : '';
                    yaml = regex.test(yaml) ? yaml.replace(regex, () => block) : yaml + nl + block;
                }
                texts.set(file.path, parts.opening + yaml + parts.closing + parts.body);
            },
            renameFile: async (file, p) => { assert.ok(!files.has(p)); const previous = file.path, text = texts.get(previous); files.delete(previous); texts.delete(previous); Object.assign(file, fileFor(p)); files.set(p, file); texts.set(p, text); emit('rename', file); }
        },
        workspace: { getActiveFile: () => files.get(activePath), getLeaf: () => ({ openFile: async () => {} }) }
    };
    const obsidian = { parseYaml, normalizePath: p => p.replace(/\\/g, '/'), Notice: class { constructor(message) { notices.push(message); } setMessage() {} hide() {} }, requestUrl: () => { throw Error('Network requests are forbidden in layout regressions'); } };
    const quickAddApi = { requestInputs: async () => values, suggester: async (_labels, choices) => choices[0], date: { now: () => '2026-10-05' } };
    return { app, obsidian, quickAddApi, texts, files, notices, fields: p => parseYaml(layout.splitRaw(texts.get(p)).yaml) };
}

for (const newline of ['\n', '\r\n']) test('lossless layout and rebuild with ' + JSON.stringify(newline), () => {
    const raw = '\ufeff' + note({ tags: ['movies'], poster, cssclasses: ['my-existing-class'], Название: 'Original', Оценка: 8 }, personal + '\n\n' + button + '\n\n![](' + poster + ')\n\nПоследняя личная строка.', newline);
    const formatted = layout.ensureLayout(raw, { kind: 'media', parseYaml });
    assertLayout(formatted, 'media', true);
    assert.ok(formatted.startsWith('\ufeff---' + newline));
    assert.ok(formatted.includes(personal.replace(/\n/g, newline)));
    assert.ok(formatted.includes(customYaml.replace(/\n/g, newline)));
    assert.ok(formatted.includes('Последняя личная строка.'));
    assert.equal(count(formatted, '<!-- KINO:RECOMMEND:BUTTON:V2 -->'), 1);
    assert.ok(parseYaml(layout.splitRaw(formatted).yaml).cssclasses.includes('my-existing-class'));
    if (newline === '\r\n') assert.equal(formatted.replace(/\r\n/g, '').includes('\n'), false);
    const generated = layout.region('seasons', '# Сезон 1 (9/10)\n\nКомментарий сезона.') + '\n\n' + layout.region('viewings', '# Просмотр 2 (8/10)');
    const rebuilt = layout.rebuildCard(formatted, generated, { parseYaml });
    assertLayout(rebuilt, 'media', true);
    assert.ok(rebuilt.includes(personal.replace(/\n/g, newline)));
    assert.equal(layout.rebuildCard(rebuilt, generated, { parseYaml }), rebuilt, 'repeat rebuilding does not duplicate history');
    assert.equal(count(rebuilt, '# Сезон 1'), 1);
    assert.equal(count(rebuilt, '# Просмотр 2'), 1);
});

test('existing CSS class formats, absent poster, malformed frontmatter and marked duplicates', () => {
    for (const yamlClass of ['cssclasses: previous', 'cssclasses: [previous, "quoted"]', 'cssclasses:\n  - previous\n  - quoted', 'cssclasses:\n- previous\n- quoted']) {
        const raw = '---\n' + yamlClass + '\n' + customYaml + '\n---\n\n' + personal;
        const next = layout.ensureLayout(raw, { kind: 'media' });
        assertLayout(next, 'media');
        assert.ok(parseYaml(layout.splitRaw(next).yaml).cssclasses.includes('previous'));
        assert.ok(next.includes(customYaml));
    }
    for (const missing of ['', 'N/A', 'null', 'undefined']) {
        const next = layout.ensureLayout(note({ poster: missing }, personal), { kind: 'media' });
        assertLayout(next, 'media'); assert.ok(!next.includes('![]('));
    }
    for (const raw of ['No YAML\n' + personal, '---\nposter: x\nMissing closing delimiter']) assert.equal(layout.ensureLayout(raw), raw);
    const legacy = '<!-- VIEWINGS:START -->\n# Просмотр 1\nстарый служебный текст\n<!-- VIEWINGS:END -->';
    const raw = note({ poster }, personal + '\n\n' + legacy + '\n\n' + button + '\n\n' + button + '\n\n' + layout.uiBlock('media') + '\n\n' + layout.uiBlock('media'));
    const next = layout.rebuildCard(raw, layout.region('viewings', '# Просмотр 2\nновый служебный текст'));
    assertLayout(next, 'media', true);
    assert.equal(count(next, '<!-- KINO:RECOMMEND:BUTTON:V2 -->'), 1);
    assert.equal(count(next, layout.MARKERS.viewings[0]), 1);
    assert.ok(!next.includes('старый служебный текст'));
    assert.ok(next.includes(personal));
});

test('the exact former history query is replaced, arbitrary Dataview and block links remain', () => {
    const former = '```dataview\nTABLE WITHOUT ID\n  Просмотр AS "№",\n  choice(Дата != null, dateformat(Дата, "dd.MM.yyyy"), string(Год)) AS "Когда",\n  Оценка AS "⭐",\n  Комментарий AS "Мысль",\n  file.link AS "Запись"\nFROM "Кино/Просмотры"\nWHERE Фильм = this.file.link\nSORT Просмотр DESC, Год DESC, Дата DESC\n```';
    const raw = note({ poster }, personal + '\n\n' + former);
    const next = layout.rebuildCard(raw, layout.region('viewings', '# Просмотр 1 (8/10)'));
    assert.ok(next.includes(personal)); assert.ok(!next.includes(former));
    assert.equal(count(next, layout.MARKERS.viewings[0]), 1);
    assertLayout(next, 'media', true);
});

for (const serial of [false, true]) test('real rebuild command preserves private text and metadata: ' + (serial ? 'series' : 'movie'), async () => {
    const mediaPath = 'Кино/Media/Test.md', seasonPath = 'Кино/Сезоны/Test - s01.md', viewingPath = 'Кино/Просмотры/Test - v1.md';
    const initial = {
        [mediaPath]: note({ tags: [serial ? 'serial' : 'movies'], Название: 'Original', poster, Оценка: 8 }, personal + '\n\n' + button, '\r\n'),
        [viewingPath]: note({ Фильм: '[[Кино/Media/Test|Test]]', Просмотр: 1, Дата: '2026-10-04', Оценка: 7, Комментарий: 'Просмотр сохранён', tags: ['viewing'] })
    };
    if (serial) initial[seasonPath] = note({ Сериал: '[[Кино/Media/Test|Test]]', Сезон: 1, Дата: '2026-10-03', Оценка: 9, Комментарий: 'Сезон сохранён', tags: ['season'] }, personal);
    const env = mockVault(initial, mediaPath);
    const command = require('../rebuild_card.js'); await command(env);
    const result = env.texts.get(mediaPath); assertLayout(result, 'media', true);
    assert.ok(result.includes(personal.replace(/\n/g, '\r\n')));
    assert.ok(result.includes(customYaml.replace(/\n/g, '\r\n')));
    assert.equal(env.fields(mediaPath).Название, 'Original');
    assert.equal(env.fields(viewingPath)['Последний просмотр'], true);
    await command(env); assert.equal(env.texts.get(mediaPath), result);
    if (serial) { assert.ok(result.includes('Сезон сохранён')); assert.ok(env.texts.get(seasonPath).includes(personal)); }
});

test('new viewing and editing retain original Markdown, legacy review and links', async () => {
    const mediaPath = 'Кино/Media/Test.md';
    const env = mockVault({ [mediaPath]: note({ tags: ['movies'], poster, Просмотрено: '2021-01-01', Оценка: 8, Название: 'Original' }, personal + '\n\n' + button + '\n\n![](' + poster + ')', '\r\n') }, mediaPath, { date: '2026-10-05', rating: '9', comment: 'Новый комментарий' });
    await require('../add_viewing.js')(env);
    const result = env.texts.get(mediaPath); assertLayout(result, 'media', true);
    assert.ok(result.includes(personal.replace(/\n/g, '\r\n')));
    const legacyPath = 'Кино/Просмотры/Test - v1.md', newPath = 'Кино/Просмотры/Test - v2.md';
    assertLayout(env.texts.get(legacyPath), 'viewing'); assertLayout(env.texts.get(newPath), 'viewing');
    assert.ok(env.fields(legacyPath).Комментарий.includes('Моя заметка'));
    assert.equal(env.fields(newPath).Комментарий, 'Новый комментарий');
    assert.equal(env.fields(newPath)['Предыдущая оценка'], 8);
    assert.equal(env.fields(newPath)['Изменение оценки'], 1);
    assert.equal(env.fields(mediaPath)['Количество просмотров'], 2);
    env.texts.set(newPath, env.texts.get(newPath).replace('\n---\n', '\n' + customYaml + '\n---\n') + '\n' + personal + '\n');
    env.app.workspace.getActiveFile = () => env.files.get(newPath);
    env.quickAddApi.requestInputs = async () => ({ number: '2', date: '2026-10-05', rating: '7', comment: '' });
    await require('../edit_viewing.js')(env);
    assert.equal(env.fields(newPath).Комментарий, '', 'clearing a comment must not copy personal Markdown back into it');
    assert.ok(env.texts.get(newPath).includes(personal));
    assertLayout(env.texts.get(newPath), 'viewing');
    assertLayout(env.texts.get(mediaPath), 'media', true);
});

test('legacy season bodies survive adding, editing, numbering changes and repeated rebuilding', async () => {
    const mediaPath = 'Кино/Media/Test.md';
    const legacy = 'Преамбула со ссылкой [[Заметка#^p]].\n\n# 1 Сезон (8/10)\n\nМой первый отзыв.\n\n^season-1\n\n# Сезон 2 (9/10)\n\n> Мой второй отзыв.\n\n^season-2';
    const env = mockVault({ [mediaPath]: note({ tags: ['serial'], poster, Просмотрено: '2025-01-01', Оценка: 9, Название: 'Original' }, legacy + '\n\n' + button + '\n\n![](' + poster + ')', '\r\n') }, mediaPath, { season: '3', date: '2026-10-05', rating: '8', comment: 'Третий отзыв.' });
    await require('../add_season.js')(env);
    const newPath = 'Кино/Сезоны/Test - s03.md';
    for (const p of ['Кино/Сезоны/Test - s01.md', 'Кино/Сезоны/Test - s02.md', newPath]) assertLayout(env.texts.get(p), 'season');
    assert.ok(env.fields('Кино/Сезоны/Test - s01.md').Комментарий.includes('Преамбула со ссылкой [[Заметка#^p]]'));
    assert.ok(env.fields('Кино/Сезоны/Test - s02.md').Комментарий.includes('^season-2'));
    assert.ok(env.texts.get(mediaPath).includes(legacy.replace(/\n/g, '\r\n')));
    assertLayout(env.texts.get(mediaPath), 'media', true);
    assert.equal(env.fields(mediaPath)['Количество сезонов'], 3);
    env.texts.set(newPath, env.texts.get(newPath).replace('\n---\n', '\n' + customYaml + '\n---\n') + '\n' + personal + '\n');
    env.app.workspace.getActiveFile = () => env.files.get(newPath);
    env.quickAddApi.requestInputs = async () => ({ season: '4', date: '2026-10-05', rating: '7', comment: 'Исправленный отзыв.' });
    await require('../edit_season.js')(env);
    const renamed = 'Кино/Сезоны/Test - s04.md';
    assert.ok(!env.files.has(newPath)); assertLayout(env.texts.get(renamed), 'season');
    assert.ok(env.texts.get(renamed).includes(personal));
    assert.ok(env.texts.get(renamed).includes(customYaml));
    assert.equal(env.fields(renamed).Комментарий, 'Исправленный отзыв.');
    assert.equal(env.fields(mediaPath)['Последний сезон'], 4);
    assertLayout(env.texts.get(mediaPath), 'media', true);
});

for (const kind of ['viewing', 'season']) test('an existing legacy ' + kind + ' migrates only a missing comment, without copying the interface', async () => {
    const serial = kind === 'season', mediaPath = 'Кино/Media/Test.md';
    const recordPath = serial ? 'Кино/Сезоны/Test - s01.md' : 'Кино/Просмотры/Test - v1.md';
    const legacyBody = (serial ? '# Сезон 1 (8/10)' : '# Просмотр 1 (8/10)') + '\n\n' + personal + '\n\n---\n[[Кино/Media/Test|← Test]]';
    const fields = { [serial ? 'Сериал' : 'Фильм']: '[[Кино/Media/Test|Test]]', [serial ? 'Сезон' : 'Просмотр']: 1, Дата: '2025-01-01', Оценка: 8, tags: [kind] };
    const original = layout.ensureLayout(note(fields, legacyBody, '\r\n'), { kind, parseYaml });
    const env = mockVault({
        [mediaPath]: note({ tags: [serial ? 'serial' : 'movies'], poster, Название: 'Original' }, button),
        [recordPath]: original
    }, mediaPath, serial ? { season: '2', date: '2026-10-05', rating: '9', comment: 'Новый сезон' } : { date: '2026-10-05', rating: '9', comment: 'Новый просмотр' });
    await require(serial ? '../add_season.js' : '../add_viewing.js')(env);
    assert.equal(env.fields(recordPath).Комментарий, personal, 'legacy comment retains links, blocks and Markdown');
    assert.ok(!env.fields(recordPath).Комментарий.includes(layout.UI_START), 'generated UI is not copied into YAML');
    assert.ok(env.texts.get(recordPath).includes(legacyBody.replace(/\n/g, '\r\n')), 'the original body remains available');
    assertLayout(env.texts.get(recordPath), kind);
    env.app.workspace.getActiveFile = () => env.files.get(recordPath);
    env.quickAddApi.requestInputs = async () => serial ? { season: '1', date: '2025-01-01', rating: '8', comment: '' } : { number: '1', date: '2025-01-01', rating: '8', comment: '' };
    await require(serial ? '../edit_season.js' : '../edit_viewing.js')(env);
    assert.equal(env.fields(recordPath).Комментарий, '', 'an explicitly cleared YAML comment is authoritative');
    env.app.workspace.getActiveFile = () => env.files.get(mediaPath);
    env.quickAddApi.requestInputs = async () => serial ? { season: '3', date: '2026-10-05', rating: '8', comment: 'Следующий' } : { date: '2026-10-05', rating: '8', comment: 'Следующий' };
    await require(serial ? '../add_season.js' : '../add_viewing.js')(env);
    assert.equal(env.fields(recordPath).Комментарий, '', 'later additions do not refill a cleared comment from old Markdown');
    assertLayout(env.texts.get(mediaPath), 'media', true);
});

function privateFunctions(name, names, suffix = '') {
    const loaded = { exports: {} };
    new Function('module', 'exports', 'setTimeout', 'clearTimeout', source(name) + '\n' + suffix + '\nmodule.exports.__test = {' + names.join(',') + '};')(loaded, loaded.exports, (fn, ms) => { if (ms < 1000) queueMicrotask(fn); return 1; }, () => {});
    return loaded.exports.__test;
}

for (const updater of ['Examples_Attachments_movies', 'update_kino_roles']) test('real role writer retains unknown YAML and private Markdown: ' + updater, async () => {
    const mediaPath = 'Кино/Media/Test.md', rolePath = 'Кино/_system/Роли/Test.роли.md';
    const oldRoles = note({ Название: 'Original', Актеры: ['Old Actor'], 'Роли актеров': ['Old role - Old Actor'], cssclasses: ['private-roles'] }, personal, '\r\n');
    const env = mockVault({ [mediaPath]: note({ tags: ['movies'], Название: 'Original', 'imdb Id': 'tt0000001', Жанр: ['Drama'] }), [rolePath]: oldRoles }, mediaPath);
    const { writeRoleFile } = privateFunctions(updater, ['writeRoleFile']);
    const execute = () => updater === 'Examples_Attachments_movies'
        ? writeRoleFile(env.app, env.obsidian, env.files.get(mediaPath), {}, '', { actorNames: ['New Actor'], actorRoles: ['New role - New Actor'], directorNames: ['Director'] })
        : writeRoleFile(env.app, env.files.get(mediaPath), env.fields(mediaPath), { actors: ['New Actor'], roles: ['New role - New Actor'], directors: ['Director'], kpId: '' });
    await execute();
    const next = env.texts.get(rolePath); assertLayout(next, 'roles');
    assert.ok(next.includes(personal.replace(/\n/g, '\r\n')), 'personal role notes retain newline style');
    assert.ok(next.includes(customYaml.replace(/\n/g, '\r\n')), 'unknown metadata is not replaced');
    assert.ok(env.fields(rolePath).cssclasses.includes('private-roles'));
    assert.deepEqual(env.fields(rolePath).Актеры, ['New Actor']);
    await execute(); assert.equal(env.texts.get(rolePath), next, 'repeated role updates are idempotent');
    const fresh = mockVault({ [mediaPath]: env.texts.get(mediaPath) }, mediaPath);
    if (updater === 'Examples_Attachments_movies') await writeRoleFile(fresh.app, fresh.obsidian, fresh.files.get(mediaPath), {}, '', { actorNames: ['New Actor'] });
    else await writeRoleFile(fresh.app, fresh.files.get(mediaPath), fresh.fields(mediaPath), { actors: ['New Actor'], roles: [], directors: [] });
    assertLayout(fresh.texts.get(rolePath), 'roles');
});

test('the new media template watcher applies layout, role link and one action after creating a card', async () => {
    const mediaPath = 'Кино/Media/Test.md', rolePath = 'Кино/_system/Роли/Test.роли.md';
    const env = mockVault({}, mediaPath);
    const { watchTemplate } = privateFunctions('Examples_Attachments_movies', ['watchTemplate'], 'queueFranchise = () => Promise.resolve();');
    let done; const completed = new Promise(resolve => { done = resolve; });
    const movie = { imdbID: 'tt0000001', Title: 'Original', Year: '2001', Released: '01 Jan 2001' };
    const cleanup = watchTemplate(env, movie, 'Test', 'Описание', { path: '', name: '' }, { setMessage() {}, hide: done }, '', { actorNames: ['New Actor'], actorRoles: ['Hero - New Actor'], directorNames: ['Director'] });
    await env.app.vault.create(mediaPath, note({ tags: ['movies'], 'imdb Id': 'tt0000001', poster, Название: 'Original' }, personal + '\n\n![](' + poster + ')'));
    await completed;
    cleanup();
    const result = env.texts.get(mediaPath); assertLayout(result, 'media', true);
    assert.equal(count(result, '<!-- KINO:RECOMMEND:BUTTON:V2 -->'), 1);
    assert.ok(result.includes(personal)); assert.ok(result.includes(customYaml));
    assert.equal(env.fields(mediaPath)['Роли файл'], '[[' + rolePath + ']]');
    assertLayout(env.texts.get(rolePath), 'roles');
});
