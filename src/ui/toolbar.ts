import { loadPdf, renderPage, nextPage, prevPage, getCurrentPage, getTotalPages, getPdfDoc } from '../pdf/viewer';

/**
 * Initial setup hook for the application, handles initial PDF loading and UI setup.
 * @param canvas The canvas element where the PDF will be rendered.
 */
export function initializeApp(canvas: HTMLCanvasElement) {
  console.log("Application initialization sequence started. Loading PDF...");
  
  const viewer = { 
    canvas: canvas
  };
  
  // --- Task 2 Implementation: Hardcoded PDF Path ---
  // NOTE: For Task 2 to work, a PDF file MUST be placed in the /public directory
  const PDF_PATH = '/sample.pdf'; 
  
  // 1. Load the PDF
  loadPdf(PDF_PATH)
    .catch(error => {
        console.error("Could not start PDF viewer:", error);
        // Display error state in UI here eventually
    });

  // 2. Define UI interaction handlers (These will be called by the actual DOM elements)
  viewer.handleNext = async () => {
    if (nextPage()) {
      await renderPage(getCurrentPage());
    } else {
      console.log("Reached end of PDF.");
    }
  };

  viewer.handlePrev = async () => {
    if (prevPage()) {
      await renderPage(getCurrentPage());
    } else {
      console.log("Reached beginning of PDF.");
    }
  };

  // 3. Stub for rendering the entire view
  console.log("Toolbar initialized. State managed by window.viewer stub.");
  window.viewer = viewer; 
}
