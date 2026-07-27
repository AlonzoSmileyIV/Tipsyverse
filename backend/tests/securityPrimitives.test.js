import test from "node:test";
import assert from "node:assert/strict";
import { canManage } from "../utils/libs/canManage.js";
import {
  hashRefreshTokenId,
  refreshSessionExpiresAt,
} from "../utils/libs/refreshSession.js";

const employee = (id, hierarchy, directReports = []) => ({
  _id: id,
  employeeDetails: {
    position: { hierarchy: { name: hierarchy } },
    directReports,
  },
});

test("a manager cannot edit a peer or superior", () => {
  const actor = employee("actor", "Manager");
  for (const targetHierarchyName of ["Owner", "Director", "Manager"]) {
    assert.equal(
      canManage({ actor, action: "edit", targetHierarchyName, targetId: "target" }).ok,
      false
    );
  }
});

test("one-level hierarchy changes require a direct report", () => {
  const actor = employee("actor", "Manager", ["direct"]);
  assert.equal(
    canManage({
      actor,
      action: "edit",
      targetHierarchyName: "Supervisor",
      targetId: "direct",
    }).ok,
    true
  );
  assert.equal(
    canManage({
      actor,
      action: "edit",
      targetHierarchyName: "Supervisor",
      targetId: "someone-else",
    }).ok,
    false
  );
});

test("self deletion and self status changes are denied", () => {
  const actor = employee("actor", "Owner");
  assert.equal(
    canManage({
      actor,
      action: "delete",
      targetHierarchyName: "Owner",
      targetId: "actor",
    }).ok,
    false
  );
  assert.equal(
    canManage({
      actor,
      action: "edit",
      targetHierarchyName: "Owner",
      targetId: "actor",
      isStatusChange: true,
    }).ok,
    false
  );
});

test("refresh identifiers are hashed and sessions have an eight-hour ceiling", () => {
  assert.notEqual(hashRefreshTokenId("token-id"), "token-id");
  assert.equal(
    refreshSessionExpiresAt(1_000).getTime(),
    1_000 + 8 * 60 * 60 * 1000
  );
});
