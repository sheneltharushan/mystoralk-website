import { expect, test } from "@playwright/test";

test("admin area is private by default and exposes no registration flow", async ({ page }) => {
  await page.goto("/admin/");

  await expect(page).toHaveTitle(/Mystora Atelier/);
  await expect(page.getByRole("heading", { name: "Welcome back." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Enter the atelier" })).toBeVisible();
  await expect(page.getByText("Private atelier").first()).toBeVisible();
  await expect(page.locator("#admin-app")).toBeHidden();
  await expect(page.getByRole("button", { name: /sign up|register|create account/i })).toHaveCount(0);
});

test("admin login validates credentials before making an authentication request", async ({ page }) => {
  await page.goto("/admin/");
  await page.getByRole("button", { name: "Enter the atelier" }).click();

  await expect(page.locator("#login-email")).toBeFocused();
  await expect(page.locator("#admin-app")).toBeHidden();
});

test("admin page ships restrictive indexing and content policies", async ({ page }) => {
  await page.goto("/admin/");

  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  const policy = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute("content");
  expect(policy).toContain("frame-ancestors 'none'");
  expect(policy).toContain("script-src 'self'");
  expect(policy).not.toContain("'unsafe-eval'");
});
