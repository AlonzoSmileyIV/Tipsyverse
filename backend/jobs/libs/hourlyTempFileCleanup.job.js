import cron from "node-cron";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Deletes files older than the given threshold (in ms) in a directory
 */
const clearOldFiles = (
  targetFolder = "public/temp",
  maxAgeMs = 1000 * 60 * 60
) => {
  try {
    console.log("🔁 Starting old temp files cleanup...");

    const folderPath = path.join(__dirname, `../../${targetFolder}`);

    if (!fs.existsSync(folderPath)) return;

    const now = Date.now();
    const files = fs.readdirSync(folderPath);

    files.forEach((file) => {
      const filePath = path.join(folderPath, file);
      const stats = fs.statSync(filePath);

      if (now - stats.mtimeMs > maxAgeMs) {
        fs.unlinkSync(filePath);
        console.log(`🗑 Deleted old file: ${file}`);
      }
    });

    console.log("✅ Temp file cleanup complete.");
  } catch (error) {
    console.error("❌ Error during temp file cleanup:", err.message);
    console.error(err); // full error object for debugging
  }
};

/**
 * Schedules the cleanup of old temp files every hour
 */
const hourlyTempFileCleanupJob = () => {
  cron.schedule("0 * * * *", async () => {
    console.log("🧹 Hourly temp file cleanup job triggered.");
    clearOldFiles("public/temp", 1000 * 60 * 60); // 1 hour
  });
};

export default hourlyTempFileCleanupJob;
