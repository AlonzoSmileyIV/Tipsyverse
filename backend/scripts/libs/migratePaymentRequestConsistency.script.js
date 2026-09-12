import "dotenv/config";
import mongoose from "mongoose";
import { PaymentRequestModel as PaymentRequest } from "../../models/index.js";
import { ensureMongoIndex } from "../../utils/libs/ensureMongoIndex.js";

const uri =
  process.env.MONGO_MIGRATION_URI ||
  process.env.MONGO_STAGING_URI ||
  process.env.MONGO_DEV_URI;
if (!uri) throw new Error("Set MONGO_MIGRATION_URI to the database being migrated.");

await mongoose.connect(uri, { autoIndex: false });
try {
  const duplicates = await PaymentRequest.aggregate([
    { $match: { status: "sent" } },
    { $sort: { sentAt: -1, createdAt: -1 } },
    { $group: { _id: "$event", ids: { $push: "$_id" }, count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
  ]);

  for (const group of duplicates) {
    await PaymentRequest.updateMany(
      { _id: { $in: group.ids.slice(1) } },
      { $set: { status: "cancelled" } }
    );
  }

  const uniqueSentIndex = await ensureMongoIndex(
    PaymentRequest.collection,
    { event: 1 },
    {
      name: "one_sent_payment_request_per_event",
      unique: true,
      partialFilterExpression: { status: "sent" },
    }
  );
  const eventCreatedIndex = await ensureMongoIndex(
    PaymentRequest.collection,
    { event: 1, createdAt: -1 },
    { name: "payment_requests_by_event_created" }
  );
  console.log(
    JSON.stringify({
      eventsNormalized: duplicates.length,
      indexes: { uniqueSentIndex, eventCreatedIndex },
    })
  );
} finally {
  await mongoose.disconnect();
}
