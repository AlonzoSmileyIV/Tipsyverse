import mongoose from "mongoose";

const emailOutboxSchema = new mongoose.Schema(
  {
    payload: { type: mongoose.Schema.Types.Mixed, required: true },
    attempts: { type: Number, default: 0 },
    nextAttemptAt: { type: Date, default: Date.now, index: true },
    lastError: { type: String, default: "" },
    status: {
      type: String,
      enum: ["pending", "sending", "sent", "failed"],
      default: "pending",
      index: true,
    },
    sentAt: { type: Date, default: null },
  },
  { timestamps: true }
);

emailOutboxSchema.index({ status: 1, nextAttemptAt: 1 });
const retentionDays = Number(process.env.EMAIL_OUTBOX_RETENTION_DAYS || 30);
if (Number.isFinite(retentionDays) && retentionDays > 0) {
  emailOutboxSchema.index(
    { sentAt: 1 },
    {
      expireAfterSeconds: Math.round(retentionDays * 24 * 60 * 60),
      partialFilterExpression: { status: "sent" },
    }
  );
}

export default mongoose.model("EmailOutbox", emailOutboxSchema);
