import type { Page } from '@playwright/test';
import { books } from './books/base';

/**
 * Public entry for Commons flows. Outside callers import from here only.
 */
export async function commons(page: Page): Promise<void> {
  await books(page);
}
