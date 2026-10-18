#!/usr/bin/env node
"use strict";

// Local, dependency-free preview of the fiction forecast. Reads book notes only.
// The frontmatter reader intentionally supports only the fields used below.
const fs = require("node:fs");
const path = require("node:path");

const libraryRoot = path.resolve(__dirname, "../..");
const fields = new Set(["title", "authors", "work_type", "series", "rating", "date"]);

function uncomment(value) {
    let quote = "";
    for (let i = 0; i < value.length; i++) {
        const char = value[i];
        if (quote === '"' && char === "\\") { i++; continue; }
        if (quote === "'" && char === "'" && value[i + 1] === "'") { i++; continue; }
        if (quote ? char === quote : char === '"' || char === "'") quote = quote ? "" : char;
        else if (!quote && char === "#" && (i === 0 || /\s/.test(value[i - 1]))) return value.slice(0, i).trim();
    }
    return value.trim();
}

function scalar(raw) {
    const value = uncomment(raw);
    if (!value || /^(?:null|~)$/i.test(value)) return "";
    if (value.startsWith('"')) {
        if (!value.endsWith('"')) throw new Error(`Unclosed quoted value: ${value}`);
        try { return JSON.parse(value); }
        catch { throw new Error(`Unsupported double-quoted value: ${value}`); }
    }
    if (value.startsWith("'")) {
        if (!value.endsWith("'")) throw new Error(`Unclosed quoted value: ${value}`);
        return value.slice(1, -1).replace(/''/g, "'");
    }
    return value;
}

function inlineAuthors(raw) {
    const value = uncomment(raw);
    if (!value || /^(?:null|~)$/i.test(value)) return [];
    if (!value.startsWith("[")) return [String(scalar(value))].filter(Boolean);
    if (!value.endsWith("]")) throw new Error(`Unclosed authors list: ${value}`);
    const source = value.slice(1, -1), parts = [];
    let quote = "", start = 0;
    for (let i = 0; i < source.length; i++) {
        const char = source[i];
        if (quote === '"' && char === "\\") { i++; continue; }
        if (quote === "'" && char === "'" && source[i + 1] === "'") { i++; continue; }
        if (quote ? char === quote : char === '"' || char === "'") quote = quote ? "" : char;
        else if (!quote && char === ",") { parts.push(source.slice(start, i)); start = i + 1; }
    }
    if (quote) throw new Error(`Unclosed authors quote: ${value}`);
    parts.push(source.slice(start));
    return parts.map(part => String(scalar(part))).filter(Boolean);
}

function readMetadata(content) {
    const match = content.match(/^\uFEFF?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
    if (!match) return {};
    const data = {};
    let current = "";
    for (const line of match[1].split(/\r?\n/)) {
        const property = line.match(/^([A-Za-z_][A-Za-z_0-9]*):\s*(.*)$/);
        if (property) {
            current = property[1];
            if (!fields.has(current)) continue;
            data[current] = current === "authors" ? inlineAuthors(property[2]) : scalar(property[2]);
        } else if (current === "authors") {
            const item = line.match(/^\s+-\s*(.*?)\s*$/);
            if (item) data.authors.push(String(scalar(item[1])));
        }
    }
    return data;
}

function walk(directory) {
    const files = [];
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const absolute = path.join(directory, entry.name);
        if (entry.isDirectory()) files.push(...walk(absolute));
        else if (entry.isFile() && /\.md$/i.test(entry.name)) files.push(absolute);
    }
    return files;
}

function readRecords() {
    return walk(path.join(libraryRoot, "Художественные")).sort().map(file => {
        let metadata;
        try { metadata = readMetadata(fs.readFileSync(file, "utf8")); }
        catch (error) { throw new Error(`${path.relative(libraryRoot, file)}: ${error.message}`); }
        const rawRating = String(metadata.rating ?? "").trim();
        const rating = /^(?:\d+(?:\.\d+)?|\.\d+)$/.test(rawRating) ? Number(rawRating) : null;
        return {
            path: `Книги/${path.relative(libraryRoot, file).split(path.sep).join("/")}`,
            title: String(metadata.title || path.basename(file, ".md")),
            authors: [...new Set((metadata.authors || []).map(value => value.trim()).filter(Boolean))],
            type: String(metadata.work_type || "book"),
            series: String(metadata.series || ""),
            rating: rating !== null && rating >= 1 && rating <= 10 ? rating : null,
            date: String(metadata.date || "")
        };
    });
}

const typeLabels = { book: "Книга", story: "Рассказ", novel: "Роман", novella: "Повесть", collection: "Сборник", poem: "Стихи", play: "Пьеса", essay: "Эссе" };
const cell = value => String(value ?? "").replace(/\r?\n/g, " ").replace(/\|/g, "&#124;");
const decimal = value => typeof value === "number" && Number.isFinite(value) ? value.toFixed(1).replace(".", ",") : "—";

