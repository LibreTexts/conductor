import { expect, test } from '@playwright/test';
import percySnapshot from '@percy/playwright';

test('login page', async ({ page }) => {
  // Keep this first visual test independent of the API, database, and third-party widget.
  await page.route('**/api/v1/org', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        err: false,
        org: {
          orgID: 'libretexts',
          name: 'LibreTexts',
          shortName: 'LibreTexts',
          abbreviation: 'LT',
          largeLogo: '',
          mediumLogo: '',
          smallLogo: '',
          aboutLink: '',
          commonsHeader: '',
          commonsMessage: '',
          videoLengthLimit: 0,
          defaultProjectLead: '',
          addToLibreGridList: false,
        },
      }),
    });
  });
  await page.route('https://cdn.libretexts.net/**', (route) => route.abort());

  // This state does not auto-redirect to LibreOne, so the screenshot is deterministic.
  await page.goto('/login?src=accountrequest');
  await expect(page.getByText('Login Required', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible();

  await percySnapshot(page, 'Conductor login', {
    widths: [375, 1280],
  });
});
