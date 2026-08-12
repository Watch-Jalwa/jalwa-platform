import { test, expect } from "@playwright/test";
import { authenticatePage, ensureQaUser, qaConfig, requiredEnv } from "./helpers/staging.mjs";

let config;
let customer;

test.describe.serial("authentication", () => {
  test.beforeAll(async () => {
    config = qaConfig();
    customer = await ensureQaUser(config, requiredEnv("STAGING_QA_CUSTOMER_EMAIL"));
  });

  test("email magic-link request reaches the configured staging Auth/SMTP boundary", async ({ page }) => {
    await page.goto("/login?next=/profile", { waitUntil: "networkidle" });
    await page.getByRole("textbox", { name: /Email/i }).fill(customer.email);
    await page.getByRole("button", { name: /Send sign-in link/i }).click();
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("status")).toContainText(/Check your email for the sign-in link|Preview complete/i);
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

  test("invalid email is rejected before a magic-link request is submitted", async ({ page }) => {
    await page.goto("/login", { waitUntil: "networkidle" });
    const email = page.getByRole("textbox", { name: /Email/i });
    await email.fill("not-an-email");
    expect(await email.evaluate((element) => element.checkValidity())).toBe(false);
    await page.getByRole("button", { name: /Send sign-in link/i }).click();
    expect(new URL(page.url()).pathname).toBe("/login");
  });
});
