import { initViewer, getCurrentPage, goToPage } from './pdf/viewer';
import { createToolbar, initializeApp, openFileDialog, updatePageLabel } from './ui/toolbar';
import { createHighlightFromSelection, clearSelection, showHighlightFlash } from './pdf/selection';
import { renderPageHighlights, flashHighlight, ConnectionMap } from './pdf/overlay';
import { createSidebar, renderSidebar, showToast, showUndoToast } from './ui/sidebar';
import { createMapPanel, renderNeighborhood, renderFullMap, MapNode, MapCallbacks } from './ui/map';
import { repository } from './storage/repository';
import { Highlight, Link, Anchor } from './types';
import './styles.css';

const appContainer = document.getElementById('app');
if (!appContainer) throw new Error('Missing #app container');

appContainer.replaceChildren();
appContainer.appendChild(createToolbar(toggleFullMap));

const content = document.createElement('div');
content.id = 'content';
appContainer.appendChild(content);

const viewerContainer = document.createElement('div');
viewerContainer.id = 'viewer-container';
content.appendChild(viewerContainer);

const pageContainer = document.createElement('div');
pageContainer.id = 'page-container';
viewerContainer.appendChild(pageContainer);

initViewer(pageContainer);

// Empty state is an overlay so it never destroys the canvas.
const emptyState = document.createElement('div');
emptyState.id = 'empty-state';
emptyState.className = 'empty-state';
emptyState.style.display = 'none';
emptyState.innerHTML = `
  <h2>Welcome to Study Tool</h2>
  <p>Open a PDF to start highlighting. Your last document will open automatically next time.</p>
  <button id="empty-open-btn">Open PDF</button>
`;
emptyState.querySelector('#empty-open-btn')?.addEventListener('click', openFileDialog);
viewerContainer.appendChild(emptyState);

content.appendChild(createSidebar());

const mapPanel = createMapPanel();
appContainer.appendChild(mapPanel);
mapPanel.addEventListener('map-close', () => closeMap());
mapPanel.addEventListener('map-toggle', () => toggleMapView());
let mapOpen = false;
let mapMode: 'neighborhood' | 'full' = 'neighborhood';
let mapCenterId: number | null = null;

const RELATIONS = ['related', 'defines', 'example of', 'contrasts'] as const;
const RELATION_KEYS: Record<string, string> = {
  '1': 'related',
  '2': 'defines',
  '3': 'example of',
  '4': 'contrasts',
};

// Linking state. `active` = last touched highlight; `armed` = source waiting for a target.
let activeHighlightId: number | null = null;
let linkSourceId: number | null = null;
let currentHighlights: Highlight[] = [];
let currentLinks: Link[] = [];
let pendingRelationLinkId: number | null = null;
let pendingRelationTimer: number | undefined;

function findHighlight(id: number): Highlight | undefined {
  return currentHighlights.find((h) => h.id === id);
}

function applyLinkMarkers(): void {
  document.querySelectorAll<HTMLElement>('.sidebar-item[data-highlight-id]').forEach((item) => {
    const id = Number(item.dataset.highlightId);
    item.classList.toggle('active', id === activeHighlightId);
    item.classList.toggle('armed', id === linkSourceId);
  });
  document.querySelectorAll<HTMLElement>('.link-badge[data-highlight-id]').forEach((badge) => {
    badge.classList.toggle('armed', Number(badge.dataset.highlightId) === linkSourceId);
  });
}

function labelOf(highlight: Highlight): string {
  return (highlight.text || highlight.note || 'note').slice(0, 40);
}

function mapNodeOf(highlight: Highlight): MapNode {
  return {
    id: highlight.id,
    page: highlight.anchor.page,
    label: highlight.text || highlight.note || 'note',
    isNote: highlight.anchor.rects.length === 0,
  };
}

