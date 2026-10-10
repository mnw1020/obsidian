// Book presentation only. Reads current metadata; never rewrites a note.
const header = [
    '<!-- BOOK-CARD:START -->',
    '```dataviewjs',
    'const cardFile = app.vault.getAbstractFileByPath("Книги/_system/book_card.js");',
    'if (cardFile) {',
    '  const cardModule = { exports: {} };',
    '  new Function("module", await app.vault.read(cardFile))(cardModule);',
    '  await cardModule.exports.render({ app, dv });',
    '} else { dv.paragraph("[[Книги/_index|← Библиотека]] · Модуль карточки не найден."); }',
    '```',
    '<!-- BOOK-CARD:END -->'
].join('\n');

function displayDate(value) {
    const date = String(value ?? '').trim();
    const month = date.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/);
    if (!month) return date || 'Не указана';
    const names = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
    if (!month[3]) return `${names[Number(month[2]) - 1] || month[2]} ${month[1]}`;
    return `${month[3]}.${month[2]}.${month[1]}`;
}

function adaptationLinks({ app, file, fm }) {
    const list = value => [].concat(value || []).map(String).map(value => value.trim()).filter(Boolean);
    const parse = value => {
        const match = value.match(/^\[\[([^\]|]+)(?:\|([^\]]+))?\]\]$/);
        const target = (match ? match[1] : value).replace(/\.md$/i, '');
        return { target, label: match?.[2] || target.split('/').pop() };
    };
    const links = new Map();
    for (const value of list(fm.adaptations)) {
        const link = parse(value);
        const dest = app.metadataCache.getFirstLinkpathDest?.(link.target, file.path);
        if (dest) link.target = dest.path.replace(/\.md$/i, '');
        links.set(link.target, link);
    }
    // Also expose existing cinema links whose book-side property is missing.
    for (const media of app.vault.getMarkdownFiles?.() || []) {
        if (!media.path.startsWith('Кино/') || /^Кино\/(?:Просмотры|Сезоны|_system)\//.test(media.path)) continue;
        const meta = app.metadataCache.getFileCache(media)?.frontmatter || {};
        if (!list(meta.tags).some(tag => ['movies', 'serial'].includes(tag.replace(/^#/, '')))) continue;
        const sources = [...list(meta['Первоисточники']), ...list(meta.adapted_from)];
        if (!sources.some(value => {
            const target = parse(value).target;
            const dest = app.metadataCache.getFirstLinkpathDest?.(target, media.path);
            return dest ? dest.path === file.path : target === file.path.replace(/\.md$/i, '');
        })) continue;
        const target = media.path.replace(/\.md$/i, '');
        if (!links.has(target)) links.set(target, { target, label: media.basename });
    }
    return [...links.values()];
}

async function render({ app, dv }) {
    // Bind every link to this rendered page, including in split panes.
    const source = dv.current()?.file?.path;
    const file = source && app.vault.getAbstractFileByPath(source);
    if (!file) return;
    const fm = app.metadataCache.getFileCache(file)?.frontmatter || {};
    const container = dv.container;
    // Each rendered pane owns its listeners. A late callback must never revive an unloaded card.
    dv.component?.__bookRelationsCleanup?.();
    const relationRefs = [];
    let relationsDisposed = false, relationTimer;
    const disposeRelations = () => {
        relationsDisposed = true;
        clearTimeout(relationTimer);
        for (const [owner, ref] of relationRefs.splice(0)) owner.offref?.(ref);
    };
    if (dv.component) {
        dv.component.__bookRelationsCleanup = disposeRelations;
        dv.component.register?.(() => {
            disposeRelations();
            if (dv.component.__bookRelationsCleanup === disposeRelations) delete dv.component.__bookRelationsCleanup;
        });
    }
    let relationCore;
    const relationFile = app.vault.getAbstractFileByPath('Кино/_system/adaptation_links.js');
    if (relationFile) {
        try {
            const relationModule = { exports: {} };
            new Function('module', 'exports', await app.vault.read(relationFile))(relationModule, relationModule.exports);
            if (typeof relationModule.exports.related === 'function') relationCore = relationModule.exports;
        } catch (_) { /* The independent fallback keeps books usable if cinema is unavailable. */ }
    }
    if (relationsDisposed) return;
    const el = (parent, tag, cls, text) => {
        const node = parent.ownerDocument.createElement(tag);
        if (cls) node.className = cls;
        if (text !== undefined) node.textContent = text;
        parent.appendChild(node);
        return node;
    };
    const internal = (parent, label, target, cls = 'book-card-link') => {
        const a = el(parent, 'a', cls + ' internal-link', label);
        a.setAttribute('href', target);
        a.setAttribute('data-href', target);
        a.addEventListener('click', event => {
            event.preventDefault();
            event.stopPropagation();
            app.workspace.openLinkText(target, source, event.ctrlKey || event.metaKey);
        });
        return a;
    };
    const choice = (parent, label, name, cls = 'book-card-action', variables = {}) => {
        const a = el(parent, 'a', cls, label);
        a.href = 'obsidian://quickadd?choice=' + encodeURIComponent(name);
        a.addEventListener('click', async event => {
            event.preventDefault();
            event.stopPropagation();
            try {
                // Activate the source pane before commands that use getActiveFile().
                const leaves = app.workspace.getLeavesOfType('markdown');
                const leaf = leaves.find(item => item.view?.file?.path === source && item.view.containerEl?.contains(container));
                if (leaf) app.workspace.setActiveLeaf(leaf, { focus: true });
                const api = app.plugins.plugins.quickadd?.api;
                if (!api?.executeChoice) throw new Error('QuickAdd недоступен. Включи плагин для действий с карточкой.');
                if (app.workspace.getActiveFile()?.path !== source) throw new Error('Сначала открой эту карточку в активной вкладке.');
                await api.executeChoice(name, variables);
            } catch (error) {
                let message = container.querySelector('.book-card-error');
                if (!message) message = el(container, 'p', 'book-card-error');
                message.textContent = error.message;
            }
        });
        return a;
    };
    const hero = el(container, 'section', 'book-card-hero');
    hero.setAttribute('aria-label', 'Карточка произведения');
    const top = el(hero, 'div', 'book-card-topline');
    internal(top, '← Библиотека', 'Книги/_index');
    const fiction = source.startsWith('Книги/Художественные/');
    const types = { story: 'Рассказ', novel: 'Роман', novella: 'Повесть', collection: 'Сборник', poem: 'Стихи', play: 'Пьеса', essay: 'Эссе' };
    el(top, 'span', 'book-card-kind', fiction ? types[fm.work_type] || 'Художественное' : 'Non-fiction');
    const main = el(hero, 'div', 'book-card-main');
    const heading = el(main, 'div', 'book-card-heading');
    el(heading, 'h1', 'book-card-title', String(fm.title || file.basename));
    const authors = el(heading, 'div', 'book-card-authors');
    for (const author of [].concat(fm.authors || []).filter(Boolean)) {
        choice(authors, String(author), 'Книги - Открыть автора', 'book-card-author', { author: String(author) });
    }
    if (fiction && Number(fm.rating) >= 1 && Number(fm.rating) <= 10) {
        const rating = el(main, 'div', 'book-card-rating');
        rating.setAttribute('aria-label', `Оценка ${fm.rating} из 10`);
        el(rating, 'strong', '', String(fm.rating));
        el(rating, 'span', '', 'из 10');
    }
    if (fm.series) {
        const series = el(hero, 'div', 'book-card-series');
        el(series, 'span', '', 'Серия · ');
        choice(series, String(fm.series) + (fm.series_index ? ` · № ${fm.series_index}` : ''), 'Книги - Открыть серию', 'book-card-link', { series: String(fm.series) });
    }
    const facts = el(hero, 'div', 'book-card-facts');
    const fact = (label, value) => {
        const item = el(facts, 'div', 'book-card-fact');
        el(item, 'span', 'book-card-label', label);
        el(item, 'span', 'book-card-value', value);
    };
    fact('Последнее чтение', displayDate(fm.date));
    fact('Всего чтений', String(fm.read_count ?? '—'));
    if (fiction && !(Number(fm.rating) >= 1 && Number(fm.rating) <= 10)) fact('Оценка', 'Пока без оценки');
    const adaptations = el(hero, 'details', 'book-card-adaptations');
    adaptations.open = true;
    let relationsFm = fm;
    const renderAdaptations = payload => {
        if (relationsDisposed) return;
        // The command returns the exact saved properties before Obsidian's cache catches up.
        if (payload?.bookPath === source && payload.bookFm) relationsFm = payload.bookFm;
        else if (Array.isArray(payload)) relationsFm = { ...relationsFm, adaptations: payload };
        const links = relationCore ? relationCore.related({ app, file, fm: relationsFm }) :
            adaptationLinks({ app, file, fm: relationsFm }).map(link => {
                const target = app.metadataCache.getFirstLinkpathDest?.(link.target, source) ||
                    app.vault.getAbstractFileByPath(link.target + '.md');
                const meta = target && app.metadataCache.getFileCache(target)?.frontmatter || {};
                const tags = [].concat(meta.tags || []).map(tag => String(tag).replace(/^#/, ''));
                return { ...link, type: tags.includes('serial') ? 'serial' : 'movies',
                    year: String(meta['Релиз'] || meta['Год'] || '').match(/\d{4}/)?.[0], missing: !target };
            });
        adaptations.replaceChildren();
        adaptations.hidden = !links.length;
        if (!links.length) return;
        const heading = el(adaptations, 'summary', 'book-card-adaptations-heading');
        el(heading, 'span', 'book-card-related-heading', 'Связанные произведения');
        el(heading, 'span', 'book-card-adaptations-count', String(links.length));
        const items = el(adaptations, 'div', 'book-card-adaptation-links');
        const types = { book: 'Книга', movies: 'Фильм', serial: 'Сериал' };
        for (const link of links) {
            const item = internal(items, '', link.target, 'book-card-adaptation' + (link.missing ? ' is-missing' : ''));
            item.dataset.type = link.type || 'movies';
            el(item, 'span', 'book-card-adaptation-icon', link.type === 'book' ? 'Аа' : link.type === 'serial' ? '▣' : '▷').setAttribute('aria-hidden', 'true');
            const body = el(item, 'span', 'book-card-adaptation-main');
            el(body, 'span', 'book-card-adaptation-title', link.label);
            const meta = [types[link.type] || 'Произведение', link.author, link.year].filter(Boolean);
            if (link.missing) meta.push('Ссылка недоступна');
            el(body, 'span', 'book-card-adaptation-meta', meta.join(' · '));
            el(item, 'span', 'book-card-adaptation-arrow', '↗').setAttribute('aria-hidden', 'true');
        }
    };
    const watchRelations = (owner, event, callback) => {
        if (owner?.on && owner?.offref) relationRefs.push([owner, owner.on(event, callback)]);
    };
    const scheduleRelations = () => {
        clearTimeout(relationTimer);
        relationTimer = setTimeout(() => renderAdaptations(), 80);
    };
    const isBookRelationFile = candidate => {
        const meta = candidate && app.metadataCache.getFileCache(candidate)?.frontmatter || {};
        if (relationCore?.kind) return relationCore.kind(candidate, meta) === 'book';
        return candidate?.path?.startsWith('Книги/') && /\.md$/i.test(candidate.path) &&
            !/^Книги\/(?:_system|Цитаты|Конспекты|Идеи)\//.test(candidate.path) &&
            candidate.basename !== '_index' && String(meta.title || '').trim() && [].concat(meta.authors || []).some(Boolean);
    };
    // Keep known paths as well: after a deletion the metadata can already be unavailable.
    const relatedBookPaths = new Set((app.vault.getMarkdownFiles?.() || []).filter(isBookRelationFile).map(candidate => candidate.path));
    const needsRelationRefresh = (changed, oldPath) => {
        const path = changed?.path;
        const wasBook = relatedBookPaths.has(path) || relatedBookPaths.has(oldPath);
        if (oldPath) relatedBookPaths.delete(oldPath);
        const isBook = isBookRelationFile(changed);
        if (isBook) relatedBookPaths.add(path);
        return path === source || oldPath === source || path?.startsWith('Кино/') || oldPath?.startsWith('Кино/') || wasBook || isBook;
    };
    watchRelations(app.workspace, 'kino:adaptations-changed', payload => {
        if (payload?.bookPath === source) renderAdaptations(payload);
    });
    watchRelations(app.metadataCache, 'changed', changed => {
        if (changed?.path === source) relationsFm = app.metadataCache.getFileCache(file)?.frontmatter || {};
        if (needsRelationRefresh(changed)) scheduleRelations();
    });
    watchRelations(app.metadataCache, 'resolved', () => {
        relationsFm = app.metadataCache.getFileCache(file)?.frontmatter || {};
        scheduleRelations();
    });
    for (const event of ['create', 'delete', 'rename']) watchRelations(app.vault, event, (changed, oldPath) => {
        if (needsRelationRefresh(changed, oldPath)) scheduleRelations();
    });
    renderAdaptations();
    const actions = el(hero, 'div', 'book-card-actions');
    choice(actions, 'Записать чтение', 'Книги - Добавить чтение', 'book-card-action book-card-primary');
    choice(actions, 'Сохранить выписку', 'Книги - Добавить выписку');
    const secondary = el(hero, 'div', 'book-card-secondary');
    choice(secondary, 'Редактировать чтение', 'Книги - Редактировать чтение');
    choice(secondary, 'Связать с кино', 'Книги - Связать с кино', 'book-card-action', {
        adaptationRequest: { path: source, onLinked: renderAdaptations }
    });
    const props = el(secondary, 'button', 'book-card-action', 'Показать свойства');
    props.type = 'button';
    props.setAttribute('aria-expanded', 'false');
    props.addEventListener('click', () => {
        const view = container.closest('.markdown-preview-view, .markdown-source-view');
        if (!view) return;
        const visible = view.classList.toggle('book-card-properties-visible');
        props.textContent = visible ? 'Скрыть свойства' : 'Показать свойства';
        props.setAttribute('aria-expanded', String(visible));
    });
    hero.appendChild(adaptations);
    const contents = el(hero, 'nav', 'book-card-contents');
    contents.setAttribute('aria-label', 'Разделы произведения');
    internal(contents, 'История чтений ↓', source + '#История чтений');
    internal(contents, 'Все цитаты ↗', 'Книги/Цитаты');
}

module.exports = { header, render, displayDate, adaptationLinks };
