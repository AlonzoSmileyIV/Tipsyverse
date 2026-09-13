import "dotenv/config";
import mongoose from "mongoose";
import { getCurrentMongoURI } from "../../utils/libs/getMongoURI.js";

const environment = String(process.env.NODE_ENV || "").toLowerCase();
if (!["development", "staging", "production"].includes(environment)) {
  throw new Error("NODE_ENV must be development, staging, or production.");
}

const apply = process.env.APPLY_EVENT_TIMEZONE_MIGRATION === "true";
if (
  apply &&
  environment !== "development" &&
  process.env.CONFIRM_EVENT_TIMEZONE_MIGRATION !== environment
) {
  throw new Error(
    `Set CONFIRM_EVENT_TIMEZONE_MIGRATION=${environment} after taking and verifying a backup.`
  );
}

const fallbackTimezone =
  process.env.LEGACY_EVENT_TIMEZONE || "America/Indiana/Indianapolis";
new Intl.DateTimeFormat("en-US", { timeZone: fallbackTimezone }).format(
  new Date()
);

await mongoose.connect(getCurrentMongoURI(environment));
const events = mongoose.connection.db.collection("events");
const missingFilter = {
  $or: [
    { timezone: { $exists: false } },
    { timezone: null },
    { timezone: "" },
    { "location.timezone": { $exists: false } },
    { "location.timezone": null },
    { "location.timezone": "" },
  ],
};
const matched = await events.countDocuments(missingFilter);
let modified = 0;

if (apply && matched) {
  const result = await events.updateMany(missingFilter, [
    {
      $set: {
        timezone: {
          $cond: [
            { $gt: [{ $strLenCP: { $ifNull: ["$timezone", ""] } }, 0] },
            "$timezone",
            {
              $cond: [
                { $gt: [{ $strLenCP: { $ifNull: ["$location.timezone", ""] } }, 0] },
                "$location.timezone",
                fallbackTimezone,
              ],
            },
          ],
        },
        "location.timezone": {
          $cond: [
            { $gt: [{ $strLenCP: { $ifNull: ["$location.timezone", ""] } }, 0] },
            "$location.timezone",
            {
              $cond: [
                { $gt: [{ $strLenCP: { $ifNull: ["$timezone", ""] } }, 0] },
                "$timezone",
                fallbackTimezone,
              ],
            },
          ],
        },
      },
    },
  ]);
  modified = result.modifiedCount;
}

console.log(
  JSON.stringify(
    { environment, apply, fallbackTimezone, matched, modified },
    null,
    2
  )
);
await mongoose.disconnect();
