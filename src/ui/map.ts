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
  const close = document.createElement('button');
  close.className = 'map-close';
  close.textContent = '×';
  close.title = 'Close (Esc)';
  close.addEventListener('click', () => panel.dispatchEvent(new CustomEvent('map-close')));
  header.append(title, hint, close);

  const svg = svgEl('svg');
  svg.classList.add('map-svg');
  svg.setAttribute('viewBox', `0 0 ${WIDTH} ${HEIGHT}`);
  svg.setAttribute('width', String(WIDTH));
  svg.setAttribute('height', String(HEIGHT));

  panel.append(header, svg);
  return panel;
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
