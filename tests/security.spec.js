import { expect, test } from "@playwright/test";

test("production pages enforce CSP and execute only local scripts", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });

  const policy = await page
    .locator('meta[http-equiv="Content-Security-Policy"]')
    .getAttribute("content");
  expect(policy).toContain("default-src 'self'");
  expect(policy).toContain("script-src 'self'");
  expect(policy).toContain("object-src 'none'");
  expect(policy).toContain("upgrade-insecure-requests");

  const scriptSources = await page.locator("script[src]").evaluateAll((scripts) =>
    scripts.map((script) => script.getAttribute("src")),
  );
  expect(scriptSources.every((source) => source?.startsWith("/"))).toBe(true);
});

test("read-only catalog does not persist an authentication session", async ({ page }) => {
  await page.goto("/shop/", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("8 fragrances", { exact: true })).toBeVisible();

  const authStorageKeys = await page.evaluate(() =>
    Object.keys(window.localStorage).filter((key) => key.includes("auth-token")),
  );
  expect(authStorageKeys).toEqual([]);
});

test("hostile search text remains inert", async ({ page }) => {
  const payload = '"><img src=x onerror="window.__mystoraXss=true">';
  await page.goto(`/search/?q=${encodeURIComponent(payload)}`, {
    waitUntil: "domcontentloaded",
  });

  await expect(page.locator("#results-heading")).toContainText(payload);
  await expect(page.locator('#results-heading img[src="x"]')).toHaveCount(0);
  expect(await page.evaluate(() => window.__mystoraXss)).toBeUndefined();
});
