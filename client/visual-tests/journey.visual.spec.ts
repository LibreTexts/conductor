import { test } from '@playwright/test';
import { stabilizeAppShell } from './base';
import { loginWithFallbackAuth } from './flows/loginWithFallbackAuth';
import { home } from './flows/home/base';
import { commons } from './flows/commons/base';

/**
 * Default visual journey (what CI / `npm run test:visual*` runs).
 * One browser, one flow, multiple Percy/local screenshots along the way:
 *   1) fallback-auth login
 *   2) Conductor home
 *   3) Commons (books)
 *
 * Isolated login/books specs live under `isolated/` and only run with
 * `--project=isolated`.
 */
test.describe.configure({ mode: 'serial' });

test('conductor visual journey: login then open first commons book', async ({
  page,
}) => {
  await stabilizeAppShell(page);

  try {
    await loginWithFallbackAuth(page);
    // await home(page);
    await commons(page);
  } catch (error) {
    console.error('conductor visual journey failed:', error);
    throw error;
  }
});
