// Experimental, read-only view. Predictions are never written into book cards.
module.exports = async ({ dv, app }) => {
    const source = dv.current?.()?.file?.path || 'Книги/_system/Прогноз оценок (тест).md';
    const component = dv.component, stateKey = '__bookForecastView';
    let state = component?.[stateKey];
    if (!state && typeof component?.render === 'function') {
        const original = component.render, container = dv.container;
        state = { root: null, dispose: null };
        const wrapped = function (...args) {
            if (state.root?.parentNode === container && state.root.dataset.ready === 'true') return Promise.resolve();
            return original.apply(this, args);
        };
        component[stateKey] = state; component.render = wrapped;
        component.register(() => {
            state.dispose?.(); if (component.render === wrapped) component.render = original;
            delete component[stateKey];
        });
    }
    state?.dispose?.();
    let disposed = false, timer, generation = 0, report = null;
    const cleanups = [], rowCleanups = [], doc = dv.container.ownerDocument;
    const root = el(dv.container, 'section', 'book-home-ui book-forecast-ui'); root.dataset.ready = 'false';
    if (state) { state.root = root; state.dispose = dispose; } else component?.register?.(dispose);
    function el(parent, tag, cls = '', text) {
        const node = doc.createElement(tag); if (cls) node.className = cls;
        if (text !== undefined) node.textContent = String(text); parent.appendChild(node); return node;
    }
    function listen(node, name, callback, listeners = cleanups) {
        node.addEventListener(name, callback); listeners.push(() => node.removeEventListener(name, callback));
    }
    function internal(parent, label, target, cls = '', listeners = cleanups) {
        const link = el(parent, 'a', 'internal-link ' + cls, label); link.href = target; link.dataset.href = target;
        listen(link, 'click', event => { event.preventDefault(); if (!disposed) app.workspace.openLinkText(target, source, Boolean(event.ctrlKey || event.metaKey)); }, listeners);
        return link;
    }
    const format = (value, digits = 1) => Number.isFinite(value) ? value.toFixed(digits).replace('.', ',') : '—';
    const signed = (value, digits = 1) => Number.isFinite(value) ? (value > 0 ? '+' : '') + format(value, digits) : '—';
    const percent = value => Number.isFinite(value) ? Math.round(value * 100) + '%' : '—';
    const names = value => (Array.isArray(value) ? value : [value]).filter(Boolean).join(', ');
    const normalize = value => String(value ?? '').toLocaleLowerCase('ru').replace(/ё/g, 'е');
    const types = { book: 'Книга / другое', novel: 'Роман', novella: 'Повесть', story: 'Рассказ', collection: 'Сборник', essay: 'Эссе', play: 'Пьеса', poem: 'Стихи', other: 'Другое' };
    const preferences = app.__bookForecastPreferences || (app.__bookForecastPreferences = { query: '', filter: 'all', sort: 'forecast', descending: true });
    let engine;
    try {
        const styleLoader = app.vault.getAbstractFileByPath('Кино/_system/vault_styles.js');
        if (styleLoader) {
            const module = { exports: {} }; new Function('module', await app.vault.read(styleLoader))(module);
            await module.exports({ app, document: doc });
        }
        const paths = ['library-home.css', 'book-forecast.css', 'book_forecast.js'];
        const files = paths.map(path => app.vault.getAbstractFileByPath('Книги/_system/' + path));
        if (files.some(file => !file)) throw Error('Не найдены файлы тестовой страницы прогноза.');
        const texts = await Promise.all(files.map(file => app.vault.read(file)));
        if (disposed) return { dispose };
        el(root, 'style', '', texts[0] + '\n' + texts[1]);
        const module = { exports: {} }; new Function('module', texts[2])(module); engine = module.exports;
    } catch (problem) { dispose(); throw problem; }

    const masthead = el(root, 'header', 'book-home-masthead');
    internal(masthead, '← Библиотека', 'Книги/_index', 'book-forecast-back');
    const identity = el(masthead, 'div', 'book-forecast-identity');
    const heading = el(identity, 'div');
    el(heading, 'h1', 'book-home-title', 'Прогноз оценок');
    el(heading, 'p', 'book-forecast-caption', 'Тест · только художественные произведения');
    const refresh = el(identity, 'button', 'book-home-action', 'Пересчитать'); refresh.type = 'button';
    const status = el(masthead, 'p', 'book-forecast-status', 'Считаю прогноз и проверяю точность…'); status.setAttribute('role', 'status');
    const metrics = el(masthead, 'div', 'book-forecast-metrics');
    const metricValues = {};
    for (const [key, label] of [['rated', 'Оценок для проверки'], ['mae', 'Средняя ошибка, балла'], ['baseline', 'Ошибка простой медианы'], ['within1', 'Попадание в ±1 балл']]) {
        const box = el(metrics, 'div', 'book-forecast-metric'); metricValues[key] = el(box, 'strong', '', '—'); el(box, 'span', '', label);
    }
    const warning = el(root, 'p', 'book-forecast-warning'); warning.hidden = true;
    const accuracy = el(root, 'p', 'book-forecast-accuracy');
    const method = el(root, 'details', 'book-forecast-method');
    el(method, 'summary', '', 'Как считается прогноз и что означает проверка');
    const methodBody = el(method, 'div', 'book-forecast-method-body');
    el(methodBody, 'p', '', 'Расчёт сравнивает простые модели ваших предпочтений по автору, типу произведения и серии. Поправки при небольшом числе оценок уменьшаются к общей базе. Параметры выбираются на проверочных частях данных. Если сложная модель не помогает, может быть выбран простой ориентир.');
    el(methodBody, 'p', '', 'Для каждой оценённой книги её собственная оценка исключается и из обучения, и из выбора модели. Это ретроспективная проверка на остальных книгах: более поздние оценки тоже могут участвовать. Это не прогноз, сохранённый до чтения.');
    el(methodBody, 'p', '', 'У проверочных строк разные обучающие наборы и выбранные модели, поэтому даже при одинаковых признаках их прогнозы могут различаться. Для всех произведений без оценки применяется одна модель, выбранная по всей оценённой базе.');
    el(methodBody, 'p', '', 'Заметки, отзывы, цитаты и число перечитываний не используются: они могут выдать вашу оценку. Жанры, сюжеты и внешние рейтинги в этот эксперимент не входят. Без оценок автора и серии прогноз остаётся ориентиром по доступным общим данным.');
    el(methodBody, 'p', '', '«Книга / другое» означает, что work_type не указан, как в текущем каталоге. «Без оценки» не означает «не прочитано». Одинаковые прогнозы у произведений с одинаковыми доступными признаками ожидаемы.');
    const methodResult = el(methodBody, 'p');
    const controls = el(root, 'div', 'book-forecast-controls');
    const search = el(controls, 'input'); search.type = 'search'; search.placeholder = 'Произведение, автор или серия'; search.setAttribute('aria-label', 'Поиск произведения, автора или серии'); search.value = preferences.query;
    const filter = el(controls, 'select'); filter.setAttribute('aria-label', 'Какие произведения показать');
    for (const [value, label] of [['all', 'Все художественные'], ['unrated', 'Без моей оценки'], ['rated', 'С моей оценкой']]) { const option = el(filter, 'option', '', label); option.value = value; }
    filter.value = preferences.filter;
    const count = el(root, 'p', 'book-forecast-count'); count.setAttribute('aria-live', 'polite');
    const wrap = el(root, 'div', 'book-forecast-table-wrap'); wrap.tabIndex = 0; wrap.setAttribute('role', 'region'); wrap.setAttribute('aria-label', 'Таблица прогнозов с горизонтальной прокруткой');
    const table = el(wrap, 'table', 'book-forecast-table');
    const headers = el(el(table, 'thead'), 'tr'); const headerCells = [];
    for (const [key, label] of [['title', 'Произведение'], ['authors', 'Автор'], ['type', 'Тип'], ['forecast', 'Прогноз'], ['rating', 'Моя оценка'], ['delta', 'Δ'], ['', 'Основание'], ['', 'Расчёт']]) {
        const th = el(headers, 'th'); th.scope = 'col';
        if (key) {
            const button = el(th, 'button', 'book-forecast-sort', label); button.type = 'button';
            listen(button, 'click', () => { preferences.descending = preferences.sort === key ? !preferences.descending : !['title', 'authors', 'type'].includes(key); preferences.sort = key; draw(); });
            headerCells.push({ th, key });
        } else th.textContent = label;
    }
    const body = el(table, 'tbody');
    el(root, 'p', 'book-forecast-caption', 'Δ = моя оценка − прогноз. Положительная разница означает, что модель занизила оценку. Расчёт и метрики используют значения до округления; в таблице показаны десятые.');

    function showExplanation(row, line, button) {
        const following = line.nextElementSibling;
        if (following?.classList.contains('book-forecast-explanation-row')) { following.remove(); button.setAttribute('aria-expanded', 'false'); return; }
        const detail = doc.createElement('tr'); detail.className = 'book-forecast-explanation-row';
        const cell = el(detail, 'td'); cell.colSpan = 8;
        el(cell, 'h3', '', row.title);
        el(cell, 'p', '', row.validationMode === 'unrated' ? 'Для этой книги использованы все доступные оценки остальных произведений.' : 'Собственная оценка этой книги исключена из расчёта и выбора модели.');
        const c = row.contributions || {};
        el(cell, 'p', 'book-forecast-formula', `База ${format(c.base, 2)} + тип ${signed(c.type, 2)} + автор ${signed(c.author, 2)} + серия ${signed(c.series, 2)} = ${format(row.unclamped, 2)}`);
        if (Number.isFinite(row.unclamped) && row.unclamped !== row.raw) el(cell, 'p', '', 'После ограничения диапазоном 1–10: ' + format(row.raw, 2));
        el(cell, 'p', '', `Модель: ${row.modelName || row.modelId || '—'}. Других оценённых произведений автора: ${row.support?.author ?? 0}; серии: ${row.support?.series ?? 0}; того же типа: ${row.support?.type ?? 0}.`);
        el(cell, 'p', '', row.evidence || '');
        if (row.examples?.length) {
            el(cell, 'p', 'book-forecast-caption', 'Примеры оценённых произведений с общими признаками:');
            const list = el(cell, 'ul');
            for (const example of row.examples.slice(0, 5)) {
                const item = el(list, 'li'); internal(item, example.title, example.path, '', rowCleanups); item.appendChild(doc.createTextNode(' · ' + format(example.rating)));
            }
        }
        line.after(detail); button.setAttribute('aria-expanded', 'true');
    }
    function draw() {
        if (!report || disposed) return;
        const terms = normalize(preferences.query).split(/\s+/u).filter(Boolean);
        const rows = report.rows.filter(row => (preferences.filter !== 'rated' || Number.isFinite(row.rating)) && (preferences.filter !== 'unrated' || !Number.isFinite(row.rating)) && terms.every(term => normalize([row.title, names(row.authors), names(row.series)].join(' ')).includes(term)));
        rows.sort((a, b) => {
            const key = preferences.sort;
            const av = key === 'authors' ? names(a.authors) : a[key], bv = key === 'authors' ? names(b.authors) : b[key];
            const aEmpty = av == null || typeof av === 'number' && !Number.isFinite(av), bEmpty = bv == null || typeof bv === 'number' && !Number.isFinite(bv);
            if (aEmpty !== bEmpty) return aEmpty ? 1 : -1;
            const comparison = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av ?? '').localeCompare(String(bv ?? ''), 'ru');
            return (preferences.descending ? -comparison : comparison) || a.title.localeCompare(b.title, 'ru');
        });
        for (const { th, key } of headerCells) { if (key === preferences.sort) th.setAttribute('aria-sort', preferences.descending ? 'descending' : 'ascending'); else th.removeAttribute('aria-sort'); }
        for (const cleanup of rowCleanups.splice(0)) cleanup();
        body.replaceChildren();
        count.textContent = `Показано: ${rows.length} из ${report.rows.length} · без моей оценки: ${report.unratedCount}`;
        for (const row of rows) {
            const line = el(body, 'tr');
            internal(el(line, 'td'), row.title, row.path, '', rowCleanups);
            el(line, 'td', '', names(row.authors)); el(line, 'td', '', types[row.type] || row.type);
            el(line, 'td', 'book-forecast-number is-forecast', format(row.forecast));
            el(line, 'td', 'book-forecast-number', format(row.rating)); el(line, 'td', 'book-forecast-number', signed(row.delta));
            const evidence = el(line, 'td', 'book-forecast-evidence', row.evidence || '');
            if (!row.support?.author) evidence.classList.add('is-sparse');
            const explanation = el(el(line, 'td'), 'button', 'book-forecast-detail', 'Разбор'); explanation.type = 'button'; explanation.setAttribute('aria-expanded', 'false'); explanation.setAttribute('aria-label', 'Расчёт прогноза: ' + row.title);
            listen(explanation, 'click', () => showExplanation(row, line, explanation), rowCleanups);
        }
        if (!rows.length) { const cell = el(el(body, 'tr'), 'td', 'book-forecast-empty', 'Нет произведений по выбранным условиям.'); cell.colSpan = 8; }
    }
    function collect() {
        return app.vault.getMarkdownFiles().filter(file => file.path.startsWith('Книги/Художественные/')).map(file => {
            const fm = app.metadataCache.getFileCache(file)?.frontmatter || {};
            return { path: file.path, title: String(fm.title || file.basename), authors: fm.authors, type: fm.work_type || 'book', series: fm.series || '', rating: fm.rating, date: fm.date || '' };
        });
    }
    async function reload(force = false) {
        const current = ++generation; refresh.disabled = true; status.textContent = 'Считаю прогноз и проверяю точность…';
        await new Promise(resolve => setTimeout(resolve, 0));
        if (disposed || current !== generation) return;
        try {
            const records = collect(), signature = JSON.stringify(records) + ':' + String(engine.VERSION || engine.version || 1);
            const cached = app.__bookForecastCache;
            report = !force && cached?.signature === signature ? cached.report : engine.buildForecast(records);
            if (disposed || current !== generation) return;
            app.__bookForecastCache = { signature, report };
            const v = report.validation || {};
            metricValues.rated.textContent = String(v.n ?? report.ratedCount);
            metricValues.mae.textContent = format(v.mae, 2); metricValues.baseline.textContent = format(v.baselineMedianMae, 2); metricValues.within1.textContent = percent(v.within1);
            accuracy.textContent = !Number.isFinite(v.mae) ? 'Оценок пока недостаточно для проверки точности.' : v.mae >= v.baselineMedianMae ? 'В этой проверке модель пока не точнее простой медианы. Прогноз остаётся экспериментальным.' : 'В этой проверке модель точнее простой медианы; качество на новых произведениях может отличаться.';
            status.textContent = `${report.totalCount} художественных · ${report.ratedCount} с оценкой · ${report.unratedCount} без оценки`;
            const sparse = report.rows.filter(row => !Number.isFinite(row.rating) && !row.support?.author);
            warning.hidden = !sparse.length;
            warning.textContent = `Для ${sparse.length} произведений без оценки нет других оценённых книг автора. Их прогноз приблизительный; одинаковые значения внутри одного типа ожидаемы.`;
            methodResult.textContent = `Модель для произведений без оценки: ${report.model?.name || '—'}. Проверено произведений: ${v.n ?? 0}. MAE: ${format(v.mae, 2)}, RMSE: ${format(v.rmse, 2)}. Простая средняя: MAE ${format(v.baselineMae, 2)}; простая медиана: ${format(v.baselineMedianMae, 2)}. У 80% проверенных прогнозов абсолютная ошибка не больше ${format(v.residual80)} балла; это описание этой проверки, а не гарантия для новой книги.`;
            draw(); root.dataset.ready = 'true';
        } catch (problem) { if (!disposed && current === generation) { status.textContent = 'Не удалось рассчитать прогноз: ' + (problem.message || problem); } }
        finally { if (!disposed && current === generation) refresh.disabled = false; }
    }
    listen(refresh, 'click', () => void reload(true));
    listen(search, 'input', () => { preferences.query = search.value; draw(); });
    listen(filter, 'change', () => { preferences.filter = filter.value; draw(); });
    function schedule(file) {
        if (file?.path && !file.path.startsWith('Книги/Художественные/')) return;
        clearTimeout(timer); timer = setTimeout(() => void reload(), 180);
    }
    for (const [owner, names] of [[app.metadataCache, ['changed']], [app.vault, ['create', 'delete']]]) {
        for (const name of names) if (owner?.on) { const ref = owner.on(name, schedule); cleanups.push(() => owner.offref?.(ref)); }
    }
    if (app.vault?.on) {
        const ref = app.vault.on('rename', (file, oldPath) => oldPath?.startsWith('Книги/Художественные/') ? schedule() : schedule(file));
        cleanups.push(() => app.vault.offref?.(ref));
    }
    function dispose() {
        if (disposed) return; disposed = true; generation++; clearTimeout(timer);
        for (const cleanup of [...rowCleanups, ...cleanups]) cleanup(); root.remove(); if (state?.root === root) state.root = null;
    }
    await reload(); return { dispose, reload };
};
