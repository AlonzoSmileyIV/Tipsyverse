import "dotenv/config";
import mongoose from "mongoose";
import { getCurrentMongoURI } from "../../utils/libs/getMongoURI.js";
import { storeComplianceDocument } from "../../utils/libs/complianceDocumentStore.js";

const environment = String(process.env.NODE_ENV || "").toLowerCase();
if (!["development", "staging", "production"].includes(environment)) {
  throw new Error("NODE_ENV must be development, staging, or production.");
}
const apply = process.env.APPLY_COMPLIANCE_MIGRATION === "true";
if (apply && environment !== "development" && process.env.CONFIRM_COMPLIANCE_MIGRATION !== environment) {
  throw new Error(`Set CONFIRM_COMPLIANCE_MIGRATION=${environment} after taking and verifying a backup.`);
}

await mongoose.connect(getCurrentMongoURI(environment));
const users = mongoose.connection.db.collection("users");
const cursor = users.find({ "bartenderProfile.licenses.0": { $exists: true } });
const now = new Date();
const summary = { environment, apply, users: 0, licenses: 0, grandfathered: 0, documentsMoved: 0 };

for await (const user of cursor) {
  summary.users++;
  for (const license of user.bartenderProfile?.licenses || []) {
    summary.licenses++;
    const training = license.serverTraining || {};
    const proof = training.proofDocument || {};
    const set = {};
    const unset = {};
    const activeVerified = license.verified === true && license.status === "active" &&
      (!license.expiresAt || new Date(license.expiresAt) > now);

    if (activeVerified && (!training.attestedAuthenticAndCurrent ||
        !training.attestedRequiredTraining) && !training.legacyComplianceGrandfatheredAt) {
      set["bartenderProfile.licenses.$[license].serverTraining.legacyComplianceGrandfatheredAt"] = now;
      summary.grandfathered++;
    }

    if (proof.data && !proof.fileId) {
      summary.documentsMoved++;
      if (apply) {
        const raw = Buffer.isBuffer(proof.data) ? proof.data : Buffer.from(proof.data.buffer || proof.data);
        const fileId = await storeComplianceDocument({
          buffer: raw,
          mimeType: proof.mimeType || "application/octet-stream",
          ownerId: user._id,
          licenseId: license._id,
        });
        set["bartenderProfile.licenses.$[license].serverTraining.proofDocument.fileId"] = fileId;
        set["bartenderProfile.licenses.$[license].serverTraining.proofDocument.size"] = raw.length;
        set["bartenderProfile.licenses.$[license].serverTraining.proofDocument.uploadedAt"] = proof.uploadedAt || now;
        unset["bartenderProfile.licenses.$[license].serverTraining.proofDocument.data"] = "";
      }
    }

    if (apply && (Object.keys(set).length || Object.keys(unset).length)) {
      const update = {};
      if (Object.keys(set).length) update.$set = set;
      if (Object.keys(unset).length) update.$unset = unset;
      await users.updateOne({ _id: user._id }, update, { arrayFilters: [{ "license._id": license._id }] });
    }
  }
}

console.log(JSON.stringify(summary, null, 2));
await mongoose.disconnect();
