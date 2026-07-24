// scripts/immediate/removeFields.js
import mongoose from "mongoose";
import { ActivityLogModel as ActivityLog } from "../../models/index.js";
// import { PositionModel as Position } from "../../models/index.js";

export default async function removeFieldsImmediately() {
  try {
       console.log("🔄 Removing fields...");
       const result = await ActivityLog.deleteMany({});
       console.log(`✅ Removed fields from ${result.deletedCount} documents`);
  } catch (error) {
    console.error("❌ Error removing fields:", error);
  }
}