const mapCallbacks: MapCallbacks = {
  onRecenter: (id: number) => {
    mapCenterId = id;
    mapMode = 'neighborhood';
    renderMap();
  },
  onJump: (id: number) => {
    const highlight = findHighlight(id);
    if (highlight) {
      activeHighlightId = highlight.id;
      applyLinkMarkers();
      jumpToHighlight(highlight);
    }
    closeMap();
  },
  onClose: () => closeMap(),
  onToggleView: () => toggleMapView(),
};

function neighborsOf(centerId: number): MapNode[] {
  return currentLinks
    .map((link) => (link.fromId === centerId ? link.toId : link.toId === centerId ? link.fromId : null))
    .filter((id): id is number => id !== null)
    .map((id) => findHighlight(id))
    .filter((h): h is Highlight => Boolean(h))
    .map(mapNodeOf);
}

function renderMap(): void {
  if (!mapOpen) return;
  if (mapMode === 'full') {
    renderFullMap(mapPanel, currentHighlights.map(mapNodeOf), currentLinks, mapCallbacks);
    return;
  }
  if (mapCenterId === null) return;
  const center = findHighlight(mapCenterId);
  if (!center) {
    closeMap();
    return;
  }
  renderNeighborhood(mapPanel, mapNodeOf(center), neighborsOf(mapCenterId), mapCallbacks);
}

function showMap(): void {
  renderMap();
  mapPanel.classList.remove('hidden');
}

function openNeighborhood(centerId: number): void {
  mapMode = 'neighborhood';
  mapCenterId = centerId;
  mapOpen = true;
  showMap();
}

function openFullMap(): void {
  mapMode = 'full';
  mapCenterId = null;
  mapOpen = true;
  showMap();
}

function closeMap(): void {
  mapOpen = false;
  mapCenterId = null;
  mapPanel.classList.add('hidden');
}

function toggleMap(): void {
  if (mapOpen && mapMode === 'neighborhood') {
    closeMap();
    return;
  }
  if (activeHighlightId === null) {
    showToast('Click a highlight first, then press M');
    return;
  }
  openNeighborhood(activeHighlightId);
}

function toggleFullMap(): void {
  if (mapOpen && mapMode === 'full') {
    closeMap();
    return;
  }
  openFullMap();
}

function toggleMapView(): void {
  if (mapMode === 'full') {
    const center = activeHighlightId ?? currentHighlights[0]?.id ?? null;
    if (center === null) {
      showToast('No highlights yet');
      return;
    }
    openNeighborhood(center);
  } else {
    openFullMap();
  }
}

function buildConnections(links: Link[]): ConnectionMap {
  const byId = new Map(currentHighlights.map((h) => [h.id, h]));
  const map: ConnectionMap = new Map();
  for (const h of currentHighlights) map.set(h.id, []);
  for (const link of links) {
    const a = byId.get(link.fromId);
    const b = byId.get(link.toId);
    if (!a || !b) continue;
    map.get(a.id)!.push({ id: b.id, page: b.anchor.page, label: labelOf(b), linkId: link.id, relation: link.relation });
    map.get(b.id)!.push({ id: a.id, page: a.anchor.page, label: labelOf(a), linkId: link.id, relation: link.relation });
  }
  return map;
}

function jumpToHighlight(highlight: Highlight): void {
  if (getCurrentPage() !== highlight.anchor.page) {
    goToPage(highlight.anchor.page);
    // Wait for the render then flash; boxes are redrawn on 'page-rendered'.
    setTimeout(() => flashHighlight(pageContainer, highlight.id), 500);
  } else {
    flashHighlight(pageContainer, highlight.id);
  }
}

function cancelLinking(): void {
  clearPendingRelation();
  if (linkSourceId === null) return;
  linkSourceId = null;
  applyLinkMarkers();
  showToast('Linking cancelled');
}

function clearPendingRelation(): void {
  pendingRelationLinkId = null;
  window.clearTimeout(pendingRelationTimer);
}

