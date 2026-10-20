export type MapNode = {
  id: number;
  page: number;
  label: string;
  isNote: boolean;
};

export type MapEdge = {
  fromId: number;
  toId: number;
  relation: string;
};

export type NeighborEntry = {
  node: MapNode;
  relation: string;
  direction: 'both' | 'toNeighbor' | 'toCenter';
};

export function isSymmetricRelation(relation: string): boolean {
  return relation === 'related' || relation === 'contrasts';
}

export interface MapCallbacks {
  onRecenter: (id: number) => void;
  onJump: (id: number) => void;
  onClose: () => void;
  onToggleView: () => void;
}

const SVG_NS = 'http://www.w3.org/2000/svg';
const WIDTH = 560;
const HEIGHT = 460;
const CX = WIDTH / 2;
const CY = HEIGHT / 2;
const RING_RADIUS = 155;
const NODE_W = 148;
const NODE_H = 54;

function svgEl<K extends keyof SVGElementTagNameMap>(tag: K): SVGElementTagNameMap[K] {
  return document.createElementNS(SVG_NS, tag);
}

function wrap(text: string, max: number, lines: number): string[] {
  const clean = text.trim() || 'note';
  const out: string[] = [];
  let rest = clean;
  while (rest.length > 0 && out.length < lines) {
    out.push(rest.slice(0, max));
    rest = rest.slice(max);
  }
  if (rest.length > 0) out[out.length - 1] = out[out.length - 1].slice(0, max - 1) + '…';
  return out;
}

export function createMapPanel(): HTMLElement {
  const panel = document.createElement('div');
  panel.id = 'map-panel';
  panel.className = 'map-panel hidden';

  const header = document.createElement('div');
  header.className = 'map-header';
  const title = document.createElement('span');
  title.className = 'map-title';
  title.textContent = 'Neighborhood';
  const hint = document.createElement('span');
  hint.className = 'map-hint';
  hint.textContent = 'click to recenter · click center to go · Esc closes';
  const toggle = document.createElement('button');
  toggle.className = 'map-btn map-view';
  toggle.textContent = 'Full map';
  toggle.title = 'Switch between the neighborhood and the whole document (Shift+M)';
  toggle.addEventListener('click', () => panel.dispatchEvent(new CustomEvent('map-toggle')));
  const layout = document.createElement('button');
  layout.className = 'map-btn map-layout hidden';
  layout.textContent = 'Force layout';
  layout.title = 'Switch between the page-ordered layout and a force layout';
  layout.addEventListener('click', () => panel.dispatchEvent(new CustomEvent('map-layout')));
  const close = document.createElement('button');
  close.className = 'map-close';
  close.textContent = '×';
  close.title = 'Close (Esc)';
  close.addEventListener('click', () => panel.dispatchEvent(new CustomEvent('map-close')));

  const svg = svgEl('svg');
  svg.classList.add('map-svg');
  svg.setAttribute('viewBox', `0 0 ${WIDTH} ${HEIGHT}`);
  svg.setAttribute('width', String(WIDTH));
  svg.setAttribute('height', String(HEIGHT));

  const zoom = document.createElement('div');
  zoom.className = 'map-zoom';
  const zoomOut = document.createElement('button');
  zoomOut.className = 'map-btn';
  zoomOut.textContent = '−';
  zoomOut.title = 'Zoom out';
  zoomOut.addEventListener('click', () => zoomBy(svg, 1.25));
  const zoomIn = document.createElement('button');
  zoomIn.className = 'map-btn';
  zoomIn.textContent = '+';
  zoomIn.title = 'Zoom in';
  zoomIn.addEventListener('click', () => zoomBy(svg, 0.8));
  const fit = document.createElement('button');
  fit.className = 'map-btn';
  fit.textContent = 'Fit';
  fit.title = 'Fit the whole map in view';
  fit.addEventListener('click', () => fitView(svg));
  zoom.append(zoomOut, zoomIn, fit);

  header.append(title, zoom, layout, toggle, close);

  panel.append(header, svg, hint);
  attachPanZoom(svg);
  return panel;
}

type View = { x: number; y: number; w: number; h: number };

function getView(svg: SVGSVGElement): View {
  const vb = svg.viewBox.baseVal;
  return { x: vb.x, y: vb.y, w: vb.width, h: vb.height };
}

function setView(svg: SVGSVGElement, view: View): void {
  svg.setAttribute('viewBox', `${view.x} ${view.y} ${view.w} ${view.h}`);
}

