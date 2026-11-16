import fs from "node:fs/promises";

const searches = JSON.parse(await fs.readFile("data/search.json", "utf8"));

const fields = `
  id
  title { romaji english native }
  format
  seasonYear
  episodes
  averageScore
  coverImage { large color }
  bannerImage
  isAdult
`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const out = {};
const BATCH = 8;

for (let start = 0; start < searches.length; start += BATCH) {
  const batch = searches.slice(start, start + BATCH);
  const aliases = batch
    .map((s, i) => `  s${i}: Page(perPage: 4) { media(search: ${JSON.stringify(s.query)}, type: ANIME, sort: SEARCH_MATCH) { ${fields} } }`)
    .join("\n");
  const query = `query {\n${aliases}\n}`;

  let payload;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch("https://graphql.anilist.co", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ query }),
        signal: AbortSignal.timeout(25000),
      });
      if (res.status === 429) {
        console.error(`429, waiting 30s (batch ${start / BATCH + 1})`);
        await sleep(30000);
        continue;
      }
      const json = await res.json();
      if (json.errors) throw new Error(JSON.stringify(json.errors));
      payload = json.data;
      break;
    } catch (err) {
      console.error(`retry batch ${start / BATCH + 1}: ${err.message}`);
      await sleep(4000);
    }
  }

  if (!payload) {
    console.error(`FAILED batch starting ${start}`);
    continue;
  }

  batch.forEach((s, i) => {
    const media = payload[`s${i}`]?.media || [];
    out[s.key] = { search: s, candidates: media };
    console.log(`\n${s.key} (${s.query})`);
    for (const m of media) {
      console.log(`   ${m.id} | ${m.title.romaji} | ${m.seasonYear || "?"} | ${m.format} | ${m.episodes || "?"}ep`);
    }
  });

  await fs.writeFile("data/candidates.json", JSON.stringify(out, null, 2));
  await sleep(1200);
}

console.log(`\nSaved ${Object.keys(out).length}/${searches.length} searches.`);
