import "dotenv/config";
import mongoose from "mongoose";
import connectDB from "../../config/db.js";
import { PaymentMethodModel as PaymentMethod } from "../../models/index.js";

const environment = process.env.NODE_ENV || "development";

const run = async () => {
  await connectDB(environment);
  const methods = await PaymentMethod.find({}).select("nickname nicknameKey owner");
  const seen = new Set();
  for (const method of methods) {
    const nickname = String(method.nickname || "").trim();
    if (!nickname) {
      throw new Error(`Payment method ${method._id} has no nickname; resolve it before migration.`);
    }
    const nicknameKey = nickname.toLocaleLowerCase("en-US");
    const key = `${method.owner}:${nicknameKey}`;
    if (seen.has(key)) {
      throw new Error(`Duplicate case-insensitive payment method nickname for owner ${method.owner}.`);
    }
    seen.add(key);
    method.nickname = nickname;
    method.nicknameKey = nicknameKey;
    await method.save({ validateBeforeSave: false });
  }

  const collection = PaymentMethod.collection;
  const indexes = await collection.indexes();
  const legacy = indexes.find(
    (index) => index.key?.owner === 1 && index.key?.nickname === 1
  );
  if (legacy) await collection.dropIndex(legacy.name);
  await PaymentMethod.syncIndexes();
  await mongoose.disconnect();
  console.log(`Migrated ${methods.length} payment methods.`);
};

run().catch(async (error) => {
  console.error(error.message);
  await mongoose.disconnect().catch(() => {});
  process.exitCode = 1;
});
