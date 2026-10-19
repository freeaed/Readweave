import { loadPdf } from '../pdf/viewer';
import { repository } from '../storage/repository';
import { getBlobHash } from '../utils/hash';
import '../styles.css';
import { Source } from '../types';

/**
 * Handles opening a document, whether via button or dropped file.
 * @param file The File/Blob object to process.
 * @param canvas The rendering canvas.
 */
async function handleDocumentOpen(file: File, canvas: HTMLCanvasElement) {
  const hash = await getBlobHash(file);
  console.log(`Calculated hash: ${hash}`);

  // 1. Check if source exists
  let source: Source | undefined = await repository.findSourceByHash(hash);

  if (!source) {
    // 2. Create a new source
    const newSource = {
      title: file.name.replace('.pdf', ''), // Simple title extraction
      contentHash: hash,
      fileBlob: file, // Blob storage
      // Other fields will be populated by repository.addSource later
    } as Omit<Source, 'id'>;
    
    console.log("Source not found. Saving new source...");
    source = await repository.addSource(newSource);
  } else {
    console.log("Source found in database. Reusing existing source.");
  }
  
  // 3. Load PDF and initialize viewer state
  console.log(`Loading source ID ${source?.id}`);
  // Use URL.createObjectURL for the Blob/File object to serve it to PDF.js
  await loadPdf(URL.createObjectURL(source!.fileBlob));
}

/**
 * Initialization function:
 * 1. Checks for a last opened source.
 * 2. Attaches listeners for file input/drag drop.
 * 3. If a source is found, loads its blob content.
 * @param canvas The rendering canvas element.
 */
export function initializeApp(canvas: HTMLCanvasElement) {
  console.log("Application initialization sequence started.");

  // Event Listener Setup (Mocked for this phase)
  const dropZone = document.getElementById('drop-zone');
  if (dropZone) {
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      const file = e.dataTransfer?.files?.[0] as File;
      if (file) {
        handleDocumentOpen(file, canvas);
      }
    });
    // Add dragover listener for visual feedback (ignored for code brevity)
  }

  // Task 3 Step: Load last opened source on startup
  repository.getLastOpenedSource().then(async (source) => {
    if (source) {
      console.log("Found last opened source. Re-loading...");
      // Use temporary file creation/blob access here in a real sandbox environment
      // For now, we simulate the load using the stored blob
      await loadPdf(URL.createObjectURL(source.fileBlob));
    } else {
      console.log("No last opened source found.");
    }
  });
}