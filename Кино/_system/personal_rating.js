/* A rating edit changes an existing record; it never adds a viewing. */
const INSTANCE = Symbol.for("kino.personal-rating.dialog");
async function load(app, name) {
    const file = app.vault.getAbstractFileByPath(`Кино/_system/${name}.js`);
    if (!file) throw new Error(`Не найден ${name}.js`);
    const mod = { exports: {} };
    new Function("module", await app.vault.read(file))(mod);
    return mod.exports;
}

module.exports = async function openPersonalRating({ app, obsidian = {}, sourcePath, trigger, onSaved }) {
    const current = app[INSTANCE];
    if (current?.isOpen()) { current.focus(); return current; }
    if (!obsidian.Modal) throw new Error("Окно изменения оценки недоступно.");
    const store = await load(app, "personal_rating_store");
    const descriptor = await store.read({ app, obsidian, sourcePath });
    const refresh = await load(app, "personal_rating_refresh");
    class RatingModal extends obsidian.Modal {
        constructor() { super(app); this.opened = false; this.saving = false; this.repair = null; }
        isOpen() { return this.opened; }
        focus() { this.input?.focus(); }
        onOpen() {
            this.opened = true;
            this.modalEl.classList.add("kino-page", "kino-rating-modal");
            this.titleEl.textContent = "Моя оценка";
            const doc = this.contentEl.ownerDocument;
            const add = (parent, tag, cls, text) => {
                const node = doc.createElement(tag);
                if (cls) node.className = cls;
                if (text !== undefined) node.textContent = text;
                parent.appendChild(node); return node;
            };
            add(this.contentEl, "p", "kino-rating-title", descriptor.file.basename);
            const label = add(this.contentEl, "label", "kino-rating-field");
            add(label, "span", "", "Оценка от 1 до 10");
            const input = this.input = add(label, "input", "");
            input.type = "number"; input.min = "1"; input.max = "10"; input.step = "any";
            input.inputMode = "decimal"; input.autocomplete = "off";
            input.setAttribute("aria-label", "Моя оценка");
            input.value = descriptor.rating == null ? "" : String(descriptor.rating);
            const message = add(this.contentEl, "p", "kino-rating-message");
            message.setAttribute("role", "alert");
            const actions = add(this.contentEl, "div", "kino-rating-actions");
            const cancel = add(actions, "button", "", "Отмена"); cancel.type = "button";
            const save = add(actions, "button", "mod-cta", "Сохранить"); save.type = "button";
            cancel.addEventListener("click", () => this.close());
            const submit = async () => {
                if (this.saving) return;
                const raw = input.value.trim(), rating = Number(raw.replace(",", "."));
                if (!raw || !Number.isFinite(rating) || rating < 1 || rating > 10) {
                    message.textContent = "Укажи оценку от 1 до 10."; input.focus(); return;
                }
                this.saving = true; input.disabled = cancel.disabled = save.disabled = true;
                save.textContent = "Сохраняю…"; message.textContent = "";
                this.contentEl.setAttribute("aria-busy", "true");
                try {
                    const result = this.repair
                        ? await store.reconcile({ app, obsidian, sourcePath, rating: this.repair.rating, previousMediaRatingChanged: this.repair.mediaRatingChanged })
                        : await store.save({ app, obsidian, sourcePath, rating, expectedRating: descriptor.rating });
                    if (result.changed && result.mediaRatingChanged !== false) {
                        // Do not hold the dialog open for a collection-wide local
                        // forecast update. The worker owns progress and failures.
                        try {
                            const job = refresh.schedule({ app, obsidian, changedFiles: result.changedFiles, mediaFile: result.mediaFile });
                            job?.completion?.catch?.(() => {});
                        } catch (error) {
                            if (obsidian.Notice) new obsidian.Notice("Оценка сохранена. Не удалось запустить обновление прогнозов: " + (error.message || error), 9000);
                        }
                    }
                    try { onSaved?.(result); } catch (_) { /* Saved data remains valid if its old view was replaced. */ }
                    this.saving = false; this.close();
                } catch (error) {
                    if (error.partialSave) this.repair = { ...error.partialSave,
                        mediaRatingChanged: Boolean(error.partialSave.mediaRatingChanged || this.repair?.mediaRatingChanged) };
                    message.textContent = error.message || String(error);
                    this.saving = false; input.disabled = cancel.disabled = save.disabled = false;
                    save.textContent = this.repair ? "Повторить обновление" : "Сохранить";
                    if (this.repair) { input.value = String(this.repair.rating); input.disabled = true; cancel.textContent = "Закрыть"; }
                    this.contentEl.removeAttribute("aria-busy");
                    if (this.repair) save.focus(); else input.focus();
                }
            };
            save.addEventListener("click", submit);
            input.addEventListener("keydown", event => { if (event.key === "Enter") { event.preventDefault(); submit(); } });
            input.focus(); input.select();
        }
        close() { if (!this.saving) super.close(); }
        onClose() {
            this.opened = false;
            if (app[INSTANCE] === this) delete app[INSTANCE];
            this.contentEl.replaceChildren();
            if (trigger?.isConnected) trigger.focus();
        }
    }
    // Another pane may have opened the dialog while the modules were loading.
    const existing = app[INSTANCE];
    if (existing?.isOpen()) { existing.focus(); return existing; }
    const modal = new RatingModal(); app[INSTANCE] = modal; modal.open(); return modal;
};
