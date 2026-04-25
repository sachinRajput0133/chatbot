import { test, expect, mockSlackTest } from "../fixtures";

const TEST_WEBHOOK = "https://hooks.slack.com/services/T0AVTEST00/B0000000000/abcdefghij1234567890";

test.describe("Integrations → Slack card", () => {
  test.beforeEach(async ({ page }) => {
    await mockSlackTest(page);
    await page.goto("/dashboard/integrations");
  });

  test("connect → save → test → disconnect happy path", async ({ page }) => {
    const slackCard = page.locator("section", { has: page.getByRole("heading", { name: "Slack" }) });

    // (a) Initial state: not connected — connect form visible.
    await expect(slackCard.getByPlaceholder("https://hooks.slack.com/services/T000/B000/...")).toBeVisible();
    await expect(slackCard.getByRole("button", { name: "Save" })).toBeVisible();

    // (b) Save a real-looking webhook URL.
    await slackCard.getByPlaceholder("https://hooks.slack.com/services/T000/B000/...").fill(TEST_WEBHOOK);
    await slackCard.getByRole("button", { name: "Save" }).click();

    // After save: Connected pill + masked URL + Send-test / Disconnect buttons.
    await expect(slackCard.getByText("Connected", { exact: true })).toBeVisible({ timeout: 10_000 });
    // Mask format: "hooks.slack.com/services/T0AVTEST00/…/4567890"
    await expect(slackCard.locator("code")).toContainText("hooks.slack.com/services/T0AVTEST00/");
    await expect(slackCard.getByRole("button", { name: "Send test message" })).toBeVisible();

    // (c) Send test — mocked endpoint returns ok.
    await slackCard.getByRole("button", { name: "Send test message" }).click();
    await expect(page.getByText("Test message sent — check your Slack channel.")).toBeVisible();

    // (d) Disconnect — confirm dialog, then form returns.
    page.on("dialog", (d) => d.accept());
    await slackCard.getByRole("button", { name: "Disconnect" }).click();

    // Slack disconnect uses the page-level banner (not a card-scoped banner).
    await expect(page.getByText("Slack disconnected.")).toBeVisible();
    await expect(slackCard.getByPlaceholder("https://hooks.slack.com/services/T000/B000/...")).toBeVisible();
  });
});
