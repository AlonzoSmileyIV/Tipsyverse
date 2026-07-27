import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { startJobLeadership } from "../jobs/libs/jobLeadership.js";

test("scheduled jobs stop when a lease is lost and can be cleanly released", async () => {
  const originalReadyState = mongoose.connection.readyState;
  const originalDb = mongoose.connection.db;
  const originalSetInterval = global.setInterval;
  const originalClearInterval = global.clearInterval;
  let renewal;
  let ownsLease = true;
  let starts = 0;
  let stops = 0;
  let released = false;

  global.setInterval = (callback) => {
    renewal = callback;
    return { unref() {} };
  };
  global.clearInterval = () => {};
  Object.defineProperty(mongoose.connection, "readyState", {
    configurable: true,
    value: 1,
  });
  mongoose.connection.db = {
    collection() {
      return {
        async findOneAndUpdate(_filter, update) {
          return {
            ownerId: ownsLease ? update.$set.ownerId : "another-instance",
          };
        },
        async deleteOne() {
          released = true;
        },
      };
    },
  };

  try {
    const shutdown = startJobLeadership(() => {
      starts += 1;
      return [{ stop: () => { stops += 1; } }];
    });
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(starts, 1);

    ownsLease = false;
    await renewal();
    assert.equal(stops, 1);

    await shutdown();
    assert.equal(released, true);
  } finally {
    global.setInterval = originalSetInterval;
    global.clearInterval = originalClearInterval;
    mongoose.connection.db = originalDb;
    Object.defineProperty(mongoose.connection, "readyState", {
      configurable: true,
      value: originalReadyState,
    });
  }
});
