import { getStateCompliancePolicy } from "./stateCompliancePolicy.js";

const STATE_CODES = {
  ALABAMA:"AL", ALASKA:"AK", ARIZONA:"AZ", ARKANSAS:"AR", CALIFORNIA:"CA", COLORADO:"CO",
  CONNECTICUT:"CT", DELAWARE:"DE", FLORIDA:"FL", GEORGIA:"GA", HAWAII:"HI", IDAHO:"ID",
  ILLINOIS:"IL", INDIANA:"IN", IOWA:"IA", KANSAS:"KS", KENTUCKY:"KY", LOUISIANA:"LA",
  MAINE:"ME", MARYLAND:"MD", MASSACHUSETTS:"MA", MICHIGAN:"MI", MINNESOTA:"MN",
  MISSISSIPPI:"MS", MISSOURI:"MO", MONTANA:"MT", NEBRASKA:"NE", NEVADA:"NV",
  "NEW HAMPSHIRE":"NH", "NEW JERSEY":"NJ", "NEW MEXICO":"NM", "NEW YORK":"NY",
  "NORTH CAROLINA":"NC", "NORTH DAKOTA":"ND", OHIO:"OH", OKLAHOMA:"OK", OREGON:"OR",
  PENNSYLVANIA:"PA", "RHODE ISLAND":"RI", "SOUTH CAROLINA":"SC", "SOUTH DAKOTA":"SD",
  TENNESSEE:"TN", TEXAS:"TX", UTAH:"UT", VERMONT:"VT", VIRGINIA:"VA", WASHINGTON:"WA",
  "WEST VIRGINIA":"WV", WISCONSIN:"WI", WYOMING:"WY", "DISTRICT OF COLUMBIA":"DC",
};
const normalizeState = (value) => {
  const normalized = String(value || "").trim().toUpperCase();
  return STATE_CODES[normalized] || normalized;
};

export const isIndianaEvent = (event) =>
  normalizeState(event?.location?.state) === "IN";

export function getPermitCompliance(user, eventState, now = new Date()) {
  const licenses = user?.bartenderProfile?.licenses || [];
  const requiredState = normalizeState(eventState);
  const policy = getStateCompliancePolicy(requiredState);
  const license = licenses.find((item) => normalizeState(item?.state) === requiredState);
  const reasons = [];
  if (!requiredState) return { eligible: false, status: "pending", reasons: ["Event state is missing."] };
  if (!license) {
    if (!policy.permitRequired && !policy.trainingAttestationRequired && !policy.adminReviewRequired) {
      return { eligible: true, status: "verified", reasons: [], policy };
    }
    return { eligible: false, status: "pending", reasons: [`A ${requiredState} compliance record is missing.`], policy };
  }

  const permitExpired = !license.expiresAt || new Date(license.expiresAt) <= now;
  const training = license.serverTraining || {};
  const grandfathered = Boolean(training.legacyComplianceGrandfatheredAt);
  if (policy.permitRequired && !String(license.permitNumber || "").trim()) reasons.push(`${requiredState} permit number is required.`);
  if (policy.permitRequired && permitExpired) reasons.push(`${requiredState} permit is missing or expired.`);
  if (license.expiresAt && new Date(license.expiresAt) <= now) reasons.push(`${requiredState} compliance record is expired.`);
  if (policy.adminReviewRequired && (!license.verified || license.status !== "active")) reasons.push(`${requiredState} compliance record has not been verified.`);
  if (!training.attestedAuthenticAndCurrent && !grandfathered) reasons.push("Permit-information attestation is required.");
  if (policy.trainingAttestationRequired && !training.attestedRequiredTraining && !grandfathered) reasons.push("Required server-training confirmation is missing.");

  const rejected = license.status === "denied" || training.status === "rejected";
  const expired =
    (policy.permitRequired && permitExpired) ||
    (license.expiresAt && new Date(license.expiresAt) <= now) ||
    license.status === "expired";
  return {
    eligible: reasons.length === 0,
    status: rejected ? "rejected" : expired ? "expired" : reasons.length ? "pending" : "verified",
    reasons: [...new Set(reasons)],
    refresherDueAt: null,
    license,
    policy,
  };
}

export const getIndianaCompliance = (user, now = new Date()) =>
  getPermitCompliance(user, "IN", now);

export function assertBartendersCompliantForEvent({ event, bartenders }) {
  const failures = bartenders
    .map((bartender) => ({ bartender, result: getPermitCompliance(bartender, event?.location?.state) }))
    .filter(({ result }) => !result.eligible);
  if (failures.length) {
    const names = failures.map(({ bartender }) => bartender.fullName || bartender.email || bartender._id).join(", ");
    const error = new Error(`Cannot assign ${names}: a permit matching the event state must be current and verified, and required server training must be confirmed.`);
    error.statusCode = 409;
    error.code = "STATE_PERMIT_COMPLIANCE_REQUIRED";
    error.details = failures.map(({ bartender, result }) => ({ bartenderId: bartender._id, reasons: result.reasons }));
    throw error;
  }
}
