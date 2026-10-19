import { initViewer, getCurrentPage, goToPage } from './pdf/viewer';
import { createToolbar, initializeApp, openFileDialog, updatePageLabel } from './ui/toolbar';
import { createHighlightFromSelection, clearSelection, showHighlightFlash } from './pdf/selection';
import { renderPageHighlights, flashHighlight } from './pdf/overlay';
import { createSidebar, renderSidebar, showUndoToast } from './ui/sidebar';
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

function jumpToHighlight(highlight: Highlight): void {
  if (getCurrentPage() !== highlight.anchor.page) {
    goToPage(highlight.anchor.page);
    // Wait for the render then flash; boxes are redrawn on 'page-rendered'.
    setTimeout(() => flashHighlight(pageContainer, highlight.id), 500);
  } else {
    flashHighlight(pageContainer, highlight.id);
  }
}

const sidebarCallbacks = {
  onSelect: jumpToHighlight,
  onDelete: async (highlight: Highlight) => {
    await repository.deleteHighlight(highlight.id);
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
    renderSidebar([], sidebarCallbacks);
    return;
  }
  const highlights = await repository.listHighlights(source.id);
  renderPageHighlights(pageContainer, highlights, getCurrentPage());
  renderSidebar(highlights, sidebarCallbacks);
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

document.addEventListener('keydown', async (e) => {
  if (e.key !== 'h' && e.key !== 'H') return;
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;

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
    await repository.addHighlight(highlight);
    console.log('Highlight saved:', highlight);
  } catch (err) {
    console.error('Failed to save highlight:', err);
  }
  clearSelection();
  showHighlightFlash();
  await refreshHighlights();
});
