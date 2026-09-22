import { test } from '@playwright/test';
import { stabilizeAppShell } from '../../base';
import { books } from '../../flows/commons/books/base';

/**
 * Independent books scenario: navigates directly to `/` and opens the first book.
 * Run with: npm run test:visual:isolated:headed
 */
test('open first commons book from catalog', async ({ page }) => {
  await stabilizeAppShell(page);

  try {
    await books(page);
  } catch (error) {
    console.error('open first commons book visual test failed:', error);
    throw error;
  }
});
