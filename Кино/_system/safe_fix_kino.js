module.exports = async (params) => {
    const { app, obsidian } = params;
    const { Notice, normalizePath } = obsidian;

    const ROOT = "Кино";
    const CHANGELOG_PATH = `${ROOT}/_system/Журнал изменений.md`;
    const ENTITY_FIELDS = ["Режисер", "Жанр"];

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

    function isRoleFile(file) {
        return file?.extension === "md" && file.path.startsWith(`${ROOT}/_system/Роли/`)
            && file.basename.endsWith(".роли");
    }

    function stripWiki(value) {
        const text = asText(value);
        const match = text.match(/^\[\[([^\]|]+)(?:\|([^\]]+))?\]\]$/);
        return match ? (match[2] || match[1]).trim() : text;
    }

    function personRole(value) {
        const text = stripWiki(value).normalize("NFC");
        return text.match(/^.+?\s+-\s+(.+)$/)?.[1].trim() || "";
    }

    function personName(value) {
        return stripWiki(value).normalize("NFC").replace(/\s+-\s+.+$/, "").trim();
    }

    function personBaseKey(value) {
        let text = personName(value);
        text = text.replace(/\s*\([^()]*\)\s*$/, "");
        return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            .toLocaleLowerCase("ru").replace(/ё/g, "е").replace(/[^0-9a-zа-я]/gi, "");
    }

    function normalizePersonDisplay(value) {
        const role = personRole(value);
        let text = personName(value);
        for (let i = 0; i < 5; i++) {
            const match = text.match(/^(.+?)\s*\((.*)\)$/);
            if (!match || !match[2].includes("(")) break;
            const inner = match[2].replace(/^.*\(([^()]*)\)$/, "$1").trim();
            if (!inner || inner === match[2]) break;
            text = `${match[1].trim()} (${inner})`;
        }
        const pair = text.match(/^(.+?)\s*\(([^()]*)\)$/);
        const normalized = pair && personBaseKey(pair[1]) === personBaseKey(pair[2])
            ? pair[1].trim() : text;
        return role && normalized ? `${normalized} - ${role}` : normalized;
    }

    const PERSON_CANONICAL_OVERRIDES = {
        vitaliygogunskiy: "Vitaly Gogunsky (Виталий Гогунский)",
        vitalygogunsky: "Vitaly Gogunsky (Виталий Гогунский)",
        виталийгогунский: "Vitaly Gogunsky (Виталий Гогунский)",
        виталиигогунскии: "Vitaly Gogunsky (Виталий Гогунский)",
        evgeniyromantsov: "Evgeniy Romantsov (Евгений Романцов)",
        евгенийроманцов: "Evgeniy Romantsov (Евгений Романцов)",
        joeystarr: "JoeyStarr (Джои Старр)",
        джоистарр: "JoeyStarr (Джои Старр)",
        icecube: "Ice Cube (Айс Кьюб)",
        айскьюб: "Ice Cube (Айс Кьюб)",
        methodman: "Method Man (Метод Мэн)",
        методмэн: "Method Man (Метод Мэн)",
        vingrhames: "Ving Rhames (Винг Реймз)",
        вингреймз: "Ving Rhames (Винг Реймз)",
        thomasschnauz: "Thomas Schnauz (Томас Шнауц)",
        томасшнауц: "Thomas Schnauz (Томас Шнауц)",
        petergould: "Peter Gould (Питер Гулд)",
        питергулд: "Peter Gould (Питер Гулд)",
        michaelmorris: "Michael Morris (Майкл Моррис)",
        маиклморрис: "Michael Morris (Майкл Моррис)",
        майклморрис: "Michael Morris (Майкл Моррис)",
        adambernstein: "Adam Bernstein (Адам Бернштейн)",
        адамбернштеин: "Adam Bernstein (Адам Бернштейн)",
        mikhailshulaev: "Mikhail Shulaev (Михаил Шулаев)",
        михаилшулаев: "Mikhail Shulaev (Михаил Шулаев)"
    };

    function transliterateRussian(value) {
        const map = {
            а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "zh", з: "z", и: "i", й: "y",
            к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f",
            х: "kh", ц: "ts", ч: "ch", ш: "sh", щ: "shch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya"
        };
        return String(value || "").toLocaleLowerCase("ru").split("").map(char => map[char] ?? char).join("");
    }

    function titleCaseTransliteration(value) {
        return transliterateRussian(value).replace(/(^|[\s.-])([a-z])/gi, (_, separator, letter) => separator + letter.toUpperCase());
    }

    function canonicalPersonDisplay(value) {
        // Этот скрипт больше не переводит и не унифицирует людей.
        return stripWiki(value).normalize("NFC");
    }

    function entityKey(field, value) {
        if (field !== "Жанр") return asText(value).normalize("NFC").toLocaleLowerCase("ru");
        const text = asText(value);
        return text.toLocaleLowerCase("ru").replace(/ё/g, "е").replace(/[^0-9a-zа-я]/gi, "");
    }

    function dedupe(values, field) {
        const result = [];
        const seen = new Set();
        for (const value of values) {
            const next = field === "Жанр" ? asText(value) : canonicalPersonDisplay(value);
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
    const files = app.vault.getMarkdownFiles().filter(file => isMedia(file) || isRoleFile(file));

    for (const file of files) {
        const current = getFrontmatter(file);
        const updates = new Map();

        const fields = isRoleFile(file) ? ["Режисер", "Актеры", "Роли актеров"] : ENTITY_FIELDS;
        for (const field of fields) {
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

    if (changedCards) {
        if (changedCards) changes.unshift(`Изменено карточек: **${changedCards}**.`);
        await appendJournal(changes);
    }

    new Notice(`Безопасное исправление завершено: карточек ${changedCards}. Запусти "Кино - Проверить кинотеку".`, 9000);
};
