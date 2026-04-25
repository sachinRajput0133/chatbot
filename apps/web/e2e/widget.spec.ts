import { test, expect } from "./fixtures";

/**
 * End-to-end test of the chat widget.
 */
test.describe("Chat widget — visitor flow", () => {
  test("opening the bubble, sending a message, and seeing a reply", async ({ page }) => {
    // Mock POST /api/chat/{bot_id}
    await page.route(/.*\/api\/chat\/.*/, async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      
      const body = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          reply: `Echo: ${body?.message ?? ""}`,
          message_id: "msg_" + Math.random().toString(36).slice(2),
          conversation_id: "conv_123",
        }),
      });
    });

    await page.goto("/dashboard");

    // Wait for bubble
    const bubble = page.locator("#cb-bubble");
    await expect(bubble).toBeVisible({ timeout: 20_000 });

    // Open panel
    await bubble.click();
    const panel = page.locator("#cb-panel");
    await expect(panel).toBeVisible();

    // Send message
    const input = page.locator("#cb-input");
    await input.fill("Hello Playwright");
    await page.locator("#cb-send").click();

    // Verify user message
    await expect(page.locator(".cb-msg.cb-user", { hasText: "Hello Playwright" })).toBeVisible();

    // Verify bot message (wait up to 10s for the mock to cycle)
    const botMsg = page.locator(".cb-msg.cb-bot").last();
    await expect(botMsg).toContainText("Echo: Hello Playwright", { timeout: 10_000 });
  });

  test("AI failure fallback", async ({ page }) => {
    await page.route(/.*\/api\/chat\/.*/, async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          reply: "Temporarily unavailable fallback",
          message_id: "msg_err",
          conversation_id: "conv_err",
        }),
      });
    });

    await page.goto("/dashboard");
    await page.locator("#cb-bubble").click();
    await page.locator("#cb-input").fill("error test");
    await page.locator("#cb-send").click();

    await expect(page.locator(".cb-msg.cb-bot").last()).toContainText("unavailable", { timeout: 10_000 });
  });
});
