const DEFAULT_POLICY = Object.freeze({
  permitRequired: false,
  trainingAttestationRequired: true,
  adminReviewRequired: true,
});

const BUILT_IN_POLICIES = Object.freeze({
  IN: {
    permitRequired: true,
    trainingAttestationRequired: true,
    adminReviewRequired: true,
  },
});

let cachedOverrides;
const readOverrides = () => {
  if (cachedOverrides !== undefined) return cachedOverrides;
  const raw = process.env.STATE_COMPLIANCE_POLICY_JSON;
  if (!raw) return (cachedOverrides = {});
  try {
    const parsed = JSON.parse(raw);
    return (cachedOverrides = parsed && typeof parsed === "object" ? parsed : {});
  } catch (error) {
    console.error("Invalid STATE_COMPLIANCE_POLICY_JSON; built-in policies will be used.", error.message);
    return (cachedOverrides = {});
  }
};

export function getStateCompliancePolicy(state) {
  const code = String(state || "").trim().toUpperCase();
  const overrides = readOverrides();
  return {
    state: code,
    ...DEFAULT_POLICY,
    ...(BUILT_IN_POLICIES[code] || {}),
    ...(overrides.DEFAULT || {}),
    ...(overrides[code] || {}),
  };
}

export function resetStateCompliancePolicyCacheForTests() {
  cachedOverrides = undefined;
}
