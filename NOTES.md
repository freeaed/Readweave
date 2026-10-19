# Notes

## How to run
`npm install && npm run dev`, then open the printed localhost URL.

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

## Known problems
- PDF text extracted with `join(' ')` can differ from the browser selection (e.g. line breaks),
  so `quote.prefix`/`quote.suffix` may be empty for some selections. Harmless for Phase 1.

## Suggestions
- None yet.
