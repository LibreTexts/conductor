import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { captureVisualSnapshot, usesRealBackend } from '../base';
import { clickOn, goToPage, typeIn, wait0s, wait5s } from '../utils';

/**
 * Isolated fallback-auth login: always starts at `/fallback-auth`.
 */
export async function loginWithFallbackAuth(page: Page): Promise<void> {
  const realBackend = usesRealBackend();
  const email = realBackend ? process.env.VISUAL_AUTH_EMAIL : 'visual-tests@example.com';
  const password = realBackend ? process.env.VISUAL_AUTH_PASSWORD : 'visual-tests-password';
  if (!email || !password) {
    throw new Error(
      'Real-backend login requires VISUAL_AUTH_EMAIL and VISUAL_AUTH_PASSWORD in your environment or client/.env.',
    );
  }

  await goToPage(page, '/fallback-auth');
  await expect(page.getByLabel('Email')).toBeVisible();
  await expect(page.getByLabel('Password')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Login' })).toBeVisible();

  await captureVisualSnapshot(page, 'Conductor fallback auth');

  await typeIn(page, '#email', email);
  await typeIn(page, '#password', password);
  await clickOn(page, 'button[type="submit"]', wait0s, wait5s);
  await expect(page).toHaveURL(/\/home/);
}
