export type MapNode = {
  id: number;
  page: number;
  label: string;
  isNote: boolean;
};

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
  toggle.className = 'map-toggle';
  toggle.textContent = 'Full map';
  toggle.title = 'Switch between the neighborhood and the whole document (Shift+M)';
  toggle.addEventListener('click', () => panel.dispatchEvent(new CustomEvent('map-toggle')));
  const close = document.createElement('button');
  close.className = 'map-close';
  close.textContent = '×';
  close.title = 'Close (Esc)';
  close.addEventListener('click', () => panel.dispatchEvent(new CustomEvent('map-close')));
  header.append(title, hint, toggle, close);

  const svg = svgEl('svg');
  svg.classList.add('map-svg');
  svg.setAttribute('viewBox', `0 0 ${WIDTH} ${HEIGHT}`);
  svg.setAttribute('width', String(WIDTH));
  svg.setAttribute('height', String(HEIGHT));

  panel.append(header, svg);
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

  group.addEventListener('click', () => {
    if (isCenter) callbacks.onJump(node.id);
    else callbacks.onRecenter(node.id);
  });

  svg.appendChild(group);
}

export function renderNeighborhood(
  panel: HTMLElement,
  center: MapNode,
  neighbors: MapNode[],
  callbacks: MapCallbacks
): void {
  const svg = panel.querySelector<SVGSVGElement>('.map-svg');
  if (!svg) return;
  setView(svg, { x: 0, y: 0, w: WIDTH, h: HEIGHT });
  const hint = panel.querySelector('.map-hint');
  if (hint) hint.textContent = 'click to recenter · click center to go · Esc closes';
  const toggle = panel.querySelector<HTMLButtonElement>('.map-toggle');
  if (toggle) toggle.textContent = 'Full map';
  svg.replaceChildren();

  const positions = neighbors.map((_, i) => {
    const angle = (2 * Math.PI * i) / Math.max(neighbors.length, 1) - Math.PI / 2;
    return { x: CX + RING_RADIUS * Math.cos(angle), y: CY + RING_RADIUS * Math.sin(angle) };
  });

  for (const pos of positions) {
    const line = svgEl('line');
    line.setAttribute('class', 'map-edge');
    line.setAttribute('x1', String(CX));
    line.setAttribute('y1', String(CY));
    line.setAttribute('x2', String(pos.x));
    line.setAttribute('y2', String(pos.y));
    svg.appendChild(line);
  }

  if (neighbors.length === 0) {
    const empty = svgEl('text');
    empty.setAttribute('class', 'map-node-label');
    empty.setAttribute('x', String(CX));
    empty.setAttribute('y', String(CY - NODE_H / 2 - 12));
    empty.setAttribute('text-anchor', 'middle');
    empty.textContent = 'no links yet — press L to connect this to another idea';
    svg.appendChild(empty);
  }

  neighbors.forEach((node, i) => drawNode(svg, node, positions[i].x, positions[i].y, false, callbacks));
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

  group.addEventListener('click', () => callbacks.onJump(node.id));
  svg.appendChild(group);
}

export function renderFullMap(
  panel: HTMLElement,
  nodes: MapNode[],
  links: { fromId: number; toId: number }[],
  callbacks: MapCallbacks
): void {
  const svg = panel.querySelector<SVGSVGElement>('.map-svg');
  if (!svg) return;

  const hint = panel.querySelector('.map-hint');
  if (hint) hint.textContent = 'ordered by page · click a node to jump · drag to pan · scroll to zoom · Esc closes';
  const toggle = panel.querySelector<HTMLButtonElement>('.map-toggle');
  if (toggle) toggle.textContent = 'Neighborhood';

  const sorted = [...nodes].sort((a, b) => a.page - b.page || a.id - b.id);
  const index = new Map(sorted.map((n, i) => [n.id, i]));
  const contentH = FULL_TOP * 2 + Math.max(sorted.length, 1) * FULL_ROW_H;
  const contentW = FULL_NODE_X + FULL_NODE_W + 150;
  setView(svg, { x: 0, y: 0, w: contentW, h: contentH });
  svg.replaceChildren();

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
  for (const link of links) {
    const ia = index.get(link.fromId);
    const ib = index.get(link.toId);
    if (ia === undefined || ib === undefined) continue;
    const ya = yOf(ia);
    const yb = yOf(ib);
    const bulge = edgeX + 70 + Math.abs(yb - ya) * 0.25;
    const path = svgEl('path');
    path.setAttribute('class', 'map-edge');
    path.setAttribute('fill', 'none');
    path.setAttribute('d', `M ${edgeX} ${ya} Q ${bulge} ${(ya + yb) / 2} ${edgeX} ${yb}`);
    svg.appendChild(path);
  }

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
