import { initViewer } from './pdf/viewer';
import { createToolbar, initializeApp } from './ui/toolbar';
import { createHighlightFromSelection, clearSelection, showHighlightFlash } from './pdf/selection';
import { repository } from './storage/repository';
import { Highlight } from './types';
import './styles.css';

console.log('Application starting up...');

const appContainer = document.getElementById('app');
if (!appContainer) {
  console.error('Could not find #app container.');
  throw new Error('Missing #app container');
}

// Create toolbar
const toolbar = createToolbar();
appContainer.appendChild(toolbar);

// Create viewer container
const viewerContainer = document.createElement('div');
viewerContainer.id = 'viewer-container';
viewerContainer.style.cssText = `
  flex: 1;
  overflow: auto;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: 20px;
  background: #1e1e1e;
  position: relative;
`;
appContainer.appendChild(viewerContainer);

// Create inner container for PDF page
const pageContainer = document.createElement('div');
pageContainer.id = 'page-container';
pageContainer.style.cssText = `
  position: relative;
  box-shadow: 0 0 20px rgba(0,0,0,0.5);
  background: white;
`;
viewerContainer.appendChild(pageContainer);

// Initialize viewer with the page container
const { canvas } = initViewer(pageContainer);

// Initialize app (load last source, setup events)
initializeApp(canvas);

// H key handler for highlighting
document.addEventListener('keydown', async (e) => {
  if (e.key !== 'h' && e.key !== 'H') return;
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;

  const selectionData = await createHighlightFromSelection();
  if (!selectionData) return;

  e.preventDefault();

  const source = await repository.getLastOpenedSource();
  if (!source) return;

  const highlight: Omit<Highlight, 'id'> = {
    sourceId: source.id,
    text: selectionData.text,
    note: null,
    anchor: selectionData.anchor,
    createdAt: new Date().toISOString(),
  };

  await repository.addHighlight(highlight);
  clearSelection();
  showHighlightFlash();
  console.log('Highlight saved:', highlight);
});