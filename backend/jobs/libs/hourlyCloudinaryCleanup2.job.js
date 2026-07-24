import cron from "node-cron";
import { cloudinary } from "../../utils/index.js";
import { DrinkModel as Drink, UserModel as User } from "../../models/index.js";

/**
 * Normalize publicId by stripping folder prefix and file extension.
 * e.g. "images/abc123.jpg" → "abc123"
 */
const normalizePublicId = (id) =>
  id?.split("/").pop().replace(/\.(jpg|jpeg|png|webp|mp4|mov|webm)$/i, "") || "";

/**
 * Main cleanup function: deletes unused Cloudinary images/videos.
 */
const clearUnusedCloudinaryAssets = async () => {
  try {
    console.log("🔁 Starting unused Cloudinary cleanup...");

    // 1. Collect all used public IDs from MongoDB
    const [drinks, users] = await Promise.all([
      Drink.find({}, "photoPublicId videoPublicId").lean(),
      User.find({}, "profile.photoPublicId").lean(),
    ]);

    const usedPublicIds = new Set();

    drinks.forEach((d) => {
      if (d.photoPublicId) usedPublicIds.add(normalizePublicId(d.photoPublicId));
      if (d.videoPublicId) usedPublicIds.add(normalizePublicId(d.videoPublicId));
    });

    users.forEach((u) => {
      const publicId = u?.profile?.photoPublicId;
      if (publicId) usedPublicIds.add(normalizePublicId(publicId));
    });

    // 2. Clean folders
    await cleanFolder("images", usedPublicIds, "image");
    await cleanFolder("videos", usedPublicIds, "video");

    console.log("✅ Cloudinary cleanup complete.");
  } catch (err) {
    console.error("❌ Error during Cloudinary cleanup:", err.message);
    console.error(err); // full error object for debugging
  }
};

/**
 * Deletes unused assets from a Cloudinary folder.
 */
const cleanFolder = async (prefix, usedPublicIds, resourceType) => {
  let nextCursor = null;

  do {
    const result = await cloudinary.api.resources({
      type: "upload",
      prefix,
      max_results: 500,
      next_cursor: nextCursor || undefined,
      resource_type: resourceType,
    });

    for (const resource of result.resources) {
      const publicId = resource.public_id;

      // Skip default system assets
      if (
        publicId.startsWith("default/") ||
        publicId.includes("/default/")
      ) {
        continue;
      }

      // Skip very recent uploads (within 15 minutes)
      const createdAt = new Date(resource.created_at);
      const now = new Date();
      const diffMinutes = (now - createdAt) / 1000 / 60;
      if (diffMinutes < 15) {
        console.log(`⏳ Skipping recent asset: ${publicId}`);
        continue;
      }

      const normalizedId = normalizePublicId(publicId);
      if (!usedPublicIds.has(normalizedId)) {
        await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
        console.log(`🗑 Deleted unused ${resourceType}: ${publicId}`);
      }
    }

    nextCursor = result.next_cursor;
  } while (nextCursor);
};

/**
 * Schedules the cleanup of unused images and videos
 */
const hourlyCloudinaryCleanupJob = () => {
  cron.schedule("0 * * * *", async () => {
    console.log("🧹 Hourly Cloudinary cleanup job triggered.");
    await clearUnusedCloudinaryAssets();
  });
};

export default hourlyCloudinaryCleanupJob;
