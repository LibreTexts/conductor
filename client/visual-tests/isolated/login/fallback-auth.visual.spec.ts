import { test } from '@playwright/test';
import { stabilizeAppShell } from '../../base';
import { loginWithFallbackAuth } from '../../flows/loginWithFallbackAuth';

/**
 * Independent login scenario: always starts at `/fallback-auth`.
 * Run with: npm run test:visual:isolated:headed
 */
test('fallback auth page', async ({ page }) => {
  await stabilizeAppShell(page);

  try {
    await loginWithFallbackAuth(page);
  } catch (error) {
    console.error('fallback auth visual test failed:', error);
    throw error;
  }
});
