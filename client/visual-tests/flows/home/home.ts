import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { captureVisualSnapshot } from '../../base';
import { goToPage, wait5s } from '../../utils';

/**
 * Conductor home (`/home`). Safe to call after login, or alone if already authed.
 */
export async function visitHome(page: Page): Promise<void> {
  await goToPage(page, '/home', wait5s);

  await expect(page).toHaveURL(/\/home/);

  await captureVisualSnapshot(page, 'Conductor home');
}
