import hourlyTempFileCleanupJob from "./libs/hourlyTempFileCleanup.job.js";
import hourlyCloudinaryCleanupJob from "./libs/hourlyCloudinaryCleanup.job.js";
import dailyLicenseExpiryReminderJob from "./libs/dailyLicenseExpiryReminder.job.js";
import dailyDeactivatedCleanup from "./libs/dailyDeactivatedCleanup.job.js";
import tenMinuteBartender24hReminderJob from "./libs/tenMinuteBartender24hReminder.job.js";
import tenMinuteCustomer24hReminderJob from "./libs/tenMinuteCustomer24hReminder.job.js";
import tenMinuteCheckCompletedEventsJob from "./libs/tenMinuteCheckCompletedEvents.job.js";
import minuteEventClockInReminderJob from "./libs/minuteEventClockInReminder.job.js";
import { startJobLeadership } from "./libs/jobLeadership.js";
import emailOutboxRetryJob from "./libs/emailOutboxRetry.job.js";
import eventPaymentPolicyJob from "./libs/eventPaymentPolicy.job.js";

// This registry is the only place recurring jobs are enabled. Leadership wraps
// the initializers so horizontally scaled API instances do not perform the
// same scheduled work concurrently.
const initializeScheduledJobs = () => {
  if (process.env.JOBS_ENABLED === "false") {
    console.log("🕒 Scheduled jobs are disabled for this process.");
    return () => {};
  }

  return startJobLeadership(() => [
    dailyDeactivatedCleanup(),
    dailyLicenseExpiryReminderJob(),
    hourlyTempFileCleanupJob(),
    hourlyCloudinaryCleanupJob(),
    tenMinuteCheckCompletedEventsJob(),
    tenMinuteBartender24hReminderJob(),
    tenMinuteCustomer24hReminderJob(),
    minuteEventClockInReminderJob(),
    emailOutboxRetryJob(),
    eventPaymentPolicyJob(),
  ]);
};

export default initializeScheduledJobs;
