import { expect, test } from "@playwright/test";

test("product page loads the selected size, gallery, stock, and WhatsApp order", async ({ page }) => {
  await page.goto("/product/?slug=mystora-sauvage&size=10ml", {
    waitUntil: "domcontentloaded",
  });

  await expect(page.getByRole("heading", { name: "Mystora Dior Sauvage" })).toBeVisible();
  await expect(page.getByRole("button", { name: /10 ml.*Discover/i })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#product-price")).toHaveText("LKR 3,300");
  await expect(page.locator("#selected-size-label")).toHaveText("10 ml · Discover");
  await expect(page.locator("#product-stock")).toHaveCount(0);
  await expect(page.locator("#thumbnail-list button")).toHaveCount(4);

  const orderLink = page.getByRole("link", { name: /Order via WhatsApp/i });
  await expect(orderLink).toHaveAttribute("href", /wa\.me\/.*10ml/);
  await expect(orderLink).not.toHaveAttribute("href", /127\.0\.0\.1|%2Fproduct%2F/i);

  await page.getByRole("button", { name: /100 ml.*Full size/i }).click();
  await expect(page).toHaveURL(/size=100ml/);
  await expect(page.locator("#product-price")).toHaveText("LKR 15,900");
  await expect(page.locator("#main-product-image")).toHaveAttribute("alt", /100 ml/);
});

test("shop bottle-size selection continues into the mobile product page", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto("/shop/?size=10ml", { waitUntil: "domcontentloaded" });

  await page.getByRole("link", { name: "Mystora For Her", exact: true }).click();
  await expect(page).toHaveURL(/\/product\/?\?slug=mystora-for-her&size=10ml/);
  await expect(page.getByRole("button", { name: /10 ml.*Discover/i })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#product-price")).toHaveText("LKR 1,980");
  await expect(page.locator(".site-footer__wordmark")).toHaveText("MYSTORA.LK");

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);
});

test("mobile product gallery responds to horizontal swipes", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto("/product/?slug=mystora-sauvage&size=10ml", {
    waitUntil: "domcontentloaded",
  });

  await expect(page.locator("#thumbnail-list button")).toHaveCount(4);
  await expect(page.locator("#gallery-current")).toHaveText("01");
  await page.locator(".product-gallery__stage").evaluate((stage) => {
    const start = new Touch({ identifier: 1, target: stage, clientX: 310, clientY: 250 });
    const end = new Touch({ identifier: 1, target: stage, clientX: 90, clientY: 255 });
    stage.dispatchEvent(new TouchEvent("touchstart", { bubbles: true, touches: [start] }));
    stage.dispatchEvent(new TouchEvent("touchend", { bubbles: true, changedTouches: [end] }));
  });

  await expect(page.locator("#gallery-current")).toHaveText("02");
  await expect(page.getByRole("button", { name: /50 ml.*Signature/i })).toHaveAttribute("aria-pressed", "true");
  await expect(page).toHaveURL(/size=50ml/);
});
