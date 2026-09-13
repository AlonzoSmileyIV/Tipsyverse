import test from "node:test";
import assert from "node:assert/strict";
import { canManage } from "../utils/libs/canManage.js";
import {
  hashRefreshTokenId,
  deriveNextRefreshTokenId,
  refreshSessionExpiresAt,
} from "../utils/libs/refreshSession.js";
import createRefreshToken from "../utils/libs/createRefreshToken.js";
import jwt from "jsonwebtoken";

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

test("an admin can manage users without an employee hierarchy", () => {
  assert.deepEqual(
    canManage({
      actor: { _id: "admin", role: "admin" },
      action: "edit",
      targetHierarchyName: "Owner",
      targetId: "target",
      isStatusChange: true,
    }),
    { ok: true }
  );
});

test("refresh identifiers are hashed and sessions have an eight-hour ceiling", () => {
  assert.notEqual(hashRefreshTokenId("token-id"), "token-id");
  assert.equal(
    refreshSessionExpiresAt(1_000).getTime(),
    1_000 + 8 * 60 * 60 * 1000
  );
});

test("refresh rotation is deterministic for safe overlap recovery", () => {
  const next = deriveNextRefreshTokenId("token-1", "session-1", "secret");
  assert.equal(next, deriveNextRefreshTokenId("token-1", "session-1", "secret"));
  assert.notEqual(next, deriveNextRefreshTokenId("token-2", "session-1", "secret"));
});

test("a decoded refresh token can be rotated without reusing JWT timestamps", () => {
  const previousSecret = process.env.REFRESH_TOKEN_SECRET;
  process.env.REFRESH_TOKEN_SECRET = "refresh-token-test-secret";

  try {
    const original = createRefreshToken({
      id: "user-id",
      sid: "session-id",
      jti: "old-token-id",
    });
    const decoded = jwt.verify(original, process.env.REFRESH_TOKEN_SECRET);
    const {
      iat: _issuedAt,
      exp: _expiresAt,
      nbf: _notBefore,
      ...refreshPayload
    } = decoded;

    const rotated = createRefreshToken({
      ...refreshPayload,
      jti: "new-token-id",
    });
    const rotatedPayload = jwt.verify(
      rotated,
      process.env.REFRESH_TOKEN_SECRET
    );

    assert.equal(rotatedPayload.id, "user-id");
    assert.equal(rotatedPayload.sid, "session-id");
    assert.equal(rotatedPayload.jti, "new-token-id");
    assert.equal(typeof rotatedPayload.iat, "number");
    assert.equal(typeof rotatedPayload.exp, "number");
  } finally {
    if (previousSecret === undefined) {
      delete process.env.REFRESH_TOKEN_SECRET;
    } else {
      process.env.REFRESH_TOKEN_SECRET = previousSecret;
    }
  }
});
