import { expect, test, vi } from "vitest";
import { navigateOrReload } from "./navigateOrReload";

test("uses client-side navigation so authentication state is preserved", () => {
  const navigate = vi.fn();
  navigateOrReload(navigate, "/admin?tab=events", { replace: true });
  expect(navigate).toHaveBeenCalledWith("/admin?tab=events", { replace: true });
});
