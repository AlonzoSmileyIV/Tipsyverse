import crypto from "crypto";
import mongoose from "mongoose";
import { logger } from "../../utils/libs/logger.js";
import { captureOperationalAlert } from "../../utils/libs/monitoring.js";

const OWNER_ID = `${process.pid}-${crypto.randomUUID()}`;
const LEASE_ID = "scheduled-jobs-leader";
const LEASE_MS = 90_000;
const RETRY_MS = 30_000;

export const startJobLeadership = (startJobs) => {
  let tasks = [];
  let leader = false;

  const stopTasks = () => {
    for (const task of tasks) task?.stop?.();
    tasks = [];
  };

  const attempt = async () => {
    if (mongoose.connection.readyState !== 1) return;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + LEASE_MS);
    try {
      const result = await mongoose.connection.db
        .collection("system_leases")
        .findOneAndUpdate(
          {
            _id: LEASE_ID,
            $or: [{ ownerId: OWNER_ID }, { expiresAt: { $lte: now } }],
          },
          { $set: { ownerId: OWNER_ID, expiresAt, updatedAt: now } },
          { upsert: true, returnDocument: "after" }
        );
      const acquired = result?.ownerId === OWNER_ID;
      if (acquired && !leader) {
        leader = true;
        tasks = startJobs().filter(Boolean);
        logger.info("scheduled_job_leadership_acquired", { ownerId: OWNER_ID });
      } else if (!acquired && leader) {
        leader = false;
        stopTasks();
        captureOperationalAlert("scheduled_job_leadership_lost", {
          ownerId: OWNER_ID,
        });
      }
    } catch (error) {
      // A duplicate-key race means another instance currently owns the lease.
      if (error?.code !== 11000) {
        logger.error("scheduled_job_lease_failed", { error, ownerId: OWNER_ID });
        captureOperationalAlert("scheduled_job_lease_failed", {
          ownerId: OWNER_ID,
          message: error?.message,
        });
      }
      if (leader) {
        leader = false;
        stopTasks();
      }
    }
  };

  void attempt();
  const timer = setInterval(attempt, RETRY_MS);
  timer.unref?.();

  return async () => {
    clearInterval(timer);
    stopTasks();
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.db
        .collection("system_leases")
        .deleteOne({ _id: LEASE_ID, ownerId: OWNER_ID });
    }
  };
};
