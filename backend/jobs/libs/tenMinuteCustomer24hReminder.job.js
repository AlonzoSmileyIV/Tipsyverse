import cron from "node-cron";
import { EventModel as Event, AssignmentModel as Assignment } from "../../models/index.js";
import { sendEmail } from "../../utils/index.js";

const TZ = "America/Indiana/Indianapolis";

function safeStr(v) {
  return String(v || "").trim();
}

function eventAddress(loc = {}) {
  return (
    loc?.formatted ||
    [loc?.address1, loc?.address2, loc?.city, loc?.state, loc?.zipcode]
      .filter(Boolean)
      .join(", ")
  );
}

function googleMapsLinkFromEventLocation(loc = {}) {
  const address = eventAddress(loc);
  return address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
    : null;
}

function formatWhen(evt, timeZone = TZ) {
  const s = new Date(evt.startAt);
  const e = new Date(evt.endAt);
  const dateFmt = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone,
  });
  const timeFmt = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  });
  return `${dateFmt.format(s)} • ${timeFmt.format(s)} → ${timeFmt.format(e)} (${timeZone})`;
}

function buildCustomer24hEmail({ evt, bartenders }) {
  const whereText = eventAddress(evt.location);

  const mapsLink = googleMapsLinkFromEventLocation(evt.location);

  const subject = `Reminder: Your event is in 24 hours (${evt.shortCode || evt._id})`;
  const title = `24-hour Event Reminder`;

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.45;">
      <h2 style="margin:0 0 8px;">24-hour Reminder</h2>
      <p style="margin:0 0 12px;">Hi ${safeStr(evt.contact?.fullName || "there")},</p>

      <div style="padding:12px;border:1px solid #ddd;border-radius:10px;">
        <p style="margin:0 0 6px;"><b>Event:</b> ${safeStr(evt.shortCode || evt._id)}</p>
        <p style="margin:0 0 6px;"><b>When:</b> ${formatWhen(evt)}</p>
        <p style="margin:0 0 6px;"><b>Where:</b> ${
          mapsLink
            ? `<a href="${mapsLink}" target="_blank" rel="noopener noreferrer">${whereText}</a>`
            : whereText || "—"
        }</p>
      </div>

      <h3 style="margin:16px 0 6px;">Assigned bartender(s)</h3>
      ${
        bartenders.length
          ? `
            <ul style="margin:0;padding-left:18px;">
              ${bartenders
                .map(
                  (b) =>
                    `<li><b>${safeStr(b.fullName || b.name)}</b> • ${safeStr(b.phone || "—")} • ${safeStr(
                      b.email || "—"
                    )}</li>`
                )
                .join("")}
            </ul>
          `
          : `<p style="margin:0;">We’ll share bartender info once assigned.</p>`
      }

      <p style="margin-top:16px;">— Tipsyverse</p>
    </div>
  `;

  const text = [
    `24-hour Reminder`,
    `Event: ${evt.shortCode || evt._id}`,
    `When: ${formatWhen(evt)}`,
    `Where: ${whereText || "—"}`,
    `Bartenders:`,
    ...(bartenders.length
      ? bartenders.map((b) => `- ${safeStr(b.fullName || b.name)} • ${safeStr(b.phone || "—")} • ${safeStr(b.email || "—")}`)
      : [`- Not assigned yet`]),
  ]
    .filter(Boolean)
    .join("\n");

  return { subject, title, html, text };
}

async function sendCustomer24hReminders() {
  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const events = await Event.find({
    status: { $in: ["confirmed", "ready_to_assign", "reminder_sent", "in_progress"] },
    startAt: { $gt: now, $lte: in24h },
    customer24hReminderSentAt: null,
    "contact.email": { $exists: true, $ne: "" },
  })
    .limit(200)
    .lean();

  let processed = 0;

  for (const evt of events) {
    const assigns = await Assignment.find({
      event: evt._id,
      status: { $in: ["active", "assigned"] },
    })
      .populate({ path: "bartenderUser", select: "fullName name email phone" })
      .lean();

    const bartenders = assigns.map((a) => a.bartenderUser).filter(Boolean);

    const { subject, title, html, text } = buildCustomer24hEmail({ evt, bartenders });

    await sendEmail({
      to: evt.contact.email,
      subject,
      title,
      html,
      text,
    });

    await Event.updateOne(
      { _id: evt._id, customer24hReminderSentAt: null },
      { $set: { customer24hReminderSentAt: new Date() } }
    );

    processed++;
  }

  console.log(`✅ Customer 24h reminders sent for events: ${processed}`);
}

const tenMinuteCustomer24hReminderJob = () => {
  return cron.schedule(
    "*/15 * * * *",
    async () => {
      console.log(`⏱️ Customer 24h reminder job triggered.`);
      await sendCustomer24hReminders();
    },
    { timezone: TZ }
  );
};

export default tenMinuteCustomer24hReminderJob;
