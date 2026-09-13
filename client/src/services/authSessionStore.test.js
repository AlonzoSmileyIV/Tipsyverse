import { beforeEach, expect, test } from "vitest";
import {
  clearAccessToken,
  getAccessToken,
  persistSession,
  readPersistedSession,
  setAccessToken,
} from "./authSessionStore";

beforeEach(() => {
  localStorage.clear();
  clearAccessToken();
});

test("access tokens remain in memory and are omitted from persisted sessions", () => {
  setAccessToken("secret-access-token");
  persistSession({
    accessToken: "secret-access-token",
    sessionStartedAt: 123,
    user: { _id: "user-1", role: "regular" },
  });

  expect(getAccessToken()).toBe("secret-access-token");
  expect(localStorage.getItem("loggedInUser")).not.toContain(
    "secret-access-token"
  );
  expect(readPersistedSession()).toEqual({
    sessionStartedAt: 123,
    user: { _id: "user-1", role: "regular" },
  });
});

test("reading a legacy session removes its persisted access token", () => {
  localStorage.setItem(
    "loggedInUser",
    JSON.stringify({ accessToken: "legacy-token", user: { _id: "user-1" } })
  );

  expect(readPersistedSession()).toEqual({ user: { _id: "user-1" } });
  expect(localStorage.getItem("loggedInUser")).not.toContain("legacy-token");
});
