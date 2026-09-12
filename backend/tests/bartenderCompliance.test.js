import test from "node:test";
import assert from "node:assert/strict";
import { getIndianaCompliance, getPermitCompliance, isIndianaEvent } from "../utils/libs/bartenderCompliance.js";

const compliant = (overrides = {}) => ({ bartenderProfile: { licenses: [{
  state: "IN", permitNumber: "TEST-PERMIT", expiresAt: "2030-01-01", verified: true, status: "active",
  serverTraining: { provider: "Approved provider", completedAt: "2025-01-01", status: "verified",
    attestedAuthenticAndCurrent: true, attestedRequiredTraining: true,
    proofDocument: { uploadedAt: "2025-01-01" } }, ...overrides,
}] } });

test("recognizes Indiana event state names", () => {
  assert.equal(isIndianaEvent({ location: { state: "IN" } }), true);
  assert.equal(isIndianaEvent({ location: { state: "Indiana" } }), true);
  assert.equal(isIndianaEvent({ location: { state: "OH" } }), false);
});

test("matches permits to any event state", () => {
  const user = compliant({ state: "OH" });
  assert.equal(getPermitCompliance(user, "Ohio", new Date("2026-01-01")).eligible, true);
  assert.equal(getPermitCompliance(user, "IN", new Date("2026-01-01")).eligible, false);
});

test("requires verified permit and training before Indiana work", () => {
  assert.equal(getIndianaCompliance(compliant(), new Date("2026-01-01")).eligible, true);
  const result = getIndianaCompliance(compliant({ verified: false }), new Date("2026-01-01"));
  assert.equal(result.eligible, false);
  assert.match(result.reasons.join(" "), /has not been verified/i);
});

test("does not require separate training certificate metadata", () => {
  const user = compliant();
  delete user.bartenderProfile.licenses[0].serverTraining.provider;
  delete user.bartenderProfile.licenses[0].serverTraining.completedAt;
  delete user.bartenderProfile.licenses[0].serverTraining.certificateNumber;
  const result = getIndianaCompliance(user, new Date("2028-01-02"));
  assert.equal(result.eligible, true);
});

test("requires confirmation that mandatory server training was completed", () => {
  const user = compliant();
  user.bartenderProfile.licenses[0].serverTraining.attestedRequiredTraining = false;
  const result = getIndianaCompliance(user, new Date("2026-01-01"));
  assert.equal(result.eligible, false);
  assert.match(result.reasons.join(" "), /training confirmation/i);
});
