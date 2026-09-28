import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { captureVisualSnapshot } from '../../../base';
import { clickOn, goToPage, wait0s, wait5s } from '../../../utils';

/** 1-based catalog positions to open (same steps for each). */
const BOOK_POSITIONS = [1, 3, 5] as const;

/**
 * Commons books flow: for each of the 1st, 3rd, and 5th catalog cards,
 * screenshot the catalog, open the book, then screenshot the book page.
 */
export async function openCommonsBooks(page: Page): Promise<void> {
  for (const position of BOOK_POSITIONS) {
    const index = position - 1;

    await goToPage(page, '/', wait5s);

    const bookLink = page.locator('a[href^="/book/"]').nth(index);
    await expect(bookLink).toBeVisible({ timeout: 30_000 });

    await captureVisualSnapshot(
      page,
      `Commons catalog before book ${position}`,
    );

    await clickOn(page, 'a[href^="/book/"]', wait0s, wait5s, index);

    await captureVisualSnapshot(
      page,
      `Commons after opening book ${position}`,
    );
  }
}
