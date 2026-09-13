import { beforeEach, expect, test, vi } from "vitest";
import { clearAccessToken, setAccessToken } from "./authSessionStore";

const { io } = vi.hoisted(() => ({
  io: vi.fn((url, options) => ({ url, ...options })),
}));
vi.mock("socket.io-client", () => ({ io }));

beforeEach(() => {
  localStorage.clear();
  clearAccessToken();
});

test("socket authentication sends the current access token", async () => {
  setAccessToken("signed-access-token");
  const { default: socket } = await import("./socket");
  const callback = vi.fn();
  socket.auth(callback);
  expect(callback).toHaveBeenCalledWith({ token: "signed-access-token" });
  expect(socket.autoConnect).toBe(false);
});
