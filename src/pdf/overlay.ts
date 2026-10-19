import { Highlight } from '../types';

export type NeighborInfo = { id: number; page: number; label: string };
export type ConnectionMap = Map<number, NeighborInfo[]>;

const OVERLAY_CLASS = 'highlight-overlay';

export function getOrCreateOverlay(container: HTMLElement): HTMLDivElement {
  let overlay = container.querySelector<HTMLDivElement>(`.${OVERLAY_CLASS}`);
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = OVERLAY_CLASS;
    container.appendChild(overlay);
  }
  return overlay;
}

// Rects are fractions of the page, so percentage positioning scales with zoom automatically.
// A small badge on the first rect shows how many ideas this one is linked to.
export function renderPageHighlights(
  container: HTMLElement,
  highlights: Highlight[],
  page: number,
  connections?: ConnectionMap,
  onBadgeClick?: (highlightId: number) => void
): void {
  const overlay = getOrCreateOverlay(container);
  overlay.replaceChildren();

  for (const highlight of highlights) {
    if (highlight.anchor.page !== page) continue;
    const neighbors = connections?.get(highlight.id) ?? [];

    highlight.anchor.rects.forEach(([x, y, w, h], index) => {
      const box = document.createElement('div');
      box.className = 'highlight-box';
      box.dataset.highlightId = String(highlight.id);
      box.style.left = `${x * 100}%`;
      box.style.top = `${y * 100}%`;
      box.style.width = `${w * 100}%`;
      box.style.height = `${h * 100}%`;

      if (index === 0 && neighbors.length > 0) {
        const badge = document.createElement('div');
        badge.className = 'link-badge';
        badge.dataset.highlightId = String(highlight.id);
        badge.textContent = neighbors.length <= 2
          ? neighbors.map((n) => `→p${n.page}`).join(' ')
          : `${neighbors.length}`;
        badge.title = neighbors.map((n) => `p${n.page}: ${n.label}`).join('\n');
        badge.addEventListener('click', (e) => {
          e.stopPropagation();
          onBadgeClick?.(highlight.id);
        });
        box.appendChild(badge);
      }

      overlay.appendChild(box);
    });
  }
}

export function flashHighlight(container: HTMLElement, highlightId: number): void {
  const boxes = container.querySelectorAll<HTMLElement>(`.highlight-box[data-highlight-id="${highlightId}"]`);
  boxes.forEach((box) => {
    box.classList.remove('flash');
    void box.offsetWidth;
    box.classList.add('flash');
  });
}
