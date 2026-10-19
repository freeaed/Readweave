import { Anchor } from '../types';
import { getPdfDoc, getTextLayerDiv, getCurrentPage } from './viewer';

export interface SelectionData {
  text: string;
  anchor: Anchor;
}

type Rect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
};

async function getPageTextContent(page: any): Promise<string> {
  const textContent = await page.getTextContent();
  return textContent.items.map((item: any) => item.str).join(' ');
}

// DOMRect values live on the prototype, so they are lost when spread: copy explicitly.
function toRect(r: DOMRect): Rect {
  return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
}

function mergeRects(raw: DOMRectList): Rect[] {
  const rects = Array.from(raw)
    .map(toRect)
    .filter((r) => r.width > 0 && r.height > 0)
    .sort((a, b) => a.top - b.top || a.left - b.left);

  const merged: Rect[] = [];
  for (const rect of rects) {
    const last = merged[merged.length - 1];
    const sameLine = last && Math.abs(rect.top - last.top) < Math.max(2, rect.height * 0.5);
    if (last && sameLine && rect.left <= last.right + 5) {
      last.left = Math.min(last.left, rect.left);
      last.top = Math.min(last.top, rect.top);
      last.right = Math.max(last.right, rect.right);
      last.bottom = Math.max(last.bottom, rect.bottom);
      last.width = last.right - last.left;
      last.height = last.bottom - last.top;
    } else {
      merged.push({ ...rect });
    }
  }
  return merged;
}

function findQuoteContext(fullText: string, selectedText: string): { exact: string; prefix: string; suffix: string } {
  const index = fullText.indexOf(selectedText);
  if (index === -1) {
    return { exact: selectedText, prefix: '', suffix: '' };
  }
  const prefix = fullText.slice(Math.max(0, index - 30), index);
  const suffix = fullText.slice(index + selectedText.length, index + selectedText.length + 30);
  return { exact: selectedText, prefix, suffix };
}

export async function createHighlightFromSelection(): Promise<SelectionData | null> {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null;

  const range = selection.getRangeAt(0);
  const selectedText = selection.toString().replace(/\s+/g, ' ').trim();
  if (!selectedText) return null;

  const textLayerDiv = getTextLayerDiv();
  const pdfDoc = getPdfDoc();
  const pageNumber = getCurrentPage();
  if (!textLayerDiv || !pdfDoc) return null;

  // Selection rects are in viewport coordinates; the text layer matches the page exactly.
  const layerRect = textLayerDiv.getBoundingClientRect();
  if (layerRect.width === 0 || layerRect.height === 0) return null;

  const rects = mergeRects(range.getClientRects()).map((r): [number, number, number, number] => [
    (r.left - layerRect.left) / layerRect.width,
    (r.top - layerRect.top) / layerRect.height,
    r.width / layerRect.width,
    r.height / layerRect.height,
  ]);
  if (rects.length === 0) return null;

  const page = await pdfDoc.getPage(pageNumber);
  const fullText = await getPageTextContent(page);
  const quote = findQuoteContext(fullText, selectedText);

  return {
    text: selectedText,
    anchor: { page: pageNumber, rects, quote },
  };
}

export function clearSelection(): void {
  window.getSelection()?.removeAllRanges();
}

export function showHighlightFlash(): void {
  const flash = document.createElement('div');
  flash.className = 'selection-flash';
  flash.textContent = 'Highlighted';
  document.body.appendChild(flash);
  setTimeout(() => flash.remove(), 500);
}
