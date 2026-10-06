// Portable native Obsidian form. Persistence belongs to the caller's onSave callback.
function normalize(value) {
    return String(value ?? "").toLocaleLowerCase("ru").replace(/ё/g, "е").replace(/\s+/g, " ").trim();
}
function unique(values) {
    const found = new Set();
    return values.map(value => String(value ?? "").trim()).filter(value => {
        const key = normalize(value);
        if (!key || found.has(key)) return false;
        found.add(key); return true;
    });
}
function authorNames(value) {
    return unique(Array.isArray(value) ? value : String(value ?? "").split(/[;\n]+/));
}
function child(parent, tag, text, cls) {
    const node = parent.ownerDocument.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (cls) node.className = cls;
    parent.appendChild(node); return node;
}
function prepareBooks(books = []) {
    const paths = new Set();
    const records = books.filter(book => book?.file?.path && !paths.has(book.file.path) && paths.add(book.file.path)).map(book => ({
        path: book.file.path,
        title: String(book.fm?.title || book.file.basename || book.file.path).trim(),
        authors: unique(Array.isArray(book.fm?.authors) ? book.fm.authors : [book.fm?.authors])
    })).sort((a, b) => a.title.localeCompare(b.title, "ru") || a.path.localeCompare(b.path, "ru"));
    const titleCounts = new Map();
    for (const book of records) titleCounts.set(normalize(book.title), (titleCounts.get(normalize(book.title)) || 0) + 1);
    return records.map(book => ({ ...book, label: [book.title, book.authors.join(", "),
        titleCounts.get(normalize(book.title)) > 1 ? book.path.replace(/^Книги\//, "") : ""].filter(Boolean).join(" · ") }));
}

const STYLE = `
.book-quote-create-modal{width:min(640px,calc(100vw - 32px));max-width:100%;}
.book-quote-create{min-width:0;max-height:80vh;overflow-y:auto;padding:2px;}
.book-quote-create *{box-sizing:border-box;}
.book-quote-create h2{margin:0 0 20px;font-size:1.35em;line-height:1.3;}
.book-quote-create .book-quote-create-field{display:grid;gap:6px;margin:14px 0;min-width:0;}
.book-quote-create .book-quote-create-field>span{font-size:.85em;color:var(--text-muted);}
.book-quote-create :is(input,textarea,select){width:100%;min-width:0;max-width:100%;font:inherit;box-sizing:border-box;}
.book-quote-create :is(input,select){min-height:38px;}
.book-quote-create textarea{resize:vertical;line-height:1.55;min-height:70px;}
.book-quote-create .book-quote-create-source{border:1px solid var(--background-modifier-border);border-radius:9px;padding:0 13px;background:var(--background-secondary);}
.book-quote-create .book-quote-create-columns{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 14px;min-width:0;}
.book-quote-create .book-quote-create-additional{margin:18px 0;}
.book-quote-create .book-quote-create-additional>summary{cursor:pointer;font-size:.85em;color:var(--text-muted);}
.book-quote-create .book-quote-create-actions{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:10px;padding:14px 0 2px;border-top:1px solid var(--background-modifier-border);}
.book-quote-create .book-quote-create-actions button{min-height:38px;max-width:100%;white-space:normal;}
.book-quote-create .book-quote-create-error{color:var(--text-error,#c64b45);white-space:pre-wrap;overflow-wrap:anywhere;margin:14px 0;}
.book-quote-create [hidden]{display:none!important;}
@media(max-width:480px){.book-quote-create-modal{width:calc(100vw - 24px);}.book-quote-create .book-quote-create-columns{grid-template-columns:minmax(0,1fr);gap:0;}}
`;

async function openCreate({ app, obsidian, books = [], initial = {}, onSave } = {}) {
    if (typeof obsidian?.Modal !== "function") {
        if (obsidian?.Notice) new obsidian.Notice("Окно создания цитаты недоступно.");
        return null;
    }
    const records = prepareBooks(books);
    class QuoteCreateModal extends obsidian.Modal {
        onOpen() {
            const content = this.contentEl;
            if (content.empty) content.empty(); else content.replaceChildren();
            content.classList?.add("book-quote-create");
            this.modalEl?.classList?.add("book-quote-create-modal");
            child(content, "style", STYLE);
            child(content, "h2", "Новая цитата");
            this.fields = {};
            const field = (parent, name, label, value, { tag = "input", placeholder = "", rows } = {}) => {
                const group = child(parent, "label", undefined, "book-quote-create-field");
                child(group, "span", label);
                const input = child(group, tag);
                if (tag === "input") input.type = "text";
                if (tag !== "select") input.value = Array.isArray(value) ? value.join("; ") : String(value ?? "");
                input.placeholder = placeholder;
                if (rows) input.rows = rows;
                input.setAttribute("aria-label", label);
                this.fields[name] = input; return input;
            };
            const sourceKind = field(content, "sourceKind", "Источник", "", { tag: "select" });
            child(sourceKind, "option", "Книга из библиотеки").value = "book";
            child(sourceKind, "option", "Произвольная цитата").value = "free";
            sourceKind.value = initial.sourceKind === "book" || (initial.bookPath && initial.sourceKind !== "free") ? "book" : "free";

            this.bookFields = child(content, "div", undefined, "book-quote-create-source");
            const bookFilters = child(this.bookFields, "div", undefined, "book-quote-create-columns");
            const authorFilter = field(bookFilters, "authorFilter", "Автор книги", "", { tag: "select" });
            child(authorFilter, "option", "Все авторы").value = "";
            const authors = unique(records.flatMap(book => book.authors)).sort((a, b) => a.localeCompare(b, "ru"));
            for (const author of authors) child(authorFilter, "option", author).value = author;
            authorFilter.value = "";
            const bookSearch = field(bookFilters, "bookSearch", "Найти книгу", "", { placeholder: "Название или автор" });
            bookSearch.type = "search";
            const bookPath = field(this.bookFields, "bookPath", "Книга", "", { tag: "select" });
            const refreshBooks = () => {
                const selected = bookPath.value;
                const tokens = normalize(bookSearch.value).split(" ").filter(Boolean);
                const available = records.filter(book => (!authorFilter.value || book.authors.some(author => normalize(author) === normalize(authorFilter.value))) &&
                    tokens.every(token => normalize([book.title, ...book.authors, book.path].join(" ")).includes(token)));
                bookPath.replaceChildren();
                child(bookPath, "option", available.length ? "Выберите книгу" : records.length ? "Книги по этим условиям не найдены" : "В библиотеке пока нет книг").value = "";
                for (const book of available) child(bookPath, "option", book.label).value = book.path;
                bookPath.value = available.some(book => book.path === selected) ? selected : "";
            };
            authorFilter.addEventListener("change", refreshBooks);
            bookSearch.addEventListener("input", refreshBooks);
            this.refreshBooks = refreshBooks;
            refreshBooks();
            bookPath.value = records.some(book => book.path === initial.bookPath) ? initial.bookPath : "";

            this.freeFields = child(content, "div", undefined, "book-quote-create-source book-quote-create-columns");
            field(this.freeFields, "sourceAuthors", "Автор", initial.sourceAuthors, { placeholder: "Необязательно; несколько — через ;" });
            field(this.freeFields, "sourceTitle", "Произведение", initial.sourceTitle, { placeholder: "Необязательно" });
            const updateSource = () => { this.bookFields.hidden = sourceKind.value !== "book"; this.freeFields.hidden = sourceKind.value === "book"; };
            sourceKind.addEventListener("change", updateSource); updateSource();

            const text = field(content, "text", "Текст цитаты", initial.text, { tag: "textarea", rows: 6 });
            text.required = true;
            field(content, "section", "Раздел", initial.section, { placeholder: "Мотивация/Подраздел" });
            const additional = child(content, "details", undefined, "book-quote-create-additional");
            child(additional, "summary", "Дополнительно");
            field(additional, "themes", "Темы", initial.themes, { placeholder: "Через ;" });
            field(additional, "conclusion", "Мой вывод", initial.conclusion, { tag: "textarea", rows: 3 });
            field(additional, "location", "Место в источнике", initial.location, { placeholder: "Страница, глава или время" });
            additional.open = Boolean(initial.conclusion || initial.location || (Array.isArray(initial.themes) ? initial.themes.length : initial.themes));
            this.errorEl = child(content, "p", "", "book-quote-create-error");
            this.errorEl.setAttribute("role", "alert"); this.errorEl.hidden = true;
            const actions = child(content, "div", undefined, "book-quote-create-actions");
            this.cancelButton = child(actions, "button", "Отмена"); this.cancelButton.type = "button";
            this.cancelButton.addEventListener("click", () => { if (!this.saving) this.close(); });
            this.saveButton = child(actions, "button", "Сохранить", "mod-cta"); this.saveButton.type = "button";
            this.saveButton.addEventListener("click", () => this.save());
            text.focus?.();
        }
        async save() {
            if (this.saving) return;
            this.errorEl.textContent = ""; this.errorEl.hidden = true;
            const value = {
                sourceKind: this.fields.sourceKind.value,
                text: this.fields.text.value.replace(/\r\n/g, "\n").trim(),
                section: this.fields.section.value.trim(),
                themes: unique(this.fields.themes.value.split(/[,;\n]+/)),
                conclusion: this.fields.conclusion.value.replace(/\r\n/g, "\n").trim(),
                location: this.fields.location.value.replace(/[\r\n]+/g, " ").trim()
            };
            try {
                if (!value.text) { this.fields.text.focus?.(); throw new Error("Введите текст цитаты."); }
                if (value.sourceKind === "book") {
                    value.bookPath = this.fields.bookPath.value;
                    if (!records.some(book => book.path === value.bookPath)) { this.fields.bookPath.focus?.(); throw new Error("Выберите книгу из библиотеки."); }
                } else if (value.sourceKind === "free") {
                    value.sourceAuthors = authorNames(this.fields.sourceAuthors.value);
                    value.sourceTitle = this.fields.sourceTitle.value.replace(/[\r\n]+/g, " ").trim();
                } else throw new Error("Выберите источник цитаты.");
                if (typeof onSave !== "function") throw new Error("Сохранение цитаты недоступно.");
                this.saving = true; this.saveButton.disabled = true; this.cancelButton.disabled = true;
                const disabled = Object.values(this.fields).map(field => [field, Boolean(field.disabled)]);
                for (const [field] of disabled) field.disabled = true;
                try { await onSave(value); this.close(); }
                finally { for (const [field, wasDisabled] of disabled) field.disabled = wasDisabled; }
            } catch (error) { this.errorEl.textContent = error.message || String(error); this.errorEl.hidden = false; }
            finally { this.saving = false; this.saveButton.disabled = false; this.cancelButton.disabled = false; }
        }
    }
    const modal = new QuoteCreateModal(app);
    modal.open(); return modal;
}

module.exports = Object.assign(openCreate, { prepareBooks });
