import { expect, test } from '@playwright/test';

test('smoke dashboard page', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page.getByText('FLUXCY DEV V1')).toBeVisible();
});
