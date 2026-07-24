import { computeLicenseStatus } from "../index.js";


export function formatLicenseForResponse(user, license) {
  return {
    id: license._id,
    userId: user?._id,
    fullName: user?.fullName,
    email: user?.email,
    state: license.state,
    permitNumber: license.permitNumber,
    expiresAt: license.expiresAt,
    verified: license.verified,
    status: computeLicenseStatus(license),
    decisionNote: license.decisionNote || "",
    createdAt: license.createdAt,
    updatedAt: license.updatedAt,
  };
}
