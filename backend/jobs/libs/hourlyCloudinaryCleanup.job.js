import cron from "node-cron";
import dotenv from "dotenv";
import { cloudinary } from "../../utils/index.js";
import {
  CourseModel as Course,
  DrinkModel as Drink,
  EventModel as Event,
  LiquorModel as Liquor,
  MixerModel as Mixer,
  SupportTicketModel as SupportTicket,
  UserModel as User,
} from "../../models/index.js";


const env = (process.env.NODE_ENV || "development").toLowerCase();

/**
 * Normalize publicId by stripping folder prefix and file extension.
 * e.g. "images/abc123.jpg" → "abc123"
 */
const normalizePublicId = (id) =>
  id?.split("/").pop().replace(/\.(jpg|jpeg|png|webp|mp4|mov|webm)$/i, "") || "";

const publicIdFromUrl = (url) => {
  if (!url || !String(url).includes("/upload/")) return "";
  const tail = String(url).split("/upload/")[1]?.replace(/^v\d+\//, "") || "";
  return decodeURIComponent(tail).replace(/\.[^.]+$/, "");
};

const addPublicId = (set, value) => {
  const normalized = normalizePublicId(value);
  if (normalized) set.add(normalized);
};

/**
 * Main cleanup function: deletes unused Cloudinary images/videos.
 */
const clearUnusedCloudinaryAssets = async () => {
  try {
    console.log("🔁 Starting unused Cloudinary cleanup...");

    // 1. Collect all used public IDs from MongoDB
    const [drinks, users, liquors, mixers, courses, tickets, events] = await Promise.all([
      Drink.find({}, "photoPublicId videoPublicId").lean(),
      User.find({}, "profile.photoPublicId").lean(),
      Liquor.find({}, "photoPublicId").lean(),
      Mixer.find({}, "photoPublicId").lean(),
      Course.find({}, "modules.sections.content.url modules.sections.content.publicId").lean(),
      SupportTicket.find({}, "attachments.publicId messages.attachments.publicId").lean(),
      Event.find({}, "payment.procurementReceiptProof").lean(),
    ]);

    const usedPublicIds = new Set();

    drinks.forEach((d) => {
      addPublicId(usedPublicIds, d.photoPublicId);
      addPublicId(usedPublicIds, d.videoPublicId);
    });

    users.forEach((u) => {
      const publicId = u?.profile?.photoPublicId;
      addPublicId(usedPublicIds, publicId);
    });
    liquors.forEach((item) => addPublicId(usedPublicIds, item.photoPublicId));
    mixers.forEach((item) => addPublicId(usedPublicIds, item.photoPublicId));
    courses.forEach((course) =>
      course.modules?.forEach((module) =>
        module.sections?.forEach((section) => {
          addPublicId(usedPublicIds, section.content?.publicId);
          addPublicId(usedPublicIds, publicIdFromUrl(section.content?.url));
        })
      )
    );
    tickets.forEach((ticket) => {
      ticket.attachments?.forEach((item) => addPublicId(usedPublicIds, item.publicId));
      ticket.messages?.forEach((message) =>
        message.attachments?.forEach((item) => addPublicId(usedPublicIds, item.publicId))
      );
    });
    events.forEach((event) =>
      addPublicId(
        usedPublicIds,
        publicIdFromUrl(event.payment?.procurementReceiptProof)
      )
    );

    // 2. Clean folders
await cleanFolder(`${env}/images`, usedPublicIds, "image");
await cleanFolder(`${env}/videos`, usedPublicIds, "video");

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
  return cron.schedule("0 * * * *", async () => {
    console.log("🧹 Hourly Cloudinary cleanup job triggered.");
    await clearUnusedCloudinaryAssets();
  });
};

export default hourlyCloudinaryCleanupJob;