function offerRelation(linkId: number, fromPage: number | undefined, toPage: number): void {
  pendingRelationLinkId = linkId;
  window.clearTimeout(pendingRelationTimer);
  pendingRelationTimer = window.setTimeout(clearPendingRelation, 5000);
  showToast(`Linked p${fromPage ?? '?'} ↔ p${toPage} · 1 related · 2 defines · 3 example of · 4 contrasts`);
}

async function setRelation(linkId: number, relation: string): Promise<void> {
  clearPendingRelation();
  await repository.updateLink(linkId, { relation });
  await refreshHighlights();
  showToast(`Relation: ${relation}`);
}

async function cycleRelation(linkId: number): Promise<void> {
  const link = currentLinks.find((l) => l.id === linkId);
  if (!link) return;
  const index = RELATIONS.indexOf(link.relation as (typeof RELATIONS)[number]);
  const next = RELATIONS[(index + 1 + RELATIONS.length) % RELATIONS.length];
  await repository.updateLink(linkId, { relation: next });
  await refreshHighlights();
  showToast(`Relation: ${next}`);
}

async function armLinking(): Promise<void> {
  if (linkSourceId !== null) {
    cancelLinking();
    return;
  }
  if (activeHighlightId === null) {
    showToast('Click a highlight first, then press L');
    return;
  }
  linkSourceId = activeHighlightId;
  applyLinkMarkers();
  const source = findHighlight(linkSourceId);
  showToast(`Linking from p${source?.anchor.page ?? '?'} — click the other idea`);
}

async function completeLink(target: Highlight): Promise<void> {
  const sourceId = linkSourceId;
  if (sourceId === null) return;
  linkSourceId = null;

  if (target.id === sourceId) {
    applyLinkMarkers();
    showToast('Linking cancelled');
    return;
  }

  const source = findHighlight(sourceId);
  let link: Link | undefined;
  try {
    link = await repository.addLink({
      fromId: sourceId,
      toId: target.id,
      relation: 'related',
      origin: 'user',
      status: 'accepted',
    });
  } catch (err) {
    console.error('Failed to link:', err);
  }

  activeHighlightId = target.id;
  await refreshHighlights();
  jumpToHighlight(target);
  if (link) offerRelation(link.id, source?.anchor.page, target.anchor.page);
}

function onSidebarSelect(highlight: Highlight): void {
  if (linkSourceId !== null) {
    completeLink(highlight);
    return;
  }
  activeHighlightId = highlight.id;
  applyLinkMarkers();
  jumpToHighlight(highlight);
}

function onBadgeClick(highlightId: number): void {
  if (linkSourceId !== null) {
    const target = findHighlight(highlightId);
    if (target) completeLink(target);
    return;
  }
  activeHighlightId = highlightId;
  linkSourceId = highlightId;
  applyLinkMarkers();
  const source = findHighlight(highlightId);
  showToast(`Linking from p${source?.anchor.page ?? '?'} — click the other idea`);
}

function onOpenNeighbor(highlightId: number): void {
  const highlight = findHighlight(highlightId);
  if (!highlight) return;
  activeHighlightId = highlight.id;
  applyLinkMarkers();
  jumpToHighlight(highlight);
}

const sidebarCallbacks = {
  onSelect: onSidebarSelect,
  onDelete: async (highlight: Highlight) => {
    await repository.deleteHighlight(highlight.id);
    if (activeHighlightId === highlight.id) activeHighlightId = null;
    if (linkSourceId === highlight.id) linkSourceId = null;
    await refreshHighlights();
    const restore: Omit<Highlight, 'id'> = {
      sourceId: highlight.sourceId,
      text: highlight.text,
      note: highlight.note,
      anchor: highlight.anchor,
      createdAt: highlight.createdAt,
    };
    showUndoToast('Highlight deleted', async () => {
      await repository.addHighlight(restore);
      await refreshHighlights();
    });
  },
  onNote: async (highlight: Highlight, note: string | null) => {
    await repository.updateHighlight(highlight.id, { note });
  },
  onOpenNeighbor,
  onCycleRelation: cycleRelation,
  onUnlink: async (linkId: number) => {
    const link = currentLinks.find((l) => l.id === linkId);
    if (!link) return;
    await repository.deleteLink(linkId);
    await refreshHighlights();
    const restore: Omit<Link, 'id' | 'createdAt'> = {
      fromId: link.fromId,
      toId: link.toId,
      relation: link.relation,
      origin: link.origin,
      status: link.status,
    };
    showUndoToast('Link removed', async () => {
      await repository.addLink(restore);
      await refreshHighlights();
    });
  },
};

