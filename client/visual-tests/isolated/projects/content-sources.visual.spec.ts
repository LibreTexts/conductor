import { expect, test, type Page } from '@playwright/test';
import { stabilizeAppShell } from '../../base';

/**
 * Content Sources page at phone and desktop widths, on mocked data shaped
 * like dev book 9213. Checks the Connected books picture is hidden on small
 * screens (the tables carry the same information), shown and compact on
 * desktop, and that nothing scrolls sideways at phone width.
 * Run with: npx playwright test --project=isolated visual-tests/isolated/projects
 */

const PROJECT_ID = 'cbHAlG9FKc';
const ref = (id: string, title: string) => {
  const [lib, pageID] = [id.slice(0, id.lastIndexOf('-')), id.slice(id.lastIndexOf('-') + 1)];
  return { id, lib, title, url: `https://${lib}.libretexts.org/@go/page/${pageID}` };
};

const overview = {
  bookID: 'dev-9213',
  book: ref('dev-9213', 'Remixer Book::: Test (IV)'),
  scanned: true,
  computedAt: '2026-11-11T16:16:10.457Z',
  totals: { pages: 43, original: 11, transclude: 2, fork: 1, full: 0, mixed: 5, structural: 24, unknown: 0, viaChain: 0 },
  upstream: [],
  downstream: [],
  unscannedSources: ['eng', 'workforce', 'dev', 'chem', 'math'].map((lib, i) => ({
    lib,
    pages: i < 3 ? 2 : 1,
    sources: i < 3 ? 2 : 1,
    types: ['section'],
    examples: [`${lib}-${100 + i}`],
    exampleRefs: [ref(`${lib}-${100 + i}`, `${lib} source page`)],
  })),
  attention: { sourceChanged: 1, broken: 0 },
  recentChanges: [
    {
      source: ref('dev-8998', '2: Chapters that need updates to be included (keep hidden)'),
      fromRev: 8, toRev: 10, deleted: false, changedAt: '2026-11-11T18:41:24.029Z',
      pages: 1, frozen: false, notified: false,
    },
  ],
  notifySourceChanges: true,
  canManage: true,
};

const row = (pageID: number, title: string, depth: number, kind: string, sources: { id: string; title: string; type: string }[] = []) => ({
  ...ref(`dev-${pageID}`, title),
  pageID, depth, kind, reuseDepth: sources.length ? 1 : 0, rootSource: null, reuseCycle: false,
  sources: sources.map((s) => ({ ...ref(s.id, s.title), type: s.type, origin: 'scan', status: 'active' })),
});

const pages = {
  total: 6,
  truncated: false,
  pages: [
    row(9213, 'Remixer Book::: Test (IV)', 0, 'structural'),
    row(9214, 'Chapters', 1, 'original'),
    row(10450, '3: Introduction', 2, 'original'),
    row(10454, '3.2: Hydraulics Math', 3, 'fork', [{ id: 'workforce-3635', title: 'Hydraulics Math', type: 'fork' }]),
    row(10622, '5: Chapters that need updates to be included (keep hidden)', 2, 'transclude', [{ id: 'dev-8998', title: '2: Chapters that need updates', type: 'transclude-same' }]),
    row(10895, '5.3: Laboratory Experiments', 3, 'transclude', [{ id: 'eng-49977', title: 'Laboratory Experiments', type: 'transclude-cross' }]),
  ],
};

async function openContentSources(page: Page, width: number, height: number) {
  await page.setViewportSize({ width, height });
  await stabilizeAppShell(page);
  // Registered after the shared mocks, so these answer first.
  await page.route(/\/api\/v1\/project(\?|$)/, (route) =>
    route.fulfill({ json: { err: false, project: { projectID: PROJECT_ID, title: 'pressbooks-scarper2', libreLibrary: 'dev', libreCoverID: '9213' } } }),
  );
  await page.route(/\/api\/v1\/project\/[^/]+\/content-sources(\?|$)/, (route) =>
    route.fulfill({ json: { err: false, data: overview } }),
  );
  await page.route(/\/api\/v1\/project\/[^/]+\/content-sources\/pages(\?|$)/, (route) =>
    route.fulfill({ json: { err: false, data: pages } }),
  );
  await page.context().addCookies(
    ['conductor_access_v2', 'conductor_signed_v2'].map((name) => ({
      name, value: 'visual-test', url: 'http://localhost:3000',
    })),
  );
  await page.goto(`/projects/${PROJECT_ID}/content-sources`);
  await expect(page.getByRole('heading', { name: 'Connected books' })).toBeVisible();
  await expect(page.getByRole('link', { name: /3\.2: Hydraulics Math/ })).toBeVisible();
}

const graph = (page: Page) => page.getByRole('img', { name: /Remixer Book::: Test \(IV\)\. Reuses content/ });

test('content sources at phone width hides the graph and does not scroll sideways', async ({ page }) => {
  await openContentSources(page, 375, 812);

  await expect(graph(page)).toBeHidden();
  // The same information stays available as text.
  await expect(page.getByText("Where this book's content comes from")).toBeVisible();
  await expect(page.getByText(/library:/).first()).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);

  await page.screenshot({ path: 'test-results/visual/content-sources-375.png', fullPage: true });
});

test('content sources on desktop shows a compact graph', async ({ page }) => {
  await openContentSources(page, 1280, 900);

  await expect(graph(page)).toBeVisible();
  const box = await graph(page).boundingBox();
  expect(box).not.toBeNull();
  // Compact: well under half the viewport tall.
  expect(box!.height).toBeLessThan(260);
  // Labels fit their boxes: nothing is cut while there is room.
  // Only the drawn <text>, not the <title> tooltips (which hold the full label).
  const text = (await graph(page).locator('text').allTextContents()).join(' | ');
  expect(text).toContain('Remixer Book::: Test (IV)');
  expect(text).toContain('workforce library (not scanned yet)');
  expect(text).not.toContain('…');
  // Drawn at its natural size, never stretched to fill a wide screen.
  expect(box!.width).toBeLessThan(900);

  await graph(page).scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'test-results/visual/content-sources-1280.png', fullPage: true });
});
