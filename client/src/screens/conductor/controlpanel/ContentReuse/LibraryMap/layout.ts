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
  /** Simulation steps; defaults to {@link ticksFor} the books that share. */
  ticks?: number;
};

/** Called with the share of the layout done, 0 to 1. */
export type LayoutProgress = (done: number) => void;

/** A library island: its centre, its radius, and how many books it holds. */
export type LayoutAnchor = { lib: string; x: number; y: number; r: number; count: number };

export type LayoutOutput = {
  x: Float32Array;
  y: Float32Array;
  anchors: LayoutAnchor[];
};

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const DEFAULT_TICKS = 260;
/** Fewest steps a large graph gets; below this the neighbourhoods don't settle. */
const MIN_TICKS = 120;
/** Simulated books up to which every graph gets {@link DEFAULT_TICKS}. */
const FULL_TICKS_UP_TO = 2000;
/** Report progress about this often, in steps. */
const PROGRESS_EVERY = 10;

/**
 * Steps for a simulation of `simulated` books. Each step costs about
 * n log n, so a large graph gets fewer: 260 up to 2,000 books, falling to
 * 120 by about 4,300 (measured: 10.8 s → about 5 s for 7,000 books).
 * Depends only on the input, so the map stays deterministic.
 */
export const ticksFor = (simulated: number) =>
  simulated <= FULL_TICKS_UP_TO
    ? DEFAULT_TICKS
    : Math.max(MIN_TICKS, Math.round((DEFAULT_TICKS * FULL_TICKS_UP_TO) / simulated));
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

export const computeLayout = (
  { libs, radius, edges, ticks: requestedTicks }: LayoutInput,
  onProgress?: LayoutProgress,
): LayoutOutput => {
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
    const ticks = requestedTicks ?? ticksFor(nodes.length);
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
    for (let i = 0; i < ticks; i += 1) {
      simulation.tick();
      if (onProgress && i % PROGRESS_EVERY === 0) onProgress(i / ticks);
    }
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

// ── Browser cache ────────────────────────────────────────────────────────────

/** Bump when the layout rules change, so cached layouts are redone. */
const LAYOUT_VERSION = 2;
const CACHE_KEY = "conductor.libraryMap.layout";

/** FNV-1a over the input: the same data gives the same key. */
export const layoutKey = ({ libs, radius, edges, ticks }: LayoutInput): string => {
  let h = 0x811c9dc5;
  const mix = (value: number) => {
    h ^= value;
    h = Math.imul(h, 0x01000193) >>> 0;
  };
  const mixString = (str: string) => {
    for (let i = 0; i < str.length; i += 1) mix(str.charCodeAt(i));
    mix(0);
  };
  mix(LAYOUT_VERSION);
  mix(ticks ?? -1);
  libs.forEach(mixString);
  for (const r of radius) mix(Math.round(r * 100));
  for (const [s, t, pages] of edges) {
    mix(s);
    mix(t);
    mix(pages);
  }
  return `${LAYOUT_VERSION}:${libs.length}:${edges.length}:${h.toString(16)}`;
};

type CachedLayout = { key: string; x: number[]; y: number[]; anchors: LayoutAnchor[] };

/** The stored layout for this input, if the browser kept one. */
const readCachedLayout = (key: string): LayoutOutput | null => {
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw) as CachedLayout;
    if (cached.key !== key || cached.x.length !== cached.y.length) return null;
    return { x: Float32Array.from(cached.x), y: Float32Array.from(cached.y), anchors: cached.anchors };
  } catch {
    return null;
  }
};

/** Keeps one layout (the latest), rounded to a tenth of a unit to stay small. */
const writeCachedLayout = (key: string, out: LayoutOutput) => {
  try {
    const round = (v: number) => Math.round(v * 10) / 10;
    const cached: CachedLayout = {
      key,
      x: Array.from(out.x, round),
      y: Array.from(out.y, round),
      anchors: out.anchors,
    };
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(cached));
  } catch {
    // Storage full or blocked: the next visit lays the map out again.
  }
};

/** Messages from the layout worker. */
export type LayoutWorkerMessage =
  | { type: "progress"; done: number }
  | { type: "done"; out: LayoutOutput };

/**
 * Runs the layout off the main thread when the browser can, so the page
 * stays responsive while the books settle; inline otherwise. A layout this
 * browser already computed for the same data is reused straight away.
 */
export const runLayout = (input: LayoutInput, onProgress?: LayoutProgress): Promise<LayoutOutput> => {
  const key = layoutKey(input);
  const cached = typeof window !== "undefined" ? readCachedLayout(key) : null;
  if (cached) return Promise.resolve(cached);

  const finish = (out: LayoutOutput) => {
    if (typeof window !== "undefined") writeCachedLayout(key, out);
    return out;
  };
  if (typeof Worker === "undefined") return Promise.resolve(finish(computeLayout(input, onProgress)));
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./layout.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (event: MessageEvent<LayoutWorkerMessage>) => {
      if (event.data.type === "progress") {
        onProgress?.(event.data.done);
        return;
      }
      resolve(finish(event.data.out));
      worker.terminate();
    };
    worker.onerror = (event) => {
      worker.terminate();
      // A worker that fails to start (e.g. a strict CSP) still gets a map.
      try {
        resolve(finish(computeLayout(input, onProgress)));
      } catch {
        reject(event);
      }
    };
    worker.postMessage(input);
  });
};