async function refreshHighlights(): Promise<void> {
  updatePageLabel();
  const source = await repository.getLastOpenedSource();
  if (!source) {
    currentHighlights = [];
    currentLinks = [];
    renderSidebar([], sidebarCallbacks);
    return;
  }
  currentHighlights = await repository.listHighlights(source.id);
  const links = await repository.listLinksForSource(source.id);
  currentLinks = links;
  const connections = buildConnections(links);
  renderPageHighlights(pageContainer, currentHighlights, getCurrentPage(), connections, onBadgeClick);
  renderSidebar(currentHighlights, sidebarCallbacks, connections);
  applyLinkMarkers();
  if (mapOpen) renderMap();
}

// Persist the reading position shortly after the page settles.
let savePositionTimer: number | undefined;
function schedulePositionSave(page: number): void {
  window.clearTimeout(savePositionTimer);
  savePositionTimer = window.setTimeout(async () => {
    const source = await repository.getLastOpenedSource();
    if (!source) return;
    await repository.updateSource(source.id, {
      lastPosition: { page },
      lastOpenedAt: new Date().toISOString(),
    });
  }, 500);
}

pageContainer.addEventListener('page-rendered', (e) => {
  const page = (e as CustomEvent<{ page: number }>).detail.page;
  refreshHighlights();
  schedulePositionSave(page);
});

initializeApp();

async function createNoteNode(): Promise<void> {
  const source = await repository.getLastOpenedSource();
  if (!source) {
    showToast('Open a PDF first');
    return;
  }
  const anchor: Anchor = {
    page: getCurrentPage(),
    rects: [],
    quote: { exact: '', prefix: '', suffix: '' },
  };
  const saved = await repository.addHighlight({
    sourceId: source.id,
    text: '',
    note: '',
    anchor,
    createdAt: new Date().toISOString(),
  });
  activeHighlightId = saved.id;
  await refreshHighlights();
  const input = document.querySelector<HTMLInputElement>(
    `.sidebar-item[data-highlight-id="${saved.id}"] .note-input`
  );
  input?.focus();
}

async function createHighlightFromCurrentSelection(): Promise<void> {
  const selectionData = await createHighlightFromSelection();
  if (!selectionData) return;

  const source = await repository.getLastOpenedSource();
  if (!source) return;

  const highlight: Omit<Highlight, 'id'> = {
    sourceId: source.id,
    text: selectionData.text,
    note: null,
    anchor: selectionData.anchor,
    createdAt: new Date().toISOString(),
  };

  try {
    const saved = await repository.addHighlight(highlight);
    activeHighlightId = saved.id;
    console.log('Highlight saved:', highlight);
  } catch (err) {
    console.error('Failed to save highlight:', err);
  }
  clearSelection();
  showHighlightFlash();
  await refreshHighlights();
}

document.addEventListener('keydown', async (e) => {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;

  if (e.key === 'h' || e.key === 'H') {
    await createHighlightFromCurrentSelection();
  } else if (e.key === 'n' || e.key === 'N') {
    await createNoteNode();
  } else if (e.key === 'l' || e.key === 'L') {
    await armLinking();
  } else if (e.key === 'm') {
    toggleMap();
  } else if (e.key === 'M') {
    toggleFullMap();
  } else if (e.key === 'Escape') {
    if (mapOpen) closeMap();
    else cancelLinking();
  } else if (pendingRelationLinkId !== null && RELATION_KEYS[e.key]) {
    await setRelation(pendingRelationLinkId, RELATION_KEYS[e.key]);
  }
});
