import test from "node:test";
import assert from "node:assert/strict";
import {
  getStateCompliancePolicy,
  resetStateCompliancePolicyCacheForTests,
} from "../utils/libs/stateCompliancePolicy.js";

test("Indiana requires a permit while unknown states default to permit optional review", () => {
  assert.equal(getStateCompliancePolicy("IN").permitRequired, true);
  const ohio = getStateCompliancePolicy("OH");
  assert.equal(ohio.permitRequired, false);
  assert.equal(ohio.trainingAttestationRequired, true);
  assert.equal(ohio.adminReviewRequired, true);
});

test("deployment configuration can override a state policy", () => {
  const previous = process.env.STATE_COMPLIANCE_POLICY_JSON;
  process.env.STATE_COMPLIANCE_POLICY_JSON = JSON.stringify({
    OH: { permitRequired: true, trainingAttestationRequired: false },
  });
  resetStateCompliancePolicyCacheForTests();
  const policy = getStateCompliancePolicy("OH");
  assert.equal(policy.permitRequired, true);
  assert.equal(policy.trainingAttestationRequired, false);
  if (previous === undefined) delete process.env.STATE_COMPLIANCE_POLICY_JSON;
  else process.env.STATE_COMPLIANCE_POLICY_JSON = previous;
  resetStateCompliancePolicyCacheForTests();
});
