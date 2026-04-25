import { test, expect } from "../fixtures";

test.describe("Integrations → Alert Keywords card", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard/integrations");
  });

  test("add → add → remove → reload persistence", async ({ page }) => {
    const card = page.locator("section", { has: page.getByRole("heading", { name: "Alert Keywords" }) });
    const input = card.getByPlaceholder("Add keyword or phrase…");

    // (a) Add "refund".
    await input.fill("refund");
    await card.getByRole("button", { name: "Add" }).click();
    await expect(card.locator("li", { hasText: "refund" })).toBeVisible({ timeout: 10_000 });

    // (b) Add "urgent".
    await input.fill("urgent");
    await card.getByRole("button", { name: "Add" }).click();
    await expect(card.locator("li", { hasText: "urgent" })).toBeVisible({ timeout: 10_000 });
    await expect(card.locator("li")).toHaveCount(2);

    // (c) Remove "refund" via its remove-x button.
    await card.getByLabel('Remove "refund"').click();
    await expect(card.locator("li", { hasText: "refund" })).not.toBeVisible();
    await expect(card.locator("li", { hasText: "urgent" })).toBeVisible();

    // (d) Reload the page — "urgent" persists.
    await page.reload();
    const cardAfterReload = page.locator("section", { has: page.getByRole("heading", { name: "Alert Keywords" }) });
    await expect(cardAfterReload.locator("li", { hasText: "urgent" })).toBeVisible({ timeout: 10_000 });
    await expect(cardAfterReload.locator("li", { hasText: "refund" })).not.toBeVisible();

    // Cleanup so subsequent runs of this spec start fresh.
    await cardAfterReload.getByLabel('Remove "urgent"').click();
    await expect(cardAfterReload.locator("li", { hasText: "urgent" })).not.toBeVisible();
  });
});
