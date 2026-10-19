import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker for Vite
const workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

type ViewerState = {
  pdfDoc: pdfjsLib.PDFDocumentProxy | null;
  pageNumber: number;
  scale: number;
  totalPageCount: number;
  container: HTMLElement | null;
  canvas: HTMLCanvasElement | null;
  textLayerDiv: HTMLDivElement | null;
  textLayer: pdfjsLib.TextLayer | null;
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
};

export function initViewer(container: HTMLElement): { canvas: HTMLCanvasElement; textLayerDiv: HTMLDivElement } {
  viewerState.container = container;

  // Create canvas
  const canvas = document.createElement('canvas');
  canvas.style.display = 'block';
  container.appendChild(canvas);
  viewerState.canvas = canvas;

  // Create text layer div
  const textLayerDiv = document.createElement('div');
  textLayerDiv.className = 'text-layer';
  textLayerDiv.style.position = 'absolute';
  textLayerDiv.style.top = '0';
  textLayerDiv.style.left = '0';
  textLayerDiv.style.pointerEvents = 'none';
  container.appendChild(textLayerDiv);
  viewerState.textLayerDiv = textLayerDiv;

  return { canvas, textLayerDiv };
}

export async function loadPdf(fileOrUrl: File | Blob | string): Promise<void> {
  console.log('Loading PDF...');

  try {
    let loadingTask: pdfjsLib.PDFDocumentLoadingTask;
    if (typeof fileOrUrl === 'string') {
      loadingTask = pdfjsLib.getDocument({ url: fileOrUrl });
    } else {
      const arrayBuffer = await fileOrUrl.arrayBuffer();
      loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    }

    const pdfDoc = await loadingTask.promise;
    viewerState.pdfDoc = pdfDoc;
    viewerState.totalPageCount = pdfDoc.numPages;
    viewerState.pageNumber = 1;

    console.log(`PDF loaded successfully. Total pages: ${pdfDoc.numPages}`);
    await renderPage(1);
  } catch (error) {
    console.error('Error loading PDF:', error);
    throw new Error('Failed to load PDF');
  }
}

export async function renderPage(pageNumber: number): Promise<string> {
  if (!viewerState.pdfDoc || !viewerState.canvas || !viewerState.textLayerDiv) {
    console.warn('PDF document or canvas not initialized');
    return '';
  }

  const page = await viewerState.pdfDoc.getPage(pageNumber);
  viewerState.pageNumber = pageNumber;

  // Get text content first
  const textContent = await page.getTextContent();
  const fullText = textContent.items.map((item: any) => item.str).join(' ');

  // Calculate viewport
  const viewport = page.getViewport({ scale: viewerState.scale });

  // Set canvas dimensions
  viewerState.canvas.height = viewport.height;
  viewerState.canvas.width = viewport.width;

  // Set text layer dimensions to match
  viewerState.textLayerDiv.style.width = `${viewport.width}px`;
  viewerState.textLayerDiv.style.height = `${viewport.height}px`;

  // Render PDF page to canvas
  const renderContext = {
    canvas: viewerState.canvas,
    canvasContext: viewerState.canvas.getContext('2d')!,
    viewport: viewport,
  };
  await page.render(renderContext).promise;

  // Render text layer using TextLayer class
  if (viewerState.textLayer) {
    viewerState.textLayer.cancel();
  }
  viewerState.textLayer = new pdfjsLib.TextLayer({
    textContentSource: textContent,
    container: viewerState.textLayerDiv,
    viewport: viewport,
  });
  await viewerState.textLayer.render();

  console.log(`Page ${pageNumber} rendered successfully.`);
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
  if (!viewerState.pdfDoc || !viewerState.container) return;
  
  const containerWidth = viewerState.container.clientWidth - 40; // padding
  const page = await viewerState.pdfDoc.getPage(viewerState.pageNumber);
  const viewport = page.getViewport({ scale: 1.0 });
  const scale = containerWidth / viewport.width;
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