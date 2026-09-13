import cron from "node-cron";
import { UserModel as User } from "../../models/index.js";
import { displayStatus, sendEmail } from "../../utils/index.js";

const TZ = "America/Indiana/Indianapolis";

/* ----------------------- date helpers ----------------------- */
function ymdInTZ(date, tz) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const get = (t) => parts.find((p) => p.type === t)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`; // YYYY-MM-DD
}

function parseYMD(ymd) {
  // ymd: "YYYY-MM-DD" -> {y,m,d}
  const [y, m, d] = String(ymd || "")
    .split("-")
    .map(Number);
  if (!y || !m || !d) return null;
  return { y, m, d };
}

function normalizeDateOnlyUTC(d) {
  return new Date(
    Date.UTC(
      d.getUTCFullYear(),
      d.getUTCMonth(),
      d.getUTCDate(),
      12,
      0,
      0 // noon UTC prevents backward drift
    )
  );
}

function daysBetweenYMD(nowYMD, expYMD) {
  // Both are YYYY-MM-DD (date-only, in same TZ concept)
  const n = parseYMD(nowYMD);
  const e = parseYMD(expYMD);
  if (!n || !e) return NaN;

  const n0 = Date.UTC(n.y, n.m - 1, n.d);
  const e0 = Date.UTC(e.y, e.m - 1, e.d);
  return Math.round((e0 - n0) / 86400000);
}

function fmtPrettyFromYMD(ymd) {
  const p = parseYMD(ymd);
  if (!p) return "—";
  // Create a stable date for formatting (UTC noon avoids weirdness)
  const dt = new Date(Date.UTC(p.y, p.m - 1, p.d, 12, 0, 0));
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(dt);
}

/* ----------------------- email builder ----------------------- */
function buildLicenseEmail({ user, license, daysLeft, expYMD }) {
  const state = license.state || "State";
  const permit = license.permitNumber || license.number || "—";
  const expPretty = fmtPrettyFromYMD(expYMD);

  const subject =
    daysLeft < 0
      ? `Tipsyverse — Liquor License expired (${state})`
      : `Tipsyverse — Liquor License expiring in ${daysLeft} day${daysLeft === 1 ? "" : "s"} (${state})`;

  const title = "License Reminder";

  const headline =
    daysLeft < 0 ? "Your liquor license is expired" : "Your liquor license is expiring soon";

  const body =
    daysLeft < 0
      ? `This license is marked <b>${displayStatus("expired")}</b>. Please renew and update it in Tipsyverse to remain eligible for events.`
      : `Please renew your license and update it in Tipsyverse to avoid losing eligibility for upcoming events.`;

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.45;">
      <h2 style="margin:0 0 8px;">${headline}</h2>
      <p style="margin:0 0 12px;">Hi ${user.fullName || user.name || "there"},</p>

      <div style="padding:12px;border:1px solid #ddd;border-radius:10px;">
        <p style="margin:0 0 6px;"><b>State:</b> ${state}</p>
        <p style="margin:0 0 6px;"><b>Permit #:</b> ${permit}</p>
        <p style="margin:0 0 6px;"><b>Expiration date:</b> ${expPretty}</p>
        <p style="margin:0;"><b>Status:</b> ${displayStatus(license.status, "—")}</p>
      </div>

      <p style="margin-top:16px;">${body}</p>
      <p style="margin-top:16px;">— Tipsyverse</p>
    </div>
  `;

  const text = [
    headline,
    `Name: ${user.fullName || user.name || "—"}`,
    `State: ${state}`,
    `Permit #: ${permit}`,
    `Expiration date: ${expPretty}`,
    daysLeft < 0 ? `Status: ${displayStatus("expired")}` : `Days left: ${daysLeft}`,
  ].join("\n");

  return { subject, title, html, text };
}

