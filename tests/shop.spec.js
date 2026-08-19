import { expect, test } from "@playwright/test";

test("shop opens deep-linked collections with the complete filter workspace", async ({ page }) => {
  await page.goto("/shop/?category=special", { waitUntil: "domcontentloaded" });

  await expect(page.getByRole("heading", { name: "Find your signature." })).toBeVisible();
  await expect(page.getByLabel("Special collection")).toBeChecked();
  await expect(page.getByRole("heading", { name: "Special collection", exact: true })).toBeVisible();
  await expect(page.getByText("2 fragrances", { exact: true })).toBeVisible();
  await expect(page.locator("#search-page-grid article")).toHaveCount(2);
  await expect(page.getByRole("button", { name: "Remove Special collection filter" })).toBeVisible();
});

test("shop size links show the matching bottle price and keep filters in the URL", async ({ page }) => {
  await page.goto("/shop/?size=10ml", { waitUntil: "domcontentloaded" });

  await expect(page.getByLabel("10 ml discovery")).toBeChecked();
  await expect(page.getByRole("heading", { name: "10 ml decants" })).toBeVisible();
  await expect(page.locator("#search-page-grid").getByText(/LKR [\d,]+ · 10ML/).first()).toBeVisible();

  await page.getByLabel("Featured selection").check();
  await expect(page).toHaveURL(/size=10ml/);
  await expect(page).toHaveURL(/featured=1/);
  await expect(page.getByRole("button", { name: "Remove Featured filter" })).toBeVisible();
});

test("homepage collection stories land in the filtered shop", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("link", { name: "Shop the Special Collection" }).click();

  await expect(page).toHaveURL(/\/shop\/?\?category=special/);
  await expect(page.getByLabel("Special collection")).toBeChecked();
  await expect(page.getByText("2 fragrances", { exact: true })).toBeVisible();
});

test("shop uses the full Mystora footer with a working newsletter preview", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto("/shop/", { waitUntil: "domcontentloaded" });

  await expect(page.locator(".site-footer__wordmark")).toHaveText("MYSTORA.LK");
  const footerMetrics = await page.locator(".site-footer").evaluate((footer) => ({
    height: footer.getBoundingClientRect().height,
    clientHeight: footer.clientHeight,
    scrollHeight: footer.scrollHeight,
  }));
  expect(Math.round(footerMetrics.height)).toBe(599);
  expect(footerMetrics.scrollHeight).toBeLessThanOrEqual(footerMetrics.clientHeight + 1);

  await page.locator("#footer-email").fill("hello@example.com");
  await page.getByRole("button", { name: /Join the list/i }).click();
  await expect(page.locator("#footer-signup-status")).toContainText("coming soon");
});
