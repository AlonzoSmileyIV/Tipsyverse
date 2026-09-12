import test from "node:test";
import assert from "node:assert/strict";
import Notification from "../models/libs/notification.model.js";

test("bartender reassignment notification types are registered", () => {
  const allowedTypes = Notification.schema.path("type").enumValues;
  assert.ok(allowedTypes.includes("event_reassign"));
  assert.ok(allowedTypes.includes("event_reassign_urgent"));
  assert.equal(allowedTypes.includes("event_resassign"), false);
});
