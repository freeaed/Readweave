import { loadPdf, prevPage, nextPage, goToPage, setScale, getScale, getCurrentPage, getTotalPages, fitToWidth } from '../pdf/viewer';
import { repository } from '../storage/repository';
import { getBlobHash } from '../utils/hash';
import { Source } from '../types';

let fileInput: HTMLInputElement | null = null;

function setEmptyStateVisible(visible: boolean): void {
  const el = document.getElementById('empty-state');
  if (el) el.style.display = visible ? 'flex' : 'none';
}

export function openFileDialog(): void {
  fileInput?.click();
}

export function createToolbar(): HTMLElement {
  const toolbar = document.createElement('div');
  toolbar.className = 'toolbar';

  const openBtn = document.createElement('button');
  openBtn.textContent = 'Open PDF';
  openBtn.addEventListener('click', openFileDialog);
  toolbar.appendChild(openBtn);

  fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'application/pdf';
  fileInput.addEventListener('change', async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) await handleDocumentOpen(file);
    if (fileInput) fileInput.value = '';
  });
  toolbar.appendChild(fileInput);

  const prevBtn = document.createElement('button');
  prevBtn.textContent = '← Prev';
  prevBtn.addEventListener('click', () => {
    if (prevPage()) updatePageLabel();
  });

  const pageLabel = document.createElement('span');
  pageLabel.id = 'page-label';
  pageLabel.textContent = 'Page - of -';

  const nextBtn = document.createElement('button');
  nextBtn.textContent = 'Next →';
  nextBtn.addEventListener('click', () => {
    if (nextPage()) updatePageLabel();
  });

  const zoomOutBtn = document.createElement('button');
  zoomOutBtn.textContent = '−';
  zoomOutBtn.addEventListener('click', () => {
    setScale(Math.max(0.5, getScale() - 0.2));
    updatePageLabel();
  });

  const zoomInBtn = document.createElement('button');
  zoomInBtn.textContent = '+';
  zoomInBtn.addEventListener('click', () => {
    setScale(Math.min(3.0, getScale() + 0.2));
    updatePageLabel();
  });

  const fitWidthBtn = document.createElement('button');
  fitWidthBtn.textContent = 'Fit Width';
  fitWidthBtn.addEventListener('click', async () => {
    await fitToWidth();
    updatePageLabel();
  });

  toolbar.append(prevBtn, pageLabel, nextBtn, zoomOutBtn, zoomInBtn, fitWidthBtn);

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

export function updatePageLabel(): void {
  const label = document.getElementById('page-label');
  if (label) label.textContent = `Page ${getCurrentPage()} of ${getTotalPages()}`;
}

async function handleDocumentOpen(file: File): Promise<void> {
  const hash = await getBlobHash(file);

  let source = await repository.findSourceByHash(hash);
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
    source = await repository.addSource(newSource);
  } else {
    // Reopening the same file resumes where it was left.
    await repository.updateSource(source.id, { lastOpenedAt: new Date().toISOString() });
  }

  await loadPdf(source.fileBlob);
  if (source.lastPosition?.page) {
    goToPage(source.lastPosition.page);
  }
  setEmptyStateVisible(false);
  updatePageLabel();
}

export async function initializeApp(): Promise<void> {
  const source = await repository.getLastOpenedSource();
  if (!source) {
    setEmptyStateVisible(true);
    return;
  }

  await loadPdf(source.fileBlob);
  if (source.lastPosition?.page) {
    goToPage(source.lastPosition.page);
  }
  setEmptyStateVisible(false);
  updatePageLabel();
}
