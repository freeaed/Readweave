import { Highlight } from '../types';
import { ConnectionMap } from '../pdf/overlay';

export interface SidebarCallbacks {
  onSelect: (highlight: Highlight) => void;
  onDelete: (highlight: Highlight) => void;
  onNote: (highlight: Highlight, note: string | null) => void;
  onOpenNeighbor: (highlightId: number) => void;
}

function topOf(highlight: Highlight): number {
  if (highlight.anchor.rects.length === 0) return 0;
  return Math.min(...highlight.anchor.rects.map((r) => r[1]));
}

function sortHighlights(highlights: Highlight[]): Highlight[] {
  return [...highlights].sort((a, b) => {
    if (a.anchor.page !== b.anchor.page) return a.anchor.page - b.anchor.page;
    return topOf(a) - topOf(b);
  });
}

export function createSidebar(): HTMLElement {
  const sidebar = document.createElement('aside');
  sidebar.className = 'sidebar';
  const header = document.createElement('div');
  header.className = 'sidebar-header';
  header.textContent = 'Highlights';
  const list = document.createElement('div');
  list.className = 'sidebar-list';
  list.id = 'sidebar-list';
  sidebar.append(header, list);
  return sidebar;
}

export function renderSidebar(highlights: Highlight[], callbacks: SidebarCallbacks, connections?: ConnectionMap): void {
  const list = document.getElementById('sidebar-list');
  if (!list) return;
  list.replaceChildren();

  const sorted = sortHighlights(highlights);
  if (sorted.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'sidebar-empty';
    empty.textContent = 'No highlights yet. Select text and press H.';
    list.appendChild(empty);
    return;
  }

  for (const highlight of sorted) {
    const item = document.createElement('div');
    item.className = 'sidebar-item';
    item.dataset.highlightId = String(highlight.id);

    const page = document.createElement('div');
    page.className = 'page-num';
    page.textContent = `Page ${highlight.anchor.page}`;

    const preview = document.createElement('div');
    preview.className = 'text-preview';
    preview.textContent = highlight.text.slice(0, 100);

    const noteInput = document.createElement('input');
    noteInput.type = 'text';
    noteInput.className = 'note-input';
    noteInput.placeholder = 'Add a note…';
    noteInput.value = highlight.note ?? '';
    noteInput.addEventListener('click', (e) => e.stopPropagation());
    let noteTimer: number | undefined;
    noteInput.addEventListener('input', () => {
      window.clearTimeout(noteTimer);
      const value = noteInput.value;
      noteTimer = window.setTimeout(() => callbacks.onNote(highlight, value.trim() === '' ? null : value), 500);
    });
    noteInput.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') noteInput.blur();
    });

    const actions = document.createElement('div');
    actions.className = 'sidebar-item-actions';
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn';
    deleteBtn.textContent = 'Delete';
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      callbacks.onDelete(highlight);
    });
    actions.appendChild(deleteBtn);

    item.append(page, preview, noteInput);

    const neighbors = connections?.get(highlight.id) ?? [];
    if (neighbors.length > 0) {
      const chips = document.createElement('div');
      chips.className = 'connection-chips';
      for (const neighbor of neighbors) {
        const chip = document.createElement('button');
        chip.className = 'connection-chip';
        chip.textContent = `→ p${neighbor.page} · ${neighbor.label}`;
        chip.title = neighbor.label;
        chip.addEventListener('click', (e) => {
          e.stopPropagation();
          callbacks.onOpenNeighbor(neighbor.id);
        });
        chips.appendChild(chip);
      }
      item.appendChild(chips);
    }

    item.appendChild(actions);
    item.addEventListener('click', () => callbacks.onSelect(highlight));
    list.appendChild(item);
  }
}

export function showToast(message: string): void {
  // Only one transient toast at a time, so messages don't overlap.
  document.querySelectorAll('.toast:not(.undo)').forEach((el) => el.remove());
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  window.setTimeout(() => toast.remove(), 2600);
}

export function showUndoToast(message: string, onUndo: () => void): void {
  const toast = document.createElement('div');
  toast.className = 'toast undo';
  const text = document.createElement('span');
  text.textContent = message;
  const undo = document.createElement('button');
  undo.textContent = 'Undo';
  undo.addEventListener('click', () => {
    onUndo();
    toast.remove();
  });
  toast.append(text, undo);
  document.body.appendChild(toast);
  window.setTimeout(() => toast.remove(), 5000);
}
