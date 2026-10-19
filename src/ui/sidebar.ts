import { Highlight } from '../types';

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

export function renderSidebar(highlights: Highlight[], onSelect: (highlight: Highlight) => void): void {
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

    item.append(page, preview);
    item.addEventListener('click', () => onSelect(highlight));
    list.appendChild(item);
  }
}
