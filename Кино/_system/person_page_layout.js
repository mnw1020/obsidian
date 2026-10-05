/* Decorate generated actor/director/genre pages without changing their data queries.
 * No vault writes here. The caller owns reading, validation and persistence. */
module.exports = function personPageLayout(raw, { kind } = {}) {
    if (!["actor", "director", "genre"].includes(kind)) return raw;
    if (raw.includes("// KINO:PERSON:PRESENTATION:V1")) return raw;
    const newline = raw.includes("\r\n") ? "\r\n" : "\n";
    const generated = /<!-- KINO:ENTITY:V1 -->[\s\S]*?```dataviewjs\r?\n([\s\S]*?)\r?\n```/.exec(raw);
    if (!generated) throw new Error("Не найден созданный блок страницы персоны");
    const base = kind !== "actor" ? /```base\r?\n[\s\S]*?\r?\n```/.exec(raw.slice(generated.index + generated[0].length)) : null;
    const baseSource = base?.[0] ?? "";
    let script = generated[1].replace(/\r\n/g, "\n");
    const helper = `// KINO:PERSON:PRESENTATION:V1
async function kinoPersonPresentation(name, entries) {
    const baseSource = ${JSON.stringify(baseSource)};
    try {
        const file = app.vault.getAbstractFileByPath("Кино/_system/person_ui.js");
        if (!file) return false;
        const personModule = { exports: {} };
        new Function("module", "exports", await app.vault.read(file))(personModule, personModule.exports);
        await personModule.exports({ dv, app, obsidian: typeof require === "function" ? require("obsidian") : {}, kind: ${JSON.stringify(kind)}, selected: name, rows: entries, baseSource });
        return true;
    } catch (error) {
        console.warn("Кино: страница персоны", error);
        return false;
    }
}
`;
    const selectedLine = kind === "actor" ? 'const selectedValue = dv.current()["Выбрано"] || "";'
        : kind === "genre" ? 'const selected = kinoGenre(dv.current()["Выбрано"] || "");'
        : 'const selected = kinoPersonDisplay(dv.current()["Выбрано"] || "");';
    if (!script.includes(selectedLine)) throw new Error("Не найден выбор персоны");
    script = script.replace(selectedLine, helper + selectedLine);
    const empty = '    dv.paragraph("Выбери ' + (kind === "genre" ? "жанр" : "имя") + ' в кинотеке или запусти соответствующую команду QuickAdd.");';
    if (!script.includes(empty)) throw new Error("Не найдена подсказка выбора");
    script = script.replace(empty, '    if (!await kinoPersonPresentation("", [])) {\n' + empty + '\n    }');
    const heading = '    dv.header(2, selected);\n';
    const summary = /    dv\.paragraph\("Произведений: " \+ rows\.length \+ " · Средняя моя оценка: " \+\n        \(ratings\.length \? \(ratings\.reduce\(\(a,b\) => a\+b, 0\) \/ ratings\.length\)\.toFixed\(2\) : "нет оценок"\)\);\n?/;
    const oldSummary = summary.exec(script)?.[0];
    if (!script.includes(heading) || !oldSummary) throw new Error("Не найдена исходная шапка персоны");
    script = script.replace(heading, "").replace(oldSummary, "");
    const fallbackHeader = heading + oldSummary;
    if (kind === "actor") {
        const table = /    dv\.table\(\["Произведение", "Роль", "Тип", "Релиз", "Моя оценка", "IMDb", "КП", "Франшиза"\],[\s\S]*?    \]\)\);/;
        const oldTable = table.exec(script)?.[0];
        if (!oldTable) throw new Error("Не найдена исходная фильмография актёра");
        script = script.replace(oldTable, '    if (!await kinoPersonPresentation(selected, rows.map(({ movie, rolePage }) => ({ page: movie, role: kinoRoleFor({ rolePage }, selected) })))) {\n' + fallbackHeader + oldTable + '\n    }');
    } else {
        const fallbackBase = baseSource ? `
        const ob = typeof require === "function" ? require("obsidian") : {};
        if (ob.MarkdownRenderer?.render && dv.component) {
            await ob.MarkdownRenderer.render(app, ${JSON.stringify(baseSource)}, dv.container, dv.current().file.path, dv.component);
        } else {
            dv.paragraph("Таблица доступна после загрузки интерфейса кинотеки.");
        }` : "";
        const end = script.lastIndexOf("\n}");
        if (end < 0) throw new Error("Не найден конец блока персоны");
        script = script.slice(0, end) + '\n    if (!await kinoPersonPresentation(selected, rows.map(page => ({ page, role: "" })))) {\n' + fallbackHeader + fallbackBase + '\n    }' + script.slice(end);
    }
    const updatedGenerated = generated[0].replace(generated[1], script.replace(/\n/g, newline));
    let updated = raw.slice(0, generated.index) + updatedGenerated + raw.slice(generated.index + generated[0].length);
    // Keep the exact original Base definition as the renderer argument above.
    // Rendering it lazily in this note preserves the meaning of this.Выбрано.
    if (baseSource) {
        const start = updated.indexOf(baseSource, generated.index + updatedGenerated.length);
        if (start < 0) throw new Error("Не найдена исходная таблица страницы");
        updated = updated.slice(0, start) + updated.slice(start + baseSource.length);
    }
    return updated;
};
