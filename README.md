# Readweave

**Read, highlight, connect.**

Readweave is a low-friction PDF reader for studying. Select text and press **H** to highlight it,
press **L** to link related ideas across pages, and press **M** to see them as a map. Notes, links
and your reading position stay in the browser — no account, no backend, no setup.

## Features

- **Open or drop a PDF.** Reopening the same file reuses its stored copy and highlights (matched by
  SHA-256 hash) and resumes at the page you were on.
- **Highlight fast.** Select text and press **H**; highlights are drawn over the page and stay
  aligned at every zoom level.
- **Notes.** Every highlight has an inline one-line note. Press **N** with no selection to drop a
  note-only node on the current page.
- **Link ideas.** Make a highlight active, press **L**, then click the other idea (its sidebar row
  or its page badge). Links default to `related`; optionally label them `defines`, `example of`, or
  `contrasts`.
- **See links while reading.** Each box shows a small bridge badge (`→p10` or a count) and each
  sidebar item lists connection chips. Click a chip to jump to the other idea. Unlink with `×` and
  undo if needed.
- **Maps.** Press **M** for the neighborhood map (one node and its direct neighbors), or use the
  **Map** button / **Shift+M** for the full page-ordered map. Drag to pan, scroll to zoom, and an
  optional deterministic force layout is available.

## Keyboard shortcuts

| Key | Action |
| --- | --- |
| `H` | Highlight the current selection |
| `N` | Create a page note and focus its note field |
| `L` | Arm the active highlight as a link source (again or `Esc` cancels) |
| `1`–`4` | Label the link you just made: related / defines / example of / contrasts |
| `M` | Neighborhood map for the active highlight |
| `Shift+M` | Full document map |
| `Esc` | Close a map, otherwise cancel linking |

## Getting started

Requires Node.js 18+.

```bash
npm install
npm run dev
```

Open the printed URL (default http://localhost:5173). For a production build:

```bash
npm run build
npx vite preview
```

A sample file is available at `public/test.pdf` for manual testing.

## How it works

- **Stack:** Vite + TypeScript, no UI framework. PDF rendering via `pdfjs-dist` v6; local storage via
  Dexie (IndexedDB, database `StudyToolDB`).
- **Zoom-independent highlights:** rects are stored as fractions of the page box, so overlays scale
  with the rendered canvas. The canvas is drawn at `devicePixelRatio` for sharp text.
- **Storage boundary:** all database access lives in `src/storage/`. The rest of the app talks to
  `src/storage/repository.ts` only.
- **Links:** stored in a `links` table. Symmetric relations (`related`, `contrasts`) are kept once
  with `fromId = min, toId = max`; directional relations keep their direction.
- **Note-only nodes:** a normal highlight with `anchor.rects = []`, empty `text`, and the note in
  `note`, so it flows through chips and maps unchanged.
- **Maps:** plain inline SVG. The full map is a deterministic page-ordered column with `viewBox`
  pan/zoom; the optional force layout is a circle-seeded Fruchterman–Reingold relaxation.

## Project structure

```
src/
  main.ts            app wiring, keyboard handling, linking state
  types.ts           Source, Anchor, Highlight, Link, Repository
  pdf/
    viewer.ts        PDF loading, page rendering, zoom, navigation
    selection.ts     selection -> highlight data
    overlay.ts       highlight boxes, bridge badges, flash
  ui/
    toolbar.ts       open/prev/next/zoom/fit/map controls
    sidebar.ts       highlight list, notes, connection chips, toasts
    map.ts           neighborhood and full-document SVG maps
  storage/
    db.ts            Dexie schema (sources, highlights, links)
    repository.ts    the only storage API used by the app
public/test.pdf      sample document
schema.sql           reference data shapes for a future SQLite backend
```

## Status and roadmap

Phase 1 (reading + highlighting), Phase 2 (linking, relations, note-only nodes) and Phase 3
(neighborhood and full maps, optional force layout) are implemented.

Planned or considered: Tauri + SQLite using `schema.sql`, a code-file viewer, and AI link
suggestions (`origin='ai'`, `status='suggested'` are already in the schema). Out of scope for now:
folders/tags, multiple colors, search, export, accounts, and a backend.

## Testing

There is no automated test suite yet. Work was verified manually with headless Chrome over the
DevTools protocol (highlighting, linking, relations/unlink, notes, both maps).

Known limitations: only one page is rendered at a time (no continuous scrolling); a link between a
pair of nodes is a single row, so linking the same pair again is a no-op; map nodes use fixed-size
boxes and labels are truncated to two lines; deleting a highlight leaves its link rows behind (the
UI skips links whose endpoints are gone).

## License

ISC — see `package.json`.