function zoomBy(svg: SVGSVGElement, factor: number): void {
  const view = getView(svg);
  const cx = view.x + view.w / 2;
  const cy = view.y + view.h / 2;
  const w = view.w * factor;
  const h = view.h * factor;
  setView(svg, { x: cx - w / 2, y: cy - h / 2, w, h });
}

function fitView(svg: SVGSVGElement): void {
  const fit = svg.dataset.fit;
  if (!fit) return;
  const [x, y, w, h] = fit.split(' ').map(Number);
  setView(svg, { x, y, w, h });
}

function attachPanZoom(svg: SVGSVGElement): void {
  svg.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      const view = getView(svg);
      const rect = svg.getBoundingClientRect();
      const mx = view.x + ((e.clientX - rect.left) / rect.width) * view.w;
      const my = view.y + ((e.clientY - rect.top) / rect.height) * view.h;
      const factor = e.deltaY < 0 ? 0.9 : 1.1;
      setView(svg, {
        x: mx - (mx - view.x) * factor,
        y: my - (my - view.y) * factor,
        w: view.w * factor,
        h: view.h * factor,
      });
    },
    { passive: false }
  );

  let dragging = false;
  let startX = 0;
  let startY = 0;
  let startView: View = { x: 0, y: 0, w: 0, h: 0 };
  svg.addEventListener('mousedown', (e) => {
    dragging = true;
    startX = e.clientX;
    startY = e.clientY;
    startView = getView(svg);
  });
  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    const rect = svg.getBoundingClientRect();
    setView(svg, {
      ...startView,
      x: startView.x - ((e.clientX - startX) / rect.width) * startView.w,
      y: startView.y - ((e.clientY - startY) / rect.height) * startView.h,
    });
  });
  window.addEventListener('mouseup', () => {
    dragging = false;
  });
}

function addArrowDefs(svg: SVGSVGElement): void {
  const defs = svgEl('defs');
  const marker = svgEl('marker');
  marker.setAttribute('id', 'map-arrow');
  marker.setAttribute('viewBox', '0 0 10 10');
  marker.setAttribute('refX', '9');
  marker.setAttribute('refY', '5');
  marker.setAttribute('markerWidth', '7');
  marker.setAttribute('markerHeight', '7');
  marker.setAttribute('orient', 'auto-start-reverse');
  const head = svgEl('path');
  head.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z');
  head.setAttribute('fill', '#888');
  marker.appendChild(head);
  defs.appendChild(marker);
  svg.appendChild(defs);
}

function applyHover(svg: SVGSVGElement, id: number): void {
  svg.classList.add('has-hover');
  svg.querySelectorAll<SVGGElement>('.map-node').forEach((g) => {
    g.classList.toggle('hover', g.dataset.nodeId === String(id));
  });
  svg.querySelectorAll<SVGElement>('.map-edge, .map-edge-label').forEach((el) => {
    el.classList.toggle('hover', el.dataset.from === String(id) || el.dataset.to === String(id));
  });
}

function clearHover(svg: SVGSVGElement): void {
  svg.classList.remove('has-hover');
  svg.querySelectorAll('.hover').forEach((el) => el.classList.remove('hover'));
}

function attachNodeHover(svg: SVGSVGElement, group: SVGGElement, id: number): void {
  group.dataset.nodeId = String(id);
  group.addEventListener('mouseenter', () => applyHover(svg, id));
  group.addEventListener('mouseleave', () => clearHover(svg));
}

function addEdgeLabel(
  svg: SVGSVGElement,
  x: number,
  y: number,
  edge: MapEdge
): void {
  if (edge.relation === 'related') return;
  const text = svgEl('text');
  text.setAttribute('class', 'map-edge-label');
  text.setAttribute('x', String(x));
  text.setAttribute('y', String(y));
  text.textContent = edge.relation;
  text.dataset.from = String(edge.fromId);
  text.dataset.to = String(edge.toId);
  svg.appendChild(text);
}

function markEdgeDirection(el: SVGElement, edge: MapEdge): void {
  el.dataset.from = String(edge.fromId);
  el.dataset.to = String(edge.toId);
  if (!isSymmetricRelation(edge.relation)) el.setAttribute('marker-end', 'url(#map-arrow)');
}

