import cron from "node-cron";
import { EmailOutboxModel as EmailOutbox } from "../../models/index.js";
import sendEmail from "../../utils/libs/sendEmail.js";
import { captureOperationalAlert } from "../../utils/libs/monitoring.js";
import { logger } from "../../utils/libs/logger.js";

const MAX_ATTEMPTS = 8;

export const processEmailOutbox = async () => {
  const due = await EmailOutbox.find({
    status: "pending",
    nextAttemptAt: { $lte: new Date() },
    attempts: { $lt: MAX_ATTEMPTS },
  })
    .sort({ nextAttemptAt: 1 })
    .limit(50);

  for (const item of due) {
    const claimed = await EmailOutbox.findOneAndUpdate(
      { _id: item._id, status: "pending" },
      { $set: { status: "sending" }, $inc: { attempts: 1 } },
      { new: true }
    );
    if (!claimed) continue;
    const result = await sendEmail({ ...claimed.payload, queueOnFailure: false });
    if (result.success) {
      claimed.status = "sent";
      claimed.sentAt = new Date();
    } else {
      claimed.status = claimed.attempts >= MAX_ATTEMPTS ? "failed" : "pending";
      claimed.lastError = result.message;
      claimed.nextAttemptAt = new Date(
        Date.now() + Math.min(6 * 60 * 60 * 1000, 2 ** claimed.attempts * 60_000)
      );
    }
    await claimed.save();
  }

  const failedCount = await EmailOutbox.countDocuments({ status: "failed" });
  const overdueCount = await EmailOutbox.countDocuments({
    status: "pending",
    nextAttemptAt: { $lt: new Date(Date.now() - 15 * 60 * 1000) },
  });
  if (failedCount || overdueCount) {
    logger.warn("email_outbox_backlog", { failedCount, overdueCount });
    captureOperationalAlert("email_outbox_backlog", {
      failedCount,
      overdueCount,
    });
  }
};

export default function emailOutboxRetryJob() {
  return cron.schedule("*/5 * * * *", processEmailOutbox);
}
