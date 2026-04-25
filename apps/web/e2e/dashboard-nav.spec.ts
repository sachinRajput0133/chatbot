import { test, expect } from "./fixtures";

// Each entry pairs the visible label with its `href`. Selecting by `href` is
// stable; the link's accessible name also includes the Material-Icons font
// glyph text (e.g. "dashboard Dashboard"), so role+name regexes are brittle.
const NAV_ITEMS: Array<{ label: string; href: string }> = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Knowledge Base", href: "/dashboard/knowledge" },
  { label: "Customize Bot", href: "/dashboard/customize" },
  { label: "Bot Goals", href: "/dashboard/goals" },
  { label: "Embed Code", href: "/dashboard/embed" },
  { label: "Conversations", href: "/dashboard/conversations" },
  { label: "Analytics", href: "/dashboard/analytics" },
  { label: "Integrations", href: "/dashboard/integrations" },
  { label: "Billing", href: "/dashboard/billing" },
  { label: "Profile", href: "/dashboard/profile" },
];

test.describe("Dashboard sidebar navigation", () => {
  test("renders all expected nav items and Integrations route works", async ({ page }) => {
    await page.goto("/dashboard");

    const sidebar = page.locator("aside").first();

    for (const { label, href } of NAV_ITEMS) {
      const link = sidebar.locator(`a[href="${href}"]`);
      await expect(link, `nav item missing: ${label} (${href})`).toBeVisible();
      await expect(link).toContainText(label);
    }

    // Click Integrations and confirm we land on the right page.
    await sidebar.locator('a[href="/dashboard/integrations"]').click();
    await expect(page).toHaveURL(/\/dashboard\/integrations$/);
    await expect(page.getByRole("heading", { name: "Integrations", exact: true })).toBeVisible();
  });
});
