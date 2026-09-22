# Visual regression testing

Playwright + Percy. Shared helpers live in `client/visual-tests/base.ts` and
`client/visual-tests/utils/`. Reusable flows live in `client/visual-tests/flows/`.

## What CI runs (default)

`npm run test:visual` runs **one** journey (`--project=journey`):

1. Login at `/fallback-auth` (screenshot)
2. Go to Commons `/`, screenshot catalog, open first book, screenshot again

That is a single browser / single test with multiple Percy snapshots in one build —
not separate login/books tests.

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
3. In GitHub, open **Settings > Secrets and variables > Actions** and create a
   repository secret named `PERCY_TOKEN`.
4. Install the Percy GitHub app for this repository and link it to the Percy
   project.
5. Run the Visual Regression workflow on `staging` once to establish its baseline.
   Pushes to both `staging` and `master` refresh their respective baselines after
   a pull request has been reviewed and merged.

The token must never be committed. Pull requests from forks do not receive the
secret; their workflow still verifies that the browser scenario loads, but it
does not upload snapshots to Percy.

## Run locally

```sh
cd client
npx playwright install chromium

# Default journey (1 browser, full flow) — no Percy upload
npm run test:visual:local
npm run test:visual:headed

# Optional isolated pieces only
npm run test:visual:isolated:headed

# Percy upload (same journey CI uses)
PERCY_TOKEN=... npm run test:visual
```

Flows call one helper (`captureVisualSnapshot`): Percy on `npm run test:visual` /
CI, local PNGs on `:local` / `:headed`. Never both.

Local PNGs land in gitignored `client/test-results/visual/`.
Credentials for login: `VISUAL_AUTH_EMAIL` / `VISUAL_AUTH_PASSWORD` in `client/.env`.
`PERCY_TOKEN` is a GitHub Actions secret (or set in the shell for local Percy runs) —
it is not stored in `client/.env`.
