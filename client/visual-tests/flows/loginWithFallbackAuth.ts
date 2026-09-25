import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { captureVisualSnapshot } from '../base';
import { clickOn, goToPage, typeIn, wait0s, wait5s } from '../utils';

const FALLBACK_AUTH_EMAIL = process.env.VISUAL_AUTH_EMAIL ?? '';
const FALLBACK_AUTH_PASSWORD = process.env.VISUAL_AUTH_PASSWORD ?? '';

/**
 * Isolated fallback-auth login: always starts at `/fallback-auth`.
 */
export async function loginWithFallbackAuth(page: Page): Promise<void> {
  if (!FALLBACK_AUTH_PASSWORD) {
    throw new Error(
      'Set VISUAL_AUTH_PASSWORD in your environment (or client/.env) to run login steps.',
    );
  }

  await goToPage(page, '/fallback-auth');
  await expect(page.getByLabel('Email')).toBeVisible();
  await expect(page.getByLabel('Password')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Login' })).toBeVisible();

  await captureVisualSnapshot(page, 'Conductor fallback auth');

  await typeIn(page, '#email', FALLBACK_AUTH_EMAIL);
  await typeIn(page, '#password', FALLBACK_AUTH_PASSWORD);
  await clickOn(page, 'button[type="submit"]', wait0s, wait5s);
}
