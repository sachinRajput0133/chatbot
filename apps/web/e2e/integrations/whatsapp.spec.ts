import { test, expect, mockWhatsAppTest } from "../fixtures";

test.describe("Integrations → WhatsApp card", () => {
  test.beforeEach(async ({ page }) => {
    await mockWhatsAppTest(page);
    await page.goto("/dashboard/integrations");
  });

  test("connect → add recipient → send test → disconnect", async ({ page }) => {
    const card = page.locator("section", { has: page.getByRole("heading", { name: "WhatsApp" }) });

    // (a) Initial: not connected. Both credential fields visible.
    await expect(card.getByPlaceholder("e.g. 123456789012345")).toBeVisible();
    await expect(card.getByPlaceholder("EAAG....")).toBeVisible();

    // (b) Save credentials.
    await card.getByPlaceholder("e.g. 123456789012345").fill("987654321098765");
    await card.getByPlaceholder("EAAG....").fill("EAAG_test_access_token_xxxxxxxxxxxxxxxxxxxx");
    await card.getByRole("button", { name: "Save Credentials" }).click();

    // After save: Connected pill + masked Phone Number ID block.
    await expect(card.getByText("Connected")).toBeVisible({ timeout: 10_000 });
    await expect(card.getByText("Phone Number ID", { exact: true })).toBeVisible();

    // (c) Add a recipient phone number.
    const phoneInput = card.getByPlaceholder("+1234567890");
    await phoneInput.fill("+15551234567");
    await card.getByRole("button", { name: "Add" }).click();
    await expect(card.locator("li", { hasText: "+15551234567" })).toBeVisible({ timeout: 10_000 });

    // (d) Send Test Message — mocked endpoint returns delivered_to: 1.
    await card.getByRole("button", { name: "Send Test Message" }).click();
    await expect(page.getByText("Test message sent to 1 recipient(s).")).toBeVisible();

    // (e) Disconnect — confirm dialog, form returns.
    page.on("dialog", (d) => d.accept());
    await card.getByRole("button", { name: "Disconnect" }).click();
    await expect(card.getByText("WhatsApp disconnected.")).toBeVisible();
    await expect(card.getByPlaceholder("e.g. 123456789012345")).toBeVisible();
  });
});
