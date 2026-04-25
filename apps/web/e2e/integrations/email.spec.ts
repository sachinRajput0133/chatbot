import { test, expect, mockEmailTest } from "../fixtures";

test.describe("Integrations → Email notifications card", () => {
  test.beforeEach(async ({ page }) => {
    await mockEmailTest(page, "primary@example.com");
    await page.goto("/dashboard/integrations");
  });

  test("connect → add CC → remove CC → send test → disconnect", async ({ page }) => {
    const card = page.locator("section", { has: page.getByRole("heading", { name: "Email notifications" }) });

    // (a) Initial state: not connected → Connect form visible.
    await expect(card.getByRole("button", { name: "Connect" })).toBeVisible();

    // (b) Connect with a primary email.
    const primaryInput = card.locator('input[type="email"]').first();
    await primaryInput.fill("primary@example.com");
    await card.getByRole("button", { name: "Connect" }).click();

    // After connect: badge appears, "Currently sending to:" line appears.
    await expect(card.getByText("Connected", { exact: true })).toBeVisible({ timeout: 10_000 });
    await expect(card.getByText(/Currently sending to:/)).toBeVisible();
    await expect(card.locator("code", { hasText: "primary@example.com" })).toBeVisible();

    // (c) Add a CC chip.
    const ccInput = card.getByPlaceholder("alerts@yourcompany.com");
    await ccInput.fill("cc1@example.com");
    await card.getByRole("button", { name: "Add" }).click();

    // Counter line should now read "1 / 5 CC addresses added.".
    await expect(card.getByText("1 / 5 CC addresses added.")).toBeVisible({ timeout: 10_000 });
    await expect(card.locator("li", { hasText: "cc1@example.com" })).toBeVisible();

    // (d) Remove the chip.
    await card.getByLabel("Remove cc1@example.com").click();
    await expect(card.getByText("0 / 5 CC addresses added.")).toBeVisible({ timeout: 10_000 });

    // (e) Send test email — mocked endpoint.
    await card.getByRole("button", { name: "Send test email" }).click();
    await expect(page.getByText(/Test email sent to primary@example\.com/)).toBeVisible();

    // (f) Disconnect — confirm dialog, form returns.
    page.on("dialog", (d) => d.accept());
    await card.getByRole("button", { name: "Disconnect" }).click();
    await expect(card.getByText("Email notifications disconnected.")).toBeVisible();
    await expect(card.getByRole("button", { name: "Connect" })).toBeVisible();
  });
});
