import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const sessionStartedAt = Date.now();

const users = {
  customer: {
    _id: "qa-customer",
    fullName: "QA Customer",
    email: "customer@example.test",
    username: "qa.customer",
    role: "regular",
    profile: { birthday: "1990-01-01" },
    preferences: { hasSeenTutorial: true },
    accountStatus: { state: "Active" },
  },
  bartender: {
    _id: "qa-bartender",
    fullName: "QA Bartender",
    email: "bartender@example.test",
    username: "qa.bartender",
    role: "bartender",
    bartenderStatus: "active",
    bartenderProfile: { licenses: [], payoutLinks: {} },
    profile: { birthday: "1990-01-01" },
    preferences: { hasSeenTutorial: true },
    accountStatus: { state: "Active" },
  },
  admin: {
    _id: "qa-admin",
    fullName: "QA Admin",
    email: "admin@example.test",
    username: "qa.admin",
    role: "admin",
    profile: { birthday: "1990-01-01" },
    preferences: { hasSeenTutorial: true },
    accountStatus: { state: "Active" },
  },
};

const json = (route, payload) =>
  route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(payload),
  });

async function authenticate(page, user) {
  await page.addInitScript(
    ({ persistedUser, startedAt }) => {
      localStorage.setItem(
        "loggedInUser",
        JSON.stringify({ user: persistedUser, sessionStartedAt: startedAt })
      );
      localStorage.setItem("sessionLastActivityAt", String(Date.now()));
      localStorage.setItem("ageVerified", "true");
      localStorage.setItem(`hasSeenTutorial-${persistedUser._id}`, "true");
    },
    { persistedUser: user, startedAt: sessionStartedAt }
  );

  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^.*\/api\/v1/, "");

    if (path === "/users/refresh-token") {
      return json(route, { accessToken: "qa-access-token", sessionStartedAt });
    }
    if (path === "/users/me") return json(route, user);
    if (path === "/users/me/bartender-info") {
      return json(route, { status: "active", licenses: [] });
    }
    if (path === "/events/counts") {
      return json(route, {
        data: { public: 0, my: 0, available: 0, assigned: 0, upcoming: 0 },
      });
    }
    if (path === "/users/me/profile-completion") {
      return json(route, { data: { percentage: 100, missing: [] } });
    }

    return json(route, []);
  });
}

async function expectUsableRoute(page, route) {
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto(route, { waitUntil: "domcontentloaded" });
  await expect(page).not.toHaveURL(/\/login/);
  await expect(page.locator("main")).toBeVisible({ timeout: 10_000 });
  await page.waitForTimeout(1_200);
  expect(pageErrors, `${route} should not throw runtime errors`).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    ),
    `${route} should not overflow horizontally`
  ).toBeLessThanOrEqual(1);

  const analysis = await new AxeBuilder({ page }).analyze();
  expect(
    analysis.violations.filter(({ impact }) =>
      ["serious", "critical"].includes(impact)
    ),
    `${route} should have no serious or critical accessibility violations`
  ).toEqual([]);
}

test("customer settings and event routes remain usable", async ({ page }) => {
  await authenticate(page, users.customer);
  for (const route of ["/settings", "/settings/security", "/settings/support", "/my-events"]) {
    await expectUsableRoute(page, route);
  }
});

test("bartender portal remains usable", async ({ page }) => {
  await authenticate(page, users.bartender);
  await expectUsableRoute(page, "/bartend");
});

test("admin dashboard routes remain usable", async ({ page }) => {
  await authenticate(page, users.admin);
  for (const route of ["/admin", "/admin/finance", "/admin/users", "/admin/operations"]) {
    await expectUsableRoute(page, route);
  }
});

test("customers cannot enter administration", async ({ page }) => {
  await authenticate(page, users.customer);
  await page.goto("/admin");
  await expect(page.getByText(/access denied/i)).toBeVisible({ timeout: 10_000 });
});
