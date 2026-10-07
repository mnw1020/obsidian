// Native forms write only the collection note, using an atomic Markdown transform.
async function loadStorage(app) {
    const file = app.vault.getAbstractFileByPath('Книги/_system/poetry_storage.js');
    if (!file) throw new Error('Не найден модуль сохранения стихов.');
    const storage = { exports: {} };
    new Function('module', await app.vault.read(file))(storage);
    return storage.exports;
}

async function openForm({ app, obsidian, sourcePath, poems = [], parsePoems, entry, initial = {}, onSaved }) {
    if (!obsidian?.Modal) throw new Error('Окно редактирования недоступно.');
    const storage = await loadStorage(app);
    const initialFile = app.vault.getAbstractFileByPath(sourcePath);
    if (!initialFile) throw new Error('Заметка со стихами была удалена.');
    const editing = Boolean(entry);
    return new Promise(resolve => {
        let settled = false, saving = false, result = null;
        class PoetryForm extends obsidian.Modal {
            close() { if (!saving) super.close(); }
            onOpen() {
                this.modalEl.classList.add('book-poetry-modal');
                const content = this.contentEl, doc = content.ownerDocument;
                const node = (tag, text, parent = content) => {
                    const element = doc.createElement(tag); if (text !== undefined) element.textContent = text;
                    parent.appendChild(element); return element;
                };
                node('style', '.book-poetry-modal{width:min(660px,calc(100vw - 32px));max-width:100%;box-sizing:border-box}.book-poetry-modal *{box-sizing:border-box}.book-poetry-modal .book-poetry-form-field{display:block;margin:16px 0}.book-poetry-modal .book-poetry-form-field>span{display:block;font-size:.85em;color:var(--text-muted);margin-bottom:6px}.book-poetry-modal input,.book-poetry-modal textarea{display:block;width:100%;max-width:100%;min-width:0;font:inherit}.book-poetry-modal textarea{min-height:240px;resize:vertical;white-space:pre-wrap;line-height:1.6}.book-poetry-modal .book-poetry-form-actions{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:10px;margin-top:20px}.book-poetry-modal .book-poetry-form-actions button{min-height:40px;white-space:normal;height:auto}.book-poetry-modal .book-poetry-form-error{color:var(--text-error);font-size:.85em;overflow-wrap:anywhere}.book-poetry-modal .book-poetry-form-hint{color:var(--text-muted);font-size:.8em;line-height:1.6}');
                node('h2', editing ? 'Редактировать стихотворение' : 'Добавить стихотворение');
                const field = (label, tag, value) => {
                    const wrapper = node('label'); wrapper.className = 'book-poetry-form-field';
                    node('span', label, wrapper); const input = node(tag, undefined, wrapper);
                    input.setAttribute('aria-label', label); input.value = value || ''; return input;
                };
                const author = field('Автор', 'input', entry?.author || initial.author);
                author.type = 'text'; author.autocomplete = 'off'; author.placeholder = 'Выберите из подсказок или укажите нового';
                const suggestions = node('datalist'); suggestions.id = `poetry-authors-${Math.random().toString(36).slice(2)}`;
                author.setAttribute('list', suggestions.id);
                for (const name of new Set(poems.map(poem => poem.author))) { const option = node('option', undefined, suggestions); option.value = name; }
                const title = field('Название', 'input', entry?.title); title.type = 'text'; title.placeholder = 'Название или первая строка';
                const text = field('Текст стихотворения', 'textarea', entry?.text); text.placeholder = 'Сохраните переносы строк. Между строфами оставьте пустую строку.';
                const hint = node('p', 'Каждая новая строка сохраняется как строка стиха. Пустая строка разделяет строфы.'); hint.className = 'book-poetry-form-hint';
                const error = node('p'); error.className = 'book-poetry-form-error'; error.setAttribute('role', 'alert'); error.hidden = true;
                const actions = node('div'); actions.className = 'book-poetry-form-actions';
                const cancel = node('button', 'Отмена', actions); cancel.type = 'button';
                const save = node('button', editing ? 'Сохранить' : 'Добавить', actions); save.type = 'button'; save.className = 'mod-cta';
                cancel.addEventListener('click', () => { if (!saving) this.close(); });
                save.addEventListener('click', async () => {
                    if (saving) return;
                    saving = true; save.disabled = true; cancel.disabled = true; error.hidden = true;
                    for (const input of [author, title, text]) input.disabled = true;
                    try {
                        const file = app.vault.getAbstractFileByPath(sourcePath);
                        if (file !== initialFile) throw new Error('Заметка была перемещена или заменена. Откройте сборник снова.');
                        const values = { author: author.value, title: title.value, text: text.value };
                        let savedRaw;
                        await app.vault.process(file, raw => {
                            savedRaw = editing ? storage.replacePoem(raw, entry, values, parsePoems) : storage.addPoem(raw, values, parsePoems);
                            return savedRaw;
                        });
                        result = parsePoems(savedRaw).find(poem => poem.author === values.author.trim() && poem.title === values.title.trim()) || { author: values.author.trim(), title: values.title.trim() };
                        // A callback failure after persistence must never invite a duplicate save.
                        try { await onSaved?.(result); }
                        catch (problem) { if (obsidian.Notice) new obsidian.Notice(`Стихотворение сохранено. Обновите сборник: ${problem.message || problem}`); }
                        saving = false; this.close();
                    } catch (problem) {
                        error.textContent = problem.message || String(problem); error.hidden = false;
                    } finally { saving = false; save.disabled = false; cancel.disabled = false; for (const input of [author, title, text]) input.disabled = false; }
                });
                author.focus();
            }
            onClose() { if (!settled) { settled = true; resolve(result); } }
        }
        const modal = new PoetryForm(app); modal.open();
    });
}

