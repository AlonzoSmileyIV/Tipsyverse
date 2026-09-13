// scripts/libs/clearDatabase.script.js
import "dotenv/config";
import mongoose from "mongoose";

// NODE_ENV=development CONFIRM_CLEAR=true node scripts/libs/clearDatabase.script.js
// NODE_ENV=staging CONFIRM_CLEAR=true node scripts/libs/clearDatabase.script.js

const VALID_ENVS = ["development", "staging"];
const env = (process.env.NODE_ENV || "development").toLowerCase();

const dbURIs = {
  development: process.env.MONGO_DEV_URI,
  staging: process.env.MONGO_STAGING_URI,
};

if (!VALID_ENVS.includes(env)) {
  console.error(`❌ Refusing to clear database for NODE_ENV="${env}".`);
  console.error("Only development and staging are allowed.");
  process.exit(1);
}

if (process.env.CONFIRM_CLEAR !== "true") {
  console.error("❌ Refusing to clear database.");
  console.error("Run with CONFIRM_CLEAR=true to confirm.");
  process.exit(1);
}

const mongoUri = dbURIs[env];

if (!mongoUri) {
  console.error(`❌ Missing Mongo URI for ${env}`);
  process.exit(1);
}

try {
  await mongoose.connect(mongoUri);
  console.log(`✅ Connected to ${env} database`);

  const collections = await mongoose.connection.db.collections();

  for (const collection of collections) {
    await collection.deleteMany({});
    console.log(`🧹 Cleared ${collection.collectionName}`);
  }

  await mongoose.connection.db.collection("counters").deleteMany({});
  await mongoose.connection.db.collection("sequences").deleteMany({});
  console.log("🔢 Reset counters and sequences collection");

  await mongoose.disconnect();
  console.log(`✅ ${env} database cleared successfully`);
  process.exit(0);
} catch (error) {
  console.error("❌ Clear failed:", error);

  try {
    await mongoose.disconnect();
  } catch {}

  process.exit(1);
}