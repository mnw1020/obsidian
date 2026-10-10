module.exports = async (params) => {
    const { app, obsidian } = params;
    const { Notice } = obsidian;
    const coreFile = app.vault.getAbstractFileByPath("Книги/_system/book_core.js");
    if (!coreFile) { new Notice("Не найден общий модуль библиотеки book_core.js."); return; }
    const coreModule = { exports: {} };
    new Function("module", await app.vault.read(coreFile))(coreModule);
    const core = coreModule.exports({ app, obsidian });
    const rules = [
        { name: "книга ↔ кино", leftType: "book", leftProp: "adaptations", rightType: "media", rightProp: "Первоисточники", rightProps: ["Первоисточники", "adapted_from"] },
        { name: "related", leftType: "work", leftProp: "related", rightType: "work", rightProp: "related" },
        { name: "продолжение", leftType: "book", leftProp: "continued_by", rightType: "book", rightProp: "continues" }
    ];
    const list = core.listValues, journal = [], failures = [];
    let fixes = 0, structural = false;
    const targetPath = file => file.path.replace(/\.md$/i, "");
    const linkTarget = raw => {
        const text = String(raw ?? "").trim(), match = text.match(/^\[\[([^\]|]+)(?:\|[^\]]+)?\]\]$/);
        return (match ? match[1] : text).replace(/\.md$/i, "").trim();
    };
    function resolve(raw, sourcePath) {
        const target = linkTarget(raw);
        if (!target) return null;
        const file = app.metadataCache.getFirstLinkpathDest(target, sourcePath);
        if (file) return file;
        return app.vault.getAbstractFileByPath(`${target}.md`) ?? null;
    }
    const cleanAuthor = value => String(value ?? "").trim().replace(/\s+/g, " ").replace(/[.]+$/g, "").trim();
    const authorKey = value => cleanAuthor(value).toLocaleLowerCase("ru").replace(/ё/g, "е");
    const mediaCandidate = file => file?.extension === "md" && file.path.startsWith("Кино/") && !/^Кино\/(?:Просмотры|Сезоны|_system)\//.test(file.path);
    const isMedia = file => mediaCandidate(file) && list(core.getFrontmatter(file).tags).map(tag => tag.replace(/^#/, "")).some(tag => ["movies", "serial"].includes(tag));
    // Read the current YAML once for maintenance; no dependency on index timing.
    for (const file of app.vault.getMarkdownFiles().filter(file => core.isCandidateBook(file) || mediaCandidate(file))) {
        try { await core.refreshFrontmatter(file); }
        catch (error) { failures.push(`${file.path}: ${error.message}`); }
    }
    const filesByType = { book: core.books(), media: app.vault.getMarkdownFiles().filter(isMedia) };
    filesByType.work = [...filesByType.book, ...filesByType.media];
    const variants = new Map();
    for (const file of filesByType.book) {
        const value = core.getFrontmatter(file).authors;
        for (const raw of (Array.isArray(value) ? value : [value]).map(item => String(item ?? "")).filter(item => item.trim())) {
            const key = authorKey(raw);
            if (!variants.has(key)) variants.set(key, new Map());
            const group = variants.get(key);
            group.set(raw, (group.get(raw) ?? 0) + 1);
        }
    }
    const canonical = new Map();
    for (const [key, group] of variants) {
        const names = [...group.keys()].sort((a, b) => Number(b === cleanAuthor(b)) - Number(a === cleanAuthor(a)) || group.get(b) - group.get(a) || a.localeCompare(b, "ru"));
        const name = cleanAuthor(names[0]);
        if ([...group.keys()].some(raw => raw === name)) canonical.set(key, name);
    }
    for (const file of filesByType.book) {
        try {
            const { result } = await core.updateFrontmatter(file, (fm, text) => {
                const updates = [];
                const raw = (Array.isArray(fm.authors) ? fm.authors : [fm.authors]).map(value => String(value ?? "")).filter(value => value.trim());
                const seen = new Set(), authors = [];
                for (const author of raw) {
                    const next = canonical.get(authorKey(author)) ?? author.trim().replace(/\s+/g, " ");
                    const key = next.toLocaleLowerCase("ru").replace(/ё/g, "е");
                    if (!seen.has(key)) authors.push(next);
                    seen.add(key);
                }
                if (JSON.stringify(raw) !== JSON.stringify(authors)) { fm.authors = authors; updates.push("authors"); }
                try {
                    const count = core.parseHistory(text).entries.length;
                    if (fm.read_count !== count) { fm.read_count = count; updates.push("read_count"); }
                } catch (_) { /* Invalid histories are reported by the audit, never reconstructed here. */ }
                return updates;
            });
            for (const property of result) {
                journal.push(`${property}: **${file.path}** — безопасно исправлено по актуальной карточке.`);
                fixes++;
                if (property === "authors") structural = true;
            }
        } catch (error) { failures.push(`${file.path}: ${error.message}`); }
    }
    const propertiesFor = type => [...new Set(rules.flatMap(rule => [
        ...([type, "work"].includes(rule.leftType) ? [rule.leftProp] : []),
        ...([type, "work"].includes(rule.rightType) ? rule.rightProps || [rule.rightProp] : [])
    ]))];
    const properties = { book: propertiesFor("book"), media: propertiesFor("media") };
    for (const type of ["book", "media"]) {
        for (const file of filesByType[type]) {
            try {
                const { result } = await core.updateFrontmatter(file, fm => {
                    const changed = [];
                    for (const property of properties[type]) {
                        const values = list(fm[property]), seen = new Set(), output = [];
                        for (const raw of values) {
                            const dest = resolve(raw, file.path), key = dest ? targetPath(dest) : linkTarget(raw);
                            if (!seen.has(key)) output.push(raw);
                            seen.add(key);
                        }
                        if (output.length !== values.length) { fm[property] = output; changed.push(property); }
                    }
                    return changed;
                });
                for (const property of result) {
                    journal.push(`Ссылки: **${file.path}** — удалены точные дубли в \`${property}\`.`);
                    fixes++; structural = true;
                }
            } catch (error) { failures.push(`${file.path}: ${error.message}`); }
        }
    }
    const matchesType = (file, type) => type === "book" ? core.isBook(file) : type === "media" ? isMedia(file) : type === "work" && (core.isBook(file) || isMedia(file));
    async function addReverse(file, property, target, alternatives = [property]) {
        const { result } = await core.updateFrontmatter(file, fm => {
            const values = list(fm[property]);
            // Inspect alternatives inside the atomic update: a synced legacy reverse
            // must not cause a redundant canonical link to be added.
            const present = alternatives.some(name => list(fm[name]).some(raw => {
                const dest = resolve(raw, file.path);
                return dest ? dest.path === target.path : linkTarget(raw) === targetPath(target);
            }));
            if (present) return false;
            fm[property] = [...values, `[[${targetPath(target)}]]`];
            return true;
        });
        return result;
    }
    async function repairSide(source, sourceProp, targetType, targetProp, ruleName, reverseProps = [targetProp]) {
        for (const raw of list(core.getFrontmatter(source)[sourceProp])) {
            const target = resolve(raw, source.path);
            if (!target || !matchesType(target, targetType)) continue;
            try {
                if (await addReverse(target, targetProp, source, reverseProps)) {
                    journal.push(`Взаимная связь: **${source.path}** ↔ **${target.path}** — добавлена \`${targetProp}\` (${ruleName}).`);
                    fixes++; structural = true;
                }
            } catch (error) { failures.push(`${target.path}: ${error.message}`); }
        }
    }
    for (const rule of rules) {
        const rightProps = rule.rightProps || [rule.rightProp];
        for (const file of filesByType[rule.leftType]) await repairSide(file, rule.leftProp, rule.rightType, rule.rightProp, rule.name, rightProps);
        if (!(rule.leftType === rule.rightType && rule.leftProp === rule.rightProp)) {
            for (const rightProp of rightProps) {
                for (const file of filesByType[rule.rightType]) await repairSide(file, rightProp, rule.leftType, rule.leftProp, rule.name);
            }
        }
    }
    try { await core.updateHomeStats(); await core.appendJournal(journal, structural); }
    catch (error) { failures.push(`Сводка или журнал: ${error.message}`); }
    if (failures.length) new Notice(`Обработано исправлений: ${fixes}. Не удалось обработать ${failures.length}: ${failures.slice(0, 3).join("; ")}`, 10000);
    else new Notice(fixes ? `Безопасно исправлено: ${fixes}. Запусти «Книги - Проверить библиотеку».` : "Безопасных исправлений не найдено.", 7000);
};
