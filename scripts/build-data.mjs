import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

const source = JSON.parse(await fs.readFile(path.join(rootDir, "data/source.json"), "utf8"));
const media = JSON.parse(await fs.readFile(path.join(rootDir, "data/media.json"), "utf8"));

const missing = new Set();
const used = new Set();

function cleanDescription(text = "") {
  return text
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, num) => String.fromCodePoint(Number(num)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–")
    .replace(/&hellip;/g, "…")
    .replace(/\(Source:[^)]*\)/gi, "")
    .replace(/(^|\n)\s*Note:[^\n]*/gi, "$1")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function initials(text = "") {
  const words = text
    .replace(/[^\p{L}\p{N} ]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

for (const section of source.sections) {
  section.items = section.items.map((item) => {
    const record = media[item.media];
    if (!record) missing.add(item.media);
    if (record) used.add(item.media);

    const emptyLabel = item.placeholder
      ? item.placeholder.split("\n").join(" · ")
      : item.title;

    return {
      ...item,
      sectionId: section.id,
      sectionTitle: section.title,
      accent: section.accent,
      synopsis: item.description || cleanDescription(record?.description),
      image: record?.poster || null,
      banner: record?.banner || null,
      emptyMark: item.emptyMark || initials(item.placeholder?.split("\n")[0] || item.title),
      emptyLabel: item.emptyLabel || emptyLabel,
      info: {
        format: record?.format || null,
        year: record?.year || null,
        episodes: record?.episodes || null,
        duration: record?.duration || null,
        status: record?.status || null,
        averageScore: record?.averageScore || null,
        genres: record?.genres || [],
        romaji: record?.title?.romaji || null,
        english: record?.title?.english || null,
        native: record?.title?.native || null,
        siteUrl: record?.siteUrl || null
      }
    };
  });
}

for (const key of Object.keys(media)) {
  if (!used.has(key)) console.log(`unused media: ${key}`);
}
if (missing.size) console.log(`missing media: ${[...missing].join(", ")}`);

const payload = {
  meta: source.meta,
  heroStats: source.totals.stats,
  sections: source.sections,
  totals: source.totals,
  taste: source.taste,
  builtAt: new Date().toISOString()
};

await fs.writeFile(
  path.join(rootDir, "data.js"),
  `/* Generated from data/source.json + data/media.json — do not edit by hand. */\nwindow.ANIME_DATA = ${JSON.stringify(payload, null, 2)};\n`
);

const cardCount = source.sections.reduce((n, s) => n + s.items.length, 0);
console.log(`Wrote data.js — ${source.sections.length} sections, ${cardCount} cards.`);
