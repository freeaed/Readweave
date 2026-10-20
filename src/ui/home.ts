import { repository } from '../storage/repository';
import { Source } from '../types';

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(diff) || diff < 0) return 'just now';
  if (diff < 60_000) return 'just now';
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function createHomeView(onOpenFile: () => void): HTMLElement {
  const root = document.createElement('div');
  root.id = 'home-view';
  root.className = 'home-view hidden';
  root.innerHTML = `
    <div class="home-card">
      <div class="home-head">
        <h2>Readweave</h2>
        <button class="home-close" title="Close (Esc)" aria-label="Close home">×</button>
      </div>
      <p class="home-sub">Recent documents</p>
      <ul class="home-list"></ul>
      <div class="home-actions">
        <button class="home-open">Open PDF</button>
        <span class="home-hint">or drag a PDF anywhere</span>
      </div>
    </div>
  `;
  root.querySelector('.home-open')?.addEventListener('click', onOpenFile);
  root.querySelector('.home-close')?.addEventListener('click', () => {
    root.dispatchEvent(new CustomEvent('home-close'));
  });
  root.addEventListener('click', (e) => {
    if (e.target === root) root.dispatchEvent(new CustomEvent('home-close'));
  });
  return root;
}

export async function renderHome(
  root: HTMLElement,
  onOpen: (source: Source) => Promise<void> | void
): Promise<void> {
  const list = root.querySelector('.home-list');
  if (!list) return;

  const [sources, lastOpened] = await Promise.all([
    repository.listSources(),
    repository.getLastOpenedSource(),
  ]);
  const counts = await Promise.all(
    sources.map((source) => repository.listHighlights(source.id).then((highlights) => highlights.length))
  );

  list.replaceChildren();
  if (sources.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'home-empty';
    empty.textContent = 'No documents yet — open a PDF to start highlighting.';
    list.appendChild(empty);
    return;
  }

  sources.forEach((source, i) => {
    const item = document.createElement('li');
    const button = document.createElement('button');
    button.className = 'home-item';
    if (source.id === lastOpened?.id) button.classList.add('current');
    button.addEventListener('click', () => {
      void onOpen(source);
    });

    const title = document.createElement('span');
    title.className = 'home-item-title';
    title.textContent = source.title || 'Untitled';

    const count = counts[i];
    const page = source.lastPosition?.page ?? 1;
    const meta = document.createElement('span');
    meta.className = 'home-item-meta';
    meta.textContent = [
      `p${page}`,
      `${count} highlight${count === 1 ? '' : 's'}`,
      relativeTime(source.lastOpenedAt),
      source.id === lastOpened?.id ? 'current' : '',
    ]
      .filter(Boolean)
      .join(' · ');

    button.append(title, meta);
    item.appendChild(button);
    list.appendChild(item);
  });
}
