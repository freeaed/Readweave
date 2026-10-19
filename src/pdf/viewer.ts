import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Configure the PDF.js worker for Vite.
pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

type ViewerState = {
  pdfDoc: pdfjsLib.PDFDocumentProxy | null;
  pageNumber: number;
  scale: number;
  totalPageCount: number;
  container: HTMLElement | null;
  canvas: HTMLCanvasElement | null;
  textLayerDiv: HTMLDivElement | null;
  textLayer: pdfjsLib.TextLayer | null;
  renderTask: pdfjsLib.RenderTask | null;
};

const viewerState: ViewerState = {
  pdfDoc: null,
  pageNumber: 1,
  scale: 1.0,
  totalPageCount: 0,
  container: null,
  canvas: null,
  textLayerDiv: null,
  textLayer: null,
  renderTask: null,
};

// Guards against overlapping renders when the user pages or zooms quickly.
let renderToken = 0;

export function initViewer(container: HTMLElement): { canvas: HTMLCanvasElement; textLayerDiv: HTMLDivElement } {
  viewerState.container = container;

  const canvas = document.createElement('canvas');
  canvas.style.display = 'block';
  container.appendChild(canvas);
  viewerState.canvas = canvas;

  // PDF.js v6 expects the class name `textLayer` and its own CSS.
  const textLayerDiv = document.createElement('div');
  textLayerDiv.className = 'textLayer';
  container.appendChild(textLayerDiv);
  viewerState.textLayerDiv = textLayerDiv;

  return { canvas, textLayerDiv };
}

export async function loadPdf(fileOrUrl: File | Blob | string): Promise<void> {
  const loadingTask = typeof fileOrUrl === 'string'
    ? pdfjsLib.getDocument({ url: fileOrUrl })
    : pdfjsLib.getDocument({ data: await fileOrUrl.arrayBuffer() });

  const pdfDoc = await loadingTask.promise;
  viewerState.pdfDoc = pdfDoc;
  viewerState.totalPageCount = pdfDoc.numPages;
  viewerState.pageNumber = 1;

  await renderPage(1);
}

export async function renderPage(pageNumber: number): Promise<string> {
  const { pdfDoc, canvas, textLayerDiv, container } = viewerState;
  if (!pdfDoc || !canvas || !textLayerDiv || !container) return '';

  const token = ++renderToken;

  const page = await pdfDoc.getPage(pageNumber);
  if (token !== renderToken) return '';
  viewerState.pageNumber = pageNumber;

  const textContent = await page.getTextContent();
  if (token !== renderToken) return '';
  const fullText = textContent.items.map((item: any) => item.str).join(' ');

  const viewport = page.getViewport({ scale: viewerState.scale });
  const outputScale = new pdfjsLib.OutputScale();

  // Render the bitmap at device resolution, display at CSS size: stays sharp on HiDPI.
  canvas.width = Math.floor(viewport.width * outputScale.sx);
  canvas.height = Math.floor(viewport.height * outputScale.sy);
  canvas.style.width = `${Math.floor(viewport.width)}px`;
  canvas.style.height = `${Math.floor(viewport.height)}px`;

  // The page container defines the coordinate space for the text layer.
  container.style.width = `${Math.floor(viewport.width)}px`;
  container.style.height = `${Math.floor(viewport.height)}px`;
  container.style.setProperty('--total-scale-factor', String(viewport.scale));
  container.style.setProperty('--scale-factor', String(viewport.scale));
  container.style.setProperty('--scale-round-x', '1px');
  container.style.setProperty('--scale-round-y', '1px');

  viewerState.renderTask?.cancel();

  const transform = outputScale.scaled
    ? [outputScale.sx, 0, 0, outputScale.sy, 0, 0]
    : undefined;

  const task = page.render({
    canvas,
    canvasContext: canvas.getContext('2d')!,
    viewport,
    transform,
  });
  viewerState.renderTask = task;

  try {
    await task.promise;
  } catch (err) {
    if ((err as Error)?.name === 'RenderingCancelledException') return '';
    throw err;
  }
  if (token !== renderToken) return '';

  // Replace the previous text layer.
  if (viewerState.textLayer) {
    viewerState.textLayer.cancel();
    viewerState.textLayer = null;
  }
  textLayerDiv.replaceChildren();
  const textLayer = new pdfjsLib.TextLayer({
    textContentSource: textContent,
    container: textLayerDiv,
    viewport,
  });
  viewerState.textLayer = textLayer;
  try {
    await textLayer.render();
  } catch {
    return '';
  }
  if (token !== renderToken) return '';

  // Let the app draw stored highlights for this page.
  container.dispatchEvent(new CustomEvent('page-rendered', { detail: { page: pageNumber } }));

  return fullText;
}

export function nextPage(): boolean {
  if (viewerState.pdfDoc && viewerState.pageNumber < viewerState.totalPageCount) {
    viewerState.pageNumber++;
    renderPage(viewerState.pageNumber);
    return true;
  }
  return false;
}

export function prevPage(): boolean {
  if (viewerState.pdfDoc && viewerState.pageNumber > 1) {
    viewerState.pageNumber--;
    renderPage(viewerState.pageNumber);
    return true;
  }
  return false;
}

export function goToPage(pageNumber: number): boolean {
  if (viewerState.pdfDoc && pageNumber >= 1 && pageNumber <= viewerState.totalPageCount) {
    viewerState.pageNumber = pageNumber;
    renderPage(viewerState.pageNumber);
    return true;
  }
  return false;
}

export function setScale(scale: number): void {
  viewerState.scale = scale;
  if (viewerState.pdfDoc) {
    renderPage(viewerState.pageNumber);
  }
}

export async function fitToWidth(): Promise<void> {
  if (!viewerState.pdfDoc) return;

  const scroller = document.getElementById('viewer-container');
  const available = scroller ? scroller.clientWidth - 40 : 0;
  if (available <= 0) return;

  const page = await viewerState.pdfDoc.getPage(viewerState.pageNumber);
  const viewport = page.getViewport({ scale: 1.0 });
  const scale = available / viewport.width;
  setScale(Math.min(Math.max(scale, 0.5), 3.0));
}

export function getCurrentPage(): number {
  return viewerState.pageNumber;
}

export function getTotalPages(): number {
  return viewerState.totalPageCount;
}

export function getScale(): number {
  return viewerState.scale;
}

export function getPdfDoc() {
  return viewerState.pdfDoc;
}

export function getContainer(): HTMLElement | null {
  return viewerState.container;
}

export function getCanvas(): HTMLCanvasElement | null {
  return viewerState.canvas;
}

export function getTextLayerDiv(): HTMLDivElement | null {
  return viewerState.textLayerDiv;
}
