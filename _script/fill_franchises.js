/* QuickAdd: «Заполнить франшизы». Отдельная команда, без API и сетевых запросов.
 * Каталог ниже составлен по загруженной кинотеке и проверенным источникам.
 * В произведениях меняется только пустое свойство «Франшиза».
 */
const TABLE = "<!-- FRANCHISE:TABLE:v1 -->\n## Произведения\n\n" +
    "```dataviewjs\n" + renderFranchise.toString() + "\nrenderFranchise(dv);\n```\n";
const TABLE_MARKER = "<!-- FRANCHISE:TABLE:v1 -->";
const SOURCE_MARKER = "<!-- FRANCHISE:SOURCES:2026-09 -->";
const FOLDER = "Кино/Франшизы";
const SERVICE = "Кино/Служебное/Импорт франшиз";
let running = false;

module.exports = async function fillFranchises({ app, obsidian }) {
    if (running) return;
    running = true;
    try {
        await run(app, obsidian);
    } finally {
        running = false;
    }
};

async function run(app, obsidian) {
    const parse = raw => readYaml(raw, obsidian.parseYaml);
    const media = [];
    const pages = [];
    const unchanged = [];
    const changes = [];
    const files = app.vault.getMarkdownFiles();
    for (const file of files) {
        const cached = app.metadataCache.getFileCache(file)?.frontmatter || {};
        if (!file.path.startsWith("Кино/") && !tags(cached).includes("franchise")) continue;
        if (/^Кино\/(Просмотры|Сезоны|Служебное)\//.test(file.path)) continue;
        try {
            const raw = await app.vault.read(file);
            const fm = parse(raw);
            const record = { file, raw, fm };
            if (file.path.startsWith(FOLDER + "/") || tags(fm).includes("franchise")) {
                if (!tags(fm).some(t => ["movies", "serial", "season", "viewing"].includes(t)) &&
                    !fm["Сериал"] && !fm["Фильм"]) pages.push(record);
            } else if (tags(fm).some(t => t === "movies" || t === "serial")) {
                media.push(record);
            }
        } catch (error) {
            unchanged.push([file.path, "Чтение YAML: " + error.message]);
        }
    }

    const matched = new Set();
    const groups = [];
    for (const group of CATALOG) {
        const members = [];
        for (const entry of group.members) {
            const record = matchMedia(entry, media);
            if (!record || matched.has(record.file.path)) {
                unchanged.push([entry.path, "Нет однозначного совпадения в текущей кинотеке"]);
                continue;
            }
            matched.add(record.file.path);
            members.push(record);
        }
        if (!members.length) continue;
        const names = [group.name, ...(group.aliases || [])].map(normalize);
        const existing = pages.filter(p => names.includes(normalize(p.file.basename)));
        if (existing.length > 1) {
            unchanged.push([group.name, "Найдено несколько страниц франшизы; сохранены текущие связи"]);
            continue;
        }
        const page = existing[0];
        const path = page?.file.path || `${FOLDER}/${group.name}.md`;
        if (!page && app.vault.getAbstractFileByPath(path)) {
            unchanged.push([path, "Путь уже занят другим файлом или папкой"]);
            continue;
        }
        const link = `[[${path.slice(0, -3)}]]`;
        const membersToFill = members.filter(r => isEmpty(r.fm["Франшиза"]));
        const belongs = r => {
            const refs = Array.isArray(r.fm["Франшиза"]) ? r.fm["Франшиза"] : [r.fm["Франшиза"]];
            return refs.some(ref => {
                const target = linkPath(ref);
                if (!target) return false;
                const dest = app.metadataCache.getFirstLinkpathDest(target, r.file.path);
                return dest ? dest.path === path : names.includes(normalize(target.split("/").pop()));
            });
        };
        for (const record of members.filter(r => !isEmpty(r.fm["Франшиза"]))) {
            unchanged.push([record.file.path, `Сохранена существующая связь: ${String(record.fm["Франшиза"])}`]);
        }
        if (!membersToFill.length && !members.some(belongs)) continue;
        groups.push({ ...group, path, page, membersToFill, link });
    }

    // Сначала составляем весь план, затем записываем резервную копию.
    for (const group of groups) {
        let text = group.page?.raw ||
            `---\ntags:\n  - franchise\nПорядок: выход\n---\n\n# ${group.name}\n\n## Общее впечатление\n\n`;
        if (!text.includes(TABLE_MARKER)) text = text.trimEnd() + "\n\n" + TABLE;
        if (!text.includes(SOURCE_MARKER)) {
            text = text.trimEnd() + "\n\n" + SOURCE_MARKER + "\n## О связи произведений\n\n";
            if (group.note) text += group.note + "\n\n";
            text += `[Источник: ${group.name}](${group.url})\n`;
            const related = (group.related || []).map(name => groups.find(g => g.name === name)).filter(Boolean);
            if (related.length) {
                text += "\n## Связанные циклы и вселенные\n\n" +
                    related.map(g => `- [[${g.path.slice(0, -3)}|${g.name}]]`).join("\n") + "\n";
            }
        }
        if (text !== group.page?.raw) changes.push({
            kind: "page", path: group.path, before: group.page?.raw ?? null, after: text
        });
        for (const record of group.membersToFill) {
            try {
                const after = addLink(record.raw, group.link, obsidian.parseYaml);
                if (after !== record.raw) changes.push({
                    kind: "media", path: record.file.path, before: record.raw, after,
                    target: group.path, franchise: group.name
                });
            } catch (error) {
                unchanged.push([record.file.path, error.message]);
            }
        }
    }
    if (!changes.length) {
        const report = await writeReport(app, [], unchanged, null);
        new obsidian.Notice("Новых изменений нет. Текущие связи сохранены.", 4000);
        await app.workspace.getLeaf(false).openFile(report);
        return;
    }
    await ensureFolder(app, SERVICE);
    const backupPath = await freePath(app, `${SERVICE}/Резервная копия ${stamp()}`, "json");
    const backup = { version: 1, created: new Date().toISOString(), changes };
    await app.vault.create(backupPath, JSON.stringify(backup, null, 2));
    const unavailablePages = new Set();
    for (const change of changes) {
        if (change.kind === "media" && unavailablePages.has(change.target)) {
            change.status = "skipped";
            unchanged.push([change.path, "Страница франшизы изменилась во время работы"]);
            continue;
        }
        try {
            const file = app.vault.getAbstractFileByPath(change.path);
            if (change.before === null) {
                if (file) throw new Error("Путь занят после составления плана");
                await ensureFolder(app, change.path.split("/").slice(0, -1).join("/"));
                await app.vault.create(change.path, change.after);
            } else {
                if (!file || file.extension !== "md") throw new Error("Файл перемещён после составления плана");
                await app.vault.process(file, current => {
                    if (current !== change.before) throw new Error("Файл изменён после составления плана");
                    return change.after;
                });
            }
            change.status = "applied";
        } catch (error) {
            change.status = "skipped";
            unchanged.push([change.path, error.message]);
            if (change.kind === "page") unavailablePages.add(change.path);
        }
    }
    const backupFile = app.vault.getAbstractFileByPath(backupPath);
    await app.vault.modify(backupFile, JSON.stringify(backup, null, 2));
    const applied = changes.filter(c => c.status === "applied");
    const report = await writeReport(app, applied, unchanged, backupPath);
    new obsidian.Notice(`Добавлено связей: ${applied.filter(c => c.kind === "media").length}. Отчёт готов.`, 5000);
    await app.workspace.getLeaf(false).openFile(report);
}

function readYaml(raw, parseYaml) {
    const match = raw.match(/^\uFEFF?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
    if (!match) return {};
    const fm = parseYaml(match[1]) || {};
    if (typeof fm !== "object" || Array.isArray(fm)) throw new Error("YAML должен быть набором свойств");
    return fm;
}

function addLink(raw, link, parseYaml) {
    const fm = readYaml(raw, parseYaml);
    if (!isEmpty(fm["Франшиза"])) return raw;
    const match = raw.match(/^(\uFEFF?---\r?\n)([\s\S]*?)(\r?\n---(?:\r?\n|$))/);
    if (!match) throw new Error("В карточке нет начального блока YAML");
    const eol = match[1].includes("\r\n") ? "\r\n" : "\n";
    const line = "Франшиза: " + JSON.stringify(link);
    const key = /^(?:Франшиза|"Франшиза"|'Франшиза')\s*:[^\r\n]*/gm;
    const count = [...match[2].matchAll(key)].length;
    if (count > 1) throw new Error("В YAML повторяется свойство Франшиза");
    const yaml = count ? match[2].replace(key, line) : match[2] + eol + line;
    const result = match[1] + yaml + match[3] + raw.slice(match[0].length);
    const updated = readYaml(result, parseYaml);
    if (updated["Франшиза"] !== link) throw new Error("Нельзя точечно изменить это представление YAML");
    // Дополнительная проверка нестандартных YAML-якорей и многострочных значений.
    delete fm["Франшиза"];
    delete updated["Франшиза"];
    if (JSON.stringify(fm) !== JSON.stringify(updated)) throw new Error("Изменение затрагивает другие свойства YAML");
    return result;
}

function matchMedia(entry, records) {
    const sameTitle = r => normalize(r.fm["Название"]) === normalize(entry.title);
    const sameName = r => normalize(r.file.basename) === normalize(entry.name);
    const sameId = r => entry.imdb && String(r.fm["imdb Id"] || "").trim() === entry.imdb;
    const exact = records.find(r => r.file.path === entry.path);
    if (exact && (sameTitle(exact) || sameId(exact))) return exact;
    const byId = records.filter(sameId);
    if (byId.length === 1 && (sameTitle(byId[0]) || sameName(byId[0]))) return byId[0];
    const byTitle = records.filter(r => sameTitle(r) && sameName(r));
    return byTitle.length === 1 ? byTitle[0] : null;
}

function tags(fm) {
    return (Array.isArray(fm.tags) ? fm.tags : [fm.tags]).filter(Boolean).map(t => String(t).replace(/^#/, ""));
}

function isEmpty(value) {
    return value == null || value === "" || (typeof value === "string" && !value.trim()) ||
        (Array.isArray(value) && !value.length);
}

function normalize(value) {
    return String(value || "").normalize("NFKC").toLowerCase().replace(/ё/g, "е")
        .replace(/[^\p{L}\p{N}]/gu, "");
}

function linkPath(value) {
    if (value && typeof value === "object") return value.path || "";
    return String(value || "").replace(/^\[\[/, "").replace(/\]\]$/, "").split("|")[0].split("#")[0].replace(/\.md$/i, "");
}

function stamp() {
    return new Date().toISOString().replace(/[:.]/g, "-");
}

async function ensureFolder(app, path) {
    let current = "";
    for (const part of path.split("/").filter(Boolean)) {
        current = current ? current + "/" + part : part;
        const existing = app.vault.getAbstractFileByPath(current);
        if (!existing) await app.vault.createFolder(current);
        else if (existing.extension) throw new Error("Путь папки занят файлом: " + current);
    }
}

async function freePath(app, base, extension) {
    let path = `${base}.${extension}`;
    let n = 2;
    while (app.vault.getAbstractFileByPath(path)) path = `${base} (${n++}).${extension}`;
    return path;
}

async function writeReport(app, applied, unchanged, backupPath) {
    await ensureFolder(app, SERVICE);
    const lines = ["# Заполнение франшиз", "", `Добавлено связей: ${applied.filter(c => c.kind === "media").length}.`, ""];
    if (backupPath) lines.push(`Резервная копия: [[${backupPath}]].`, "");
    lines.push("Изменено только свойство «Франшиза»; существующие связи и номера частей сохранены.", "", "## Добавленные связи", "");
    for (const change of applied.filter(c => c.kind === "media")) {
        lines.push(`- [[${change.path.slice(0, -3)}]] → [[${change.target.slice(0, -3)}|${change.franchise}]]`);
    }
    if (unchanged.length) {
        lines.push("", "## Без изменений", "");
        for (const [path, reason] of unchanged) lines.push(`- ${path}: ${reason}`);
    }
    const path = await freePath(app, `${SERVICE}/Отчёт ${stamp()}`, "md");
    return await app.vault.create(path, lines.join("\n") + "\n");
}

// Проверенный каталог данных. Для изменения поведения см. функции выше.
const CATALOG = [
  {
    "name": "10.5 баллов",
    "url": "https://en.wikipedia.org/wiki/10.5%3A_Apocalypse",
    "note": "",
    "members": [
      {
        "path": "Кино/10.5 баллов.md",
        "name": "10.5 баллов",
        "title": "10.5",
        "imdb": "tt0364146"
      },
      {
        "path": "Кино/10,5 баллов - Апокалипсис.md",
        "name": "10,5 баллов - Апокалипсис",
        "title": "10.5: Apocalypse",
        "imdb": "tt0463850"
      }
    ]
  },
  {
    "name": "Друзья Оушена",
    "url": "https://en.wikipedia.org/wiki/Ocean%27s_%28film_series%29",
    "note": "Основная трилогия и спин-офф.",
    "members": [
      {
        "path": "Кино/11 друзей Оушена.md",
        "name": "11 друзей Оушена",
        "title": "Ocean's Eleven",
        "imdb": "tt0240772"
      },
      {
        "path": "Кино/12 друзей Оушена.md",
        "name": "12 друзей Оушена",
        "title": "Ocean's Twelve",
        "imdb": "tt0349903"
      },
      {
        "path": "Кино/13 друзей Оушена.md",
        "name": "13 друзей Оушена",
        "title": "Ocean's Thirteen",
        "imdb": "tt0496806"
      },
      {
        "path": "Кино/8 подруг Оушена.md",
        "name": "8 подруг Оушена",
        "title": "Ocean's Eight",
        "imdb": "tt5164214"
      }
    ],
    "aliases": [
      "Оушен",
      "Оушены"
    ]
  },
  {
    "name": "13-й район",
    "url": "https://en.wikipedia.org/wiki/District_13",
    "note": "«Кирпичные особняки» — ремейк, а не третья часть.",
    "members": [
      {
        "path": "Кино/13-й район.md",
        "name": "13-й район",
        "title": "Banlieue 13",
        "imdb": "tt0414852"
      },
      {
        "path": "Кино/13-й район - Ультиматум.md",
        "name": "13-й район - Ультиматум",
        "title": "Banlieue 13 Ultimatum",
        "imdb": "tt1247640"
      },
      {
        "path": "Кино/13-й район - Кирпичные особняки.md",
        "name": "13-й район - Кирпичные особняки",
        "title": "Brick Mansions",
        "imdb": "tt1430612"
      }
    ]
  },
  {
    "name": "14+",
    "url": "https://ru.wikipedia.org/wiki/14%2B",
    "note": "",
    "members": [
      {
        "path": "Кино/14+.md",
        "name": "14+",
        "title": "14+",
        "imdb": "tt4427076"
      }
    ]
  },
  {
    "name": "28 дней спустя",
    "url": "https://en.wikipedia.org/wiki/28_Days_Later_%28film_series%29",
    "note": "",
    "members": [
      {
        "path": "Кино/28 дней спустя.md",
        "name": "28 дней спустя",
        "title": "28 Days Later...",
        "imdb": "tt0289043"
      }
    ]
  },
  {
    "name": "Девять с половиной недель",
    "url": "https://en.wikipedia.org/wiki/Another_9%C2%BD_Weeks",
    "note": "",
    "members": [
      {
        "path": "Кино/9 1 - 2 недель.md",
        "name": "9 1 - 2 недель",
        "title": "Nine 1/2 Weeks",
        "imdb": "tt0091635"
      }
    ]
  },
  {
    "name": "Всё включено",
    "url": "https://ru.wikipedia.org/wiki/%D0%92%D1%81%D1%91_%D0%B2%D0%BA%D0%BB%D1%8E%D1%87%D0%B5%D0%BD%D0%BE_2",
    "note": "",
    "members": [
      {
        "path": "Кино/All inclusive, или Всё включено.md",
        "name": "All inclusive, или Всё включено",
        "title": "All inclusive, или Всё включено",
        "imdb": "tt1846473"
      },
      {
        "path": "Кино/Всё включено 2.md",
        "name": "Всё включено 2",
        "title": "Всё включено 2",
        "imdb": "tt3194426"
      }
    ]
  },
  {
    "name": "Doom",
    "url": "https://en.wikipedia.org/wiki/Doom_%28franchise%29",
    "note": "",
    "members": [
      {
        "path": "Кино/Doom.md",
        "name": "Doom",
        "title": "Doom",
        "imdb": "tt0419706"
      }
    ]
  },
  {
    "name": "Во все тяжкие",
    "url": "https://en.wikipedia.org/wiki/Breaking_Bad_%28franchise%29",
    "note": "",
    "members": [
      {
        "path": "Кино/Во все тяжкие.md",
        "name": "Во все тяжкие",
        "title": "Breaking Bad",
        "imdb": "tt0903747"
      },
      {
        "path": "Кино/Лучше звоните Солу.md",
        "name": "Лучше звоните Солу",
        "title": "Better Call Saul",
        "imdb": "tt3032476"
      },
      {
        "path": "Кино/El Camino - Фильм по мотивам сериала 'Во все тяжкие'.md",
        "name": "El Camino - Фильм по мотивам сериала 'Во все тяжкие'",
        "title": "El Camino: A Breaking Bad Movie",
        "imdb": "tt9243946"
      }
    ]
  },
  {
    "name": "G.I. Joe",
    "url": "https://en.wikipedia.org/wiki/G.I._Joe_%28film_series%29",
    "note": "",
    "members": [
      {
        "path": "Кино/Бросок кобры.md",
        "name": "Бросок кобры",
        "title": "G.I. Joe: The Rise of Cobra",
        "imdb": "tt1046173"
      },
      {
        "path": "Кино/G.I. Joe - Бросок кобры 2.md",
        "name": "G.I. Joe - Бросок кобры 2",
        "title": "G.I. Joe: Retaliation",
        "imdb": "tt1583421"
      }
    ]
  },
  {
    "name": "Гренландия",
    "url": "https://en.wikipedia.org/wiki/Greenland%3A_Migration",
    "note": "",
    "members": [
      {
        "path": "Кино/Greenland.md",
        "name": "Greenland",
        "title": "Greenland",
        "imdb": "tt7737786"
      }
    ]
  },
  {
    "name": "Kingsman",
    "url": "https://en.wikipedia.org/wiki/Kingsman_%28franchise%29",
    "note": "«Начало» — приквел.",
    "members": [
      {
        "path": "Кино/Kingsman - Секретная служба.md",
        "name": "Kingsman - Секретная служба",
        "title": "Kingsman: The Secret Service",
        "imdb": "tt2802144"
      },
      {
        "path": "Кино/Kingsman - Золотое кольцо.md",
        "name": "Kingsman - Золотое кольцо",
        "title": "Kingsman: The Golden Circle",
        "imdb": "tt4649466"
      },
      {
        "path": "Кино/King’s Man - Начало.md",
        "name": "King’s Man - Начало",
        "title": "The King's Man",
        "imdb": "tt6856242"
      }
    ]
  },
  {
    "name": "Superнянь",
    "url": "https://en.wikipedia.org/wiki/Babysitting_2",
    "note": "",
    "members": [
      {
        "path": "Кино/Superнянь.md",
        "name": "Superнянь",
        "title": "Babysitting",
        "imdb": "tt3013602"
      },
      {
        "path": "Кино/Superнянь 2.md",
        "name": "Superнянь 2",
        "title": "Babysitting 2",
        "imdb": "tt4400058"
      }
    ]
  },
  {
    "name": "Лара Крофт",
    "url": "https://en.wikipedia.org/wiki/Tomb_Raider_%28film_series%29",
    "note": "Дилогия с Анджелиной Джоли и отдельный перезапуск 2018 года.",
    "members": [
      {
        "path": "Кино/Лара Крофт - Расхитительница гробниц.md",
        "name": "Лара Крофт - Расхитительница гробниц",
        "title": "Lara Croft: Tomb Raider",
        "imdb": "tt0146316"
      },
      {
        "path": "Кино/Лара Крофт - Расхитительница гробниц 2 – Колыбель жизни.md",
        "name": "Лара Крофт - Расхитительница гробниц 2 – Колыбель жизни",
        "title": "Lara Croft Tomb Raider: The Cradle of Life",
        "imdb": "tt0325703"
      },
      {
        "path": "Кино/Tomb Raider - Лара Крофт.md",
        "name": "Tomb Raider - Лара Крофт",
        "title": "Tomb Raider",
        "imdb": "tt1365519"
      }
    ]
  },
  {
    "name": "V",
    "url": "https://en.wikipedia.org/wiki/V_%28franchise%29",
    "note": "",
    "members": [
      {
        "path": "Кино/Vизитеры.md",
        "name": "Vизитеры",
        "title": "V",
        "imdb": "tt1307824"
      }
    ]
  },
  {
    "name": "X",
    "url": "https://en.wikipedia.org/wiki/X_%28film_series%29",
    "note": "",
    "members": [
      {
        "path": "Кино/X.md",
        "name": "X",
        "title": "X",
        "imdb": "tt13560574"
      }
    ]
  },
  {
    "name": "Зомбилэнд",
    "url": "https://en.wikipedia.org/wiki/Zombieland_%28franchise%29",
    "note": "",
    "members": [
      {
        "path": "Кино/Добро Пожаловать В Zомбилэнд.md",
        "name": "Добро Пожаловать В Zомбилэнд",
        "title": "Zombieland",
        "imdb": "tt1156398"
      },
      {
        "path": "Кино/Zомбилэнд - Контрольный выстрел.md",
        "name": "Zомбилэнд - Контрольный выстрел",
        "title": "Zombieland: Double Tap",
        "imdb": "tt1560220"
      }
    ]
  },
  {
    "name": "Аватар",
    "url": "https://en.wikipedia.org/wiki/Avatar_%28franchise%29",
    "note": "",
    "members": [
      {
        "path": "Кино/Аватар.md",
        "name": "Аватар",
        "title": "Avatar",
        "imdb": "tt0499549"
      },
      {
        "path": "Кино/Аватар 2. Путь воды.md",
        "name": "Аватар 2. Путь воды",
        "title": "Avatar: The Way of Water",
        "imdb": "tt1630029"
      },
      {
        "path": "Кино/Аватар 3. Пламя и пепел.md",
        "name": "Аватар 3. Пламя и пепел",
        "title": "Avatar: Fire and Ash",
        "imdb": "tt1757678"
      }
    ]
  },
  {
    "name": "Джонни Инглиш",
    "url": "https://en.wikipedia.org/wiki/Johnny_English_%28film_series%29",
    "note": "",
    "members": [
      {
        "path": "Кино/Агент Джонни Инглиш.md",
        "name": "Агент Джонни Инглиш",
        "title": "Johnny English",
        "imdb": "tt0274166"
      },
      {
        "path": "Кино/Агент Джонни Инглиш - Перезагрузка.md",
        "name": "Агент Джонни Инглиш - Перезагрузка",
        "title": "Johnny English Reborn",
        "imdb": "tt1634122"
      },
      {
        "path": "Кино/Агент Джонни Инглиш 3.0.md",
        "name": "Агент Джонни Инглиш 3.0",
        "title": "Johnny English Strikes Again",
        "imdb": "tt6921996"
      }
    ]
  },
  {
    "name": "Агент Коди Бэнкс",
    "url": "https://en.wikipedia.org/wiki/Agent_Cody_Banks_2%3A_Destination_London",
    "note": "",
    "members": [
      {
        "path": "Кино/Агент Коди Бэнкс.md",
        "name": "Агент Коди Бэнкс",
        "title": "Agent Cody Banks",
        "imdb": "tt0313911"
      },
      {
        "path": "Кино/Агент Коди Бэнкс 2 - Пункт назначения – Лондон.md",
        "name": "Агент Коди Бэнкс 2 - Пункт назначения – Лондон",
        "title": "Agent Cody Banks 2: Destination London",
        "imdb": "tt0358349"
      }
    ]
  },
  {
    "name": "Агенты А.Н.К.Л.",
    "url": "https://en.wikipedia.org/wiki/The_Man_from_U.N.C.L.E._%28film%29",
    "note": "",
    "members": [
      {
        "path": "Кино/Агенты А.Н.К.Л.md",
        "name": "Агенты А.Н.К.Л",
        "title": "The Man from U.N.C.L.E.",
        "imdb": "tt1638355"
      }
    ]
  },
  {
    "name": "Адреналин",
    "url": "https://en.wikipedia.org/wiki/Crank%3A_High_Voltage",
    "note": "",
    "members": [
      {
        "path": "Кино/Адреналин.md",
        "name": "Адреналин",
        "title": "Crank",
        "imdb": "tt0479884"
      },
      {
        "path": "Кино/Адреналин - Высокое напряжение.md",
        "name": "Адреналин - Высокое напряжение",
        "title": "Crank: High Voltage",
        "imdb": "tt1121931"
      }
    ]
  },
  {
    "name": "Аквамен",
    "url": "https://en.wikipedia.org/wiki/Aquaman_and_the_Lost_Kingdom",
    "note": "",
    "members": [
      {
        "path": "Кино/Аквамен.md",
        "name": "Аквамен",
        "title": "Aquaman",
        "imdb": "tt1477834"
      }
    ],
    "related": [
      "Расширенная вселенная DC"
    ]
  },
  {
    "name": "Аладдин",
    "url": "https://en.wikipedia.org/wiki/Aladdin_%28franchise%29",
    "note": "Игровой ремейк диснеевского мультфильма.",
    "members": [
      {
        "path": "Кино/Аладдин.md",
        "name": "Аладдин",
        "title": "Aladdin",
        "imdb": "tt6139732"
      }
    ]
  },
  {
    "name": "Три богатыря",
    "url": "https://ru.wikipedia.org/wiki/%D0%A2%D1%80%D0%B8_%D0%B1%D0%BE%D0%B3%D0%B0%D1%82%D1%8B%D1%80%D1%8F_%28%D1%84%D1%80%D0%B0%D0%BD%D1%88%D0%B8%D0%B7%D0%B0%29",
    "note": "Включён спин-офф «Конь Юлий и большие скачки».",
    "members": [
      {
        "path": "Кино/Алеша Попович и Тугарин Змей.md",
        "name": "Алеша Попович и Тугарин Змей",
        "title": "Алеша Попович и Тугарин Змей",
        "imdb": "tt0415481"
      },
      {
        "path": "Кино/Добрыня Никитич и Змей Горыныч.md",
        "name": "Добрыня Никитич и Змей Горыныч",
        "title": "Добрыня Никитич и Змей Горыныч",
        "imdb": "tt0465967"
      },
      {
        "path": "Кино/Илья Муромец и Соловей-разбойник.md",
        "name": "Илья Муромец и Соловей-разбойник",
        "title": "Илья Муромец и Соловей-разбойник",
        "imdb": "tt1189893"
      },
      {
        "path": "Кино/Три богатыря и Шамаханская царица.md",
        "name": "Три богатыря и Шамаханская царица",
        "title": "Три богатыря и Шамаханская царица",
        "imdb": "tt1796657"
      },
      {
        "path": "Кино/Три богатыря на дальних берегах.md",
        "name": "Три богатыря на дальних берегах",
        "title": "Три богатыря на дальних берегах",
        "imdb": "tt2592484"
      },
      {
        "path": "Кино/Три богатыря - Ход конем.md",
        "name": "Три богатыря - Ход конем",
        "title": "Три богатыря: Ход конем",
        "imdb": "tt4544278"
      },
      {
        "path": "Кино/Три богатыря и Морской царь.md",
        "name": "Три богатыря и Морской царь",
        "title": "Три богатыря и Морской царь",
        "imdb": "tt6389344"
      },
      {
        "path": "Кино/Три богатыря и принцесса Египта.md",
        "name": "Три богатыря и принцесса Египта",
        "title": "Три богатыря и принцесса Египта",
        "imdb": "tt7548114"
      },
      {
        "path": "Кино/Три богатыря и Наследница престола.md",
        "name": "Три богатыря и Наследница престола",
        "title": "Три богатыря и Наследница престола",
        "imdb": "tt8682096"
      },
      {
        "path": "Кино/Конь Юлий и большие скачки.md",
        "name": "Конь Юлий и большие скачки",
        "title": "Конь Юлий и большие скачки",
        "imdb": "tt13811736"
      },
      {
        "path": "Кино/Три богатыря и Конь на троне.md",
        "name": "Три богатыря и Конь на троне",
        "title": "Три богатыря и Конь на троне",
        "imdb": "tt14469640"
      },
      {
        "path": "Кино/Три богатыря и Пуп Земли.md",
        "name": "Три богатыря и Пуп Земли",
        "title": "Три богатыря и Пуп Земли",
        "imdb": "tt27526478"
      },
      {
        "path": "Кино/Три богатыря. Ни дня без подвига.md",
        "name": "Три богатыря. Ни дня без подвига",
        "title": "Три богатыря. Ни дня без подвига",
        "imdb": "tt37167782"
      }
    ]
  },
  {
    "name": "Альф",
    "url": "https://en.wikipedia.org/wiki/Project_ALF",
    "note": "",
    "members": [
      {
        "path": "Кино/Альф.md",
        "name": "Альф",
        "title": "ALF",
        "imdb": "tt0090390"
      }
    ]
  },
  {
    "name": "Американский пирог",
    "url": "https://en.wikipedia.org/wiki/American_Pie_%28film_series%29",
    "note": "Основные фильмы и ответвление American Pie Presents.",
    "members": [
      {
        "path": "Кино/Американский пирог.md",
        "name": "Американский пирог",
        "title": "American Pie",
        "imdb": "tt0163651"
      },
      {
        "path": "Кино/Американский пирог 2.md",
        "name": "Американский пирог 2",
        "title": "American Pie 2",
        "imdb": "tt0252866"
      },
      {
        "path": "Кино/Американский пирог - Свадьба.md",
        "name": "Американский пирог - Свадьба",
        "title": "American Wedding",
        "imdb": "tt0328828"
      },
      {
        "path": "Кино/Американский пирог - Музыкальный лагерь.md",
        "name": "Американский пирог - Музыкальный лагерь",
        "title": "American Pie Presents Band Camp",
        "imdb": "tt0436058"
      },
      {
        "path": "Кино/Американский пирог представляет - Голая миля.md",
        "name": "Американский пирог представляет - Голая миля",
        "title": "American Pie Presents: The Naked Mile",
        "imdb": "tt0808146"
      },
      {
        "path": "Кино/Американский пирог представляет - Переполох в общаге.md",
        "name": "Американский пирог представляет - Переполох в общаге",
        "title": "American Pie Presents: Beta House",
        "imdb": "tt0974959"
      },
      {
        "path": "Кино/Американский пирог - Книга любви.md",
        "name": "Американский пирог - Книга любви",
        "title": "American Pie Presents: The Book of Love",
        "imdb": "tt1407050"
      },
      {
        "path": "Кино/Американский пирог - Все в сборе.md",
        "name": "Американский пирог - Все в сборе",
        "title": "American Reunion",
        "imdb": "tt1605630"
      },
      {
        "path": "Кино/Американский пирог - Девчонки рулят.md",
        "name": "Американский пирог - Девчонки рулят",
        "title": "American Pie Presents: Girls' Rules",
        "imdb": "tt11771594"
      }
    ]
  },
  {
    "name": "Американский психопат",
    "url": "https://en.wikipedia.org/wiki/American_Psycho_2",
    "note": "",
    "members": [
      {
        "path": "Кино/Американский психопат.md",
        "name": "Американский психопат",
        "title": "American Psycho",
        "imdb": "tt0144084"
      },
      {
        "path": "Кино/Американский психопат 2.md",
        "name": "Американский психопат 2",
        "title": "American Psycho II: All American Girl",
        "imdb": "tt0283877"
      }
    ]
  },
  {
    "name": "Роберт Лэнгдон",
    "url": "https://en.wikipedia.org/wiki/Robert_Langdon_%28franchise%29",
    "note": "Фильмы и сериал «Утраченный символ»; разные воплощения героя.",
    "members": [
      {
        "path": "Кино/Код да Винчи.md",
        "name": "Код да Винчи",
        "title": "The Da Vinci Code",
        "imdb": "tt0382625"
      },
      {
        "path": "Кино/Ангелы и Демоны.md",
        "name": "Ангелы и Демоны",
        "title": "Angels & Demons",
        "imdb": "tt0808151"
      },
      {
        "path": "Кино/Инферно.md",
        "name": "Инферно",
        "title": "Inferno",
        "imdb": "tt3062096"
      },
      {
        "path": "Кино/Утраченный символ.md",
        "name": "Утраченный символ",
        "title": "The Lost Symbol",
        "imdb": "tt10478054"
      }
    ]
  },
  {
    "name": "Армия мертвецов",
    "url": "https://en.wikipedia.org/wiki/Army_of_the_Dead_%28franchise%29",
    "note": "",
    "members": [
      {
        "path": "Кино/Армия мертвецов.md",
        "name": "Армия мертвецов",
        "title": "Army of the Dead",
        "imdb": "tt0993840"
      },
      {
        "path": "Кино/Армия воров.md",
        "name": "Армия воров",
        "title": "Army of Thieves",
        "imdb": "tt13024674"
      }
    ]
  },
  {
    "name": "Астерикс и Обеликс",
    "url": "https://en.wikipedia.org/wiki/List_of_Asterix_films",
    "note": "",
    "members": [
      {
        "path": "Кино/Астерикс и Обеликс против Цезаря.md",
        "name": "Астерикс и Обеликс против Цезаря",
        "title": "Astérix & Obélix contre César",
        "imdb": "tt0133385"
      },
      {
        "path": "Кино/Астерикс и Обеликс - Миссия Клеопатра.md",
        "name": "Астерикс и Обеликс - Миссия Клеопатра",
        "title": "Astérix & Obélix: Mission Cléopâtre",
        "imdb": "tt0250223"
      },
      {
        "path": "Кино/Астерикс на Олимпийских играх.md",
        "name": "Астерикс на Олимпийских играх",
        "title": "Astérix aux Jeux Olympiques",
        "imdb": "tt0463872"
      },
      {
        "path": "Кино/Астерикс и Обеликс в Британии.md",
        "name": "Астерикс и Обеликс в Британии",
        "title": "Astérix & Obélix : Au service de sa Majesté",
        "imdb": "tt1597522"
      },
      {
        "path": "Кино/Астерикс и Обеликс - Поднебесная.md",
        "name": "Астерикс и Обеликс - Поднебесная",
        "title": "Astérix & Obélix : L'empire du milieu",
        "imdb": "tt11210390"
      }
    ]
  },
  {
    "name": "Атлант расправил плечи",
    "url": "https://en.wikipedia.org/wiki/Atlas_Shrugged_%28film_series%29",
    "note": "",
    "members": [
      {
        "path": "Кино/Атлант расправил плечи.md",
        "name": "Атлант расправил плечи",
        "title": "Atlas Shrugged: Part I",
        "imdb": "tt0480239"
      },
      {
        "path": "Кино/Атлант расправил плечи - Часть 2.md",
        "name": "Атлант расправил плечи - Часть 2",
        "title": "Atlas Shrugged II: The Strike",
        "imdb": "tt1985017"
      },
      {
        "path": "Кино/Атлант расправил плечи - Часть 3.md",
        "name": "Атлант расправил плечи - Часть 3",
        "title": "Atlas Shrugged: Part III",
        "imdb": "tt2800038"
      }
    ]
  },
  {
    "name": "Трансформеры",
    "url": "https://en.wikipedia.org/wiki/Transformers_%28film_series%29",
    "note": "Включены «Бамблби» и перезапуск с Звероботами.",
    "members": [
      {
        "path": "Кино/Трансформеры.md",
        "name": "Трансформеры",
        "title": "Transformers",
        "imdb": "tt0418279"
      },
      {
        "path": "Кино/Трансформеры - Месть падших.md",
        "name": "Трансформеры - Месть падших",
        "title": "Transformers: Revenge of the Fallen",
        "imdb": "tt1055369"
      },
      {
        "path": "Кино/Трансформеры 3 - Тёмная сторона Луны.md",
        "name": "Трансформеры 3 - Тёмная сторона Луны",
        "title": "Transformers: Dark of the Moon",
        "imdb": "tt1399103"
      },
      {
        "path": "Кино/Трансформеры - Эпоха истребления.md",
        "name": "Трансформеры - Эпоха истребления",
        "title": "Transformers: Age of Extinction",
        "imdb": "tt2109248"
      },
      {
        "path": "Кино/Трансформеры - Последний рыцарь.md",
        "name": "Трансформеры - Последний рыцарь",
        "title": "Transformers: The Last Knight",
        "imdb": "tt3371366"
      },
      {
        "path": "Кино/Бамблби.md",
        "name": "Бамблби",
        "title": "Bumblebee",
        "imdb": "tt4701182"
      },
      {
        "path": "Кино/Трансформеры - Восхождение Звероботов.md",
        "name": "Трансформеры - Восхождение Звероботов",
        "title": "Transformers: Rise of the Beasts",
        "imdb": "tt5090568"
      }
    ]
  },
  {
    "name": "Батя",
    "url": "https://ru.wikipedia.org/wiki/%D0%91%D0%B0%D1%82%D1%8F_%28%D1%84%D0%B8%D0%BB%D1%8C%D0%BC%29",
    "note": "",
    "members": [
      {
        "path": "Кино/Батя.md",
        "name": "Батя",
        "title": "Батя",
        "imdb": "tt14111652"
      }
    ]
  },
  {
    "name": "Бегущий в лабиринте",
    "url": "https://en.wikipedia.org/wiki/Maze_Runner_%28film_series%29",
    "note": "",
    "members": [
      {
        "path": "Кино/Бегущий в лабиринте.md",
        "name": "Бегущий в лабиринте",
        "title": "The Maze Runner",
        "imdb": "tt1790864"
      },
      {
        "path": "Кино/Бегущий в лабиринте - Испытание огнём.md",
        "name": "Бегущий в лабиринте - Испытание огнём",
        "title": "Maze Runner: The Scorch Trials",
        "imdb": "tt4046784"
      },
      {
        "path": "Кино/Бегущий в лабиринте - Лекарство от смерти.md",
        "name": "Бегущий в лабиринте - Лекарство от смерти",
        "title": "Maze Runner: The Death Cure",
        "imdb": "tt4500922"
      }
    ]
  },
  {
    "name": "Библиотекарь",
    "url": "https://en.wikipedia.org/wiki/The_Librarian_%28franchise%29",
    "note": "",
    "members": [
      {
        "path": "Кино/Библиотекарь - В поисках копья судьбы.md",
        "name": "Библиотекарь - В поисках копья судьбы",
        "title": "The Librarian: Quest for the Spear",
        "imdb": "tt0412915"
      },
      {
        "path": "Кино/Библиотекарь 2 - Возвращение в Копи Царя Соломона.md",
        "name": "Библиотекарь 2 - Возвращение в Копи Царя Соломона",
        "title": "The Librarian: Return to King Solomon's Mines",
        "imdb": "tt0455596"
      },
      {
        "path": "Кино/Библиотекарь 3 - Проклятие иудовой чаши.md",
        "name": "Библиотекарь 3 - Проклятие иудовой чаши",
        "title": "The Librarian: The Curse of the Judas Chalice",
        "imdb": "tt1146438"
      }
    ]
  },
  {
    "name": "Битва титанов",
    "url": "https://en.wikipedia.org/wiki/Clash_of_the_Titans_%28film_series%29",
    "note": "",
    "members": [
      {
        "path": "Кино/Битва титанов.md",
        "name": "Битва титанов",
        "title": "Clash of the Titans",
        "imdb": "tt0800320"
      },
      {
        "path": "Кино/Гнев титанов.md",
        "name": "Гнев титанов",
        "title": "Wrath of the Titans",
        "imdb": "tt1646987"
      }
    ]
  },
  {
    "name": "Блондинка в законе",
    "url": "https://en.wikipedia.org/wiki/Legally_Blonde_%28franchise%29",
    "note": "",
    "members": [
      {
        "path": "Кино/Блондинка в законе.md",
        "name": "Блондинка в законе",
        "title": "Legally Blonde",
        "imdb": "tt0250494"
      },
      {
        "path": "Кино/Блондинка в законе 2.md",
        "name": "Блондинка в законе 2",
        "title": "Legally Blonde 2: Red, White & Blonde",
        "imdb": "tt0333780"
      }
    ]
  },
  {
    "name": "Блуждающая Земля",
    "url": "https://en.wikipedia.org/wiki/The_Wandering_Earth_2",
    "note": "",
    "members": [
      {
        "path": "Кино/Блуждающая Земля.md",
        "name": "Блуждающая Земля",
        "title": "The Wandering Earth",
        "imdb": "tt7605074"
      },
      {
        "path": "Кино/Блуждающая Земля 2.md",
        "name": "Блуждающая Земля 2",
        "title": "The Wandering Earth II",
        "imdb": "tt13539646"
      }
    ]
  },
  {
    "name": "Ходячие мертвецы",
    "url": "https://en.wikipedia.org/wiki/The_Walking_Dead_%28franchise%29",
    "note": "",
    "members": [
      {
        "path": "Кино/Ходячие мертвецы.md",
        "name": "Ходячие мертвецы",
        "title": "The Walking Dead",
        "imdb": "tt1520211"
      },
      {
        "path": "Кино/Бойтесь ходячих мертвецов.md",
        "name": "Бойтесь ходячих мертвецов",
        "title": "Fear the Walking Dead",
        "imdb": "tt3743822"
      },
      {
        "path": "Кино/Ходячие мертвецы. Выжившие.md",
        "name": "Ходячие мертвецы. Выжившие",
        "title": "The Walking Dead: The Ones Who Live",
        "imdb": "tt9859436"
      },
      {
        "path": "Кино/Ходячие мертвецы. Дэрил Диксон.md",
        "name": "Ходячие мертвецы. Дэрил Диксон",
        "title": "The Walking Dead: Daryl Dixon",
        "imdb": "tt13062500"
      },
      {
        "path": "Кино/Ходячие мертвецы. Мертвый город.md",
        "name": "Ходячие мертвецы. Мертвый город",
        "title": "The Walking Dead: Dead City",
        "imdb": "tt18546730"
      }
    ]
  },
  {
    "name": "Большая жратва",
    "url": "https://en.wikipedia.org/wiki/Still_Waiting...",
    "note": "",
    "members": [
      {
        "path": "Кино/Большая жратва.md",
        "name": "Большая жратва",
        "title": "Waiting...",
        "imdb": "tt0348333"
      }
    ]
  },
  {
    "name": "Дом большой мамочки",
    "url": "https://en.wikipedia.org/wiki/Big_Momma%27s_House_%28film_series%29",
    "note": "",
    "members": [
      {
        "path": "Кино/Дом большой мамочки.md",
        "name": "Дом большой мамочки",
        "title": "Big Momma's House",
        "imdb": "tt0208003"
      },
      {
        "path": "Кино/Дом большой мамочки 2.md",
        "name": "Дом большой мамочки 2",
        "title": "Big Momma's House 2",
        "imdb": "tt0421729"
      },
      {
        "path": "Кино/Большие мамочки - Сын как отец.md",
        "name": "Большие мамочки - Сын как отец",
        "title": "Big Mommas: Like Father, Like Son",
        "imdb": "tt1464174"
      }
    ]
  },
  {
    "name": "Бригада",
    "url": "https://ru.wikipedia.org/wiki/%D0%91%D1%80%D0%B8%D0%B3%D0%B0%D0%B4%D0%B0%3A_%D0%9D%D0%B0%D1%81%D0%BB%D0%B5%D0%B4%D0%BD%D0%B8%D0%BA",
    "note": "",
    "members": [
      {
        "path": "Кино/Бригада.md",
        "name": "Бригада",
        "title": "Бригада",
        "imdb": "tt0337898"
      },
      {
        "path": "Кино/Бригада - Наследник.md",
        "name": "Бригада - Наследник",
        "title": "Бригада: Наследник",
        "imdb": "tt1765729"
      }
    ]
  },
  {
    "name": "Бриджит Джонс",
    "url": "https://en.wikipedia.org/wiki/Bridget_Jones_%28film_series%29",
    "note": "",
    "members": [
      {
        "path": "Кино/Дневник Бриджет Джонс.md",
        "name": "Дневник Бриджет Джонс",
        "title": "Bridget Jones's Diary",
        "imdb": "tt0243155"
      },
      {
        "path": "Кино/Бриджит Джонс - Грани разумного.md",
        "name": "Бриджит Джонс - Грани разумного",
        "title": "Bridget Jones: The Edge of Reason",
        "imdb": "tt0317198"
      }
    ]
  },
  {
    "name": "Брюс и Эван Всемогущие",
    "url": "https://en.wikipedia.org/wiki/Evan_Almighty",
    "note": "",
    "members": [
      {
        "path": "Кино/Брюс Всемогущий.md",
        "name": "Брюс Всемогущий",
        "title": "Bruce Almighty",
        "imdb": "tt0315327"
      },
      {
        "path": "Кино/Эван Всемогущий.md",
        "name": "Эван Всемогущий",
        "title": "Evan Almighty",
        "imdb": "tt0413099"
      }
    ]
  },
  {
    "name": "Жизнь после людей",
    "url": "https://en.wikipedia.org/wiki/Life_After_People",
    "note": "Документальный фильм и последовавший за ним сериал.",
    "members": [
      {
        "path": "Кино/Будущее планеты - Жизнь после людей.md",
        "name": "Будущее планеты - Жизнь после людей",
        "title": "Life After People",
        "imdb": "tt1173907"
      },
      {
        "path": "Кино/Жизнь после людей.md",
        "name": "Жизнь после людей",
        "title": "Life After People",
        "imdb": "tt1433058"
      }
    ]
  },
  {
    "name": "Расширенная вселенная DC",
    "url": "https://en.wikipedia.org/wiki/DC_Extended_Universe",
    "note": "Общие фильмы вселенной; серии об Аквамене, Чудо-женщине и Шазаме — на связанных страницах.",
    "members": [
      {
        "path": "Кино/Бэтмен против Супермена - На заре справедливости.md",
        "name": "Бэтмен против Супермена - На заре справедливости",
        "title": "Batman v Superman: Dawn of Justice",
        "imdb": "tt2975590"
      },
      {
        "path": "Кино/Лига справедливости.md",
        "name": "Лига справедливости",
        "title": "Justice League",
        "imdb": "tt0974015"
      },
      {
        "path": "Кино/Человек из стали.md",
        "name": "Человек из стали",
        "title": "Man of Steel",
        "imdb": "tt0770828"
      },
      {
        "path": "Кино/Отряд самоубийц.md",
        "name": "Отряд самоубийц",
        "title": "Suicide Squad",
        "imdb": "tt1386697"
      },
      {
        "path": "Кино/Хищные птицы - Потрясающая история Харли Квинн.md",
        "name": "Хищные птицы - Потрясающая история Харли Квинн",
        "title": "Birds of Prey (and the Fantabulous Emancipation of One Harley Quinn)",
        "imdb": "tt7713068"
      },
      {
        "path": "Кино/Флэш.md",
        "name": "Флэш",
        "title": "The Flash",
        "imdb": "tt0439572"
      },
      {
        "path": "Кино/Синий Жук.md",
        "name": "Синий Жук",
        "title": "Blue Beetle",
        "imdb": "tt9362930"
      }
    ],
    "aliases": [
      "DCEU"
    ],
    "related": [
      "Аквамен",
      "Чудо-женщина",
      "Шазам"
    ]
  },
  {
    "name": "В погоне за драконами",
    "url": "https://en.wikipedia.org/wiki/Chasing_the_Dragon_II%3A_Wild_Wild_Bunch",
    "note": "",
    "members": [
      {
        "path": "Кино/В погоне за драконами.md",
        "name": "В погоне за драконами",
        "title": "Chasing the Dragon",
        "imdb": "tt6015328"
      }
    ]
  },
  {
    "name": "Ведьмина гора",
    "url": "https://en.wikipedia.org/wiki/Witch_Mountain_%28franchise%29",
    "note": "",
    "members": [
      {
        "path": "Кино/Ведьмина гора.md",
        "name": "Ведьмина гора",
        "title": "Race to Witch Mountain",
        "imdb": "tt1075417"
      }
    ]
  },
  {
    "name": "Великий уравнитель",
    "url": "https://en.wikipedia.org/wiki/The_Equalizer_2",
    "note": "",
    "members": [
      {
        "path": "Кино/Великий уравнитель.md",
        "name": "Великий уравнитель",
        "title": "The Equalizer",
        "imdb": "tt0455944"
      }
    ]
  },
  {
    "name": "Веном",
    "url": "https://en.wikipedia.org/wiki/Venom_%28film_series%29",
    "note": "",
    "members": [
      {
        "path": "Кино/Веном.md",
        "name": "Веном",
        "title": "Venom",
        "imdb": "tt1270797"
      },
      {
        "path": "Кино/Веном 2.md",
        "name": "Веном 2",
        "title": "Venom: Let There Be Carnage",
        "imdb": "tt7097896"
      }
    ]
  },
  {
    "name": "Киновселенная Marvel",
    "url": "https://en.wikipedia.org/wiki/Marvel_Cinematic_Universe",
    "note": "Здесь отдельные произведения MCU; циклы о конкретных героях доступны по ссылкам ниже.",
    "members": [
      {
        "path": "Кино/Вечные.md",
        "name": "Вечные",
        "title": "Eternals",
        "imdb": "tt9032400"
      },
      {
        "path": "Кино/Громовержцы.md",
        "name": "Громовержцы",
        "title": "Thunderbolts",
        "imdb": "tt20969586"
      },
      {
        "path": "Кино/Женщина-Халк - Адвокат.md",
        "name": "Женщина-Халк - Адвокат",
        "title": "She-Hulk: Attorney at Law",
        "imdb": "tt10857160"
      },
      {
        "path": "Кино/Локи.md",
        "name": "Локи",
        "title": "Loki",
        "imdb": "tt9140554"
      },
      {
        "path": "Кино/Невероятный Халк.md",
        "name": "Невероятный Халк",
        "title": "The Incredible Hulk",
        "imdb": "tt0800080"
      },
      {
        "path": "Кино/Чёрная Вдова.md",
        "name": "Чёрная Вдова",
        "title": "Black Widow",
        "imdb": "tt3480822"
      },
      {
        "path": "Кино/Шан-Чи и легенда десяти колец.md",
        "name": "Шан-Чи и легенда десяти колец",
        "title": "Shang-Chi and the Legend of the Ten Rings",
        "imdb": "tt9376612"
      }
    ],
    "aliases": [
      "MCU",
      "Кинематографическая вселенная Marvel"
    ],
    "related": [
      "Железный человек",
      "Тор",
      "Первый мститель",
      "Мстители",
      "Доктор Стрэндж",
      "Капитан Марвел",
      "Человек-паук — MCU",
      "Человек-муравей",
      "Чёрная пантера",
      "Стражи Галактики",
      "Дэдпул"
    ]
  },
  {
    "name": "Видоизменённый углерод",
    "url": "https://en.wikipedia.org/wiki/Altered_Carbon%3A_Resleeved",
    "note": "",
    "members": [
      {
        "path": "Кино/Видоизмененный углерод.md",
        "name": "Видоизмененный углерод",
        "title": "Altered Carbon",
        "imdb": "tt2261227"
      }
    ]
  },
  {
    "name": "Средиземье",
    "url": "https://en.wikipedia.org/wiki/Middle-earth_in_film",
    "note": "«Властелин колец» и «Хоббит».",
    "members": [
      {
        "path": "Кино/Властелин Колец - Братство Кольца.md",
        "name": "Властелин Колец - Братство Кольца",
        "title": "The Lord of the Rings: The Fellowship of the Ring",
        "imdb": "tt0120737"
      },
      {
        "path": "Кино/Властелин Колец - Две крепости.md",
        "name": "Властелин Колец - Две крепости",
        "title": "The Lord of the Rings: The Two Towers",
        "imdb": "tt0167261"
      },
      {
        "path": "Кино/Властелин колец - Возвращение короля.md",
        "name": "Властелин колец - Возвращение короля",
        "title": "The Lord of the Rings: The Return of the King",
        "imdb": "tt0167260"
      },
      {
        "path": "Кино/Хоббит - Нежданное путешествие.md",
        "name": "Хоббит - Нежданное путешествие",
        "title": "The Hobbit: An Unexpected Journey",
        "imdb": "tt0903624"
      },
      {
        "path": "Кино/Хоббит - Пустошь Смауга.md",
        "name": "Хоббит - Пустошь Смауга",
        "title": "The Hobbit: The Desolation of Smaug",
        "imdb": "tt1170358"
      },
      {
        "path": "Кино/Хоббит - Битва пяти воинств.md",
        "name": "Хоббит - Битва пяти воинств",
        "title": "The Hobbit: The Battle of the Five Armies",
        "imdb": "tt2310332"
      }
    ],
    "aliases": [
      "Властелин колец"
    ]
  },
  {
    "name": "Голубая лагуна",
    "url": "https://en.wikipedia.org/wiki/Blue_Lagoon%3A_The_Awakening",
    "note": "Оригинал, продолжение и телевизионная версия; не единая нумерованная трилогия.",
    "members": [
      {
        "path": "Кино/Голубая лагуна (1980).md",
        "name": "Голубая лагуна (1980)",
        "title": "The Blue Lagoon",
        "imdb": "tt0080453"
      },
      {
        "path": "Кино/Возвращение в голубую лагуну.md",
        "name": "Возвращение в голубую лагуну",
        "title": "Return to the Blue Lagoon",
        "imdb": "tt0102782"
      },
      {
        "path": "Кино/Голубая лагуна.md",
        "name": "Голубая лагуна",
        "title": "Blue Lagoon: The Awakening",
        "imdb": "tt2287663"
      }
    ]
  },
  {
    "name": "Том Рипли",
    "url": "https://en.wikipedia.org/wiki/Tom_Ripley",
    "note": "Экранизации книг о Рипли с разными актёрами; отдельные версии, не непрерывная киносерия.",
    "members": [
      {
        "path": "Кино/На ярком солнце.md",
        "name": "На ярком солнце",
        "title": "Purple Noon",
        "imdb": "tt0054189"
      },
      {
        "path": "Кино/Талантливый мистер Рипли.md",
        "name": "Талантливый мистер Рипли",
        "title": "The Talented Mr. Ripley",
        "imdb": "tt0134119"
      },
      {
        "path": "Кино/Игра Рипли.md",
        "name": "Игра Рипли",
        "title": "Ripley's Game",
        "imdb": "tt0265651"
      },
      {
        "path": "Кино/Возвращение мистера Рипли.md",
        "name": "Возвращение мистера Рипли",
        "title": "Ripley Under Ground",
        "imdb": "tt0219171"
      },
      {
        "path": "Кино/Рипли.md",
        "name": "Рипли",
        "title": "Ripley",
        "imdb": "tt11016042"
      }
    ]
  },
  {
    "name": "Планета обезьян",
    "url": "https://en.wikipedia.org/wiki/Planet_of_the_Apes",
    "note": "Ремейк 2001 года и цикл, начавшийся в 2011 году, имеют разные непрерывности.",
    "members": [
      {
        "path": "Кино/Планета обезьян.md",
        "name": "Планета обезьян",
        "title": "Planet of the Apes",
        "imdb": "tt0133152"
      },
      {
        "path": "Кино/Восстание планеты обезьян.md",
        "name": "Восстание планеты обезьян",
        "title": "Rise of the Planet of the Apes",
        "imdb": "tt1318514"
      },
      {
        "path": "Кино/Планета обезьян - Революция.md",
        "name": "Планета обезьян - Революция",
        "title": "Dawn of the Planet of the Apes",
        "imdb": "tt2103281"
      },
      {
        "path": "Кино/Планета обезьян - Война.md",
        "name": "Планета обезьян - Война",
        "title": "War for the Planet of the Apes",
        "imdb": "tt3450958"
      },
      {
        "path": "Кино/Планета обезьян - Новое царство.md",
        "name": "Планета обезьян - Новое царство",
        "title": "Kingdom of the Planet of the Apes",
        "imdb": "tt11389872"
      }
    ]
  },
  {
    "name": "Восточный ветер",
    "url": "https://en.wikipedia.org/wiki/Windstorm_%28film%29",
    "note": "",
    "members": [
      {
        "path": "Кино/Восточный ветер.md",
        "name": "Восточный ветер",
        "title": "Ostwind",
        "imdb": "tt2356464"
      },
      {
        "path": "Кино/Восточный ветер 2.md",
        "name": "Восточный ветер 2",
        "title": "Ostwind 2",
        "imdb": "tt3849938"
      },
      {
        "path": "Кино/Восточный ветер 3 - Наследие Оры.md",
        "name": "Восточный ветер 3 - Наследие Оры",
        "title": "Ostwind 3 - Aufbruch nach Ora",
        "imdb": "tt5311972"
      },
      {
        "path": "Кино/Восточный ветер 4 - Легенда о воине.md",
        "name": "Восточный ветер 4 - Легенда о воине",
        "title": "Ostwind - Aris Ankunft",
        "imdb": "tt9182284"
      },
      {
        "path": "Кино/Восточный ветер - Великий ураган.md",
        "name": "Восточный ветер - Великий ураган",
        "title": "Ostwind - Der große Orkan",
        "imdb": "tt11560730"
      }
    ]
  },
  {
    "name": "Вышибала",
    "url": "https://en.wikipedia.org/wiki/Goon%3A_Last_of_the_Enforcers",
    "note": "",
    "members": [
      {
        "path": "Кино/Вышибала.md",
        "name": "Вышибала",
        "title": "Goon",
        "imdb": "tt1456635"
      }
    ]
  },
  {
    "name": "Гадкий я и Миньоны",
    "url": "https://en.wikipedia.org/wiki/Despicable_Me",
    "note": "",
    "members": [
      {
        "path": "Кино/Гадкий я.md",
        "name": "Гадкий я",
        "title": "Despicable Me",
        "imdb": "tt1323594"
      },
      {
        "path": "Кино/Гадкий я 2.md",
        "name": "Гадкий я 2",
        "title": "Despicable Me 2",
        "imdb": "tt1690953"
      },
      {
        "path": "Кино/Миньоны.md",
        "name": "Миньоны",
        "title": "Minions",
        "imdb": "tt2293640"
      }
    ],
    "aliases": [
      "Гадкий я"
    ]
  },
  {
    "name": "Гарольд и Кумар",
    "url": "https://en.wikipedia.org/wiki/Harold_%26_Kumar",
    "note": "",
    "members": [
      {
        "path": "Кино/Гарольд и Кумар уходят в отрыв.md",
        "name": "Гарольд и Кумар уходят в отрыв",
        "title": "Harold & Kumar Go to White Castle",
        "imdb": "tt0366551"
      },
      {
        "path": "Кино/Гарольд и Кумар - Побег из Гуантанамо.md",
        "name": "Гарольд и Кумар - Побег из Гуантанамо",
        "title": "Harold & Kumar Escape from Guantanamo Bay",
        "imdb": "tt0481536"
      },
      {
        "path": "Кино/Убойное Рождество Гарольда и Кумара.md",
        "name": "Убойное Рождество Гарольда и Кумара",
        "title": "A Very Harold & Kumar 3D Christmas",
        "imdb": "tt1268799"
      }
    ]
  },
  {
    "name": "Волшебный мир Гарри Поттера",
    "url": "https://en.wikipedia.org/wiki/Wizarding_World",
    "note": "«Гарри Поттер» и приквелы «Фантастические твари».",
    "members": [
      {
        "path": "Кино/Гарри Поттер и философский камень.md",
        "name": "Гарри Поттер и философский камень",
        "title": "Harry Potter and the Sorcerer's Stone",
        "imdb": "tt0241527"
      },
      {
        "path": "Кино/Гарри Поттер и Тайная комната.md",
        "name": "Гарри Поттер и Тайная комната",
        "title": "Harry Potter and the Chamber of Secrets",
        "imdb": "tt0295297"
      },
      {
        "path": "Кино/Гарри Поттер и узник Азкабана.md",
        "name": "Гарри Поттер и узник Азкабана",
        "title": "Harry Potter and the Prisoner of Azkaban",
        "imdb": "tt0304141"
      },
      {
        "path": "Кино/Гарри Поттер и Кубок огня.md",
        "name": "Гарри Поттер и Кубок огня",
        "title": "Harry Potter and the Goblet of Fire",
        "imdb": "tt0330373"
      },
      {
        "path": "Кино/Гарри Поттер и Орден Феникса.md",
        "name": "Гарри Поттер и Орден Феникса",
        "title": "Harry Potter and the Order of the Phoenix",
        "imdb": "tt0373889"
      },
      {
        "path": "Кино/Гарри Поттер и Принц-полукровка.md",
        "name": "Гарри Поттер и Принц-полукровка",
        "title": "Harry Potter and the Half-Blood Prince",
        "imdb": "tt0417741"
      },
      {
        "path": "Кино/Гарри Поттер и Дары Смерти - Часть I.md",
        "name": "Гарри Поттер и Дары Смерти - Часть I",
        "title": "Harry Potter and the Deathly Hallows: Part 1",
        "imdb": "tt0926084"
      },
      {
        "path": "Кино/Гарри Поттер и Дары Смерти - Часть II.md",
        "name": "Гарри Поттер и Дары Смерти - Часть II",
        "title": "Harry Potter and the Deathly Hallows: Part 2",
        "imdb": "tt1201607"
      },
      {
        "path": "Кино/Фантастические твари и где они обитают.md",
        "name": "Фантастические твари и где они обитают",
        "title": "Fantastic Beasts and Where to Find Them",
        "imdb": "tt3183660"
      },
      {
        "path": "Кино/Фантастические твари - Преступления Грин-де-Вальда.md",
        "name": "Фантастические твари - Преступления Грин-де-Вальда",
        "title": "Fantastic Beasts: The Crimes of Grindelwald",
        "imdb": "tt4123430"
      },
      {
        "path": "Кино/Фантастические твари - Тайны Дамблдора.md",
        "name": "Фантастические твари - Тайны Дамблдора",
        "title": "Fantastic Beasts: The Secrets of Dumbledore",
        "imdb": "tt4123432"
      }
    ],
    "aliases": [
      "Гарри Поттер",
      "Волшебный мир"
    ]
  },
  {
    "name": "На игре",
    "url": "https://ru.wikipedia.org/wiki/%D0%93%D0%B5%D0%B9%D0%BC%D0%B5%D1%80%D1%8B",
    "note": "",
    "members": [
      {
        "path": "Кино/На игре.md",
        "name": "На игре",
        "title": "На игре",
        "imdb": "tt0473705"
      },
      {
        "path": "Кино/На игре 2. Новый уровень.md",
        "name": "На игре 2. Новый уровень",
        "title": "На игре 2. Новый уровень",
        "imdb": "tt1620549"
      },
      {
        "path": "Кино/Геймеры.md",
        "name": "Геймеры",
        "title": "Геймеры",
        "imdb": "tt4216630"
      }
    ]
  },
  {
    "name": "Герои",
    "url": "https://en.wikipedia.org/wiki/Heroes_Reborn_%28miniseries%29",
    "note": "",
    "members": [
      {
        "path": "Кино/Герои.md",
        "name": "Герои",
        "title": "Heroes",
        "imdb": "tt0813715"
      },
      {
        "path": "Кино/Герои - Возрождение.md",
        "name": "Герои - Возрождение",
        "title": "Heroes Reborn",
        "imdb": "tt3556944"
      }
    ]
  },
  {
    "name": "Гладиатор",
    "url": "https://en.wikipedia.org/wiki/Gladiator_II",
    "note": "",
    "members": [
      {
        "path": "Кино/Гладиатор.md",
        "name": "Гладиатор",
        "title": "Gladiator",
        "imdb": "tt0172495"
      }
    ]
  },
  {
    "name": "Годзилла — MonsterVerse",
    "url": "https://en.wikipedia.org/wiki/MonsterVerse",
    "note": "",
    "members": [
      {
        "path": "Кино/Годзилла.md",
        "name": "Годзилла",
        "title": "Godzilla",
        "imdb": "tt0831387"
      }
    ]
  },
  {
    "name": "Голодные игры",
    "url": "https://en.wikipedia.org/wiki/The_Hunger_Games_%28film_series%29",
    "note": "",
    "members": [
      {
        "path": "Кино/Голодные игры.md",
        "name": "Голодные игры",
        "title": "The Hunger Games",
        "imdb": "tt1392170"
      }
    ]
  },
  {
    "name": "Гремлины",
    "url": "https://en.wikipedia.org/wiki/Gremlins_%28franchise%29",
    "note": "«Гремлины — Хранители леса» (Unwelcome) не относится к этой франшизе.",
    "members": [
      {
        "path": "Кино/Гремлины.md",
        "name": "Гремлины",
        "title": "Gremlins",
        "imdb": "tt0087363"
      },
      {
        "path": "Кино/Гремлины 2 - Новенькая партия.md",
        "name": "Гремлины 2 - Новенькая партия",
        "title": "Gremlins 2: The New Batch",
        "imdb": "tt0099700"
      }
    ]
  },
  {
    "name": "Громкая связь",
    "url": "https://ru.wikipedia.org/wiki/%D0%9E%D0%B1%D1%80%D0%B0%D1%82%D0%BD%D0%B0%D1%8F_%D1%81%D0%B2%D1%8F%D0%B7%D1%8C_%28%D1%84%D0%B8%D0%BB%D1%8C%D0%BC%2C_2020%29",
    "note": "",
    "members": [
      {
        "path": "Кино/Громкая связь.md",
        "name": "Громкая связь",
        "title": "Громкая связь",
        "imdb": "tt9624470"
      },
      {
        "path": "Кино/Обратная связь.md",
        "name": "Обратная связь",
        "title": "Обратная связь",
        "imdb": "tt13652420"
      }
    ]
  },
  {
    "name": "Далеко во Вселенной",
    "url": "https://en.wikipedia.org/wiki/Farscape%3A_The_Peacekeeper_Wars",
    "note": "",
    "members": [
      {
        "path": "Кино/Далеко во Вселенной.md",
        "name": "Далеко во Вселенной",
        "title": "Farscape",
        "imdb": "tt0187636"
      }
    ]
  },
  {
    "name": "Миллениум",
    "url": "https://en.wikipedia.org/wiki/The_Girl_in_the_Spider%27s_Web_%28film%29",
    "note": "",
    "members": [
      {
        "path": "Кино/Девушка с татуировкой дракона.md",
        "name": "Девушка с татуировкой дракона",
        "title": "The Girl with the Dragon Tattoo",
        "imdb": "tt1568346"
      }
    ]
  },
  {
    "name": "Декстер",
    "url": "https://en.wikipedia.org/wiki/Dexter_%28franchise%29",
    "note": "",
    "members": [
      {
        "path": "Кино/Декстер.md",
        "name": "Декстер",
        "title": "Dexter",
        "imdb": "tt0773262"
      },
      {
        "path": "Кино/Декстер - Новая кровь.md",
        "name": "Декстер - Новая кровь",
        "title": "Dexter: New Blood",
        "imdb": "tt14164730"
      },
      {
        "path": "Кино/Декстер. Воскрешение.md",
        "name": "Декстер. Воскрешение",
        "title": "Dexter: Resurrection",
        "imdb": "tt33043892"
      }
    ]
  },
  {
    "name": "Деннис-мучитель",
    "url": "https://en.wikipedia.org/wiki/A_Dennis_the_Menace_Christmas",
    "note": "",
    "members": [
      {
        "path": "Кино/Деннис – мучитель Рождества.md",
        "name": "Деннис – мучитель Рождества",
        "title": "A Dennis the Menace Christmas",
        "imdb": "tt0918511"
      }
    ]
  },
  {
    "name": "День катастрофы",
    "url": "https://en.wikipedia.org/wiki/Category_7%3A_The_End_of_the_World",
    "note": "",
    "members": [
      {
        "path": "Кино/День катастрофы.md",
        "name": "День катастрофы",
        "title": "Category 6: Day of Destruction",
        "imdb": "tt0428144"
      },
      {
        "path": "Кино/День катастрофы 2 - Конец света.md",
        "name": "День катастрофы 2 - Конец света",
        "title": "Category 7: The End of the World",
        "imdb": "tt0468988"
      }
    ]
  },
  {
    "name": "День независимости",
    "url": "https://en.wikipedia.org/wiki/Independence_Day_%28franchise%29",
    "note": "",
    "members": [
      {
        "path": "Кино/День независимости.md",
        "name": "День независимости",
        "title": "Independence Day",
        "imdb": "tt0116629"
      },
      {
        "path": "Кино/День независимости - Возрождение.md",
        "name": "День независимости - Возрождение",
        "title": "Independence Day: Resurgence",
        "imdb": "tt1628841"
      }
    ]
  },
  {
    "name": "Дети шпионов",
    "url": "https://en.wikipedia.org/wiki/Spy_Kids",
    "note": "",
    "members": [
      {
        "path": "Кино/Дети шпионов.md",
        "name": "Дети шпионов",
        "title": "Spy Kids",
        "imdb": "tt0227538"
      },
      {
        "path": "Кино/Дети шпионов 2 - Остров несбывшихся надежд.md",
        "name": "Дети шпионов 2 - Остров несбывшихся надежд",
        "title": "Spy Kids 2: Island of Lost Dreams",
        "imdb": "tt0287717"
      },
      {
        "path": "Кино/Дети шпионов 3 - Игра окончена.md",
        "name": "Дети шпионов 3 - Игра окончена",
        "title": "Spy Kids 3-D: Game Over",
        "imdb": "tt0338459"
      },
      {
        "path": "Кино/Дети шпионов 4D.md",
        "name": "Дети шпионов 4D",
        "title": "Spy Kids: All the Time in the World",
        "imdb": "tt1517489"
      }
    ],
    "related": [
      "Мачете"
    ]
  },
  {
    "name": "Джейсон Борн",
    "url": "https://en.wikipedia.org/wiki/Bourne_%28franchise%29",
    "note": "",
    "members": [
      {
        "path": "Кино/Идентификация Борна.md",
        "name": "Идентификация Борна",
        "title": "The Bourne Identity",
        "imdb": "tt0258463"
      },
      {
        "path": "Кино/Превосходство Борна.md",
        "name": "Превосходство Борна",
        "title": "The Bourne Supremacy",
        "imdb": "tt0372183"
      },
      {
        "path": "Кино/Ультиматум Борна.md",
        "name": "Ультиматум Борна",
        "title": "The Bourne Ultimatum",
        "imdb": "tt0440963"
      },
      {
        "path": "Кино/Эволюция Борна.md",
        "name": "Эволюция Борна",
        "title": "The Bourne Legacy",
        "imdb": "tt1194173"
      },
      {
        "path": "Кино/Джейсон Борн.md",
        "name": "Джейсон Борн",
        "title": "Jason Bourne",
        "imdb": "tt4196776"
      }
    ],
    "aliases": [
      "Борн"
    ]
  },
  {
    "name": "Джентльмены",
    "url": "https://en.wikipedia.org/wiki/The_Gentlemen_%282024_TV_series%29",
    "note": "",
    "members": [
      {
        "path": "Кино/Джентльмены.md",
        "name": "Джентльмены",
        "title": "The Gentlemen",
        "imdb": "tt8367814"
      }
    ]
  },
  {
    "name": "Джиперс Криперс",
    "url": "https://en.wikipedia.org/wiki/Jeepers_Creepers_%28film_series%29",
    "note": "«Возрождённый» — перезапуск.",
    "members": [
      {
        "path": "Кино/Джиперс Криперс.md",
        "name": "Джиперс Криперс",
        "title": "Jeepers Creepers",
        "imdb": "tt0263488"
      },
      {
        "path": "Кино/Джиперс Криперс 2.md",
        "name": "Джиперс Криперс 2",
        "title": "Jeepers Creepers II",
        "imdb": "tt0301470"
      },
      {
        "path": "Кино/Джиперс Криперс 3.md",
        "name": "Джиперс Криперс 3",
        "title": "Jeepers Creepers 3",
        "imdb": "tt1139592"
      },
      {
        "path": "Кино/Джиперс Криперс - Возрожденный.md",
        "name": "Джиперс Криперс - Возрожденный",
        "title": "Jeepers Creepers: Reborn",
        "imdb": "tt14121726"
      }
    ]
  },
  {
    "name": "Джуманджи",
    "url": "https://en.wikipedia.org/wiki/Jumanji_%28franchise%29",
    "note": "",
    "members": [
      {
        "path": "Кино/Джуманджи - Зов джунглей.md",
        "name": "Джуманджи - Зов джунглей",
        "title": "Jumanji: Welcome to the Jungle",
        "imdb": "tt2283362"
      },
      {
        "path": "Кино/Джуманджи - Новый уровень.md",
        "name": "Джуманджи - Новый уровень",
        "title": "Jumanji: The Next Level",
        "imdb": "tt7975244"
      }
    ]
  },
  {
    "name": "Дивергент",
    "url": "https://en.wikipedia.org/wiki/The_Divergent_Series",
    "note": "",
    "members": [
      {
        "path": "Кино/Дивергент.md",
        "name": "Дивергент",
        "title": "Divergent",
        "imdb": "tt1840309"
      },
      {
        "path": "Кино/Дивергент, глава 2 - Инсургент.md",
        "name": "Дивергент, глава 2 - Инсургент",
        "title": "The Divergent Series: Insurgent",
        "imdb": "tt2908446"
      },
      {
        "path": "Кино/Дивергент, глава 3 - За стеной.md",
        "name": "Дивергент, глава 3 - За стеной",
        "title": "The Divergent Series: Allegiant",
        "imdb": "tt3410834"
      }
    ]
  },
  {
    "name": "Диверсант",
    "url": "https://ru.wikipedia.org/wiki/%D0%94%D0%B8%D0%B2%D0%B5%D1%80%D1%81%D0%B0%D0%BD%D1%82_%28%D1%82%D0%B5%D0%BB%D0%B5%D1%81%D0%B5%D1%80%D0%B8%D0%B0%D0%BB%29",
    "note": "",
    "members": [
      {
        "path": "Кино/Диверсант.md",
        "name": "Диверсант",
        "title": "Диверсант",
        "imdb": "tt0439358"
      },
      {
        "path": "Кино/Диверсант 2 - Конец войны.md",
        "name": "Диверсант 2 - Конец войны",
        "title": "Диверсант 2: Конец войны",
        "imdb": "tt0835007"
      },
      {
        "path": "Кино/Диверсант - Крым.md",
        "name": "Диверсант - Крым",
        "title": "Диверсант: Крым",
        "imdb": "tt12274782"
      },
      {
        "path": "Кино/Диверсант. Идеальный штурм.md",
        "name": "Диверсант. Идеальный штурм",
        "title": "Диверсант. Идеальный штурм",
        "imdb": "tt28511577"
      }
    ]
  },
  {
    "name": "Добро пожаловать в рай",
    "url": "https://en.wikipedia.org/wiki/Into_the_Blue_2%3A_The_Reef",
    "note": "",
    "members": [
      {
        "path": "Кино/Добро пожаловать в рай!.md",
        "name": "Добро пожаловать в рай!",
        "title": "Into the Blue",
        "imdb": "tt0378109"
      },
      {
        "path": "Кино/Добро пожаловать в рай! 2 - Риф.md",
        "name": "Добро пожаловать в рай! 2 - Риф",
        "title": "Into the Blue 2: The Reef",
        "imdb": "tt0865907"
      }
    ]
  },
  {
    "name": "Доктор Дулиттл",
    "url": "https://en.wikipedia.org/wiki/Dr._Dolittle_%28film_series%29",
    "note": "Фильмы с Эдди Мёрфи и отдельная версия 2020 года.",
    "members": [
      {
        "path": "Кино/Доктор Дулиттл.md",
        "name": "Доктор Дулиттл",
        "title": "Doctor Dolittle",
        "imdb": "tt0118998"
      },
      {
        "path": "Кино/Доктор Дулиттл 2.md",
        "name": "Доктор Дулиттл 2",
        "title": "Dr. Dolittle 2",
        "imdb": "tt0240462"
      },
      {
        "path": "Кино/Удивительное путешествие доктора Дулиттла.md",
        "name": "Удивительное путешествие доктора Дулиттла",
        "title": "Dolittle",
        "imdb": "tt8085790"
      }
    ]
  },
  {
    "name": "Доктор Стрэндж",
    "url": "https://en.wikipedia.org/wiki/Doctor_Strange_in_the_Multiverse_of_Madness",
    "note": "",
    "members": [
      {
        "path": "Кино/Доктор Стрэндж.md",
        "name": "Доктор Стрэндж",
        "title": "Doctor Strange",
        "imdb": "tt1211837"
      },
      {
        "path": "Кино/Доктор Стрэндж - В мультивселенной безумия.md",
        "name": "Доктор Стрэндж - В мультивселенной безумия",
        "title": "Doctor Strange in the Multiverse of Madness",
        "imdb": "tt9419884"
      }
    ],
    "related": [
      "Киновселенная Marvel"
    ]
  },
  {
    "name": "Дорогая, я уменьшил детей",
    "url": "https://en.wikipedia.org/wiki/Honey%2C_I_Shrunk_the_Kids_%28franchise%29",
    "note": "",
    "members": [
      {
        "path": "Кино/Дорогая, я уменьшил детей.md",
        "name": "Дорогая, я уменьшил детей",
        "title": "Honey, I Shrunk the Kids",
        "imdb": "tt0097523"
      },
      {
        "path": "Кино/Дорогая, я увеличил ребенка.md",
        "name": "Дорогая, я увеличил ребенка",
        "title": "Honey, I Blew Up the Kid",
        "imdb": "tt0104437"
      },
      {
        "path": "Кино/Дорогая, мы себя уменьшили.md",
        "name": "Дорогая, мы себя уменьшили",
        "title": "Honey, We Shrunk Ourselves!",
        "imdb": "tt0119310"
      }
    ]
  },
  {
    "name": "Дорожное приключение",
    "url": "https://en.wikipedia.org/wiki/Road_Trip%3A_Beer_Pong",
    "note": "",
    "members": [
      {
        "path": "Кино/Дорожное приключение.md",
        "name": "Дорожное приключение",
        "title": "Road Trip",
        "imdb": "tt0215129"
      },
      {
        "path": "Кино/Дорожное приключение 2.md",
        "name": "Дорожное приключение 2",
        "title": "Road Trip: Beer Pong",
        "imdb": "tt1319733"
      }
    ]
  },
  {
    "name": "Открытое море",
    "url": "https://en.wikipedia.org/wiki/Open_Water_%28film_series%29",
    "note": "«Дрейф» выпущен как Open Water 2, хотя истории и персонажи самостоятельны.",
    "members": [
      {
        "path": "Кино/Открытое море.md",
        "name": "Открытое море",
        "title": "Open Water",
        "imdb": "tt0374102"
      },
      {
        "path": "Кино/Дрейф.md",
        "name": "Дрейф",
        "title": "Open Water 2: Adrift",
        "imdb": "tt0470055"
      }
    ]
  },
  {
    "name": "Дрянные девчонки",
    "url": "https://en.wikipedia.org/wiki/Mean_Girls_%28franchise%29",
    "note": "",
    "members": [
      {
        "path": "Кино/Дрянные девчонки.md",
        "name": "Дрянные девчонки",
        "title": "Mean Girls",
        "imdb": "tt0377092"
      },
      {
        "path": "Кино/Дрянные девчонки 2.md",
        "name": "Дрянные девчонки 2",
        "title": "Mean Girls 2",
        "imdb": "tt1679235"
      }
    ]
  },
  {
    "name": "Духless",
    "url": "https://en.wikipedia.org/wiki/Soulless_2",
    "note": "",
    "members": [
      {
        "path": "Кино/Духless.md",
        "name": "Духless",
        "title": "Духless",
        "imdb": "tt1826660"
      }
    ]
  },
  {
    "name": "Дэдвуд",
    "url": "https://en.wikipedia.org/wiki/Deadwood%3A_The_Movie",
    "note": "",
    "members": [
      {
        "path": "Кино/Дэдвуд.md",
        "name": "Дэдвуд",
        "title": "Deadwood",
        "imdb": "tt0348914"
      }
    ]
  },
  {
    "name": "Дэдпул",
    "url": "https://en.wikipedia.org/wiki/Deadpool_%28film_series%29",
    "note": "Первые фильмы связаны с «Людьми Икс» Fox; «Дэдпул и Росомаха» также относится к MCU.",
    "members": [
      {
        "path": "Кино/Дэдпул.md",
        "name": "Дэдпул",
        "title": "Deadpool",
        "imdb": "tt1431045"
      },
      {
        "path": "Кино/Дэдпул 2.md",
        "name": "Дэдпул 2",
        "title": "Deadpool 2",
        "imdb": "tt5463162"
      },
      {
        "path": "Кино/Дэдпул и Росомаха.md",
        "name": "Дэдпул и Росомаха",
        "title": "Deadpool & Wolverine",
        "imdb": "tt6263850"
      }
    ],
    "related": [
      "Киновселенная Marvel",
      "Люди Икс"
    ]
  },
  {
    "name": "Каникулы Гризволдов",
    "url": "https://en.wikipedia.org/wiki/National_Lampoon%27s_Vacation_%28film_series%29",
    "note": "",
    "members": [
      {
        "path": "Кино/Каникулы.md",
        "name": "Каникулы",
        "title": "National Lampoon's Vacation",
        "imdb": "tt0085995"
      },
      {
        "path": "Кино/Европейские каникулы.md",
        "name": "Европейские каникулы",
        "title": "National Lampoon's European Vacation",
        "imdb": "tt0089670"
      },
      {
        "path": "Кино/Рождественские каникулы.md",
        "name": "Рождественские каникулы",
        "title": "National Lampoon's Christmas Vacation",
        "imdb": "tt0097958"
      },
      {
        "path": "Кино/Каникулы в Вегасе.md",
        "name": "Каникулы в Вегасе",
        "title": "Vegas Vacation",
        "imdb": "tt0120434"
      },
      {
        "path": "Кино/Рождественские каникулы 2 - Приключения кузена Эдди на необитаемом острове.md",
        "name": "Рождественские каникулы 2 - Приключения кузена Эдди на необитаемом острове",
        "title": "Christmas Vacation 2: Cousin Eddie's Island Adventure",
        "imdb": "tt0367623"
      },
      {
        "path": "Кино/Каникулы (2015).md",
        "name": "Каникулы (2015)",
        "title": "Vacation",
        "imdb": "tt1524930"
      }
    ]
  },
  {
    "name": "Железное небо",
    "url": "https://en.wikipedia.org/wiki/Iron_Sky%3A_The_Coming_Race",
    "note": "",
    "members": [
      {
        "path": "Кино/Железное небо.md",
        "name": "Железное небо",
        "title": "Iron Sky",
        "imdb": "tt1034314"
      }
    ]
  },
  {
    "name": "Железный человек",
    "url": "https://en.wikipedia.org/wiki/Iron_Man_%28film_series%29",
    "note": "",
    "members": [
      {
        "path": "Кино/Железный человек.md",
        "name": "Железный человек",
        "title": "Iron Man",
        "imdb": "tt0371746"
      },
      {
        "path": "Кино/Железный человек 2.md",
        "name": "Железный человек 2",
        "title": "Iron Man 2",
        "imdb": "tt1228705"
      },
      {
        "path": "Кино/Железный человек 3.md",
        "name": "Железный человек 3",
        "title": "Iron Man 3",
        "imdb": "tt1300854"
      }
    ],
    "related": [
      "Киновселенная Marvel"
    ]
  },
  {
    "name": "Роман с камнем",
    "url": "https://en.wikipedia.org/wiki/The_Jewel_of_the_Nile",
    "note": "",
    "members": [
      {
        "path": "Кино/Роман с камнем.md",
        "name": "Роман с камнем",
        "title": "Romancing the Stone",
        "imdb": "tt0088011"
      },
      {
        "path": "Кино/Жемчужина Нила.md",
        "name": "Жемчужина Нила",
        "title": "The Jewel of the Nile",
        "imdb": "tt0089370"
      }
    ]
  },
  {
    "name": "Джеймс Бонд",
    "url": "https://en.wikipedia.org/wiki/List_of_James_Bond_films",
    "note": "Представлены не все фильмы; номера из присутствующих карточек не вычисляются.",
    "members": [
      {
        "path": "Кино/Из России с любовью.md",
        "name": "Из России с любовью",
        "title": "From Russia with Love",
        "imdb": "tt0057076"
      },
      {
        "path": "Кино/Человек с золотым пистолетом.md",
        "name": "Человек с золотым пистолетом",
        "title": "The Man with the Golden Gun",
        "imdb": "tt0071807"
      },
      {
        "path": "Кино/Лицензия на убийство.md",
        "name": "Лицензия на убийство",
        "title": "Licence to Kill",
        "imdb": "tt0097742"
      },
      {
        "path": "Кино/Золотой глаз.md",
        "name": "Золотой глаз",
        "title": "GoldenEye",
        "imdb": "tt0113189"
      },
      {
        "path": "Кино/Завтра не умрет никогда.md",
        "name": "Завтра не умрет никогда",
        "title": "Tomorrow Never Dies",
        "imdb": "tt0120347"
      },
      {
        "path": "Кино/И целого мира мало.md",
        "name": "И целого мира мало",
        "title": "The World Is Not Enough",
        "imdb": "tt0143145"
      },
      {
        "path": "Кино/Умри, но не сейчас.md",
        "name": "Умри, но не сейчас",
        "title": "Die Another Day",
        "imdb": "tt0246460"
      },
      {
        "path": "Кино/Казино Рояль.md",
        "name": "Казино Рояль",
        "title": "Casino Royale",
        "imdb": "tt0381061"
      },
      {
        "path": "Кино/Квант милосердия.md",
        "name": "Квант милосердия",
        "title": "Quantum of Solace",
        "imdb": "tt0830515"
      },
      {
        "path": "Кино/Координаты 'Скайфолл'.md",
        "name": "Координаты 'Скайфолл'",
        "title": "Skyfall",
        "imdb": "tt1074638"
      },
      {
        "path": "Кино/СПЕКТР.md",
        "name": "СПЕКТР",
        "title": "Spectre",
        "imdb": "tt2379713"
      },
      {
        "path": "Кино/Не время умирать.md",
        "name": "Не время умирать",
        "title": "No Time to Die",
        "imdb": "tt2382320"
      }
    ]
  },
  {
    "name": "Заложница",
    "url": "https://en.wikipedia.org/wiki/Taken_%28franchise%29",
    "note": "",
    "members": [
      {
        "path": "Кино/Заложница.md",
        "name": "Заложница",
        "title": "Taken",
        "imdb": "tt0815138"
      },
      {
        "path": "Кино/Заложница 2.md",
        "name": "Заложница 2",
        "title": "Taken 2",
        "imdb": "tt1397280"
      },
      {
        "path": "Кино/Заложница 3.md",
        "name": "Заложница 3",
        "title": "Taken 3",
        "imdb": "tt2446042"
      }
    ]
  },
  {
    "name": "Затерянные в космосе",
    "url": "https://en.wikipedia.org/wiki/Lost_in_Space_%282018_TV_series%29",
    "note": "",
    "members": [
      {
        "path": "Кино/Затерянные в космосе.md",
        "name": "Затерянные в космосе",
        "title": "Lost in Space",
        "imdb": "tt5232792"
      }
    ]
  },
  {
    "name": "Затерянный мир — Land of the Lost",
    "url": "https://en.wikipedia.org/wiki/Land_of_the_Lost_%28film%29",
    "note": "",
    "members": [
      {
        "path": "Кино/Затерянный мир.md",
        "name": "Затерянный мир",
        "title": "Land of the Lost",
        "imdb": "tt0457400"
      }
    ]
  },
  {
    "name": "Захочу и соскочу",
    "url": "https://en.wikipedia.org/wiki/I_Can_Quit_Whenever_I_Want",
    "note": "",
    "members": [
      {
        "path": "Кино/Захочу и соскочу.md",
        "name": "Захочу и соскочу",
        "title": "Smetto quando voglio",
        "imdb": "tt3438354"
      },
      {
        "path": "Кино/Захочу и соскочу - Мастер-класс.md",
        "name": "Захочу и соскочу - Мастер-класс",
        "title": "Smetto quando voglio: Masterclass",
        "imdb": "tt5897288"
      },
      {
        "path": "Кино/Захочу и соскочу - Супергерои.md",
        "name": "Захочу и соскочу - Супергерои",
        "title": "Smetto quando voglio: Ad honorem",
        "imdb": "tt5897292"
      }
    ]
  },
  {
    "name": "Зачётный препод",
    "url": "https://en.wikipedia.org/wiki/Fack_ju_G%C3%B6hte",
    "note": "",
    "members": [
      {
        "path": "Кино/Зачётный препод.md",
        "name": "Зачётный препод",
        "title": "Fack ju Göhte",
        "imdb": "tt2987732"
      },
      {
        "path": "Кино/Зачётный препод 2.md",
        "name": "Зачётный препод 2",
        "title": "Fack ju Göhte 2",
        "imdb": "tt3702996"
      },
      {
        "path": "Кино/Зачётный препод 3.md",
        "name": "Зачётный препод 3",
        "title": "Fack ju Göhte 3",
        "imdb": "tt6471264"
      }
    ]
  },
  {
    "name": "Звёздные врата",
    "url": "https://en.wikipedia.org/wiki/Stargate",
    "note": "",
    "members": [
      {
        "path": "Кино/Звездные врата.md",
        "name": "Звездные врата",
        "title": "Stargate",
        "imdb": "tt0111282"
      },
      {
        "path": "Кино/Звездные врата - ЗВ-1.md",
        "name": "Звездные врата - ЗВ-1",
        "title": "Stargate SG-1",
        "imdb": "tt0118480"
      },
      {
        "path": "Кино/Звездные врата - Атлантида.md",
        "name": "Звездные врата - Атлантида",
        "title": "Stargate: Atlantis",
        "imdb": "tt0374455"
      },
      {
        "path": "Кино/Звездные врата - Ковчег Истины.md",
        "name": "Звездные врата - Ковчег Истины",
        "title": "Stargate: The Ark of Truth",
        "imdb": "tt0942903"
      },
      {
        "path": "Кино/Звездные врата - Континуум.md",
        "name": "Звездные врата - Континуум",
        "title": "Stargate: Continuum",
        "imdb": "tt0929629"
      },
      {
        "path": "Кино/Звездные врата - Вселенная.md",
        "name": "Звездные врата - Вселенная",
        "title": "Stargate Universe",
        "imdb": "tt1286039"
      },
      {
        "path": "Кино/Звездные врата - Начало.md",
        "name": "Звездные врата - Начало",
        "title": "Stargate Origins",
        "imdb": "tt7161862"
      }
    ]
  },
  {
    "name": "Зверополис",
    "url": "https://en.wikipedia.org/wiki/Zootopia_%28franchise%29",
    "note": "",
    "members": [
      {
        "path": "Кино/Зверополис.md",
        "name": "Зверополис",
        "title": "Zootopia",
        "imdb": "tt2948356"
      }
    ]
  },
  {
    "name": "Звонок",
    "url": "https://en.wikipedia.org/wiki/The_Ring_%28franchise%29",
    "note": "",
    "members": [
      {
        "path": "Кино/Звонки.md",
        "name": "Звонки",
        "title": "Rings",
        "imdb": "tt0498381"
      }
    ]
  },
  {
    "name": "Звёздный десант",
    "url": "https://en.wikipedia.org/wiki/Starship_Troopers_%28franchise%29",
    "note": "",
    "members": [
      {
        "path": "Кино/Звёздный десант.md",
        "name": "Звёздный десант",
        "title": "Starship Troopers",
        "imdb": "tt0120201"
      }
    ]
  },
  {
    "name": "Знакомство с родителями",
    "url": "https://en.wikipedia.org/wiki/Meet_the_Parents_%28film_series%29",
    "note": "",
    "members": [
      {
        "path": "Кино/Знакомство с родителями.md",
        "name": "Знакомство с родителями",
        "title": "Meet the Parents",
        "imdb": "tt0212338"
      },
      {
        "path": "Кино/Знакомство с Факерами.md",
        "name": "Знакомство с Факерами",
        "title": "Meet the Fockers",
        "imdb": "tt0290002"
      },
      {
        "path": "Кино/Знакомство с Факерами 2.md",
        "name": "Знакомство с Факерами 2",
        "title": "Little Fockers",
        "imdb": "tt0970866"
      }
    ]
  },
  {
    "name": "Зубастики",
    "url": "https://en.wikipedia.org/wiki/Critters_%28franchise%29",
    "note": "",
    "members": [
      {
        "path": "Кино/Зубастики.md",
        "name": "Зубастики",
        "title": "Critters",
        "imdb": "tt0090887"
      },
      {
        "path": "Кино/Зубастики 2 - Главное блюдо.md",
        "name": "Зубастики 2 - Главное блюдо",
        "title": "Critters 2",
        "imdb": "tt0094919"
      },
      {
        "path": "Кино/Зубастики 3.md",
        "name": "Зубастики 3",
        "title": "Critters 3",
        "imdb": "tt0101627"
      }
    ]
  },
  {
    "name": "Зубная фея",
    "url": "https://en.wikipedia.org/wiki/Tooth_Fairy_2",
    "note": "",
    "members": [
      {
        "path": "Кино/Зубная фея.md",
        "name": "Зубная фея",
        "title": "Tooth Fairy",
        "imdb": "tt0808510"
      },
      {
        "path": "Кино/Зубная фея 2.md",
        "name": "Зубная фея 2",
        "title": "Tooth Fairy 2",
        "imdb": "tt1935929"
      }
    ]
  },
  {
    "name": "Иллюзия обмана",
    "url": "https://en.wikipedia.org/wiki/Now_You_See_Me_%28film_series%29",
    "note": "",
    "members": [
      {
        "path": "Кино/Иллюзия обмана.md",
        "name": "Иллюзия обмана",
        "title": "Now You See Me",
        "imdb": "tt1670345"
      },
      {
        "path": "Кино/Иллюзия обмана 2.md",
        "name": "Иллюзия обмана 2",
        "title": "Now You See Me 2",
        "imdb": "tt3110958"
      },
      {
        "path": "Кино/Иллюзия обмана 3.md",
        "name": "Иллюзия обмана 3",
        "title": "Now You See Me: Now You Don't",
        "imdb": "tt4712810"
      }
    ]
  },
  {
    "name": "Индиана Джонс",
    "url": "https://en.wikipedia.org/wiki/Indiana_Jones",
    "note": "",
    "members": [
      {
        "path": "Кино/Индиана Джонс - В поисках утраченного ковчега.md",
        "name": "Индиана Джонс - В поисках утраченного ковчега",
        "title": "Raiders of the Lost Ark",
        "imdb": "tt0082971"
      },
      {
        "path": "Кино/Индиана Джонс и храм судьбы.md",
        "name": "Индиана Джонс и храм судьбы",
        "title": "Indiana Jones and the Temple of Doom",
        "imdb": "tt0087469"
      },
      {
        "path": "Кино/Индиана Джонс и последний крестовый поход.md",
        "name": "Индиана Джонс и последний крестовый поход",
        "title": "Indiana Jones and the Last Crusade",
        "imdb": "tt0097576"
      },
      {
        "path": "Кино/Индиана Джонс и Королевство хрустального черепа.md",
        "name": "Индиана Джонс и Королевство хрустального черепа",
        "title": "Indiana Jones and the Kingdom of the Crystal Skull",
        "imdb": "tt0367882"
      },
      {
        "path": "Кино/Индиана Джонс и колесо судьбы.md",
        "name": "Индиана Джонс и колесо судьбы",
        "title": "Indiana Jones and the Dial of Destiny",
        "imdb": "tt1462764"
      }
    ]
  },
  {
    "name": "Ирония судьбы",
    "url": "https://en.wikipedia.org/wiki/The_Irony_of_Fate_2",
    "note": "Пародии и свободные ремейки не добавлены автоматически.",
    "members": [
      {
        "path": "Кино/Ирония судьбы. Продолжение.md",
        "name": "Ирония судьбы. Продолжение",
        "title": "Ирония судьбы. Продолжение",
        "imdb": "tt0987918"
      }
    ]
  },
  {
    "name": "Капитан Марвел",
    "url": "https://en.wikipedia.org/wiki/The_Marvels",
    "note": "",
    "members": [
      {
        "path": "Кино/Капитан Марвел.md",
        "name": "Капитан Марвел",
        "title": "Captain Marvel",
        "imdb": "tt4154664"
      }
    ],
    "related": [
      "Киновселенная Marvel"
    ]
  },
  {
    "name": "Карате-пацан и Кобра Кай",
    "url": "https://en.wikipedia.org/wiki/The_Karate_Kid_%28franchise%29",
    "note": "Разные ветви общей франшизы; фильм 2010 года не приквел сериала «Кобра Кай».",
    "members": [
      {
        "path": "Кино/Каратэ-пацан.md",
        "name": "Каратэ-пацан",
        "title": "The Karate Kid",
        "imdb": "tt1155076"
      },
      {
        "path": "Кино/Кобра Кай.md",
        "name": "Кобра Кай",
        "title": "Cobra Kai",
        "imdb": "tt7221388"
      }
    ]
  },
  {
    "name": "Квантовый скачок",
    "url": "https://en.wikipedia.org/wiki/Quantum_Leap_%282022_TV_series%29",
    "note": "",
    "members": [
      {
        "path": "Кино/Квантовый скачок (1989).md",
        "name": "Квантовый скачок (1989)",
        "title": "Quantum Leap",
        "imdb": "tt0096684"
      },
      {
        "path": "Кино/Квантовый скачок.md",
        "name": "Квантовый скачок",
        "title": "Quantum Leap",
        "imdb": "tt17043230"
      }
    ]
  },
  {
    "name": "Кладбище домашних животных",
    "url": "https://en.wikipedia.org/wiki/Pet_Sematary%3A_Bloodlines",
    "note": "",
    "members": [
      {
        "path": "Кино/Кладбище домашних животных.md",
        "name": "Кладбище домашних животных",
        "title": "Pet Sematary",
        "imdb": "tt0837563"
      }
    ]
  },
  {
    "name": "Космос",
    "url": "https://en.wikipedia.org/wiki/Cosmos%3A_A_Spacetime_Odyssey",
    "note": "",
    "members": [
      {
        "path": "Кино/Космос - Пространство и время.md",
        "name": "Космос - Пространство и время",
        "title": "Cosmos: A Spacetime Odyssey",
        "imdb": "tt2395695"
      }
    ]
  },
  {
    "name": "Шрек и Кот в сапогах",
    "url": "https://en.wikipedia.org/wiki/Shrek_%28franchise%29",
    "note": "",
    "members": [
      {
        "path": "Кино/Шрек.md",
        "name": "Шрек",
        "title": "Shrek",
        "imdb": "tt0126029"
      },
      {
        "path": "Кино/Шрэк 2.md",
        "name": "Шрэк 2",
        "title": "Shrek 2",
        "imdb": "tt0298148"
      },
      {
        "path": "Кино/Шрэк Третий.md",
        "name": "Шрэк Третий",
        "title": "Shrek the Third",
        "imdb": "tt0413267"
      },
      {
        "path": "Кино/Шрэк навсегда.md",
        "name": "Шрэк навсегда",
        "title": "Shrek Forever After",
        "imdb": "tt0892791"
      },
      {
        "path": "Кино/Кот в сапогах.md",
        "name": "Кот в сапогах",
        "title": "Puss in Boots",
        "imdb": "tt0448694"
      },
      {
        "path": "Кино/Кот в сапогах - Последнее желание.md",
        "name": "Кот в сапогах - Последнее желание",
        "title": "Puss in Boots: The Last Wish",
        "imdb": "tt3915174"
      }
    ],
    "aliases": [
      "Шрек"
    ]
  },
  {
    "name": "Куб",
    "url": "https://en.wikipedia.org/wiki/Cube_%28film_series%29",
    "note": "",
    "members": [
      {
        "path": "Кино/Куб.md",
        "name": "Куб",
        "title": "Cube",
        "imdb": "tt0123755"
      },
      {
        "path": "Кино/Куб 2 - Гиперкуб.md",
        "name": "Куб 2 - Гиперкуб",
        "title": "Cube 2: Hypercube",
        "imdb": "tt0285492"
      },
      {
        "path": "Кино/Куб Зеро.md",
        "name": "Куб Зеро",
        "title": "Cube Zero",
        "imdb": "tt0377713"
      }
    ]
  },
  {
    "name": "Кухня",
    "url": "https://ru.wikipedia.org/wiki/%D0%9A%D1%83%D1%85%D0%BD%D1%8F_%28%D1%82%D0%B5%D0%BB%D0%B5%D1%81%D0%B5%D1%80%D0%B8%D0%B0%D0%BB%29",
    "note": "Британский сериал Whites («Кухня», 2010) сюда не относится.",
    "members": [
      {
        "path": "Кино/Кухня.md",
        "name": "Кухня",
        "title": "Кухня",
        "imdb": "tt2930610"
      },
      {
        "path": "Кино/Кухня. Последняя битва.md",
        "name": "Кухня. Последняя битва",
        "title": "Кухня. Последняя битва",
        "imdb": "tt6841500"
      }
    ]
  },
  {
    "name": "Ледниковый период",
    "url": "https://en.wikipedia.org/wiki/Ice_Age_%28franchise%29",
    "note": "",
    "members": [
      {
        "path": "Кино/Ледниковый период.md",
        "name": "Ледниковый период",
        "title": "Ice Age",
        "imdb": "tt0268380"
      },
      {
        "path": "Кино/Ледниковый период 2 - Глобальное потепление.md",
        "name": "Ледниковый период 2 - Глобальное потепление",
        "title": "Ice Age: The Meltdown",
        "imdb": "tt0438097"
      },
      {
        "path": "Кино/Ледниковый период 3 - Эра динозавров.md",
        "name": "Ледниковый период 3 - Эра динозавров",
        "title": "Ice Age: Dawn of the Dinosaurs",
        "imdb": "tt1080016"
      },
      {
        "path": "Кино/Ледниковый период 4 - Континентальный дрейф.md",
        "name": "Ледниковый период 4 - Континентальный дрейф",
        "title": "Ice Age: Continental Drift",
        "imdb": "tt1667889"
      },
      {
        "path": "Кино/Ледниковый период - Столкновение неизбежно.md",
        "name": "Ледниковый период - Столкновение неизбежно",
        "title": "Ice Age: Collision Course",
        "imdb": "tt3416828"
      },
      {
        "path": "Кино/Ледниковый период - Приключения Бака.md",
        "name": "Ледниковый период - Приключения Бака",
        "title": "The Ice Age Adventures of Buck Wild",
        "imdb": "tt13634480"
      }
    ]
  },
  {
    "name": "Ледяной драйв",
    "url": "https://en.wikipedia.org/wiki/Ice_Road%3A_Vengeance",
    "note": "",
    "members": [
      {
        "path": "Кино/Ледяной драйв.md",
        "name": "Ледяной драйв",
        "title": "The Ice Road",
        "imdb": "tt3758814"
      }
    ]
  },
  {
    "name": "Люди Икс",
    "url": "https://en.wikipedia.org/wiki/X-Men_%28film_series%29",
    "note": "Включены фильмы о Росомахе. Дэдпул — на отдельной связанной странице.",
    "members": [
      {
        "path": "Кино/Люди Икс.md",
        "name": "Люди Икс",
        "title": "X-Men",
        "imdb": "tt0120903"
      },
      {
        "path": "Кино/Люди Икс 2.md",
        "name": "Люди Икс 2",
        "title": "X2",
        "imdb": "tt0290334"
      },
      {
        "path": "Кино/Люди Икс - Последняя битва.md",
        "name": "Люди Икс - Последняя битва",
        "title": "X-Men: The Last Stand",
        "imdb": "tt0376994"
      },
      {
        "path": "Кино/Люди Икс - Начало. Росомаха.md",
        "name": "Люди Икс - Начало. Росомаха",
        "title": "X-Men Origins: Wolverine",
        "imdb": "tt0458525"
      },
      {
        "path": "Кино/Люди Икс - Первый класс.md",
        "name": "Люди Икс - Первый класс",
        "title": "X-Men: First Class",
        "imdb": "tt1270798"
      },
      {
        "path": "Кино/Росомаха - Бессмертный.md",
        "name": "Росомаха - Бессмертный",
        "title": "The Wolverine",
        "imdb": "tt1430132"
      },
      {
        "path": "Кино/Люди Икс - Дни минувшего будущего.md",
        "name": "Люди Икс - Дни минувшего будущего",
        "title": "X-Men: Days of Future Past",
        "imdb": "tt1877832"
      },
      {
        "path": "Кино/Люди Икс - Апокалипсис.md",
        "name": "Люди Икс - Апокалипсис",
        "title": "X-Men: Apocalypse",
        "imdb": "tt3385516"
      },
      {
        "path": "Кино/Логан.md",
        "name": "Логан",
        "title": "Logan",
        "imdb": "tt3315342"
      },
      {
        "path": "Кино/Люди Икс - Тёмный Феникс.md",
        "name": "Люди Икс - Тёмный Феникс",
        "title": "X-Men: Dark Phoenix",
        "imdb": "tt6565702"
      }
    ],
    "related": [
      "Дэдпул"
    ]
  },
  {
    "name": "Любить по-русски",
    "url": "https://ru.wikipedia.org/wiki/%D0%9B%D1%8E%D0%B1%D0%B8%D1%82%D1%8C_%D0%BF%D0%BE-%D1%80%D1%83%D1%81%D1%81%D0%BA%D0%B8",
    "note": "",
    "members": [
      {
        "path": "Кино/Любить по-русски.md",
        "name": "Любить по-русски",
        "title": "Любить по-русски",
        "imdb": "tt0178725"
      },
      {
        "path": "Кино/Любить по-русски 2.md",
        "name": "Любить по-русски 2",
        "title": "Любить по-русски 2",
        "imdb": "tt0127011"
      },
      {
        "path": "Кино/Любить по-русски 3 - Губернатор.md",
        "name": "Любить по-русски 3 - Губернатор",
        "title": "Любить по-русски 3: Губернатор",
        "imdb": "tt0415952"
      }
    ]
  },
  {
    "name": "Люди в чёрном",
    "url": "https://en.wikipedia.org/wiki/Men_in_Black_%28film_series%29",
    "note": "",
    "members": [
      {
        "path": "Кино/Люди в чёрном.md",
        "name": "Люди в чёрном",
        "title": "Men in Black",
        "imdb": "tt0119654"
      },
      {
        "path": "Кино/Люди в чёрном 2.md",
        "name": "Люди в чёрном 2",
        "title": "Men in Black II",
        "imdb": "tt0120912"
      },
      {
        "path": "Кино/Люди в чёрном 3.md",
        "name": "Люди в чёрном 3",
        "title": "Men in Black³",
        "imdb": "tt1409024"
      },
      {
        "path": "Кино/Люди в черном - Интернэшнл.md",
        "name": "Люди в черном - Интернэшнл",
        "title": "Men in Black International",
        "imdb": "tt2283336"
      }
    ]
  },
  {
    "name": "Мадагаскар",
    "url": "https://en.wikipedia.org/wiki/Madagascar_%28franchise%29",
    "note": "",
    "members": [
      {
        "path": "Кино/Мадагаскар.md",
        "name": "Мадагаскар",
        "title": "Madagascar",
        "imdb": "tt0351283"
      },
      {
        "path": "Кино/Мадагаскар 2.md",
        "name": "Мадагаскар 2",
        "title": "Madagascar: Escape 2 Africa",
        "imdb": "tt0479952"
      },
      {
        "path": "Кино/Мадагаскар 3.md",
        "name": "Мадагаскар 3",
        "title": "Madagascar 3: Europe's Most Wanted",
        "imdb": "tt1277953"
      },
      {
        "path": "Кино/Пингвины Мадагаскара.md",
        "name": "Пингвины Мадагаскара",
        "title": "Penguins of Madagascar",
        "imdb": "tt1911658"
      }
    ]
  },
  {
    "name": "Малефисента",
    "url": "https://en.wikipedia.org/wiki/Maleficent%3A_Mistress_of_Evil",
    "note": "",
    "members": [
      {
        "path": "Кино/Малефисента.md",
        "name": "Малефисента",
        "title": "Maleficent",
        "imdb": "tt1587310"
      }
    ]
  },
  {
    "name": "Мальчишник",
    "url": "https://en.wikipedia.org/wiki/The_Hangover_%28film_series%29",
    "note": "«Мальчишник в Паттайе» не относится к этой серии.",
    "members": [
      {
        "path": "Кино/Мальчишник 2 - Из Вегаса в Бангкок.md",
        "name": "Мальчишник 2 - Из Вегаса в Бангкок",
        "title": "The Hangover Part II",
        "imdb": "tt1411697"
      },
      {
        "path": "Кино/Мальчишник - Часть III.md",
        "name": "Мальчишник - Часть III",
        "title": "The Hangover Part III",
        "imdb": "tt1951261"
      }
    ],
    "aliases": [
      "Мальчишник в Вегасе"
    ]
  },
  {
    "name": "Матрица",
    "url": "https://en.wikipedia.org/wiki/The_Matrix_%28franchise%29",
    "note": "",
    "members": [
      {
        "path": "Кино/Матрица.md",
        "name": "Матрица",
        "title": "The Matrix",
        "imdb": "tt0133093"
      },
      {
        "path": "Кино/Матрица - Перезагрузка.md",
        "name": "Матрица - Перезагрузка",
        "title": "The Matrix Reloaded",
        "imdb": "tt0234215"
      },
      {
        "path": "Кино/Матрица - Революция.md",
        "name": "Матрица - Революция",
        "title": "The Matrix Revolutions",
        "imdb": "tt0242653"
      },
      {
        "path": "Кино/Матрица - Воскрешение.md",
        "name": "Матрица - Воскрешение",
        "title": "The Matrix: Resurrections",
        "imdb": "tt10838180"
      }
    ]
  },
  {
    "name": "Мачете",
    "url": "https://en.wikipedia.org/wiki/Machete_Kills",
    "note": "Связан с «Детьми шпионов» персонажем Мачете, но выделен в собственную серию.",
    "members": [
      {
        "path": "Кино/Мачете.md",
        "name": "Мачете",
        "title": "Machete",
        "imdb": "tt0985694"
      },
      {
        "path": "Кино/Мачете убивает.md",
        "name": "Мачете убивает",
        "title": "Machete Kills",
        "imdb": "tt2002718"
      }
    ],
    "related": [
      "Дети шпионов"
    ]
  },
  {
    "name": "Мачо и ботан",
    "url": "https://en.wikipedia.org/wiki/Jump_Street_%28franchise%29",
    "note": "",
    "members": [
      {
        "path": "Кино/Мачо и ботан.md",
        "name": "Мачо и ботан",
        "title": "21 Jump Street",
        "imdb": "tt1232829"
      },
      {
        "path": "Кино/Мачо и ботан 2.md",
        "name": "Мачо и ботан 2",
        "title": "22 Jump Street",
        "imdb": "tt2294449"
      }
    ]
  },
  {
    "name": "Мег",
    "url": "https://en.wikipedia.org/wiki/Meg_2%3A_The_Trench",
    "note": "",
    "members": [
      {
        "path": "Кино/Мег - Монстр глубины.md",
        "name": "Мег - Монстр глубины",
        "title": "The Meg",
        "imdb": "tt4779682"
      },
      {
        "path": "Кино/Мег 2 - Бездна.md",
        "name": "Мег 2 - Бездна",
        "title": "Meg 2: The Trench",
        "imdb": "tt9224104"
      }
    ]
  },
  {
    "name": "Механик",
    "url": "https://en.wikipedia.org/wiki/Mechanic%3A_Resurrection",
    "note": "",
    "members": [
      {
        "path": "Кино/Механик - Воскрешение.md",
        "name": "Механик - Воскрешение",
        "title": "Mechanic: Resurrection",
        "imdb": "tt3522806"
      }
    ]
  },
  {
    "name": "Парк и Мир Юрского периода",
    "url": "https://en.wikipedia.org/wiki/Jurassic_Park",
    "note": "",
    "members": [
      {
        "path": "Кино/Мир Юрского периода.md",
        "name": "Мир Юрского периода",
        "title": "Jurassic World",
        "imdb": "tt0369610"
      },
      {
        "path": "Кино/Мир юрского периода 2.md",
        "name": "Мир юрского периода 2",
        "title": "Jurassic World: Fallen Kingdom",
        "imdb": "tt4881806"
      },
      {
        "path": "Кино/Мир Юрского периода - Господство.md",
        "name": "Мир Юрского периода - Господство",
        "title": "Jurassic World: Dominion",
        "imdb": "tt8041270"
      }
    ],
    "aliases": [
      "Парк Юрского периода",
      "Юрский период"
    ]
  },
  {
    "name": "Миссия невыполнима",
    "url": "https://en.wikipedia.org/wiki/Mission%3A_Impossible_%28film_series%29",
    "note": "",
    "members": [
      {
        "path": "Кино/Миссия невыполнима.md",
        "name": "Миссия невыполнима",
        "title": "Mission: Impossible",
        "imdb": "tt0117060"
      },
      {
        "path": "Кино/Миссия невыполнима 2.md",
        "name": "Миссия невыполнима 2",
        "title": "Mission: Impossible II",
        "imdb": "tt0120755"
      },
      {
        "path": "Кино/Миссия невыполнима 3.md",
        "name": "Миссия невыполнима 3",
        "title": "Mission: Impossible III",
        "imdb": "tt0317919"
      },
      {
        "path": "Кино/Миссия невыполнима - Протокол Фантом.md",
        "name": "Миссия невыполнима - Протокол Фантом",
        "title": "Mission: Impossible - Ghost Protocol",
        "imdb": "tt1229238"
      },
      {
        "path": "Кино/Миссия невыполнима - Племя изгоев.md",
        "name": "Миссия невыполнима - Племя изгоев",
        "title": "Mission: Impossible - Rogue Nation",
        "imdb": "tt2381249"
      },
      {
        "path": "Кино/Миссия невыполнима - Последствия.md",
        "name": "Миссия невыполнима - Последствия",
        "title": "Mission: Impossible - Fallout",
        "imdb": "tt4912910"
      }
    ]
  },
  {
    "name": "Совместная поездка",
    "url": "https://en.wikipedia.org/wiki/Ride_Along_2",
    "note": "",
    "members": [
      {
        "path": "Кино/Совместная поездка.md",
        "name": "Совместная поездка",
        "title": "Ride Along",
        "imdb": "tt1408253"
      },
      {
        "path": "Кино/Миссия в Майами.md",
        "name": "Миссия в Майами",
        "title": "Ride Along 2",
        "imdb": "tt2869728"
      }
    ]
  },
  {
    "name": "Могучие рейнджеры",
    "url": "https://en.wikipedia.org/wiki/Power_Rangers_%28film%29",
    "note": "",
    "members": [
      {
        "path": "Кино/Могучие рейнджеры.md",
        "name": "Могучие рейнджеры",
        "title": "Power Rangers",
        "imdb": "tt3717490"
      }
    ]
  },
  {
    "name": "Мстители",
    "url": "https://en.wikipedia.org/wiki/Avengers_%28Marvel_Cinematic_Universe%29",
    "note": "",
    "members": [
      {
        "path": "Кино/Мстители.md",
        "name": "Мстители",
        "title": "The Avengers",
        "imdb": "tt0848228"
      },
      {
        "path": "Кино/Мстители - Эра Альтрона.md",
        "name": "Мстители - Эра Альтрона",
        "title": "Avengers: Age of Ultron",
        "imdb": "tt2395427"
      },
      {
        "path": "Кино/Мстители - Война бесконечности.md",
        "name": "Мстители - Война бесконечности",
        "title": "Avengers: Infinity War",
        "imdb": "tt4154756"
      },
      {
        "path": "Кино/Мстители - Финал.md",
        "name": "Мстители - Финал",
        "title": "Avengers: Endgame",
        "imdb": "tt4154796"
      }
    ],
    "related": [
      "Киновселенная Marvel"
    ]
  },
  {
    "name": "Мы из будущего",
    "url": "https://ru.wikipedia.org/wiki/%D0%9C%D1%8B_%D0%B8%D0%B7_%D0%B1%D1%83%D0%B4%D1%83%D1%89%D0%B5%D0%B3%D0%BE_2",
    "note": "",
    "members": [
      {
        "path": "Кино/Мы из будущего.md",
        "name": "Мы из будущего",
        "title": "Мы из будущего",
        "imdb": "tt30612313"
      },
      {
        "path": "Кино/Мы из будущего 2.md",
        "name": "Мы из будущего 2",
        "title": "Мы из будущего 2",
        "imdb": "tt1590125"
      }
    ]
  },
  {
    "name": "Назад в будущее",
    "url": "https://en.wikipedia.org/wiki/Back_to_the_Future_%28franchise%29",
    "note": "",
    "members": [
      {
        "path": "Кино/Назад в будущее.md",
        "name": "Назад в будущее",
        "title": "Back to the Future",
        "imdb": "tt0088763"
      },
      {
        "path": "Кино/Назад в будущее 2.md",
        "name": "Назад в будущее 2",
        "title": "Back to the Future Part II",
        "imdb": "tt0096874"
      },
      {
        "path": "Кино/Назад в будущее 3.md",
        "name": "Назад в будущее 3",
        "title": "Back to the Future Part III",
        "imdb": "tt0099088"
      }
    ]
  },
  {
    "name": "Напряги извилины",
    "url": "https://en.wikipedia.org/wiki/Get_Smart_%28film%29",
    "note": "",
    "members": [
      {
        "path": "Кино/Напряги извилины.md",
        "name": "Напряги извилины",
        "title": "Get Smart",
        "imdb": "tt0425061"
      }
    ]
  },
  {
    "name": "Нация Z",
    "url": "https://en.wikipedia.org/wiki/Black_Summer_%28TV_series%29",
    "note": "",
    "members": [
      {
        "path": "Кино/Нация Z.md",
        "name": "Нация Z",
        "title": "Z Nation",
        "imdb": "tt3843168"
      }
    ]
  },
  {
    "name": "Не пойман — не вор",
    "url": "https://en.wikipedia.org/wiki/Inside_Man%3A_Most_Wanted",
    "note": "",
    "members": [
      {
        "path": "Кино/Не пойман - не вор.md",
        "name": "Не пойман - не вор",
        "title": "Inside Man",
        "imdb": "tt0454848"
      }
    ]
  },
  {
    "name": "Несносные боссы",
    "url": "https://en.wikipedia.org/wiki/Horrible_Bosses_2",
    "note": "",
    "members": [
      {
        "path": "Кино/Несносные боссы.md",
        "name": "Несносные боссы",
        "title": "Horrible Bosses",
        "imdb": "tt1499658"
      },
      {
        "path": "Кино/Несносные боссы 2.md",
        "name": "Несносные боссы 2",
        "title": "Horrible Bosses 2",
        "imdb": "tt2170439"
      }
    ]
  },
  {
    "name": "Чудаки",
    "url": "https://en.wikipedia.org/wiki/Jackass_%28franchise%29",
    "note": "",
    "members": [
      {
        "path": "Кино/Несносный дед.md",
        "name": "Несносный дед",
        "title": "Bad Grandpa",
        "imdb": "tt3063516"
      }
    ]
  },
  {
    "name": "Несчастный случай",
    "url": "https://en.wikipedia.org/wiki/Accident_Man%3A_Hitman%27s_Holiday",
    "note": "",
    "members": [
      {
        "path": "Кино/Несчастный случай.md",
        "name": "Несчастный случай",
        "title": "Accident Man",
        "imdb": "tt6237612"
      },
      {
        "path": "Кино/Несчастный случай - Каникулы киллера.md",
        "name": "Несчастный случай - Каникулы киллера",
        "title": "Accident Man: Hitman's Holiday",
        "imdb": "tt9669176"
      }
    ]
  },
  {
    "name": "Неудержимые",
    "url": "https://en.wikipedia.org/wiki/The_Expendables_%28franchise%29",
    "note": "Фильм Riders («Неудержимые», 2002) не входит в серию.",
    "members": [
      {
        "path": "Кино/Неудержимые (2010).md",
        "name": "Неудержимые (2010)",
        "title": "The Expendables",
        "imdb": "tt1320253"
      },
      {
        "path": "Кино/Неудержимые 2.md",
        "name": "Неудержимые 2",
        "title": "The Expendables 2",
        "imdb": "tt1764651"
      },
      {
        "path": "Кино/Неудержимые 3.md",
        "name": "Неудержимые 3",
        "title": "The Expendables 3",
        "imdb": "tt2333784"
      },
      {
        "path": "Кино/Неудержимые 4.md",
        "name": "Неудержимые 4",
        "title": "Expend4bles",
        "imdb": "tt3291150"
      }
    ]
  },
  {
    "name": "Сваты",
    "url": "https://ru.wikipedia.org/wiki/%D0%A1%D0%B2%D0%B0%D1%82%D1%8B",
    "note": "",
    "members": [
      {
        "path": "Кино/Сваты.md",
        "name": "Сваты",
        "title": "Сваты",
        "imdb": "tt1820225"
      },
      {
        "path": "Кино/Новогодние сваты.md",
        "name": "Новогодние сваты",
        "title": "Новогодние сваты",
        "imdb": "tt1820565"
      }
    ]
  },
  {
    "name": "Новый Человек-паук",
    "url": "https://en.wikipedia.org/wiki/The_Amazing_Spider-Man_%28film_series%29",
    "note": "Версия с Эндрю Гарфилдом; фильмы с Томом Холландом — отдельная серия.",
    "members": [
      {
        "path": "Кино/Новый Человек-паук.md",
        "name": "Новый Человек-паук",
        "title": "The Amazing Spider-Man",
        "imdb": "tt0948470"
      },
      {
        "path": "Кино/Новый Человек-паук - Высокое напряжение.md",
        "name": "Новый Человек-паук - Высокое напряжение",
        "title": "The Amazing Spider-Man 2",
        "imdb": "tt1872181"
      }
    ],
    "related": [
      "Человек-паук — MCU"
    ]
  },
  {
    "name": "Ночь в музее",
    "url": "https://en.wikipedia.org/wiki/Night_at_the_Museum_%28film_series%29",
    "note": "",
    "members": [
      {
        "path": "Кино/Ночь в музее - Секрет гробницы.md",
        "name": "Ночь в музее - Секрет гробницы",
        "title": "Night at the Museum: Secret of the Tomb",
        "imdb": "tt2692250"
      }
    ]
  },
  {
    "name": "Области тьмы",
    "url": "https://en.wikipedia.org/wiki/Limitless_%28TV_series%29",
    "note": "",
    "members": [
      {
        "path": "Кино/Области тьмы (2011).md",
        "name": "Области тьмы (2011)",
        "title": "Limitless",
        "imdb": "tt1219289"
      },
      {
        "path": "Кино/Области тьмы.md",
        "name": "Области тьмы",
        "title": "Limitless",
        "imdb": "tt4422836"
      }
    ]
  },
  {
    "name": "Один дома",
    "url": "https://en.wikipedia.org/wiki/Home_Alone_%28franchise%29",
    "note": "",
    "members": [
      {
        "path": "Кино/Один дома.md",
        "name": "Один дома",
        "title": "Home Alone",
        "imdb": "tt0099785"
      },
      {
        "path": "Кино/Один дома 2 - Затерянный в Нью-Йорке.md",
        "name": "Один дома 2 - Затерянный в Нью-Йорке",
        "title": "Home Alone 2: Lost in New York",
        "imdb": "tt0104431"
      }
    ]
  },
  {
    "name": "Одноклассники",
    "url": "https://en.wikipedia.org/wiki/Grown_Ups_2",
    "note": "",
    "members": [
      {
        "path": "Кино/Одноклассники.md",
        "name": "Одноклассники",
        "title": "Grown Ups",
        "imdb": "tt1375670"
      },
      {
        "path": "Кино/Одноклассники 2.md",
        "name": "Одноклассники 2",
        "title": "Grown Ups 2",
        "imdb": "tt2191701"
      }
    ]
  },
  {
    "name": "Одноклассницы",
    "url": "https://ru.wikipedia.org/wiki/%D0%9E%D0%B4%D0%BD%D0%BE%D0%BA%D0%BB%D0%B0%D1%81%D1%81%D0%BD%D0%B8%D1%86%D1%8B_%28%D1%84%D0%B8%D0%BB%D1%8C%D0%BC%2C_2016%29",
    "note": "",
    "members": [
      {
        "path": "Кино/Одноклассницы.md",
        "name": "Одноклассницы",
        "title": "Одноклассницы",
        "imdb": "tt5526028"
      }
    ]
  },
  {
    "name": "Оно",
    "url": "https://en.wikipedia.org/wiki/Welcome_to_Derry",
    "note": "",
    "members": [
      {
        "path": "Кино/Оно.md",
        "name": "Оно",
        "title": "It",
        "imdb": "tt1396484"
      },
      {
        "path": "Кино/Оно 2.md",
        "name": "Оно 2",
        "title": "It: Chapter Two",
        "imdb": "tt7349950"
      },
      {
        "path": "Кино/Оно. Добро пожаловать в Дерри.md",
        "name": "Оно. Добро пожаловать в Дерри",
        "title": "IT: Welcome to Derry",
        "imdb": "tt19244304"
      }
    ]
  },
  {
    "name": "Орудия смерти",
    "url": "https://en.wikipedia.org/wiki/The_Mortal_Instruments",
    "note": "",
    "members": [
      {
        "path": "Кино/Орудия смерти - Город костей.md",
        "name": "Орудия смерти - Город костей",
        "title": "The Mortal Instruments: City of Bones",
        "imdb": "tt1538403"
      }
    ]
  },
  {
    "name": "Особое мнение",
    "url": "https://en.wikipedia.org/wiki/Minority_Report_%28TV_series%29",
    "note": "",
    "members": [
      {
        "path": "Кино/Особое мнение (2002).md",
        "name": "Особое мнение (2002)",
        "title": "Minority Report",
        "imdb": "tt0181689"
      },
      {
        "path": "Кино/Особое мнение.md",
        "name": "Особое мнение",
        "title": "Minority Report",
        "imdb": "tt4450826"
      }
    ]
  },
  {
    "name": "Очень страшное кино",
    "url": "https://en.wikipedia.org/wiki/Scary_Movie_%28film_series%29",
    "note": "",
    "members": [
      {
        "path": "Кино/Очень страшное кино.md",
        "name": "Очень страшное кино",
        "title": "Scary Movie",
        "imdb": "tt0175142"
      },
      {
        "path": "Кино/Очень страшное кино 2.md",
        "name": "Очень страшное кино 2",
        "title": "Scary Movie 2",
        "imdb": "tt0257106"
      },
      {
        "path": "Кино/Очень страшное кино 3.md",
        "name": "Очень страшное кино 3",
        "title": "Scary Movie 3",
        "imdb": "tt0306047"
      },
      {
        "path": "Кино/Очень страшное кино 4.md",
        "name": "Очень страшное кино 4",
        "title": "Scary Movie 4",
        "imdb": "tt0362120"
      },
      {
        "path": "Кино/Очень страшное кино 5.md",
        "name": "Очень страшное кино 5",
        "title": "Scary Movie 5",
        "imdb": "tt0795461"
      }
    ]
  },
  {
    "name": "Падение Олимпа",
    "url": "https://en.wikipedia.org/wiki/Has_Fallen",
    "note": "",
    "members": [
      {
        "path": "Кино/Падение Олимпа.md",
        "name": "Падение Олимпа",
        "title": "Olympus Has Fallen",
        "imdb": "tt2302755"
      },
      {
        "path": "Кино/Падение Лондона.md",
        "name": "Падение Лондона",
        "title": "London Has Fallen",
        "imdb": "tt3300542"
      }
    ]
  },
  {
    "name": "Кловерфилд",
    "url": "https://en.wikipedia.org/wiki/Cloverfield_%28franchise%29",
    "note": "",
    "members": [
      {
        "path": "Кино/Парадокс Кловерфилда.md",
        "name": "Парадокс Кловерфилда",
        "title": "The Cloverfield Paradox",
        "imdb": "tt2548396"
      }
    ]
  },
  {
    "name": "Пацаны",
    "url": "https://en.wikipedia.org/wiki/The_Boys_%28franchise%29",
    "note": "",
    "members": [
      {
        "path": "Кино/Пацаны.md",
        "name": "Пацаны",
        "title": "The Boys",
        "imdb": "tt1190634"
      },
      {
        "path": "Кино/Поколение Ви.md",
        "name": "Поколение Ви",
        "title": "Gen V",
        "imdb": "tt13159924"
      }
    ]
  },
  {
    "name": "Первый мститель",
    "url": "https://en.wikipedia.org/wiki/Captain_America_%28film_series%29",
    "note": "",
    "members": [
      {
        "path": "Кино/Первый мститель.md",
        "name": "Первый мститель",
        "title": "Captain America: The First Avenger",
        "imdb": "tt0458339"
      },
      {
        "path": "Кино/Первый мститель - Другая война.md",
        "name": "Первый мститель - Другая война",
        "title": "Captain America: The Winter Soldier",
        "imdb": "tt1843866"
      },
      {
        "path": "Кино/Первый мститель - Противостояние.md",
        "name": "Первый мститель - Противостояние",
        "title": "Captain America: Civil War",
        "imdb": "tt3498820"
      }
    ],
    "related": [
      "Киновселенная Marvel"
    ]
  },
  {
    "name": "Перевозчик",
    "url": "https://en.wikipedia.org/wiki/Transporter_%28franchise%29",
    "note": "",
    "members": [
      {
        "path": "Кино/Перевозчик (2002).md",
        "name": "Перевозчик (2002)",
        "title": "The Transporter",
        "imdb": "tt0293662"
      },
      {
        "path": "Кино/Перевозчик 2.md",
        "name": "Перевозчик 2",
        "title": "Le Transporteur II",
        "imdb": "tt0388482"
      },
      {
        "path": "Кино/Перевозчик 3.md",
        "name": "Перевозчик 3",
        "title": "Transporter 3",
        "imdb": "tt1129442"
      },
      {
        "path": "Кино/Перевозчик.md",
        "name": "Перевозчик",
        "title": "Transporter: The Series",
        "imdb": "tt1885102"
      },
      {
        "path": "Кино/Перевозчик - Наследие.md",
        "name": "Перевозчик - Наследие",
        "title": "The Transporter Refueled",
        "imdb": "tt2938956"
      }
    ]
  },
  {
    "name": "Пипец",
    "url": "https://en.wikipedia.org/wiki/Kick-Ass_2_%28film%29",
    "note": "",
    "members": [
      {
        "path": "Кино/Пипец.md",
        "name": "Пипец",
        "title": "Kick-Ass",
        "imdb": "tt1754738"
      },
      {
        "path": "Кино/Пипец 2.md",
        "name": "Пипец 2",
        "title": "Kick-Ass 2",
        "imdb": "tt1650554"
      }
    ]
  },
  {
    "name": "Пираты Карибского моря",
    "url": "https://en.wikipedia.org/wiki/Pirates_of_the_Caribbean_%28film_series%29",
    "note": "",
    "members": [
      {
        "path": "Кино/Пираты Карибского моря - Проклятие Чёрной жемчужины.md",
        "name": "Пираты Карибского моря - Проклятие Чёрной жемчужины",
        "title": "Pirates of the Caribbean: The Curse of the Black Pearl",
        "imdb": "tt0325980"
      },
      {
        "path": "Кино/Пираты Карибского моря - Сундук мертвеца.md",
        "name": "Пираты Карибского моря - Сундук мертвеца",
        "title": "Pirates of the Caribbean: Dead Man's Chest",
        "imdb": "tt0383574"
      },
      {
        "path": "Кино/Пираты Карибского моря - На краю света.md",
        "name": "Пираты Карибского моря - На краю света",
        "title": "Pirates of the Caribbean: At World's End",
        "imdb": "tt0449088"
      },
      {
        "path": "Кино/Пираты Карибского моря - На странных берегах.md",
        "name": "Пираты Карибского моря - На странных берегах",
        "title": "Pirates of the Caribbean: On Stranger Tides",
        "imdb": "tt1298650"
      },
      {
        "path": "Кино/Пираты Карибского моря - Мертвецы не рассказывают сказки.md",
        "name": "Пираты Карибского моря - Мертвецы не рассказывают сказки",
        "title": "Pirates of the Caribbean: Dead Men Tell No Tales",
        "imdb": "tt1790809"
      }
    ]
  },
  {
    "name": "План побега",
    "url": "https://en.wikipedia.org/wiki/Escape_Plan_%28film_series%29",
    "note": "",
    "members": [
      {
        "path": "Кино/План побега.md",
        "name": "План побега",
        "title": "Escape Plan",
        "imdb": "tt1211956"
      },
      {
        "path": "Кино/План побега 2.md",
        "name": "План побега 2",
        "title": "Escape Plan 2: Hades",
        "imdb": "tt6513656"
      }
    ]
  },
  {
    "name": "Планета Земля",
    "url": "https://en.wikipedia.org/wiki/Planet_Earth_II",
    "note": "",
    "members": [
      {
        "path": "Кино/Планета Земля 2.md",
        "name": "Планета Земля 2",
        "title": "Planet Earth II",
        "imdb": "tt5491994"
      }
    ]
  },
  {
    "name": "Платформа",
    "url": "https://en.wikipedia.org/wiki/The_Platform_2",
    "note": "",
    "members": [
      {
        "path": "Кино/Платформа.md",
        "name": "Платформа",
        "title": "El hoyo",
        "imdb": "tt8228288"
      },
      {
        "path": "Кино/Платформа 2.md",
        "name": "Платформа 2",
        "title": "El hoyo 2",
        "imdb": "tt27729779"
      }
    ]
  },
  {
    "name": "Плохие парни",
    "url": "https://en.wikipedia.org/wiki/Bad_Boys_%28franchise%29",
    "note": "",
    "members": [
      {
        "path": "Кино/Плохие парни.md",
        "name": "Плохие парни",
        "title": "Bad Boys",
        "imdb": "tt0112442"
      },
      {
        "path": "Кино/Плохие парни 2.md",
        "name": "Плохие парни 2",
        "title": "Bad Boys II",
        "imdb": "tt0172156"
      },
      {
        "path": "Кино/Плохие парни навсегда.md",
        "name": "Плохие парни навсегда",
        "title": "Bad Boys for Life",
        "imdb": "tt1502397"
      },
      {
        "path": "Кино/Плохие парни до конца.md",
        "name": "Плохие парни до конца",
        "title": "Bad Boys: Ride or Die",
        "imdb": "tt4919268"
      }
    ]
  },
  {
    "name": "Плохой Санта",
    "url": "https://en.wikipedia.org/wiki/Bad_Santa_2",
    "note": "",
    "members": [
      {
        "path": "Кино/Плохой Санта.md",
        "name": "Плохой Санта",
        "title": "Bad Santa",
        "imdb": "tt0307987"
      },
      {
        "path": "Кино/Плохой Санта 2.md",
        "name": "Плохой Санта 2",
        "title": "Bad Santa 2",
        "imdb": "tt1798603"
      }
    ]
  },
  {
    "name": "Побег",
    "url": "https://en.wikipedia.org/wiki/Prison_Break%3A_The_Final_Break",
    "note": "",
    "members": [
      {
        "path": "Кино/Побег.md",
        "name": "Побег",
        "title": "Prison Break",
        "imdb": "tt0455275"
      },
      {
        "path": "Кино/Побег (S04E00 - Побег из тюрьмы - Финальный побег).md",
        "name": "Побег (S04E00 - Побег из тюрьмы - Финальный побег)",
        "title": "Prison Break (S04E00 - The Final Break)",
        "imdb": "tt1131748"
      }
    ]
  },
  {
    "name": "Подземелья и драконы",
    "url": "https://en.wikipedia.org/wiki/Dungeons_%26_Dragons_%28film_series%29",
    "note": "",
    "members": [
      {
        "path": "Кино/Подземелья и драконы - Честь среди воров.md",
        "name": "Подземелья и драконы - Честь среди воров",
        "title": "Dungeons & Dragons: Honor Among Thieves",
        "imdb": "tt2906216"
      }
    ]
  },
  {
    "name": "Поездка в Америку",
    "url": "https://en.wikipedia.org/wiki/Coming_2_America",
    "note": "",
    "members": [
      {
        "path": "Кино/Поездка в Америку.md",
        "name": "Поездка в Америку",
        "title": "Coming to America",
        "imdb": "tt0094898"
      }
    ]
  },
  {
    "name": "Полицейский из Беверли-Хиллз",
    "url": "https://en.wikipedia.org/wiki/Beverly_Hills_Cop_%28franchise%29",
    "note": "",
    "members": [
      {
        "path": "Кино/Полицейский из Беверли-Хиллз.md",
        "name": "Полицейский из Беверли-Хиллз",
        "title": "Beverly Hills Cop",
        "imdb": "tt0086960"
      },
      {
        "path": "Кино/Полицейский из Беверли-Хиллз 2.md",
        "name": "Полицейский из Беверли-Хиллз 2",
        "title": "Beverly Hills Cop II",
        "imdb": "tt0092644"
      },
      {
        "path": "Кино/Полицейский из Беверли-Хиллз 3.md",
        "name": "Полицейский из Беверли-Хиллз 3",
        "title": "Beverly Hills Cop III",
        "imdb": "tt0109254"
      }
    ]
  },
  {
    "name": "Портал юрского периода",
    "url": "https://en.wikipedia.org/wiki/Primeval%3A_New_World",
    "note": "",
    "members": [
      {
        "path": "Кино/Портал юрского периода.md",
        "name": "Портал юрского периода",
        "title": "Primeval",
        "imdb": "tt0808096"
      },
      {
        "path": "Кино/Портал юрского периода - Новый мир.md",
        "name": "Портал юрского периода - Новый мир",
        "title": "Primeval: New World",
        "imdb": "tt2295953"
      }
    ]
  },
  {
    "name": "Последний богатырь",
    "url": "https://ru.wikipedia.org/wiki/%D0%9F%D0%BE%D1%81%D0%BB%D0%B5%D0%B4%D0%BD%D0%B8%D0%B9_%D0%B1%D0%BE%D0%B3%D0%B0%D1%82%D1%8B%D1%80%D1%8C",
    "note": "",
    "members": [
      {
        "path": "Кино/Последний богатырь.md",
        "name": "Последний богатырь",
        "title": "Последний богатырь",
        "imdb": "tt6175394"
      },
      {
        "path": "Кино/Последний богатырь - Корень зла.md",
        "name": "Последний богатырь - Корень зла",
        "title": "Последний богатырь: Корень зла",
        "imdb": "tt13606158"
      },
      {
        "path": "Кино/Последний богатырь - Посланник Тьмы.md",
        "name": "Последний богатырь - Посланник Тьмы",
        "title": "Последний богатырь: Посланник Тьмы",
        "imdb": "tt13769630"
      }
    ]
  },
  {
    "name": "Призрачный гонщик",
    "url": "https://en.wikipedia.org/wiki/Ghost_Rider%3A_Spirit_of_Vengeance",
    "note": "",
    "members": [
      {
        "path": "Кино/Призрачный гонщик.md",
        "name": "Призрачный гонщик",
        "title": "Ghost Rider",
        "imdb": "tt0259324"
      },
      {
        "path": "Кино/Призрачный гонщик 2.md",
        "name": "Призрачный гонщик 2",
        "title": "Ghost Rider: Spirit of Vengeance",
        "imdb": "tt1071875"
      }
    ]
  },
  {
    "name": "Призрачный патруль",
    "url": "https://en.wikipedia.org/wiki/R.I.P.D._2%3A_Rise_of_the_Damned",
    "note": "",
    "members": [
      {
        "path": "Кино/Призрачный патруль.md",
        "name": "Призрачный патруль",
        "title": "R.I.P.D.",
        "imdb": "tt0790736"
      }
    ]
  },
  {
    "name": "Паддингтон",
    "url": "https://en.wikipedia.org/wiki/Paddington_%28film_series%29",
    "note": "",
    "members": [
      {
        "path": "Кино/Приключения Паддингтона.md",
        "name": "Приключения Паддингтона",
        "title": "Paddington",
        "imdb": "tt1109624"
      }
    ]
  },
  {
    "name": "Притворщик",
    "url": "https://en.wikipedia.org/wiki/The_Pretender_2001",
    "note": "",
    "members": [
      {
        "path": "Кино/Притворщик.md",
        "name": "Притворщик",
        "title": "The Pretender",
        "imdb": "tt0115320"
      }
    ]
  },
  {
    "name": "Притяжение",
    "url": "https://en.wikipedia.org/wiki/Invasion_%282020_film%29",
    "note": "",
    "members": [
      {
        "path": "Кино/Притяжение.md",
        "name": "Притяжение",
        "title": "Притяжение",
        "imdb": "tt4731148"
      },
      {
        "path": "Кино/Вторжение.md",
        "name": "Вторжение",
        "title": "Вторжение",
        "imdb": "tt6284064"
      }
    ]
  },
  {
    "name": "Пришельцы",
    "url": "https://en.wikipedia.org/wiki/Les_Visiteurs",
    "note": "«Пришельцы в Америке» — американский ремейк, не продолжение основной линии.",
    "members": [
      {
        "path": "Кино/Пришельцы.md",
        "name": "Пришельцы",
        "title": "Les visiteurs",
        "imdb": "tt0108500"
      },
      {
        "path": "Кино/Пришельцы 2 - Коридоры времени.md",
        "name": "Пришельцы 2 - Коридоры времени",
        "title": "Les couloirs du temps: Les visiteurs II",
        "imdb": "tt0120882"
      },
      {
        "path": "Кино/Пришельцы в Америке.md",
        "name": "Пришельцы в Америке",
        "title": "Just Visiting",
        "imdb": "tt0189192"
      },
      {
        "path": "Кино/Пришельцы 3 - Взятие Бастилии.md",
        "name": "Пришельцы 3 - Взятие Бастилии",
        "title": "Les visiteurs: La révolution",
        "imdb": "tt2441982"
      }
    ]
  },
  {
    "name": "Чужой",
    "url": "https://en.wikipedia.org/wiki/Alien_%28franchise%29",
    "note": "«Прометей» — приквел серии «Чужой».",
    "members": [
      {
        "path": "Кино/Прометей.md",
        "name": "Прометей",
        "title": "Prometheus",
        "imdb": "tt1446714"
      }
    ]
  },
  {
    "name": "Простоквашино",
    "url": "https://ru.wikipedia.org/wiki/%D0%9F%D1%80%D0%BE%D1%81%D1%82%D0%BE%D0%BA%D0%B2%D0%B0%D1%88%D0%B8%D0%BD%D0%BE_%28%D0%BC%D1%83%D0%BB%D1%8C%D1%82%D1%81%D0%B5%D1%80%D0%B8%D0%B0%D0%BB%29",
    "note": "",
    "members": [
      {
        "path": "Кино/Простоквашино.md",
        "name": "Простоквашино",
        "title": "Простоквашино",
        "imdb": "tt11947406"
      }
    ]
  },
  {
    "name": "Путешествие к центру Земли",
    "url": "https://en.wikipedia.org/wiki/Journey_2%3A_The_Mysterious_Island",
    "note": "",
    "members": [
      {
        "path": "Кино/Путешествие 2 - Таинственный остров.md",
        "name": "Путешествие 2 - Таинственный остров",
        "title": "Journey 2: The Mysterious Island",
        "imdb": "tt1397514"
      }
    ]
  },
  {
    "name": "Реальные пацаны",
    "url": "https://ru.wikipedia.org/wiki/%D0%A0%D0%B5%D0%B0%D0%BB%D1%8C%D0%BD%D1%8B%D0%B5_%D0%BF%D0%B0%D1%86%D0%B0%D0%BD%D1%8B_%D0%BF%D1%80%D0%BE%D1%82%D0%B8%D0%B2_%D0%B7%D0%BE%D0%BC%D0%B1%D0%B8",
    "note": "Фильм «Против зомби» показывает альтернативное развитие событий сериала, а не продолжает его основную линию.",
    "members": [
      {
        "path": "Кино/Реальные пацаны.md",
        "name": "Реальные пацаны",
        "title": "Реальные пацаны",
        "imdb": "tt1837341"
      },
      {
        "path": "Кино/Реальные пацаны против зомби.md",
        "name": "Реальные пацаны против зомби",
        "title": "Реальные пацаны против зомби",
        "imdb": "tt13872708"
      }
    ]
  },
  {
    "name": "Рейд",
    "url": "https://en.wikipedia.org/wiki/The_Raid_2",
    "note": "",
    "members": [
      {
        "path": "Кино/Рейд.md",
        "name": "Рейд",
        "title": "Serbuan maut",
        "imdb": "tt1899353"
      },
      {
        "path": "Кино/Рейд 2.md",
        "name": "Рейд 2",
        "title": "Serbuan maut 2: Berandal",
        "imdb": "tt2265171"
      }
    ]
  },
  {
    "name": "Робокоп",
    "url": "https://en.wikipedia.org/wiki/RoboCop_%28franchise%29",
    "note": "",
    "members": [
      {
        "path": "Кино/РобоКоп.md",
        "name": "РобоКоп",
        "title": "RoboCop",
        "imdb": "tt1234721"
      }
    ]
  },
  {
    "name": "Рождественские хроники",
    "url": "https://en.wikipedia.org/wiki/The_Christmas_Chronicles_2",
    "note": "",
    "members": [
      {
        "path": "Кино/Рождественские хроники.md",
        "name": "Рождественские хроники",
        "title": "The Christmas Chronicles",
        "imdb": "tt2990140"
      }
    ]
  },
  {
    "name": "РЭД",
    "url": "https://en.wikipedia.org/wiki/Red_2_%28film%29",
    "note": "",
    "members": [
      {
        "path": "Кино/РЭД.md",
        "name": "РЭД",
        "title": "RED",
        "imdb": "tt1245526"
      },
      {
        "path": "Кино/РЭД 2.md",
        "name": "РЭД 2",
        "title": "RED 2",
        "imdb": "tt1821694"
      }
    ]
  },
  {
    "name": "Санта-Клаус",
    "url": "https://en.wikipedia.org/wiki/The_Santa_Clause_%28franchise%29",
    "note": "",
    "members": [
      {
        "path": "Кино/Санта Клаус.md",
        "name": "Санта Клаус",
        "title": "The Santa Clause",
        "imdb": "tt0111070"
      },
      {
        "path": "Кино/Санта Клаус 2.md",
        "name": "Санта Клаус 2",
        "title": "The Santa Clause 2",
        "imdb": "tt0304669"
      },
      {
        "path": "Кино/Санта Клаус 3 - Хозяин полюса.md",
        "name": "Санта Клаус 3 - Хозяин полюса",
        "title": "The Santa Clause 3: The Escape Clause",
        "imdb": "tt0452681"
      },
      {
        "path": "Кино/Санта Клаусы.md",
        "name": "Санта Клаусы",
        "title": "The Santa Clauses",
        "imdb": "tt17047510"
      }
    ]
  },
  {
    "name": "Универ",
    "url": "https://ru.wikipedia.org/wiki/%D0%A3%D0%BD%D0%B8%D0%B2%D0%B5%D1%80_%28%D1%82%D0%B5%D0%BB%D0%B5%D1%81%D0%B5%D1%80%D0%B8%D0%B0%D0%BB%29",
    "note": "Включён спин-офф «СашаТаня».",
    "members": [
      {
        "path": "Кино/Универ.md",
        "name": "Универ",
        "title": "Универ",
        "imdb": "tt1409069"
      },
      {
        "path": "Кино/Универ. Новая общага.md",
        "name": "Универ. Новая общага",
        "title": "Универ. Новая общага",
        "imdb": "tt3752220"
      },
      {
        "path": "Кино/Универ - 10 лет спустя.md",
        "name": "Универ - 10 лет спустя",
        "title": "Универ: 10 лет спустя",
        "imdb": "tt16233524"
      },
      {
        "path": "Кино/СашаТаня.md",
        "name": "СашаТаня",
        "title": "СашаТаня",
        "imdb": "tt3608112"
      }
    ]
  },
  {
    "name": "Сверхъестественное",
    "url": "https://en.wikipedia.org/wiki/Supernatural_%28American_TV_series%29",
    "note": "Something in the Dirt и Taklee Genesis не связаны с этим сериалом.",
    "members": [
      {
        "path": "Кино/Сверхестественное.md",
        "name": "Сверхестественное",
        "title": "Supernatural",
        "imdb": "tt0460681"
      }
    ]
  },
  {
    "name": "Семейный план",
    "url": "https://en.wikipedia.org/wiki/The_Family_Plan_2",
    "note": "",
    "members": [
      {
        "path": "Кино/Семейный план.md",
        "name": "Семейный план",
        "title": "The Family Plan",
        "imdb": "tt16431870"
      },
      {
        "path": "Кино/Семейный план 2.md",
        "name": "Семейный план 2",
        "title": "The Family Plan 2",
        "imdb": "tt34276058"
      }
    ]
  },
  {
    "name": "Симпсоны",
    "url": "https://en.wikipedia.org/wiki/The_Simpsons_%28franchise%29",
    "note": "",
    "members": [
      {
        "path": "Кино/Симпсоны.md",
        "name": "Симпсоны",
        "title": "The Simpsons",
        "imdb": "tt0096697"
      }
    ]
  },
  {
    "name": "Скайлайн",
    "url": "https://en.wikipedia.org/wiki/Skyline_%28film_series%29",
    "note": "",
    "members": [
      {
        "path": "Кино/Скайлайн.md",
        "name": "Скайлайн",
        "title": "Skyline",
        "imdb": "tt1564585"
      }
    ]
  },
  {
    "name": "Скандинавский форсаж",
    "url": "https://en.wikipedia.org/wiki/B%C3%B8rning_2",
    "note": "",
    "members": [
      {
        "path": "Кино/Скандинавский форсаж.md",
        "name": "Скандинавский форсаж",
        "title": "Børning",
        "imdb": "tt3102440"
      },
      {
        "path": "Кино/Скандинавский форсаж - Гонки на льду.md",
        "name": "Скандинавский форсаж - Гонки на льду",
        "title": "Børning 2",
        "imdb": "tt4956984"
      }
    ]
  },
  {
    "name": "Скорость",
    "url": "https://en.wikipedia.org/wiki/Speed_2%3A_Cruise_Control",
    "note": "",
    "members": [
      {
        "path": "Кино/Скорость.md",
        "name": "Скорость",
        "title": "Speed",
        "imdb": "tt0111257"
      },
      {
        "path": "Кино/Скорость 2 - Контроль над круизом.md",
        "name": "Скорость 2 - Контроль над круизом",
        "title": "Speed 2: Cruise Control",
        "imdb": "tt0120179"
      }
    ]
  },
  {
    "name": "Слуга народа",
    "url": "https://en.wikipedia.org/wiki/Servant_of_the_People_2",
    "note": "",
    "members": [
      {
        "path": "Кино/Слуга народа.md",
        "name": "Слуга народа",
        "title": "Слуга народа",
        "imdb": "tt6235122"
      }
    ]
  },
  {
    "name": "Смертельная битва",
    "url": "https://en.wikipedia.org/wiki/Mortal_Kombat%3A_Legacy",
    "note": "",
    "members": [
      {
        "path": "Кино/Смертельная битва - Наследие.md",
        "name": "Смертельная битва - Наследие",
        "title": "Mortal Kombat: Legacy",
        "imdb": "tt1842127"
      }
    ]
  },
  {
    "name": "Смертельная гонка",
    "url": "https://en.wikipedia.org/wiki/Death_Race_%28franchise%29",
    "note": "",
    "members": [
      {
        "path": "Кино/Смертельная гонка.md",
        "name": "Смертельная гонка",
        "title": "Death Race",
        "imdb": "tt0452608"
      },
      {
        "path": "Кино/Смертельная гонка 2 - Франкенштейн жив.md",
        "name": "Смертельная гонка 2 - Франкенштейн жив",
        "title": "Death Race 2",
        "imdb": "tt1500491"
      },
      {
        "path": "Кино/Смертельная гонка 3 - Ад.md",
        "name": "Смертельная гонка 3 - Ад",
        "title": "Death Race 3: Inferno",
        "imdb": "tt1988591"
      },
      {
        "path": "Кино/Смертельная гонка 4 - Вне анархии.md",
        "name": "Смертельная гонка 4 - Вне анархии",
        "title": "Death Race: Beyond Anarchy",
        "imdb": "tt3807900"
      }
    ]
  },
  {
    "name": "Смерть шпионам",
    "url": "https://www.kinopoisk.ru/series/737999/",
    "note": "",
    "members": [
      {
        "path": "Кино/Смерть шпионам!.md",
        "name": "Смерть шпионам!",
        "title": "Смерть шпионам!",
        "imdb": "tt3590190"
      },
      {
        "path": "Кино/Смерть шпионам - Крым.md",
        "name": "Смерть шпионам - Крым",
        "title": "Смерть шпионам: Крым",
        "imdb": "tt3590264"
      },
      {
        "path": "Кино/Смерть шпионам - Лисья нора.md",
        "name": "Смерть шпионам - Лисья нора",
        "title": "Смерть шпионам: Лисья нора",
        "imdb": "tt3590236"
      },
      {
        "path": "Кино/Смерть шпионам - Скрытый враг.md",
        "name": "Смерть шпионам - Скрытый враг",
        "title": "Смерть шпионам: Скрытый враг",
        "imdb": "tt3590252"
      },
      {
        "path": "Кино/Смерть шпионам - Ударная волна.md",
        "name": "Смерть шпионам - Ударная волна",
        "title": "Смерть шпионам: Ударная волна",
        "imdb": "tt3590208"
      }
    ]
  },
  {
    "name": "Сокровище нации",
    "url": "https://en.wikipedia.org/wiki/National_Treasure_%28franchise%29",
    "note": "",
    "members": [
      {
        "path": "Кино/Сокровище нации.md",
        "name": "Сокровище нации",
        "title": "National Treasure",
        "imdb": "tt0368891"
      },
      {
        "path": "Кино/Сокровище нации - Книга Тайн.md",
        "name": "Сокровище нации - Книга Тайн",
        "title": "National Treasure: Book of Secrets",
        "imdb": "tt0465234"
      },
      {
        "path": "Кино/Сокровище нации - На краю истории.md",
        "name": "Сокровище нации - На краю истории",
        "title": "National Treasure: Edge of History",
        "imdb": "tt12580982"
      }
    ]
  },
  {
    "name": "Соник",
    "url": "https://en.wikipedia.org/wiki/Sonic_the_Hedgehog_%28film_series%29",
    "note": "",
    "members": [
      {
        "path": "Кино/Соник в кино.md",
        "name": "Соник в кино",
        "title": "Sonic the Hedgehog",
        "imdb": "tt3794354"
      },
      {
        "path": "Кино/Соник 2 в кино.md",
        "name": "Соник 2 в кино",
        "title": "Sonic the Hedgehog 2",
        "imdb": "tt12412888"
      }
    ]
  },
  {
    "name": "Соседи",
    "url": "https://en.wikipedia.org/wiki/Neighbors_2%3A_Sorority_Rising",
    "note": "",
    "members": [
      {
        "path": "Кино/Соседи. На тропе войны.md",
        "name": "Соседи. На тропе войны",
        "title": "Neighbors",
        "imdb": "tt2004420"
      }
    ]
  },
  {
    "name": "Спасатели Малибу",
    "url": "https://en.wikipedia.org/wiki/Baywatch_%28film%29",
    "note": "",
    "members": [
      {
        "path": "Кино/Спасатели Малибу.md",
        "name": "Спасатели Малибу",
        "title": "Baywatch",
        "imdb": "tt1469304"
      }
    ]
  },
  {
    "name": "Спирит",
    "url": "https://en.wikipedia.org/wiki/Spirit_Untamed",
    "note": "",
    "members": [
      {
        "path": "Кино/Спирит - Душа прерий.md",
        "name": "Спирит - Душа прерий",
        "title": "Spirit: Stallion of the Cimarron",
        "imdb": "tt0166813"
      }
    ]
  },
  {
    "name": "Столетний старик",
    "url": "https://en.wikipedia.org/wiki/The_101-Year-Old_Man_Who_Skipped_Out_on_the_Bill_and_Disappeared",
    "note": "",
    "members": [
      {
        "path": "Кино/Столетний старик, который вылез в окно и исчез.md",
        "name": "Столетний старик, который вылез в окно и исчез",
        "title": "Hundraåringen som klev ut genom fönstret och försvann",
        "imdb": "tt2113681"
      }
    ]
  },
  {
    "name": "Стражи Галактики",
    "url": "https://en.wikipedia.org/wiki/Guardians_of_the_Galaxy_%28film%29",
    "note": "",
    "members": [
      {
        "path": "Кино/Стражи Галактики.md",
        "name": "Стражи Галактики",
        "title": "Guardians of the Galaxy",
        "imdb": "tt2015381"
      }
    ],
    "related": [
      "Киновселенная Marvel"
    ]
  },
  {
    "name": "Судья Дредд",
    "url": "https://en.wikipedia.org/wiki/Dredd",
    "note": "Две самостоятельные экранизации одного героя, не дилогия-продолжение.",
    "members": [
      {
        "path": "Кино/Судья Дредд (1995).md",
        "name": "Судья Дредд (1995)",
        "title": "Judge Dredd",
        "imdb": "tt0113492"
      },
      {
        "path": "Кино/Судья Дредд.md",
        "name": "Судья Дредд",
        "title": "Dredd",
        "imdb": "tt1343727"
      }
    ]
  },
  {
    "name": "Счастливого дня смерти",
    "url": "https://en.wikipedia.org/wiki/Happy_Death_Day_2U",
    "note": "",
    "members": [
      {
        "path": "Кино/Счастливого дня смерти.md",
        "name": "Счастливого дня смерти",
        "title": "Happy Death Day",
        "imdb": "tt5308322"
      },
      {
        "path": "Кино/Счастливого нового дня смерти.md",
        "name": "Счастливого нового дня смерти",
        "title": "Happy Death Day 2U",
        "imdb": "tt8155288"
      }
    ]
  },
  {
    "name": "Таймлесс",
    "url": "https://en.wikipedia.org/wiki/Ruby_Red_%28film%29",
    "note": "",
    "members": [
      {
        "path": "Кино/Таймлесс. Рубиновая книга.md",
        "name": "Таймлесс. Рубиновая книга",
        "title": "Rubinrot",
        "imdb": "tt2418558"
      },
      {
        "path": "Кино/Таймлесс 2 - Сапфировая книга.md",
        "name": "Таймлесс 2 - Сапфировая книга",
        "title": "Saphirblau",
        "imdb": "tt3260022"
      },
      {
        "path": "Кино/Таймлесс 3 - Изумрудная книга.md",
        "name": "Таймлесс 3 - Изумрудная книга",
        "title": "Smaragdgrün",
        "imdb": "tt4960934"
      }
    ]
  },
  {
    "name": "Вий",
    "url": "https://en.wikipedia.org/wiki/Viy_2%3A_Journey_to_China",
    "note": "",
    "members": [
      {
        "path": "Кино/Тайна печати дракона.md",
        "name": "Тайна печати дракона",
        "title": "Тайна печати дракона",
        "imdb": "tt6218010"
      }
    ]
  },
  {
    "name": "Тайная жизнь домашних животных",
    "url": "https://en.wikipedia.org/wiki/The_Secret_Life_of_Pets_%28franchise%29",
    "note": "",
    "members": [
      {
        "path": "Кино/Тайная жизнь домашних животных.md",
        "name": "Тайная жизнь домашних животных",
        "title": "The Secret Life of Pets",
        "imdb": "tt2709768"
      }
    ]
  },
  {
    "name": "Такси",
    "url": "https://en.wikipedia.org/wiki/Taxi_%28film_series%29",
    "note": "",
    "members": [
      {
        "path": "Кино/Такси 5.md",
        "name": "Такси 5",
        "title": "Taxi 5",
        "imdb": "tt7238392"
      }
    ]
  },
  {
    "name": "Телохранитель киллера",
    "url": "https://en.wikipedia.org/wiki/Hitman%27s_Wife%27s_Bodyguard",
    "note": "",
    "members": [
      {
        "path": "Кино/Телохранитель киллера.md",
        "name": "Телохранитель киллера",
        "title": "The Hitman's Bodyguard",
        "imdb": "tt1959563"
      }
    ]
  },
  {
    "name": "Терминатор",
    "url": "https://en.wikipedia.org/wiki/Terminator_%28franchise%29",
    "note": "",
    "members": [
      {
        "path": "Кино/Терминатор.md",
        "name": "Терминатор",
        "title": "The Terminator",
        "imdb": "tt0088247"
      },
      {
        "path": "Кино/Терминатор 2 - Судный день.md",
        "name": "Терминатор 2 - Судный день",
        "title": "Terminator 2: Judgment Day",
        "imdb": "tt0103064"
      },
      {
        "path": "Кино/Терминатор 3 - Восстание машин.md",
        "name": "Терминатор 3 - Восстание машин",
        "title": "Terminator 3: Rise of the Machines",
        "imdb": "tt0181852"
      },
      {
        "path": "Кино/Терминатор - Да придёт спаситель.md",
        "name": "Терминатор - Да придёт спаситель",
        "title": "Terminator Salvation",
        "imdb": "tt0438488"
      },
      {
        "path": "Кино/Терминатор - Генезис.md",
        "name": "Терминатор - Генезис",
        "title": "Terminator Genisys",
        "imdb": "tt1340138"
      },
      {
        "path": "Кино/Терминатор - Тёмные судьбы.md",
        "name": "Терминатор - Тёмные судьбы",
        "title": "Terminator: Dark Fate",
        "imdb": "tt6450804"
      }
    ]
  },
  {
    "name": "Тихоокеанский рубеж",
    "url": "https://en.wikipedia.org/wiki/Pacific_Rim_%28franchise%29",
    "note": "",
    "members": [
      {
        "path": "Кино/Тихоокеанский рубеж.md",
        "name": "Тихоокеанский рубеж",
        "title": "Pacific Rim",
        "imdb": "tt1663662"
      }
    ]
  },
  {
    "name": "Тор",
    "url": "https://en.wikipedia.org/wiki/Thor_%28film_series%29",
    "note": "",
    "members": [
      {
        "path": "Кино/Тор.md",
        "name": "Тор",
        "title": "Thor",
        "imdb": "tt0800369"
      },
      {
        "path": "Кино/Тор 2 - Царство тьмы.md",
        "name": "Тор 2 - Царство тьмы",
        "title": "Thor: The Dark World",
        "imdb": "tt1981115"
      },
      {
        "path": "Кино/Тор - Рагнарёк.md",
        "name": "Тор - Рагнарёк",
        "title": "Thor: Ragnarok",
        "imdb": "tt3501632"
      },
      {
        "path": "Кино/Тор - Любовь и гром.md",
        "name": "Тор - Любовь и гром",
        "title": "Thor: Love and Thunder",
        "imdb": "tt10648342"
      }
    ],
    "related": [
      "Киновселенная Marvel"
    ]
  },
  {
    "name": "Третий лишний",
    "url": "https://en.wikipedia.org/wiki/Ted_%28franchise%29",
    "note": "",
    "members": [
      {
        "path": "Кино/Третий лишний.md",
        "name": "Третий лишний",
        "title": "Ted",
        "imdb": "tt1637725"
      },
      {
        "path": "Кино/Третий лишний 2.md",
        "name": "Третий лишний 2",
        "title": "Ted 2",
        "imdb": "tt2637276"
      }
    ]
  },
  {
    "name": "Три икса",
    "url": "https://en.wikipedia.org/wiki/XXX_%28film_series%29",
    "note": "",
    "members": [
      {
        "path": "Кино/Три икса.md",
        "name": "Три икса",
        "title": "xXx",
        "imdb": "tt0295701"
      },
      {
        "path": "Кино/Три икса 2 - Новый уровень.md",
        "name": "Три икса 2 - Новый уровень",
        "title": "xXx: State of the Union",
        "imdb": "tt0329774"
      },
      {
        "path": "Кино/Три икса - Мировое господство.md",
        "name": "Три икса - Мировое господство",
        "title": "xXx: Return of Xander Cage",
        "imdb": "tt1293847"
      }
    ]
  },
  {
    "name": "Тролль",
    "url": "https://en.wikipedia.org/wiki/Troll_2_%282025_film%29",
    "note": "",
    "members": [
      {
        "path": "Кино/Тролль.md",
        "name": "Тролль",
        "title": "Troll",
        "imdb": "tt11116912"
      }
    ]
  },
  {
    "name": "Трон",
    "url": "https://en.wikipedia.org/wiki/Tron_%28franchise%29",
    "note": "",
    "members": [
      {
        "path": "Кино/Трон.md",
        "name": "Трон",
        "title": "Tron",
        "imdb": "tt0084827"
      },
      {
        "path": "Кино/Трон - Наследие.md",
        "name": "Трон - Наследие",
        "title": "Tron: Legacy",
        "imdb": "tt1104001"
      }
    ]
  },
  {
    "name": "Туман",
    "url": "https://ru.wikipedia.org/wiki/%D0%A2%D1%83%D0%BC%D0%B0%D0%BD_%28%D1%84%D0%B8%D0%BB%D1%8C%D0%BC%2C_2010%29",
    "note": "",
    "members": [
      {
        "path": "Кино/Туман.md",
        "name": "Туман",
        "title": "Туман",
        "imdb": "tt2720566"
      },
      {
        "path": "Кино/Туман 2.md",
        "name": "Туман 2",
        "title": "Туман 2",
        "imdb": ""
      }
    ]
  },
  {
    "name": "Тупой и ещё тупее",
    "url": "https://en.wikipedia.org/wiki/Dumb_and_Dumber_%28franchise%29",
    "note": "",
    "members": [
      {
        "path": "Кино/Тупой и ещё тупее.md",
        "name": "Тупой и ещё тупее",
        "title": "Dumb and Dumber",
        "imdb": "tt0109686"
      },
      {
        "path": "Кино/Тупой и еще тупее 2.md",
        "name": "Тупой и еще тупее 2",
        "title": "Dumb and Dumber To",
        "imdb": "tt2096672"
      }
    ]
  },
  {
    "name": "Турбо",
    "url": "https://en.wikipedia.org/wiki/Turbo_Fast",
    "note": "",
    "members": [
      {
        "path": "Кино/Турбо.md",
        "name": "Турбо",
        "title": "Turbo",
        "imdb": "tt1860353"
      }
    ]
  },
  {
    "name": "Убрать из друзей",
    "url": "https://en.wikipedia.org/wiki/Unfriended%3A_Dark_Web",
    "note": "",
    "members": [
      {
        "path": "Кино/Убрать из друзей.md",
        "name": "Убрать из друзей",
        "title": "Unfriended",
        "imdb": "tt3713166"
      }
    ]
  },
  {
    "name": "Геракл",
    "url": "https://en.wikipedia.org/wiki/Hercules%3A_The_Legendary_Journeys",
    "note": "",
    "members": [
      {
        "path": "Кино/Удивительные странствия Геракла.md",
        "name": "Удивительные странствия Геракла",
        "title": "Hercules: The Legendary Journeys",
        "imdb": "tt0111999"
      }
    ]
  },
  {
    "name": "Успеть до полуночи",
    "url": "https://en.wikipedia.org/wiki/Midnight_Run_for_Your_Life",
    "note": "",
    "members": [
      {
        "path": "Кино/Успеть до полуночи.md",
        "name": "Успеть до полуночи",
        "title": "Midnight Run",
        "imdb": "tt0095631"
      }
    ]
  },
  {
    "name": "Утиные истории",
    "url": "https://en.wikipedia.org/wiki/DuckTales_%281987_TV_series%29",
    "note": "",
    "members": [
      {
        "path": "Кино/Утиные истории.md",
        "name": "Утиные истории",
        "title": "DuckTales",
        "imdb": "tt0092345"
      }
    ]
  },
  {
    "name": "Фантастическая четвёрка",
    "url": "https://en.wikipedia.org/wiki/Fantastic_Four_in_film",
    "note": "Дилогия 2005–2007 годов и перезапуск 2015 года.",
    "members": [
      {
        "path": "Кино/Фантастическая четверка.md",
        "name": "Фантастическая четверка",
        "title": "Fantastic Four",
        "imdb": "tt0120667"
      },
      {
        "path": "Кино/Фантастическая четверка - Вторжение Серебряного серфера.md",
        "name": "Фантастическая четверка - Вторжение Серебряного серфера",
        "title": "Fantastic Four: Rise of the Silver Surfer",
        "imdb": "tt0486576"
      },
      {
        "path": "Кино/Фантастическая четвёрка.md",
        "name": "Фантастическая четвёрка",
        "title": "Fantastic Four",
        "imdb": "tt1502712"
      }
    ]
  },
  {
    "name": "Флиппер",
    "url": "https://en.wikipedia.org/wiki/Flipper_%281996_film%29",
    "note": "",
    "members": [
      {
        "path": "Кино/Флиппер.md",
        "name": "Флиппер",
        "title": "Flipper",
        "imdb": "tt0111964"
      }
    ]
  },
  {
    "name": "Вселенная Стрелы",
    "url": "https://en.wikipedia.org/wiki/Arrowverse",
    "note": "Телесериал «Флэш» не относится к киноверсии «Флэш» 2023 года.",
    "members": [
      {
        "path": "Кино/Флэш (2014).md",
        "name": "Флэш (2014)",
        "title": "The Flash",
        "imdb": "tt3107288"
      }
    ]
  },
  {
    "name": "Форсаж",
    "url": "https://en.wikipedia.org/wiki/Fast_%26_Furious",
    "note": "",
    "members": [
      {
        "path": "Кино/Форсаж 5.md",
        "name": "Форсаж 5",
        "title": "Fast Five",
        "imdb": "tt1596343"
      },
      {
        "path": "Кино/Форсаж 6.md",
        "name": "Форсаж 6",
        "title": "Furious 6",
        "imdb": "tt1905041"
      },
      {
        "path": "Кино/Форсаж 7.md",
        "name": "Форсаж 7",
        "title": "Fast & Furious 7",
        "imdb": "tt2820852"
      },
      {
        "path": "Кино/Форсаж 8.md",
        "name": "Форсаж 8",
        "title": "The Fate of the Furious",
        "imdb": "tt4630562"
      },
      {
        "path": "Кино/Форсаж - Хоббс и Шоу.md",
        "name": "Форсаж - Хоббс и Шоу",
        "title": "Fast & Furious Presents: Hobbs & Shaw",
        "imdb": "tt6806448"
      },
      {
        "path": "Кино/Форсаж 9.md",
        "name": "Форсаж 9",
        "title": "F9",
        "imdb": "tt5433138"
      },
      {
        "path": "Кино/Форсаж 10.md",
        "name": "Форсаж 10",
        "title": "Fast X",
        "imdb": "tt5433140"
      }
    ]
  },
  {
    "name": "Хеллбой",
    "url": "https://en.wikipedia.org/wiki/Hellboy%3A_The_Crooked_Man",
    "note": "Дилогия дель Торо и два самостоятельных перезапуска.",
    "members": [
      {
        "path": "Кино/Хеллбой - Герой из пекла.md",
        "name": "Хеллбой - Герой из пекла",
        "title": "Hellboy",
        "imdb": "tt0167190"
      },
      {
        "path": "Кино/Хеллбой 2 - Золотая армия.md",
        "name": "Хеллбой 2 - Золотая армия",
        "title": "Hellboy II: The Golden Army",
        "imdb": "tt0411477"
      },
      {
        "path": "Кино/Хеллбой.md",
        "name": "Хеллбой",
        "title": "Hellboy",
        "imdb": "tt2274648"
      },
      {
        "path": "Кино/Хеллбой - Проклятие Горбуна.md",
        "name": "Хеллбой - Проклятие Горбуна",
        "title": "Hellboy: The Crooked Man",
        "imdb": "tt26757462"
      }
    ]
  },
  {
    "name": "Хитмэн",
    "url": "https://en.wikipedia.org/wiki/Hitman%3A_Agent_47",
    "note": "",
    "members": [
      {
        "path": "Кино/Хитмэн.md",
        "name": "Хитмэн",
        "title": "Hitman",
        "imdb": "tt0465494"
      }
    ]
  },
  {
    "name": "Холоп",
    "url": "https://ru.wikipedia.org/wiki/%D0%A5%D0%BE%D0%BB%D0%BE%D0%BF_2",
    "note": "",
    "members": [
      {
        "path": "Кино/Холоп.md",
        "name": "Холоп",
        "title": "Холоп",
        "imdb": "tt11418452"
      },
      {
        "path": "Кино/Холоп 2.md",
        "name": "Холоп 2",
        "title": "Холоп 2",
        "imdb": "tt20721318"
      }
    ]
  },
  {
    "name": "Риддик",
    "url": "https://en.wikipedia.org/wiki/The_Chronicles_of_Riddick_%28franchise%29",
    "note": "",
    "members": [
      {
        "path": "Кино/Чёрная дыра.md",
        "name": "Чёрная дыра",
        "title": "Pitch Black",
        "imdb": "tt0134847"
      },
      {
        "path": "Кино/Хроники Риддика.md",
        "name": "Хроники Риддика",
        "title": "The Chronicles of Riddick",
        "imdb": "tt0296572"
      }
    ]
  },
  {
    "name": "Хулиган с белым воротничком",
    "url": "https://www.screendaily.com/production/white-collar-hooligan-2-to-kick-off-in-spain-momentum-boards-uk/5044640.article",
    "note": "",
    "members": [
      {
        "path": "Кино/Хулиган с белым воротничком.md",
        "name": "Хулиган с белым воротничком",
        "title": "The Rise & Fall of a White Collar Hooligan",
        "imdb": "tt2121377"
      }
    ]
  },
  {
    "name": "Час пик",
    "url": "https://en.wikipedia.org/wiki/Rush_Hour_%28franchise%29",
    "note": "Кинотрилогия и отдельная телевизионная адаптация.",
    "members": [
      {
        "path": "Кино/Час пик (1998).md",
        "name": "Час пик (1998)",
        "title": "Rush Hour",
        "imdb": "tt0120812"
      },
      {
        "path": "Кино/Час пик 2.md",
        "name": "Час пик 2",
        "title": "Rush Hour 2",
        "imdb": "tt0266915"
      },
      {
        "path": "Кино/Час пик 3.md",
        "name": "Час пик 3",
        "title": "Rush Hour 3",
        "imdb": "tt0293564"
      },
      {
        "path": "Кино/Час пик.md",
        "name": "Час пик",
        "title": "Rush Hour",
        "imdb": "tt4085584"
      }
    ]
  },
  {
    "name": "Человек с Земли",
    "url": "https://en.wikipedia.org/wiki/The_Man_from_Earth%3A_Holocene",
    "note": "",
    "members": [
      {
        "path": "Кино/Человек с Земли.md",
        "name": "Человек с Земли",
        "title": "The Man from Earth",
        "imdb": "tt0756683"
      }
    ]
  },
  {
    "name": "Человек-муравей",
    "url": "https://en.wikipedia.org/wiki/Ant-Man_%28film_series%29",
    "note": "",
    "members": [
      {
        "path": "Кино/Человек-муравей.md",
        "name": "Человек-муравей",
        "title": "Ant-Man",
        "imdb": "tt0478970"
      },
      {
        "path": "Кино/Человек-муравей и Оса.md",
        "name": "Человек-муравей и Оса",
        "title": "Ant-Man and the Wasp",
        "imdb": "tt5095030"
      },
      {
        "path": "Кино/Человек-муравей и Оса - Квантомания.md",
        "name": "Человек-муравей и Оса - Квантомания",
        "title": "Ant-Man and the Wasp: Quantumania",
        "imdb": "tt10954600"
      }
    ],
    "related": [
      "Киновселенная Marvel"
    ]
  },
  {
    "name": "Человек-паук — MCU",
    "url": "https://en.wikipedia.org/wiki/Spider-Man%3A_Homecoming",
    "note": "",
    "members": [
      {
        "path": "Кино/Человек-паук - Возвращение домой.md",
        "name": "Человек-паук - Возвращение домой",
        "title": "Spider-Man: Homecoming",
        "imdb": "tt2250912"
      },
      {
        "path": "Кино/Человек-паук - Вдали от дома.md",
        "name": "Человек-паук - Вдали от дома",
        "title": "Spider-Man: Far from Home",
        "imdb": "tt6320628"
      },
      {
        "path": "Кино/Человек-паук - Нет пути домой.md",
        "name": "Человек-паук - Нет пути домой",
        "title": "Spider-Man: No Way Home",
        "imdb": "tt10872600"
      }
    ],
    "related": [
      "Киновселенная Marvel",
      "Новый Человек-паук"
    ]
  },
  {
    "name": "Черепашки-ниндзя",
    "url": "https://en.wikipedia.org/wiki/Teenage_Mutant_Ninja_Turtles_in_film",
    "note": "",
    "members": [
      {
        "path": "Кино/Черепашки-ниндзя.md",
        "name": "Черепашки-ниндзя",
        "title": "Teenage Mutant Ninja Turtles",
        "imdb": "tt1291150"
      },
      {
        "path": "Кино/Черепашки-ниндзя 2.md",
        "name": "Черепашки-ниндзя 2",
        "title": "Teenage Mutant Ninja Turtles: Out of the Shadows",
        "imdb": "tt3949660"
      }
    ]
  },
  {
    "name": "Чёрная пантера",
    "url": "https://en.wikipedia.org/wiki/Black_Panther%3A_Wakanda_Forever",
    "note": "",
    "members": [
      {
        "path": "Кино/Чёрная Пантера.md",
        "name": "Чёрная Пантера",
        "title": "Black Panther",
        "imdb": "tt1825683"
      },
      {
        "path": "Кино/Черная пантера - Ваканда навеки.md",
        "name": "Черная пантера - Ваканда навеки",
        "title": "Black Panther Wakanda Forever",
        "imdb": "tt9114286"
      }
    ],
    "related": [
      "Киновселенная Marvel"
    ]
  },
  {
    "name": "Четыре таксиста и собака",
    "url": "https://ru.wikipedia.org/wiki/%D0%A7%D0%B5%D1%82%D1%8B%D1%80%D0%B5_%D1%82%D0%B0%D0%BA%D1%81%D0%B8%D1%81%D1%82%D0%B0_%D0%B8_%D1%81%D0%BE%D0%B1%D0%B0%D0%BA%D0%B0",
    "note": "",
    "members": [
      {
        "path": "Кино/Четыре таксиста и собака.md",
        "name": "Четыре таксиста и собака",
        "title": "Четыре таксиста и собака",
        "imdb": "tt1390932"
      }
    ]
  },
  {
    "name": "Чокнутый профессор",
    "url": "https://en.wikipedia.org/wiki/The_Nutty_Professor_%28film_series%29",
    "note": "",
    "members": [
      {
        "path": "Кино/Чокнутый профессор.md",
        "name": "Чокнутый профессор",
        "title": "The Nutty Professor",
        "imdb": "tt0117218"
      },
      {
        "path": "Кино/Чокнутый профессор 2 - Семья Клампов.md",
        "name": "Чокнутый профессор 2 - Семья Клампов",
        "title": "Nutty Professor II: The Klumps",
        "imdb": "tt0144528"
      }
    ]
  },
  {
    "name": "Чудеса науки",
    "url": "https://en.wikipedia.org/wiki/Weird_Science_%28TV_series%29",
    "note": "",
    "members": [
      {
        "path": "Кино/Чудеса науки.md",
        "name": "Чудеса науки",
        "title": "Weird Science",
        "imdb": "tt0108988"
      }
    ]
  },
  {
    "name": "Чудо-женщина",
    "url": "https://en.wikipedia.org/wiki/Wonder_Woman_1984",
    "note": "",
    "members": [
      {
        "path": "Кино/Чудо-женщина.md",
        "name": "Чудо-женщина",
        "title": "Wonder Woman",
        "imdb": "tt0451279"
      }
    ],
    "related": [
      "Расширенная вселенная DC"
    ]
  },
  {
    "name": "Чёрный список",
    "url": "https://en.wikipedia.org/wiki/The_Blacklist%3A_Redemption",
    "note": "",
    "members": [
      {
        "path": "Кино/Чёрный список.md",
        "name": "Чёрный список",
        "title": "The Blacklist",
        "imdb": "tt2741602"
      }
    ]
  },
  {
    "name": "Шазам",
    "url": "https://en.wikipedia.org/wiki/Shazam%21_Fury_of_the_Gods",
    "note": "«Чёрный Адам» — спин-офф; не вторая часть «Шазама».",
    "members": [
      {
        "path": "Кино/Шазам!.md",
        "name": "Шазам!",
        "title": "Shazam!",
        "imdb": "tt0448115"
      },
      {
        "path": "Кино/Чёрный Адам.md",
        "name": "Чёрный Адам",
        "title": "Black Adam",
        "imdb": "tt6443346"
      }
    ],
    "related": [
      "Расширенная вселенная DC"
    ]
  },
  {
    "name": "Шальная пуля",
    "url": "https://en.wikipedia.org/wiki/Lost_Bullet_2",
    "note": "",
    "members": [
      {
        "path": "Кино/Шальная пуля.md",
        "name": "Шальная пуля",
        "title": "Balle perdue",
        "imdb": "tt10456740"
      },
      {
        "path": "Кино/Шальная пуля 2.md",
        "name": "Шальная пуля 2",
        "title": "Lost Bullet 2",
        "imdb": "tt14465706"
      }
    ]
  },
  {
    "name": "Шерлок Холмс",
    "url": "https://en.wikipedia.org/wiki/Sherlock_Holmes_in_film",
    "note": "Фильмы Гая Ричи и отдельная телевизионная версия BBC.",
    "members": [
      {
        "path": "Кино/Шерлок.md",
        "name": "Шерлок",
        "title": "Sherlock",
        "imdb": "tt1475582"
      },
      {
        "path": "Кино/Шерлок Холмс.md",
        "name": "Шерлок Холмс",
        "title": "Sherlock Holmes",
        "imdb": "tt0988045"
      },
      {
        "path": "Кино/Шерлок Холмс - Игра теней.md",
        "name": "Шерлок Холмс - Игра теней",
        "title": "Sherlock Holmes: A Game of Shadows",
        "imdb": "tt1515091"
      }
    ]
  },
  {
    "name": "Шутки в сторону",
    "url": "https://en.wikipedia.org/wiki/The_Takedown",
    "note": "Le Flic de Belleville («Шутки в сторону 2 — Миссия в Майами») — другой фильм, не продолжение.",
    "members": [
      {
        "path": "Кино/Шутки в сторону.md",
        "name": "Шутки в сторону",
        "title": "De l'autre côté du périph",
        "imdb": "tt1937133"
      }
    ]
  },
  {
    "name": "Эффект бабочки",
    "url": "https://en.wikipedia.org/wiki/The_Butterfly_Effect_2",
    "note": "",
    "members": [
      {
        "path": "Кино/Эффект бабочки.md",
        "name": "Эффект бабочки",
        "title": "The Butterfly Effect",
        "imdb": "tt0289879"
      }
    ]
  },
  {
    "name": "Зловещие мертвецы",
    "url": "https://en.wikipedia.org/wiki/Evil_Dead",
    "note": "",
    "members": [
      {
        "path": "Кино/Эш против зловещих мертвецов.md",
        "name": "Эш против зловещих мертвецов",
        "title": "Ash vs Evil Dead",
        "imdb": "tt4189022"
      }
    ]
  },
  {
    "name": "Алекс Кросс",
    "url": "https://en.wikipedia.org/wiki/Alex_Cross_%28film_series%29",
    "note": "",
    "members": [
      {
        "path": "Кино/Я, Алекс Кросс.md",
        "name": "Я, Алекс Кросс",
        "title": "Alex Cross",
        "imdb": "tt1712170"
      }
    ]
  },
  {
    "name": "Яркость",
    "url": "https://en.wikipedia.org/wiki/Bright%3A_Samurai_Soul",
    "note": "",
    "members": [
      {
        "path": "Кино/Яркость.md",
        "name": "Яркость",
        "title": "Bright",
        "imdb": "tt5519340"
      }
    ]
  },
  {
    "name": "Ёлки",
    "url": "https://en.wikipedia.org/wiki/Yolki",
    "note": "",
    "members": [
      {
        "path": "Кино/Ёлки.md",
        "name": "Ёлки",
        "title": "Ёлки",
        "imdb": "tt1782568"
      },
      {
        "path": "Кино/Ёлки 2.md",
        "name": "Ёлки 2",
        "title": "Ёлки 2",
        "imdb": "tt2124096"
      },
      {
        "path": "Кино/Ёлки 3.md",
        "name": "Ёлки 3",
        "title": "Ёлки 3",
        "imdb": "tt3121434"
      },
      {
        "path": "Кино/Ёлки 1914.md",
        "name": "Ёлки 1914",
        "title": "Ёлки 1914",
        "imdb": "tt3877844"
      },
      {
        "path": "Кино/Ёлки 5.md",
        "name": "Ёлки 5",
        "title": "Ёлки 5",
        "imdb": "tt5840988"
      },
      {
        "path": "Кино/Ёлки новые.md",
        "name": "Ёлки новые",
        "title": "Ёлки новые",
        "imdb": "tt6907804"
      },
      {
        "path": "Кино/Ёлки последние.md",
        "name": "Ёлки последние",
        "title": "Ёлки последние",
        "imdb": "tt9615680"
      },
      {
        "path": "Кино/Ёлки 8.md",
        "name": "Ёлки 8",
        "title": "Ёлки 8",
        "imdb": "tt16148580"
      },
      {
        "path": "Кино/Ёлки 9.md",
        "name": "Ёлки 9",
        "title": "Ёлки 9",
        "imdb": "tt22059202"
      }
    ]
  },
  {
    "name": "Шекер",
    "url": "https://ru.wikipedia.org/wiki/%D0%A8%D0%B5%D0%BA%D0%B5%D1%80_%28%D1%81%D0%B5%D1%80%D0%B8%D0%B0%D0%BB%29",
    "note": "",
    "members": [
      {
        "path": "Кино/Sheker - Последний шанс.md",
        "name": "Sheker - Последний шанс",
        "title": "Sheker. Poslednij shans",
        "imdb": "tt37660303"
      }
    ]
  },
  {
    "name": "Вспомнить всё",
    "url": "https://en.wikipedia.org/wiki/Total_Recall_%281990_film%29",
    "note": "Оригинал и ремейк; Rememory («Вспомни всё») не входит в эту группу.",
    "members": [
      {
        "path": "Кино/Вспомнить всё (1990).md",
        "name": "Вспомнить всё (1990)",
        "title": "Total Recall",
        "imdb": "tt0100802"
      },
      {
        "path": "Кино/Вспомнить всё (2012).md",
        "name": "Вспомнить всё (2012)",
        "title": "Total Recall",
        "imdb": "tt1386703"
      }
    ]
  },
  {
    "name": "Трилогия Корнетто",
    "url": "https://en.wikipedia.org/wiki/Three_Flavours_Cornetto",
    "note": "Авторская тематическая трилогия, не общая сюжетная вселенная.",
    "members": [
      {
        "path": "Кино/Зомби по имени Шон.md",
        "name": "Зомби по имени Шон",
        "title": "Shaun of the Dead",
        "imdb": "tt0365748"
      }
    ]
  },
  {
    "name": "Приключения Шурика",
    "url": "https://ru.wikipedia.org/wiki/%D0%A8%D1%83%D1%80%D0%B8%D0%BA",
    "note": "Объединение по персонажу; без пародий и ремейков.",
    "members": [
      {
        "path": "Кино/Кавказская пленница, или Новые приключения Шурика.md",
        "name": "Кавказская пленница, или Новые приключения Шурика",
        "title": "Кавказская пленница, или Новые приключения Шурика",
        "imdb": "tt0060584"
      },
      {
        "path": "Кино/Иван Васильевич меняет профессию.md",
        "name": "Иван Васильевич меняет профессию",
        "title": "Иван Васильевич меняет профессию",
        "imdb": "tt0070233"
      }
    ],
    "related": [
      "Трус, Балбес и Бывалый"
    ]
  },
  {
    "name": "Трус, Балбес и Бывалый",
    "url": "https://ru.wikipedia.org/wiki/%D0%A2%D1%80%D1%83%D1%81%2C_%D0%91%D0%B0%D0%BB%D0%B1%D0%B5%D1%81_%D0%B8_%D0%91%D1%8B%D0%B2%D0%B0%D0%BB%D1%8B%D0%B9",
    "note": "«Кавказская пленница» также связана с трио; её основная страница — «Приключения Шурика».",
    "members": [
      {
        "path": "Кино/Самогонщики.md",
        "name": "Самогонщики",
        "title": "Самогонщики",
        "imdb": "tt0055400"
      }
    ],
    "related": [
      "Приключения Шурика"
    ]
  },
  {
    "name": "Игра смерти",
    "url": "https://en.wikipedia.org/wiki/Game_of_Death_II",
    "note": "",
    "members": [
      {
        "path": "Кино/Игра смерти (1978).md",
        "name": "Игра смерти (1978)",
        "title": "Game of Death",
        "imdb": "tt0077594"
      }
    ]
  },
  {
    "name": "Мир Дикого Запада",
    "url": "https://en.wikipedia.org/wiki/Westworld_%28TV_series%29",
    "note": "",
    "members": [
      {
        "path": "Кино/Мир Дикого Запада.md",
        "name": "Мир Дикого Запада",
        "title": "Westworld",
        "imdb": "tt0475784"
      }
    ]
  },
  {
    "name": "Мыслить как преступник",
    "url": "https://en.wikipedia.org/wiki/Criminal_Minds_%28franchise%29",
    "note": "",
    "members": [
      {
        "path": "Кино/Мыслить как преступник.md",
        "name": "Мыслить как преступник",
        "title": "Criminal Minds",
        "imdb": "tt0452046"
      }
    ]
  },
  {
    "name": "Новичок",
    "url": "https://en.wikipedia.org/wiki/The_Rookie%3A_Feds",
    "note": "",
    "members": [
      {
        "path": "Кино/Новичок.md",
        "name": "Новичок",
        "title": "The Rookie",
        "imdb": "tt7587890"
      }
    ]
  },
  {
    "name": "Участок",
    "url": "https://ru.wikipedia.org/wiki/%D0%97%D0%B0%D0%BA%D0%BE%D0%BB%D0%B4%D0%BE%D0%B2%D0%B0%D0%BD%D0%BD%D1%8B%D0%B9_%D1%83%D1%87%D0%B0%D1%81%D1%82%D0%BE%D0%BA",
    "note": "",
    "members": [
      {
        "path": "Кино/Участок.md",
        "name": "Участок",
        "title": "Участок",
        "imdb": "tt0407456"
      }
    ]
  },
  {
    "name": "Училка",
    "url": "https://ru.wikipedia.org/wiki/%D0%9F%D0%BE%D1%81%D0%BB%D0%B5%D0%B4%D0%BD%D0%B5%D0%B5_%D0%B8%D1%81%D0%BF%D1%8B%D1%82%D0%B0%D0%BD%D0%B8%D0%B5",
    "note": "",
    "members": [
      {
        "path": "Кино/Училка.md",
        "name": "Училка",
        "title": "Училка",
        "imdb": "tt4574604"
      }
    ]
  },
  {
    "name": "Сквозь снег",
    "url": "https://en.wikipedia.org/wiki/Snowpiercer_%28TV_series%29",
    "note": "",
    "members": [
      {
        "path": "Кино/Сквозь снег.md",
        "name": "Сквозь снег",
        "title": "Snowpiercer",
        "imdb": "tt1706620"
      }
    ]
  },
  {
    "name": "Стрелок",
    "url": "https://en.wikipedia.org/wiki/Shooter_%28TV_series%29",
    "note": "",
    "members": [
      {
        "path": "Кино/Стрелок.md",
        "name": "Стрелок",
        "title": "Shooter",
        "imdb": "tt0822854"
      }
    ]
  },
  {
    "name": "Небесный суд",
    "url": "https://ru.wikipedia.org/wiki/%D0%9D%D0%B5%D0%B1%D0%B5%D1%81%D0%BD%D1%8B%D0%B9_%D1%81%D1%83%D0%B4",
    "note": "",
    "members": [
      {
        "path": "Кино/Небесный суд.md",
        "name": "Небесный суд",
        "title": "Небесный суд",
        "imdb": "tt13802014"
      }
    ]
  },
  {
    "name": "Дирк Джентли",
    "url": "https://en.wikipedia.org/wiki/Dirk_Gently%27s_Holistic_Detective_Agency_%28TV_series%29",
    "note": "Разные телевизионные экранизации книг Дугласа Адамса.",
    "members": [
      {
        "path": "Кино/Дирк Джентли.md",
        "name": "Дирк Джентли",
        "title": "Dirk Gently",
        "imdb": "tt2303367"
      }
    ]
  },
  {
    "name": "Старики-разведчики",
    "url": "https://www.bild.de/service/regio/kundschafter-des-friedens-2-ruestige-ex-spione-mischen-kuba-auf-6790f2a780e66176bf9c2c07",
    "note": "",
    "members": [
      {
        "path": "Кино/Старики-разведчики.md",
        "name": "Старики-разведчики",
        "title": "Kundschafter des Friedens",
        "imdb": "tt5076054"
      }
    ]
  },
  {
    "name": "Тренировочный день",
    "url": "https://en.wikipedia.org/wiki/Training_Day_%28TV_series%29",
    "note": "",
    "members": [
      {
        "path": "Кино/Тренировочный день.md",
        "name": "Тренировочный день",
        "title": "Training Day",
        "imdb": "tt0139654"
      }
    ]
  },
  {
    "name": "Чёрное зеркало",
    "url": "https://en.wikipedia.org/wiki/Black_Mirror%3A_Bandersnatch",
    "note": "",
    "members": [
      {
        "path": "Кино/Чёрное зеркало.md",
        "name": "Чёрное зеркало",
        "title": "Black Mirror",
        "imdb": "tt2085059"
      }
    ]
  },
  {
    "name": "Эволюция",
    "url": "https://en.wikipedia.org/wiki/Alienators%3A_Evolution_Continues",
    "note": "",
    "members": [
      {
        "path": "Кино/Эволюция.md",
        "name": "Эволюция",
        "title": "Evolution",
        "imdb": "tt0251075"
      }
    ]
  },
  {
    "name": "Луна 2112",
    "url": "https://en.wikipedia.org/wiki/Mute_%282018_film%29",
    "note": "«Луна 2112» и «Немой» происходят в общей вселенной Дункана Джонса.",
    "members": [
      {
        "path": "Кино/Луна 2112.md",
        "name": "Луна 2112",
        "title": "Moon",
        "imdb": "tt1182345"
      }
    ]
  },
  {
    "name": "Мистер и миссис Смит",
    "url": "https://en.wikipedia.org/wiki/Mr._%26_Mrs._Smith_%282024_TV_series%29",
    "note": "Телевизионная версия переосмысляет фильм; это не продолжение его сюжета.",
    "members": [
      {
        "path": "Кино/Мистер и миссис Смит.md",
        "name": "Мистер и миссис Смит",
        "title": "Mr. & Mrs. Smith",
        "imdb": "tt0356910"
      }
    ]
  },
  {
    "name": "Управление гневом",
    "url": "https://en.wikipedia.org/wiki/Anger_Management_%28TV_series%29",
    "note": "Телевизионная версия свободно основана на фильме.",
    "members": [
      {
        "path": "Кино/Управление гневом.md",
        "name": "Управление гневом",
        "title": "Anger Management",
        "imdb": "tt0305224"
      }
    ]
  }
];

// Таблица франшизы: та же логика, что в рабочей ручной команде.
function renderFranchise(dv) {
    const current = dv.current();
    function number(value) {
        if (value == null || String(value).trim() === "") return null;
        const result = Number(String(value).replace(",", "."));
        return Number.isFinite(result) ? result : null;
    }
    function release(value) {
        if (value?.toMillis) return value.toMillis();
        if (value instanceof Date) return value.getTime();
        const text = String(value ?? "").trim();
        if (/^\d{4}$/.test(text)) return Date.UTC(Number(text), 0, 1);
        const ru = text.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
        const result = ru ? Date.UTC(Number(ru[3]), Number(ru[2]) - 1, Number(ru[1])) : Date.parse(text);
        return Number.isFinite(result) ? result : Infinity;
    }
    function belongs(page) {
        const refs = Array.isArray(page["Франшиза"]) ? page["Франшиза"] : [page["Франшиза"]];
        return refs.some(ref => {
            if (!ref) return false;
            const path = typeof ref === "object" ? ref.path : String(ref).replace(/^\[\[/, "").replace(/\]\]$/, "").split("|")[0];
            return path && dv.page(path)?.file.path === current.file.path;
        });
    }
    const rows = dv.pages('"Кино"').array().filter(page => {
        if (["Просмотры", "Сезоны", "Франшизы"].some(folder => page.file.path.startsWith(`Кино/${folder}/`))) return false;
        const tags = (Array.isArray(page.tags) ? page.tags : [page.tags]).filter(Boolean)
            .map(tag => String(tag).replace(/^#/, ""));
        return tags.some(tag => tag === "movies" || tag === "serial") && belongs(page);
    });
    const byPart = String(current["Порядок"] ?? "").toLowerCase() === "части";
    rows.sort((a, b) => {
        const dates = release(a["Релиз"]) - release(b["Релиз"]);
        const parts = (number(a["Часть"]) ?? Infinity) - (number(b["Часть"]) ?? Infinity);
        return (byPart ? (parts || dates) : (dates || parts)) || a.file.name.localeCompare(b.file.name, "ru");
    });
    dv.paragraph(`Произведений: ${rows.length}. Порядок: ${byPart ? "по номерам частей" : "по дате выхода"}.`);
    if (!rows.length) {
        dv.paragraph("Добавь произведения командой QuickAdd «Франшиза».");
        return;
    }
    dv.table(["Часть", "Произведение", "Релиз", "Моя оценка", "КП", "IMDb"], rows.map(page => [
        number(page["Часть"]) ?? "—", page.file.link, page["Релиз"] ?? "—",
        number(page["Оценка"]) ?? "—", number(page["Оценка Кинопоиск"]) ?? "—",
        number(page["Оценка Imdb"]) ?? "—"
    ]));
}
