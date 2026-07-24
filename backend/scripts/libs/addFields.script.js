import mongoose from "mongoose";
import { UserModel as User } from "../../models/index.js";
// ======================= FUNCTION TO ADD FIELDS IMMEDIATELY =======================

export default async function addFieldsImmediately() {
  try {
    console.log("🔄 Adding fields...");

    //  const result = await User.updateMany(
    //   { "preferences.hasSeenTutorial": { $exists: false } }, // only users missing the field
    //   { $set: { "preferences.hasSeenTutorial": false } }
    // );


    //console.log(`✅ Added fields from ${result.modifiedCount} documents`);
  } catch (error) {
    console.error("❌ Error removing fields:", error);
  }
}