"use strict";

const id = String(process.argv[2] || "").trim().toLowerCase();
const includeSecondLevel = process.argv.includes("--two-level");
if (!/^tt\d{7,12}$/.test(id)) {
  process.stderr.write("Нужен IMDb ID вида tt1234567.\n");
  process.exitCode = 2;
} else {
  const query = "query Recommendations($id: ID!) { title(id: $id) { moreLikeThisTitles(first: 12) { edges { node { id titleText { text } originalTitleText { text } releaseYear { year } } } } } }";
  async function similarFor(filmId) {
    const response = await fetch("https://caching.graphql.imdb.com/", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Origin: "https://www.imdb.com",
        Referer: `https://www.imdb.com/title/${filmId}/`,
        "User-Agent": "Mozilla/5.0"
      },
      body: JSON.stringify({ query, operationName: "Recommendations", variables: { id: filmId } }),
      signal: AbortSignal.timeout(12000)
    });
    const raw = await response.text();
    if (!response.ok) throw new Error(`IMDb GraphQL: HTTP ${response.status}; ${raw.replace(/\s+/g, " ").slice(0, 100)}`);
    if (!raw.trimStart().startsWith("{")) throw new Error(`IMDb GraphQL вернул HTML вместо JSON: ${raw.replace(/\s+/g, " ").slice(0, 100)}`);
    const data = JSON.parse(raw);
    if (data?.errors?.length) throw new Error(`IMDb GraphQL: ${data.errors.map(error => error.message).join("; ")}`);
    return (data?.data?.title?.moreLikeThisTitles?.edges || [])
      .map(edge => edge?.node)
      .filter(node => /^tt\d{7,12}$/i.test(node?.id || ""))
      .map(node => ({
        imdbId: node.id.toLowerCase(),
        title: String(node.titleText?.text || node.originalTitleText?.text || node.id),
        originalTitle: String(node.originalTitleText?.text || node.titleText?.text || node.id),
        year: Number(node.releaseYear?.year) || null,
        url: `https://www.imdb.com/title/${node.id}/`
      }));
  }
  (async () => {
    const films = await similarFor(id);
    if (!includeSecondLevel) {
      process.stdout.write(JSON.stringify({ id, films }));
      return;
    }
    const parentResults = new Array(films.length);
    let cursor = 0, parentsCount = 0, failedParents = 0;
    async function worker() {
      while (cursor < films.length) {
        const index = cursor++;
        try { parentResults[index] = await similarFor(films[index].imdbId); parentsCount++; }
        catch (_) { parentResults[index] = []; failedParents++; }
      }
    }
    await Promise.all(Array.from({ length: Math.min(3, films.length) }, () => worker()));
    const directIds = new Set([id, ...films.map(film => film.imdbId)]), second = new Map();
    for (let index = 0; index < films.length; index++) {
      for (const candidate of parentResults[index] || []) {
        if (directIds.has(candidate.imdbId)) continue;
        const existing = second.get(candidate.imdbId);
        if (existing) { existing.votes++; continue; }
        second.set(candidate.imdbId, { ...candidate, viaTitle: films[index].title, votes: 1 });
      }
    }
    const secondLevel = [...second.values()]
      .sort((a, b) => b.votes - a.votes || a.title.localeCompare(b.title, "en"))
      .slice(0, 100);
    process.stdout.write(JSON.stringify({ id, films, secondLevel, parentsCount, failedParents }));
  })().catch(error => {
    process.stderr.write(`${String(error?.message || error)}\n`);
    process.exitCode = 1;
  });
}