function drawNode(
  svg: SVGSVGElement,
  node: MapNode,
  x: number,
  y: number,
  isCenter: boolean,
  callbacks: MapCallbacks
): void {
  const group = svgEl('g');
  group.setAttribute('class', `map-node${isCenter ? ' center' : ''}`);
  group.setAttribute('transform', `translate(${x},${y})`);

  const rect = svgEl('rect');
  rect.setAttribute('x', String(-NODE_W / 2));
  rect.setAttribute('y', String(-NODE_H / 2));
  rect.setAttribute('width', String(NODE_W));
  rect.setAttribute('height', String(NODE_H));
  rect.setAttribute('rx', '8');
  group.appendChild(rect);

  const pageText = svgEl('text');
  pageText.setAttribute('class', 'map-node-page');
  pageText.setAttribute('y', String(-NODE_H / 2 + 15));
  pageText.textContent = node.isNote ? `p${node.page} · note` : `p${node.page}`;
  group.appendChild(pageText);

  const lines = wrap(node.label, 20, node.page ? 2 : 2);
  lines.forEach((line, i) => {
    const t = svgEl('text');
    t.setAttribute('class', 'map-node-label');
    t.setAttribute('y', String(lines.length === 1 ? 6 : i === 0 ? -4 : 12));
    t.textContent = line;
    group.appendChild(t);
  });

  const title = svgEl('title');
  title.textContent = isCenter
    ? `Open p${node.page}`
    : `p${node.page} · click to explore · ↗ opens`;
  group.appendChild(title);

  if (!isCenter) {
    const jump = svgEl('g');
    jump.setAttribute('class', 'node-jump');
    const jumpCircle = svgEl('circle');
    jumpCircle.setAttribute('cx', String(NODE_W / 2 - 10));
    jumpCircle.setAttribute('cy', String(-NODE_H / 2 + 10));
    jumpCircle.setAttribute('r', '8');
    jump.appendChild(jumpCircle);
    const jumpIcon = svgEl('text');
    jumpIcon.setAttribute('class', 'node-jump-icon');
    jumpIcon.setAttribute('x', String(NODE_W / 2 - 10));
    jumpIcon.setAttribute('y', String(-NODE_H / 2 + 13.5));
    jumpIcon.textContent = '↗';
    jump.appendChild(jumpIcon);
    jump.addEventListener('click', (e) => {
      e.stopPropagation();
      callbacks.onJump(node.id);
    });
    group.appendChild(jump);
  }

  attachNodeHover(svg, group, node.id);
  group.addEventListener('click', () => {
    if (isCenter) callbacks.onJump(node.id);
    else callbacks.onRecenter(node.id);
  });

  svg.appendChild(group);
}

export function renderNeighborhood(
  panel: HTMLElement,
  center: MapNode,
  neighbors: NeighborEntry[],
  callbacks: MapCallbacks
): void {
  const svg = panel.querySelector<SVGSVGElement>('.map-svg');
  if (!svg) return;
  setView(svg, { x: 0, y: 0, w: WIDTH, h: HEIGHT });
  svg.dataset.fit = `0 0 ${WIDTH} ${HEIGHT}`;
  svg.setAttribute('width', String(WIDTH));
  svg.setAttribute('height', String(HEIGHT));
  panel.style.width = `${WIDTH}px`;
  const hint = panel.querySelector('.map-hint');
  if (hint) hint.textContent = 'click a neighbour to explore · ↗ opens it · Esc closes';
  const toggle = panel.querySelector<HTMLButtonElement>('.map-view');
  if (toggle) toggle.textContent = 'Full map';
  const layoutBtn = panel.querySelector('.map-layout');
  if (layoutBtn) layoutBtn.classList.add('hidden');
  svg.replaceChildren();
  addArrowDefs(svg);

  const positions = neighbors.map((_, i) => {
    const angle = (2 * Math.PI * i) / Math.max(neighbors.length, 1) - Math.PI / 2;
    return { x: CX + RING_RADIUS * Math.cos(angle), y: CY + RING_RADIUS * Math.sin(angle) };
  });

  neighbors.forEach((entry, i) => {
    const pos = positions[i];
    const edge: MapEdge = { fromId: center.id, toId: entry.node.id, relation: entry.relation };
    const arrowAtCenter = entry.direction === 'toCenter';
    const x1 = arrowAtCenter ? pos.x : CX;
    const y1 = arrowAtCenter ? pos.y : CY;
    const x2 = arrowAtCenter ? CX : pos.x;
    const y2 = arrowAtCenter ? CY : pos.y;

    const line = svgEl('line');
    line.setAttribute('class', 'map-edge');
    line.setAttribute('x1', String(x1));
    line.setAttribute('y1', String(y1));
    line.setAttribute('x2', String(x2));
    line.setAttribute('y2', String(y2));
    markEdgeDirection(line, edge);
    svg.appendChild(line);

    const dx = pos.x - CX;
    const dy = pos.y - CY;
    const len = Math.hypot(dx, dy) || 1;
    addEdgeLabel(svg, (CX + pos.x) / 2 + (-dy / len) * 12, (CY + pos.y) / 2 + (dx / len) * 12, edge);
  });

  if (neighbors.length === 0) {
    const empty = svgEl('text');
    empty.setAttribute('class', 'map-node-label');
    empty.setAttribute('x', String(CX));
    empty.setAttribute('y', String(CY - NODE_H / 2 - 12));
    empty.setAttribute('text-anchor', 'middle');
    empty.textContent = 'no links yet — press L to connect this to another idea';
    svg.appendChild(empty);
  }

  neighbors.forEach((entry, i) => drawNode(svg, entry.node, positions[i].x, positions[i].y, false, callbacks));
  drawNode(svg, center, CX, CY, true, callbacks);
}

