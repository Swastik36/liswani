import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

const exec = promisify(execFile);
const pins = JSON.parse(await fs.readFile(path.join(rootDir, "data/pins.json"), "utf8"));

// Optional key filter: `node scripts/fetch-media.mjs key1 key2` refreshes only
// those records and leaves every other cached image and record untouched.
const only = process.argv.slice(2);
const entries = Object.entries(pins).filter(([key]) => !only.length || only.includes(key));

// Live-action records are added by hand (AniList has no entries for them).
// Keep any existing record that is not covered by an AniList pin.
let existing = {};
try {
  existing = JSON.parse(await fs.readFile(path.join(rootDir, "data/media.json"), "utf8"));
} catch {
  existing = {};
}

const mediaQuery = `
query ($ids: [Int]) {
  Page(perPage: 50) {
    media(id_in: $ids, type: ANIME) {
      id
      title { romaji english native }
      description(asHtml: false)
      coverImage { extraLarge large color }
      bannerImage
      genres
      format
      seasonYear
      episodes
      duration
      status
      averageScore
      siteUrl
    }
  }
}`;

const mediaById = {};
for (let i = 0; i < entries.length; i += 40) {
  const chunk = entries.slice(i, i + 40);
  const ids = chunk.map(([, id]) => id);
  const res = await fetch("https://graphql.anilist.co", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query: mediaQuery, variables: { ids } }),
    signal: AbortSignal.timeout(30000),
  });
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  for (const m of json.data.Page.media) mediaById[m.id] = m;
  console.log(`metadata batch ${i / 40 + 1}: ${json.data.Page.media.length} results`);
  await new Promise((r) => setTimeout(r, 1000));
}

await fs.mkdir(path.join(rootDir, "assets/img/posters"), { recursive: true });
await fs.mkdir(path.join(rootDir, "assets/img/banners"), { recursive: true });
await fs.mkdir("/tmp/anime-site", { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = {};

async function fetchImage(url, destBase) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(45000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      const tmp = `/tmp/anime-site/${destBase.split("/").pop()}-${Date.now()}.jpg`;
      await fs.writeFile(tmp, buf);
      return tmp;
    } catch (err) {
      if (attempt === 2) throw err;
      await sleep(1500);
    }
  }
}

const tasks = entries.map(([key, id], index) => async () => {
  const media = mediaById[id];
  if (!media) {
    console.log(`MISSING metadata: ${key} (${id})`);
    return;
  }
  const record = {
    id,
    key,
    title: media.title,
    description: media.description || "",
    genres: media.genres || [],
    format: media.format,
    year: media.seasonYear,
    episodes: media.episodes,
    duration: media.duration,
    status: media.status,
    averageScore: media.averageScore,
    siteUrl: media.siteUrl,
    color: media.coverImage?.color || null,
    poster: null,
    banner: null,
  };

  const posterUrl = media.coverImage?.extraLarge || media.coverImage?.large;
  if (posterUrl) {
    try {
      const tmp = await fetchImage(posterUrl, `posters/${key}`);
      const out = `assets/img/posters/${key}.webp`;
      await exec("magick", [tmp, "-resize", "700x1050>", "-strip", "-quality", "82", path.join(rootDir, out)]);
      await fs.unlink(tmp);
      record.poster = out;
    } catch (err) {
      console.log(`poster failed ${key}: ${err.message}`);
    }
  }

  const bannerUrl = media.bannerImage || posterUrl;
  if (bannerUrl) {
    try {
      const tmp = await fetchImage(bannerUrl, `banners/${key}`);
      const out = `assets/img/banners/${key}.webp`;
      await exec("magick", [tmp, "-resize", "1600x900>", "-strip", "-quality", "80", path.join(rootDir, out)]);
      await fs.unlink(tmp);
      record.banner = out;
    } catch (err) {
      console.log(`banner failed ${key}: ${err.message}`);
    }
  }

  results[key] = record;
  console.log(`ok ${key}${record.banner ? "" : " (no banner)"}`);
});

const CONCURRENCY = 4;
let cursor = 0;
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    while (cursor < tasks.length) {
      const task = tasks[cursor++];
      await task();
    }
  })
);

const merged = { ...existing, ...results };
await fs.writeFile(path.join(rootDir, "data/media.json"), JSON.stringify(merged, null, 2));
console.log(
  `\nSaved ${Object.keys(results).length}/${entries.length} AniList records; kept ${
    Object.keys(merged).length - Object.keys(results).length
  } existing records.`
);
