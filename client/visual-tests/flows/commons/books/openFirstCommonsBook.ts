import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { captureVisualSnapshot } from '../../../base';
import { clickOn, goToPage, wait0s, wait5s } from '../../../utils';

/**
 * Isolated Commons books flow: always starts at `/` (no dependency on prior pages).
 * Screenshots the catalog, opens the first book card, then screenshots again.
 */
export async function openFirstCommonsBook(page: Page): Promise<void> {
  await goToPage(page, '/', wait5s);

  const firstBookLink = page.locator('a[href^="/book/"]').first();
  await expect(firstBookLink).toBeVisible({ timeout: 30_000 });

  await captureVisualSnapshot(page, 'Commons catalog before first book');

  await clickOn(page, 'a[href^="/book/"]', wait0s, wait5s);

  await captureVisualSnapshot(page, 'Commons after opening first book');
}
