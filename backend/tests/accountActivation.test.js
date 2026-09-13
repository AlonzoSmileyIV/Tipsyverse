import test from "node:test";
import assert from "node:assert/strict";
import {
  ACCOUNT_ACTIVATION_TTL_MS,
  hashAccountActivationToken,
  issueAccountActivation,
} from "../utils/libs/accountActivation.js";

test("account activation tokens are stored only as hashes with a short expiry", () => {
  const user = {};
  const now = Date.now();
  const token = issueAccountActivation(user, { now });

  assert.equal(token.length, 64);
  assert.notEqual(user.activationTokenHash, token);
  assert.equal(user.activationTokenHash, hashAccountActivationToken(token));
  assert.equal(
    user.activationTokenExpiresAt.getTime(),
    now + ACCOUNT_ACTIVATION_TTL_MS
  );
  assert.equal(user.mustSetPassword, true);
  assert.equal(user.activationCompletedAt, null);
});

test("issuing a new activation token invalidates the previous token", () => {
  const user = {};
  const first = issueAccountActivation(user);
  const second = issueAccountActivation(user);

  assert.notEqual(first, second);
  assert.notEqual(user.activationTokenHash, hashAccountActivationToken(first));
  assert.equal(user.activationTokenHash, hashAccountActivationToken(second));
});
