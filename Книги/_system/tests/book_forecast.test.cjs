"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { buildForecast, normalizeRecord, parseRating, metrics } = require("../book_forecast.js");

function fixture() {
  return Array.from({ length: 42 }, (_, i) => ({
    path: `fiction/work-${i}.md`, title: `Work ${i}`, authors: [`Author ${i % 4}`],
    type: i % 3 ? "story" : "book", series: i % 6 === 0 ? ["Series A"] : [],
    rating: 2 + (i % 4) * 2 + (i % 3 === 0 ? 1 : 0), date: `2026-10-${String(1 + i % 18).padStart(2, "0")}`,
  }));
}

test("normalization accepts only valid 1–10 ratings and normalizes metadata", () => {
  for (const invalid of [null, undefined, true, false, "", "  ", "bad", NaN, Infinity, -1, 0, 11, {}, []]) assert.equal(parseRating(invalid), null);
  assert.equal(parseRating(" 7,5 "), 7.5);
  assert.equal(parseRating("10"), 10);
  assert.equal(normalizeRecord(null), null);
  assert.equal(normalizeRecord({ title: "No path" }), null);
  assert.deepEqual(normalizeRecord({ path: " fiction\\test.md ", authors: ["[[Authors/Автор|Автор]]", "автор"], type: "Рассказ", series: "[[Серии/Серия]]", rating: 8 }), {
    path: "fiction/test.md", title: "test", authors: ["Автор"], type: "story", series: ["Серия"], rating: 8, date: null,
  });
});

test("empty and single-rated libraries do not invent a held-out prediction", () => {
  const empty = buildForecast([]);
  assert.equal(empty.totalCount, 0);
  assert.equal(empty.validation.n, 0);
  assert.equal(empty.validation.mae, null);
  const one = buildForecast([{ path: "one.md", rating: 10 }, { path: "new.md", rating: null }]);
  assert.equal(one.rows.find(r => r.path === "one.md").raw, null);
  assert.equal(one.rows.find(r => r.path === "new.md").raw, 10);
});

test("a rated row is excluded from its own fitting AND model selection", () => {
  const records = fixture();
  for (const targetIndex of [0, 7, 16, 29, 41]) {
    const original = buildForecast(records).rows.find(row => row.path === records[targetIndex].path);
    const changed = records.map((record, i) => i === targetIndex ? { ...record, rating: record.rating === 1 ? 10 : 1 } : record);
    const after = buildForecast(changed).rows.find(row => row.path === records[targetIndex].path);
    assert.equal(after.raw, original.raw, `prediction leaked own rating for ${targetIndex}`);
    assert.equal(after.modelId, original.modelId, `model selection leaked own rating for ${targetIndex}`);
    assert.deepEqual(after.contributions, original.contributions);
    assert.deepEqual(after.support, original.support);
    assert.deepEqual(after.examples, original.examples);
  }
});

test("unrated rows fall back transparently for authors and series with no history", () => {
  const result = buildForecast([...fixture(), { path: "new.md", authors: ["Unseen"], type: "unseen", series: ["Unseen"] }]);
  const row = result.rows.find(row => row.path === "new.md");
  assert.equal(row.validationMode, "unrated");
  assert.equal(row.support.author, 0);
  assert.equal(row.support.series, 0);
  assert.equal(row.support.type, 0);
  assert.equal(row.contributions.author, 0);
  assert.equal(row.contributions.series, 0);
  assert.equal(row.contributions.type, 0);
  assert.match(row.evidence, /Автор без истории/);
  assert.equal(row.raw, row.contributions.base);
});

test("input order cannot change folds, model selection or output", () => {
  const records = fixture();
  assert.deepEqual(buildForecast(records), buildForecast([...records].reverse()));
});

