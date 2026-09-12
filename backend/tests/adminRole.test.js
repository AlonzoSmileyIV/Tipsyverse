import test from "node:test";
import assert from "node:assert/strict";
import { UserModel as User } from "../models/index.js";

test("the user model accepts the dedicated admin role", () => {
  const rolePath = User.schema.path("role");
  assert.ok(rolePath.enumValues.includes("admin"));
});
