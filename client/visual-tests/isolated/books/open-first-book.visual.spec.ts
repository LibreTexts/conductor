import { test } from '@playwright/test';
import { stabilizeAppShell } from '../../base';
import { books } from '../../flows/commons/books/base';

/**
 * Independent books scenario: opens the 1st, 3rd, and 5th catalog books.
 * Run with: npm run test:visual:isolated:headed
 */
test('open commons books from catalog', async ({ page }) => {
  await stabilizeAppShell(page);

  try {
    await books(page);
  } catch (error) {
    console.error('open commons books visual test failed:', error);
    throw error;
  }
});
