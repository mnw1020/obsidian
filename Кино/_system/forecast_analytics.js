/* Read-only dashboard: metadata cache + training.json; no inference, queue or report scan. */
'use strict';
const BASE = 'Кино/_system/';
const TRAINING = BASE + 'Прогноз/training.json';
const BRANCHES = [
    { id: 'final', label: 'Итог', field: 'Прогноз оценки' },
    { id: 'data', label: 'По данным', field: 'Прогноз по данным' },
    { id: 'plot', label: 'По сюжету', field: 'Прогноз по сюжету' }
];
function numeric(value) {
    if (value == null || typeof value === 'boolean' || typeof value === 'object' || String(value).trim() === '') return null;
    const n = Number(String(value).trim().replace(',', '.'));
    return Number.isFinite(n) ? n : null;
}
function rating(value) { const n = numeric(value); return n !== null && n >= 1 && n <= 10 ? n : null; }
function isoDate(value) {
    if (value instanceof Date && !Number.isFinite(value.getTime())) return null;
    const raw = value instanceof Date ? value.toISOString() : String(value ?? '').trim();
    const time = /^\d{4}-\d{2}-\d{2}T/.test(raw) ? Date.parse(raw) : NaN;
    return Number.isFinite(time) ? new Date(time).toISOString() : null;
}
function reportPath(value) {
    const raw = String(value?.path ?? value ?? '').trim();
    const path = raw.match(/^\[\[([^\]|]+)(?:\|[^\]]*)?\]\]$/)?.[1] || raw;
    return /^Кино\/_system\/Прогноз\/reports\/[^/\\]+\.json$/.test(path) && !path.includes('..') ? path : '';
}
function collect(app, version) {
    const rows = [];
    for (const file of app.vault.getMarkdownFiles()) {
        if (!/^Кино\/Media\/[^/]+\.md$/i.test(file.path)) continue;
        const fm = app.metadataCache.getFileCache(file)?.frontmatter;
        if (!fm) continue;
        const tags = (Array.isArray(fm.tags) ? fm.tags : [fm.tags]).map(v => String(v ?? '').replace(/^#/, ''));
        if (!tags.some(t => t === 'movies' || t === 'serial')) continue;
        const row = { path: file.path, name: file.basename || file.path.split('/').pop().replace(/\.md$/i, ''),
            type: tags.includes('serial') ? 'serial' : 'movies', actual: rating(fm['Оценка']),
            version: String(fm['Версия прогноза'] ?? ''), status: String(fm['Статус прогноза'] ?? ''),
            date: isoDate(fm['Дата прогноза']), report: reportPath(fm['Расчёт прогноза']) };
        for (const b of BRANCHES) row[b.id] = rating(fm[b.field]);
        row.kind = BRANCHES.every(b => row[b.id] === null) ? 'missing'
            : row.version !== version || !row.status ? 'legacy'
            : row.status === 'Готов' && BRANCHES.every(b => row[b.id] !== null) ? 'ready' : 'provisional';
        rows.push(row);
    }
    return rows;
}
function stats(rows, branch) {
    let n = 0, sum = 0, square = 0, signed = 0, within05 = 0, within1 = 0, within2 = 0, within3 = 0;
    for (const row of rows) {
        if (rating(row.actual) === null || rating(row[branch]) === null) continue;
        const error = row.actual - row[branch], abs = Math.abs(error);
        n++; sum += abs; square += error * error; signed += error;
        if (abs <= 0.5 + 1e-9) within05++;
        if (abs <= 1 + 1e-9) within1++;
        if (abs <= 2 + 1e-9) within2++;
        if (abs <= 3 + 1e-9) within3++;
    }
    return { n, mae: n ? sum / n : null, rmse: n ? Math.sqrt(square / n) : null,
        bias: n ? signed / n : null, within05: n ? within05 / n * 100 : null, within1: n ? within1 / n * 100 : null,
        within2: n ? within2 / n * 100 : null, within3: n ? within3 / n * 100 : null };
}
function build(records, filters) {
    const rated = records.filter(r => r.actual !== null && (!filters.type || r.type === filters.type));
    const scoped = rated.filter(r => filters.kind === 'all' ? r.kind !== 'missing' : r.kind === filters.kind);
    const rows = scoped.filter(r => r[filters.branch] !== null);
    const paired = scoped.filter(r => BRANCHES.every(b => r[b.id] !== null));
    const errors = rows.map(r => Math.abs(r.actual - r[filters.branch]));
    const limits = [0.5, 1, 1.5, 2, Infinity];
    const bins = limits.map((upper, i) => errors.filter(e => e <= upper + 1e-9 && (i === 0 || e > limits[i - 1] + 1e-9)).length);
    return { rated, scoped, rows, paired, stats: stats(rows, filters.branch), bins,
        comparison: BRANCHES.map(b => ({ ...b, ...stats(paired, b.id) })) };
}
async function engineFor(app) {
    const sources = await Promise.all(['forecast_core', 'forecast_ensemble'].map(async name => {
        const file = app.vault.getAbstractFileByPath(BASE + name + '.js');
        if (!file) throw Error('Не найден ' + name + '.js'); return app.vault.read(file);
    }));
    const core = { exports: {} }, ensemble = { exports: {} };
    new Function('module', 'exports', sources[0])(core, core.exports);
    new Function('module', 'exports', 'require', sources[1])(ensemble, ensemble.exports, id => {
        if (id === './forecast_core.js') return core.exports; throw Error('Неизвестная зависимость аналитики');
    });
    return { version: ensemble.exports.VERSION, engine: ensemble.exports.ENGINE };
}
async function render({ dv, app, obsidian = {} }) {
    const doc = dv.container.ownerDocument, component = dv.component;
    const source = dv.current?.()?.file?.path || BASE + 'Аналитика прогнозов.md', key = '__kinoForecastAnalytics';
    let state = component?.[key];
    if (!state) {
        state = { branch: 'final', type: '', kind: 'ready', query: '', limit: '15', sort: 'error', folds: {} };
        if (component) {
            component[key] = state;
            const original = component.render;
            if (typeof original === 'function') {
                const wrapped = function(...args) { return state.root?.parentNode === dv.container && state.root.dataset.ready === 'true' ? Promise.resolve() : original.apply(this, args); };
                component.render = wrapped;
                component.register?.(() => { if (component.render === wrapped) component.render = original; delete component[key]; });
            }
        }
    }
    state.dispose?.();
    let root, disposed = false, timer, generation = 0, records = [], training = null, engine, trainingError = '', details, model;
    let enginePromise = engineFor(app);
    const cleanups = [];
    function el(parent, tag, cls = '', value) {
        const node = doc.createElement(tag); if (cls) node.className = cls;
        if (value !== undefined) node.textContent = String(value); parent.appendChild(node); return node;
    }
    function listen(node, event, callback) { node.addEventListener(event, callback); cleanups.push(() => node.removeEventListener(event, callback)); }
    function dispose() {
        if (disposed) return; disposed = true; generation++; clearTimeout(timer);
        for (const fn of cleanups.splice(0)) fn(); root?.remove(); if (state.root === root) state.root = null;
    }
    state.dispose = dispose; component?.register?.(dispose);
    const fmt = (n, digits = 2) => Number.isFinite(n) ? n.toFixed(digits).replace('.', ',') : '—';
    const pct = n => Number.isFinite(n) ? fmt(n, 1) + '%' : '—';
    const signed = n => Number.isFinite(n) ? (n > 0 ? '+' : '') + fmt(n) : '—';
    const dateLabel = value => value ? new Date(value).toLocaleString('ru-RU', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'дата не сохранена';
    function internal(parent, label, path) { const a = el(parent, 'a', 'internal-link', label); a.href = path; a.dataset.href = path; return a; }
    function section(title, id, open = true) {
        const box = el(root, 'details', 'kino-report-section'); box.dataset.section = id; box.open = state.folds[id] ?? open;
        const summary = el(box, 'summary'); el(summary, 'span', '', title); el(summary, 'span', 'kino-home-fold-chevron').setAttribute('aria-hidden', 'true');
        listen(box, 'toggle', () => { state.folds[id] = box.open; }); return el(box, 'div', 'kino-report-body');
    }
    function table(parent, headings) {
        const wrap = el(parent, 'div', 'kino-report-table'), tr = el(el(el(wrap, 'table'), 'thead'), 'tr');
        for (const h of headings) el(tr, 'th', '', h).scope = 'col'; return el(tr.closest('table'), 'tbody');
    }
    function cells(body, values, cls = '') { const tr = el(body, 'tr', cls); for (const v of values) el(tr, 'td', '', v); }
    function select(parent, label, options, value) {
        const node = el(el(parent, 'label', '', label), 'select'); node.setAttribute('aria-label', label);
        for (const [v, text] of options) el(node, 'option', '', text).value = v; node.value = value; return node;
    }
    try {
        const css = await Promise.all(['kino-home.css', 'kino-statistics.css', 'kino-analytics.css'].map(async name => {
            const file = app.vault.getAbstractFileByPath(BASE + name); if (!file) throw Error('Не найден ' + name); return app.vault.read(file);
        }));
        engine = await enginePromise; if (disposed) return { dispose };
        const styleFile = app.vault.getAbstractFileByPath(BASE + 'vault_styles.js');
        if (styleFile) {
            try { const mod = { exports: {} }; new Function('module', await app.vault.read(styleFile))(mod); await mod.exports({ app, document: doc }); }
            catch (error) { console.warn('Кино: общие стили аналитики', error); }
        }
        if (disposed) return { dispose };
        root = el(dv.container, 'section', 'kino-home-ui kino-report kino-forecast-analytics'); state.root = root;
        el(root, 'style', '', css.join('\n'));
        listen(root, 'click', e => {
            const link = e.target.closest('a[data-href]'); if (!link || !root.contains(link)) return;
            e.preventDefault(); app.workspace.openLinkText(link.dataset.href, source, Boolean(e.ctrlKey || e.metaKey));
        });
        const head = el(root, 'header', 'kino-home-masthead'), nav = el(head, 'nav', 'kino-home-nav');
        internal(nav, '← Кинотека', 'Кино/_index.md'); internal(nav, 'Итоги просмотров', BASE + 'Итоги просмотров.md'); internal(nav, 'О прогнозах', BASE + 'Прогноз/README.md');
        el(head, 'h1', 'kino-home-title', 'Аналитика прогнозов');
        el(head, 'p', 'kino-home-subtitle', 'Данные, сюжет и итог · точность, веса и сохранённые расчёты');
        const controls = el(head, 'div', 'kino-report-controls');
        const branchSelect = select(controls, 'Прогноз', BRANCHES.map(b => [b.id, b.label]), state.branch);
        const typeSelect = select(controls, 'Тип', [['', 'Фильмы и сериалы'], ['movies', 'Фильмы'], ['serial', 'Сериалы']], state.type);
        const kindSelect = select(controls, 'Расчёты', [['ready', 'Готовые текущей версии'], ['all', 'Все сохранённые'], ['provisional', 'Предварительные'], ['legacy', 'Старые / без статуса']], state.kind);
        const context = el(head, 'p', 'kino-report-period'); context.setAttribute('role', 'status');
        const metrics = el(head, 'div', 'kino-home-stats'), metricValues = [];
        for (const label of ['Сравнено карточек', 'Средняя ошибка · MAE', 'Попадание в ±1 балл', 'Попадание в ±2 балла', 'Попадание в ±3 балла']) {
            const box = el(metrics, 'div', 'kino-home-stat'); metricValues.push(el(box, 'strong', '', '—')); el(box, 'span', '', label);
        }
        const validationBox = section('Независимая проверка модели', 'validation');
        const validationDate = el(validationBox, 'p', 'kino-analytics-note');
        const validationBody = table(validationBox, ['Прогноз', 'Карточек', 'MAE ↓', 'RMSE ↓']);
        const validationInsight = el(validationBox, 'p', 'kino-analytics-insight');
        el(validationBox, 'p', 'kino-analytics-note', 'Последняя сохранённая проверка всей оценённой базы, до округления прогнозов. Фильтры сверху меняют только сравнение сохранённых полей ниже.');
        const weightsBox = section('Как складывается итог', 'weights');
        const weightsBar = el(weightsBox, 'div', 'kino-analytics-weights'), weightLabels = el(weightsBox, 'div', 'kino-analytics-weight-labels');
        const weightsNote = el(weightsBox, 'p', 'kino-analytics-note');
        el(weightsBox, 'p', 'kino-analytics-note', 'Итог смешивает значения до округления. Каждый готовый источник получает от 25% до 75%; при недостатке независимых пар — 50/50. Без сюжета итог предварительно использует данные. Это правило не гарантирует улучшение точности.');
        const snapshotBox = section('Сохранённые прогнозы', 'snapshots');
        const coverage = el(snapshotBox, 'p', 'kino-analytics-note'), pairCaption = el(snapshotBox, 'p', 'kino-analytics-note');
        const pairBody = table(snapshotBox, ['Общая выборка', 'Карточек', 'MAE ↓', 'RMSE ↓', '±0,5', '±1', '±2', '±3', 'Среднее Δ']);
        const freshness = el(snapshotBox, 'p', 'kino-analytics-note');
        const chartGrid = el(section('Прогноз и личная оценка', 'charts'), 'div', 'kino-report-grid');
        const scatterBox = el(chartGrid, 'div'); el(scatterBox, 'h3', '', 'Ближе к диагонали — точнее');
        const scatter = el(scatterBox, 'div', 'kino-analytics-scatter');
        el(scatterBox, 'p', 'kino-analytics-note', 'По горизонтали — прогноз, по вертикали — личная оценка. Наведение на точку показывает карточку и Δ.');
        const histogramBox = el(chartGrid, 'div'); el(histogramBox, 'h3', '', 'Абсолютная ошибка');
        const histogram = el(histogramBox, 'div', 'kino-analytics-histogram'), extraMetrics = el(histogramBox, 'p', 'kino-analytics-note');
        const missesBox = section('Где прогноз расходится с оценкой', 'misses');
        const searchControls = el(missesBox, 'div', 'kino-report-table-controls');
        const search = el(searchControls, 'input'); search.type = 'search'; search.placeholder = 'Найти фильм или сериал'; search.setAttribute('aria-label', 'Поиск карточки'); search.value = state.query;
        const sort = select(searchControls, 'Сортировка', [['error', 'Крупные промахи'], ['accurate', 'Точные попадания'], ['name', 'По названию']], state.sort);
        const limit = select(searchControls, 'Показать', [['15', '15 строк'], ['30', '30 строк'], ['50', '50 строк'], ['100', '100 строк']], state.limit);
        const missesBody = table(missesBox, ['Произведение', 'Моя', 'Данные', 'Сюжет', 'Итог', 'Δ']);
        const tableCaption = el(missesBox, 'p', 'kino-report-table-caption');
        const method = section('Как читать эту страницу', 'method', false);
        for (const text of [
            'MAE — средняя абсолютная ошибка в баллах; RMSE сильнее учитывает крупные промахи. Меньше — лучше. ±0,5, ±1, ±2 и ±3 — доля прогнозов с абсолютной ошибкой не больше указанного числа баллов; границы включены.',
            'Δ = личная оценка − выбранный прогноз. Положительное среднее Δ означает, что прогноз занижает оценку; отрицательное — завышает.',
            'Независимая проверка скрывает оценки внешней группы и её дубликатов при обучении и подборе параметров. Веса подбираются внутри обучающей части; внешняя проверка оценивает полученную смесь отдельно.',
            'Графики и таблицы сохранённых прогнозов сравнивают текущие YAML-поля, округлённые до десятых. Они могли быть пересчитаны после просмотра и не являются историей прогнозов, сделанных заранее. Их ошибка может отличаться от независимой проверки.',
            'Общая таблица веток использует одну выборку с личной оценкой и всеми тремя прогнозами. Пустые, некорректные и выходящие за диапазон 1–10 значения не считаются нулями.',
            'После изменения оценок или свойств проверка и веса обновляются при следующем расчёте прогноза. Карточки остаются снимками своих расчётов. Для применения новых параметров ко всей коллекции открой «Проверка кинотеки» и запусти «Обновить оценки».'
        ]) el(method, 'p', '', text);
        internal(method, 'Открыть проверку кинотеки →', BASE + 'Проверка кинотеки.md');
        const updateError = el(root, 'p', 'kino-report-update'); updateError.setAttribute('role', 'status'); updateError.hidden = true;
        function renderValidation() {
            validationBody.replaceChildren(); weightsBar.replaceChildren(); weightLabels.replaceChildren();
            const compatible = training?.version === engine.version && training?.engine === engine.engine;
            const m = compatible ? training?.metrics : null;
            validationDate.textContent = trainingError || (!training ? 'Сохранённой проверки пока нет. Запусти обновление оценок из проверки кинотеки.'
                : !compatible ? 'Проверка относится к другой версии алгоритма. Обнови оценки для сравнения текущей модели.'
                : `Проверка: ${dateLabel(isoDate(training.createdAt))} · ${training.crossValidation?.outerFolds ?? '—'} × ${training.crossValidation?.innerFolds ?? '—'} разбиения · ${training.ratedCount ?? '—'} карточек / ${training.groupCount ?? '—'} произведений.`);
            const methods = [['data155', 'По данным · 155 соседей'], ['plot-embeddinggemma', 'По сюжету · EmbeddingGemma'], ['half', 'Смесь 50/50'], ['tuned', 'Итог по надёжности']];
            const scores = methods.map(([key, label]) => ({ label, count: numeric(m?.[key]?.count), mae: numeric(m?.[key]?.mae), rmse: numeric(m?.[key]?.rmse) }));
            const available = scores.filter(s => s.count > 0 && s.mae !== null), best = available.length ? Math.min(...available.map(s => s.mae)) : null;
            for (const s of scores) cells(validationBody, [s.label, s.count ?? '—', fmt(s.mae, 4), fmt(s.rmse, 4)], s.mae !== null && s.mae === best ? 'is-best' : '');
            const d = numeric(m?.data155?.mae), f = numeric(m?.tuned?.mae), h = numeric(m?.half?.mae);
            let insight = d === null || f === null ? 'Для сравнения точности нужны результаты проверки текущей версии.'
                : Math.abs(f - d) < 1e-8 ? 'Итог и данные показали одинаковую среднюю ошибку.'
                : `Итог ${f > d ? 'уступает ветке по данным' : 'точнее ветки по данным'} на ${fmt(Math.abs(f - d), 4)} балла MAE.`;
            if (h !== null && f !== null) insight += Math.abs(h - f) < 1e-8 ? ' Смесь 50/50 даёт ту же ошибку.' : ` По сравнению с 50/50 ошибка ${f < h ? 'меньше' : 'больше'} на ${fmt(Math.abs(h - f), 4)}.`;
            if (new Set(scores.map(s => s.count).filter(n => n > 0)).size > 1) insight += ' Покрытие веток отличается: смотри число карточек; для смеси без сюжета используются данные.';
            validationInsight.textContent = insight;
            const parameters = compatible ? training?.global?.parameters : null;
            const dw = numeric(parameters?.weights?.data155), pw = numeric(parameters?.weights?.['plot-embeddinggemma']);
            const haveWeights = dw !== null && pw !== null && dw >= 0 && pw >= 0 && Math.abs(dw + pw - 1) < 1e-6;
            if (haveWeights) for (const [id, label, value] of [['data', 'По данным', dw], ['plot', 'По сюжету', pw]]) {
                const bar = el(weightsBar, 'span', 'is-' + id); bar.style.width = value * 100 + '%'; bar.setAttribute('aria-hidden', 'true');
                const item = el(weightLabels, 'span', '', label + ' '); el(item, 'strong', '', pct(value * 100));
            }
            weightsBar.hidden = !haveWeights;
            weightsNote.textContent = !haveWeights ? 'Веса текущей модели ещё не сохранены.'
                : `Текущие веса для новых карточек. У оценённых карточек веса подбирались без их внешней группы. ${parameters?.reliability?.fallbackReason || 'Меньшая MAE на одинаковых внутренних проверочных карточках даёт больший вес.'}`;
        }
        function drawTable() {
            missesBody.replaceChildren();
            const query = state.query.trim().toLocaleLowerCase('ru'), rows = model.rows.filter(r => r.name.toLocaleLowerCase('ru').includes(query));
            const error = r => Math.abs(r.actual - r[state.branch]);
            rows.sort((a, b) => (state.sort === 'name' ? 0 : state.sort === 'accurate' ? error(a) - error(b) : error(b) - error(a)) || a.name.localeCompare(b.name, 'ru'));
            for (const row of rows.slice(0, Number(state.limit))) {
                const tr = el(missesBody, 'tr'), name = el(tr, 'td'); internal(name, row.name, row.path);
                el(name, 'span', 'kino-analytics-row-meta', `${row.type === 'serial' ? 'Сериал' : 'Фильм'} · ${dateLabel(row.date)}${row.kind === 'ready' ? '' : ' · ' + (row.kind === 'legacy' ? 'старый / без статуса' : 'предварительный')}`);
                for (const id of ['actual', 'data', 'plot', 'final']) {
                    const cell = el(tr, 'td', id === state.branch ? 'is-selected' : '', fmt(row[id], 1));
                    if (id === 'final' && row.report) { const button = el(cell, 'button', 'kino-analytics-detail', 'Разбор'); button.type = 'button'; button.dataset.report = row.path; button.setAttribute('aria-label', 'Разбор прогноза: ' + row.name); }
                }
                el(tr, 'td', '', signed(row.actual - row[state.branch]));
            }
            tableCaption.textContent = `Показано ${Math.min(rows.length, Number(state.limit))} из ${rows.length}. Δ относится к прогнозу «${BRANCHES.find(b => b.id === state.branch).label}».`;
        }
        function drawScatter(rows) {
            scatter.replaceChildren(); if (!rows.length) { el(scatter, 'p', 'kino-home-empty', 'Нет оценённых карточек для выбранных фильтров.'); return; }
            const ns = 'http://www.w3.org/2000/svg', svg = doc.createElementNS(ns, 'svg');
            svg.setAttribute('viewBox', '0 0 440 340'); svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', 'Прогноз по горизонтали, личная оценка по вертикали');
            function node(tag, attrs, text, parent = svg) { const n = doc.createElementNS(ns, tag); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v); if (text !== undefined) n.textContent = text; parent.appendChild(n); return n; }
            const sx = v => 38 + (v - 1) / 9 * 382, sy = v => 300 - (v - 1) / 9 * 278;
            for (let i = 1; i <= 10; i++) {
                node('line', { x1: sx(i), x2: sx(i), y1: 22, y2: 300, class: 'kino-analytics-grid' });
                node('line', { x1: 38, x2: 420, y1: sy(i), y2: sy(i), class: 'kino-analytics-grid' });
                node('text', { x: sx(i), y: 320, 'text-anchor': 'middle' }, i); node('text', { x: 23, y: sy(i) + 4, 'text-anchor': 'middle' }, i);
            }
            node('line', { x1: sx(1), x2: sx(10), y1: sy(1), y2: sy(10), class: 'kino-analytics-diagonal' });
            for (const row of rows) {
                const circle = node('circle', { cx: sx(row[state.branch]), cy: sy(row.actual), r: 2.7, class: 'kino-analytics-point' });
                node('title', {}, `${row.name}\nПрогноз: ${fmt(row[state.branch], 1)} · моя: ${fmt(row.actual, 1)}\nΔ: ${signed(row.actual - row[state.branch])}`, circle);
            }
            node('text', { x: 230, y: 339, 'text-anchor': 'middle' }, 'Прогноз →'); node('text', { x: 38, y: 13 }, 'Личная оценка ↑'); scatter.appendChild(svg);
        }
        function draw() {
            if (disposed) return; model = build(records, state); const s = model.stats;
            context.textContent = `${BRANCHES.find(b => b.id === state.branch).label} · ${state.type === 'movies' ? 'фильмы' : state.type === 'serial' ? 'сериалы' : 'фильмы и сериалы'} · ${kindSelect.selectedOptions[0].textContent.toLocaleLowerCase('ru')}`;
            for (const [i, value] of [String(s.n), fmt(s.mae), pct(s.within1), pct(s.within2), pct(s.within3)].entries()) metricValues[i].textContent = value;
            const count = kind => model.rated.filter(r => r.kind === kind).length;
            coverage.textContent = `Оценённых карточек: ${model.rated.length}. Готовы (v${engine.version}): ${count('ready')}; предварительные: ${count('provisional')}; старые / без статуса: ${count('legacy')}; без прогноза: ${count('missing')}. Выбрано: ${model.scoped.length}; с выбранным прогнозом: ${s.n}.`;
            pairBody.replaceChildren(); pairCaption.textContent = `Три ветки на одной выборке: ${model.paired.length} карточек. Значения из сохранённых полей, с округлением до десятых.`;
            for (const r of model.comparison) cells(pairBody, [r.label, r.n, fmt(r.mae), fmt(r.rmse), pct(r.within05), pct(r.within1), pct(r.within2), pct(r.within3), signed(r.bias)], r.id === state.branch ? 'is-current' : '');
            const td = isoDate(training?.createdAt), dated = model.rows.filter(r => r.date), before = td ? dated.filter(r => r.date < td).length : 0;
            freshness.textContent = td ? `${before} из выбранных карточек рассчитаны раньше последней проверки; без даты: ${model.rows.length - dated.length}. Дата не доказывает устаревание: новые веса появятся в карточке только после её пересчёта.` : 'Дата проверки недоступна. Сохранённые поля показаны без проверки актуальности параметров.';
            drawScatter(model.rows); histogram.replaceChildren();
            const labels = ['До 0,5 включительно', 'Свыше 0,5 до 1', 'Свыше 1 до 1,5', 'Свыше 1,5 до 2', 'Больше 2'];
            for (const [i, n] of model.bins.entries()) {
                const row = el(histogram, 'div', 'kino-analytics-bin'); el(row, 'span', '', labels[i]);
                const bar = el(el(row, 'span', 'kino-home-chart-track'), 'span', 'kino-analytics-bin-fill'); bar.style.width = (s.n ? n / s.n * 100 : 0) + '%';
                el(row, 'strong', '', `${n} · ${s.n ? pct(n / s.n * 100) : '—'}`);
            }
            extraMetrics.textContent = `RMSE: ${fmt(s.rmse)} · попадание ±0,5: ${pct(s.within05)}. Δ = моя оценка − выбранный прогноз.`; drawTable();
        }
        async function refresh() {
            const current = ++generation;
            try {
                const nextEngine = await enginePromise, file = app.vault.getAbstractFileByPath(TRAINING);
                let nextTraining = null, nextError = '';
                try { nextTraining = file ? JSON.parse(await app.vault.read(file)) : null;
                    if (nextTraining !== null && (Array.isArray(nextTraining) || typeof nextTraining !== 'object')) throw Error('Некорректный формат');
                } catch (error) { nextTraining = null; nextError = 'Не удалось прочитать проверку: ' + (error.message || error); }
                if (disposed || current !== generation) return;
                engine = nextEngine; training = nextTraining; trainingError = nextError;
                records = collect(app, 'kino-forecast-v' + engine.version); renderValidation(); draw(); updateError.hidden = true;
            } catch (error) { if (!disposed && current === generation) { updateError.textContent = 'Не удалось обновить аналитику: ' + (error.message || error); updateError.hidden = false; } }
        }
        for (const [node, key] of [[branchSelect, 'branch'], [typeSelect, 'type'], [kindSelect, 'kind']]) listen(node, 'change', () => { state[key] = node.value; draw(); });
        listen(search, 'input', () => { state.query = search.value; drawTable(); });
        for (const [node, key] of [[sort, 'sort'], [limit, 'limit']]) listen(node, 'change', () => { state[key] = node.value; drawTable(); });
        listen(missesBody, 'click', async e => {
            const button = e.target.closest('button[data-report]'); if (!button || button.disabled) return;
            const row = model.rows.find(r => r.path === button.dataset.report); if (!row) return; button.disabled = true;
            try {
                if (!details) { const file = app.vault.getAbstractFileByPath(BASE + 'forecast_details.js'); if (!file) throw Error('Не найден модуль разбора');
                    const mod = { exports: {} }; new Function('module', await app.vault.read(file))(mod); details = mod.exports; }
                if (!disposed) await details({ app, obsidian, doc, sourcePath: row.path, reportReference: row.report, trigger: button, parent: root });
            } catch (error) { if (!disposed) { updateError.textContent = 'Не удалось открыть разбор: ' + (error.message || error); updateError.hidden = false; } }
            finally { button.disabled = false; }
        });
        function schedule(file, oldPath) {
            const paths = [file?.path, oldPath].filter(Boolean);
            if (paths.some(p => p === BASE + 'forecast_core.js' || p === BASE + 'forecast_ensemble.js')) enginePromise = engineFor(app);
            if (!paths.some(p => p === TRAINING || /^Кино\/Media\//.test(p) || p === BASE + 'forecast_core.js' || p === BASE + 'forecast_ensemble.js')) return;
            clearTimeout(timer); timer = setTimeout(() => { void refresh(); }, 300);
        }
        for (const [owner, events] of [[app.metadataCache, ['changed']], [app.vault, ['create', 'modify', 'delete', 'rename']]]) if (owner?.on) for (const event of events) {
            const ref = owner.on(event, (file, oldPath) => schedule(file, event === 'rename' ? oldPath : null)); cleanups.push(() => owner.offref?.(ref));
        }
        await refresh(); if (!disposed) root.dataset.ready = 'true'; return { dispose };
    } catch (error) { dispose(); throw error; }
}
module.exports = render;
Object.assign(module.exports, { collect, build, stats, rating, BRANCHES });
