"use strict";

const id = String(process.argv[2] || "").trim().toLowerCase();
if (!/^tt\d{7,12}$/.test(id)) {
  process.stderr.write("Нужен IMDb ID вида tt1234567.\n");
  process.exitCode = 2;
} else {
  const query = "query Recommendations($id: ID!) { title(id: $id) { moreLikeThisTitles(first: 12) { edges { node { id titleText { text } originalTitleText { text } releaseYear { year } } } } } }";
  (async () => {
    const response = await fetch("https://caching.graphql.imdb.com/", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Origin: "https://www.imdb.com",
        Referer: `https://www.imdb.com/title/${id}/`,
        "User-Agent": "Mozilla/5.0"
      },
      body: JSON.stringify({ query, operationName: "Recommendations", variables: { id } }),
      signal: AbortSignal.timeout(12000)
    });
    const raw = await response.text();
    if (!response.ok) throw new Error(`IMDb GraphQL: HTTP ${response.status}; ${raw.replace(/\s+/g, " ").slice(0, 100)}`);
    if (!raw.trimStart().startsWith("{")) throw new Error(`IMDb GraphQL вернул HTML вместо JSON: ${raw.replace(/\s+/g, " ").slice(0, 100)}`);
    const data = JSON.parse(raw);
    if (data?.errors?.length) throw new Error(`IMDb GraphQL: ${data.errors.map(error => error.message).join("; ")}`);
    const films = (data?.data?.title?.moreLikeThisTitles?.edges || [])
      .map(edge => edge?.node)
      .filter(node => /^tt\d{7,12}$/i.test(node?.id || ""))
      .map(node => ({
        imdbId: node.id.toLowerCase(),
        title: String(node.titleText?.text || node.originalTitleText?.text || node.id),
        originalTitle: String(node.originalTitleText?.text || node.titleText?.text || node.id),
        year: Number(node.releaseYear?.year) || null,
        url: `https://www.imdb.com/title/${node.id}/`
      }));
    process.stdout.write(JSON.stringify({ id, films }));
  })().catch(error => {
    process.stderr.write(`${String(error?.message || error)}\n`);
    process.exitCode = 1;
  });
}
