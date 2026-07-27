import cron from "node-cron";
import { EventModel as Event, AssignmentModel as Assignment } from "../../models/index.js";
import { sendEmail } from "../../utils/index.js";

const TZ = "America/Indiana/Indianapolis";

const BAR_TYPE_LABEL = {
  full_bar: "Full Bar",
  beer_wine: "Beer & Wine",
  cocktail_bar: "Cocktail Bar",
  signature_cocktail: "Signature Cocktail Bar",
  open_bar: "Open Bar",
  cash_bar: "Cash Bar",
  non_alcoholic: "Mocktail / Non-Alcoholic",
  unknown: "Unknown",
};

function money(n) {
  return `$${(Number(n) || 0).toFixed(2)}`;
}

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

function buildBartender24hEmail({ evt, bartender, assignedBartenders }) {
  const barType = BAR_TYPE_LABEL[evt?.options?.barType] || "Unknown";
  const allowTips = !!evt?.options?.tipJarsAllowed;

  const whereText = eventAddress(evt.location);

  const mapsLink = googleMapsLinkFromEventLocation(evt.location);

  const addlContacts = Array.isArray(evt.additionalContacts) ? evt.additionalContacts : [];

  const subject = `Reminder: Event in 24 hours (${evt.shortCode || evt._id})`;
  const title = `24-hour Event Reminder`;

  // Priority / order: When → Where → Core info → Notes → Tips/Gratuity → Contacts
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.45;">
      <h2 style="margin:0 0 8px;">24-hour Reminder</h2>
      <p style="margin:0 0 12px;">Hi ${safeStr(bartender?.fullName || bartender?.name || "there")},</p>

      <div style="padding:12px;border:1px solid #ddd;border-radius:10px;">
        <p style="margin:0 0 6px;"><b>Event:</b> ${safeStr(evt.shortCode || evt._id)}</p>
        <p style="margin:0 0 6px;"><b>When:</b> ${formatWhen(evt)}</p>
        <p style="margin:0 0 6px;"><b>Where:</b> ${
          mapsLink
            ? `<a href="${mapsLink}" target="_blank" rel="noopener noreferrer">${whereText}</a>`
            : whereText || "—"
        }</p>
        <p style="margin:0;"><b>Bar type:</b> ${barType}</p>
      </div>

      <h3 style="margin:16px 0 6px;">Event details</h3>
      <ul style="margin:0 0 12px;padding-left:18px;">
        <li><b>Description:</b> ${safeStr(evt.description) || "—"}</li>
        ${
          safeStr(evt.additionalInstructions)
            ? `<li><b>Additional instructions:</b> ${safeStr(evt.additionalInstructions)}</li>`
            : ""
        }
        ${
          safeStr(evt.bartenderNotes)
            ? `<li><b>Bartender notes:</b> ${safeStr(evt.bartenderNotes)}</li>`
            : ""
        }
      </ul>

      <h3 style="margin:16px 0 6px;">Tips / gratuity</h3>
      <p style="margin:0 0 12px;">
        ${
          allowTips
            ? `Tip jars are <b>allowed</b>.`
            : `Tip jars are <b>not allowed</b>. You will receive <b>18% gratuity</b> on this event.`
        }
      </p>

      <h3 style="margin:16px 0 6px;">Contacts</h3>
      <ul style="margin:0;padding-left:18px;">
        <li><b>Main contact:</b> ${safeStr(evt?.contact?.fullName) || "—"} • ${safeStr(evt?.contact?.phone) || "—"} • ${safeStr(evt?.contact?.email) || "—"}</li>
        ${
          addlContacts.length
            ? addlContacts
                .map(
                  (c) =>
                    `<li><b>Additional:</b> ${safeStr(c.fullName) || "—"} • ${safeStr(c.phone) || "—"} • ${safeStr(c.email) || "—"}</li>`
                )
                .join("")
            : ""
        }
      </ul>

      ${
        assignedBartenders?.length
          ? `
            <h3 style="margin:16px 0 6px;">Team</h3>
            <ul style="margin:0;padding-left:18px;">
              ${assignedBartenders
                .map((b) => `<li>${safeStr(b.fullName || b.name)} • ${safeStr(b.phone || "—")} • ${safeStr(b.email || "—")}</li>`)
                .join("")}
            </ul>
          `
          : ""
      }

      <p style="margin-top:16px;">— Tipsyverse</p>
    </div>
  `;

  const text = [
    `24-hour Reminder`,
    `Event: ${evt.shortCode || evt._id}`,
    `When: ${formatWhen(evt)}`,
    `Where: ${whereText || "—"}`,
    `Bar type: ${barType}`,
    `Description: ${safeStr(evt.description) || "—"}`,
    safeStr(evt.additionalInstructions) ? `Instructions: ${safeStr(evt.additionalInstructions)}` : null,
    safeStr(evt.bartenderNotes) ? `Bartender notes: ${safeStr(evt.bartenderNotes)}` : null,
    allowTips ? `Tip jars allowed.` : `Tip jars NOT allowed. 18% gratuity applies.`,
    `Main contact: ${safeStr(evt?.contact?.fullName) || "—"} • ${safeStr(evt?.contact?.phone) || "—"} • ${safeStr(evt?.contact?.email) || "—"}`,
  ]
    .filter(Boolean)
    .join("\n");

  return { subject, title, html, text };
}

async function sendBartender24hReminders() {
  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const events = await Event.find({
    status: { $in: ["confirmed", "ready_to_assign", "reminder_sent", "in_progress"] },
    startAt: { $gt: now, $lte: in24h },
    bartender24hReminderSentAt: null,
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

    const assignedBartenders = assigns
      .map((a) => a.bartenderUser)
      .filter(Boolean);
    const bartendersWithEmail = assignedBartenders.filter(
      (bartender) => bartender?.email
    );

    if (!bartendersWithEmail.length) continue;

    for (const bartender of bartendersWithEmail) {
      const { subject, html, text, title } = buildBartender24hEmail({
        evt,
        bartender,
        assignedBartenders,
      });

      await sendEmail({
        to: bartender.email,
        subject,
        title,
        html,
        text,
      });
    }

    await Event.updateOne(
      { _id: evt._id, bartender24hReminderSentAt: null },
      { $set: { bartender24hReminderSentAt: new Date() } }
    );

    processed++;
  }

  console.log(`✅ Bartender 24h reminders sent for events: ${processed}`);
}

const tenMinuteBartender24hReminderJob = () => {
  return cron.schedule(
    "*/15 * * * *",
    async () => {
      console.log(`⏱️ Bartender 24h reminder job triggered.`);
      await sendBartender24hReminders();
    },
    { timezone: TZ }
  );
};

export default tenMinuteBartender24hReminderJob;
