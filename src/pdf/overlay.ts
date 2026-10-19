import { Highlight } from '../types';

const OVERLAY_CLASS = 'highlight-overlay';

function getOrCreateOverlay(container: HTMLElement): HTMLDivElement {
  let overlay = container.querySelector<HTMLDivElement>(`.${OVERLAY_CLASS}`);
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = OVERLAY_CLASS;
    container.appendChild(overlay);
  }
  return overlay;
}

// Rects are fractions of the page, so percentage positioning scales with zoom automatically.
export function renderPageHighlights(container: HTMLElement, highlights: Highlight[], page: number): void {
  const overlay = getOrCreateOverlay(container);
  overlay.replaceChildren();

  for (const highlight of highlights) {
    if (highlight.anchor.page !== page) continue;
    for (const [x, y, w, h] of highlight.anchor.rects) {
      const box = document.createElement('div');
      box.className = 'highlight-box';
      box.dataset.highlightId = String(highlight.id);
      box.style.left = `${x * 100}%`;
      box.style.top = `${y * 100}%`;
      box.style.width = `${w * 100}%`;
      box.style.height = `${h * 100}%`;
      overlay.appendChild(box);
    }
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
