import { Anchor } from '../types';
import { getPdfDoc, getTextLayerDiv, getCurrentPage, getScale, getContainer } from './viewer';

export interface SelectionData {
  text: string;
  anchor: Anchor;
}

async function getPageTextContent(page: any): Promise<string> {
  const textContent = await page.getTextContent();
  return textContent.items.map((item: any) => item.str).join(' ');
}

function findQuoteContext(fullText: string, selectedText: string): { exact: string; prefix: string; suffix: string } {
  const index = fullText.indexOf(selectedText);
  if (index === -1) {
    return { exact: selectedText, prefix: '', suffix: '' };
  }
  const prefixStart = Math.max(0, index - 30);
  const prefix = fullText.slice(prefixStart, index);
  const suffixEnd = Math.min(fullText.length, index + selectedText.length + 30);
  const suffix = fullText.slice(index + selectedText.length, suffixEnd);
  return { exact: selectedText, prefix, suffix };
}

function mergeRects(rects: DOMRect[]): [number, number, number, number][] {
  if (rects.length === 0) return [];

  const sorted = Array.from(rects).sort((a, b) => a.top - b.top || a.left - b.left);
  const merged: [number, number, number, number][] = [];

  let current = { ...sorted[0] };

  for (let i = 1; i < sorted.length; i++) {
    const rect = sorted[i];
    const sameLine = Math.abs(rect.top - current.top) < 5;
    const overlapping = rect.left < current.right && rect.right > current.left;

    if (sameLine && (overlapping || rect.left - current.right < 10)) {
      current.right = Math.max(current.right, rect.right);
      current.bottom = Math.max(current.bottom, rect.bottom);
      current.left = Math.min(current.left, rect.left);
    } else {
      merged.push([current.left, current.top, current.width, current.height]);
      current = { ...rect };
    }
  }
  merged.push([current.left, current.top, current.width, current.height]);
  return merged;
}

export async function createHighlightFromSelection(): Promise<SelectionData | null> {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
    return null;
  }

  const range = selection.getRangeAt(0);
  const selectedText = selection.toString().trim();
  if (!selectedText) return null;

  const container = getContainer();
  const textLayerDiv = getTextLayerDiv();
  const pageNumber = getCurrentPage();
  const scale = getScale();

  if (!container || !textLayerDiv) return null;

  const containerRect = container.getBoundingClientRect();
  const clientRects = range.getClientRects();

  const rects = mergeRects(Array.from(clientRects)).map(([x, y, w, h]) => [
    (x - containerRect.left) / containerRect.width,
    (y - containerRect.top) / containerRect.height,
    w / containerRect.width,
    h / containerRect.height,
  ]);

  const pdfDoc = getPdfDoc();
  if (!pdfDoc) return null;

  const page = await pdfDoc.getPage(pageNumber);
  const fullText = await getPageTextContent(page);
  const quote = findQuoteContext(fullText, selectedText);

  const anchor: Anchor = {
    page: pageNumber,
    rects,
    quote,
  };

  return { text: selectedText, anchor };
}

export function clearSelection(): void {
  const selection = window.getSelection();
  if (selection) {
    selection.removeAllRanges();
  }
}

export function showHighlightFlash(): void {
  const flash = document.createElement('div');
  flash.className = 'selection-flash';
  flash.textContent = 'Highlighted';
  document.body.appendChild(flash);
  setTimeout(() => flash.remove(), 500);
}