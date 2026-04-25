import { test as setup, expect, request } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const API_URL = process.env.E2E_API_URL || "http://localhost:8000";
const STORAGE_FILE = path.join(__dirname, ".auth", "owner.json");

// Persist credentials across the run so auth.spec.ts can log in via the UI
// using the same account this fixture provisioned.
const CREDS_FILE = path.join(__dirname, ".auth", "owner.creds.json");

setup("provision tenant + persist auth state", async ({ page }) => {
  fs.mkdirSync(path.dirname(STORAGE_FILE), { recursive: true });

  const stamp = Date.now();
  const email = `e2e_${stamp}@example.com`;
  const password = "Test_Pass_12345!";
  const businessName = `E2E Tenant ${stamp}`;

  // 1. Sign up via the API directly — bypasses the UI for speed/reliability.
  const api = await request.newContext({ baseURL: API_URL });
  const resp = await api.post("/api/auth/signup", {
    data: {
      business_name: businessName,
      email,
      password,
      country: "US",
    },
  });
  expect(resp.ok(), `signup failed: ${resp.status()} ${await resp.text()}`).toBe(true);
  const { access_token: token } = await resp.json();
  expect(token, "signup did not return access_token").toBeTruthy();
  await api.dispose();

  // 2. Seed localStorage.cb_token then visit /dashboard so the storage state
  //    is captured in the right origin context.
  await page.addInitScript(([t, e]) => {
    window.localStorage.setItem("cb_token", t);
    // The frontend also caches a minimal user blob; populating it avoids a
    // brief unauthenticated flash on the first paint of authenticated tests.
    window.localStorage.setItem(
      "cb_user",
      JSON.stringify({ email: e, role: "owner" })
    );
  }, [token, email]);

  await page.goto("/dashboard");
  // Sidebar's "Logout" entry is rendered only for authenticated users.
  await expect(page.getByText("Logout").first()).toBeVisible({ timeout: 15_000 });

  await page.context().storageState({ path: STORAGE_FILE });
  fs.writeFileSync(
    CREDS_FILE,
    JSON.stringify({ email, password, businessName, apiUrl: API_URL }, null, 2)
  );
});
