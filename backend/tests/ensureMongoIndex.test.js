import test from "node:test";
import assert from "node:assert/strict";
import { ensureMongoIndex } from "../utils/libs/ensureMongoIndex.js";

test("reuses an equivalent index even when its name differs", async () => {
  let createCalls = 0;
  const collection = {
    indexes: async () => [
      { name: "event_1_createdAt_-1", key: { event: 1, createdAt: -1 } },
    ],
    createIndex: async () => {
      createCalls += 1;
    },
  };

  const result = await ensureMongoIndex(
    collection,
    { event: 1, createdAt: -1 },
    { name: "payment_requests_by_event_created" }
  );

  assert.deepEqual(result, {
    name: "event_1_createdAt_-1",
    created: false,
  });
  assert.equal(createCalls, 0);
});

test("creates an index when no equivalent definition exists", async () => {
  const collection = {
    indexes: async () => [],
    createIndex: async (keys, options) => {
      assert.deepEqual(keys, { event: 1 });
      assert.equal(options.unique, true);
      return options.name;
    },
  };

  const result = await ensureMongoIndex(
    collection,
    { event: 1 },
    {
      name: "one_sent_payment_request_per_event",
      unique: true,
      partialFilterExpression: { status: "sent" },
    }
  );

  assert.deepEqual(result, {
    name: "one_sent_payment_request_per_event",
    created: true,
  });
});