// Full document map: one deterministic vertical column ordered by page, links drawn as arcs
// bulging to the right, pannable/zoomable through the SVG viewBox.
const FULL_ROW_H = 66;
const FULL_TOP = 40;
const FULL_NODE_X = 110;
const FULL_NODE_W = 240;
const FULL_NODE_H = 44;
const FULL_SPINE_X = 58;

function drawFullNode(
  svg: SVGSVGElement,
  node: MapNode,
  y: number,
  callbacks: MapCallbacks
): void {
  const group = svgEl('g');
  group.setAttribute('class', 'map-node');
  group.setAttribute('transform', `translate(${FULL_NODE_X},${y})`);

  const title = svgEl('title');
  title.textContent = `Open p${node.page}`;
  group.appendChild(title);

  const rect = svgEl('rect');
  rect.setAttribute('x', '0');
  rect.setAttribute('y', String(-FULL_NODE_H / 2));
  rect.setAttribute('width', String(FULL_NODE_W));
  rect.setAttribute('height', String(FULL_NODE_H));
  rect.setAttribute('rx', '8');
  group.appendChild(rect);

  const pageText = svgEl('text');
  pageText.setAttribute('class', 'map-node-page');
  pageText.setAttribute('x', '-8');
  pageText.setAttribute('y', '4');
  pageText.style.textAnchor = 'end';
  pageText.textContent = node.isNote ? `p${node.page} · note` : `p${node.page}`;
  group.appendChild(pageText);

  wrap(node.label, 32, 2).forEach((line, i, all) => {
    const t = svgEl('text');
    t.setAttribute('class', 'map-node-label');
    t.setAttribute('x', '12');
    t.setAttribute('y', String(all.length === 1 ? 4 : i === 0 ? -3 : 11));
    t.style.textAnchor = 'start';
    t.textContent = line;
    group.appendChild(t);
  });

  attachNodeHover(svg, group, node.id);
  group.addEventListener('click', () => callbacks.onJump(node.id));
  svg.appendChild(group);
}

