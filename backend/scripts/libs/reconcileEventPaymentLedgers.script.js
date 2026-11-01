import "dotenv/config";
import mongoose from "mongoose";
import connectDB from "../../config/db.js";
import { EventModel as Event } from "../../models/index.js";
import { syncEventPaymentPolicy } from "../../utils/libs/syncEventPaymentPolicy.js";

const environment = process.env.NODE_ENV || "development";

const run = async () => {
  await connectDB(environment);
  const cursor = Event.find({}).select("_id").lean().cursor();
  let synchronized = 0;

  for await (const event of cursor) {
    await syncEventPaymentPolicy(event._id);
    synchronized += 1;
  }

  await mongoose.disconnect();
  console.log(`Synchronized ${synchronized} event payment ledgers.`);
};

run().catch(async (error) => {
  console.error(error.message);
  await mongoose.disconnect().catch(() => {});
  process.exitCode = 1;
});
