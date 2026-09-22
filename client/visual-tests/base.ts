import fs from 'node:fs';
import path from 'node:path';
import type { Page } from '@playwright/test';
import percySnapshot from '@percy/playwright';

/** Desktop + mobile widths used for Percy / local snapshots. */
export const PERCY_WIDTHS = [375, 1280] as const;

const LOCAL_SCREENSHOT_DIR = path.join('test-results', 'visual');

/**
 * Stabilize the app shell for visual snapshots: mock org branding and block
 * the external support widget so shots do not depend on API/CDN state.
 */
export async function stabilizeAppShell(page: Page): Promise<void> {
  await page.route('**/api/v1/org', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        err: false,
        org: {
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
        },
      }),
    });
  });
  await page.route('https://cdn.libretexts.net/**', (route) => route.abort());
}

function shouldCaptureLocal(): boolean {
  return process.env.SKIP_LOCAL_VISUAL_SCREENSHOTS !== '1';
}

function shouldCapturePercy(): boolean {
  // Set by `test:visual` / CI. Local `:headed` / `:local` set SKIP_PERCY_SNAPSHOTS=1.
  return process.env.SKIP_PERCY_SNAPSHOTS !== '1';
}

/**
 * One snapshot call for all flows.
 * - Percy path (`npm run test:visual` / CI): uploads via Percy, skips local PNGs.
 * - Local path (`test:visual:local` / `:headed`): writes PNGs, skips Percy.
 */
export async function captureVisualSnapshot(
  page: Page,
  name: string,
): Promise<void> {
  if (shouldCapturePercy()) {
    await percySnapshot(page, name, {
      widths: [...PERCY_WIDTHS],
    });
  }

  if (shouldCaptureLocal()) {
    await captureLocalSnapshots(page, name);
  }
}

/**
 * Save PNGs under gitignored `test-results/visual/` so you can preview shots
 * locally without Percy or a PR. No-ops when SKIP_LOCAL_VISUAL_SCREENSHOTS=1.
 */
export async function captureLocalSnapshots(
  page: Page,
  name: string,
): Promise<void> {
  if (!shouldCaptureLocal()) {
    return;
  }

  fs.mkdirSync(LOCAL_SCREENSHOT_DIR, { recursive: true });
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  for (const width of PERCY_WIDTHS) {
    await page.setViewportSize({ width, height: 900 });
    await page.screenshot({
      path: path.join(LOCAL_SCREENSHOT_DIR, `${slug}-${width}.png`),
      fullPage: true,
    });
  }
}
