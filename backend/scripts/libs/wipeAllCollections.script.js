// scripts/wipeAllCollections.js
import "dotenv/config";
import mongoose from "mongoose";
import '../../models/index.js';

async function wipeAllCollections() {
  try {
    // Safety checks
    const VALID_ENVIRONMENTS = ["development", "staging", "production", "backup"];

    const env = (process.env.NODE_ENV || "development").toLowerCase();

    if (!VALID_ENVIRONMENTS.includes(env)) {
    console.error(
      `❌ ERROR: Invalid NODE_ENV "${env}". Expected one of: ${VALID_ENVIRONMENTS.join(", ")}`
    );
    process.exit(1); // Stop execution
  }
  
    const dbURIs = {
      development: process.env.MONGO_DEV_URI,
      staging: process.env.MONGO_STAGING_URI,
      production: process.env.MONGO_PROD_URI,
      backup: process.env.MONGO_BACKUP_URI,
    };
    if (env !== "development") {
      console.error("❌ Refusing to wipe: NODE_ENV is not 'development'.");
      process.exit(1);
    }
    if (process.env.CONFIRM_WIPE !== "true") {
      console.error("❌ Set CONFIRM_WIPE=true to proceed.");
      process.exit(1);
    }
    const uri = dbURIs[env];
    if (!uri) {
      console.error("❌ MONGO_URI missing in .env");
      process.exit(1);
    }

    await mongoose.connect(uri);

    // Get all model names registered with Mongoose
    const modelNames = mongoose.modelNames();
    
    console.log(`model names include: ${modelNames}`);

    console.log(
      `⚠️ Clearing all documents from ${modelNames.length} collections...`
    );
    for (const name of modelNames) {
      const Model = mongoose.model(name);
      try {
        const res = await Model.deleteMany({});
        console.log(`🧹 ${name}: deleted ${res.deletedCount} docs`);
      } catch (e) {
        console.error(`⚠️ Failed to clear ${name}: ${e.message}`);
      }
    }

    // Optionally: also drop any non-modeled collections (rare)
    // If you want to be absolutely thorough, uncomment:
    /*
    const collections = await mongoose.connection.db.listCollections().toArray();
    const known = new Set(modelNames.map(n => mongoose.model(n).collection.name));
    for (const col of collections) {
      if (!known.has(col.name)) {
        try {
          await mongoose.connection.db.collection(col.name).deleteMany({});
          console.log(`🧹 (extra) ${col.name}: deleted all docs`);
        } catch (e) {
          console.error(`⚠️ Failed to clear extra ${col.name}: ${e.message}`);
        }
      }
    }
    */

    console.log("✅ Wipe complete (per-collection).");
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("❌ Wipe error:", err);
    try {
      await mongoose.disconnect();
    } catch {}
    process.exit(1);
  }
}

wipeAllCollections();

