import { beforeEach, describe, expect, test, vi } from "vitest";

const post = vi.fn();
const requestUse = vi.fn();
const responseUse = vi.fn();

vi.mock("axios", () => ({
  default: {
    create: () => ({
      defaults: { headers: { common: {} } },
      interceptors: {
        request: { use: requestUse },
        response: { use: responseUse },
      },
    }),
    post,
  },
}));

describe("restoreAuthentication", () => {
  beforeEach(() => {
    vi.resetModules();
    post.mockReset();
    localStorage.clear();
  });

  test("restores from an HttpOnly cookie when local storage is empty", async () => {
    post.mockResolvedValue({ data: { accessToken: "restored-token" } });
    const { restoreAuthentication } = await import("./api");

    await expect(restoreAuthentication()).resolves.toBe("restored-token");
    expect(post).toHaveBeenCalledWith(
      expect.stringContaining("/users/refresh-token"),
      {},
      expect.objectContaining({ withCredentials: true })
    );
  });

  test("treats a missing cookie as a normal anonymous visit", async () => {
    post.mockRejectedValue({
      response: {
        status: 401,
        data: { code: "REFRESH_TOKEN_MISSING" },
      },
    });
    const { restoreAuthentication } = await import("./api");

    await expect(restoreAuthentication()).resolves.toBeNull();
    expect(localStorage.getItem("authLogoutMessage")).toBeNull();
  });

  test("surfaces an invalid cookie for a previously persisted session", async () => {
    localStorage.setItem("loggedInUser", JSON.stringify({ user: { _id: "1" } }));
    const error = {
      response: {
        status: 403,
        data: { code: "REFRESH_TOKEN_INVALID" },
      },
    };
    post.mockRejectedValue(error);
    const { restoreAuthentication } = await import("./api");

    await expect(restoreAuthentication()).rejects.toBe(error);
  });
});
