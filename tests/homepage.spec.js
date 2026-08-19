import { expect, test } from "@playwright/test";

test("homepage loads the Mystora storefront", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });

  await expect(page).toHaveTitle(/Mystora/i);
  await expect(page.getByRole("heading", { name: "New arrivals" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "The Special Collection" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Decants", exact: true })).toBeVisible();
  await expect(page.locator(".site-footer__wordmark")).toHaveText("MYSTORA.LK");
  await expect(page.locator(".home-service-strip")).toHaveCount(0);
  await expect(page.getByText("Campaign film", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Sound off", { exact: true })).toHaveCount(0);

  const overlayStyle = await page
    .locator(".special-collection .special-story-card__copy")
    .first()
    .evaluate((copy) => {
      const style = getComputedStyle(copy);
      return { background: style.backgroundColor, border: style.borderWidth, padding: style.padding };
    });
  expect(overlayStyle).toEqual({ background: "rgba(0, 0, 0, 0)", border: "0px", padding: "0px" });
});

test("new arrivals rail loads products and responds to its controls", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });

  const rail = page.locator("#featured-rail");
  await expect(rail.locator(".home-product-card").first()).toBeVisible();
  const before = await rail.evaluate((element) => element.scrollLeft);
  await page.getByRole("button", { name: "Next products" }).click();
  await expect.poll(() => rail.evaluate((element) => element.scrollLeft)).toBeGreaterThan(before);
});

test("special collection and footer interactions are usable on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto("/", { waitUntil: "domcontentloaded" });

  await expect(page.getByLabel("Shop the Special Collection")).toBeVisible();
  await expect(page.locator(".special-collection .special-story-grid")).toHaveCSS("grid-template-columns", "343px");

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

test("decants uses a two-tile video and shopping story", async ({ page }) => {
  await page.goto("/#decants", { waitUntil: "domcontentloaded" });

  await expect(page.locator(".decants-story-grid > *")).toHaveCount(2);
  await expect(page.locator(".decants-story-card--video video source")).toHaveAttribute(
    "src",
    "/assets/videos/decants_video.mp4",
  );
  await expect(page.getByRole("link", { name: "Browse 10 millilitre decants" })).toHaveAttribute(
    "href",
    "/shop/?size=10ml",
  );
  await expect(page.getByRole("link", { name: "Facebook", exact: true }).last()).toHaveAttribute(
    "href",
    "https://www.facebook.com/profile.php?id=61581027238674",
  );
});
