import {
  ABSOLUTE_SESSION_LIMIT_MS,
  getInactivityLimitMs,
  getSessionState,
  SESSION_WARNING_DURATION_MS,
} from "./sessionPolicy";

describe("session policy", () => {
  test("uses the shorter inactivity window for staff", () => {
    expect(getInactivityLimitMs("employee")).toBe(30 * 60 * 1000);
    expect(getInactivityLimitMs("admin")).toBe(30 * 60 * 1000);
    expect(getInactivityLimitMs("customer")).toBe(60 * 60 * 1000);
  });

  test("expires a session at the absolute limit", () => {
    expect(
      getSessionState({
        now: ABSOLUTE_SESSION_LIMIT_MS,
        sessionStartedAt: 0,
        lastActivityAt: ABSOLUTE_SESSION_LIMIT_MS,
        role: "customer",
      }).status
    ).toBe("expired");
  });

  test("warns when inactivity is within the warning window", () => {
    const inactivityLimit = getInactivityLimitMs("customer");
    const state = getSessionState({
      now: inactivityLimit - SESSION_WARNING_DURATION_MS + 1,
      sessionStartedAt: 0,
      lastActivityAt: 0,
      role: "customer",
    });
    expect(state.status).toBe("warning");
  });

  test("ends an inactive session", () => {
    const inactivityLimit = getInactivityLimitMs("employee");
    expect(
      getSessionState({
        now: inactivityLimit,
        sessionStartedAt: 0,
        lastActivityAt: 0,
        role: "employee",
      }).status
    ).toBe("inactive");
  });
});
