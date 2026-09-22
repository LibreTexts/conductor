import type { Page } from '@playwright/test';
import { openFirstCommonsBook } from './openFirstCommonsBook';

/**
 * Public entry for Commons books flows. Outside callers import from here only.
 */
export async function books(page: Page): Promise<void> {
  await openFirstCommonsBook(page);
}
