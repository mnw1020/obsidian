// The cinema home mirrors the library home while keeping media metadata read-only.
module.exports = async ({ dv, app, obsidian = {} }) => {
    // Load collection CSS even when the startup plugin is unavailable on mobile.
    try {
        const styleFile = app.vault.getAbstractFileByPath("Кино/_system/vault_styles.js");
        if (styleFile) {
            const styles = { exports: {} };
            new Function("module", await app.vault.read(styleFile))(styles);
            await styles.exports({ app, document: dv.container.ownerDocument });
        }
    } catch (error) { console.warn("Не удалось подключить оформление коллекций", error); }

    const source = dv.current?.()?.file?.path || 'Кино/_index.md';
    const component = dv.component, stateKey = '__kinoHomeRefresh';
    let refresh = component?.[stateKey];
    if (!refresh && typeof component?.render === 'function') {
        const container = dv.container, original = component.render;
        refresh = { dispose: null, root: null };
        const wrapped = function (...args) {
            if (refresh.root?.parentNode === container && refresh.root.dataset.ready === 'true') return Promise.resolve();
            return original.apply(this, args);
        };
        component[stateKey] = refresh; component.render = wrapped;
        component.register?.(() => {
            refresh.dispose?.();
            if (component.render === wrapped) component.render = original;
            delete component[stateKey];
        });
    }
    refresh?.dispose?.();
    let disposed = false, root = null, timer = null, actionBusy = false;
    const cleanups = [], children = new Set(), commandLinks = [];
    if (refresh) refresh.dispose = dispose; else component?.register?.(dispose);
    const doc = dv.container.ownerDocument;
    function el(parent, tag, cls = '', text) {
        const node = doc.createElement(tag);
        if (cls) node.className = cls;
        if (text !== undefined) node.textContent = String(text);
        parent.appendChild(node); return node;
    }
    function listen(node, event, callback, listeners = cleanups) {
        node.addEventListener(event, callback); listeners.push(() => node.removeEventListener(event, callback));
    }
    function internal(parent, text, target, cls = '', listeners = cleanups) {
        const link = el(parent, 'a', `internal-link ${cls}`.trim(), text);
        link.href = target; link.dataset.href = target;
        listen(link, 'click', event => {
            event.preventDefault();
            if (!disposed) app.workspace.openLinkText(target, source, Boolean(event.ctrlKey || event.metaKey));
        }, listeners); return link;
    }
    function rating(value) {
        if (value == null || value === '') return null;
        const number = Number(String(value).replace(',', '.'));
        return Number.isFinite(number) ? number : null;
    }
    function calendar(value) {
        if (value == null || value === '') return null;
        let text;
        if (typeof value.toFormat === 'function') text = value.toFormat('yyyy-MM-dd');
        else if (value instanceof Date) {
            if (!Number.isFinite(value.valueOf())) return null;
            text = `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
        } else text = String(value).trim();
        const match = /^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/.exec(text);
        if (!match) return null;
        const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
        const date = new Date(0); date.setFullYear(year, month - 1, day); date.setHours(0, 0, 0, 0);
        if (date.getFullYear() !== year || date.getMonth() + 1 !== month || date.getDate() !== day) return null;
        return { year, month, day, key: year * 10000 + month * 100 + day, iso: `${match[1]}-${match[2]}-${match[3]}`, display: `${match[3]}.${match[2]}.${match[1]}` };
    }
    function releaseYear(value) {
        const date = calendar(value); if (date) return date.year;
        const text = String(value ?? '').trim();
        const year = /^(\d{4})$/.exec(text) || /^\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})$/i.exec(text);
        return year ? Number(year[1]) : null;
    }
    function media() {
        return app.vault.getMarkdownFiles()
            .filter(file => file.path.startsWith('Кино/Media/') && !file.path.slice('Кино/Media/'.length).includes('/'))
            .map(file => {
                const fields = app.metadataCache.getFileCache(file)?.frontmatter || {};
                const raw = fields.tags || [];
                const tags = (Array.isArray(raw) ? raw : [raw]).map(tag => String(tag).replace(/^#/, ''));
                return { file, fields, movie: tags.includes('movies'), serial: tags.includes('serial'), score: rating(fields['Оценка']), watched: calendar(fields['Просмотрено']), year: releaseYear(fields['Релиз']) };
            }).filter(item => item.movie || item.serial);
    }
    function recentSort(left, right) {
        return (right.watched?.key ?? -Infinity) - (left.watched?.key ?? -Infinity)
            || (right.score ?? -Infinity) - (left.score ?? -Infinity)
            || left.file.path.localeCompare(right.file.path, 'ru');
    }
    function dispose() {
        if (disposed) return; disposed = true; clearTimeout(timer);
        for (const cleanup of cleanups.splice(0)) cleanup();
        for (const child of [...children]) release(child);
        if (root) { root.dataset.ready = 'false'; root.remove(); }
        if (refresh?.root === root) refresh.root = null;
    }
    function childComponent() {
        if (!obsidian.Component || !component?.addChild) return null;
        const child = new obsidian.Component();
        let ended = false;
        const register = child.register.bind(child), unload = child.unload.bind(child), addChild = child.addChild?.bind(child);
        child.register = callback => {
            if (ended || disposed) { callback(); return callback; }
            return register(callback);
        };
        child.unload = () => { if (ended) return; ended = true; return unload(); };
        if (addChild) child.addChild = nested => {
            if (ended || disposed) { nested.load?.(); nested.unload?.(); return nested; }
            return addChild(nested);
        };
        component.addChild(child); children.add(child); return child;
    }
    function release(child) {
        if (!children.delete(child)) return;
        if (component?.removeChild) component.removeChild(child); else child.unload?.();
    }
    try {
        const styleFile = app.vault.getAbstractFileByPath('Кино/_system/kino-home.css');
        if (!styleFile) throw new Error('Не найден стиль главной страницы кинотеки.');
        const css = await app.vault.read(styleFile);
        if (disposed) return { dispose };
        if (!css.trim()) throw new Error('Стиль главной страницы кинотеки пуст.');
        root = el(dv.container, 'section', 'kino-home-ui'); root.dataset.ready = 'false';
        if (refresh) refresh.root = root;
        el(root, 'style', '', css);
        const foldKey = 'kino.home.folds.v2:' + (app.vault.getName?.() || '') + ':' + source;
        const memory = app.__kinoHomeFolds || (app.__kinoHomeFolds = Object.create(null));
        let folds = memory[foldKey] || {};
        try {
            const saved = JSON.parse(doc.defaultView.localStorage.getItem(foldKey));
            if (saved && typeof saved === 'object' && !Array.isArray(saved)) folds = saved;
        } catch (_) {}
        memory[foldKey] = folds;
        function saveFold(key, expanded) {
            if (disposed) return;
            folds[key] = expanded;
            try { doc.defaultView.localStorage.setItem(foldKey, JSON.stringify(folds)); } catch (_) {}
        }
        const instance = 'kino-fold-' + Math.random().toString(36).slice(2);
        function foldBlock(box, heading, targets, key, label) {
            // New defaults apply once; subsequent manual folding is remembered.
            const savedKey = ['overview', 'reading'].includes(key) ? key + ':v2' : key;
            box.dataset.fold = key;
            const titleNodes = key === 'footer' ? [] : [...heading.childNodes];
            const button = el(heading, 'button', 'kino-home-fold'); button.type = 'button';
            heading.prepend(button);
            const title = el(button, 'span', 'kino-home-fold-title');
            title.id = `${instance}-${key}-title`;
            button.setAttribute('aria-labelledby', title.id);
            if (key === 'footer') title.textContent = 'Служебные ссылки';
            else for (const node of titleNodes) title.appendChild(node);
            el(button, 'span', 'kino-home-fold-chevron').setAttribute('aria-hidden', 'true');
            const nodes = targets.filter(Boolean);
            nodes.forEach((node, index) => { if (!node.id) node.id = `${instance}-${key}-${index}`; });
            button.setAttribute('aria-controls', nodes.map(node => node.id).join(' '));
            function drawFold(expanded) {
                box.dataset.collapsed = String(!expanded);
                button.setAttribute('aria-expanded', String(expanded));
                for (const node of nodes) node.hidden = !expanded;
                box.dispatchEvent(new doc.defaultView.Event('kino-fold-change'));
            }
            drawFold(typeof folds[savedKey] === 'boolean' ? folds[savedKey] : ['masthead', 'overview', 'reading'].includes(key));
            listen(button, 'click', () => {
                const expanded = button.getAttribute('aria-expanded') !== 'true';
                drawFold(expanded); saveFold(savedKey, expanded);
            });
        }
        function rememberDetails(details, key, defaultOpen = false) {
            details.dataset.fold = key;
            details.open = typeof folds[key] === 'boolean' ? folds[key] : defaultOpen;
            listen(details, 'toggle', event => { if (event.target === details) saveFold(key, details.open); });
        }
        const status = el(root, 'p', 'kino-home-action-error'); status.hidden = true; status.setAttribute('role', 'status');
        function command(parent, text, choice, cls = '') {
            const link = el(parent, 'a', cls, text);
            link.href = 'obsidian://quickadd?choice=' + encodeURIComponent(choice);
            link.dataset.choice = choice; commandLinks.push(link);
            listen(link, 'click', async event => {
                const api = app.plugins?.plugins?.quickadd?.api;
                if (disposed || actionBusy) { event.preventDefault(); return; }
                if (!api?.executeChoice) return;
                event.preventDefault(); actionBusy = true;
                for (const node of commandLinks) node.setAttribute('aria-disabled', 'true');
                status.hidden = true;
                try { await api.executeChoice(choice); }
                catch (problem) {
                    if (!disposed && !/^Input cancel(?:led|ed) by user\.?$/i.test(String(problem?.message || problem))) {
                        status.textContent = `Не удалось открыть «${text}»: ${problem?.message || problem}`; status.hidden = false;
                    }
                } finally {
                    actionBusy = false;
                    if (!disposed) for (const node of commandLinks) node.removeAttribute('aria-disabled');
                }
            }); return link;
        }
        const masthead = el(root, 'header', 'kino-home-masthead');
        const nav = el(masthead, 'nav', 'kino-home-nav'); nav.setAttribute('aria-label', 'Разделы кинотеки');
        for (const [text, target] of [['Рекомендации', 'Кино/_system/Рекомендации'], ['Аналитика', 'Кино/_system/Аналитика прогнозов'], ['Инструкция', 'Кино/_system/README']]) internal(nav, text, target);
        const identity = el(masthead, 'div', 'kino-home-identity');
        const heading = el(identity, 'div', 'kino-home-heading');
        el(heading, 'h1', 'kino-home-title', 'Кинотека');
        const actions = el(identity, 'div', 'kino-home-actions');
        for (const [text, choice, primary] of [['Добавить фильм или сериал', 'movie_imdb', true], ['Добавить просмотр', 'Добавить просмотр'], ['Добавить сезон', 'Добавить сезон']]) command(actions, text, choice, 'kino-home-action' + (primary ? ' is-primary' : ''));
        const catalogue = internal(doc.createDocumentFragment(), 'Карточки', 'Кино/_system/_Кино.base#Карточки', 'kino-home-action is-icon');
        catalogue.setAttribute('aria-label', 'Карточки'); catalogue.title = 'Карточки';
        const icon = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
        for (const [name, value] of Object.entries({ viewBox: '0 0 24 24', width: '20', height: '20', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.8', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', focusable: 'false' })) icon.setAttribute(name, value);
        for (const attributes of [{ d: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z' }]) {
            const shape = doc.createElementNS('http://www.w3.org/2000/svg', 'path');
            for (const [name, value] of Object.entries(attributes)) shape.setAttribute(name, value); icon.appendChild(shape);
        }
        catalogue.replaceChildren(icon);
        const stats = el(masthead, 'div', 'kino-home-stats'), statValues = [];
        for (const [key, label] of [['total', 'В коллекции'], ['movies', 'Фильмов'], ['serials', 'Сериалов'], ['average', 'Средняя оценка']]) {
            const cell = el(stats, 'div', 'kino-home-stat'), value = el(cell, 'strong'); value.dataset.stat = key;
            el(cell, 'span', '', label); statValues.push([key, value]);
        }
        const management = el(root, 'details', 'kino-home-management'); el(management, 'summary', '', 'Управление коллекцией');
        const editActions = el(management, 'div', 'kino-home-actions');
        for (const [text, choice] of [['Редактировать просмотр', 'Редактировать просмотр'], ['Редактировать сезон', 'Редактировать сезон'], ['Пересобрать карточку', 'Пересобрать карточку'], ['Изменить франшизу', 'Франшиза']]) command(editActions, text, choice, 'kino-home-action');
        function panel(title, cls, label, target) {
            const box = el(root, 'section', `kino-home-panel ${cls}`), head = el(box, 'div', 'kino-home-panel-head');
            el(head, 'h2', '', title); if (label) internal(head, label, target, 'kino-home-section-link');
            return { box, head, body: el(box, 'div', 'kino-home-widget') };
        }
        const overviews = el(root, 'section', 'kino-home-panel kino-home-overviews'); el(overviews, 'h2', '', 'Обзор кинотеки');
        const overviewBody = el(overviews, 'div', 'kino-home-overview-body');
        const reading = panel('Статистика', 'kino-home-reading');
        internal(reading.head, 'Итоги ↗', 'Кино/_system/Итоги просмотров', 'kino-home-section-link kino-home-report-link');
        const metrics = el(reading.body, 'div', 'kino-home-metrics'), metricValues = [];
        for (const [key, label] of [['month', 'В этом месяце'], ['year', 'В этом году'], ['reread', 'Пересмотрено за всё время']]) {
            const cell = el(metrics, 'div', 'kino-home-metric'), value = el(cell, 'strong'); value.dataset.period = key;
            el(cell, 'span', '', label); metricValues.push([key, value]);
        }
        const charts = el(reading.body, 'div', 'kino-home-charts');
        function chart(title, key) {
            const box = el(charts, 'section', 'kino-home-chart');
            const heading = el(box, 'h3', '', title);
            const body = el(box, 'div', 'kino-home-chart-body');
            const list = el(body, 'div', 'kino-home-chart-list'); list.setAttribute('role', 'list');
            foldBlock(box, heading, [body], key, title);
            return { list, body };
        }
        const months = chart('Просмотры по месяцам', 'months');
        const ratings = chart('Распределение оценок', 'ratings');
        function splitTypes(items) {
            // A note bearing both tags is counted once, as a serial.
            return [items.filter(item => !item.serial).length, items.filter(item => item.serial).length];
        }
        function drawChart(list, entries, empty) {
            list.replaceChildren();
            if (!entries.length) { el(list, 'p', 'kino-home-empty', empty); return; }
            const max = Math.max(1, ...entries.map(entry => entry[1] + entry[2]));
            for (const [label, movies, serials] of entries) {
                const count = movies + serials;
                const row = el(list, 'div', 'kino-home-chart-row'); row.setAttribute('role', 'listitem');
                row.dataset.movies = movies; row.dataset.serials = serials;
                row.title = label + ': фильмы — ' + movies + ', сериалы — ' + serials + ', всего — ' + count;
                row.setAttribute('aria-label', row.title);
                el(row, 'span', 'kino-home-chart-label', label);
                const track = el(row, 'span', 'kino-home-chart-track'); track.setAttribute('aria-hidden', 'true');
                for (const [kind, value] of [['movies', movies], ['serials', serials]]) {
                    const bar = el(track, 'span', 'kino-home-chart-bar is-' + kind);
                    bar.style.width = (value / max * 100) + '%';
                }
                el(row, 'strong', 'kino-home-chart-count', count);
            }
        }
        function draw() {
            if (disposed) return;
            const items = media(), scores = items.map(item => item.score).filter(value => value != null);
            const values = { total: items.length, movies: items.filter(item => item.movie).length, serials: items.filter(item => item.serial).length,
                average: scores.length ? (scores.reduce((sum, value) => sum + value, 0) / scores.length).toFixed(2).replace('.', ',') : '—' };
            for (const [key, node] of statValues) node.textContent = String(values[key]);
            const now = new Date(), periods = {
                month: items.filter(item => item.watched?.year === now.getFullYear() && item.watched?.month === now.getMonth() + 1).length,
                year: items.filter(item => item.watched?.year === now.getFullYear()).length,
                reread: items.filter(item => Number(String(item.fields['Количество просмотров'] ?? '').replace(',', '.')) > 1).length
            };
            for (const [key, node] of metricValues) node.textContent = String(periods[key]);
            const monthNames = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];
            drawChart(months.list, monthNames.map((name, index) => [name, ...splitTypes(items.filter(item => item.watched?.year === now.getFullYear() && item.watched.month === index + 1))]));
            const counts = new Map();
            for (const item of items) {
                if (item.score == null) continue;
                if (!counts.has(item.score)) counts.set(item.score, [0, 0]);
                counts.get(item.score)[item.serial ? 1 : 0]++;
            }
            drawChart(ratings.list, [...counts].sort((a, b) => b[0] - a[0]).map(([score, counts]) => [String(score).replace('.', ','), ...counts]), 'Пока нет оценок.');
        }
        draw();
        function schedule() { if (disposed) return; clearTimeout(timer); timer = setTimeout(draw, 120); }
        for (const [owner, events] of [[app.metadataCache, ['changed']], [app.vault, ['create', 'delete', 'rename', 'modify']]]) {
            if (!owner?.on) continue;
            for (const event of events) { const ref = owner.on(event, schedule); cleanups.push(() => owner.offref?.(ref)); }
        }
        const overviewLinks = el(overviewBody, 'div', 'kino-home-overview-links');
        for (const [label, choice] of [['Актёры', 'Кино - Открыть актера'], ['Режиссёры', 'Кино - Открыть режиссера'], ['Жанры', 'Кино - Открыть жанр']]) {
            const tile = el(overviewLinks, 'div', 'kino-home-overview'); command(tile, label, choice);
        }
        rememberDetails(management, 'management');
        const viewLinks = el(overviewBody, 'nav', 'kino-home-view-links'); viewLinks.setAttribute('aria-label', 'Представления каталога');
        viewLinks.appendChild(catalogue);
        for (const [label, name] of [['Таблица', 'Все'], ['Фильмы', 'Фильмы'], ['Сериалы', 'Сериалы'], ['По году релиза', 'По году релиза'], ['Сравнение оценок', 'Сравнение оценок']]) internal(viewLinks, label, 'Кино/_system/_Кино.base#' + name);
        const nativeViews = [];
        const viewsVisible = () => overviews.dataset.collapsed !== 'true';
        function nativeView(label, target) {
            const details = el(overviewBody, 'details', 'kino-home-native-view'); details.dataset.target = target;
            rememberDetails(details, 'native:' + target);
            el(details, 'summary', '', label);
            const isOpen = () => viewsVisible() && details.open;
            const content = el(details, 'div', 'kino-home-native-content');
            let child = null, generation = 0;
            const linkCleanups = [];
            function clear() {
                generation++; if (child) release(child); child = null;
                for (const cleanup of linkCleanups.splice(0)) cleanup();
                content.replaceChildren();
            }
            cleanups.push(clear);
            async function open() {
                if (disposed || !isOpen() || child) return;
                const current = ++generation;
                if (!obsidian.MarkdownRenderer?.render || !obsidian.Component || !component?.addChild) {
                    for (const cleanup of linkCleanups.splice(0)) cleanup();
                    content.replaceChildren(); internal(content, `Открыть ${label.toLocaleLowerCase('ru')}`, target, '', linkCleanups); return;
                }
                child = childComponent(); const renderingChild = child;
                const holder = el(content, 'div', 'kino-home-native-render');
                try { await obsidian.MarkdownRenderer.render(app, `![[${target}]]`, holder, source, renderingChild); }
                catch (problem) {
                    if (!disposed && current === generation && isOpen()) {
                        holder.replaceChildren(); el(holder, 'p', 'kino-home-widget-error', `Не удалось загрузить представление: ${problem?.message || problem}`);
                        internal(holder, 'Открыть представление', target, '', linkCleanups);
                    }
                    release(renderingChild); if (child === renderingChild) child = null;
                } finally {
                    if (disposed || current !== generation || !isOpen()) { release(renderingChild); holder.remove(); if (child === renderingChild) child = null; }
                }
            }
            listen(details, 'toggle', () => { if (!isOpen()) clear(); else void open(); });
            nativeViews.push({ clear, open });
        }
        nativeView('Последние просмотры', 'Кино/_system/_Кино.base#Последние');
        nativeView('Перепросмотры', 'Кино/_system/_Кино.base#Перепросмотры');
        nativeView('Последние сериалы', 'Кино/_system/_Кино.base#Последние сериалы');
        function syncViews() { for (const view of nativeViews) if (viewsVisible()) void view.open(); else view.clear(); }
        listen(overviews, 'kino-fold-change', syncViews);
        root.appendChild(management);
        const footer = el(root, 'footer', 'kino-home-footer');
        internal(footer, 'Проверка кинотеки', 'Кино/_system/Проверка кинотеки'); internal(footer, 'Журнал изменений', 'Кино/_system/Журнал изменений');
        foldBlock(masthead, heading.querySelector('h1'), [nav, actions, stats], 'masthead', 'Кинотека');
        foldBlock(reading.box, reading.head.querySelector('h2'), [reading.body], 'reading', 'Статистика');
        foldBlock(overviews, overviews.querySelector('h2'), [overviewBody], 'overview', 'Обзор кинотеки');
        foldBlock(footer, footer, [...footer.querySelectorAll('a')], 'footer', 'Служебные ссылки');
        if (!disposed) root.dataset.ready = 'true';
        return { dispose };
    } catch (problem) { dispose(); throw problem; }
};