async function deletePoem({ app, obsidian, sourcePath, entry, parsePoems, onDeleted }) {
    if (!obsidian?.Modal) throw new Error('Окно удаления недоступно.');
    const storage = await loadStorage(app), initialFile = app.vault.getAbstractFileByPath(sourcePath);
    if (!initialFile) throw new Error('Заметка со стихами была удалена.');
    return new Promise(resolve => {
        let saved = false, busy = false, settled = false;
        class DeletePoetry extends obsidian.Modal {
            close() { if (!busy) super.close(); }
            onOpen() {
                this.modalEl.classList.add('book-poetry-modal');
                const content = this.contentEl, doc = content.ownerDocument;
                const node = (tag, text, parent = content) => { const element = doc.createElement(tag); if (text !== undefined) element.textContent = text; parent.appendChild(element); return element; };
                node('style', '.book-poetry-modal{width:min(560px,calc(100vw - 32px));max-width:100%;box-sizing:border-box}.book-poetry-modal *{box-sizing:border-box}.book-poetry-modal .book-poetry-delete-preview{white-space:pre-wrap;overflow-wrap:anywhere;color:var(--text-muted);padding:14px;border:1px solid var(--background-modifier-border);border-radius:8px;max-height:220px;overflow-y:auto}.book-poetry-modal .book-poetry-form-actions{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:10px;margin-top:20px}.book-poetry-modal button{min-height:40px;height:auto;white-space:normal}.book-poetry-modal .book-poetry-form-error{color:var(--text-error);overflow-wrap:anywhere}');
                node('h2', 'Удалить стихотворение?');
                node('p', `${entry.author} · ${entry.title}`);
                const preview = node('p', entry.text.length > 240 ? entry.text.slice(0, 240) + '…' : entry.text); preview.className = 'book-poetry-delete-preview';
                node('p', 'Будет удалён только этот текст. Остальные стихотворения сохранятся.');
                const error = node('p'); error.className = 'book-poetry-form-error'; error.setAttribute('role', 'alert'); error.hidden = true;
                const actions = node('div'); actions.className = 'book-poetry-form-actions';
                const cancel = node('button', 'Отмена', actions); cancel.type = 'button';
                const remove = node('button', 'Удалить', actions); remove.type = 'button'; remove.className = 'mod-warning';
                cancel.addEventListener('click', () => { if (!busy) this.close(); });
                remove.addEventListener('click', async () => {
                    if (busy) return;
                    busy = true; remove.disabled = true; cancel.disabled = true; error.hidden = true;
                    try {
                        const file = app.vault.getAbstractFileByPath(sourcePath);
                        if (file !== initialFile) throw new Error('Заметка была перемещена или заменена. Откройте сборник снова.');
                        await app.vault.process(file, raw => storage.removePoem(raw, entry, parsePoems)); saved = true;
                        try { await onDeleted?.(entry); }
                        catch (problem) { if (obsidian.Notice) new obsidian.Notice(`Стихотворение удалено. Обновите сборник: ${problem.message || problem}`); }
                        busy = false; this.close();
                    } catch (problem) { error.textContent = problem.message || String(problem); error.hidden = false; }
                    finally { busy = false; remove.disabled = false; cancel.disabled = false; }
                });
                cancel.focus();
            }
            onClose() { if (!settled) { settled = true; resolve(saved); } }
        }
        new DeletePoetry(app).open();
    });
}

module.exports = { openCreate: args => openForm({ ...args, entry: undefined }), editPoem: openForm, deletePoem };