function renderPreview(model) {
    const rows = model.rows || [];
    const lines = [
        "| Произведение | Автор | Тип | Прогноз | Моя оценка | Разница | Основание |",
        "| --- | --- | --- | ---: | ---: | ---: | --- |"
    ];
    for (const row of rows) {
        const title = cell(row.title || row.name || row.path).replace(/\[\[|\]\]/g, "");
        const destination = cell(row.path).replace(/\.md$/i, "");
        const authors = Array.isArray(row.authors) ? row.authors.join(", ") : row.authors || "";
        const prediction = row.prediction ?? row.forecast ?? null;
        const rating = row.rating ?? null;
        const delta = row.delta ?? (Number.isFinite(prediction) && Number.isFinite(rating) ? rating - prediction : null);
        const support = row.evidence || row.supportText || row.explanation || row.support || "";
        lines.push(`| [[${destination}\\|${title}]] | ${cell(authors)} | ${cell(typeLabels[row.type] || row.type)} | ${decimal(prediction)} | ${decimal(rating)} | ${delta === null ? "—" : `${delta > 0 ? "+" : ""}${decimal(delta)}`} | ${cell(typeof support === "object" ? JSON.stringify(support) : support)} |`);
    }
    return lines.join("\n");
}

function writePreview(filename, model) {
    const destination = path.resolve(filename);
    const relative = path.relative(libraryRoot, destination);
    if (!relative || relative.startsWith("..") || path.isAbsolute(relative) || !/\.md$/i.test(destination)) {
        throw new Error("Preview target must be an existing Markdown file inside the books library.");
    }
    const content = fs.readFileSync(destination, "utf8");
    const start = "<!-- BOOK-FORECAST-PREVIEW:START -->", end = "<!-- BOOK-FORECAST-PREVIEW:END -->";
    if (content.split(start).length !== 2 || content.split(end).length !== 2 || content.indexOf(start) > content.indexOf(end)) {
        throw new Error("Preview target needs exactly one correctly ordered marker pair.");
    }
    const newline = content.includes("\r\n") ? "\r\n" : "\n";
    const beginning = content.indexOf(start) + start.length, ending = content.indexOf(end);
    const replacement = `${newline}${newline}${renderPreview(model).replace(/\n/g, newline)}${newline}${newline}`;
    fs.writeFileSync(destination, content.slice(0, beginning) + replacement + content.slice(ending), "utf8");
}

function main(args) {
    const recordsOnly = args.includes("--records"), json = args.includes("--json");
    const previewIndex = args.indexOf("--write-preview");
    const previewPath = previewIndex >= 0 ? args[previewIndex + 1] : null;
    const valid = args.filter((arg, index) => index !== previewIndex + 1 || previewIndex < 0);
    if (valid.some(arg => !["--records", "--json", "--write-preview"].includes(arg)) || previewIndex >= 0 && (!previewPath || previewPath.startsWith("--"))) {
        throw new Error("Usage: node preview_book_forecast.cjs [--records | --json] [--write-preview PAGE.md]");
    }
    if (recordsOnly && (json || previewPath)) throw new Error("--records cannot be combined with other options.");
    const records = readRecords();
    if (recordsOnly) { console.log(JSON.stringify(records, null, 2)); return; }
    const engine = require("../book_forecast.js");
    const model = engine.buildForecast(records);
    if (previewPath) writePreview(previewPath, model);
    if (json) { console.log(JSON.stringify(model, null, 2)); return; }
    const unrated = records.filter(row => row.rating === null);
    console.log(JSON.stringify({
        data: { total: records.length, rated: records.length - unrated.length, unrated: unrated.length, authors: new Set(records.flatMap(row => row.authors)).size },
        model: model.model || null,
        validation: model.validation ? {
            n: model.validation.n, mae: model.validation.mae, rmse: model.validation.rmse,
            within1: model.validation.within1, residual80: model.validation.residual80,
            baselineMae: model.validation.baselineMae,
            baselineMedianMae: model.validation.baselineMedianMae,
            description: model.validation.description
        } : null,
        unrated: (model.rows || []).filter(row => row.rating === null).map(row => ({
            title: row.title, authors: row.authors, type: row.type,
            forecast: row.forecast, evidence: row.evidence
        })),
        preview: previewPath ? path.resolve(previewPath) : undefined
    }, null, 2));
}

if (require.main === module) {
    try { main(process.argv.slice(2)); }
    catch (error) { console.error(error.message); process.exitCode = 1; }
}

module.exports = { readMetadata, readRecords, renderPreview, writePreview };
