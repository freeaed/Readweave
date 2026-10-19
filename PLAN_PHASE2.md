# Highlight & Link Tool: Phase 2 Plan (Linking + Map)

This continues Phase 1. Read `AGENT_PLAN.md` for the overall vision and `schema.sql` for the
data shapes. The same rules apply: **low friction above all**, one task at a time, one commit per
task, all storage behind `src/storage/repository.ts`, no new libraries.

## 1. Goal of Phase 2
Turn a flat list of highlights into a small graph: connect an idea on page 2 with a related idea on
page 10, see those connections while reading, and view them as a map. No folders, no tags, no forms.

## 2. Decisions (locked)
- **Link key: `L`.** Arm a highlight as the source, then click the target. `Esc` cancels.
- **Map first: the neighborhood view** (`M`): one highlight and its direct neighbors (one hop).
  A full map comes after. Neighborhood is the most useful for review and is deterministic.
- **Nodes can be highlights OR notes.** A note-only node is a normal `Highlight` with **no rects**
  (`anchor.rects = []`) anchored to the current page, with its text in `note`. This keeps the
  `schema.sql` shapes untouched (`text` stays `''`, `anchor` is valid JSON).
- **Relationships stay optional.** Default `relation = 'related'`. After linking, a toast offers
  presets by number key; ignoring it is fine. Nothing blocks on a label.
- **Undirected storage for symmetric links.** `related`/`contrasts` are stored once with
  `from_id = min(id), to_id = max(id)` to respect `UNIQUE(from_id,to_id)`; directional relations
  (`defines`, `example of`) keep the user's direction.
- Edges from the future AI layer use the existing `origin='ai'`, `status='suggested'` and are shown
  dashed until accepted. Not built in Phase 2.

## 3. Data model additions (stay compatible with schema.sql)
Types (`src/types.ts`):
```ts
type Link = {
  id: number;
  fromId: number;
  toId: number;
  relation: string;                  // default 'related'
  origin: 'user' | 'ai';
  status: 'suggested' | 'accepted' | 'rejected';
  createdAt: string;                 // ISO 8601
};
```
Repository (new methods, same interface file):
```ts
addLink(l: Omit<Link, 'id'>): Promise<Link>;
listLinksForHighlight(highlightId: number): Promise<Link[]>;
listLinksForSource(sourceId: number): Promise<Link[]>;
updateLink(id: number, patch: Partial<Link>): Promise<void>;
deleteLink(id: number): Promise<void>;
```
Dexie: bump to `version(2)` and add a `links` table indexed by `fromId` and `toId`.

## 4. UX (what the user does)
- **Arm:** press `L` while a highlight is active (last created/clicked), or click its connection
  badge. Toast: "Linking from p2 — click the other idea". Works across pages.
- **Link:** navigate (Prev/Next/click a chip) and click the target's badge (or its sidebar item).
  A row is created with default `related`; toast: "Linked p2 ↔ p10 · 1 related 2 defines …".
- **Optional label:** press `1`–`4` within the toast, or edit later from the chip.
- **Traverse while reading:** each box shows a small badge with its link count; the sidebar item
  shows connection chips (`p10 · "chlorine…"`). Click a chip to jump to that highlight.
- **Unlink:** the `×` on a chip.
- **Note-only node:** press `N` on a page (no selection) to create a page note; it appears in the
  sidebar and can be linked like any highlight.
- **Map:** press `M` on a highlight to open its neighborhood; click a neighbor to make it the new
  center; `Esc` closes.

### Technical note: clicking boxes without breaking selection
Phase 1 sets `pointer-events: none` on the overlay boxes so text selection works. We add a **small
badge element** inside each box with `pointer-events: auto`. Only the badge is clickable; the rest
of the box stays transparent to the mouse. In armed mode the badge accepts the link click.

## 5. Keyboard map (additions)
`L` arm link · `Esc` cancel/map close · `M` neighborhood map · `N` page note ·
`1`–`4` relation preset after linking · `←/→` pages · `Enter` jump to focused item.

## 6. Tasks

### P2 Task 1: Link data layer
- Add the `Link` type, the `links` table (`version(2)`), and the repository methods above,
  including the `min/max` canonicalization for symmetric relations.
- **Done when:** a link can be created between two highlights and read back (check DevTools →
  IndexedDB), and `schema.sql` shapes are still respected.

### P2 Task 2: Arm and create links with L (two clicks)
- Track an "active highlight id". `L` arms it; clicking a badge/row while armed creates the link
  with default `related`; `Esc` cancels; clicking the same node cancels; show the toast.
- **Done when:** a highlight on page 2 can be linked to one on page 10 in two clicks, and the row
  appears in `links`.

### P2 Task 3: See edges while reading
- Connection-count badges on boxes, connection chips in the sidebar that jump to the linked
  highlight, and a small `→ p10` bridge indicator on the box.
- **Done when:** every link is visible and traversable without opening the map.

### P2 Task 4: Optional presets and unlink
- Number-key presets right after linking; edit relation on a chip; `×` to unlink (with undo toast,
  reusing the Phase 1 pattern).
- **Done when:** a link can be labelled or removed without any dialog.

### P2 Task 5: Note-only nodes
- `N` creates a page note; sidebar shows it (page + note text); it links like any highlight and
  appears in counts/chips/map. Notes have no overlay box.
- **Done when:** a note with no text selection can be created, edited inline, and linked.

### P3 Task 1: Neighborhood map (M)
- SVG panel: active node centered, direct neighbors in a ring, edges as lines, labels from text/
  note; click a neighbor to recenter; click a node to jump + flash; `Esc` closes.
- **Done when:** pressing `M` shows a highlight's connections and any neighbor can be jumped to.

### P3 Task 2: Full page-ordered map
- SVG spine: all nodes of the current PDF as a vertical column ordered by page, edges as arcs to the
  right; pan/zoom via SVG `viewBox`; click to jump. Deterministic layout (no physics).
- **Done when:** all links of a PDF are visible as one map.

### P3 Task 3 (optional): Force layout toggle
- Only if the page-ordered map feels too rigid; keep it a toggle, never the default.

## 7. Out of scope for Phase 2
Folders/tags, multiple colors, search, export, accounts, backend, Tauri, code-file viewer, AI
suggestions (prepared in the schema but not built).

## 8. Later (for context)
Tauri + SQLite using `schema.sql`; code viewer (anchor `{file, start_line, end_line, symbol}` is
already sketched in the schema); AI link suggestions inserted as `status='suggested'`.

## 9. Risks / things to watch
- Armed linking must survive page navigation (state lives in the app, not the page).
- "Active highlight" is clearer with an explicit current-source concept; Phase 1 uses
  `getLastOpenedSource()` in a few places and may be tightened here.
- Keep the badge hit-area small so it never gets in the way of selecting text.
