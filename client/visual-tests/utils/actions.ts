import type { Page } from '@playwright/test';
import { wait0s, type WaitFn } from './waits';

/**
 * Optional wait before click, click a match by 0-based index (default first),
 * then optional wait after. Avoids strict-mode failures on multi-match selectors.
 *
 * @example
 *   await clickOn(page, 'button:has-text("Login")');
 *   await clickOn(page, 'a[href^="/book/"]', wait0s, wait5s);
 *   await clickOn(page, 'a[href^="/book/"]', wait0s, wait5s, 2); // 3rd book
 */
export async function clickOn(
  page: Page,
  selector: string,
  beforeActionWait: WaitFn = wait0s,
  afterActionWait: WaitFn = wait0s,
  index = 0,
): Promise<void> {
  await beforeActionWait(page);
  await page.locator(selector).nth(index).click();
  await afterActionWait(page);
}

/**
 * Optional wait first, then type into an input matched by selector.
 * Clears existing value first.
 *
 * @example
 *   await typeIn(page, '#email', 'admin@example.com');
 *   await typeIn(page, 'input[name="password"]', 'secret', wait5s);
 */
export async function typeIn(
  page: Page,
  selector: string,
  text: string,
  beforeActionWait: WaitFn = wait0s,
): Promise<void> {
  await beforeActionWait(page);
  const field = page.locator(selector).first();
  await field.click();
  await field.fill(text);
}
