# Notes

## How to run
```
npm install
npm run dev
```
Then open the printed URL (default http://localhost:5173). No setup, no account, no data folder.

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

## Known problems
- PDF text is extracted by joining text items with spaces, so `quote.prefix` / `quote.suffix`
  can be empty when a selection spans line breaks. Harmless in Phase 1 (only a re-find fallback).
- A highlight that covers several visual lines is stored as one rect per line; if a selection
  starts or ends mid-line the box follows the text box, not the exact glyphs.
- Undo after delete re-creates the highlight with a new id (see Decisions).
- Only one page is rendered at a time; there is no continuous scrolling.

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
