import { expect, test } from "@playwright/test";

test("profile preview explains upcoming accounts and restores keyboard focus", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });

  const profile = page.getByRole("button", { name: "Profile" });
  await profile.click();
  const dialog = page.getByRole("dialog", { name: "Your Mystora profile" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("Save your favourites")).toBeVisible();
  await expect(dialog.getByText("See your order history")).toBeVisible();
  await expect(profile).toHaveAttribute("aria-expanded", "true");

  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(profile).toBeFocused();
});

test("cart preview offers useful WhatsApp and shopping actions", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto("/shop/", { waitUntil: "domcontentloaded" });

  const cart = page.getByRole("button", { name: "Cart" });
  await cart.click();
  const dialog = page.getByRole("dialog", { name: "Checkout is coming soon" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(/every order is handled personally through WhatsApp/i)).toBeVisible();
  await expect(dialog.getByRole("link", { name: /Order on WhatsApp/i })).toHaveAttribute("href", /wa\.me\/94768253595/);
  await expect(dialog.getByRole("link", { name: /Browse fragrances/i })).toHaveAttribute("href", "/shop/");

  await page.waitForTimeout(500);
  const panelBottom = await dialog.evaluate((element) => element.getBoundingClientRect().bottom);
  expect(Math.abs(panelBottom - 667)).toBeLessThanOrEqual(1);
});
