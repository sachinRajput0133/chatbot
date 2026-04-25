import { test as base, expect, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

/**
 * Mock helpers — install BEFORE navigating so the routes are matched on first hit.
 *
 * We only intercept the *test* endpoints (POST .../test) since those are the
 * paths that actually fan out to Slack / Resend / Meta. The CRUD endpoints
 * (GET/PUT) just touch our own DB and are exercised for real.
 */

export async function mockSlackTest(page: Page) {
  await page.route("**/api/integrations/slack/test", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, detail: null }),
    });
  });
}

export async function mockEmailTest(page: Page, sentTo = "primary@example.com") {
  await page.route("**/api/integrations/email-notifications/test", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, sent_to: sentTo, cc_count: 0, detail: null }),
    });
  });
}

export async function mockWhatsAppTest(page: Page) {
  await page.route("**/api/integrations/whatsapp/test", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, detail: null, delivered_to: 1 }),
    });
  });
}

/** Read the credentials persisted by auth.setup.ts. */
export function readSeededCreds(): { email: string; password: string; businessName: string } {
  const file = path.join(__dirname, ".auth", "owner.creds.json");
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

export const test = base.extend({});
export { expect };
