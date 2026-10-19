# Notes

## How to run
```
npm install
npm run dev
```
Then open the printed URL (default http://localhost:5173). No setup, no account, no data folder.

## Keyboard map
- **H** highlight the current selection.
- **N** create a page note (a node with no selected text) and focus its note field.
- **L** arm the active highlight as a link source; click a target to link. **L** again / **Esc** cancels.
- **1**–**4** set the relation of the link you just made: related / defines / example of / contrasts.
- **M** open the neighborhood map for the active highlight; **Shift+M** open the full document map.
- **Esc** close a map, else cancel linking.

## What works (Phase 1)
- Open a PDF with the **Open PDF** button, or drag a PDF file onto the window.
- Move with **Prev** / **Next** and the "Page X of Y" label.
- Zoom with **−**, **+** and **Fit Width**.
- Select text with the mouse and press **H** to highlight it. A short "Highlighted" flash confirms.
- Highlights are drawn over the page and stay correct at every zoom level.
- The sidebar lists all highlights of the current PDF (page order, top to bottom). Click one to
  jump to its page; the boxes flash for about a second.
- Each sidebar item has an inline one-line note and a **Delete** button with an **Undo** toast.
- Opening a PDF again reuses the same stored copy and its highlights (matched by SHA-256 hash).
- The last PDF reopens automatically at the last page you were reading.

## What works (Phase 2): linking and maps
- **Link two ideas:** click a highlight (or its page badge) to make it "active", press **L**, then
  click the other one (its sidebar row or its page badge). A link is created with default relation
  `related`; the source row and badge turn orange while armed.
- **See links while reading:** each highlighted box shows a small badge with the link count (or
  `→p10` for one or two links), and each sidebar item lists connection chips. A chip shows the
  other page and its text; click it to jump there.
- **Label a link (optional):** right after linking, press **1**–**4**. You can also click the small
  relation pill on a chip to cycle related → defines → example of → contrasts. Nothing ever blocks
  on a label.
- **Unlink:** click the **×** on a chip; an **Undo** toast restores it.
- **Note-only nodes:** press **N** on a page to drop a note node (no selection needed), type inline.
  It links, appears in counts/chips and in the maps like any highlight, and has no box on the page.
- **Neighborhood map (M):** the active node in the center, its direct neighbors in a ring,
  edges as lines. Click a neighbor to recenter on it; click the center to jump to it and close.
- **Full document map (Map button / Shift+M):** all nodes as one page-ordered column with edges as
  arcs. Drag to pan, scroll to zoom. Click a node to jump. A header button switches to the
  neighborhood, and another toggles an optional **force layout** (never the default).

## Known problems
- PDF text is extracted by joining text items with spaces, so `quote.prefix` / `quote.suffix`
  can be empty when a selection spans line breaks. Harmless in Phase 1 (only a re-find fallback).
- A highlight that covers several visual lines is stored as one rect per line; if a selection
  starts or ends mid-line the box follows the text box, not the exact glyphs.
- Undo after delete re-creates the highlight with a new id (see Decisions).
- Only one page is rendered at a time; there is no continuous scrolling.
- A link between the same pair of nodes is a single row (`UNIQUE(from_id,to_id)`); linking them
  again is a no-op, and changing a symmetric relation re-orders `from_id`/`to_id` by id.
- Map nodes are fixed-size boxes; with many nodes or long labels they can overlap (the force
  layout especially). Labels are truncated to two lines.
- Deleting a highlight that had links leaves the link rows behind; the maps skip links whose
  endpoints are gone, so they disappear from view but the rows are not cleaned up.

## Things that felt slow or annoying
(To be filled in by the human after reading a real chapter.)
- Zoom re-renders the current page each click; on large pages this can take a moment.

## Suggestions (not built, per plan)
- Keyboard shortcuts for next/previous page.
- Remember and restore zoom level per document.
- Search within the PDF.
- A visible keyboard hint so the **H** action is discoverable.

## Decisions
- Text layer uses the PDF.js v6 `TextLayer` class and its own CSS (class name `textLayer`).
  The page container sets `--total-scale-factor` / `--scale-factor` so glyph hit-areas line up
  with the rendered canvas at every zoom level.
- The canvas is rendered at `devicePixelRatio` (via `OutputScale`) and displayed at CSS size,
  so the page stays sharp on HiDPI screens.
- Highlight rects are stored as fractions of the text layer box (which equals the page box),
  so they are zoom-independent.
- The empty state is an overlay inside the viewer, not a replacement of its contents, so the
  canvas/text layer are never destroyed when no document is loaded.
- The sample `public/test.pdf` is kept as a manual test file; the app no longer loads any
  hard-coded PDF (Task 3 removed that path).
- Undo after deleting a highlight re-inserts it as a new row (new id), because the repository
  interface from the plan has no "restore with same id" method. Text, note and anchor are kept,
  so the user sees no difference; only the id changes.
- Reopening a PDF you have seen before resumes at its saved page instead of page 1.
- Links live in a separate `links` table (Dexie `version(2)`, indexed by `fromId`/`toId`). Symmetric
  relations (`related`, `contrasts`) are stored once with `fromId = min, toId = max` so the
  `UNIQUE(from_id,to_id)` constraint can't hold both A→B and B→A; directional relations keep the
  user's direction. Used by `listLinksForSource` to build the badges and maps.
- Overlay boxes keep `pointer-events: none` so text selection still works; only the small link
  badge inside a box sets `pointer-events: auto`, so it is the clickable part.
- A note-only node is a normal `Highlight` with `anchor.rects = []`, empty `text`, and the note in
  `note`; it needs no schema change and flows through linking, chips and maps unchanged.
- Maps are plain inline SVG (no library). The neighborhood uses a fixed ring; the full map is a
  deterministic page-ordered column with `viewBox` pan/zoom. The optional force layout is a
  circle-seeded Fruchterman–Reingold relaxation with a fixed iteration count, so it is reproducible.
- Only one transient toast is shown at a time (a new one replaces the old); the undo toast is kept
  separate so it can offer its button.
