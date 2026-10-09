/* Books-only defaults. Existing notes are migrated separately; this plugin watches new notes. */
const BOOKS_PREFIX = "Книги/";

function linesOf(text) {
    const lines = [];
    const pattern = /([^\r\n]*)(\r\n|\r|\n|$)/g;
    let match;
    while ((match = pattern.exec(text)) && match[0]) lines.push({ text: match[1], eol: match[2] });
    return lines;
}

function valueSuffix(value) {
    let quote = "";
    for (let index = 0; index < value.length; index++) {
        const char = value[index];
        if (quote === '"' && char === "\\") { index++; continue; }
        if (quote === "'" && char === "'" && value[index + 1] === "'") { index++; continue; }
        if (quote) { if (char === quote) quote = ""; continue; }
        if (char === '"' || char === "'") { quote = char; continue; }
        if (char === "#" && (index === 0 || /[ \t]/.test(value[index - 1]))) {
            return (value.slice(0, index).match(/[ \t]*$/)[0] || " ") + value.slice(index);
        }
    }
    return value.match(/[ \t]*$/)[0];
}

/** Set one top-level YAML property without reserializing the note or its other properties. */
function ensurePreview(text) {
    if (typeof text !== "string") throw new TypeError("Note contents must be a string");
    const bom = text.startsWith("\uFEFF") ? "\uFEFF" : "";
    const content = text.slice(bom.length);
    const lines = linesOf(content);
    const eol = content.match(/\r\n|\r|\n/)?.[0] || "\n";
    const closing = lines.length && /^---[ \t]*$/.test(lines[0].text) && lines[0].eol
        ? lines.findIndex((line, index) => index > 0 && /^(?:---|\.\.\.)[ \t]*$/.test(line.text)) : -1;
    if (closing < 0) return `${bom}---${eol}obsidianUIMode: preview${eol}---${eol}${content}`;

    const output = [lines[0]];
    let found = false;
    for (let index = 1; index < closing; index++) {
        const line = lines[index];
        const property = /^(obsidianUIMode|'obsidianUIMode'|"obsidianUIMode")([ \t]*):([ \t]*)(.*)$/.exec(line.text);
        if (!property) { output.push(line); continue; }
        const suffix = valueSuffix(property[4]);
        if (!found) {
            output.push({ text: `${property[1]}${property[2]}:${property[3] || " "}preview${suffix}`, eol: line.eol });
            found = true;
        } else if (suffix.trimStart().startsWith("#")) {
            output.push({ text: suffix.trimStart(), eol: line.eol });
        }
        // Drop the replaced property's nested value, retaining standalone YAML comments and blank lines.
        while (index + 1 < closing) {
            const next = lines[index + 1];
            if (next.text && !/^[ \t]/.test(next.text) && !/^[ \t]*#/.test(next.text)) break;
            index++;
            if (!next.text.trim() || /^[ \t]*#/.test(next.text)) output.push(next);
        }
    }
    if (!found) output.push({ text: "obsidianUIMode: preview", eol: lines[0].eol });
    output.push(...lines.slice(closing));
    return bom + output.map(line => line.text + line.eol).join("");
}

let Plugin = class {};
let Notice;
try { ({ Plugin, Notice } = require("obsidian")); } catch (_) { /* Allows importing the pure helper outside Obsidian. */ }

class BookPreviewDefaults extends Plugin {
    onload() {
        this.pending = new Map();
        this.disposed = false;
        // During startup Obsidian emits create for existing notes as well.
        this.app.workspace.onLayoutReady(() => {
            if (this.disposed) return;
            this.registerEvent(this.app.vault.on("create", file => this.schedule(file)));
            this.registerEvent(this.app.vault.on("rename", (file, oldPath) => {
                if (oldPath.startsWith(BOOKS_PREFIX) || !file.path.startsWith(BOOKS_PREFIX)) return;
                if (file.extension === "md") this.schedule(file);
                else for (const note of this.app.vault.getMarkdownFiles()) {
                    if (note.path.startsWith(file.path + "/")) this.schedule(note);
                }
            }));
        });
    }

    isBook(file) {
        return file?.extension === "md" && file.path.startsWith(BOOKS_PREFIX);
    }

    schedule(file) {
        if (this.disposed || !this.isBook(file)) return;
        clearTimeout(this.pending.get(file));
        this.pending.set(file, setTimeout(() => {
            this.pending.delete(file);
            void this.apply(file);
        }, 100));
    }

    async apply(file) {
        if (this.disposed || !this.isBook(file) || this.app.vault.getAbstractFileByPath(file.path) !== file) return;
        try {
            await this.app.vault.process(file, text => this.disposed || !this.isBook(file) ? text : ensurePreview(text));
        } catch (error) {
            console.error("Книги: не удалось включить режим чтения", file.path, error?.message || "Ошибка записи");
            if (Notice) new Notice(`Не удалось включить режим чтения: ${file.path}`, 7000);
        }
    }

    onunload() {
        this.disposed = true;
        for (const timer of this.pending?.values() || []) clearTimeout(timer);
        this.pending?.clear();
    }
}

BookPreviewDefaults.ensurePreview = ensurePreview;
module.exports = BookPreviewDefaults;
