import { test, expect } from "@playwright/test";
import { authenticatePage, ensureQaUser, qaConfig, requiredEnv } from "./helpers/staging.mjs";

let config;
let customer;

test.describe.serial("authentication", () => {
  test.beforeAll(async () => {
    config = qaConfig();
    customer = await ensureQaUser(config, requiredEnv("STAGING_QA_CUSTOMER_EMAIL"));
  });

  test("email OTP request reaches the configured staging Auth/SMTP boundary", async ({ page }) => {
    await page.goto("/login?next=/profile", { waitUntil: "networkidle" });
    await page.getByLabel(/Full name/i).fill("Jalwa QA");
    await page.getByLabel(/Email or mobile number/i).fill(customer.email);
    await page.getByRole("button", { name: /^Continue$/i }).click();
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: /Enter your code/i })).toBeVisible();
    await expect(page.getByRole("status")).toContainText(/four-digit code|Preview complete/i);
    await expect(page.getByRole("status")).not.toContainText(/could not be sent/i);
  });

  test("generated staging magic link establishes a persistent authenticated session", async ({ page }) => {
    await authenticatePage(page, config, customer.email, "/profile");
    await page.goto("/profile", { waitUntil: "networkidle" });
    expect(new URL(page.url()).pathname).toBe("/profile");
    await expect(page.locator("body")).not.toContainText(/Sign in required|Permission denied/i);

    await page.goto("/pricing", { waitUntil: "networkidle" });
    await expect(page.locator(".checkout-button").first()).toBeVisible();
  });

  test("invalid identity is rejected before an OTP request is submitted", async ({ page }) => {
    await page.goto("/login", { waitUntil: "networkidle" });
    await page.getByLabel(/Full name/i).fill("Jalwa QA");
    const identity = page.getByLabel(/Email or mobile number/i);
    await identity.fill("not-an-email");
    await page.getByRole("button", { name: /^Continue$/i }).click();
    await expect(page.getByRole("status")).toContainText(/valid email|Pakistani mobile/i);
    expect(new URL(page.url()).pathname).toBe("/login");
  });
});
