# Visual regression testing

Playwright + Percy. Shared helpers live in `client/visual-tests/base.ts` and
`client/visual-tests/utils/`. Reusable flows live in `client/visual-tests/flows/`.

## What CI runs (default)

`npm run test:visual` runs **one** journey (`--project=journey`):

1. Login at `/fallback-auth` (screenshot)
2. Go to Commons `/`, then for the 1st, 3rd, and 5th books: screenshot catalog,
   open the book, screenshot again

That is a single browser / single test with multiple Percy snapshots in one build —
not separate login/books tests.

## Mocked API (no backend needed)

The visual tests check how pages **look**, not whether the backend works. CI has
no server or database, so `client/visual-tests/mocks/api.ts` answers every
`/api/v1/*` request with fixed data from `client/visual-tests/mocks/fixtures/`.
Local runs use the same mocks by default; the explicit `:real` commands below
use your running backend instead.

`VITE_DEV_BASE_URL=http://localhost:5000` gives the frontend an address for
constructing API URLs. Playwright intercepts those requests before they reach a
server; nothing needs to listen on port 5000. The GitHub workflow already sets
this value directly, so **do not add it as a GitHub secret**. Only `PERCY_TOKEN`
is needed as a secret for Percy uploads.

- Login is faked: the mocked `POST /auth/fallback-auth` sets the auth cookies the
  client checks for. Any email/password works; no credentials are needed.
- The catalog always returns the same books in the same order, with a flat
  placeholder instead of remote cover images, so Percy only diffs on UI changes.
- An endpoint without a mock returns 404 and logs
  `[visual mocks] unmocked API call: ...`. When you snapshot a new page, add a
  route for each call it logs.

## Isolated specs (opt-in only)

Login-only and books-only specs live under `visual-tests/isolated/` and run only when
you ask for them:

```sh
npm run test:visual:isolated
npm run test:visual:isolated:headed
```

## One-time Percy setup

1. Open the existing Percy Web project (or create one).
2. Copy its write-only project token from the Percy project settings.
3. In GitHub, open **Settings → Secrets and variables → Actions** and create
   repository secrets:
   - `PERCY_TOKEN` — Percy write token
4. Install the Percy GitHub app for this repository and link it to the Percy
   project.
5. Run the Visual Regression workflow on `staging` once to establish its baseline.
   Pushes to both `staging` and `master` refresh their respective baselines after
   a pull request has been reviewed and merged.

The token must never be committed. Pull requests from forks do not
receive secrets; their workflow still verifies that the browser scenario loads,
but it does not upload snapshots to Percy.

## Run locally

Best way to preview what the journey captures (visible browser):

```sh
cd client
npx playwright install chromium
npm run test:visual:mock:headed
```

Screenshots are written to **`client/test-results/visual/`** (gitignored). Open that
folder after the run to review PNGs at 375 and 1280 widths. No Percy upload.

The `:mock` commands explicitly set the same API address as CI and run the same
mocked journey. Playwright starts the frontend at `http://localhost:3000` (or
reuses an existing frontend there). No backend, database, or login credentials
are needed. The older `:local` and `:headed` commands also use mocks; they do not
test your real local backend or database. Local PNG rendering can differ from
Percy's rendering, but the journey and API fixtures are shared.

Other local commands:

```sh
# Same journey, headless (still writes local PNGs)
npm run test:visual:mock

# Optional isolated pieces only
npm run test:visual:isolated:headed

# Percy upload (same journey CI uses; no local PNGs)
PERCY_TOKEN=... npm run test:visual
```

Flows call one helper (`captureVisualSnapshot`): Percy on `npm run test:visual` /
CI, local PNGs on `:local` / `:headed`. Never both.

No backend or login credentials are needed (see **Mocked API** above).
`PERCY_TOKEN` is a GitHub Actions secret (or set in the shell for local Percy runs) —
it is not stored in `client/.env`.

## Run locally against your real backend and database

Start your local backend and its database as usual. In `client/.env`, set:

```dotenv
VITE_DEV_BASE_URL=http://localhost:5000
VISUAL_AUTH_EMAIL=your-local-test-account@example.com
VISUAL_AUTH_PASSWORD=your-local-test-account-password
```

Use the backend's actual URL if it runs on a different port. These must be valid
fallback-auth credentials for an account in the database your backend uses.
Keep credentials in your uncommitted `.env`; do not prefix them with `VITE_`.

From `client`, run either:

```sh
# Real API and login, headless browser
npm run test:visual:real

# Real API and login, visible browser
npm run test:visual:real:headed
```

These commands set `VISUAL_USE_REAL_BACKEND=1`, skip API mocks and fake cookies,
and read `VISUAL_AUTH_EMAIL` / `VISUAL_AUTH_PASSWORD` from your environment or
`client/.env`. They start or reuse the frontend on port 3000, but do not start
the backend or database. A reused frontend must already use the correct API URL;
restart it if you changed its configuration.

The journey logs in and opens the 1st, 3rd, and 5th Commons books, so your database
must provide at least five visible catalog books. Screenshots are saved to
`client/test-results/visual/` with no Percy upload. Live data can change between
runs. The external support widget remains blocked in both modes.

Use `:mock` / `:mock:headed` to return to the fixed data used by CI. Avoid setting
`VISUAL_USE_REAL_BACKEND` in `.env`; the commands select the mode for you.