export function renderFullMap(
  panel: HTMLElement,
  nodes: MapNode[],
  links: MapEdge[],
  callbacks: MapCallbacks,
  layout: 'page' | 'force' = 'page'
): void {
  const svg = panel.querySelector<SVGSVGElement>('.map-svg');
  if (!svg) return;

  const hint = panel.querySelector('.map-hint');
  if (hint) hint.textContent = 'click to open · drag to pan · scroll to zoom · Esc closes';
  const toggle = panel.querySelector<HTMLButtonElement>('.map-view');
  if (toggle) toggle.textContent = 'Neighborhood';
  const layoutBtn = panel.querySelector<HTMLButtonElement>('.map-layout');
  if (layoutBtn) {
    layoutBtn.classList.remove('hidden');
    layoutBtn.textContent = layout === 'force' ? 'Page layout' : 'Force layout';
  }

  if (layout === 'force') {
    svg.setAttribute('width', String(FORCE_W));
    svg.setAttribute('height', String(FORCE_H));
    panel.style.width = `${FORCE_W}px`;
    drawForceLayout(svg, nodes, links, callbacks);
    return;
  }

  const sorted = [...nodes].sort((a, b) => a.page - b.page || a.id - b.id);
  const index = new Map(sorted.map((n, i) => [n.id, i]));
  const contentH = FULL_TOP * 2 + Math.max(sorted.length, 1) * FULL_ROW_H;
  const contentW = FULL_NODE_X + FULL_NODE_W + 150;
  setView(svg, { x: 0, y: 0, w: contentW, h: contentH });
  svg.dataset.fit = `0 0 ${contentW} ${contentH}`;
  svg.setAttribute('width', String(contentW));
  svg.setAttribute('height', String(contentH));
  panel.style.width = `${contentW}px`;
  svg.replaceChildren();
  addArrowDefs(svg);

  const yOf = (i: number): number => FULL_TOP + i * FULL_ROW_H + FULL_NODE_H / 2;

  if (sorted.length === 0) {
    const empty = svgEl('text');
    empty.setAttribute('class', 'map-node-label');
    empty.setAttribute('x', String(contentW / 2));
    empty.setAttribute('y', String(contentH / 2));
    empty.setAttribute('text-anchor', 'middle');
    empty.textContent = 'no highlights yet — press H on some text';
    svg.appendChild(empty);
    return;
  }

  const spine = svgEl('line');
  spine.setAttribute('class', 'map-spine');
  spine.setAttribute('x1', String(FULL_SPINE_X));
  spine.setAttribute('y1', String(FULL_TOP));
  spine.setAttribute('x2', String(FULL_SPINE_X));
  spine.setAttribute('y2', String(yOf(sorted.length - 1)));
  svg.appendChild(spine);

  const edgeX = FULL_NODE_X + FULL_NODE_W;
  links.forEach((link, i) => {
    const ia = index.get(link.fromId);
    const ib = index.get(link.toId);
    if (ia === undefined || ib === undefined) return;
    const ya = yOf(ia);
    const yb = yOf(ib);
    const bulge = edgeX + 70 + Math.abs(yb - ya) * 0.25;
    const midY = (ya + yb) / 2;
    const path = svgEl('path');
    path.setAttribute('class', 'map-edge');
    path.setAttribute('fill', 'none');
    path.setAttribute('d', `M ${edgeX} ${ya} Q ${bulge} ${midY} ${edgeX} ${yb}`);
    markEdgeDirection(path, link);
    svg.appendChild(path);

    // Place labels toward the source end so arcs that share a midpoint do not collide.
    const t = 0.62;
    const mt = 1 - t;
    const labelX = mt * mt * edgeX + 2 * t * mt * bulge + t * t * edgeX;
    const labelY = mt * mt * ya + 2 * t * mt * midY + t * t * yb + (i % 2 === 0 ? -7 : 7);
    addEdgeLabel(svg, labelX, labelY, link);
  });

  sorted.forEach((node, i) => {
    const y = yOf(i);
    const tick = svgEl('line');
    tick.setAttribute('class', 'map-tick');
    tick.setAttribute('x1', String(FULL_SPINE_X));
    tick.setAttribute('y1', String(y));
    tick.setAttribute('x2', String(FULL_NODE_X - 26));
    tick.setAttribute('y2', String(y));
    svg.appendChild(tick);
    drawFullNode(svg, node, y, callbacks);
  });
}

// Optional force layout (never the default): a deterministic Fruchterman-Reingold relaxation
// seeded on a circle, so the same document always produces the same picture.
const FORCE_W = 620;
const FORCE_H = 520;

