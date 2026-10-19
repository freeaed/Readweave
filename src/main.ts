import { initViewer, getCurrentPage } from './pdf/viewer';
import { createToolbar, initializeApp, openFileDialog } from './ui/toolbar';
import { createHighlightFromSelection, clearSelection, showHighlightFlash } from './pdf/selection';
import { renderPageHighlights } from './pdf/overlay';
import { repository } from './storage/repository';
import { Highlight } from './types';
import './styles.css';

const appContainer = document.getElementById('app');
if (!appContainer) throw new Error('Missing #app container');

appContainer.replaceChildren();
appContainer.appendChild(createToolbar());

const viewerContainer = document.createElement('div');
viewerContainer.id = 'viewer-container';
appContainer.appendChild(viewerContainer);

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

async function refreshHighlights(): Promise<void> {
  const source = await repository.getLastOpenedSource();
  if (!source) return;
  const highlights = await repository.listHighlights(source.id);
  renderPageHighlights(pageContainer, highlights, getCurrentPage());
}

pageContainer.addEventListener('page-rendered', refreshHighlights);

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
