// scripts/patch_user_photo_urls.js
import mongoose from "mongoose";
import dotenv from "dotenv";
import {
  DrinkModel as Drink,
  NotificationModel as Notification,
  CommentModel as Comment,
} from "../../models/index.js";

dotenv.config({ path: "backend/.env.development" }); // adjust as needed

export default async function updateFieldsImmediately() {
  try {
    console.log(
      "🔄 Updating all drinks to have no comments, have analytics.counts.comments be 0, empty out analytics.userComments, and delete all comments..."
    );

    console.log("🧹 Deleting ALL comments…");
    const del = await Comment.deleteMany({});
    console.log(`   • deleted ${del.deletedCount ?? 0} comment(s)`);

    console.log(
      "🧮 Zeroing comment counters & clearing top-level refs on ALL drinks…"
    );
    const upd = await Drink.updateMany(
      {},
      {
        $set: {
          "analytics.counts.comments": 0,
          "analytics.userComments": [],
        },
      }
    );
    console.log(
      `   • matched: ${upd.matchedCount ?? upd.n ?? 0}, modified: ${upd.modifiedCount ?? upd.nModified ?? 0}`
    );

    // OPTIONAL: If you have notifications that reference comments, you may want to clean them up too:
    const notifDel = await Notification.deleteMany({
      comment: { $exists: true },
    });
    console.log(
      `   • deleted ${notifDel.deletedCount ?? 0} notification(s) that referenced comments`
    );

    console.log("✅ Done.");

    console.log("🎉 Done.");
    console.log("🎉 Done.");
  } catch (error) {
    console.error("❌ Error updating user photo fields:", error);
  }
}