test("titles, dates, review text and read counts do not affect predictions", () => {
  const records = fixture();
  const changed = records.map(record => ({ ...record, title: "New title", date: "1900-01-01", review: "rating 10", read_count: 9999 }));
  const before = buildForecast(records);
  const after = buildForecast(changed);
  assert.deepEqual(before.rows.map(row => [row.path, row.raw, row.modelId, row.support]), after.rows.map(row => [row.path, row.raw, row.modelId, row.support]));
  assert.deepEqual(before.validation, after.validation);
});

test("predictions use the available author signal and contributions add up", () => {
  const records = Array.from({ length: 80 }, (_, i) => ({ path: `signal/${i}.md`, authors: [i % 2 ? "High" : "Low"], rating: i % 2 ? 9 : 2, type: "book" }));
  records.push({ path: "new-high.md", authors: ["High"] }, { path: "new-low.md", authors: ["Low"] });
  const result = buildForecast(records);
  const high = result.rows.find(row => row.path === "new-high.md");
  const low = result.rows.find(row => row.path === "new-low.md");
  assert.ok(high.raw > low.raw + 3);
  assert.ok(result.validation.mae < result.validation.baselineMae);
  for (const row of result.rows) {
    assert.ok(row.raw >= 1 && row.raw <= 10);
    assert.equal(row.forecast, row.raw);
    assert.equal(row.unclamped, Object.values(row.contributions).reduce((sum, value) => sum + value, 0));
    assert.equal(row.raw, Math.min(10, Math.max(1, row.unclamped)));
    if (row.rating != null) {
      assert.equal(row.support.total, result.ratedCount - 1);
      assert.equal(row.delta, row.rating - row.raw);
      assert.ok(row.examples.every(example => example.path !== row.path));
    }
  }
});

test("uniform ratings stay uniform without fictitious personalization", () => {
  const records = fixture().map(record => ({ ...record, rating: 7 }));
  const result = buildForecast([...records, { path: "unknown.md", authors: ["New"] }]);
  assert.equal(result.model.features.length, 0);
  assert.ok(result.rows.every(row => row.raw === 7));
  assert.equal(result.validation.mae, 0);
});

test("type-only forecasts do not claim to use the author", () => {
  const records = Array.from({ length: 100 }, (_, i) => ({
    path: `types/${i}.md`, authors: ["One author"], type: i % 2 ? "story" : "book", rating: i % 2 ? 2 : 9,
  }));
  const result = buildForecast(records);
  assert.equal(result.model.id, "type");
  const typeRows = result.rows.filter(row => row.modelId === "type");
  assert.ok(typeRows.length > 0);
  assert.ok(typeRows.every(row => row.support.author > 0 && /^Ориентир по типу/.test(row.evidence)));
});

test("metrics use unrounded predictions and report an honest within-one fraction", () => {
  const value = metrics([{ actual: 8, predicted: 6.99 }, { actual: 3, predicted: 4 }, { actual: 10, predicted: null }]);
  assert.equal(value.n, 2);
  assert.ok(Math.abs(value.mae - 1.005) < 1e-12);
  assert.equal(value.within1, 0.5);
  assert.equal(value.within1Count, 1);
});

test("duplicate paths have no extra weight and invalid records are counted", () => {
  const valid = { path: "same.md", rating: 7, authors: ["A"] };
  const duplicate = { ...valid, rating: null };
  const other = { path: "other.md", rating: 3 };
  const result = buildForecast([valid, duplicate, other, null, { title: "Missing path" }]);
  assert.equal(result.totalCount, 2);
  assert.equal(result.ratedCount, 2);
  assert.equal(result.duplicateCount, 1);
  assert.equal(result.invalidCount, 2);
  assert.deepEqual(result, buildForecast([{ title: "Missing path" }, null, other, duplicate, valid]));
});

test("no training ratings means no numeric forecasts", () => {
  const result = buildForecast([{ path: "a.md", rating: "" }, { path: "b.md", rating: false }]);
  assert.equal(result.ratedCount, 0);
  assert.equal(result.unratedCount, 2);
  assert.ok(result.rows.every(row => row.raw === null && row.delta === null));
});
