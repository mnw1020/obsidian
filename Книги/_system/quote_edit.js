// Portable Obsidian module: edit one registered quote without rewriting its note.
const KNOWLEDGE_PATH = "Книги/_system/knowledge.js";
const META = "<!-- BOOK-EXCERPT:META -->";
const FIELDS = { text: null, section: "Раздел", themes: "Темы", conclusion: "Вывод", location: "Место в источнике", sourceTitle: "Произведение", sourceAuthors: "Автор" };

function linesWithOffsets(raw) {
    const lines = [];
    let start = 0;
    while (start < raw.length) {
        const lf = raw.indexOf("\n", start);
        const end = lf < 0 ? raw.length : lf + 1;
        const textEnd = lf < 0 ? end : raw[lf - 1] === "\r" ? lf - 1 : lf;
        lines.push({ start, end, text: raw.slice(start, textEnd), newline: raw.slice(textEnd, end) });
        start = end;
    }
    return lines;
}

function findExcerptBlock(raw, id) {
    if (!/^book-excerpt-[a-z0-9-]+$/i.test(String(id))) throw new Error("Некорректный идентификатор цитаты.");
    const lines = linesWithOffsets(String(raw)), matches = [];
    let fence = null;
    for (let i = 0; i < lines.length; i++) {
        const fenced = lines[i].text.match(/^\s*(`{3,}|~{3,})/);
        if (fenced) {
            if (!fence) fence = fenced[1];
            else if (fenced[1][0] === fence[0] && fenced[1].length >= fence.length) fence = null;
            continue;
        }
        if (fence || !/^>\s*\[!(quote|idea)\][+-]?(?:\s+.*)?$/i.test(lines[i].text)) continue;
        let end = i + 1;
        while (end < lines.length && /^>/.test(lines[end].text)) end++;
        const marker = lines.slice(i + 1, end).findIndex(line => line.text.replace(/^> ?/, "") === META);
        if (marker < 0) continue;
        let anchor = end;
        while (anchor < lines.length && !lines[anchor].text.trim()) anchor++;
        if (lines[anchor]?.text.match(/^\^(book-excerpt-[a-z0-9-]+)\s*$/i)?.[1] !== id) continue;
        const blockEnd = lines[anchor].start + lines[anchor].text.length;
        matches.push({ start: lines[i].start, end: blockEnd, header: i, marker: i + 1 + marker, bodyEnd: end, lines, raw: raw.slice(lines[i].start, blockEnd) });
        i = anchor;
    }
    if (matches.length !== 1) throw new Error(matches.length ? "Этот идентификатор встречается у нескольких цитат. Сохранение отменено." : "Цитата больше не найдена. Откройте страницу заново.");
    return matches[0];
}

function fieldSegments(block) {
    const segments = [];
    for (let index = block.marker + 1; index < block.bodyEnd; index++) {
        const match = block.lines[index].text.replace(/^> ?/, "").match(/^\*\*([^\n]*?):\*\*\s*(.*)$/);
        if (match) segments.push({ label: match[1], value: match[2], first: index, last: index + 1 });
        else if (segments.length) {
            const segment = segments.at(-1);
            segment.value += "\n" + block.lines[index].text.replace(/^> ?/, "").replace(/^  /, "");
            segment.last = index + 1;
        }
    }
    return segments;
}

function singleLine(value) { return String(value ?? "").replace(/[\r\n]+/g, " ").trim(); }
function multiline(value) { return String(value ?? "").replace(/\r\n/g, "\n").trim(); }
function list(value, author = false) {
    const items = Array.isArray(value) ? value : String(value ?? "").split(author ? /[;\n]+/ : /[,;\n]+/);
    const seen = new Set();
    return items.map(item => author ? singleLine(item) : singleLine(item).replace(/^#/, "")).filter(item => {
        const key = item.toLocaleLowerCase("ru").replace(/ё/g, "е").replace(/\s+/g, " ");
        if (!item || seen.has(key)) return false;
        seen.add(key); return true;
    });
}
function cleanValue(field, value) {
    if (field === "text" || field === "conclusion") return multiline(value);
    if (field === "themes" || field === "sourceAuthors") return list(value, field === "sourceAuthors").join("; ");
    if (field === "section") return singleLine(value).split("/").map(part => part.trim()).filter(Boolean).join("/");
    return singleLine(value);
}

function editableValues(block) {
    const fields = new Map(fieldSegments(block).map(segment => [segment.label, segment.value]));
    const values = { text: block.lines.slice(block.header + 1, block.marker).map(line => line.text.replace(/^> ?/, "")).join("\n").trim() };
    for (const [field, label] of Object.entries(FIELDS)) if (label) values[field] = cleanValue(field, fields.get(label));
    values.themes = list(values.themes);
    values.sourceAuthors = list(values.sourceAuthors, true);
    return values;
}

// baseline is the exact callout + separating whitespace + stable ^ID, without its final newline.
// Only fields present in value are editable. savedDate, ID, and unknown metadata stay untouched.
function replaceExcerpt(raw, id, value, baseline) {
    const block = findExcerptBlock(raw, id);
    if (typeof baseline !== "string" || block.raw !== baseline) throw new Error("Эта цитата изменилась, пока окно было открыто. Закройте его и откройте цитату заново.");
    const original = editableValues(block), segments = fieldSegments(block), edits = [];
    const newline = block.lines[block.header].newline || (raw.includes("\r\n") ? "\r\n" : "\n");
    for (const [field, label] of Object.entries(FIELDS)) {
        if (!Object.prototype.hasOwnProperty.call(value, field)) continue;
        const next = cleanValue(field, value[field]);
        if (field === "text" && !next) throw new Error("Введите текст цитаты.");
        if (field === "text" && (next.includes(META) || /^\^book-excerpt-/m.test(next))) throw new Error("Текст уже содержит служебные маркеры цитаты.");
        const matching = label ? segments.filter(segment => segment.label === label) : [];
        const explicitInheritedOverride = (field === "section" || field === "sourceAuthors") && !matching.length;
        if (cleanValue(field, original[field]) === next && !explicitInheritedOverride) continue;
        if (field === "text") {
            edits.push({ from: block.lines[block.header + 1].start, to: block.lines[block.marker].start, text: next.split("\n").map(line => `> ${line}`).join(newline) + newline + ">" + newline });
            continue;
        }
        if (matching.length > 1) throw new Error(`Поле «${label}» повторяется. Сохранение отменено, чтобы не потерять данные.`);
        const fieldLines = next.split("\n");
        const replacement = `> **${label}:** ${fieldLines[0]}` + fieldLines.slice(1).map(line => `${newline}>   ${line}`).join("") + newline;
        if (matching.length) {
            const segment = matching[0];
            edits.push({ from: block.lines[segment.first].start, to: block.lines[segment.last - 1].end, text: replacement });
        } else if (next || field === "section" || field === "sourceAuthors") {
            const last = block.lines[block.bodyEnd - 1];
            edits.push({ from: last.end, to: last.end, text: (last.newline ? "" : newline) + replacement });
        }
    }
    // Descending offsets preserve all bytes outside each edited span, including mixed line endings.
    return edits.sort((a, b) => b.from - a.from).reduce((text, edit) => text.slice(0, edit.from) + edit.text + text.slice(edit.to), raw);
}

async function loadKnowledge(app) {
    const file = app.vault.getAbstractFileByPath(KNOWLEDGE_PATH);
    if (!file) throw new Error("Не найден модуль цитат.");
    const mod = { exports: {} };
    new Function("module", await app.vault.read(file))(mod);
    if (typeof mod.exports.parseExcerpts !== "function" || typeof mod.exports.renderExcerpt !== "function") throw new Error("Модуль цитат не поддерживает редактирование.");
    return mod.exports;
}

function child(parent, tag, text, cls) {
    const node = parent.ownerDocument.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (cls) node.className = cls;
    parent.appendChild(node); return node;
}

async function editQuote({ app, obsidian, entry, onSaved } = {}) {
    try {
        if (!obsidian?.Modal) throw new Error("Окно редактирования недоступно.");
        if (!app?.vault?.process) throw new Error("Для безопасного сохранения требуется актуальная версия Obsidian.");
        const path = entry?.path, id = entry?.id;
        const file = app.vault.getAbstractFileByPath(path);
        if (!file || file.path !== path) throw new Error("Источник цитаты больше не найден.");
        const knowledge = await loadKnowledge(app);
        const initialRaw = await app.vault.read(file);
        const parsed = knowledge.parseExcerpts(initialRaw).filter(quote => quote.id === id);
        if (parsed.length !== 1) throw new Error(parsed.length ? "Этот идентификатор встречается у нескольких цитат." : "Цитата больше не найдена.");
        const block = findExcerptBlock(initialRaw, id), baseline = block.raw;
        const original = { ...parsed[0], ...editableValues(block) };
        original.section = parsed[0].section !== undefined ? parsed[0].section : entry.section || "";
        if (entry.collection) original.sourceAuthors = parsed[0].sourceAuthors !== undefined ? parsed[0].sourceAuthors : entry.authors || [];
        class QuoteEditModal extends obsidian.Modal {
            onOpen() {
                const content = this.contentEl;
                if (content.empty) content.empty(); else content.replaceChildren();
                content.classList?.add("book-quote-edit");
                child(content, "style", ".book-quote-edit .book-quote-edit-field{display:grid;gap:6px;margin:14px 0}.book-quote-edit :is(input,textarea){width:100%;font:inherit;box-sizing:border-box}.book-quote-edit textarea{resize:vertical;min-height:90px}.book-quote-edit .book-quote-edit-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:20px}.book-quote-edit .book-quote-edit-error{color:var(--text-error);white-space:pre-wrap}.book-quote-edit .book-quote-edit-source{color:var(--text-muted);font-size:.85em;overflow-wrap:anywhere}");
                child(content, "h2", "Редактировать цитату");
                this.fields = {};
                const field = (name, label, value, multilineField = false, placeholder = "") => {
                    const group = child(content, "label", undefined, "book-quote-edit-field");
                    child(group, "span", label);
                    const input = child(group, multilineField ? "textarea" : "input");
                    if (!multilineField) input.type = "text";
                    input.value = Array.isArray(value) ? value.join("; ") : value || "";
                    input.placeholder = placeholder;
                    if (name === "text") { input.required = true; input.rows = 9; }
                    if (name === "conclusion") input.rows = 3;
                    input.setAttribute("aria-label", label);
                    this.fields[name] = input;
                };
                field("text", "Текст цитаты", original.text, true);
                field("section", "Раздел", original.section, false, "Раздел/Подраздел");
                field("themes", "Темы", original.themes, false, "Через ;");
                field("conclusion", "Мой вывод", original.conclusion, true);
                field("location", "Место в источнике", original.location);
                if (entry.collection) {
                    field("sourceTitle", "Произведение", original.sourceTitle);
                    field("sourceAuthors", "Автор", original.sourceAuthors, false, "Несколько авторов — через ;");
                } else {
                    child(content, "p", ["Источник: " + (entry.title || file.basename || path), ...(entry.authors || [])].join(" · "), "book-quote-edit-source");
                }
                this.errorEl = child(content, "p", "", "book-quote-edit-error");
                this.errorEl.setAttribute("role", "alert");
                const actions = child(content, "div", undefined, "book-quote-edit-actions");
                const cancel = child(actions, "button", "Отмена"); cancel.type = "button";
                cancel.addEventListener("click", () => this.close());
                this.saveButton = child(actions, "button", "Сохранить", "mod-cta"); this.saveButton.type = "button";
                this.saveButton.addEventListener("click", () => this.save());
            }
            async save() {
                if (this.saving) return;
                this.saving = true; this.saveButton.disabled = true; this.errorEl.textContent = "";
                try {
                    const value = Object.fromEntries(Object.entries(this.fields).map(([name, input]) => [name, input.value]));
                    value.themes = list(value.themes);
                    if (entry.collection) value.sourceAuthors = list(value.sourceAuthors, true);
                    knowledge.renderExcerpt({ ...original, ...value, id, savedDate: original.savedDate });
                    const changes = Object.fromEntries(Object.entries(value).filter(([field, next]) => cleanValue(field, next) !== cleanValue(field, original[field])));
                    if (!Object.keys(changes).length) { this.close(); return; }
                    if (replaceExcerpt(initialRaw, id, changes, baseline) === initialRaw) { this.close(); return; }
                    const currentFile = app.vault.getAbstractFileByPath(path);
                    if (currentFile !== file || file.path !== path) throw new Error("Источник цитаты изменился или больше не доступен.");
                    if (Object.prototype.hasOwnProperty.call(changes, "section") && changes.section) {
                        const storageFile = app.vault.getAbstractFileByPath("Книги/_system/quote_storage.js");
                        if (!storageFile) throw new Error("Не найден модуль папок цитат.");
                        const storage = { exports: {} }; new Function("module", await app.vault.read(storageFile))(storage);
                        changes.section = storage.exports.normalizeSectionPath(changes.section);
                        // Check the fresh quote before creating folders; the atomic write checks again.
                        replaceExcerpt(await app.vault.read(file), id, changes, baseline);
                        await storage.exports.ensureSectionFolders(app, changes.section);
                    }
                    await app.vault.process(file, raw => {
                        if (app.vault.getAbstractFileByPath(path) !== file || file.path !== path) throw new Error("Источник цитаты больше не доступен.");
                        const found = knowledge.parseExcerpts(raw).filter(quote => quote.id === id);
                        if (found.length !== 1) throw new Error("Цитата больше не найдена однозначно. Сохранение отменено.");
                        return replaceExcerpt(raw, id, changes, baseline);
                    });
                    this.close();
                    if (onSaved) {
                        try { await onSaved({ path, id }); }
                        catch (error) { if (obsidian.Notice) new obsidian.Notice("Цитата сохранена. Не удалось обновить страницу: " + (error.message || error)); }
                    }
                } catch (error) { this.errorEl.textContent = error.message || String(error); }
                finally { this.saving = false; this.saveButton.disabled = false; }
            }
        }
        const modal = new QuoteEditModal(app);
        modal.open(); return modal;
    } catch (error) {
        if (obsidian?.Notice) new obsidian.Notice(error.message || String(error));
        return null;
    }
}

module.exports = Object.assign(editQuote, { replaceExcerpt });