/* ----------------------- core pass ----------------------- */
async function runLicenseExpiryPass() {
  const now = new Date();
  const todayYMD = ymdInTZ(now, TZ);

  const users = await User.find({
    "bartenderProfile.licenses.0": { $exists: true },
  })
    .select("fullName name email bartenderProfile.licenses")
    .lean();

  let reminded = 0;
  let expiredUpdated = 0;

  const TARGETS = [90, 14, 1];

  for (const user of users) {
    if (!user.email) continue;

    const licenses = (user.bartenderProfile.licenses || []).filter(
      (l) => l.status !== "expired"
    );
    for (const lic of licenses) {
      // 1) Require expiresAt
      if (!lic?.expiresAt) continue;

      // 2) Convert expiresAt -> DATE ONLY in TZ (no drift)
      const expRaw = new Date(lic.expiresAt);
      const expSafe = normalizeDateOnlyUTC(expRaw);
      const expYMD = ymdInTZ(expSafe, TZ);

      const daysLeft = daysBetweenYMD(todayYMD, expYMD);
      if (!Number.isFinite(daysLeft)) continue;

      // Debug log (keep until you trust it)

      const isExpired = daysLeft < 0;

      // Ensure reminders object exists logically
      const reminders = lic.reminders || {};

      // Decide which reminder bucket to send (exact-day triggers)
      const want90 = daysLeft === 90 && !reminders.d90SentOn;
      const want14 = daysLeft === 14 && !reminders.d14SentOn;
      const want1 = daysLeft === 1 && !reminders.d1SentOn;

      const sendReminder = want90 || want14 || want1;

      // 1) Send 90/14/1 reminders
      if (sendReminder) {
        const { subject, title, html, text } = buildLicenseEmail({
          user,
          license: lic,
          daysLeft,
          expYMD,
        });

        await sendEmail({ to: user.email, subject, title, html, text });

        let setPath = null;
        if (want90)
          setPath = "bartenderProfile.licenses.$[l].reminders.d90SentOn";
        if (want14)
          setPath = "bartenderProfile.licenses.$[l].reminders.d14SentOn";
        if (want1)
          setPath = "bartenderProfile.licenses.$[l].reminders.d1SentOn";

        if (setPath) {
          await User.updateOne(
            { _id: user._id },
            { $set: { [setPath]: todayYMD } },
            { arrayFilters: [{ "l._id": lic._id }] }
          );
        }

        reminded++;
      }

      // 2) Expire license if past due
      if (isExpired && lic.status !== "expired") {
        await User.updateOne(
          { _id: user._id },
          {
            $set: {
              "bartenderProfile.licenses.$[l].status": "expired",
              "bartenderProfile.licenses.$[l].decisionNote": null
            },
          },
          { arrayFilters: [{ "l._id": lic._id }] }
        );
        expiredUpdated++;
      }

      // 3) One-time expired notification (separate from reminders)
      if (isExpired && !reminders.expiredNotifiedOn) {
        const { subject, title, html, text } = buildLicenseEmail({
          user,
          license: { ...lic, status: "expired" },
          daysLeft,
          expYMD,
        });

        await sendEmail({ to: user.email, subject, title, html, text });

        await User.updateOne(
          { _id: user._id },
          {
            $set: {
              "bartenderProfile.licenses.$[l].reminders.expiredNotifiedOn":
                todayYMD,
            },
          },
          { arrayFilters: [{ "l._id": lic._id }] }
        );
      }

    }
  }

  console.log(
    `✅ License pass done. Reminders sent: ${reminded}, Marked expired: ${expiredUpdated}`
  );
}

/* ----------------------- cron wrapper ----------------------- */
const dailyLicenseExpiryReminderJob = () => {
  // Run shortly after local midnight so expired licenses are marked early.
  return cron.schedule(
    "5 0 * * *",
    async () => {
      console.log("⏱️ Daily license expiry job triggered.");
      await runLicenseExpiryPass();
    },
    { timezone: TZ }
  );
};

export default dailyLicenseExpiryReminderJob;
