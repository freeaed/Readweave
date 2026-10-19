import { initViewer } from './pdf/viewer';
import { createToolbar, initializeApp } from './ui/toolbar';
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