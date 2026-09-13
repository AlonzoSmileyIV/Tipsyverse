import { computeLicenseStatus } from "../index.js";
import { getPermitCompliance } from "./bartenderCompliance.js";


export function formatLicenseForResponse(user, license) {
  const compliance = getPermitCompliance(
    { bartenderProfile: { licenses: [license] } },
    license.state
  );
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
    serverTraining: license.serverTraining ? {
      provider: license.serverTraining.provider,
      completedAt: license.serverTraining.completedAt,
      certificateNumber: license.serverTraining.certificateNumber,
      status: license.serverTraining.status,
      verifiedAt: license.serverTraining.verifiedAt,
      verifiedBy: license.serverTraining.verifiedBy,
      decisionNote: license.serverTraining.decisionNote,
      hasVerificationDocument: Boolean(
        license.serverTraining.proofDocument?.fileId &&
        license.serverTraining.proofDocument?.uploadedAt &&
        Number(license.serverTraining.proofDocument?.size) > 0
      ),
      documentUploadedAt: license.serverTraining.proofDocument?.uploadedAt,
      attestedRequiredTraining: Boolean(license.serverTraining.attestedRequiredTraining),
    } : null,
    complianceStatus: compliance?.status || computeLicenseStatus(license),
    complianceReasons: compliance?.reasons || [],
    refresherDueAt: compliance?.refresherDueAt || null,
    verificationHistory: license.verificationHistory || [],
    createdAt: license.createdAt,
    updatedAt: license.updatedAt,
  };
}