function forceLayout(
  nodes: MapNode[],
  links: MapEdge[]
): { x: number; y: number }[] {
  const n = nodes.length;
  const index = new Map(nodes.map((node, i) => [node.id, i]));
  const k = Math.sqrt((FORCE_W * FORCE_H) / Math.max(n, 1));
  const positions = nodes.map((_, i) => {
    const angle = (2 * Math.PI * i) / Math.max(n, 1);
    return { x: FORCE_W / 2 + (FORCE_W / 3) * Math.cos(angle), y: FORCE_H / 2 + (FORCE_H / 3) * Math.sin(angle) };
  });

  let temp = FORCE_W / 8;
  for (let iter = 0; iter < 300; iter++) {
    const disp = positions.map(() => ({ x: 0, y: 0 }));

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        const dx = positions[i].x - positions[j].x;
        const dy = positions[i].y - positions[j].y;
        const dist = Math.hypot(dx, dy) || 0.01;
        const force = (k * k) / dist;
        disp[i].x += (dx / dist) * force;
        disp[i].y += (dy / dist) * force;
      }
    }

    for (const link of links) {
      const i = index.get(link.fromId);
      const j = index.get(link.toId);
      if (i === undefined || j === undefined) continue;
      const dx = positions[i].x - positions[j].x;
      const dy = positions[i].y - positions[j].y;
      const dist = Math.hypot(dx, dy) || 0.01;
      const force = (dist * dist) / k;
      disp[i].x -= (dx / dist) * force;
      disp[i].y -= (dy / dist) * force;
      disp[j].x += (dx / dist) * force;
      disp[j].y += (dy / dist) * force;
    }

    for (let i = 0; i < n; i++) {
      const d = Math.hypot(disp[i].x, disp[i].y) || 0.01;
      const limited = Math.min(d, temp);
      positions[i].x = Math.max(70, Math.min(FORCE_W - 70, positions[i].x + (disp[i].x / d) * limited));
      positions[i].y = Math.max(60, Math.min(FORCE_H - 60, positions[i].y + (disp[i].y / d) * limited));
    }
    temp *= 0.95;
  }

  return positions;
}

function drawForceNode(
  svg: SVGSVGElement,
  node: MapNode,
  cx: number,
  cy: number,
  callbacks: MapCallbacks
): void {
  const group = svgEl('g');
  group.setAttribute('class', 'map-node');
  group.setAttribute('transform', `translate(${cx},${cy})`);

  const title = svgEl('title');
  title.textContent = `Open p${node.page}`;
  group.appendChild(title);

  const rect = svgEl('rect');
  rect.setAttribute('x', String(-NODE_W / 2));
  rect.setAttribute('y', String(-NODE_H / 2));
  rect.setAttribute('width', String(NODE_W));
  rect.setAttribute('height', String(NODE_H));
  rect.setAttribute('rx', '8');
  group.appendChild(rect);

  const prefix = node.isNote ? `p${node.page} · note · ` : `p${node.page} · `;
  wrap(`${prefix}${node.label}`, 22, 2).forEach((line, i, all) => {
    const t = svgEl('text');
    t.setAttribute('class', 'map-node-label');
    t.setAttribute('x', String(-NODE_W / 2 + 10));
    t.setAttribute('y', String(all.length === 1 ? 5 : i === 0 ? -3 : 13));
    t.style.textAnchor = 'start';
    t.textContent = line;
    group.appendChild(t);
  });

  attachNodeHover(svg, group, node.id);
  group.addEventListener('click', () => callbacks.onJump(node.id));
  svg.appendChild(group);
}

function drawForceLayout(
  svg: SVGSVGElement,
  nodes: MapNode[],
  links: MapEdge[],
  callbacks: MapCallbacks
): void {
  setView(svg, { x: 0, y: 0, w: FORCE_W, h: FORCE_H });
  svg.dataset.fit = `0 0 ${FORCE_W} ${FORCE_H}`;
  svg.replaceChildren();
  addArrowDefs(svg);

  if (nodes.length === 0) {
    const empty = svgEl('text');
    empty.setAttribute('class', 'map-node-label');
    empty.setAttribute('x', String(FORCE_W / 2));
    empty.setAttribute('y', String(FORCE_H / 2));
    empty.setAttribute('text-anchor', 'middle');
    empty.textContent = 'no highlights yet — press H on some text';
    svg.appendChild(empty);
    return;
  }

  const positions = forceLayout(nodes, links);
  const index = new Map(nodes.map((node, i) => [node.id, i]));

  for (const link of links) {
    const i = index.get(link.fromId);
    const j = index.get(link.toId);
    if (i === undefined || j === undefined) continue;
    const line = svgEl('line');
    line.setAttribute('class', 'map-edge');
    line.setAttribute('x1', String(positions[i].x));
    line.setAttribute('y1', String(positions[i].y));
    line.setAttribute('x2', String(positions[j].x));
    line.setAttribute('y2', String(positions[j].y));
    markEdgeDirection(line, link);
    svg.appendChild(line);

    addEdgeLabel(
      svg,
      (positions[i].x + positions[j].x) / 2,
      (positions[i].y + positions[j].y) / 2,
      link
    );
  }

  nodes.forEach((node, i) => drawForceNode(svg, node, positions[i].x, positions[i].y, callbacks));
}

