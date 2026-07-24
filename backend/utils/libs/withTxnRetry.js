// utils/withTxnRetry.js
import mongoose from "mongoose";

export async function withTxnRetry(work, { maxRetries = 5, baseDelayMs = 100 } = {}) {
  let attempt = 0;
  while (true) {
    const session = await mongoose.startSession();
    try {
      let result;
      await session.withTransaction(async () => {
        result = await work(session);
      });
      session.endSession();
      return result;
    } catch (err) {
      const isWriteConflict =
        err?.code === 112 ||
        err?.codeName === "WriteConflict" ||
        err?.errorResponse?.errorLabels?.includes?.("TransientTransactionError");

      await session.abortTransaction().catch(() => {});
      session.endSession();

      if (!isWriteConflict || attempt >= maxRetries) throw err;
      // Exponential backoff
      await new Promise(r => setTimeout(r, baseDelayMs * Math.pow(2, attempt)));
      attempt++;
    }
  }
}
