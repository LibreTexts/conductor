import type { Page } from '@playwright/test';
import { wait0s, type WaitFn } from './waits';

/**
 * Optional wait first, then navigate to a path (relative to Playwright baseURL)
 * or absolute URL, then wait for the document to load.
 *
 * @example
 *   await goToPage(page, '/fallback-auth');
 *   await goToPage(page, '/fallback-auth', wait5s);
 */
export async function goToPage(
  page: Page,
  pathOrUrl: string,
  beforeActionWait: WaitFn = wait0s,
): Promise<void> {
  await beforeActionWait(page);
  await page.goto(pathOrUrl, { waitUntil: 'load' });
}
