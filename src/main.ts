import { initViewer, getCurrentPage, goToPage } from './pdf/viewer';
import { createToolbar, initializeApp, openFileDialog, updatePageLabel } from './ui/toolbar';
import { createHighlightFromSelection, clearSelection, showHighlightFlash } from './pdf/selection';
import { renderPageHighlights, flashHighlight } from './pdf/overlay';
import { createSidebar, renderSidebar, showToast, showUndoToast } from './ui/sidebar';
import { repository } from './storage/repository';
import { Highlight } from './types';
import './styles.css';

const appContainer = document.getElementById('app');
if (!appContainer) throw new Error('Missing #app container');

appContainer.replaceChildren();
appContainer.appendChild(createToolbar());

const content = document.createElement('div');
content.id = 'content';
appContainer.appendChild(content);

const viewerContainer = document.createElement('div');
viewerContainer.id = 'viewer-container';
content.appendChild(viewerContainer);

const pageContainer = document.createElement('div');
pageContainer.id = 'page-container';
viewerContainer.appendChild(pageContainer);

initViewer(pageContainer);

// Empty state is an overlay so it never destroys the canvas.
const emptyState = document.createElement('div');
emptyState.id = 'empty-state';
emptyState.className = 'empty-state';
emptyState.style.display = 'none';
emptyState.innerHTML = `
  <h2>Welcome to Study Tool</h2>
  <p>Open a PDF to start highlighting. Your last document will open automatically next time.</p>
  <button id="empty-open-btn">Open PDF</button>
`;
emptyState.querySelector('#empty-open-btn')?.addEventListener('click', openFileDialog);
viewerContainer.appendChild(emptyState);

content.appendChild(createSidebar());

// Linking state. `active` = last touched highlight; `armed` = source waiting for a target.
let activeHighlightId: number | null = null;
let linkSourceId: number | null = null;
let currentHighlights: Highlight[] = [];

function findHighlight(id: number): Highlight | undefined {
  return currentHighlights.find((h) => h.id === id);
}

function applyLinkMarkers(): void {
  const items = document.querySelectorAll<HTMLElement>('.sidebar-item[data-highlight-id]');
  items.forEach((item) => {
    const id = Number(item.dataset.highlightId);
    item.classList.toggle('active', id === activeHighlightId);
    item.classList.toggle('armed', id === linkSourceId);
  });
}

function jumpToHighlight(highlight: Highlight): void {
  if (getCurrentPage() !== highlight.anchor.page) {
    goToPage(highlight.anchor.page);
    // Wait for the render then flash; boxes are redrawn on 'page-rendered'.
    setTimeout(() => flashHighlight(pageContainer, highlight.id), 500);
  } else {
    flashHighlight(pageContainer, highlight.id);
  }
}

function cancelLinking(): void {
  if (linkSourceId === null) return;
  linkSourceId = null;
  applyLinkMarkers();
  showToast('Linking cancelled');
}

async function armLinking(): Promise<void> {
  if (linkSourceId !== null) {
    cancelLinking();
    return;
  }
  if (activeHighlightId === null) {
    showToast('Click a highlight first, then press L');
    return;
  }
  linkSourceId = activeHighlightId;
  applyLinkMarkers();
  const source = findHighlight(linkSourceId);
  showToast(`Linking from p${source?.anchor.page ?? '?'} — click the other idea`);
}

async function completeLink(target: Highlight): Promise<void> {
  const sourceId = linkSourceId;
  if (sourceId === null) return;
  linkSourceId = null;

  if (target.id === sourceId) {
    applyLinkMarkers();
    showToast('Linking cancelled');
    return;
  }

  const source = findHighlight(sourceId);
  try {
    await repository.addLink({
      fromId: sourceId,
      toId: target.id,
      relation: 'related',
      origin: 'user',
      status: 'accepted',
    });
  } catch (err) {
    console.error('Failed to link:', err);
  }

  activeHighlightId = target.id;
  await refreshHighlights();
  jumpToHighlight(target);
  showToast(`Linked p${source?.anchor.page ?? '?'} ↔ p${target.anchor.page}`);
}

function onSidebarSelect(highlight: Highlight): void {
  if (linkSourceId !== null) {
    completeLink(highlight);
    return;
  }
  activeHighlightId = highlight.id;
  applyLinkMarkers();
  jumpToHighlight(highlight);
}

const sidebarCallbacks = {
  onSelect: onSidebarSelect,
  onDelete: async (highlight: Highlight) => {
    await repository.deleteHighlight(highlight.id);
    if (activeHighlightId === highlight.id) activeHighlightId = null;
    if (linkSourceId === highlight.id) linkSourceId = null;
    await refreshHighlights();
    const restore: Omit<Highlight, 'id'> = {
      sourceId: highlight.sourceId,
      text: highlight.text,
      note: highlight.note,
      anchor: highlight.anchor,
      createdAt: highlight.createdAt,
    };
    showUndoToast('Highlight deleted', async () => {
      await repository.addHighlight(restore);
      await refreshHighlights();
    });
  },
  onNote: async (highlight: Highlight, note: string | null) => {
    await repository.updateHighlight(highlight.id, { note });
  },
};

async function refreshHighlights(): Promise<void> {
  updatePageLabel();
  const source = await repository.getLastOpenedSource();
  if (!source) {
    currentHighlights = [];
    renderSidebar([], sidebarCallbacks);
    return;
  }
  currentHighlights = await repository.listHighlights(source.id);
  renderPageHighlights(pageContainer, currentHighlights, getCurrentPage());
  renderSidebar(currentHighlights, sidebarCallbacks);
  applyLinkMarkers();
}

// Persist the reading position shortly after the page settles.
let savePositionTimer: number | undefined;
function schedulePositionSave(page: number): void {
  window.clearTimeout(savePositionTimer);
  savePositionTimer = window.setTimeout(async () => {
    const source = await repository.getLastOpenedSource();
    if (!source) return;
    await repository.updateSource(source.id, {
      lastPosition: { page },
      lastOpenedAt: new Date().toISOString(),
    });
  }, 500);
}

pageContainer.addEventListener('page-rendered', (e) => {
  const page = (e as CustomEvent<{ page: number }>).detail.page;
  refreshHighlights();
  schedulePositionSave(page);
});

initializeApp();

async function createHighlightFromCurrentSelection(): Promise<void> {
  const selectionData = await createHighlightFromSelection();
  if (!selectionData) return;

  const source = await repository.getLastOpenedSource();
  if (!source) return;

  const highlight: Omit<Highlight, 'id'> = {
    sourceId: source.id,
    text: selectionData.text,
    note: null,
    anchor: selectionData.anchor,
    createdAt: new Date().toISOString(),
  };

  try {
    const saved = await repository.addHighlight(highlight);
    activeHighlightId = saved.id;
    console.log('Highlight saved:', highlight);
  } catch (err) {
    console.error('Failed to save highlight:', err);
  }
  clearSelection();
  showHighlightFlash();
  await refreshHighlights();
}

document.addEventListener('keydown', async (e) => {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;

  if (e.key === 'h' || e.key === 'H') {
    await createHighlightFromCurrentSelection();
  } else if (e.key === 'l' || e.key === 'L') {
    await armLinking();
  } else if (e.key === 'Escape') {
    cancelLinking();
  }
});
