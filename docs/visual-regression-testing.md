# Visual regression testing

The initial proof of concept starts the Vite client, opens the login page in
Playwright, and sends desktop and mobile snapshots to Percy. Percy compares a
pull request's snapshots with the baseline for that pull request's target branch.
In the normal release flow, feature pull requests compare against `staging`, and
the later `staging` to `master` pull request compares against `master`.

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

Install Chromium once:

```sh
cd client
npx playwright install chromium
```

Run the browser scenario without uploading to Percy:

```sh
npm run test:visual:local
```

To create a Percy build, expose `PERCY_TOKEN` in your shell and run:

```sh
npm run test:visual
```

The first scenario mocks the organization endpoint and blocks the external
support widget. This makes the login snapshot stable and avoids requiring the
server, database, or a test account. Add authenticated scenarios only after a
repeatable test-data and authentication strategy is available.
