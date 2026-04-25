import { test, expect } from "./fixtures";

/**
 * End-to-end test for the billing flow (Razorpay).
 */
test.describe("Billing & Subscription Flow", () => {
  
  test.beforeEach(async ({ page }) => {
    // 1. Block the real Razorpay SDK from loading to prevent it from overwriting our mock
    await page.route("https://checkout.razorpay.com/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/javascript",
        body: "window.Razorpay = class { constructor(opts) { this.opts = opts; } open() { this.opts.handler({ razorpay_payment_id: 'pay_123', razorpay_subscription_id: 'sub_456', razorpay_signature: 'sig_789' }); } };",
      });
    });

    // 2. Mock 'api/auth/me'
    await page.route("**/api/auth/me", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          user: { id: "user-1", email: "test@example.com" },
          tenant: { 
            id: "tenant-1", 
            business_name: "Test Corp", 
            plan: "free", 
            country: "IN", 
            message_count_month: 42
          }
        }),
      });
    });
  });

  test("Razorpay Upgrade Flow (Simulated)", async ({ page }) => {
    // Mock subscription (none)
    await page.route("**/api/billing/subscription", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(null) });
    });

    // Mock Checkout Session creation
    await page.route("**/api/billing/checkout", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ 
          gateway: "razorpay", 
          key_id: "rzp_test_123", 
          subscription_id: "sub_mock_456", 
          plan: "growth" 
        }),
      });
    });

    // Mock Payment Verification
    await page.route("**/api/billing/verify-razorpay", async (route) => {
      await route.fulfill({ 
        status: 200, 
        contentType: "application/json", 
        body: JSON.stringify({ status: "ok", plan: "growth" }) 
      });
    });

    await page.goto("/dashboard/billing");
    
    // Click 'Upgrade' on the Growth plan card
    const upgradeBtn = page.locator("button", { hasText: /Upgrade/i }).nth(1);
    await expect(upgradeBtn).toBeVisible({ timeout: 15_000 });
    await upgradeBtn.click();

    // The blocked script + mock handler will trigger the redirect immediately
    await page.waitForURL("**/dashboard/billing?success=true", { timeout: 20_000 });
    await expect(page.locator("text=Payment successful!")).toBeVisible();
  });

  test("Subscription Cancellation Flow", async ({ page }) => {
    let isCancelled = false;

    // Dynamically mock subscription based on test state
    await page.route("**/api/billing/subscription", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          plan: "starter", 
          status: "active", 
          gateway: "razorpay",
          current_period_end: "2026-12-31T23:59:59",
          cancel_at_period_end: isCancelled
        }),
      });
    });

    // Mock the cancel action
    await page.route("**/api/billing/cancel", async (route) => {
      isCancelled = true;
      await route.fulfill({ status: 200, body: JSON.stringify({ status: "ok" }) });
    });

    await page.goto("/dashboard/billing");
    
    // Open management modal
    await expect(page.locator("text=Manage subscription")).toBeVisible({ timeout: 15_000 });
    await page.locator("text=Manage subscription").click({ force: true });

    // Confirm cancellation
    await page.locator("button", { hasText: /cancel my subscription/i }).click();

    // Verify UI reflects the "Pending" state
    await expect(page.locator("text=Cancellation Pending")).toBeVisible({ timeout: 15_000 });
  });
});
