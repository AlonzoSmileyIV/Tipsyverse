// scripts/copy_all_drinks_to_default.js
import mongoose from "mongoose";
import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { DrinkModel as Drink } from "../../models/index.js";
import { copyDrinkPhotoToDefault } from "./copyToDefault.js";
import { getCurrentMongoURI } from "../../utils/libs/getMongoURI.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env (adjust path as needed)
dotenv.config({ path: path.resolve(__dirname, "../.env.development") });

// Cloudinary config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

async function run() {
  const uri = getCurrentMongoURI();
  if (!uri) throw new Error("No Mongo URI (MONGO_URI or MONGO_DEV_URI)");

  await mongoose.connect(uri);
  console.log("✔ Mongo connected");

  const cursor = Drink.find(
    { slug: { $type: "string", $ne: "" } },
    { _id: 1, slug: 1, photo: 1, photoPublicId: 1 }
  ).lean().cursor();

  let scanned = 0, copied = 0, skipped = 0, failed = 0;

  for await (const d of cursor) {
    scanned++;
    try {
      const r = await copyDrinkPhotoToDefault(d);
      if (r.ok && r.skipped) skipped++;
      else if (r.ok) copied++;
      else failed++;
    } catch (e) {
      failed++;
      console.error("copy failed:", e?.message || e);
    }
    if (scanned % 20 === 0) await sleep(200); // gentle throttle
  }

  console.log(`📊 scanned=${scanned}  copied=${copied}  skipped=${skipped}  failed=${failed}`);
  await mongoose.disconnect();
  console.log("🎉 done");
}

run().catch(e => {
  console.error("💥 script error:", e);
  process.exit(1);
});
