import type { Page } from '@playwright/test';

/** Fixed pause helpers — call by name so wait intent stays obvious in specs. */
export async function wait0s(_page?: Page): Promise<void> {
  // no-op placeholder for a consistent API with the other waits
}

export async function wait5s(page: Page): Promise<void> {
  await page.waitForTimeout(5_000);
}

export async function wait10s(page: Page): Promise<void> {
  await page.waitForTimeout(10_000);
}

export async function wait30s(page: Page): Promise<void> {
  await page.waitForTimeout(30_000);
}

export async function wait45s(page: Page): Promise<void> {
  await page.waitForTimeout(45_000);
}

export type WaitFn = (page: Page) => Promise<void>;

export const WAITS = {
  none: wait0s,
  '5s': wait5s,
  '10s': wait10s,
  '30s': wait30s,
  '45s': wait45s,
} as const;
