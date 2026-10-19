# Highlight & Link Tool: Agent Plan (Phase 1)

You are building the first phase of a personal study tool. Read this whole file before writing any code. Work through the tasks in order, one at a time.

## 1. What this project is

A tool for reading PDFs (later also code files) where the user can **highlight important ideas and link them together**, so connections between ideas become visible. Example: highlight how electronegativity is defined on page 12, then link it to a highlight about chlorine on page 58.

Phase 1 delivers only this: **open a PDF, highlight text with one key, see highlights again later, jump back to them, resume where you stopped.** Linking, the graph view, code files and AI come in later phases and are NOT part of this work.

## 2. The most important rule: low friction

The user has trouble with tools that need many steps or preparation (Obsidian and Notion were abandoned for that reason). Every decision must follow this:

- No setup screens, no accounts, no folders, no tags, no templates, no required titles.
- Capturing a highlight is **one key press** after selecting text.
- The app opens straight into the last PDF at the last page.
- If a choice is optional, make it optional. Never add a dialog where a default works.
- Do not add features that were not asked for in this plan.

## 3. Tech stack (decided, do not change without asking)

- **Vite + TypeScript, no UI framework.** Plain DOM code is fine for this size.
- **PDF.js** (`pdfjs-dist`) for rendering, with the text layer enabled.
- **Dexie** (IndexedDB wrapper) for storage in the web version.
- **No backend, no server, no Laravel.** The app must run with `npm run dev` and work offline after loading.
- Reason: this will later be wrapped in **Tauri** as a desktop app, and the storage will move to SQLite. So:
  - All database access goes through one module, `src/storage/repository.ts`, which exposes a small interface (see section 5). No other file may touch Dexie or IndexedDB directly.
  - Store data shapes exactly as in `schema.sql` (included in the project root) so migration is simple.

## 4. Project structure

```
/
├─ schema.sql                  (reference for the data shapes, do not run it in the web phase)
├─ AGENT_PLAN.md               (this file)
├─ index.html
├─ package.json
├─ vite.config.ts
└─ src/
   ├─ main.ts                  (starts the app, restores last session)
   ├─ types.ts                 (Source, Highlight, Anchor types)
   ├─ storage/
   │  ├─ repository.ts         (the interface + the Dexie implementation)
   │  └─ db.ts                 (Dexie setup, only imported by repository.ts)
   ├─ pdf/
   │  ├─ viewer.ts             (load document, render page, text layer, zoom)
   │  ├─ selection.ts          (turn a text selection into an anchor)
   │  └─ overlay.ts            (draw highlight boxes over a page)
   ├─ ui/
   │  ├─ sidebar.ts            (highlight list)
   │  └─ toolbar.ts            (open file, prev/next page, page number)
   └─ styles.css
```

## 5. Data shapes

```ts
type Source = {
  id: number;                 // auto-increment
  type: 'pdf';                // 'code' | 'text' arrive in later phases
  title: string;              // default: file name without extension
  contentHash: string;        // SHA-256 hex of the file bytes (crypto.subtle)
  fileBlob: Blob;             // the PDF itself (the browser cannot remember file paths)
  lastOpenedAt: string;       // ISO 8601
  lastPosition: { page: number } | null;
  createdAt: string;
};

type Anchor = {
  page: number;               // 1-based
  rects: [number, number, number, number][]; // [x, y, w, h] as FRACTIONS (0..1) of page width/height
  quote: { exact: string; prefix: string; suffix: string };
};

type Highlight = {
  id: number;
  sourceId: number;
  text: string;               // exact selected text
  note: string | null;
  anchor: Anchor;
  createdAt: string;
};
```

Rects are stored as fractions of the page size so they stay correct at any zoom level. `prefix` and `suffix` are up to 30 characters of page text before and after the selection (empty string if not found). They are the fallback for re-finding a highlight in a later phase, so store them now.

Repository interface (implement with Dexie now, SQLite later):

```ts
interface Repository {
  addSource(s: Omit<Source, 'id'>): Promise<Source>;
  findSourceByHash(hash: string): Promise<Source | undefined>;
  getSource(id: number): Promise<Source | undefined>;
  getLastOpenedSource(): Promise<Source | undefined>;
  updateSource(id: number, patch: Partial<Source>): Promise<void>;
  addHighlight(h: Omit<Highlight, 'id'>): Promise<Highlight>;
  listHighlights(sourceId: number): Promise<Highlight[]>;
  updateHighlight(id: number, patch: Partial<Highlight>): Promise<void>;
  deleteHighlight(id: number): Promise<void>;
}
```

Opening a PDF that was opened before (same hash) must reuse the existing source and its highlights, not create a duplicate.

## 6. Tasks

Work on one task at a time. After each task: run the app, check the "Done when" line yourself, make a git commit with a clear message (`task N: <title>`), then move to the next. Do not start a task until the previous one works.

