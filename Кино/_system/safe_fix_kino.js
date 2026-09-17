module.exports = async (params) => {
    const { app, obsidian } = params;
    const { Notice, normalizePath } = obsidian;

    const ROOT = "Кино";
    const CHANGELOG_PATH = `${ROOT}/_system/Журнал изменений.md`;
    const CACHE_PATH = `${ROOT}/_system/kino-person-alias-cache.json`;
    const PERSON_FIELDS = ["Режисер", "Актеры"];
    const ENTITY_FIELDS = ["Режисер", "Актеры", "Жанр"];

    const asText = value => {
        if (value === null || value === undefined) return "";
        return String(value).trim();
    };

    const listValues = value => {
        if (value === null || value === undefined || value === "") return [];
        return (Array.isArray(value) ? value : [value]).map(asText).filter(Boolean);
    };

    const getFrontmatter = file => app.metadataCache.getFileCache(file)?.frontmatter ?? {};

    function tags(frontmatter) {
        return listValues(frontmatter?.tags).map(tag => tag.replace(/^#/, ""));
    }

    function isMedia(file) {
        if (!file || file.extension !== "md" || !file.path.startsWith(`${ROOT}/`)) return false;
        if (file.path.slice(ROOT.length + 1).includes("/")) return false;
        const fileTags = tags(getFrontmatter(file));
        return fileTags.includes("movies") || fileTags.includes("serial");
    }

    function stripWiki(value) {
        const text = asText(value);
        const match = text.match(/^\[\[([^\]|]+)(?:\|([^\]]+))?\]\]$/);
        return match ? (match[2] || match[1]).trim() : text;
    }

    function personBaseKey(value) {
        let text = stripWiki(value).normalize("NFC");
        text = text.replace(/\s*\([^()]*\)\s*$/, "");
        return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            .toLocaleLowerCase("ru").replace(/ё/g, "е").replace(/[^0-9a-zа-я]/gi, "");
    }

    function normalizePersonDisplay(value) {
        let text = stripWiki(value).trim().normalize("NFC");
        for (let i = 0; i < 5; i++) {
            const match = text.match(/^(.+?)\s*\((.*)\)$/);
            if (!match || !match[2].includes("(")) break;
            const inner = match[2].replace(/^.*\(([^()]*)\)$/, "$1").trim();
            if (!inner || inner === match[2]) break;
            text = `${match[1].trim()} (${inner})`;
        }
        const pair = text.match(/^(.+?)\s*\(([^()]*)\)$/);
        if (pair && personBaseKey(pair[1]) === personBaseKey(pair[2])) return pair[1].trim();
        return text;
    }

    function entityKey(field, value) {
        if (field !== "Жанр") return personBaseKey(value);
        const text = asText(value);
        return text.toLocaleLowerCase("ru").replace(/ё/g, "е").replace(/[^0-9a-zа-я]/gi, "");
    }

    function dedupe(values, field) {
        const result = [];
        const seen = new Set();
        for (const value of values) {
            const next = field === "Жанр" ? asText(value) : normalizePersonDisplay(value);
            if (!next) continue;
            const key = entityKey(field, next);
            if (seen.has(key)) continue;
            seen.add(key);
            result.push(next);
        }
        return result;
    }

    async function appendJournal(lines) {
        if (!lines.length) return;
        const now = new Date();
        const pad = value => String(value).padStart(2, "0");
        const iso = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
        const stamp = `${pad(now.getDate())}.${pad(now.getMonth() + 1)}.${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
        const block = `<!-- KINO-AUDIT-EVENT at="${iso}" structure="true" -->\n## ${stamp}\n\n${lines.map(line => `- ${line}`).join("\n")}\n\n`;
        const path = normalizePath(CHANGELOG_PATH);
        let file = app.vault.getAbstractFileByPath(path);
        if (!file) {
            file = await app.vault.create(path, `# Журнал изменений\n\n[[Кино/_index|← Кино]] · [[Кино/_system/Проверка кинотеки|🔎 Проверка]] · [[Кино/_system/Журнал изменений|📜 Журнал]]\n\n${block}`);
            return;
        }
        const current = await app.vault.read(file);
        await app.vault.modify(file, current.replace(/\s*$/, "\n\n") + block);
    }

    const changes = [];
    let changedCards = 0;
    const files = app.vault.getMarkdownFiles().filter(isMedia);

    for (const file of files) {
        const current = getFrontmatter(file);
        const updates = new Map();

        for (const field of ENTITY_FIELDS) {
            if (current[field] === null || current[field] === undefined || current[field] === "") continue;
            const raw = Array.isArray(current[field]) ? current[field] : [current[field]];
            const nextValues = dedupe(raw, field);
            const next = Array.isArray(current[field]) ? nextValues : (nextValues[0] || "");
            const before = JSON.stringify(current[field]);
            const after = JSON.stringify(next);
            if (before !== after) updates.set(field, next);
        }

        if (current.tags !== null && current.tags !== undefined) {
            const currentTags = listValues(current.tags);
            const nextTags = [...new Set(currentTags)];
            if (JSON.stringify(currentTags) !== JSON.stringify(nextTags)) updates.set("tags", nextTags);
        }

        if (!updates.size) continue;
        await app.fileManager.processFrontMatter(file, frontmatter => {
            for (const [field, value] of updates.entries()) frontmatter[field] = value;
        });
        changedCards++;
        changes.push(`Карточка **${file.path}**: нормализованы имена/жанры и удалены точные дубли.`);
    }

    let cacheChanged = false;
    const cacheFile = app.vault.getAbstractFileByPath(normalizePath(CACHE_PATH));
    if (cacheFile) {
        try {
            const cache = JSON.parse(await app.vault.read(cacheFile));
            for (const field of PERSON_FIELDS) {
                const clean = {};
                for (const [key, value] of Object.entries(cache[field] || {})) {
                    const next = normalizePersonDisplay(value);
                    const base = personBaseKey(next);
                    const nested = /\([^()]*\([^()]*\)[^()]*\)/.test(asText(value));
                    if (nested && key.startsWith(base) && key.length > base.length + 4) {
                        cacheChanged = true;
                        continue;
                    }
                    clean[key] = next;
                    if (next !== value) cacheChanged = true;
                }
                cache[field] = clean;
            }
            if (cacheChanged) await app.vault.modify(cacheFile, JSON.stringify(cache, null, 2) + "\n");
        } catch (error) {
            new Notice(`Кэш псевдонимов не исправлен: ${error?.message || error}`, 9000);
        }
    }

    if (changedCards || cacheChanged) {
        if (changedCards) changes.unshift(`Изменено карточек: **${changedCards}**.`);
        if (cacheChanged) changes.unshift("Очищен кэш псевдонимов.");
        await appendJournal(changes);
    }

    new Notice(`Безопасное исправление завершено: карточек ${changedCards}, кэш ${cacheChanged ? "изменён" : "без изменений"}. Запусти "Кино - Проверить кинотеку".`, 9000);
};
