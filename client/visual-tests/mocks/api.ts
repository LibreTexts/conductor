import type { Page, Route } from '@playwright/test';
import books from './fixtures/books.json';
import catalog from './fixtures/catalog.json';
import filters from './fixtures/filters.json';
import libregrid from './fixtures/libregrid.json';

/**
 * Fake Conductor API for visual tests. CI has no backend or database, so every
 * `/api/v1/*` request is answered here with fixed data. That keeps screenshots
 * identical between runs (no live catalog order, covers, or user data).
 *
 * Fixtures were trimmed from a real local session; book thumbnails are replaced
 * with a flat placeholder so Percy never diffs on remote images.
 */

// Must match COOKIE_NAMES in src/components/util/AuthHelper.ts (APP_ENV "production" prefix).
const AUTH_COOKIES = ['conductor_access_v2', 'conductor_signed_v2'];

const ORG = {
  orgID: 'libretexts',
  name: 'LibreTexts',
  shortName: 'LibreTexts',
  abbreviation: 'LT',
  largeLogo: '',
  mediumLogo: '',
  smallLogo: '',
  aboutLink: '',
  commonsHeader: '',
  commonsMessage: '',
  videoLengthLimit: 0,
  defaultProjectLead: '',
  addToLibreGridList: false,
};

const USER = {
  uuid: '00000000-0000-4000-8000-000000000000',
  firstName: 'Visual',
  lastName: 'Tester',
  email: 'visual-tests@example.com',
  avatar: '',
  authType: 'traditional',
  roles: [{ org: 'libretexts', role: 'superadmin' }],
  verifiedInstructor: false,
};

type Json = Record<string, unknown>;
type Handler = (match: RegExpMatchArray, route: Route, page: Page) => Json | Promise<Json>;

const bookMap = books as Record<string, Json>;

function bookDetail(bookID: string): Json | undefined {
  if (bookMap[bookID]) return bookMap[bookID];
  const summary = catalog.books.find((b) => b.bookID === bookID);
  return summary && { ...summary, readerResources: [], isbns: [] };
}

/** Routes are matched against the path after `/api/v1`, first match wins. */
const ROUTES: Array<[method: string, path: RegExp, handler: Handler]> = [
  ['GET', /^\/org$/, () => ({ err: false, org: ORG })],
  // Constant build ID so the "new version available" toast never appears.
  ['GET', /^\/build$/, () => ({ version: 'visual-test', ref: 'visual-test' })],
  [
    'GET',
    /^\/config$/,
    () => ({
      err: false,
      data: {
        env: 'development',
        main_commons_url: '',
        instructor_verification_url: '',
        central_identity_base_url: '',
      },
    }),
  ],
  [
    'POST',
    /^\/auth\/fallback-auth$/,
    async (_m, _route, page) => {
      // The real server sets these cookies; the client only checks they exist.
      await page.context().addCookies(
        AUTH_COOKIES.map((name) => ({
          name,
          value: 'visual-test',
          url: new URL(page.url()).origin,
        })),
      );
      return { err: false };
    },
  ],
  ['GET', /^\/user\/basicinfo$/, () => ({ err: false, user: USER })],
  ['GET', /^\/announcements\/system$/, () => ({ err: false, sysAnnouncement: null })],
  ['GET', /^\/announcements\/all$/, () => ({ err: false, announcements: [] })],
  ['GET', /^\/projects\/recent$/, () => ({ err: false, projects: [] })],
  ['GET', /^\/projects\/pinned$/, () => ({ err: false, pinned: [] })],

  // Commons catalog
  ['GET', /^\/commons\/catalog$/, () => catalog],
  ['GET', /^\/commons\/filters$/, () => filters],
  ['GET', /^\/orgs\/libregrid$/, () => libregrid],
  ['GET', /^\/central-identity\/licenses$/, () => ({ err: false, licenses: [] })],
  ['GET', /^\/projects\/public$/, () => ({ err: false, projects: [], totalCount: 0 })],
  ['GET', /^\/projects\/files\/public$/, () => ({ err: false, files: [], totalCount: 0 })],
  ['GET', /^\/search\/authors$/, () => ({ err: false, numResults: 0, results: [] })],
  ['GET', /^\/search\/minirepos$/, () => ({ err: false, numResults: 0, results: [] })],

  // Commons book page
  [
    'GET',
    /^\/commons\/book\/([^/]+)$/,
    ([, bookID]) => {
      const book = bookDetail(bookID);
      return book ? { err: false, book } : { err: true, errMsg: 'Book not found.' };
    },
  ],
  [
    'GET',
    /^\/commons\/book\/([^/]+)\/toc$/,
    ([, bookID]) => {
      const book = bookDetail(bookID);
      const url = (book?.links as Json | undefined)?.online ?? '';
      return {
        err: false,
        toc: {
          id: bookID,
          title: book?.title ?? '',
          url,
          children: ['Front Matter', 'Chapter 1', 'Chapter 2', 'Back Matter'].map((title, i) => ({
            id: `${bookID}-${i}`,
            title,
            url,
            children: [],
          })),
        },
      };
    },
  ],
  [
    'GET',
    /^\/commons\/book\/([^/]+)\/licensereport$/,
    () => ({ err: false, found: false, msg: "Couldn't find a Content Licensing Report for that resource." }),
  ],
  [
    'GET',
    /^\/project\/[^/]+\/files\/content\/?$/,
    () => ({ err: false, files: [], path: [{ fileID: '', name: '' }] }),
  ],
];

/**
 * Answer every Conductor API call from fixtures. Unmocked endpoints return a
 * 404 and are logged, so a new API call on a snapshotted page is easy to spot.
 */
export async function mockConductorApi(page: Page): Promise<void> {
  await page.route(/\/api\/v1\//, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^.*?\/api\/v1/, '');

    for (const [method, pattern, handler] of ROUTES) {
      const match = request.method() === method && path.match(pattern);
      if (match) {
        return route.fulfill({ json: await handler(match, route, page) });
      }
    }

    console.warn(`[visual mocks] unmocked API call: ${request.method()} ${path}`);
    return route.fulfill({
      status: 404,
      json: { err: true, errMsg: `No visual-test mock for ${request.method()} ${path}` },
    });
  });
}
