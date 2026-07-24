import hourlyTempFileCleanupJob from "./libs/hourlyTempFileCleanup.job.js";
import hourlyCloudinaryCleanupJob from "./libs/hourlyCloudinaryCleanup.job.js";
import dailyLicenseExpiryReminderJob from "./libs/dailyLicenseExpiryReminder.job.js";
import dailyDeactivatedCleanup from "./libs/dailyDeactivatedCleanup.job.js";
import tenMinuteBartender24hReminderJob from "./libs/tenMinuteBartender24hReminder.job.js";
import tenMinuteCustomer24hReminderJob from "./libs/tenMinuteCustomer24hReminder.job.js";
import tenMinuteCheckCompletedEventsJob from "./libs/tenMinuteCheckCompletedEvents.job.js";
import minuteEventClockInReminderJob from "./libs/minuteEventClockInReminder.job.js";

// use https://crontab.cronhub.io to view expression correctly.

const initializeScheduledJobs = () => {
  console.log("🕒 Initializing all scheduled jobs...");

  // 🗓️ Yearly

  // 🗂️ Quarterly

  // 📦 Monthly

  // 🔁 Weekly
 

  // 📬 Daily
  dailyDeactivatedCleanup(); // Every day at 12:00am UTC
  dailyLicenseExpiryReminderJob(); // Everyday at 9:00am EST.

  // 🧹 Hourly
  hourlyTempFileCleanupJob(); // Every single hour 0 minutes past the hour
  hourlyCloudinaryCleanupJob(); // Every single hour 0 minutes past the hour

  // Every 10 minutes
  tenMinuteCheckCompletedEventsJob();

  // Every 15 minutes
  tenMinuteBartender24hReminderJob();
  tenMinuteCustomer24hReminderJob();

  // 🧹 Every minute
  minuteEventClockInReminderJob();
};

export default initializeScheduledJobs;
