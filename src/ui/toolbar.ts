import { loadPdf, prevPage, nextPage, goToPage, setScale, getScale, getCurrentPage, getTotalPages, fitToWidth } from '../pdf/viewer';
import { repository } from '../storage/repository';
import { getBlobHash } from '../utils/hash';
import { Source } from '../types';

let currentCanvas: HTMLCanvasElement | null = null;
let fileInput: HTMLInputElement | null = null;

export function createToolbar(): HTMLElement {
  const toolbar = document.createElement('div');
  toolbar.className = 'toolbar';
  toolbar.style.cssText = `
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: #2d2d2d;
    border-bottom: 1px solid #444;
    flex-shrink: 0;
  `;

  // Open file button
  const openBtn = document.createElement('button');
  openBtn.textContent = 'Open PDF';
  openBtn.style.cssText = 'padding: 6px 12px; background: #444; color: #ccc; border: 1px solid #555; border-radius: 4px; cursor: pointer;';
  openBtn.addEventListener('click', () => fileInput?.click());

  fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'application/pdf';
  fileInput.style.display = 'none';
  fileInput.addEventListener('change', async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
      await handleDocumentOpen(file);
    }
    // Reset value so same file can be selected again
    if (fileInput) fileInput.value = '';
  });
  toolbar.appendChild(fileInput);

  // Previous page button
  const prevBtn = document.createElement('button');
  prevBtn.textContent = '← Prev';
  prevBtn.style.cssText = 'padding: 6px 12px; background: #444; color: #ccc; border: 1px solid #555; border-radius: 4px; cursor: pointer;';
  prevBtn.addEventListener('click', () => {
    if (prevPage()) {
      updatePageLabel();
    }
  });

  // Page label
  const pageLabel = document.createElement('span');
  pageLabel.id = 'page-label';
  pageLabel.textContent = 'Page - of -';
  pageLabel.style.cssText = 'margin: 0 8px; min-width: 100px; text-align: center;';

  // Next page button
  const nextBtn = document.createElement('button');
  nextBtn.textContent = 'Next →';
  nextBtn.style.cssText = 'padding: 6px 12px; background: #444; color: #ccc; border: 1px solid #555; border-radius: 4px; cursor: pointer;';
  nextBtn.addEventListener('click', () => {
    if (nextPage()) {
      updatePageLabel();
    }
  });

  // Zoom controls
  const zoomOutBtn = document.createElement('button');
  zoomOutBtn.textContent = '−';
  zoomOutBtn.style.cssText = 'padding: 4px 10px; background: #444; color: #ccc; border: 1px solid #555; border-radius: 4px; cursor: pointer;';
  zoomOutBtn.addEventListener('click', () => {
    setScale(Math.max(0.5, getScale() - 0.2));
    updatePageLabel();
  });

  const zoomInBtn = document.createElement('button');
  zoomInBtn.textContent = '+';
  zoomInBtn.style.cssText = 'padding: 4px 10px; background: #444; color: #ccc; border: 1px solid #555; border-radius: 4px; cursor: pointer;';
  zoomInBtn.addEventListener('click', () => {
    setScale(Math.min(3.0, getScale() + 0.2));
    updatePageLabel();
  });

  const fitWidthBtn = document.createElement('button');
  fitWidthBtn.textContent = 'Fit Width';
  fitWidthBtn.style.cssText = 'padding: 6px 12px; background: #444; color: #ccc; border: 1px solid #555; border-radius: 4px; cursor: pointer;';
  fitWidthBtn.addEventListener('click', async () => {
    await fitToWidth();
    updatePageLabel();
  });

  toolbar.append(openBtn, prevBtn, pageLabel, nextBtn, zoomOutBtn, zoomInBtn, fitWidthBtn);

  // Drag and drop on the whole window
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', async (e) => {
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0];
    if (file && file.type === 'application/pdf') {
      await handleDocumentOpen(file);
    }
  });

  return toolbar;
}

function updatePageLabel(): void {
  const label = document.getElementById('page-label');
  if (label) {
    label.textContent = `Page ${getCurrentPage()} of ${getTotalPages()}`;
  }
}

async function handleDocumentOpen(file: File): Promise<void> {
  const hash = await getBlobHash(file);
  console.log(`Calculated hash: ${hash}`);

  let source: Source | undefined = await repository.findSourceByHash(hash);

  if (!source) {
    const newSource: Omit<Source, 'id'> = {
      type: 'pdf',
      title: file.name.replace(/\.pdf$/i, ''),
      contentHash: hash,
      fileBlob: file,
      lastOpenedAt: new Date().toISOString(),
      lastPosition: { page: 1 },
      createdAt: new Date().toISOString(),
    };

    console.log('Source not found. Saving new source...');
    source = await repository.addSource(newSource);
  } else {
    console.log('Source found in database. Reusing existing source.');
    await repository.updateSource(source.id, {
      lastOpenedAt: new Date().toISOString(),
      lastPosition: { page: 1 },
    });
  }

  console.log(`Loading source ID ${source?.id}`);
  await loadPdf(source!.fileBlob);
  updatePageLabel();
}

export async function initializeApp(canvas: HTMLCanvasElement): Promise<void> {
  currentCanvas = canvas;
  console.log('Application initialization sequence started.');

  // Load last opened source on startup
  const source = await repository.getLastOpenedSource();
  if (source) {
    console.log('Found last opened source. Re-loading...');
    await loadPdf(source.fileBlob);
    if (source.lastPosition?.page) {
      goToPage(source.lastPosition.page);
    }
    updatePageLabel();
  } else {
    console.log('No last opened source found.');
  }
}