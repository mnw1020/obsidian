/* Saved forecast explanation. Reads a snapshot only; never recalculates or writes. */
module.exports = async function openForecastDetails({ app, obsidian = {}, doc, sourcePath = "", reportReference, trigger, parent }) {
    let closed = false, modal = null, holder, fallback, focusBefore = trigger ?? doc.activeElement;
    const labels = {
        prediction: "Округлённый прогноз", raw: "До округления", base: "База", correction: "Поправка соседей",
        categoryCorrection: "Поправка категорий до коэффициента", weightedCategory: "Поправка категорий × 0,75",
        calibration: "Калибровка публичного рейтинга", a: "Свободный член", b: "Коэффициент публичного рейтинга",
        mean: "Среднее", globalMean: "Средняя личная оценка", publicMean: "Среднее IMDb / КП", imdb: "IMDb", kp: "Кинопоиск",
        imdbId: "IMDb ID", kpId: "Кинопоиск ID", name: "Название", title: "Название", description: "Описание",
        genres: "Жанры", directors: "Режиссёры", actors: "Актёры", type: "Тип", releaseYear: "Год", duration: "Длительность",
        franchise: "Франшиза", path: "Путь", rating: "Личная оценка", version: "Версия", modelId: "Модель", id: "Модель",
        revision: "Ревизия модели", dtype: "Квантование", dimension: "Размерность вектора", dimensions: "Размерность вектора",
        runtime: "Среда выполнения", pooling: "Объединение токенов", normalize: "Нормировка", prefix: "Префикс текста",
        maxTokens: "Предел токенов", tokens: "Число токенов", tokenCount: "Число токенов", truncated: "Текст обрезан",
        temperature: "Температура", smoothing: "Сглаживание", k: "Предел соседей", neighbors: "Соседи", status: "Статус", reason: "Причина",
        count: "Число карточек", sum: "Сумма отклонений", key: "Категория", group: "Группа", effect: "Эффект", contribution: "Вклад",
        weight: "Вес", share: "Доля веса", similarity: "Похожесть", residual: "Отклонение от базы", components: "Признаки",
        coefficient: "Коэффициент", weighted: "Взвешенный вклад", totalWeight: "Сумма весов", similaritySum: "Сумма сходств",
        fold: "Разбиение", outerFold: "Внешнее разбиение", size: "Число карточек", excluded: "Исключено", excludedPaths: "Исключённые карточки",
        excludedGroup: "Исключённая группа", trainingCount: "Карточек для обучения", selectedParameters: "Выбранные параметры",
        parameters: "Параметры", algorithm: "Алгоритм", formula: "Формула", seed: "Начальное значение разбиения", minSimilarity: "Порог похожести",
        maximumNeighbors: "Предел соседей", minimumSimilarity: "Порог похожести", unbounded: "До ограничения диапазона 1–10",
        entries: "Категории группы", sumWeights: "Сумма весов", denominator: "Сумма весов + сглаживание",
        descriptionHash: "Отпечаток описания", engine: "Версия алгоритма", ownRatingExcluded: "Собственная оценка исключена",
        dataWeight: "Вес данных", source: "Источник параметров", fitCount: "Карточек для подбора параметров", validation: "Независимая проверка",
        inputHash: "Отпечаток входных данных", parameterVersion: "Версия параметров", parameterCreatedAt: "Дата подбора параметров",
        mae: "Средняя абсолютная ошибка (MAE)", rmse: "Среднеквадратичная ошибка (RMSE)", legacy: "Прежний алгоритм",
        data: "По данным", plot: "По сюжету", half: "Смесь 50/50", tuned: "Подобранная смесь", note: "Примечание",
        shortDescription: "Использовано краткое описание", usedTokens: "Использовано токенов",
        weights: "Подобранные веса", effectiveWeights: "Веса доступных веток", plots: "Параметры сюжетных веток",
        models: "Модели", modelKey: "Ключ модели", modelVersion: "Версия модели", fitReason: "Правило подбора",
        plotParameterSelection: "Подбор параметров сюжетных веток", independentPlotTuning: "Отдельный подбор каждой сюжетной ветки",
        reliability: "Точность источников и веса", method: "Правило весов", pairedCount: "Карточек с обоими проверенными прогнозами",
        pairedGroupCount: "Групп произведений в проверке", minimumPairedCount: "Минимум карточек для выбора весов",
        dataMae: "Средняя ошибка прогноза по данным (MAE)", plotMae: "Средняя ошибка прогноза по сюжету (MAE)",
        dataRmse: "Ошибка прогноза по данным (RMSE)", plotRmse: "Ошибка прогноза по сюжету (RMSE)",
        rawDataWeight: "Вес данных до ограничения", plotWeight: "Вес сюжета", minWeight: "Минимальный вес источника",
        maxWeight: "Максимальный вес источника", rawWeights: "Веса до ограничения", fallbackReason: "Причина равных весов",
        data155: "По данным · 155", "plot-embeddinggemma": "По сюжету · EmbeddingGemma", embeddinggemma: "EmbeddingGemma"
    };
    const dataBranches = [["155", "По данным · 155"]];
    const plotBranches = [["embeddinggemma", "По сюжету · EmbeddingGemma"]];
    const multiple = report => Boolean(report.dataVariants || report.plotVariants);
    function el(parentEl, tag, cls, value) {
        const node = doc.createElement(tag);
        if (cls) node.className = cls;
        if (value !== undefined) node.textContent = String(value);
        parentEl.appendChild(node); return node;
    }
    function numeric(value) { return typeof value === "number" && Number.isFinite(value); }
    function fmt(value) {
        if (value == null) return "—";
        if (numeric(value)) return String(value).replace(".", ",");
        if (typeof value === "boolean") return value ? "да" : "нет";
        if (Array.isArray(value)) return value.map(fmt).join(" · ");
        if (typeof value === "object") { try { return JSON.stringify(value); } catch (_) { return String(value); } }
        return String(value);
    }
    function pathFor(value) {
        const raw = typeof value === "object" ? value?.path : value;
        return String(raw ?? "").trim().replace(/^\[\[|\]\]$/g, "").split("|")[0];
    }
    function link(parentEl, path, title) {
        if (!path) return el(parentEl, "span", "", title || "—");
        const a = el(parentEl, "a", "internal-link", title || path.split("/").pop().replace(/\.md$/i, ""));
        a.dataset.href = path;
        a.href = "obsidian://open?vault=" + encodeURIComponent(app.vault.getName()) + "&file=" + encodeURIComponent(path);
        a.addEventListener("click", event => {
            event.preventDefault(); app.workspace.openLinkText(path, sourcePath, Boolean(event.ctrlKey || event.metaKey));
        }); return a;
    }
    function fields(parentEl, object, keys = null, depth = 0) {
        if (!object || typeof object !== "object") { el(parentEl, "p", "kino-forecast-muted", fmt(object)); return; }
        if (Array.isArray(object)) { for (const item of object) fields(parentEl, item, null, depth); return; }
        const list = el(parentEl, "dl", "kino-forecast-fields");
        const entries = keys ? keys.filter(key => Object.prototype.hasOwnProperty.call(object, key)).map(key => [key, object[key]]) : Object.entries(object);
        for (const [key, value] of entries) {
            el(list, "dt", "", labels[key] ?? key);
            const dd = el(list, "dd");
            if (value && typeof value === "object" && !Array.isArray(value) && depth < 3) fields(dd, value, null, depth + 1);
            else if (key === "path") link(dd, pathFor(value));
            else if (Array.isArray(value) && value.some(item => item && typeof item === "object") && depth < 3) {
                for (const item of value) fields(dd, item, null, depth + 1);
            } else dd.textContent = fmt(value);
        }
    }
    function section(parentEl, title) { el(parentEl, "h3", "", title); }
    function formula(parentEl, value) { if (value != null) el(parentEl, "pre", "kino-forecast-formula", typeof value === "object" ? JSON.stringify(value, null, 2) : value); }
    function signed(value) { return numeric(value) && value >= 0 ? "+" + fmt(value) : fmt(value); }
    function neighbors(parentEl, items, plot = false) {
        section(parentEl, `Соседи: ${Array.isArray(items) ? items.length : 0}`);
        if (!Array.isArray(items) || !items.length) { el(parentEl, "p", "kino-forecast-muted", "Для этого расчёта соседи не использовались."); return; }
        const wrap = el(parentEl, "div", "kino-forecast-table-wrap");
        wrap.tabIndex = 0; wrap.setAttribute("role", "region"); wrap.setAttribute("aria-label", "Все соседи и их вклад; таблица с горизонтальной прокруткой");
        const table = el(wrap, "table", "kino-forecast-table");
        el(table, "caption", "kino-forecast-muted", "Вклад указан в баллах прогноза. Точные сохранённые значения показаны без округления.");
        const header = el(el(table, "thead"), "tr");
        const columns = [["#", null], ["Фильм или сериал", "name"], ["Ваша оценка", "rating"], ["Похожесть", "similarity"], ["Вес", "weight"], ["Доля веса", "share"], [plot ? "Отклонение от среднего" : "Отклонение от базы", "residual"], ["Вклад", "contribution"]];
        if (!plot) columns.splice(3, 0, ["База", "base"]);
        if (items.some(item => item.components)) columns.push(["Признаки", "components"]);
        for (const [name] of columns) el(header, "th", "", name).scope = "col";
        const body = el(table, "tbody");
        items.forEach((item, index) => {
            const row = el(body, "tr");
            for (const [, key] of columns) {
                const td = el(row, "td");
                if (!key) td.textContent = String(index + 1);
                else if (key === "name") link(td, pathFor(item.path), item.name ?? item.title ?? item.path);
                else if (key === "components" && item.components) {
                    const details = el(td, "details", "kino-forecast-components");
                    el(details, "summary", "", "Показать"); fields(details, item.components);
                } else td.textContent = key === "contribution" || key === "residual" ? signed(item[key]) : fmt(item[key]);
            }
        });
    }
    function finalPanel(panel, report) {
        const result = report.final ?? {}, data = report.data ?? {}, plot = report.plot ?? {};
        const reliability = report.training?.parameters?.reliability ?? result.reliability;
        section(panel, "Итоговый прогноз");
        const summary = el(panel, "div", "kino-forecast-result");
        el(summary, "strong", "", fmt(result.prediction)); el(summary, "span", "kino-forecast-muted", " / 10");
        if (result.provisional) el(panel, "p", "kino-forecast-notice", "Предварительный прогноз. " + (result.reason || "Анализ сюжета ещё не завершён; итог использует доступный расчёт."));
        if (multiple(report)) {
            const wrap = el(panel, "div", "kino-forecast-table-wrap");
            wrap.tabIndex = 0; wrap.setAttribute("role", "region"); wrap.setAttribute("aria-label", "Два прогноза и их веса; таблица с горизонтальной прокруткой");
            const table = el(wrap, "table", "kino-forecast-table");
            const header = el(el(table, "thead"), "tr");
            for (const name of ["Ветка", "Прогноз", "До округления", "Подобранный вес", "Вес в этом итоге"]) el(header, "th", "", name).scope = "col";
            const body = el(table, "tbody");
            for (const [id, label, branch] of [...dataBranches.map(([key, label]) => ["data" + key, label, report.dataVariants?.[key]]),
                ...plotBranches.map(([key, label]) => ["plot-" + key, label, report.plotVariants?.[key]])]) {
                const row = el(body, "tr");
                for (const value of [label, fmt(branch?.prediction), fmt(branch?.raw), fmt(result.weights?.[id]), fmt(result.effectiveWeights?.[id] ?? result.weights?.[id])]) el(row, "td", "", value);
                if (branch?.reason) el(panel, "p", "kino-forecast-muted", label + ": " + fmt(branch.reason));
            }
            fields(panel, { "Итог до округления": result.raw, "Итог после округления": result.prediction });
        } else fields(panel, { "По данным": data.prediction, "По сюжету": plot.prediction, "Вес данных": result.dataWeight,
            "Вес сюжета": result.plotWeight, "Итог до округления": result.raw, "Итог после округления": result.prediction });
        section(panel, "Формула");
        el(panel, "p", "kino-forecast-muted", "Итог объединяет прогнозы до округления с выбранными весами. Значение ограничивается диапазоном 1–10, затем округляется до десятых."
            + (reliability ? " Если доступны оба прогноза, каждый получает не менее 25% и не более 75%. Если сюжет ещё не рассчитан, предварительный итог использует прогноз по данным." : " Нулевой вес означает, что ветка показана отдельно и не влияет на итог."));
        formula(panel, result.formula ?? "Итог = вес данных × прогноз по данным + вес сюжета × прогноз по сюжету; затем округление до десятых.");
        if (multiple(report)) {
            const terms = [...dataBranches.map(([key]) => ["data" + key, report.dataVariants?.[key]]),
                ...plotBranches.map(([key]) => ["plot-" + key, report.plotVariants?.[key]])]
                .filter(([id, branch]) => numeric(branch?.raw) && numeric(result.effectiveWeights?.[id] ?? result.weights?.[id]))
                .map(([id, branch]) => `${fmt(result.effectiveWeights?.[id] ?? result.weights?.[id])} × ${fmt(branch.raw)}`);
            if (terms.length) formula(panel, terms.join(" + ") + " = " + fmt(result.raw) + " → " + fmt(result.prediction));
        } else if (numeric(data.raw) && numeric(plot.raw) && numeric(result.dataWeight) && numeric(result.plotWeight)) {
            formula(panel, `${fmt(result.dataWeight)} × ${fmt(data.raw)} + ${fmt(result.plotWeight)} × ${fmt(plot.raw)} = ${fmt(result.raw)} → ${fmt(result.prediction)}`);
        } else if (numeric(data.raw)) formula(panel, `${fmt(data.raw)} → ${fmt(result.prediction)}`);
        if (plot.reason) el(panel, "p", "kino-forecast-muted", "По сюжету: " + fmt(plot.reason));
        if (reliability) {
            section(panel, "Почему такие веса");
            el(panel, "p", "kino-forecast-muted", "Точность источников проверяется на ваших личных оценках: для каждого проверяемого произведения его оценка и оценки той же группы IMDb / Кинопоиска исключаются из обучения. Сравниваются ошибки двух прогнозов на одном наборе карточек. Чем меньше средняя абсолютная ошибка (MAE), тем больше вес источника.");
            el(panel, "p", "kino-forecast-muted", "Для этой карточки используются результаты внутренних проверок, выполненных без её внешней группы. Для нового произведения используются проверки по всей оценённой базе. Ограничение 25–75% сохраняет вклад обеих оценок; оно само по себе не гарантирует меньшую ошибку итогового прогноза.");
            formula(panel, "Вес данных до ограничения = MAE сюжета / (MAE данных + MAE сюжета).\nВес данных = min(0,75; max(0,25; вес данных до ограничения)).\nВес сюжета = 1 − вес данных.\nИтог = вес данных × прогноз по данным + вес сюжета × прогноз по сюжету.\nЕсли проверено меньше 30 карточек или 30 разных произведений с обоими прогнозами, либо сумма ошибок нулевая или недоступна, используются веса 50/50.");
            fields(panel, reliability, ["pairedCount", "pairedGroupCount", "minimumPairedCount", "dataMae", "plotMae", "dataRmse", "plotRmse", "rawDataWeight", "dataWeight", "plotWeight", "minWeight", "maxWeight", "fallbackReason", "formula"]);
            const validation = report.training?.validation;
            if (numeric(validation?.tuned?.mae) && numeric(validation?.data155?.mae) && validation.tuned.mae > validation.data155.mae) {
                const error = value => fmt(Math.round(value * 1000) / 1000);
                el(panel, "p", "kino-forecast-notice", `В общей независимой проверке средняя ошибка смеси — ${error(validation.tuned.mae)} балла, прогноза по данным — ${error(validation.data155.mae)}. Сейчас прогноз по данным точнее на этой проверке. Итог сохраняет вклад обоих источников по выбранному правилу весов.`);
            }
            el(panel, "p", "kino-forecast-muted", "При изменении ваших оценок веса будут проверены заново при следующем расчёте прогноза. Этот разбор хранит веса и значения, использованные для показанного итога; сам по себе просмотр окна ничего не пересчитывает.");
        }
        section(panel, "Исходные данные карточки"); fields(panel, report.target ?? {});
        if (report.training) { section(panel, "Обучающая выборка и исключения"); fields(panel, report.training); }
        if (report.model) { section(panel, "Локальная модель сюжета"); fields(panel, report.model); }
        if (report.models) { section(panel, "Локальные модели сюжета"); fields(panel, report.models); }
    }
    function dataPanel(panel, report, branchKey = null, branchLabel = "Прогноз по данным") {
        const data = branchKey ? report.dataVariants?.[branchKey] ?? {} : report.data ?? {};
        section(panel, branchLabel);
        el(panel, "p", "kino-forecast-muted", "Сходство метаданных: жанры, режиссёры, актёры, публичные рейтинги, год, длительность, тип и франшиза. Описание сюжета в эту ветку не входит.");
        fields(panel, data, ["prediction", "raw", "unbounded", "base", "globalMean", "calibration", "correction", "categoryCorrection", "weightedCategory", "maximumNeighbors", "minimumSimilarity", "parameters", "status", "reason"]);
        section(panel, "Формулы");
        formula(panel, "База = ограничить(a + b × среднее IMDb / КП, 1, 10); без публичного рейтинга — средняя личная оценка.\nПохожесть = Σ(коэффициент × сходство) / Σучаствующих коэффициентов.\nВес соседа = похожесть³. Остаток = ваша оценка соседа − его база.\nПоправка соседей = Σ(вес × остаток) / Σвесов.\nПоправка категорий = среднее эффектов групп; эффект категории = сумма остатков / (число карточек + 10).\nПрогноз = ограничить(база + поправка соседей + 0,75 × поправка категорий, 1, 10).\nОграничить(x, 1, 10) = min(10, max(1, x)).");
        if (data.formula) formula(panel, data.formula);
        if (numeric(data.base) && numeric(data.correction)) {
            const weighted = numeric(data.weightedCategory) ? data.weightedCategory : numeric(data.categoryCorrection) ? .75 * data.categoryCorrection : 0;
            formula(panel, `ограничить(${fmt(data.base)} ${signed(data.correction)} ${signed(weighted)}, 1, 10) = ${fmt(data.raw)} → ${fmt(data.prediction)}`);
        }
        if (data.coefficients) { section(panel, "Коэффициенты похожести"); fields(panel, data.coefficients); }
        if (Array.isArray(data.categories) && data.categories.length) {
            section(panel, "Поправки по категориям");
            for (const category of data.categories) fields(panel, category);
        }
        neighbors(panel, data.neighbors);
    }
    function plotPanel(panel, report, branchKey = null, branchLabel = "Прогноз по сюжету") {
        const plot = branchKey ? report.plotVariants?.[branchKey] ?? {} : report.plot ?? {};
        section(panel, branchLabel);
        el(panel, "p", "kino-forecast-muted", "Соседи выбраны по косинусному сходству смысловых векторов описаний. Для оценки используются только ваши оценки этих соседей.");
        if (branchKey) el(panel, "p", "kino-forecast-muted", "Число соседей, температура и сглаживание подбираются для сюжетной ветки отдельно, по ошибке её прогноза. "
            + (report.training?.parameters?.reliability ?? report.final?.reliability
                ? "Веса данных и сюжета для итоговой оценки рассчитываются по проверенной точности двух источников."
                : "Затем подбираются веса данных и сюжета для итоговой оценки."));
        if (plot.reason) el(panel, "p", "kino-forecast-notice", fmt(plot.reason));
        if (plot.note) el(panel, "p", "kino-forecast-muted", fmt(plot.note));
        fields(panel, plot, ["prediction", "raw", "unbounded", "base", "correction", "sumWeights", "denominator", "parameters", "status", "shortDescription", "truncated", "tokenCount"]);
        section(panel, "Формулы");
        formula(panel, "Похожесть = косинус между нормированными векторами описаний.\nВес = exp((похожесть − максимальная похожесть) / температура).\nОтклонение = ваша оценка соседа − средняя личная оценка.\nПрогноз = средняя личная оценка + Σ(вес × отклонение) / (Σвесов + сглаживание).\nРезультат ограничивается диапазоном 1–10 и округляется до десятых.");
        if (plot.formula) formula(panel, plot.formula);
        if (numeric(plot.base) && numeric(plot.correction)) formula(panel, `${fmt(plot.base)} ${signed(plot.correction)} = ${fmt(plot.raw)} → ${fmt(plot.prediction)}`);
        const model = branchKey ? report.models?.[branchKey] ?? report.models?.find?.(item => item.key === branchKey) : report.model;
        const input = branchKey ? { descriptionHash: report.input?.descriptionHash, ...(report.input?.models?.[branchKey] ?? {}) } : report.input;
        if (model || input) {
            section(panel, "Обработка текста");
            if (model) fields(panel, model);
            if (input) fields(panel, input);
        }
        neighbors(panel, plot.neighbors, true);
    }
    function render(report) {
        holder.replaceChildren();
        const date = report.createdAt ? new Date(report.createdAt) : null;
        el(holder, "p", "kino-forecast-meta", `Сохранённый расчёт · ${date && !Number.isNaN(date.getTime()) ? date.toLocaleString("ru-RU") : fmt(report.createdAt)} · версия ${fmt(report.version)}${report.engine ? " · " + fmt(report.engine) : ""}`);
        const tabs = el(holder, "div", "kino-forecast-tabs");
        tabs.setAttribute("role", "tablist"); tabs.setAttribute("aria-label", "Разделы расчёта");
        const panels = [], buttons = [], id = "kino-forecast-" + Math.random().toString(36).slice(2);
        const renderers = [finalPanel], names = ["Итог"];
        if (multiple(report)) {
            names.push("Данные", "Сюжет");
            renderers.push((panel, value) => dataPanel(panel, value, "155", "По данным · 155 соседей"),
                (panel, value) => plotPanel(panel, value, "embeddinggemma", "По сюжету · EmbeddingGemma"));
        } else { names.push("Данные", "Сюжет"); renderers.push(dataPanel, plotPanel); }
        function select(index, focus = false) {
            buttons.forEach((button, i) => { button.setAttribute("aria-selected", String(i === index)); button.tabIndex = i === index ? 0 : -1; panels[i].hidden = i !== index; });
            const panel = panels[index];
            if (!panel.dataset.loaded) { panel.dataset.loaded = "true"; renderers[index](panel, report); }
            if (focus) buttons[index].focus();
        }
        names.forEach((name, i) => {
            const button = el(tabs, "button", "kino-forecast-tab", name); button.type = "button";
            button.id = `${id}-tab-${i}`; button.setAttribute("role", "tab"); button.setAttribute("aria-controls", `${id}-panel-${i}`);
            const panel = el(holder, "section", "kino-forecast-panel"); panel.id = `${id}-panel-${i}`;
            panel.setAttribute("role", "tabpanel"); panel.setAttribute("aria-labelledby", button.id); panel.tabIndex = 0;
            buttons.push(button); panels.push(panel);
            button.addEventListener("click", () => select(i));
            button.addEventListener("keydown", event => {
                let next;
                if (event.key === "ArrowRight") next = (i + 1) % names.length;
                else if (event.key === "ArrowLeft") next = (i + names.length - 1) % names.length;
                else if (event.key === "Home") next = 0;
                else if (event.key === "End") next = names.length - 1;
                if (next !== undefined) { event.preventDefault(); select(next, true); }
            });
        });
        select(0);
    }
    function close() {
        if (closed) return;
        closed = true;
        if (modal) modal.close();
        else fallback?.remove();
        if (focusBefore?.isConnected) focusBefore.focus();
    }
    if (obsidian.Modal) {
        modal = new obsidian.Modal(app);
        modal.modalEl.classList.add("kino-ai-modal", "kino-forecast-modal");
        if (modal.setTitle) modal.setTitle("Как получен прогноз");
        else modal.titleEl.textContent = "Как получен прогноз";
        modal.onClose = () => { closed = true; holder?.replaceChildren(); if (focusBefore?.isConnected) focusBefore.focus(); };
        holder = el(modal.contentEl, "div", "kino-forecast-details");
        modal.open();
    } else {
        fallback = el(parent ?? doc.body, "section", "kino-forecast-details kino-forecast-inline");
        fallback.setAttribute("role", "region"); fallback.setAttribute("aria-label", "Как получен прогноз");
        const top = el(fallback, "div", "kino-forecast-inline-heading");
        el(top, "h2", "", "Как получен прогноз");
        const dismiss = el(top, "button", "", "Закрыть"); dismiss.type = "button"; dismiss.addEventListener("click", close);
        holder = el(fallback, "div");
        fallback.addEventListener("keydown", event => { if (event.key === "Escape") { event.preventDefault(); close(); } });
        dismiss.focus();
    }
    holder.setAttribute("aria-busy", "true"); el(holder, "p", "kino-forecast-muted", "Загружается сохранённый расчёт…");
    const controller = { close, isOpen: () => !closed };
    // Loading is detached from opening so the owner can dispose the modal immediately.
    (async () => {
        try {
            const path = pathFor(reportReference);
            if (!path) throw new Error("Сохранённого расчёта ещё нет. Выполни команду «Кино — Обновить оценки».");
            if (/^(?:[a-z]+:|\/|\\)/i.test(path) || path.split(/[\\/]/).includes("..")) throw new Error("Некорректная ссылка на сохранённый расчёт.");
            const file = app.vault.getAbstractFileByPath(path) ?? app.metadataCache.getFirstLinkpathDest?.(path, sourcePath);
            const body = file ? await app.vault.read(file) : app.vault.adapter?.read ? await app.vault.adapter.read(path) : null;
            if (body == null) throw new Error("Файл сохранённого расчёта не найден.");
            const report = JSON.parse(body);
            if (!report || typeof report !== "object" || !report.final || (!report.data && !report.dataVariants)) throw new Error("Формат сохранённого расчёта не поддерживается.");
            if (!closed) render(report);
        } catch (error) {
            if (!closed) { holder.replaceChildren(); el(holder, "p", "kino-forecast-notice", error.message || String(error)).setAttribute("role", "alert"); }
        } finally { if (!closed) holder.removeAttribute("aria-busy"); }
    })();
    return controller;
};