### Task 1: Project skeleton
- Create the Vite + TypeScript project, install `pdfjs-dist` and `dexie`.
- Create the folder structure above with empty or minimal files.
- Define the types and the `Repository` interface with the Dexie implementation (tables: `sources`, `highlights`; index `contentHash` on sources and `sourceId` on highlights).
- Initialize git with a `.gitignore` (node_modules, dist).
- **Done when:** `npm run dev` shows a blank page with the app title and no console errors.

### Task 2: Show a PDF
- Configure the PDF.js worker for Vite (import the worker with `?url`).
- Render page 1 of any PDF onto a canvas, with Previous and Next buttons and a "page X of Y" label. One page at a time is fine.
- For this task you may load a PDF from a hard-coded path in `public/`, to be replaced in task 3.
- **Done when:** you can flip through a PDF's pages.

### Task 3: Open your own PDF and remember it
- Add an "Open PDF" button and also accept a PDF dragged onto the window.
- Compute the SHA-256 hash. If a source with this hash exists, reuse it; otherwise save a new source with the file blob.
- On app start, load the most recently opened source automatically (`getLastOpenedSource`). If there is none, show a simple empty state with the open button.
- Remove the hard-coded PDF from task 2.
- **Done when:** after opening a PDF and refreshing the page, the same PDF appears without choosing it again.

### Task 4: Text selection
- Add the PDF.js text layer on top of the canvas (positioned and scaled to match; use the `TextLayer` class from `pdfjs-dist` and its CSS).
- Add a zoom control (at least: smaller, larger, fit to width).
- **Done when:** selecting a sentence with the mouse works like in a normal PDF reader, at several zoom levels.

### Task 5: Save a highlight with one key
- On pressing **H** while text is selected, create a highlight:
  - `text`: the selected text, trimmed.
  - `anchor.page`: the page that contains the selection.
  - `anchor.rects`: from `range.getClientRects()`, converted to fractions of the page container's width and height. Merge rectangles that overlap or sit on the same line to avoid dozens of tiny boxes.
  - `anchor.quote`: `exact` = selected text; `prefix` and `suffix` = up to 30 characters from the page's text content around it (use `page.getTextContent()`, join the item strings, and search for the selection; if not found, use empty strings).
- Save through the repository, clear the selection, and show a short unobtrusive confirmation (for example, the highlight briefly flashing).
- Ignore the key when nothing is selected, and ignore it when the user is typing in an input field.
- **Done when:** a new record exists in the `highlights` table (check in browser DevTools, Application tab) with sensible values.

### Task 6: Draw saved highlights
- When a page is rendered, load its highlights and draw semi-transparent colored boxes over the rects. Boxes must scale correctly with zoom and must not block text selection (`pointer-events: none`).
- Redraw correctly when changing page or zoom.
- **Done when:** highlights are still visible after a full refresh, at any zoom level.

### Task 7: Sidebar list
- A sidebar lists all highlights of the current PDF, ordered by page then by position. Each item shows page number and the first ~100 characters of text.
- Clicking an item jumps to its page and makes its boxes flash for about one second.
- **Done when:** you can find and jump to any highlight within two seconds.

### Task 8: Resume where you stopped
- Save `lastPosition.page` whenever the page changes (debounce about 500 ms) and update `lastOpenedAt`.
- On start, open the last PDF at the last page.
- **Done when:** closing the tab and reopening the app puts you on the same page.

### Task 9: Delete and note
- Each sidebar item gets a small delete button (with an undo toast instead of a confirm dialog) and an optional one-line note that can be edited inline.
- **Done when:** a mistaken highlight can be removed in one click and a note can be added without leaving the sidebar.

### Task 10: Real use test
- Do not write new features. Write `NOTES.md` with: how to run the app, what works, known problems, and a list of anything that felt slow or annoying. The human will read a real chapter with it and add to this list.
- **Done when:** `NOTES.md` exists and the app runs from a fresh clone with `npm install && npm run dev`.

## 7. Rules for the agent

- One task at a time, one commit per task. Do not combine tasks.
- Do not add features, libraries, or abstractions that are not in this plan. If you think something is needed, write it in `NOTES.md` under "Suggestions" instead of building it.
- Keep code simple and readable; short comments where the reason is not obvious.
- Never access IndexedDB or Dexie outside `src/storage/`.
- Test by actually running the app and trying the behavior, not only by reading code. Use a real multi-page PDF (including one with a two-column layout) when you test selection.
- If something in this plan is ambiguous or impossible, make the simplest choice, note it in `NOTES.md`, and continue. Ask the human only if you are blocked.
- After each task, report in two or three sentences: what works now and what to try.

## 8. Out of scope for Phase 1 (do not build)

Links between highlights, graph view, code file viewing, AI or embeddings, tags or folders, multiple colors, search, export, user accounts, a backend, the Tauri wrapper, mobile support.

## 9. What comes next (for context only)

- **Phase 2:** link two highlights with two clicks; badge showing connections.
- **Phase 3:** neighborhood graph view (one highlight and its neighbors).
- **Then:** wrap in Tauri with SQLite using `schema.sql`; add the code viewer; then AI suggestions.

Because of this, keep all storage behind `repository.ts` and keep highlight data in the shapes above.
