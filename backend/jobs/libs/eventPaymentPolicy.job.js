import cron from "node-cron";
import { EventModel as Event } from "../../models/index.js";
import { sendEmail, sendNotification } from "../../utils/index.js";
import { syncEventPaymentPolicy } from "../../utils/libs/syncEventPaymentPolicy.js";

const TZ = "America/Indiana/Indianapolis";
const appUrl = () =>
  process.env.PUBLIC_APP_URL || process.env.FRONTEND_URL || "http://localhost:3000";
const money = (value) => `$${(Number(value) || 0).toFixed(2)}`;
const eventUrl = (event) => `${appUrl()}/my-events/${event._id}/payments`;
const formatDate = (value, timeZone = "UTC") =>
  value
    ? new Intl.DateTimeFormat("en-US", {
        dateStyle: "long",
        timeStyle: "short",
        timeZone,
      }).format(new Date(value))
    : "as soon as possible";

const NOTICE_CONFIG = {
  firstReminderSentAt: {
    eligible: ({ status }) => ["due_soon", "due_now"].includes(status),
    subject: (event) => `Balance reminder for event ${event.shortCode}`,
    title: "Upcoming Event Balance",
    message: ({ balance, schedule }, event) =>
      `Your remaining balance of ${money(balance)} is due ${formatDate(
        schedule.dueAt,
        event.timezone || event.location?.timezone || "America/Indiana/Indianapolis"
      )}.`,
  },
  pastDueWarningSentAt: {
    eligible: ({ status, schedule }, now) =>
      ["due_now", "past_due", "payment_hold", "action_required"].includes(status) &&
      now >= schedule.pastDueWarningAt,
    subject: (event) => `Past-due event balance — ${event.shortCode}`,
    title: "Event Balance Past Due",
    message: ({ balance }) =>
      `Your remaining balance of ${money(balance)} is past due. Optional purchases and event changes are paused.`,
  },
  holdNoticeSentAt: {
    eligible: ({ status }) => ["payment_hold", "action_required"].includes(status),
    subject: (event) => `Payment hold placed on event ${event.shortCode}`,
    title: "Event on Payment Hold",
    message: ({ balance }) =>
      `Your event is on payment hold with ${money(balance)} remaining. Bartenders remain assigned, but final instructions and additional spending are paused.`,
  },
  actionRequiredNoticeSentAt: {
    eligible: ({ status }) => status === "action_required",
    subject: (event) => `Immediate payment action required — ${event.shortCode}`,
    title: "Payment Action Required",
    message: ({ balance }) =>
      `${money(balance)} remains unpaid. Tipsyverse staff must approve a documented payment arrangement or cancel the event.`,
  },
};

export const processEventPaymentPolicies = async ({ now = new Date() } = {}) => {
  const events = await Event.find({
    status: {
      $in: [
        "ready_to_assign",
        "bidding",
        "selecting",
        "confirmed",
        "reminder_sent",
        "in_progress",
      ],
    },
    startAt: { $gt: now },
    "payment.total": { $gt: 0 },
  })
    .select("shortCode organizer contact startAt timezone location.timezone payment status")
    .limit(500)
    .lean();

  let processed = 0;
  for (const event of events) {
    const result = await syncEventPaymentPolicy(event._id, { now });
    if (!result?.schedule || result.status === "paid" || result.status === "arrangement") {
      continue;
    }

    for (const [sentField, config] of Object.entries(NOTICE_CONFIG)) {
      if (event.payment?.[sentField] || !config.eligible(result, now)) continue;

      const message = config.message(result, event);
      if (event.contact?.email) {
        await sendEmail({
          to: event.contact.email,
          subject: config.subject(event),
          title: config.title,
          html: `
            <p>Hi ${event.contact.fullName || "there"},</p>
            <p>${message}</p>
            <p><strong>Event:</strong> ${event.shortCode}</p>
            <p><strong>Balance due date:</strong> ${formatDate(
              result.schedule.dueAt,
              event.timezone || event.location?.timezone || "America/Indiana/Indianapolis"
            )}</p>
            <p><a href="${eventUrl(event)}" class="button">View Event Payments</a></p>
          `,
        });
      }
      if (event.organizer) {
        await sendNotification({
          type: "system",
          entity: event._id,
          entityId: event._id,
          entityModel: "Event",
          recipients: [{ id: event.organizer }],
          slug: `my-events/${event._id}/payments`,
          messageBase: message,
        });
      }
      await Event.updateOne(
        { _id: event._id, [`payment.${sentField}`]: null },
        { $set: { [`payment.${sentField}`]: now } }
      );
      processed += 1;
    }
  }
  return processed;
};

const eventPaymentPolicyJob = () =>
  cron.schedule(
    "*/15 * * * *",
    async () => {
      const processed = await processEventPaymentPolicies();
      if (processed) console.log(`Payment policy notices processed: ${processed}`);
    },
    { timezone: TZ }
  );

export default eventPaymentPolicyJob;
