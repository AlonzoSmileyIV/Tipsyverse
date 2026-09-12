import mongoose from "mongoose";

const authSessionSchema = new mongoose.Schema(
  {
    sessionId: { type: String, required: true, unique: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    currentTokenHash: { type: String, required: true, select: false },
    sessionStartedAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
    revokedAt: { type: Date, default: null },
    revokeReason: { type: String, default: "" },
    lastRotatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

authSessionSchema.index({ user: 1, revokedAt: 1, expiresAt: 1 });

export default mongoose.model("AuthSession", authSessionSchema);
