import type { Page } from '@playwright/test';
import { visitHome } from './home';

/**
 * Public entry for the home flow. Outside callers import from here only.
 */
export async function home(page: Page): Promise<void> {
  await visitHome(page);
}
