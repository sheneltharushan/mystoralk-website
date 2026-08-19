import { expect, test } from "@playwright/test";

test("navbar search opens and submits to the search results page", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });

  const searchButton = page.getByRole("button", { name: "Search fragrances" });
  await expect(searchButton).toBeVisible();
  await searchButton.click();

  const searchInput = page.getByRole("searchbox", { name: "Search fragrances" });
  await expect(searchInput).toBeFocused();
  await searchInput.fill("Sauvage");
  await searchInput.press("Enter");

  await expect(page).toHaveURL(/\/search\/?\?q=Sauvage/);
  await expect(page.getByRole("heading", { name: "Results for “Sauvage”" })).toBeVisible();
  await expect(page.getByText("1 fragrance", { exact: true })).toBeVisible();
});

test("search results can be filtered and preserve filter state in the URL", async ({ page }) => {
  await page.goto("/search/", { waitUntil: "domcontentloaded" });

  await expect(page.getByText("8 fragrances", { exact: true })).toBeVisible();
  await page.getByLabel("Special collection").check();

  await expect(page).toHaveURL(/category=special/);
  await expect(page.getByText("2 fragrances", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Remove Special collection filter" })).toBeVisible();
});
