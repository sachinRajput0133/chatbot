import { test, expect, readSeededCreds } from "./fixtures";

// Override storageState so this spec starts unauthenticated.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("Auth — login flow", () => {
  test("logs in via the UI using the seeded test tenant", async ({ page }) => {
    const { email, password } = readSeededCreds();

    await page.goto("/login");

    // The login form uses id="email" and id="password" — getByLabel works
    // because those inputs share the same id with their labels.
    await page.locator("#email").fill(email);
    await page.locator("#password").fill(password);
    await page.getByRole("button", { name: /^(Sign In|Signing in)/ }).click();

    // Successful login should land us on the dashboard with the sidebar visible.
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
    await expect(page.locator('aside a[href="/dashboard"]').first()).toBeVisible();
  });
});
