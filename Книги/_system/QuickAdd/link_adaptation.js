// QuickAdd: Книги - Связать с кино. Either collection can start the reciprocal link.
module.exports = async (params) => {
    const { app, quickAddApi, obsidian } = params, Notice = obsidian.Notice;
    if (app.__kinoAdaptationLinkLock) { new Notice('Создание связи уже выполняется.'); return { busy: true }; }
    app.__kinoAdaptationLinkLock = true;
    try {
        const load = async path => {
            const file = app.vault.getAbstractFileByPath(path);
            if (!file) return null;
            const module = { exports: {} };
            new Function('module', 'exports', await app.vault.read(file))(module, module.exports);
            return module.exports;
        };
        const createCore = await load('Книги/_system/book_core.js');
        if (!createCore) { new Notice('Не найден общий модуль библиотеки book_core.js.'); return; }
        const core = createCore({ app, obsidian }), list = core.listValues;
        const shared = await load('Кино/_system/adaptation_links.js');
        const targetPath = file => file.path.replace(/\.md$/i, '');
        const linkTarget = raw => String(raw ?? '').trim().replace(/^\[\[([^\]|]+)(?:\|[^\]]+)?\]\]$/, '$1').split('#')[0].replace(/\.md$/i, '');
        const typeOf = (file, fm) => {
            if (shared) return shared.kind(file, fm);
            if (!file || file.extension !== 'md' || file.basename === '_index') return null;
            if (file.path.startsWith('Книги/') && !/^Книги\/(?:_system|Цитаты|Конспекты|Идеи)\//.test(file.path) &&
                !['quote', 'summary', 'idea'].includes(String(fm.note_type ?? '')) && String(fm.title ?? '').trim() && list(fm.authors).length) return 'book';
            if (file.path.startsWith('Кино/') && !/^Кино\/(?:Просмотры|Сезоны|_system)\//.test(file.path)) {
                const tags = list(fm.tags).map(tag => tag.replace(/^#/, ''));
                return tags.includes('serial') ? 'serial' : tags.includes('movies') ? 'movies' : null;
            }
            return null;
        };
        const contains = (value, target, source) => list(value).some(raw => {
            const path = linkTarget(raw), dest = app.vault.getAbstractFileByPath(path + '.md') || app.metadataCache.getFirstLinkpathDest?.(path, source.path);
            return dest ? dest.path === target.path : path === targetPath(target);
        });
        const variables = params.variables || {}, request = variables.adaptationRequest || variables.bookAdaptationRequest;
        const explicitPath = request?.path || variables.adaptationPath || variables['value-adaptationPath'];
        let source = explicitPath ? app.vault.getAbstractFileByPath(explicitPath) : app.workspace.getActiveFile();
        let sourceFm = source?.extension === 'md' ? await core.refreshFrontmatter(source) : {}, sourceType = typeOf(source, sourceFm);
        if (explicitPath && !sourceType) { new Notice('Карточка книги, фильма или сериала больше недоступна.'); return; }
        if (!sourceType) {
            const books = core.books().sort((a, b) => String(core.getFrontmatter(a).title).localeCompare(String(core.getFrontmatter(b).title), 'ru'));
            if (!books.length) { new Notice('Произведения не найдены.'); return; }
            source = await quickAddApi.suggester(books.map(file => `${core.getFrontmatter(file).title} | ${list(core.getFrontmatter(file).authors).join(', ')}`), books, 'Выбери произведение');
            if (!source) return { cancelled: true };
            sourceFm = await core.refreshFrontmatter(source); sourceType = typeOf(source, sourceFm);
            if (sourceType !== 'book') { new Notice('Свойства выбранной книги изменились. Повтори команду.'); return; }
        }
        const fromBook = sourceType === 'book';
        const candidates = [];
        for (const file of app.vault.getMarkdownFiles()) {
            let fm = core.getFrontmatter(file);
            // A just-created card may not be present in metadataCache yet.
            const potential = fromBook ? file.path.startsWith('Кино/') && !/^Кино\/(?:Просмотры|Сезоны|_system)\//.test(file.path)
                : file.path.startsWith('Книги/') && !/^Книги\/(?:_system|Цитаты|Конспекты|Идеи)\//.test(file.path);
            if (potential && !app.metadataCache.getFileCache(file)?.frontmatter) {
                try { fm = await core.refreshFrontmatter(file); } catch (_) { continue; }
            }
            const type = typeOf(file, fm);
            if (fromBook ? type === 'movies' || type === 'serial' : type === 'book') candidates.push(file);
        }
        candidates.sort((a, b) => String(core.getFrontmatter(a).title || a.basename).localeCompare(String(core.getFrontmatter(b).title || b.basename), 'ru'));
        if (!candidates.length) { new Notice(fromBook ? 'Не найдены карточки фильмов и сериалов в кинотеке.' : 'Не найдены карточки книг.'); return; }
        const selected = await quickAddApi.suggester(candidates.map(file => fromBook
            ? `${typeOf(file, core.getFrontmatter(file)) === 'serial' ? '📺' : '🎬'} ${file.basename}`
            : `${core.getFrontmatter(file).title} | ${list(core.getFrontmatter(file).authors).join(', ')}`), candidates, fromBook ? 'Выбери экранизацию' : 'Выбери книгу');
        if (!selected) return { cancelled: true };
        const bookFile = fromBook ? source : selected, mediaFile = fromBook ? selected : source;
        const bookFmBefore = await core.refreshFrontmatter(bookFile), mediaFmBefore = await core.refreshFrontmatter(mediaFile);
        if (typeOf(bookFile, bookFmBefore) !== 'book' || !['movies', 'serial'].includes(typeOf(mediaFile, mediaFmBefore))) {
            new Notice('Тип выбранной карточки изменился. Связь не создана.'); return;
        }
        const inserted = [];
        async function add(file, property, target, expected) {
            let changed = false;
            const result = await core.updateFrontmatter(file, fm => {
                if (!expected.includes(typeOf(file, fm))) throw new Error('Тип карточки изменился во время создания связи.');
                if (contains(fm[property], target, file)) return;
                const before = fm[property], current = list(before), link = `[[${targetPath(target)}]]`;
                inserted.push({ file, property, before, beforeValues: current, link });
                fm[property] = [...current, link]; changed = true;
            });
            return { ...result, added: changed };
        }
        async function rollback(change) {
            await core.updateFrontmatter(change.file, fm => {
                const current = list(fm[change.property]), index = current.lastIndexOf(change.link);
                if (index < 0) return;
                current.splice(index, 1);
                if (JSON.stringify(current) === JSON.stringify(change.beforeValues)) {
                    if (change.before === undefined) delete fm[change.property];
                    else fm[change.property] = change.before;
                } else if (current.length) fm[change.property] = current;
                else delete fm[change.property];
            });
        }
        let bookResult, mediaResult;
        try {
            bookResult = await add(bookFile, 'adaptations', mediaFile, ['book']);
            mediaResult = await add(mediaFile, 'Первоисточники', bookFile, ['movies', 'serial']);
        } catch (error) {
            const failures = [];
            for (const change of inserted.reverse()) try { await rollback(change); } catch (rollbackError) { failures.push(rollbackError.message); }
            new Notice(`Не удалось создать взаимную связь: ${error.message}${failures.length ? `. Проверь одностороннюю связь: ${failures.join('; ')}` : ''}`, 10000);
            return { error: error.message, rollbackFailures: failures };
        }
        // Vault.process returns parsed values; the metadata cache may still contain old links.
        const payload = { bookPath: bookFile.path, mediaPath: mediaFile.path, bookFm: bookResult.fm, mediaFm: mediaResult.fm };
        shared?.remember(app, bookFile, payload.bookFm); shared?.remember(app, mediaFile, payload.mediaFm);
        try {
            app.workspace.trigger?.('kino:adaptations-changed', payload);
            if (typeof variables.adaptationRequest?.onLinked === 'function') variables.adaptationRequest.onLinked(payload);
            else if (typeof variables.bookAdaptationRequest?.onLinked === 'function') variables.bookAdaptationRequest.onLinked(list(payload.bookFm.adaptations));
        } catch (error) { new Notice(`Связь сохранена. Не удалось обновить отображение: ${error.message}`, 7000); }
        if (!bookResult.added && !mediaResult.added) { new Notice('Эта книга и экранизация уже связаны.'); return { ...payload, changed: false }; }
        const title = payload.bookFm.title || bookFile.basename;
        try { await core.appendJournal([`Связь с кино: **${title}** ↔ **${mediaFile.basename}**.`]); }
        catch (error) { new Notice(`Связь создана, но журнал не обновлён: ${error.message}`, 7000); }
        new Notice(`Связано: ${title} ↔ ${mediaFile.basename}`);
        return { ...payload, changed: true };
    } finally { delete app.__kinoAdaptationLinkLock; }
};
