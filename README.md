# Swastik's Anime List

A simple, static one-page site built from `~/Documents/list.md`. The section
order and hierarchy match the original list. Each card shows a poster with the
title underneath; click any card for the personal note, a synopsis, more
pictures, and an AniList link where available.

## View it

Open `index.html` directly:

```sh
xdg-open index.html
```

Or serve the folder:

```sh
cd ~/Documents/anime-site
python3 -m http.server 8000
# http://localhost:8000
```

There is no build step required to view the site — `data.js` is already
generated and all artwork is local.

## What's here

```
index.html          page shell
styles.css          all styling (desktop + mobile)
app.js              renders the cards, totals, and detail modal
data.js             generated data embedded for file:// use
data/source.json    the hand-curated list data (edit this)
data/media.json     metadata + downloaded image paths (AniList, plus manual live-action)
data/list.md        snapshot of the original list
data/pins.json      AniList IDs used for each title
assets/img/         posters and key art, cached locally
scripts/            data + artwork fetch and build scripts
```

## Deployment

Live at **https://liswani.vercel.app** (Vercel static project `liswani`).

To publish an update:

1. Run `node scripts/build-data.mjs`.
2. Run `npx vercel deploy --prod`.

`.vercelignore` keeps local build inputs, scripts, and environment files out of
the upload. `data.js` is regenerated locally and deployed as a static file.

## Updating

1. Edit `data/source.json` (sections, titles, notes, progress).
2. Run `node scripts/build-data.mjs` to regenerate `data.js`.
3. Reload the page.

Artwork is fetched from [AniList](https://anilist.co) and stored locally so the
page works offline. The live-action One Piece and Parasyte records are added by
hand because AniList has no entries for them; `fetch-media.mjs` keeps those
unpinned records when it refreshes the AniList-backed ones.

## Coverage

- 12 list sections (Currently Watching through Live Action)
- 164 cards, including duplicate mentions that the original list keeps in
  multiple tiers (e.g. the Rascal films and Blue Box S1)
- 156 cached poster records, all with local artwork
- Totals and taste notes are rendered as their own sections
- No frameworks, trackers, or external runtime dependencies
