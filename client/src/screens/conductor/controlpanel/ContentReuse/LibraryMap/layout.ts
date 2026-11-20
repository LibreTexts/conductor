import {
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type Force,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from "d3";

/**
 * Where each book sits on the library map. Deterministic: the same data always
 * gives the same map, so staff can learn it.
 *
 * - Books that share nothing form their library's island: a tight sunflower
 *   of dots around the library's anchor, placed directly (no simulation).
 *   Islands are packed so they don't overlap, the biggest in the middle.
 * - Books that share content are the only ones simulated (d3-force): reuse
 *   links pull them together, across libraries too, a weak pull keeps each
 *   near its own library, and they're kept outside the islands. That keeps
 *   the cost proportional to the books that share, not to every book.
 *
 * Pure, so it runs in a Web Worker or inline.
 */

export type LayoutInput = {
  /** Library of each node. */
  libs: string[];
  /** Drawn radius of each node, for collisions. */
  radius: number[];
  /** `[source, target, pages]` by node index. */
  edges: [number, number, number][];
  ticks?: number;
};

/** A library island: its centre, its radius, and how many books it holds. */
export type LayoutAnchor = { lib: string; x: number; y: number; r: number; count: number };

export type LayoutOutput = {
  x: Float32Array;
  y: Float32Array;
  anchors: LayoutAnchor[];
};

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const DEFAULT_TICKS = 260;
/** Sunflower spacing inside an island: unlinked dots (radius 2.2) don't touch. */
const ISLAND_SPACING = 3.3;
/** Room around each island for the linked books that orbit and bridge it. */
const ISLAND_MARGIN = 46;

/**
 * A simulated book. `book` is its index in the map; d3 overwrites `index`
 * with the node's place in the simulation, so it can't hold the book.
 */
type Node = SimulationNodeDatum & { book: number; ax: number; ay: number; r: number };

/** A book's dot size: how much other books reuse it (like in-links on the Wikipedia map). */
export const nodeRadius = (reusedBy: number, kind: "book" | "library") =>
  kind === "library" ? 7 : reusedBy > 0 ? Math.min(22, 3 + Math.sqrt(reusedBy) * 1.6) : 2.2;

/** Packs circles greedily outward along a spiral, biggest first, without overlap. */
const packIslands = (islands: { lib: string; count: number; r: number }[]): LayoutAnchor[] => {
  const placed: LayoutAnchor[] = [];
  for (const island of islands) {
    if (placed.length === 0) {
      placed.push({ ...island, x: 0, y: 0 });
      continue;
    }
    for (let step = 0; ; step += 1) {
      const angle = step * 0.35;
      const dist = 6 * step;
      const x = dist * Math.cos(angle);
      const y = dist * Math.sin(angle);
      const clear = placed.every((p) => Math.hypot(p.x - x, p.y - y) >= p.r + island.r + ISLAND_MARGIN);
      if (clear) {
        placed.push({ ...island, x, y });
        break;
      }
    }
  }
  return placed;
};

/** Where a book inside an island should go: just past its rim, straight out (or along `fallback` from the centre). */
const outOfIsland = (node: Node, a: LayoutAnchor, fallback: number): [number, number] | null => {
  const dx = (node.x ?? 0) - a.x;
  const dy = (node.y ?? 0) - a.y;
  const d = Math.hypot(dx, dy);
  const min = a.r + node.r + 4;
  if (d >= min) return null;
  const [ux, uy] = d > 1e-6 ? [dx / d, dy / d] : [Math.cos(fallback), Math.sin(fallback)];
  return [a.x + ux * min, a.y + uy * min];
};

/**
 * Steers linked books out of every island through their velocity, so the
 * simulation's own movement doesn't carry them back in on the next step.
 */
const keepOutOfIslands = (anchors: LayoutAnchor[]): Force<Node, undefined> => {
  let nodes: Node[] = [];
  const force = () => {
    for (const node of nodes) {
      for (const a of anchors) {
        const target = outOfIsland(node, a, node.book * GOLDEN_ANGLE);
        if (!target) continue;
        node.vx = (node.vx ?? 0) + (target[0] - (node.x ?? 0)) * 0.6;
        node.vy = (node.vy ?? 0) + (target[1] - (node.y ?? 0)) * 0.6;
      }
    }
  };
  force.initialize = (n: Node[]) => {
    nodes = n;
  };
  return force;
};

export const computeLayout = ({ libs, radius, edges, ticks = DEFAULT_TICKS }: LayoutInput): LayoutOutput => {
  const n = libs.length;
  const linked = new Uint8Array(n);
  for (const [s, t] of edges) {
    linked[s] = 1;
    linked[t] = 1;
  }

  // One island per library, sized for its books that share nothing.
  const unlinkedCount = new Map<string, number>();
  const allCount = new Map<string, number>();
  libs.forEach((lib, i) => {
    allCount.set(lib, (allCount.get(lib) ?? 0) + 1);
    if (!linked[i]) unlinkedCount.set(lib, (unlinkedCount.get(lib) ?? 0) + 1);
  });
  const islands = [...allCount.keys()]
    .map((lib) => {
      const count = unlinkedCount.get(lib) ?? 0;
      return { lib, count: allCount.get(lib)!, r: count ? ISLAND_SPACING * Math.sqrt(count) + 3 : 6 };
    })
    .sort((a, b) => b.r - a.r || a.lib.localeCompare(b.lib));
  const anchors = packIslands(islands);
  const anchorOf = new Map(anchors.map((a) => [a.lib, a]));

  const x = new Float32Array(n);
  const y = new Float32Array(n);

  // Books that share nothing: a sunflower inside their island.
  const seen = new Map<string, number>();
  libs.forEach((lib, i) => {
    if (linked[i]) return;
    const j = seen.get(lib) ?? 0;
    seen.set(lib, j + 1);
    const a = anchorOf.get(lib)!;
    const r = ISLAND_SPACING * Math.sqrt(j + 0.5);
    x[i] = a.x + r * Math.cos(j * GOLDEN_ANGLE);
    y[i] = a.y + r * Math.sin(j * GOLDEN_ANGLE);
  });

  // Books that share content: simulated, starting on their island's rim.
  const simIndex = new Map<number, number>();
  const nodes: Node[] = [];
  const rimSeen = new Map<string, number>();
  libs.forEach((lib, i) => {
    if (!linked[i]) return;
    const a = anchorOf.get(lib)!;
    const j = rimSeen.get(lib) ?? 0;
    rimSeen.set(lib, j + 1);
    const angle = j * GOLDEN_ANGLE;
    const rim = a.r + radius[i] + 12 + (j % 5) * 6;
    simIndex.set(i, nodes.length);
    nodes.push({ book: i, ax: a.x, ay: a.y, r: radius[i], x: a.x + rim * Math.cos(angle), y: a.y + rim * Math.sin(angle) });
  });

  if (nodes.length > 0) {
    const maxPages = Math.max(1, ...edges.map((e) => e[2]));
    const links: (SimulationLinkDatum<Node> & { pages: number })[] = edges.map(([s, t, pages]) => ({
      source: simIndex.get(s)!,
      target: simIndex.get(t)!,
      pages,
    }));
    const simulation = forceSimulation(nodes)
      .alphaDecay(1 - Math.pow(0.001, 1 / ticks))
      .force(
        "link",
        forceLink<Node, SimulationLinkDatum<Node> & { pages: number }>(links)
          .distance((l) => 18 + (l.source as Node).r + (l.target as Node).r)
          .strength((l) => 0.1 + 0.6 * (l.pages / maxPages)),
      )
      .force("charge", forceManyBody<Node>().strength(-30).distanceMax(260))
      .force("x", forceX<Node>((d) => d.ax).strength(0.02))
      .force("y", forceY<Node>((d) => d.ay).strength(0.02))
      .force("collide", forceCollide<Node>((d) => d.r + 1.5))
      .force("islands", keepOutOfIslands(anchors))
      .stop();
    for (let i = 0; i < ticks; i += 1) simulation.tick();
    // Whatever is still inside an island after the last step is moved just
    // outside it, so no linked book ever covers an island's books.
    for (let pass = 0; pass < 3; pass += 1) {
      for (const node of nodes) {
        for (const a of anchors) {
          const target = outOfIsland(node, a, node.book * GOLDEN_ANGLE);
          if (target) [node.x, node.y] = target;
        }
      }
    }
    for (const node of nodes) {
      x[node.book] = node.x ?? 0;
      y[node.book] = node.y ?? 0;
    }
  }

  return { x, y, anchors };
};

/**
 * Runs the layout off the main thread when the browser can, so the page
 * stays responsive while the books settle; inline otherwise.
 */
export const runLayout = (input: LayoutInput): Promise<LayoutOutput> => {
  if (typeof Worker === "undefined") return Promise.resolve(computeLayout(input));
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./layout.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (event: MessageEvent<LayoutOutput>) => {
      resolve(event.data);
      worker.terminate();
    };
    worker.onerror = (event) => {
      worker.terminate();
      // A worker that fails to start (e.g. a strict CSP) still gets a map.
      try {
        resolve(computeLayout(input));
      } catch {
        reject(event);
      }
    };
    worker.postMessage(input);
  });
};
