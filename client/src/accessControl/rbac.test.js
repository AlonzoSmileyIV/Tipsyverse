import { describe, expect, it } from "vitest";
import { canAssignPosition } from "./rbac";

const hierarchy = (name) => ({ name });
const position = (name, hierarchyName) => ({
  _id: `${name}-id`,
  name,
  hierarchy: hierarchy(hierarchyName),
});

describe("employee position assignment permissions", () => {
  const report = {
    _id: "employee-id",
    employeeDetails: {
      position: position("Support Employee", "Employee"),
    },
  };
  const manager = {
    _id: "manager-id",
    employeeDetails: {
      position: position("Operations Manager", "Manager"),
      directReports: [report._id],
    },
  };

  it("does not let a manager assign their own rank or a superior rank", () => {
    expect(
      canAssignPosition({
        actor: manager,
        mode: "edit",
        employee: report,
        position: position("Owner", "Owner"),
      })
    ).toBe(false);
    expect(
      canAssignPosition({
        actor: manager,
        mode: "edit",
        employee: report,
        position: position("Manager", "Manager"),
      })
    ).toBe(false);
  });

  it("lets a manager assign lower-level positions to a direct report", () => {
    expect(
      canAssignPosition({
        actor: manager,
        mode: "edit",
        employee: report,
        position: position("Supervisor", "Supervisor"),
      })
    ).toBe(true);
    expect(
      canAssignPosition({
        actor: manager,
        mode: "edit",
        employee: report,
        position: position("Employee", "Employee"),
      })
    ).toBe(true);
  });
});
