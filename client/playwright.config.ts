import fs from 'node:fs';
import path from 'node:path';
import { defineConfig } from '@playwright/test';

/** Load client/.env into process.env for local visual-test credentials (does not override existing env). */
function loadClientEnvFile(): void {
  // Scripts are run from /client, so cwd is the project root for Playwright.
  const envPath = path.join(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return;

  for (const rawLine of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadClientEnvFile();

const headed = process.argv.includes('--headed');

export default defineConfig({
  testDir: './visual-tests',
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    ...(headed
      ? { launchOptions: { slowMo: 300 } }
      : {}),
  },
  webServer: {
    command: 'npm run start -- --host localhost --port 3000',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    {
      // Default for CI + local headed/local: one end-to-end journey.
      name: 'journey',
      testMatch: /journey\.visual\.spec\.ts/,
    },
    {
      // Opt-in pieces (login-only, books-only). Not run unless selected.
      name: 'isolated',
      testMatch: /isolated\/.*\.visual\.spec\.ts/,
    },
  ],
});
