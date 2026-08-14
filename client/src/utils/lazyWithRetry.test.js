import { describe, expect, it, vi } from "vitest";
import { isDynamicImportFailure, loadRouteWithRetry } from "./lazyWithRetry";

const storage = () => {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
};

describe("lazyWithRetry", () => {
  it("recognizes stale dynamic module failures", () => {
    expect(
      isDynamicImportFailure(
        new TypeError("Failed to fetch dynamically imported module: /HomeScreen.js")
      )
    ).toBe(true);
    expect(isDynamicImportFailure(new Error("Regular render failure"))).toBe(false);
  });

  it("clears the retry marker after a successful import", async () => {
    const session = storage();
    session.setItem("tipsyverse:lazy-route-refresh:home", "1");
    const module = { default: () => null };
    await expect(
      loadRouteWithRetry(() => Promise.resolve(module), "home", {
        storage: session,
        reload: vi.fn(),
      })
    ).resolves.toBe(module);
    expect(session.getItem("tipsyverse:lazy-route-refresh:home")).toBeNull();
  });

  it("throws after one automatic refresh instead of looping", async () => {
    const session = storage();
    session.setItem("tipsyverse:lazy-route-refresh:home", "1");
    const error = new TypeError("Failed to fetch dynamically imported module");
    await expect(
      loadRouteWithRetry(() => Promise.reject(error), "home", {
        storage: session,
        reload: vi.fn(),
      })
    ).rejects.toBe(error);
    expect(session.getItem("tipsyverse:lazy-route-refresh:home")).toBeNull();
  });

  it("refreshes once on the first stale module failure", async () => {
    const session = storage();
    const reload = vi.fn();
    void loadRouteWithRetry(
      () => Promise.reject(new TypeError("Failed to fetch dynamically imported module")),
      "home",
      { storage: session, reload }
    );
    await Promise.resolve();
    await Promise.resolve();
    expect(reload).toHaveBeenCalledOnce();
    expect(session.getItem("tipsyverse:lazy-route-refresh:home")).toBe("1");
  });
});
