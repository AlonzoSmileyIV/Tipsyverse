import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const publicRoutes = [
  "/",
  "/drinks",
  "/book",
  "/learn",
  "/about",
  "/contact",
  "/faq",
  "/privacy",
  "/terms-conditions",
  "/login",
  "/register",
  "/forgot-password",
];

test.describe("public route delivery", () => {
  for (const route of publicRoutes) {
    test(`directly loads ${route}`, async ({ page }) => {
      const response = await page.goto(route, { waitUntil: "domcontentloaded" });
      expect(response?.status(), `${route} should use the SPA fallback`).toBe(200);
      await expect(page.locator("#root")).not.toBeEmpty();
      await expect(page.locator("body")).not.toContainText(
        "This page could not be displayed"
      );
    });
  }
});

test("login is keyboard navigable and has no serious axe violations", async ({
  page,
}) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Login" })).toBeVisible();

  const analysis = await new AxeBuilder({ page })
    .disableRules(["color-contrast"])
    .analyze();
  expect(
    analysis.violations.filter(({ impact }) =>
      ["serious", "critical"].includes(impact)
    )
  ).toEqual([]);

  await page.keyboard.press("Tab");
  const firstFocus = await page.evaluate(() => document.activeElement?.tagName);
  expect(firstFocus).not.toBe("BODY");

  await page.keyboard.press("Tab");
  const secondFocus = await page.evaluate(
    () =>
      document.activeElement?.getAttribute("name") ||
      document.activeElement?.textContent
  );
  expect(secondFocus).toBeTruthy();
});

test("registration and booking have no serious accessibility violations", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem("ageVerified", "true");
    localStorage.setItem("hasSeenTutorial", "true");
  });

  for (const route of ["/register", "/book"]) {
    await page.goto(route);
    const analysis = await new AxeBuilder({ page }).analyze();
    expect(
      analysis.violations.filter(({ impact }) =>
        ["serious", "critical"].includes(impact)
      ),
      `${route} should have no serious or critical accessibility violations`
    ).toEqual([]);
  }
});

test("tutorial does not interrupt a direct booking visit", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("ageVerified", "true"));
  await page.goto("/book");
  await expect(page.getByRole("heading", { name: "Book an Event" })).toBeVisible();
  await expect(
    page.getByRole("dialog", { name: /welcome to tipsyverse/i })
  ).toBeHidden();
});

test("age verification persists after a full page reload", async ({ page }) => {
  await page.goto("/");
  const dialog = page.getByRole("dialog", { name: /welcome to tipsyverse/i });
  await expect(dialog).toBeVisible();
  await dialog.locator('input[placeholder="MM/DD/YYYY"]').fill("01/01/1990");
  for (const checkbox of await dialog.locator('input[type="checkbox"]').all()) {
    await checkbox.check();
  }
  const verifyButton = dialog.getByRole("button", { name: /let.s go/i });
  await verifyButton.click();
  await expect(verifyButton).toBeHidden({ timeout: 5_000 });

  await page.reload();
  await expect(page.getByRole("button", { name: /let.s go/i })).toBeHidden();
  await expect.poll(() => page.evaluate(() => localStorage.getItem("ageVerified"))).toBe("true");
});

test("shows offline status without discarding the current page", async ({
  context,
  page,
  browserName,
}) => {
  test.skip(browserName !== "chromium", "Offline emulation is Chromium-only.");
  await page.goto("/privacy");
  await context.setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event("offline")));
  await expect(page.getByText(/you.re offline/i)).toBeVisible();
  await expect(page.getByRole("heading", { name: /privacy/i })).toBeVisible();
});

test("remains usable on a slow mobile connection", async ({
  page,
  browserName,
}) => {
  test.setTimeout(60_000);
  test.skip(browserName !== "chromium", "Network throttling is Chromium-only.");
  // Load the development app shell before throttling. Vite serves thousands
  // of unbundled modules in dev, which is not representative of production;
  // the slow-network assertion should exercise route delivery and rendering.
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const session = await page.context().newCDPSession(page);
  await session.send("Network.enable");
  await session.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 300,
    downloadThroughput: (750 * 1024) / 8,
    uploadThroughput: (250 * 1024) / 8,
    connectionType: "cellular3g",
  });

  const response = await page.goto("/privacy", {
    waitUntil: "domcontentloaded",
    timeout: 45_000,
  });
  expect(response?.status()).toBe(200);
  await expect(page.locator("#root")).not.toBeEmpty();
  await expect(page.getByRole("heading", { name: /privacy/i })).toBeVisible({
    timeout: 15_000,
  });
});

test("an expired persisted session returns the user to login", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "loggedInUser",
      JSON.stringify({
        sessionStartedAt: Date.now() - 9 * 60 * 60 * 1000,
        user: { _id: "expired-user", role: "regular" },
      })
    );
    localStorage.setItem(
      "sessionLastActivityAt",
      String(Date.now() - 9 * 60 * 60 * 1000)
    );
  });

  await page.goto("/settings");
  await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
});
