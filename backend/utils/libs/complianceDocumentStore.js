import mongoose from "mongoose";

const BUCKET_NAME = "compliance_documents";
const bucket = () => {
  if (!mongoose.connection.db) throw new Error("MongoDB is not connected.");
  return new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: BUCKET_NAME });
};

export async function storeComplianceDocument({ buffer, mimeType, ownerId, licenseId }) {
  const fileId = new mongoose.Types.ObjectId();
  await new Promise((resolve, reject) => {
    const stream = bucket().openUploadStreamWithId(fileId, "verification-document", {
      contentType: mimeType,
      metadata: {
        ownerId: new mongoose.Types.ObjectId(ownerId),
        licenseId: new mongoose.Types.ObjectId(licenseId),
        purpose: "bartender_compliance",
      },
    });
    stream.once("error", reject);
    stream.once("finish", resolve);
    stream.end(buffer);
  });
  return fileId;
}

export async function readComplianceDocument(fileId) {
  if (!mongoose.isValidObjectId(fileId)) return null;
  const files = await bucket().find({ _id: new mongoose.Types.ObjectId(fileId) }).limit(1).toArray();
  const file = files[0];
  if (!file) return null;
  const chunks = [];
  await new Promise((resolve, reject) => {
    const stream = bucket().openDownloadStream(file._id);
    stream.on("data", (chunk) => chunks.push(chunk));
    stream.once("error", reject);
    stream.once("end", resolve);
  });
  return {
    buffer: Buffer.concat(chunks),
    mimeType: file.contentType || "application/octet-stream",
    size: file.length,
  };
}

export async function deleteComplianceDocument(fileId) {
  if (!mongoose.isValidObjectId(fileId)) return false;
  try {
    await bucket().delete(new mongoose.Types.ObjectId(fileId));
    return true;
  } catch (error) {
    if (error?.code === "ENOENT" || /FileNotFound/i.test(error?.name || "")) return false;
    throw error;
  }
}

export { BUCKET_NAME as COMPLIANCE_DOCUMENT_BUCKET };
