import * as pdfjsLib from 'pdfjs-dist/build/pdf';

// Ensure pdfjsLib uses the locally served worker
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdfjs/build/pdf.worker.js';

// State management for the viewer
type ViewerState = {
  pdfDoc: pdfjsLib.PDFDocumentProxy | null;
  pageNumber: number;
  pdfUrl: string | null;
  canvas: HTMLCanvasElement | null;
  scale: number; // Initial zoom level
  totalPageCount: number;
};

const viewerState: ViewerState = {
  pdfDoc: null,
  pageNumber: 1,
  pdfUrl: null,
  canvas: null,
  scale: 1.2, // Default zoom level
  totalPageCount: 0,
};

/**
 * Fetches and loads a PDF document.
 * @param url The URL of the PDF file (relative to /public).
 */
export async function loadPdf(url: string) {
  viewerState.pdfUrl = url;
  console.log(`Loading PDF from: ${url}`);

  try {
    const loadingTask = pdfjsLib.getDocument(url);
    const pdfDoc = await loadingTask.promise;
    viewerState.pdfDoc = pdfDoc;
    viewerState.totalPageCount = pdfDoc.numPages;
    
    console.log(`PDF loaded successfully. Total pages: ${pdfDoc.numPages}`);
    // Immediately render the first page upon successful load
    await renderPage(1); 
  } catch (error) {
    console.error("Error loading PDF:", error);
    throw new Error("Failed to load PDF. Ensure a PDF file exists in /public/");
  }
}

/**
 * Renders a specific page onto the canvas.
 * @param pageNumber The 1-based index of the page to render.
 */
export async function renderPage(pageNumber: number): Promise<void> {
  if (!viewerState.pdfDoc) {
    console.warn("PDF document not loaded yet.");
    // Optionally show a loading/error state in UI
    return;
  }
  
  const page = await viewerState.pdfDoc.getPage(pageNumber);

  // Handle canvas setup (Ideally this is done once in the UI)
  if (!viewerState.canvas) {
    console.error("Canvas element not provided or found.");
    return;
  }
  viewerState.canvas = viewerState.canvas; // Ensure the canvas is set
  
  const viewport = page.getViewport({ scale: viewerState.scale });
  
  // Set canvas dimensions
  viewerState.canvas.height = viewport.height;
  viewerState.canvas.width = viewport.width;

  const renderContext = {
    canvasContext: viewerState.canvas.getContext('2d'),
    viewport: viewport,
  };

  // Render PDF page to canvas
  await page.render(renderContext).promise;
  
  console.log(`Page ${pageNumber} rendered successfully.`);
}

// Navigation functions
export function nextPage(): boolean {
  if (viewerState.pdfDoc && viewerState.pageNumber < viewerState.totalPageCount) {
    viewerState.pageNumber++;
    return true;
  }
  return false;
}

export function prevPage(): boolean {
  if (viewerState.pdfDoc && viewerState.pageNumber > 1) {
    viewerState.pageNumber--;
    return true;
  }
  return false;
}

// Getters
export function getCurrentPage(): number {
  return viewerState.pageNumber;
}

export function getTotalPages(): number {
  return viewerState.totalPageCount;
}

export function getPdfDoc() {
    return viewerState.pdfDoc;
}
