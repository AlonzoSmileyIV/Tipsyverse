// controllers/event.ctrl.js
import fs from "fs";
import {
  EventModel as Event,
  BidModel as Bid,
  AssignmentModel as Assignment,
  UserModel as User,
  PaymentModel as Payment,
} from "../../models/index.js";

import {
  maskEventForBoard,
  shallowDiff,
  normalizeContact,
  normalizeLocation,
  isUrgentEvent,
  lookupCoupon,
  applyCouponToTotal,
  calcDepositWithCoupon,
  sendEmail,
  sendNotification,
  paymentReceiptHTML,
  computeEventTotals,
  buildEventUpdatedEmail,
  handleImageUpload,
} from "../../utils/index.js";

import mongoose from "mongoose";

const escapeRegex = (s = "") => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const appUrl = () => process.env.PUBLIC_APP_URL || process.env.FRONTEND_URL || "http://localhost:3000";
const adminEventUrl = (eventId) => `${appUrl()}/admin?eventId=${eventId}`;

function formatEventType(value) {
  const text = String(value || "").trim();
  if (!text) return "Not provided";
  return text
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

// Returns true if [aStart, aEnd] overlaps [bStart, bEnd]
function rangesOverlap(aStart, aEnd, bStart, bEnd) {
  if (!aStart || !aEnd || !bStart || !bEnd) return false;
  const aS = new Date(aStart);
  const aE = new Date(aEnd);
  const bS = new Date(bStart);
  const bE = new Date(bEnd);

  // Strict overlap: starts before the other ends AND ends after the other starts
  return aS < bE && bS < aE;
}

function buildMainContactLine(evt, urgent = false) {
  const c = evt?.contact || {};
  const name = c.fullName || "Main contact";
  if (!urgent) return `${name} (available in-app closer to event)`;
  const best = c.phone || c.email || "—";
  return `${name} (${best})`;
}

function buildWhere(evt, urgent = false) {
  const loc = evt?.location || {};
  if (urgent) {
    return (
      loc.formatted ||
      loc.formattedAddress ||
      [loc.address1, loc.address2, loc.city, loc.state, loc.zipcode]
        .filter(Boolean)
        .join(", ")
    );
  }
  // privacy-safe (no street)
  return [loc.city, loc.state, loc.zipcode].filter(Boolean).join(", ") || "—";
}

function buildBartenderLinesHtml(selectedBartenders, urgent = false, { includePhotos = false } = {}) {
  return (selectedBartenders || [])
    .map((u) => {
      const name = u.fullName || "Bartender";
      const photo = u.profile?.photo || u.photo || "";
      const photoHtml =
        includePhotos && photo
          ? `<img src="${photo}" alt="${name}" style="width:36px;height:36px;border-radius:50%;object-fit:cover;vertical-align:middle;margin-right:8px;" />`
          : "";
      if (!urgent) return `<li>${photoHtml}<strong>${name}</strong></li>`;

      const phone = u.phone || "";
      const email = u.email || "";
      const parts = [phone, email].filter(Boolean).join(" • ");
      return `<li>${photoHtml}<strong>${name}</strong>${parts ? ` — ${parts}` : ""}</li>`;
    })
    .join("");
}

function tipsLine(evt) {
  const allowed = !!evt?.options?.tipJarsAllowed;
  return allowed
    ? "Tips allowed (tip jars permitted)"
    : "Tips NOT allowed — 18% gratuity will be included";
}

function safeText(v, fallback = "—") {
  const s = String(v || "").trim();
  return s ? s : fallback;
}

function eventLink(evt, path = "details") {
  return `${appUrl().replace(/\/$/, "")}/my-events/${evt._id}/${path}`;
}

function bartenderScheduleLink() {
  return `${appUrl().replace(/\/$/, "")}/bartend/schedule`;
}

function estimatedGigPay(evt) {
  const start = evt?.startAt ? new Date(evt.startAt) : null;
  const end = evt?.endAt ? new Date(evt.endAt) : null;
  const hours = start && end && end > start ? (end - start) / 36e5 : 0;
  const rate = Number(evt?.pricing?.hourlyRate) || 0;
  const amount = hours * rate;
  return amount > 0 ? `$${amount.toFixed(2)} estimated (${hours.toFixed(1)} hrs at $${rate.toFixed(2)}/hr)` : "Pay details will be confirmed by Tipsyverse.";
}

async function ensureAutoBidForEvent(eventId) {
  const autoBidEmail =
    process.env.AUTO_EVENT_BIDDER_EMAIL || "alonzo.smiley@tipsyverse.com";
  const bidder = await User.findOne({
    email: new RegExp(`^${escapeRegex(autoBidEmail)}$`, "i"),
  }).select("_id fullName email").lean();

  if (!bidder) {
    return {
      created: false,
      bidderEmail: autoBidEmail,
      reason: "Auto bidder user not found.",
    };
  }

  const now = new Date();
  const result = await Bid.findOneAndUpdate(
    { event: eventId, bartenderUser: bidder._id },
    {
      $set: {
        status: "interested",
        submittedAt: now,
      },
      $setOnInsert: {
        event: eventId,
        bartenderUser: bidder._id,
        score: 0,
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).lean();

  return {
    created: true,
    bidId: result?._id,
    bidderId: bidder._id,
    bidderEmail: bidder.email,
  };
}


function buildCoreEventFacts({ evt, urgent }) {
  const when = `${new Date(evt.startAt).toLocaleString()} – ${new Date(
    evt.endAt
  ).toLocaleString()}`;

  const where = buildWhere(evt, urgent);

  const guestCount = evt?.guestCount ?? "—";
  const bartendersCount =
    evt?.pricing?.bartendersRequested ?? evt?.counts?.neededBartenders ?? "—";

  const description = safeText(evt?.description);
  const barType = safeText(evt?.options?.barType);
  const bartenderNotes = safeText(evt?.bartenderNotes, "None");

  const additionalInstructions = safeText(evt?.additionalInstructions, "");
  const additionalContacts = Array.isArray(evt?.additionalContacts)
    ? evt.additionalContacts
    : [];

  const mainContact = evt?.contact || {};

  return {
    when,
    where,
    guestCount,
    bartendersCount,
    description,
    barType,
    bartenderNotes,
    tips: tipsLine(evt),

    // urgent-only payload
    urgentOnly: {
      additionalInstructions,
      additionalContacts,
      mainContact,
    },
  };
}

function additionalContactsHtml(contacts = []) {
  const cleaned = contacts
    .filter(Boolean)
    .map((c) => ({
      name: safeText(c.fullName || c.name, ""),
      phone: safeText(c.phone, ""),
      email: safeText(c.email, ""),
      role: safeText(c.role, ""),
      preferred: safeText(c.preferred, ""),
    }))
    .filter((c) => c.name || c.phone || c.email);

  if (!cleaned.length) return "";

  const rows = cleaned
    .map((c) => {
      const parts = [
        c.role ? `<strong>${c.role}:</strong>` : "",
        c.name,
        [c.phone, c.email].filter(Boolean).join(" • "),
        c.preferred ? `(prefers: ${c.preferred})` : "",
      ]
        .filter(Boolean)
        .join(" ");
      return `<li>${parts}</li>`;
    })
    .join("");

  return `<p style="margin:14px 0 6px;"><strong>Additional contacts</strong></p><ul>${rows}</ul>`;
}

function escapeHtml(value = "") {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function sameJson(left, right) {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}

function formatChangeValue(value) {
  if (value == null || value === "") return "Not set";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

function formatDateRangeForEmail(startAt, endAt) {
  const start = startAt ? new Date(startAt) : null;
  const end = endAt ? new Date(endAt) : null;
  if (!start || Number.isNaN(start.getTime())) return "Not set";
  if (!end || Number.isNaN(end.getTime())) return start.toLocaleString();
  return `${start.toLocaleString()} - ${end.toLocaleString()}`;
}

function fullLocationLine(evt = {}) {
  const loc = evt.location || {};
  return (
    loc.formatted ||
    loc.formattedAddress ||
    [loc.address1, loc.address2, loc.city, loc.state, loc.zipcode]
      .filter(Boolean)
      .join(", ") ||
    "Not set"
  );
}

function procurementItemsLine(evt = {}) {
  const items = evt?.options?.procurementItems || [];
  if (!Array.isArray(items) || !items.length) return "None";
  return items
    .map((item) => `${Number(item.qty) || 1} x ${item.name || item.item || "Item"}`)
    .join(", ");
}

function confirmedBartenderChangeSummary(beforeDoc = {}, afterDoc = {}) {
  const checks = [
    {
      label: "Date / time",
      before: formatDateRangeForEmail(beforeDoc.startAt, beforeDoc.endAt),
      after: formatDateRangeForEmail(afterDoc.startAt, afterDoc.endAt),
    },
    {
      label: "Address",
      before: fullLocationLine(beforeDoc),
      after: fullLocationLine(afterDoc),
    },
    {
      label: "Bar type",
      before: formatEventType(beforeDoc.options?.barType || "Not set"),
      after: formatEventType(afterDoc.options?.barType || "Not set"),
    },
    {
      label: "Tip jars allowed",
      before: !!beforeDoc.options?.tipJarsAllowed,
      after: !!afterDoc.options?.tipJarsAllowed,
    },
    {
      label: "Guest count",
      before: beforeDoc.guestCount ?? "Not set",
      after: afterDoc.guestCount ?? "Not set",
    },
    {
      label: "Bartenders needed",
      before:
        beforeDoc.counts?.neededBartenders ??
        beforeDoc.pricing?.bartendersRequested ??
        "Not set",
      after:
        afterDoc.counts?.neededBartenders ??
        afterDoc.pricing?.bartendersRequested ??
        "Not set",
    },
    {
      label: "Hourly rate",
      before:
        beforeDoc.pricing?.hourlyRate == null
          ? "Not set"
          : `$${Number(beforeDoc.pricing.hourlyRate).toFixed(2)}`,
      after:
        afterDoc.pricing?.hourlyRate == null
          ? "Not set"
          : `$${Number(afterDoc.pricing.hourlyRate).toFixed(2)}`,
    },
    {
      label: "Setup time",
      before:
        beforeDoc.pricing?.setupHours == null
          ? "Not set"
          : `${Number(beforeDoc.pricing.setupHours)} hr`,
      after:
        afterDoc.pricing?.setupHours == null
          ? "Not set"
          : `${Number(afterDoc.pricing.setupHours)} hr`,
    },
    {
      label: "Breakdown time",
      before:
        beforeDoc.pricing?.breakdownHours == null
          ? "Not set"
          : `${Number(beforeDoc.pricing.breakdownHours)} hr`,
      after:
        afterDoc.pricing?.breakdownHours == null
          ? "Not set"
          : `${Number(afterDoc.pricing.breakdownHours)} hr`,
    },
    {
      label: "Main contact",
      before: [
        beforeDoc.contact?.fullName,
        beforeDoc.contact?.phone,
        beforeDoc.contact?.email,
      ]
        .filter(Boolean)
        .join(" | "),
      after: [
        afterDoc.contact?.fullName,
        afterDoc.contact?.phone,
        afterDoc.contact?.email,
      ]
        .filter(Boolean)
        .join(" | "),
    },
    {
      label: "Additional instructions",
      before: beforeDoc.additionalInstructions || "None",
      after: afterDoc.additionalInstructions || "None",
    },
    {
      label: "Bartender notes",
      before: beforeDoc.bartenderNotes || "None",
      after: afterDoc.bartenderNotes || "None",
    },
    {
      label: "Items to pickup",
      before: procurementItemsLine(beforeDoc),
      after: procurementItemsLine(afterDoc),
    },
  ];

  return checks
    .filter((item) => !sameJson(item.before, item.after))
    .map((item) => ({
      ...item,
      before: formatChangeValue(item.before),
      after: formatChangeValue(item.after),
    }));
}

function buildConfirmedEventUpdateEmailForBartender({ evt, changes }) {
  const facts = buildCoreEventFacts({ evt, urgent: true });
  const rows = changes
    .map(
      (change) => `
        <tr>
          <td style="padding:10px;border-bottom:1px solid #eee;font-weight:700;">${escapeHtml(change.label)}</td>
          <td style="padding:10px;border-bottom:1px solid #eee;color:#777;">${escapeHtml(change.before)}</td>
          <td style="padding:10px;border-bottom:1px solid #eee;">${escapeHtml(change.after)}</td>
        </tr>`
    )
    .join("");

  return {
    subject: `Tipsyverse - Event ${evt.shortCode || ""} details updated`,
    html: `
      <p>A confirmed event you are assigned to has been updated. Please review the latest details before the event.</p>
      <h3>What changed</h3>
      <table style="border-collapse:collapse;width:100%;font-size:14px;">
        <thead>
          <tr>
            <th align="left" style="padding:10px;border-bottom:2px solid #7B0323;">Field</th>
            <th align="left" style="padding:10px;border-bottom:2px solid #7B0323;">Previous</th>
            <th align="left" style="padding:10px;border-bottom:2px solid #7B0323;">Now</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <h3>Latest event details</h3>
      <ul>
        <li><strong>Event:</strong> ${escapeHtml(formatEventType(evt.type))}</li>
        <li><strong>When:</strong> ${escapeHtml(facts.when)}</li>
        <li><strong>Address:</strong> ${escapeHtml(fullLocationLine(evt))}</li>
        <li><strong>Guests:</strong> ${escapeHtml(facts.guestCount)}</li>
        <li><strong>Bar type:</strong> ${escapeHtml(facts.barType)}</li>
        <li><strong>Tip jars:</strong> ${escapeHtml(facts.tips)}</li>
        <li><strong>Bartender notes:</strong> ${escapeHtml(facts.bartenderNotes)}</li>
      </ul>
      <p><a href="${escapeHtml(bartenderScheduleLink())}" style="color:#7B0323;font-weight:700;">View your bartender schedule</a></p>
    `,
  };
}

const bookingPolicyEmailItems = [
  ["Payment", "A deposit may be required to reserve your event. Remaining balances are due according to the booking payment schedule."],
  ["Cancellation", "Cancellations and reschedules should be communicated as soon as possible. Refunds and credits are subject to the cancellation policy."],
  ["Alcohol", "Unless otherwise agreed, the client is responsible for purchasing and supplying alcohol."],
  ["Responsible Service", "Bartenders may check IDs and refuse service to anyone underage, visibly intoxicated, unsafe, or unable to provide valid identification."],
  ["Staffing", "Tipsyverse will make every reasonable effort to provide qualified bartenders and may discuss substitute or alternative staffing if emergencies occur."],
  ["Guest Conduct", "Unsafe, abusive, threatening, or discriminatory behavior toward staff may result in staff leaving if safety becomes a concern."],
  ["Venue Requirements", "Bartenders need a safe workspace with reasonable access to water, electricity if needed, and sufficient lighting."],
  ["Supplies", "Unless included in a package, the client is responsible for alcohol, ice, mixers, cups, garnishes, and requested supplies."],
  ["Overtime", "If the event runs beyond the scheduled end time and bartenders are available to stay, additional time may be billed."],
  ["Liability", "Tipsyverse is not responsible for guest-caused injuries, damages, or incidents involving client-supplied alcohol, except where required by law."],
  ["Photography", "Staff may occasionally capture media for marketing unless the customer declines."],
];

function buildBookingPolicyEmailHtml(agreements = {}) {
  const mediaPreference =
    agreements.mediaPreference === "declined"
      ? "Customer declined event media."
      : agreements.mediaPreference === "accepted"
      ? "Customer accepted event media."
      : "No media preference recorded.";

  return `
    <h3 style="margin-top:25px;">Policies & Agreements Reviewed</h3>
    <p>The following booking policies were presented before this request was submitted:</p>
    <ul style="line-height:1.7;">
      ${bookingPolicyEmailItems.map(([title, text]) => `<li><strong>${title}:</strong> ${text}</li>`).join("")}
    </ul>
    <p><strong>Media preference:</strong> ${mediaPreference}</p>
    <p>If you have questions about these terms, reply to this email before your event is finalized.</p>
  `;
}

function money(n) {
  return `$${(Number(n) || 0).toFixed(2)}`;
}

function buildCurrentInvoiceEmailHtml({ evt, totals }) {
  const eventType = formatEventType(evt.type);
  const barType = formatEventType(evt.options?.barType || "unknown");
  const when = `${new Date(evt.startAt).toLocaleString()} - ${new Date(
    evt.endAt
  ).toLocaleString()}`;
  const where =
    evt.location?.formatted ||
    [evt.location?.address1, evt.location?.address2, evt.location?.city, evt.location?.state, evt.location?.zipcode]
      .filter(Boolean)
      .join(", ") ||
    "Not provided";
  const pickupItems = Array.isArray(evt.options?.procurementItems)
    ? evt.options.procurementItems
    : [];

  return `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#222;">
      <p>Hi ${escapeHtml(evt.contact?.fullName || "there")},</p>
      <p>Here is the current invoice for your Tipsyverse event.</p>

      <h3>Event Summary</h3>
      <ul>
        <li><strong>Event:</strong> ${escapeHtml(evt.shortCode || String(evt._id))}</li>
        <li><strong>Event Type:</strong> ${escapeHtml(eventType)}</li>
        <li><strong>Bar Type:</strong> ${escapeHtml(barType)}</li>
        <li><strong>When:</strong> ${escapeHtml(when)}</li>
        <li><strong>Where:</strong> ${escapeHtml(where)}</li>
      </ul>

      ${
        pickupItems.length
          ? `
            <h3>Items Picked Up / Requested</h3>
            <ul>
              ${pickupItems
                .map(
                  (item) =>
                    `<li>${Number(item.qty) || 1} x ${escapeHtml(
                      item.name || item.item || "Item"
                    )}</li>`
                )
                .join("")}
            </ul>
          `
          : ""
      }

      <h3>Invoice Summary</h3>
      <table style="border-collapse:collapse;width:100%;max-width:520px;">
        <tbody>
          <tr>
            <td style="padding:8px;border-bottom:1px solid #eee;">Invoice Total</td>
            <td align="right" style="padding:8px;border-bottom:1px solid #eee;"><strong>${money(totals.total)}</strong></td>
          </tr>
          <tr>
            <td style="padding:8px;border-bottom:1px solid #eee;">Amount Paid</td>
            <td align="right" style="padding:8px;border-bottom:1px solid #eee;">${money(totals.paid)}</td>
          </tr>
          <tr>
            <td style="padding:12px 8px;font-size:18px;">Remaining Balance</td>
            <td align="right" style="padding:12px 8px;font-size:18px;color:#7B0323;"><strong>${money(totals.balance)}</strong></td>
          </tr>
        </tbody>
      </table>

      <p style="margin-top:18px;">If you have already made a payment that is not reflected here, reply to this email and our team will review it.</p>
      <p>— Tipsyverse</p>
    </div>
  `;
}


const eventCtrl = {
  sendCurrentInvoice: async (req, res) => {
    try {
      const { id } = req.params;
      const evt = await Event.findById(id).lean();
      if (!evt) {
        return res.status(404).json({ success: false, message: "Not found" });
      }
      if (!evt.contact?.email) {
        return res.status(400).json({
          success: false,
          message: "The main contact does not have an email address.",
        });
      }

      const computedTotals = computeEventTotals({
        ...evt,
        pricing: {
          ...(evt.pricing || {}),
          publicFee: evt.private === false ? evt.pricing?.publicFee || 0 : 0,
        },
      });
      const recordedPaymentRows = await Payment.aggregate([
        {
          $match: {
            event: new mongoose.Types.ObjectId(id),
            status: "recorded",
          },
        },
        {
          $group: {
            _id: "$event",
            paidTotal: { $sum: "$amount" },
          },
        },
      ]);
      const paid =
        Math.round((Number(recordedPaymentRows[0]?.paidTotal) || 0) * 100) /
        100;
      const total =
        Math.round(
          (Number(evt.payment?.total) || Number(computedTotals.total) || 0) *
            100
        ) / 100;
      const balance = Math.max(0, Math.round((total - paid) * 100) / 100);

      const emailResult = await sendEmail?.({
        to: evt.contact.email,
        cc: ["finance@tipsyverse.com"],
        subject: `Tipsyverse - Current Invoice for Event #${evt.shortCode || evt._id}`,
        title: `Current Invoice for Event #${evt.shortCode || evt._id}`,
        html: buildCurrentInvoiceEmailHtml({
          evt,
          totals: { total, paid, balance },
        }),
      });

      if (!emailResult?.success) {
        return res.status(400).json({
          success: false,
          message: emailResult?.message || "Failed to send invoice.",
        });
      }

      await req.logActivity?.({
        action: "other",
        target: { model: "Event", id: evt._id },
        actor: {
          type: "User",
          id: req.user?.id,
          label: {
            fullName: req.user?.fullName,
            email: req.user?.email,
            role: req.user?.role,
          },
        },
        summary: "Sent current invoice",
        meta: {
          to: evt.contact.email,
          total,
          paid,
          balance,
        },
      });

      return res.json({
        success: true,
        message: `Invoice sent to ${evt.contact.email}.`,
        data: { total, paid, balance, sentTo: evt.contact.email },
      });
    } catch (error) {
      return res.status(400).json({ success: false, message: error.message });
    }
  },

  uploadProcurementReceipt: async (req, res) => {
    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, message: "No receipt image provided" });
    }

    const { id } = req.params;
    const filePath = req.file.path;

    try {
      const evt = await Event.findById(id);
      if (!evt) {
        return res.status(404).json({ success: false, message: "Not found" });
      }

      const result = await handleImageUpload(filePath);
      const options = evt.options?.toObject?.() || evt.options || {};

      evt.options = {
        ...options,
        procurementRequested: true,
        procurementReceiptProof: result.secure_url,
        procurementReceiptPublicId: result.public_id,
      };
      await evt.save();

      await req.logActivity?.({
        action: "update",
        target: { model: "Event", id: evt._id },
        actor: {
          type: "User",
          id: req.user?.id,
          label: {
            fullName: req.user?.fullName,
            email: req.user?.email,
            role: req.user?.role,
          },
        },
        summary: "Uploaded procurement receipt",
        meta: {
          receiptUrl: result.secure_url,
          receiptPublicId: result.public_id,
          fileName: req.file?.originalname,
        },
      });

      return res.status(200).json({
        success: true,
        message: "Receipt uploaded to Cloudinary.",
        data: {
          receiptUrl: result.secure_url,
          receiptPublicId: result.public_id,
          event: evt,
        },
      });
    } catch (error) {
      return res.status(400).json({ success: false, message: error.message });
    } finally {
      fs.unlink(filePath, (err) => {
        if (err) console.error("Failed to delete temp receipt file:", err);
      });
    }
  },

  /** 1) submitRequest: from public form payload you showed */
  submitRequest: async (req, res) => {
    try {
      const {
        type,
        description,
        additionalInstructions,
        startAt,
        endAt,
        contact,
        location,
        options,
        agreements,
      } = req.body;

      // normalize contact to ContactSchema
      const contactDoc = {
        fullName: contact?.fullName,
        email: contact?.email,
        phone: contact?.phone,
        preferred: contact?.preferred || "call",
        role: "organizer",
      };

      const contactEmail = String(contactDoc.email || "").trim().toLowerCase();
      const bookingUser = req.user?.id
        ? await User.findById(req.user.id).select("accountStatus email").lean()
        : contactEmail
          ? await User.findOne({ email: contactEmail })
              .select("accountStatus email")
              .lean()
          : null;

      const bookingStatus = bookingUser?.accountStatus || {};
      if (bookingStatus.state === "Suspended") {
        return res.status(403).json({
          success: false,
          message:
            bookingStatus.suspensionExplanation ||
            bookingStatus.reasonForSuspension ||
            "This account is currently suspended and cannot book events.",
        });
      }

      if (bookingStatus.allowedToBookEvent === false) {
        return res.status(403).json({
          success: false,
          message:
            bookingStatus.bookingRestrictionReason ||
            "This account is not currently allowed to book events.",
        });
      }

      const doc = await Event.create({
        organizer: req.user?.id ?? undefined, // may be anonymous if you allow
        type,
        description,
        additionalInstructions,
        startAt,
        endAt,
        location: {
          ...location,
          point: location?.point,
        },
        options: {
          barType: options?.barType ?? "unknown",
          procurementRequested: !!options?.procurementRequested,
          procurementItems: Array.isArray(options?.procurementItems)
            ? options.procurementItems
                .map((item) => ({
                  name: String(item?.name || item?.item || "").trim(),
                  qty: Math.max(1, Number(item?.qty) || 1),
                  pickedUp: !!item?.pickedUp,
                }))
                .filter((item) => item.name)
            : [],
          procurementActualCost: Math.max(
            0,
            Number(options?.procurementActualCost) || 0
          ),
          procurementReceiptProof: String(
            options?.procurementReceiptProof || ""
          ).trim(),
          procurementReceiptPublicId: String(
            options?.procurementReceiptPublicId || ""
          ).trim(),
          procurementReceiptNotes: String(
            options?.procurementReceiptNotes || ""
          ).trim(),
          procurementBilledAt: options?.procurementBilledAt || null,
          tipJarsAllowed: options?.tipJarsAllowed ?? true,
        },
        agreements: {
          ...(agreements || {}),
          reviewedAt: agreements?.reviewedAt || new Date(),
          method: agreements?.method || "self_service_booking",
        },
        contact: contactDoc,
        status: "submitted",
        counts: { neededBartenders: 1, assigned: 0 },
        pricing: { bartendersRequested: 1 }, // default; staff can update
      });
      const eventDetailsUrl = eventLink(doc, "details");
      const eventTypeLabel = formatEventType(type);

      // 🔥 Send confirmation email
      await sendEmail({
        to: contactDoc.email,
        subject: `Tipsyverse - Requested Event #${doc.shortCode} Received`,
        title: "Event Request Received",
        html: `
        <p>Hey ${contactDoc.fullName.split(" ")[0]},</p>

        <p>Thank you for submitting your event request with Tipsyverse! 🎉<br/>
        Our team will be reviewing the details and will be contacting you shortly regarding the following request:</p>

        <h3 style="margin-top:25px;">📝 Event Summary</h3>
        <p><strong>Your Event#:</strong> ${doc.shortCode}</p>
        <p><strong>Event Type:</strong> ${eventTypeLabel}</p>
        <p><strong>Bartender(s) need to arrive:</strong> ${new Date(startAt).toLocaleString()}</p>
        <p><strong>Bartender(s) need to leave:</strong> ${new Date(endAt).toLocaleString()}</p>
        <p><strong>Location:</strong> ${location.formatted}</p>

        ${buildBookingPolicyEmailHtml(agreements)}

        <div class="button-wrapper">
          <a href="${eventDetailsUrl}" class="button">View in My Events</a>
        </div>
        <p><strong>My Events URL:</strong><br/>
          <a href="${eventDetailsUrl}">${eventDetailsUrl}</a>
        </p>

        <hr style="border:none;border-top:1px solid #ddd;margin:25px 0;" />

        <h3>📌 Questions That Will be asked to Finalize Your Event</h3>

        <p>To finalize pricing and confirm availability, we will be asking the following questions:</p>
        <ol style="line-height:1.7;">
          <li>How many guests do you expect?</li>
          <li>What type of bar setup? (Full bar, open bar, cocktails, beer & wine only, custom theme, etc.)</li>
          <li>Should we pick up any items for you? If yes, list of items + quantities.</li>
          <li>Are bartenders allowed to pull out tip jars?</li>
          <li>Any special notes our bartenders should know?</li>
          <li>Is there any additional contact we should loop into the event?</li>
        </ol>

        <p>You can reply directly to <a href="mailto:admin@tipsyverse.com">admin@tipsyverse.com</a> with your answers.</p>

        <p>We're excited to serve you! 🍸</p>
      `,
      });

      await sendEmail({
        to: "admin@tipsyverse.com",
        cc: "alonzo.smiley@tipsyverse.com",
        bcc: "zosmiley4@gmail.com",
        subject: `New Tipsyverse event request — ${doc.shortCode}`,
        title: `New Event Request ${doc.shortCode}`,
        html: `
          <p>A new event request was submitted and needs review.</p>
          <h3 style="margin-top:20px;">Request Details</h3>
          <p><strong>Event #:</strong> ${doc.shortCode}</p>
          <p><strong>Event Type:</strong> ${eventTypeLabel}</p>
          <p><strong>Description:</strong> ${description || "Not provided"}</p>
          <p><strong>Starts:</strong> ${startAt ? new Date(startAt).toLocaleString() : "Not provided"}</p>
          <p><strong>Ends:</strong> ${endAt ? new Date(endAt).toLocaleString() : "Not provided"}</p>
          <p><strong>Location:</strong> ${location?.formatted || "Not provided"}</p>
          <p><strong>Main Contact:</strong> ${contactDoc.fullName || "Not provided"}</p>
          <p><strong>Email:</strong> ${contactDoc.email || "Not provided"}</p>
          <p><strong>Phone:</strong> ${contactDoc.phone || "Not provided"}</p>
          <p><strong>Preferred Contact:</strong> ${contactDoc.preferred || "call"}</p>
          <p><strong>Tip Jars Allowed:</strong> ${doc.options?.tipJarsAllowed ? "Yes" : "No"}</p>

          <div class="button-wrapper">
            <a href="${adminEventUrl(doc._id)}" class="button">Open Event in Admin</a>
          </div>
          <p><strong>Admin URL:</strong><br/>
            <a href="${adminEventUrl(doc._id)}">${adminEventUrl(doc._id)}</a>
          </p>
          <p style="font-size:13px;color:#666;">
            For security, this link requires an employee account. If you open it from a personal email, sign in with an authorized Tipsyverse employee account or add that email as an employee alias.
          </p>
        `,
      });

      const actor = req.user?.id
  ? {
      type: "User",
      id: req.user.id,
      label: {
        fullName: req.user.fullName,
        email: req.user.email,
        role: req.user.role,
      },
    }
  : {
      type: "System",
      label: {
        fullName: contactDoc.fullName,
        email: contactDoc.email,
        role: "guest",
      },
    };

      await req.logActivity?.({
        action: "create",
        target: { model: "Event", id: doc._id },
        actor,
        summary: `Event request submitted (${type})`,
        meta: { startAt, endAt, location: location?.formatted },
      });

      return res.status(201).json({ success: true, data: doc });
    } catch (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
  },

  /**
   * GET /api/v1/event-requests
   * Admin/employee overview of ALL events.
   * Query:
   *  - q: free text (type, description, contact, location.formatted/city/state/zip)
   *  - status: CSV or array
   *  - private: "true" | "false"
   *  - onBoard: "true" | "false" (visibility.onBiddingBoard)
   *  - after, before: ISO dates filter on startAt
   *  - page, limit, sort (default "-startAt")
   */
  viewAllEvents: async (req, res) => {
    try {
      // Optional RBAC
      const role = String(req.user?.role || "");
      if (!["employee", "admin"].includes(role)) {
        return res.status(403).json({ success: false, message: "Forbidden" });
      }

      const {
        q,
        status,
        private: priv,
        onBoard,
        after,
        before,
        page = 1,
        limit = 20,
        sort = "-startAt",
      } = req.query;

      const lim = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
      const pg = Math.max(parseInt(page, 10) || 1, 1);
      const skip = (pg - 1) * lim;
      const now = new Date(); // 👈 used for "next followup" calc

      const match = {};

      // Filter: status
      if (status) {
        const arr = (Array.isArray(status) ? status : String(status).split(","))
          .map((s) => s.trim())
          .filter(Boolean);
        if (arr.length) match.status = { $in: arr };
      }

      // Filter: private
      if (typeof priv === "string") {
        match.private = priv === "true";
      }

      // Filter: on bidding board
      if (typeof onBoard === "string") {
        match["visibility.onBiddingBoard"] = onBoard === "true";
      }

      // Filter: time window
      if (after || before) {
        match.startAt = {};
        if (after) match.startAt.$gte = new Date(after);
        if (before) match.startAt.$lte = new Date(before);
        if (!Object.keys(match.startAt).length) delete match.startAt;
      }

      // Text-ish search across a few fields
      const or = [];
      if (q && String(q).trim()) {
        const rx = new RegExp(
          String(q)
            .trim()
            .replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
          "i"
        );
        or.push(
          { type: rx },
          { description: rx },
          { additionalInstructions: rx },
          { "location.address1": rx },
          { "location.address2": rx },
          { "location.county": rx },
          { "location.formatted": rx },
          { "location.formattedAddress": rx },
          { "location.city": rx },
          { "location.state": rx },
          { "location.zipcode": rx },
          { "contact.fullName": rx },
          { "contact.email": rx }
        );
      }

      const field = String(sort).replace(/^-/, "");
      const dir = String(sort).startsWith("-") ? -1 : 1;

      const pipeline = [
        { $match: match },
        ...(or.length ? [{ $match: { $or: or } }] : []),

        // Existing computed field
        {
          $addFields: {
            openSpots: {
              $max: [
                { $subtract: ["$counts.neededBartenders", "$counts.assigned"] },
                0,
              ],
            },
          },
        },

        {
          $lookup: {
            from: Payment.collection.name,
            let: { eventId: "$_id" },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ["$event", "$$eventId"] },
                  status: "recorded",
                },
              },
              {
                $group: {
                  _id: "$event",
                  paidTotal: { $sum: "$amount" },
                },
              },
            ],
            as: "paymentSummary",
          },
        },
        {
          $addFields: {
            recordedPaidTotal: {
              $ifNull: [{ $arrayElemAt: ["$paymentSummary.paidTotal", 0] }, 0],
            },
            recordedPaymentTotal: {
              $ifNull: ["$payment.total", { $ifNull: ["$pricing.estimatedTotal", 0] }],
            },
          },
        },
        {
          $addFields: {
            "payment.paidTotal": "$recordedPaidTotal",
            "payment.balance": {
              $max: [
                {
                  $subtract: [
                    { $ifNull: ["$payment.total", 0] },
                    "$recordedPaidTotal",
                  ],
                },
                0,
              ],
            },
          },
        },

        // 👇 NEW: compute the next *future* follow-up attempt from contactAttempts
        {
          $addFields: {
            nextFollowAttempt: {
              $first: {
                $sortArray: {
                  input: {
                    $filter: {
                      input: { $ifNull: ["$contactAttempts", []] },
                      as: "a",
                      cond: {
                        $and: [
                          { $ifNull: ["$$a.followUpAt", false] },
                          { $gte: ["$$a.followUpAt", now] }, // only future follow-ups
                        ],
                      },
                    },
                  },
                  sortBy: { followUpAt: 1 }, // earliest first
                },
              },
            },
          },
        },

        // 👇 NEW: lookup the user who will do that follow-up
        {
          $lookup: {
            from: "users",
            localField: "nextFollowAttempt.attemptedBy",
            foreignField: "_id",
            as: "nextFollowUser",
          },
        },
        {
          $unwind: {
            path: "$nextFollowUser",
            preserveNullAndEmptyArrays: true,
          },
        },

        // 👇 NEW: build a clean `nextFollowup` object for the frontend
        // Build nextFollowup object
        {
          $addFields: {
            nextFollowup: {
              at: "$nextFollowAttempt.followUpAt",
              outcome: "$nextFollowAttempt.outcome",
              notes: "$nextFollowAttempt.notes",
              by: {
                _id: "$nextFollowUser._id",
                email: "$nextFollowUser.email",
                fullName: {
                  $ifNull: [
                    "$nextFollowUser.fullName",
                    {
                      $ifNull: [
                        "$nextFollowUser.name",
                        "$nextFollowUser.email",
                      ],
                    },
                  ],
                },
                photo: {
                  $ifNull: [
                    "$nextFollowUser.profile.photo",
                    {
                      $ifNull: [
                        "$nextFollowUser.profile.photoUrl",
                        {
                          $ifNull: [
                            "$nextFollowUser.avatarUrl",
                            {
                              $ifNull: [
                                "$nextFollowUser.photoUrl",
                                "$nextFollowUser.image",
                              ],
                            },
                          ],
                        },
                      ],
                    },
                  ],
                },
              },
            },
          },
        },

        // 👇 NEW: Force null if no attempts OR no future follow-up
        {
          $addFields: {
            nextFollowup: {
              $cond: [
                {
                  $or: [
                    {
                      $eq: [
                        { $size: { $ifNull: ["$contactAttempts", []] } },
                        0,
                      ],
                    },
                    { $eq: [{ $ifNull: ["$nextFollowAttempt", null] }, null] },
                  ],
                },
                null,
                "$nextFollowup",
              ],
            },
          },
        },

        // keep docs clean; remove helper fields
        {
          $unset: [
            "nextFollowAttempt",
            "nextFollowUser",
            "paymentSummary",
            "recordedPaidTotal",
          ],
        },

        { $sort: { [field]: dir, _id: 1 } },

        {
          $facet: {
            rows: [{ $skip: skip }, { $limit: lim }],
            total: [{ $count: "n" }],
          },
        },
        {
          $project: {
            rows: 1,
            total: { $ifNull: [{ $arrayElemAt: ["$total.n", 0] }, 0] },
          },
        },
      ];

      const [result] = await Event.aggregate(pipeline);
      return res.json({
        success: true,
        data: result?.rows || [],
        total: result?.total || 0,
        page: pg,
        limit: lim,
        hasNext: skip + (result?.rows?.length || 0) < (result?.total || 0),
      });
    } catch (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
  },

  /** 2) logContactAttempt: drives awaiting/ready statuses */
  logContactAttempt: async (req, res) => {
    try {
      const { id } = req.params;
      const { method, outcome, notes, followUpAt, at } = req.body;

      if (!mongoose.isValidObjectId(id)) {
        return res.status(400).json({
          success: false,
          message: "A valid event id is required to log a contact attempt.",
        });
      }

      if (outcome === "followup_scheduled" && !followUpAt) {
        return res.status(400).json({
          success: false,
          message: "followUpAt is required when scheduling a follow-up.",
        });
      }

      const attempt = {
        method,
        outcome,
        notes,
        followUpAt: followUpAt ? new Date(followUpAt) : undefined,
        attemptAt: at ? new Date(at) : new Date(),
        attemptedBy: req.user.id, // source of truth
      };

      const existing = await Event.findById(id).lean();
      if (!existing) {
        return res
          .status(404)
          .json({ success: false, message: "Event not found" });
      }

      const newStatus =
        existing.status === "submitted" ? "awaiting_response" : existing.status;

      const evt = await Event.findByIdAndUpdate(
        id,
        {
          $push: { contactAttempts: attempt },
          $set: { status: newStatus },
        },
        { new: true, runValidators: true }
      )
        .populate({
          path: "contactAttempts.attemptedBy",
          select:
            "fullName fullname name email profile avatarUrl photoUrl image",
        })
        .lean();

      return res.json({ success: true, data: evt });
    } catch (err) {
      return res.status(400).json({
        success: false,
        message: err.message || "Failed to log attempt",
      });
    }
  },

  /** 3) view available events FOR BARTENDERS to grab bartender board (filters + distance) */
  viewAvailableEvents: async (req, res) => {
    try {
      const {
        after,
        before,
        barType,
        maxDistanceMeters,
        onlyOpenSpots = true,
        nearLng,
        nearLat,
        minOpenSpots = 1,
      } = req.query;

      const assignableStatuses = ["ready_to_assign", "bidding", "selecting"];
      const match = {
        status: { $in: assignableStatuses },
      };

      if (after)
        match.startAt = { ...(match.startAt || {}), $gte: new Date(after) };
      if (before)
        match.startAt = { ...(match.startAt || {}), $lte: new Date(before) };
      if (barType) match["options.barType"] = barType;

      if (onlyOpenSpots === "true") {
        match.$expr = {
          $gt: ["$counts.neededBartenders", "$counts.assigned"],
        };
      }

      const pipeline = [];

      // Geo filter
      if (nearLng && nearLat) {
        pipeline.push({
          $geoNear: {
            near: {
              type: "Point",
              coordinates: [Number(nearLng), Number(nearLat)],
            },
            distanceField: "distanceMeters",
            spherical: true,
            query: match,
          },
        });
      } else {
        pipeline.push({ $match: match });
      }

      pipeline.push({
        $addFields: {
          openSpots: {
            $max: [
              { $subtract: ["$counts.neededBartenders", "$counts.assigned"] },
              0,
            ],
          },
        },
      });

      if (minOpenSpots) {
        pipeline.push({
          $match: { openSpots: { $gte: Number(minOpenSpots) } },
        });
      }

      if (maxDistanceMeters && nearLng && nearLat) {
        pipeline.push({
          $match: { distanceMeters: { $lte: Number(maxDistanceMeters) } },
        });
      }

      pipeline.push({
        $project: {
          type: 1,
          startAt: 1,
          endAt: 1,
          options: 1,
          counts: 1,
          guestCount: 1,
          status: 1,
          location: 1,
          pricing: {
            bartendersRequested: 1,
            hourlyRate: 1,
          },
          openSpots: 1,
          distanceMeters: 1,
          description: 1,
          additionalInstructions: 1,
          visibility: 1,
        },
      });

      pipeline.push({ $sort: { startAt: 1 } });

      const events = await Event.aggregate(pipeline);

      // 🔥 Fetch bids made by this bartender for these events
      const eventIds = events.map((e) => e._id);

      const myBids = await Bid.find({
        event: { $in: eventIds },
        bartenderUser: req.user.id,
      })
        .select("event status")
        .lean();

      // Create a lookup table: eventId → bid status
      const bidMap = {};
      for (const bid of myBids) {
        bidMap[String(bid.event)] = bid.status;
      }

      // 🔥 Fetch this bartender's ACTIVE assignments (with event times)
      const myAssignments = await Assignment.find({
        bartenderUser: req.user.id,
        status: "active",
      })
        .populate({
          path: "event",
          select: "startAt endAt status",
        })
        .lean();

      // Normalize to just time windows
      const assignmentWindows = myAssignments
        .map((a) => a.event)
        .filter(Boolean)
        .map((ev) => ({
          startAt: ev.startAt,
          endAt: ev.endAt,
        }));

      const now = new Date();

      // 🔥 Attach bartenderBidStatus to each event
      const withBidInfo = events.map((evt) => {
        const evtStart = evt.startAt;
        const evtEnd = evt.endAt;

        // ✅ If the board event already ended, it should not be "conflicting"
        if (
          !evtStart ||
          !evtEnd ||
          isNaN(evtStart) ||
          isNaN(evtEnd) ||
          evtEnd <= now
        ) {
          return {
            ...maskEventForBoard(evt),
            myBidStatus: bidMap[String(evt._id)] || "none",
            conflictsSchedule: false,
          };
        }

        const conflictsSchedule = assignmentWindows.some((w) =>
          rangesOverlap(evtStart, evtEnd, w.startAt, w.endAt)
        );

        return {
          ...maskEventForBoard(evt),
          myBidStatus: bidMap[String(evt._id)] || "none", // none | interested | waitlist | selected
          conflictsSchedule, // ✅ true/false
        };
      });

      return res.json({
        success: true,
        data: withBidInfo,
      });
    } catch (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
  },

  /**
   * GET /api/v1/event-requests/assigned
   * Returns events where the current user is assigned (via Assignment).
   * Query:
   *  - status: CSV/array (filter events by status)
   *  - upcomingOnly: "true" | "false" (default false)
   *  - after, before: ISO date strings (on Event.startAt)
   *  - q: free text on type/description/location
   *  - page, limit, sort (default "-startAt")
   */
  viewMyAssignedEvents: async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res
          .status(401)
          .json({ success: false, message: "Unauthorized" });
      }

      const {
        status,
        upcomingOnly = "false",
        after,
        before,
        q,
        page = 1,
        limit = 20,
        sort = "-startAt",
      } = req.query;

      const lim = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
      const skip = (Math.max(parseInt(page, 10) || 1, 1) - 1) * lim;

      // Start from assignments for this user, then $lookup the events
      const matchEvt = {};
      if (status) {
        const arr = Array.isArray(status)
          ? status
          : String(status)
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean);
        if (arr.length) matchEvt.status = { $in: arr };
      }
      if (after || before || upcomingOnly === "true") {
        matchEvt.startAt = {};
        if (after) matchEvt.startAt.$gte = new Date(after);
        if (before) matchEvt.startAt.$lte = new Date(before);
        if (upcomingOnly === "true") matchEvt.startAt.$gte = new Date();
        if (!Object.keys(matchEvt.startAt).length) delete matchEvt.startAt;
      }

      const textOr = [];
      if (q && String(q).trim()) {
        const rx = new RegExp(escapeRegex(String(q).trim()), "i");
        textOr.push(
          { "event.type": rx },
          { "event.description": rx },
          { "event.additionalInstructions": rx },
          { "event.location.formatted": rx },
          { "event.location.city": rx },
          { "event.location.state": rx },
          { "event.location.zipcode": rx }
        );
      }

      const field = String(sort).replace(/^-/, "");
      const dir = String(sort).startsWith("-") ? -1 : 1;

      const pipeline = [
        { $match: { bartenderUser: Event.db.base.Types.ObjectId(userId) } },
        // join event
        {
          $lookup: {
            from: "events", // collection name for Event model
            localField: "event",
            foreignField: "_id",
            as: "event",
          },
        },
        { $unwind: "$event" },
        // event-level filters
        { $match: matchEvt },
        ...(textOr.length ? [{ $match: { $or: textOr } }] : []),
        // compute openSpots from event counts
        {
          $addFields: {
            openSpots: {
              $max: [
                {
                  $subtract: [
                    "$event.counts.neededBartenders",
                    "$event.counts.assigned",
                  ],
                },
                0,
              ],
            },
          },
        },
        // project just what the client needs
        {
          $project: {
            // assignment info
            assignedAt: 1,
            notified: 1,
            // event info
            eventId: "$event._id",
            type: "$event.type",
            status: "$event.status",
            private: "$event.private",
            shortCode: "$event.shortCode",
            startAt: "$event.startAt",
            endAt: "$event.endAt",
            location: {
              formatted: "$event.location.formatted",
              city: "$event.location.city",
              state: "$event.location.state",
              zipcode: "$event.location.zipcode",
              point: "$event.location.point",
            },
            pricing: {
              bartendersRequested: "$event.pricing.bartendersRequested",
              hourlyRate: "$event.pricing.hourlyRate",
            },
            counts: "$event.counts",
            openSpots: 1,
            visibility: "$event.visibility",
            createdAt: "$event.createdAt",
            updatedAt: "$event.updatedAt",
          },
        },
        { $sort: { [field]: dir, _id: 1 } },
        {
          $facet: {
            rows: [{ $skip: skip }, { $limit: lim }],
            total: [{ $count: "n" }],
          },
        },
        {
          $project: {
            rows: 1,
            total: { $ifNull: [{ $arrayElemAt: ["$total.n", 0] }, 0] },
          },
        },
      ];

      const [result] = await Assignment.aggregate(pipeline);
      return res.json({
        success: true,
        data: result?.rows || [],
        total: result?.total || 0,
        page: Number(page) || 1,
        limit: lim,
        hasNext: skip + (result?.rows?.length || 0) < (result?.total || 0),
      });
    } catch (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
  },

  /** 4) viewEventById: mask address if requester is a bartender not assigned/selected */
  viewEventById: async (req, res) => {
    try {
      const { id } = req.params;

      const evt = await Event.findById(id)
        .populate({
          path: "contactAttempts.attemptedBy",
          select:
            "fullName fullname name email profile.photo avatarUrl photoUrl",
        })
        .lean();

      if (!evt) {
        return res.status(404).json({ success: false, message: "Not found" });
      }

      const recordedPaymentRows = await Payment.aggregate([
        {
          $match: {
            event: new mongoose.Types.ObjectId(id),
            status: "recorded",
          },
        },
        {
          $group: {
            _id: "$event",
            paidTotal: { $sum: "$amount" },
          },
        },
      ]);
      const paidTotal =
        Math.round((Number(recordedPaymentRows[0]?.paidTotal) || 0) * 100) /
        100;
      const paymentTotal =
        Math.round(
          (Number(evt.payment?.total) ||
            Number(evt.payment?.totalAfterDiscount) ||
            Number(evt.pricing?.estimatedTotal) ||
            0) * 100
        ) / 100;
      const paymentBalance =
        Math.max(0, Math.round((paymentTotal - paidTotal) * 100) / 100);
      evt.recordedPaidTotal = paidTotal;
      evt.payment = {
        ...(evt.payment || {}),
        paidTotal,
        balance: paymentBalance,
        status:
          paymentTotal > 0 && paidTotal >= paymentTotal
            ? "paid_in_full"
            : paidTotal > 0
            ? "partially_paid"
            : evt.payment?.status || "none",
      };

      const isEmployee = [
        "owner",
        "ceo",
        "executive",
        "manager",
        "Supervisor",
        "it",
        "helpdesk",
        "admin",
        "employee",
      ].includes(req.user?.role);

      let isAssigned = false;
      if (!isEmployee) {
        const assignment = await Assignment.findOne({
          event: id,
          bartenderUser: req.user?.id,
        }).lean();
        isAssigned = !!assignment;
      }

      const safe = !isEmployee && !isAssigned ? maskEventForBoard(evt) : evt;
      // console.log("user role:", req.user?.role);
      // console.log("isEmployee:", isEmployee);
      // console.log("isAssigned:", isAssigned);
      // console.log("evt.location:", evt.location);
      // console.log("after mask, safe.location:", safe.location);
      return res.json({ success: true, data: safe });
    } catch (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
  },

  /**
   * GET /api/v1/event-requests/mine
   * Returns events where req.user.email matches contact.email (main contact).
   * Query params:
   *  - status: string | string[]            (e.g. "confirmed" or "confirmed,in_progress")
   *  - upcomingOnly: "true" | "false"
   *  - after, before: ISO date strings
   *  - q: free text over type/description/location.formatted
   *  - page: number (default 1)
   *  - limit: number (default 20, max 100)
   * Sort: startAt descending by default
   */
  viewMyEvents: async (req, res) => {
    try {
      const userEmail = String(req.user?.email || "").trim();
      if (!userEmail) {
        return res.status(400).json({
          success: false,
          message: "User email required to look up contact events.",
        });
      }

      const {
        status,
        upcomingOnly = "false",
        after,
        before,
        q,
        page = 1,
        limit = 20,
        sort = "-startAt", // allow override like "startAt" or "-createdAt"
      } = req.query;

      const lim = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
      const skip = (Math.max(parseInt(page, 10) || 1, 1) - 1) * lim;

      const match = {
        // Case-insensitive exact match on primary contact email
        "contact.email": {
          $regex: new RegExp(`^${escapeRegex(userEmail)}$`, "i"),
        },
      };

      // Optional status filter (single or CSV)
      if (status) {
        const arr = Array.isArray(status)
          ? status
          : String(status)
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean);
        if (arr.length) match.status = { $in: arr };
      }

      // Time filters
      if (after || before || upcomingOnly === "true") {
        match.startAt = {};
        if (after) match.startAt.$gte = new Date(after);
        if (before) match.startAt.$lte = new Date(before);
        if (upcomingOnly === "true") match.startAt.$gte = new Date(); // now → future
        if (Object.keys(match.startAt).length === 0) delete match.startAt;
      }

      // Basic free-text search (no text index required)
      const textOr = [];
      if (q && String(q).trim().length) {
        const rx = new RegExp(escapeRegex(String(q).trim()), "i");
        textOr.push(
          { type: rx },
          { description: rx },
          { additionalInstructions: rx },
          { "location.formatted": rx },
          { "location.city": rx },
          { "location.state": rx },
          { "location.zipcode": rx }
        );
      }

      const pipeline = [
        { $match: match },
        ...(textOr.length ? [{ $match: { $or: textOr } }] : []),
        {
          $lookup: {
            from: Payment.collection.name,
            let: { eventId: "$_id" },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ["$event", "$$eventId"] },
                  status: "recorded",
                },
              },
              {
                $group: {
                  _id: "$event",
                  paidTotal: { $sum: "$amount" },
                },
              },
            ],
            as: "paymentSummary",
          },
        },
        {
          $addFields: {
            recordedPaidTotal: {
              $ifNull: [{ $arrayElemAt: ["$paymentSummary.paidTotal", 0] }, 0],
            },
          },
        },
        {
          $project: {
            // Return the important bits for a “My Events” list
            type: 1,
            startAt: 1,
            endAt: 1,
            status: 1,
            options: 1,
            shortCode: 1,
            location: {
              city: "$location.city",
              state: "$location.state",
              zipcode: "$location.zipcode",
              formatted: "$location.formatted",
            },
            pricing: {
              bartendersRequested: "$pricing.bartendersRequested",
              hourlyRate: "$pricing.hourlyRate",
              estimatedTotal: "$pricing.estimatedTotal",
            },
            payment: {
              total: "$payment.total",
              paidTotal: "$recordedPaidTotal",
              balance: {
                $max: [
                  {
                    $subtract: ["$payment.total", "$recordedPaidTotal"],
                  },
                  0,
                ],
              },
              status: {
                $switch: {
                  branches: [
                    {
                      case: {
                        $and: [
                          {
                            $gt: ["$payment.total", 0],
                          },
                          {
                            $gte: [
                              "$recordedPaidTotal",
                              "$payment.total",
                            ],
                          },
                        ],
                      },
                      then: "paid_in_full",
                    },
                    {
                      case: { $gt: ["$recordedPaidTotal", 0] },
                      then: "partially_paid",
                    },
                  ],
                  default: "none",
                },
              },
            },
            guestCount: 1,
            createdAt: 1,
            updatedAt: 1,
          },
        },
        // sort param like "-startAt" or "startAt"
        (() => {
          const field = String(sort).replace(/^-/, "");
          const dir = String(sort).startsWith("-") ? -1 : 1;
          return { $sort: { [field]: dir, _id: 1 } };
        })(),
        {
          $facet: {
            rows: [{ $skip: skip }, { $limit: lim }],
            total: [{ $count: "n" }],
          },
        },
        {
          $project: {
            rows: 1,
            total: { $ifNull: [{ $arrayElemAt: ["$total.n", 0] }, 0] },
          },
        },
      ];

      const [result] = await Event.aggregate(pipeline);
      const total = result?.total || 0;
      const rows = result?.rows || [];

      return res.json({
        success: true,
        data: rows,
        page: Number(page) || 1,
        limit: lim,
        total,
        hasNext: skip + rows.length < total,
      });
    } catch (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
  },

  sendDueEventReminders: async (req, res) => {
    try {
      const now = new Date();
      const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const in5m = new Date(now.getTime() + 5 * 60 * 1000);
      const activeStatuses = { $nin: ["completed", "closed", "canceled"] };
      const sent = {
        bartender24h: 0,
        customer24h: 0,
        bartender5m: 0,
        customer5m: 0,
        bartenderClockOut5m: 0,
      };

      const events24h = await Event.find({
        status: activeStatuses,
        startAt: { $gt: now, $lte: in24h },
        $or: [{ bartender24hReminderSentAt: null }, { customer24hReminderSentAt: null }],
      }).lean();

      for (const evt of events24h) {
        const assignments = await Assignment.find({ event: evt._id, status: "active" })
          .populate("bartenderUser", "fullName email phone profile.photo")
          .lean();
        const bartenders = assignments.map((assignment) => assignment.bartenderUser).filter(Boolean);
        const facts = buildCoreEventFacts({ evt, urgent: true });
        const teamHtml = buildBartenderLinesHtml(bartenders, true, { includePhotos: true });
        const clockInUrl = bartenderScheduleLink();
        const verifyUrl = eventLink(evt, "review");

        if (!evt.bartender24hReminderSentAt && bartenders.length) {
          await Promise.all(
            bartenders
              .filter((bartender) => bartender.email)
              .map((bartender) =>
                sendEmail?.({
                  to: bartender.email,
                  subject: `Tipsyverse 24-hour reminder — ${evt.shortCode}`,
                  title: `Event Tomorrow: ${evt.shortCode}`,
                  html: `
                    <p>Reminder: you are assigned to a <strong>${formatEventType(evt.type)}</strong> event.</p>
                    <ul>
                      <li><strong>When:</strong> ${facts.when}</li>
                      <li><strong>Where:</strong> ${facts.where}</li>
                      <li><strong>Main contact:</strong> ${buildMainContactLine(evt, true)}</li>
                      <li><strong>Description:</strong> ${facts.description}</li>
                      <li><strong>Tips:</strong> ${facts.tips}</li>
                      <li><strong>Estimated Gig Pay:</strong> ${estimatedGigPay(evt)}</li>
                      <li><strong>Instructions:</strong> ${facts.urgentOnly.additionalInstructions || "None"}</li>
                    </ul>
                    <p><strong>Bartending with you:</strong></p>
                    <ul>${teamHtml || "<li>Team details will appear in your schedule.</li>"}</ul>
                    <p><a href="${clockInUrl}" style="display:inline-block;background:#800020;color:#fff;padding:10px 14px;border-radius:6px;text-decoration:none;">Open Schedule</a></p>
                  `,
                })
              )
          );

          await sendNotification?.({
            type: "event_reminder",
            entity: evt._id,
            entityId: evt._id,
            entityModel: "Event",
            actor: { id: req.user?.id },
            recipients: bartenders.map((bartender) => ({ id: bartender._id })),
            slug: "bartend/schedule",
            messageBase: `24-hour reminder for event ${evt.shortCode}`,
          });
          await Event.findByIdAndUpdate(evt._id, { bartender24hReminderSentAt: now });
          sent.bartender24h += bartenders.length;
        }

        if (!evt.customer24hReminderSentAt && evt.contact?.email) {
          await sendEmail?.({
            to: evt.contact.email,
            subject: `Tipsyverse 24-hour reminder — ${evt.shortCode}`,
            title: `Your Event Is Tomorrow: ${evt.shortCode}`,
            html: `
              <p>Hi ${safeText(evt.contact.fullName, "")},</p>
              <p>Your Tipsyverse event is coming up soon.</p>
              <ul>
                <li><strong>When:</strong> ${facts.when}</li>
                <li><strong>Where:</strong> ${facts.where}</li>
                <li><strong>Description:</strong> ${facts.description}</li>
                <li><strong>Tips:</strong> ${facts.tips}</li>
              </ul>
              <p><strong>Assigned Bartenders:</strong></p>
              <ul>${teamHtml || "<li>Team details will appear in your dashboard.</li>"}</ul>
              <p><a href="${verifyUrl}" style="display:inline-block;background:#800020;color:#fff;padding:10px 14px;border-radius:6px;text-decoration:none;">Open Event Details</a></p>
            `,
          });

          if (evt.organizer) {
            await sendNotification?.({
              type: "event_reminder",
              entity: evt._id,
              entityId: evt._id,
              entityModel: "Event",
              actor: { id: req.user?.id },
              recipients: [{ id: evt.organizer }],
              slug: `my-events/${evt._id}/review`,
              messageBase: `24-hour reminder for your event ${evt.shortCode}`,
            });
          }
          await Event.findByIdAndUpdate(evt._id, { customer24hReminderSentAt: now });
          sent.customer24h += 1;
        }
      }

      const events5m = await Event.find({
        status: activeStatuses,
        startAt: { $lte: in5m },
        endAt: { $gte: now },
        $or: [{ bartender5mReminderSentAt: null }, { customer5mReminderSentAt: null }],
      }).lean();

      for (const evt of events5m) {
        const assignments = await Assignment.find({ event: evt._id, status: "active" })
          .populate("bartenderUser", "fullName email")
          .lean();
        const bartenders = assignments.map((assignment) => assignment.bartenderUser).filter(Boolean);
        const clockInUrl = bartenderScheduleLink();
        const verifyUrl = eventLink(evt, "review");

        if (!evt.bartender5mReminderSentAt && bartenders.length) {
          await Promise.all(
            bartenders
              .filter((bartender) => bartender.email)
              .map((bartender) =>
                sendEmail?.({
                  to: bartender.email,
                  subject: `Tipsyverse clock-in reminder — ${evt.shortCode}`,
                  title: `Time To Clock In`,
                  html: `
                    <p>Your event starts shortly. Please clock in when you arrive.</p>
                    <p><a href="${clockInUrl}" style="display:inline-block;background:#800020;color:#fff;padding:10px 14px;border-radius:6px;text-decoration:none;">Clock In</a></p>
                  `,
                })
              )
          );
          await sendNotification?.({
            type: "event_reminder",
            entity: evt._id,
            entityId: evt._id,
            entityModel: "Event",
            actor: { id: req.user?.id },
            recipients: bartenders.map((bartender) => ({ id: bartender._id })),
            slug: "bartend/schedule",
            messageBase: `Clock-in reminder for event ${evt.shortCode}`,
          });
          await Event.findByIdAndUpdate(evt._id, { bartender5mReminderSentAt: now });
          sent.bartender5m += bartenders.length;
        }

        if (!evt.customer5mReminderSentAt && evt.contact?.email) {
          await sendEmail?.({
            to: evt.contact.email,
            subject: `Tipsyverse attendance reminder — ${evt.shortCode}`,
            title: `Bartender Attendance Verification`,
            html: `
              <p>Your event starts shortly. Once bartenders arrive, you can verify who is present.</p>
              <p><a href="${verifyUrl}" style="display:inline-block;background:#800020;color:#fff;padding:10px 14px;border-radius:6px;text-decoration:none;">Verify Attendance</a></p>
            `,
          });
          if (evt.organizer) {
            await sendNotification?.({
              type: "event_reminder",
              entity: evt._id,
              entityId: evt._id,
              entityModel: "Event",
              actor: { id: req.user?.id },
              recipients: [{ id: evt.organizer }],
              slug: `my-events/${evt._id}/review`,
              messageBase: `Verify bartender attendance for event ${evt.shortCode}`,
            });
          }
          await Event.findByIdAndUpdate(evt._id, { customer5mReminderSentAt: now });
          sent.customer5m += 1;
        }
      }

      const eventsClockOut5m = await Event.find({
        status: activeStatuses,
        endAt: { $gt: now, $lte: in5m },
        bartenderClockOut5mReminderSentAt: null,
      }).lean();

      for (const evt of eventsClockOut5m) {
        const assignments = await Assignment.find({ event: evt._id, status: "active" })
          .populate("bartenderUser", "fullName email")
          .lean();
        const bartenders = assignments.map((assignment) => assignment.bartenderUser).filter(Boolean);
        if (!bartenders.length) continue;

        const clockOutUrl = bartenderScheduleLink();
        await Promise.all(
          bartenders
            .filter((bartender) => bartender.email)
            .map((bartender) =>
              sendEmail?.({
                to: bartender.email,
                subject: `Tipsyverse clock-out reminder — ${evt.shortCode}`,
                title: `Time To Clock Out`,
                html: `
                  <p>Your event is ending shortly. Please clock out when your shift is complete.</p>
                  <p><a href="${clockOutUrl}" style="display:inline-block;background:#800020;color:#fff;padding:10px 14px;border-radius:6px;text-decoration:none;">Clock Out</a></p>
                `,
              })
            )
        );

        await sendNotification?.({
          type: "event_reminder",
          entity: evt._id,
          entityId: evt._id,
          entityModel: "Event",
          actor: { id: req.user?.id },
          recipients: bartenders.map((bartender) => ({ id: bartender._id })),
          slug: "bartend/schedule",
          messageBase: `Clock-out reminder for event ${evt.shortCode}`,
        });
        await Event.findByIdAndUpdate(evt._id, { bartenderClockOut5mReminderSentAt: now });
        sent.bartenderClockOut5m += bartenders.length;
      }

      return res.json({ success: true, data: sent });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },


  updateEvent: async (req, res) => {
    try {
      const { id } = req.params;

      const evt = await Event.findById(id);
      if (!evt) {
        return res.status(404).json({ success: false, message: "Not found" });
      }

      // ✅ TRUE "before" snapshot (plain object) BEFORE any changes
      const beforeDoc = evt.toObject({ depopulate: true });

      // Allowed fields
      const allowedTopLevel = new Set([
        "type",
        "description",
        "additionalInstructions",
        "startAt",
        "endAt",
        "contact",
        "additionalContacts",
        "location",
        "options",
        "guestCount",
        "preferredBartenders",
        "needs",
        "billingAddress",
        "paymentMethod",
        "status",
        "visibility",
        "pricing",
        "counts",
        "private",
        "bartenderNotes",
        "internalNotes",
        "timezone",
      ]);

      const body = req.body || {};
      const patch = {};

      // Guard immutables
      if ("shortCode" in body) {
        return res
          .status(400)
          .json({ success: false, message: "shortCode is immutable" });
      }

      // Build patch safely
      for (const key of Object.keys(body)) {
        if (!allowedTopLevel.has(key)) continue;

        if (key === "contact") {
          patch.contact = normalizeContact(body.contact);
          continue;
        }

        if (key === "additionalContacts") {
          patch.additionalContacts = (
            Array.isArray(body.additionalContacts)
              ? body.additionalContacts
              : []
          )
            .map(normalizeContact)
            .filter(Boolean);
          continue;
        }

        if (key === "location") {
          patch.location = normalizeLocation(body.location, evt.location);
          continue;
        }

        if (key === "options") {
          const incomingOptions = body.options || {};
          const normalizedProcurementItems = Array.isArray(
            incomingOptions.procurementItems
          )
            ? incomingOptions.procurementItems
                .map((item) => ({
                  name: String(item?.name || item?.item || "").trim(),
                  qty: Math.max(1, Number(item?.qty) || 1),
                  pickedUp: !!item?.pickedUp,
                }))
                .filter((item) => item.name)
            : evt.options?.procurementItems || [];
          const procurementActualCost = Math.max(
            0,
            Number(
              incomingOptions.procurementActualCost ??
                evt.options?.procurementActualCost ??
                0
            ) || 0
          );
          patch.options = {
            ...(evt.options?.toObject?.() || evt.options || {}),
            ...incomingOptions,
            barType: incomingOptions.barType ?? evt.options?.barType ?? "unknown",
            procurementRequested: !!(
              incomingOptions.procurementRequested ??
              evt.options?.procurementRequested
            ),
            procurementItems: normalizedProcurementItems,
            procurementActualCost,
            procurementReceiptProof: String(
              incomingOptions.procurementReceiptProof ??
                evt.options?.procurementReceiptProof ??
                ""
            ).trim(),
            procurementReceiptPublicId: String(
              incomingOptions.procurementReceiptPublicId ??
                evt.options?.procurementReceiptPublicId ??
                ""
            ).trim(),
            procurementReceiptNotes: String(
              incomingOptions.procurementReceiptNotes ??
                evt.options?.procurementReceiptNotes ??
                ""
            ).trim(),
            procurementBilledAt:
              procurementActualCost > 0
                ? incomingOptions.procurementBilledAt ||
                  evt.options?.procurementBilledAt ||
                  new Date()
                : null,
            tipJarsAllowed: !!(
              incomingOptions.tipJarsAllowed ??
              evt.options?.tipJarsAllowed ??
              true
            ),
          };
          continue;
        }

        if (key === "pricing") {
          patch.pricing = {
            ...(evt.pricing?.toObject?.() || evt.pricing || {}),
            ...(body.pricing || {}),
          };

          // ✅ normalize numeric fields defensively (optional but recommended)
          if (patch.pricing.hourlyRate != null)
            patch.pricing.hourlyRate = Math.max(
              0,
              Number(patch.pricing.hourlyRate) || 0
            );

          if (patch.pricing.bookingFee != null)
            patch.pricing.bookingFee = Math.max(
              0,
              Number(patch.pricing.bookingFee) || 0
            );

          if (patch.pricing.publicFee != null)
            patch.pricing.publicFee = Math.max(
              0,
              Number(patch.pricing.publicFee) || 0
            );

          if (patch.pricing.setupHours != null)
            patch.pricing.setupHours = Math.max(
              0,
              Number(patch.pricing.setupHours) || 0
            );

          if (patch.pricing.breakdownHours != null)
            patch.pricing.breakdownHours = Math.max(
              0,
              Number(patch.pricing.breakdownHours) || 0
            );

          if (patch.pricing.bartendersRequested != null)
            patch.pricing.bartendersRequested = Math.max(
              1,
              Number(patch.pricing.bartendersRequested) || 1
            );

          // ✅ IMPORTANT: schema mismatch fix (UI: procurementFee, DB: procurementServiceFee)
          if (
            patch.pricing.procurementFee != null &&
            patch.pricing.procurementServiceFee == null
          ) {
            patch.pricing.procurementServiceFee = Math.max(
              0,
              Number(patch.pricing.procurementFee) || 0
            );
          }
          // Prevent the wrong key from lingering
          if ("procurementFee" in patch.pricing)
            delete patch.pricing.procurementFee;

          // keep counts in sync
          patch.counts = {
            ...(evt.counts?.toObject?.() || evt.counts || {}),
            ...(patch.counts || {}),
            neededBartenders: Number(patch.pricing.bartendersRequested) || 1,
          };

          continue;
        }

        if (key === "counts") {
          const incoming = body.counts || {};
          patch.counts = {
            ...(evt.counts?.toObject?.() || evt.counts || {}),
            ...incoming,
          };
          continue;
        }

        // default shallow set
        patch[key] = body[key];
      }

      if (patch.options) {
        const beforeProcurementCost =
          Number(beforeDoc.options?.procurementActualCost) || 0;
        const afterProcurementCost =
          Number(patch.options.procurementActualCost) || 0;
        const procurementCostDelta =
          Math.round((afterProcurementCost - beforeProcurementCost) * 100) /
          100;

        if (procurementCostDelta !== 0) {
          const currentPayment = evt.payment?.toObject?.() || evt.payment || {};
          patch.payment = {
            ...currentPayment,
            subtotal: Math.max(
              0,
              Math.round(
                ((Number(currentPayment.subtotal) || 0) +
                  procurementCostDelta) *
                  100
              ) / 100
            ),
            total: Math.max(
              0,
              Math.round(
                ((Number(currentPayment.total) || 0) + procurementCostDelta) *
                  100
              ) / 100
            ),
          };
        }
      }

      // Apply patch onto doc (so mongoose validation/hooks run)
      for (const [k, v] of Object.entries(patch)) {
        evt.set(k, v);
      }

      // Validate temporal logic
      if (evt.startAt && evt.endAt && evt.endAt <= evt.startAt) {
        return res
          .status(400)
          .json({ success: false, message: "endAt must be after startAt" });
      }

      // Save updates
      await evt.save();

      // ✅ AFTER snapshot
      const afterDoc = evt.toObject({ depopulate: true });

      // Diff (use whichever diff you like; this keeps your existing flow)
      const changes = shallowDiff(beforeDoc, afterDoc);

      // ✅ totals computed from true before/after objects
      const beforeTotals = computeEventTotals(beforeDoc);
      const afterTotals = computeEventTotals(afterDoc);

      // ✅ Email only when appropriate
      const CUSTOMER_VISIBLE_PREFIXES = [
        "type",
        "description",
        "additionalInstructions",
        "startAt",
        "endAt",
        "location",
        "options",
        "guestCount",
        "pricing",
        "needs",
        "preferredBartenders",
      ];

      const hasCustomerVisibleChange =
        Array.isArray(changes) &&
        changes.some((c) =>
          CUSTOMER_VISIBLE_PREFIXES.some(
            (p) => c.path === p || c.path?.startsWith(p + ".")
          )
        );

      const shouldEmailCustomer =
        evt.status !== "submitted" &&
        !!evt.contact?.email &&
        hasCustomerVisibleChange;

      if (shouldEmailCustomer) {
        try {
          // Optional: if you want names instead of ObjectIds in email
          await evt.populate([
            {
              path: "preferredBartenders",
              select: "fullName bartenderProfile.stageName email",
            },
          ]);

          const { subject, html, text } = buildEventUpdatedEmail({
            evt, // populated doc is fine if your email builder uses it
            beforeTotals,
            afterTotals,
            beforeDoc,
            afterDoc,
            changes,
          });

          await sendEmail({
            to: evt.contact.email,
            title: `Tipsyverse Event ${evt.shortCode} Updated`,
            subject,
            html,
            text,
          });
        } catch (e) {
          // Don't fail the update if email fails
          console.error("Event update email failed:", e);
        }
      }

      const bartenderVisibleChanges = confirmedBartenderChangeSummary(
        beforeDoc,
        afterDoc
      );
      const shouldEmailAssignedBartenders =
        beforeDoc.status === "confirmed" &&
        afterDoc.status === "confirmed" &&
        bartenderVisibleChanges.length > 0;

      if (shouldEmailAssignedBartenders) {
        try {
          const assignments = await Assignment.find({
            event: evt._id,
            status: "active",
          })
            .populate("bartenderUser", "fullName email")
            .lean();

          const assignedBartenderEmails = [
            ...new Set(
              assignments
                .map((assignment) => assignment.bartenderUser?.email)
                .filter(Boolean)
            ),
          ];

          if (assignedBartenderEmails.length) {
            const { subject, html } =
              buildConfirmedEventUpdateEmailForBartender({
                evt: afterDoc,
                changes: bartenderVisibleChanges,
              });

            await sendEmail({
              to: assignedBartenderEmails,
              title: `Tipsyverse Event ${evt.shortCode} Updated`,
              subject,
              html,
            });
          }
        } catch (e) {
          console.error("Assigned bartender event update email failed:", e);
        }
      }

      // Activity log
      await req.logActivity?.({
        action: "update",
        target: { model: "Event", id: evt._id },
        actor: {
          type: "User",
          id: req.user?.id,
          label: {
            fullName: req.user?.fullName,
            email: req.user?.email,
            role: req.user?.role,
          },
        },
        changes,
        summary: "Event updated",
        meta: { changed: (changes || []).map((c) => c.path) },
      });

      return res.json({
        success: true,
        data: evt,
        changed: changes,
        totals: { before: beforeTotals, after: afterTotals },
        emailedCustomer: shouldEmailCustomer,
      });
    } catch (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
  },
  /**
   * Assumptions (adjust as needed):
   * - public  : { private: false, status not 'canceled', startAt >= now }
   * - my      : user is main contact OR organizer:
   *             organizer == req.user.id OR contact.userId == req.user.id OR contact.email == req.user.email
   * - available: needs staffing (ready_to_assign/bidding/selecting),
   *              counts.assigned < counts.neededBartenders,
   *              startAt >= now, not canceled
   * - assigned: user is in assignments[] (role bartender/employee), not canceled, startAt >= now
   * - upcoming: any event not canceled with startAt >= now (all visibility)
   */
  getEventCounts: async (req, res) => {
    try {
      const userId = req.user?.id; // set by your auth middleware
      const userEmail = req.user?.email?.toLowerCase();
      const now = new Date();

      // Common “not canceled & in the future” filter
      const notCanceledAndFuture = {
        status: { $ne: "canceled" },
        startAt: { $gte: now },
      };

      // PUBLIC
      const publicMatch = {
        ...notCanceledAndFuture,
        private: false,
      };

      // MY EVENTS (main contact for event if any)
      // Flexible: organizer OR contact.userId OR contact.email
      const myMatch = userId
        ? {
            ...notCanceledAndFuture,
            $or: [
              { organizer: userId },
              { "contact.userId": userId },
              ...(userEmail
                ? [
                    {
                      "contact.email": new RegExp(
                        `^${escapeRegex(userEmail)}$`,
                        "i"
                      ),
                    },
                  ]
                : []),
            ],
          }
        : { _id: null }; // if unauthenticated, result will be 0

      // AVAILABLE (needs staffing)
      const availableMatch = {
        ...notCanceledAndFuture,
        status: { $in: ["ready_to_assign", "bidding", "selecting"] },
        $expr: {
          $lt: [
            { $ifNull: ["$counts.assigned", 0] },
            { $ifNull: ["$counts.neededBartenders", 0] },
          ],
        },
      };

      // ASSIGNED (this user is assigned as bartender/employee)
      const assignedMatch = userId
        ? {
            ...notCanceledAndFuture,
            assignments: {
              $elemMatch: {
                user: userId,
                // optional role/status filters:
                // role: { $in: ["bartender", "staff"] },
                // status: { $ne: "declined" },
              },
            },
          }
        : { _id: null };

      // UPCOMING (all future, not canceled)
      const upcomingMatch = {
        ...notCanceledAndFuture,
      };

      // Run in parallel
      const [
        publicCount,
        myCount,
        availableCount,
        assignedCount,
        upcomingCount,
      ] = await Promise.all([
        Event.countDocuments(publicMatch),
        Event.countDocuments(myMatch),
        Event.countDocuments(availableMatch),
        Event.countDocuments(assignedMatch),
        Event.countDocuments(upcomingMatch),
      ]);

      return res.json({
        success: true,
        data: {
          public: publicCount,
          my: myCount,
          available: availableCount,
          assigned: assignedCount,
          upcoming: upcomingCount,
        },
      });
    } catch (err) {
      console.error(err);
      return res
        .status(500)
        .json({ success: false, message: "Failed to get counts" });
    }
  },

  // small helper for safe reg

  /** 6) cancelRequest: by client or staff */
  cancelRequest: async (req, res) => {
    try {
      const { id } = req.params;
      const { cancelReason, cancelReasonOther } = req.body;

      const evt = await Event.findById(id);
      if (!evt)
        return res.status(404).json({ success: false, message: "Not found" });

      // Optional: don't double-cancel
      if (evt.status === "canceled") {
        return res
          .status(400)
          .json({ success: false, message: "Event is already canceled" });
      }

      // ✅ apply cancel metadata
      evt.status = "canceled";
      evt.canceledAt = new Date();
      evt.canceledBy = req.user?.id || req.user?._id || null;
      evt.cancelReason = cancelReason || null;
      evt.cancelReasonOther =
        cancelReason === "other" && cancelReasonOther
          ? String(cancelReasonOther).trim()
          : null;

      await evt.save();

      // notify interested + assigned bartenders
      const [assignments, bids] = await Promise.all([
        Assignment.find({ event: id }),
        Bid.find({ event: id }),
      ]);

      const recipients = [
        ...assignments.map((a) => ({ id: a.bartenderUser })),
        ...bids
          .filter((b) => ["interested", "waitlist"].includes(b.status))
          .map((b) => ({ id: b.bartenderUser })),
      ];

      if (recipients.length) {
        await sendNotification?.({
          type: "event_canceled",
          entity: id,
          entityId: id,
          entityModel: "Event",
          actor: { id: req.user?.id },
          recipients,
          slug: "my-events",
          messageBase: "Event was canceled",
        });
      }

      // Build human readable date formatting
      const eventDate = new Date(evt.startAt).toLocaleString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });

      // Final formatted reason
      const reasonText =
        evt.cancelReasonOther ||
        (evt.cancelReason ? evt.cancelReason.replace(/_/g, " ") : null) ||
        "No specific reason was provided.";

      // 📧 Send cancellation confirmation email
      await sendEmail?.({
        to: evt.contact.email,
        cc: ["finance@tipsyverse.com"],
        subject: `Tipsyverse - Requested Event #${evt.shortCode} Canceled`,
        title: `Requested Event Canceled`,
        html: `
    <p>Hi ${evt.contact.fullName},</p>

    <p>This message is to confirm that your event request has been <strong>successfully canceled</strong>.</p>

    <p><strong>Event Details:</strong><br/>
      • <strong>Event Type:</strong> ${formatEventType(evt.type)}<br/>
      • <strong>Date & Time:</strong> ${eventDate}<br/>
      • <strong>Location:</strong> ${evt.location?.formatted || "Not specified"}
    </p>

    <p><strong>Cancellation Reason:</strong><br/>
      ${reasonText}
    </p>

    <p>If this cancellation was made in error or you’d like to submit a new event request, feel free to reach out anytime.</p>

    <p>Thank you,<br/>The Tipsyverse Team</p>
  `,
      });

      await req.logActivity?.({
        action: "cancel", // was "delete" before; this is more accurate
        target: { model: "Event", id },
        actor: {
          type: "User",
          id: req.user?.id,
          label: {
            fullName: req.user?.fullName,
            email: req.user?.email,
            role: req.user?.role,
          },
        },
        summary: "Event request canceled",
        meta: {
          cancelReason: evt.cancelReason,
          cancelReasonOther: evt.cancelReasonOther,
        },
      });

      return res.json({ success: true, data: evt });
    } catch (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
  },

  /** 7) sendToAssign: confirms event details and moves to ready_to_assign */
  sendToAssign: async (req, res) => {
    try {
      const { id } = req.params;
      const { depositPct, depositAmount, couponCode } = req.body;

      const evt = await Event.findById(id).lean();
      if (!evt)
        return res.status(404).json({ success: false, message: "Not found" });

      // 1) compute base totals (pre-coupon)
      const computedTotals = computeEventTotals({
        ...evt,
        pricing: {
          ...(evt.pricing || {}),
          publicFee: evt.private === false ? evt.pricing?.publicFee || 0 : 0,
        },
      });
      const subtotal = Math.round((computedTotals.flatSubtotal || 0) * 100) / 100;
      const lineItems = Object.fromEntries(
        Object.entries(computedTotals.lineItems || {}).map(([key, value]) => [
          key,
          Math.round((Number(value) || 0) * 100) / 100,
        ])
      );
      const gratuity =
        Math.round((computedTotals.lineItems?.gratuity || 0) * 100) / 100;
      const total = Math.round((computedTotals.total || 0) * 100) / 100;
      const procurementActualCost = Math.max(
        0,
        Math.round((Number(evt.options?.procurementActualCost) || 0) * 100) /
          100
      );

      const missingConfirmationDetails = [];
      if (!evt.options?.barType || evt.options.barType === "unknown") {
        missingConfirmationDetails.push("bar type");
      }
      if (total <= 0) {
        missingConfirmationDetails.push("payment total");
      }
      if (missingConfirmationDetails.length) {
        return res.status(400).json({
          success: false,
          message: `Cannot move to assignment until ${missingConfirmationDetails.join(
            " and "
          )} is saved.`,
        });
      }

      // 2) coupon lookup & apply (to TOTAL)
      const coupon = await lookupCoupon(couponCode);
      const { discountedTotal, applied } = applyCouponToTotal(total, coupon);
      const billedTotal =
        Math.round((discountedTotal + procurementActualCost) * 100) / 100;

      // 3) compute deposit after coupon (or fixed deposit coupon)
      const finalDeposit = calcDepositWithCoupon({
        totalAfterDiscount: billedTotal,
        baseDepositPct: depositPct,
        baseDepositAmount: depositAmount,
        coupon,
      });
      const recordedPaymentRows = await Payment.aggregate([
        {
          $match: {
            event: new mongoose.Types.ObjectId(id),
            status: "recorded",
          },
        },
        {
          $group: {
            _id: "$event",
            paidTotal: { $sum: "$amount" },
          },
        },
      ]);
      const amountPaid =
        Math.round((Number(recordedPaymentRows[0]?.paidTotal) || 0) * 100) /
        100;
      const balanceDue =
        Math.max(0, Math.round((billedTotal - amountPaid) * 100) / 100);

      // 4) persist event payment snapshot + status + history
      await Event.updateOne(
        { _id: id },
        {
          $set: {
            status: "ready_to_assign",
            "payment.depositStatus": "none",
            "payment.depositAmount": finalDeposit,
            "payment.subtotal":
              Math.round((subtotal + procurementActualCost) * 100) / 100,
            "payment.gratuity": gratuity,
            "payment.total": billedTotal, // store the discounted grand total plus receipt-backed procurement
            "pricing.bartendersRequested": computedTotals.bartenders,
            "counts.neededBartenders": computedTotals.bartenders,
            // Optional: snapshot coupon on the payment
            ...(applied || coupon
              ? {
                  "payment.coupon": {
                    code: coupon?.code || couponCode || null,
                    type: coupon?.type || null,
                    value: coupon?.value ?? null,
                    amountOffTotal: applied?.amountOffTotal ?? 0,
                  },
                }
              : {}),
          },
        }
      );
      const autoBid = await ensureAutoBidForEvent(id);

      await sendEmail?.({
        to: evt.contact.email,
        cc: ["finance@tipsyverse.com"],
        subject: `Tipsyverse - Confirmation Event #${evt.shortCode}`,
        title: `Confirmation for Event #${evt.shortCode}`,
        html: paymentReceiptHTML({
          intro:
            "Thank you! Your event has been confirmed and moved into assignment.",
          nextStep:
            "We are now assigning your bartenders. You'll receive another update when the team is confirmed.",
          evt,
          subtotal,
          gratuity,
          totalBeforeDiscount: total,
          discountedTotal: billedTotal,
          deposit: finalDeposit,
          amountPaid,
          balanceDue,
          coupon: applied,
          lineItems: {
            ...lineItems,
            ...(procurementActualCost > 0
              ? { procurementActualCost }
              : {}),
          },
        }),
      });

      await req.logActivity?.({
        action: "update",
        target: { model: "Event", id },
        actor: {
          type: "User",
          id: req.user?.id,
          label: {
            fullName: req.user?.fullName,
            email: req.user?.email,
            role: req.user?.role,
          },
        },
        summary: "Moved to ready_to_assign",
        meta: {
          totalBefore: total,
          totalAfter: billedTotal,
          procurementActualCost,
          autoBid,
          coupon:
            applied ||
            (coupon?.type === "FIXED_DEPOSIT"
              ? { code: coupon.code, type: coupon.type, value: coupon.value }
              : null),
        },
      });

      // 8) If urgent, notify bartenders right away (broadcast)
      if (isUrgentEvent(evt.startAt, 48)) {
        // TODO: Replace with your actual bartender query (opted-in to urgent alerts, within radius, etc.)
        // const bartenders = await User.find({ role: "bartender", "prefs.alerts.urgent": true }).lean();
        const recipients = []; // bartenders.map(b => ({ id: b._id }));
        if (recipients.length) {
          await sendNotification?.({
            type: "event_urgent",
            entity: id,
            entityId: id,
            entityModel: "Event",
            actor: { id: req.user?.id },
            recipients,
            slug: "bartend",
            messageBase: "Urgent event needs coverage",
          });
        }
      }

      const updatedEvent = await Event.findById(id).lean();

      return res.json({
        success: true,
        data: updatedEvent,
        assignment: {
          totalBefore: total,
          totalAfter: billedTotal,
          autoBid,
          coupon:
            applied ||
            (coupon?.type === "FIXED_DEPOSIT"
              ? { code: coupon.code, type: coupon.type, value: coupon.value }
              : null),
        },
      });
    } catch (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
  },

  // Assign 1..n bartenders to an event
 assignSelectedBartenders: async (req, res) => {
  // ✅ Basic validation BEFORE session
  const { id } = req.params; // event id
  const { bidIds = [] } = req.body; // array<ObjectId|string>

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({
      success: false,
      message: "A valid event ID is required before assigning bartenders.",
    });
  }

  if (!Array.isArray(bidIds) || bidIds.length === 0) {
    return res.status(400).json({ success: false, message: "bidIds required" });
  }

  const session = await mongoose.startSession();

  // We'll store data we need for emails/notifications outside tx
  let evt;
  let selectedBartenderIds = [];
  let selectedBartenders = [];
  let assignedCount = 0;
  let needed = 0;

  try {
    session.startTransaction();

    evt = await Event.findById(id).session(session);
    if (!evt) throw new Error("Event not found");

    const ALLOW = new Set(["ready_to_assign", "selecting", "confirmed", "bidding"]);
    if (!ALLOW.has(evt.status)) evt.status = "selecting";

    // 🔹 Fetch the bids for this event & validate they belong to it
    const bids = await Bid.find({
      _id: { $in: bidIds },
      event: id,
    })
      .session(session)
      .lean();

    if (!bids.length) throw new Error("No valid bids found for this event.");

    // (Optional) strict check: all bidIds must belong to this event
    if (bids.length !== bidIds.length) {
      console.warn("Some bidIds do not belong to this event or do not exist:", bidIds);
    }

    // 🔹 Derive unique bartenderIds from the bids
    const bartenderIdSet = new Set(bids.map((b) => String(b.bartenderUser)).filter(Boolean));
    const bartenderIds = Array.from(bartenderIdSet);

    if (!bartenderIds.length) throw new Error("No bartenders found for these bids.");

    // How many bartenders are needed?
    needed = evt.pricing?.bartendersRequested ?? evt.counts?.neededBartenders ?? 0;

    // Hard fail if they try to assign too many
    if (needed > 0 && bartenderIds.length > needed) {
      await session.abortTransaction().catch(() => {});
      session.endSession();
      return res.status(400).json({
        success: false,
        message: `You can only assign up to ${needed} bartender(s) for this event.`,
      });
    }

    selectedBartenderIds = bartenderIds;

    // Create assignments
    const toInsert = [];
    for (const uid of selectedBartenderIds) {
      let assignment = await Assignment.findOne({
        event: id,
        bartenderUser: uid,
      }).session(session);

      if (!assignment) {
        toInsert.push({
          event: id,
          bartenderUser: uid,
          assignedAt: new Date(),
          notified: true,
          status: "active",
        });
      } else if (assignment.status === "removed") {
        assignment.status = "active";
        assignment.assignedAt = new Date();
        assignment.notified = true;
        assignment.reason = null;
        await assignment.save({ session });
      }
    }

    if (toInsert.length) {
      await Assignment.insertMany(toInsert, { session });
    }

    assignedCount = await Assignment.countDocuments({
      event: id,
      status: "active",
    }).session(session);

    evt.counts = { ...(evt.counts || {}), assigned: assignedCount };

    if (assignedCount >= needed && needed > 0) {
      if (evt.status === "selecting" || evt.status === "ready_to_assign" || evt.status === "bidding") {
        evt.status = "confirmed";
      }
    } else {
      evt.status = "selecting";
    }

    await evt.save({ session });

    // 🔹 Mark bids as selected vs waitlist (INSIDE tx)
    await Bid.updateMany(
      { event: id, bartenderUser: { $nin: selectedBartenderIds }, status: "interested" },
      { $set: { status: "waitlist" } },
      { session }
    );

    await Bid.updateMany(
      { event: id, bartenderUser: { $in: selectedBartenderIds }, status: { $in: ["interested", "waitlist"] } },
      { $set: { status: "selected" } },
      { session }
    );

    // ✅ Commit DB changes first
    await session.commitTransaction();
    session.endSession();

    // -------------------------
    // AFTER COMMIT: Emails/Notifications
    // -------------------------

    // 🔹 Fetch selected bartenders
    selectedBartenders = await User.find(
      { _id: { $in: selectedBartenderIds } },
      "fullName email phone profile.photo"
    ).lean();

    // ✅ urgent + core facts
    const urgent = isUrgentEvent(evt.startAt, 24);
    const facts = buildCoreEventFacts({ evt, urgent });

    // ✅ privacy-aware bartender list for customer email
    const bartenderListHtml = buildBartenderLinesHtml(selectedBartenders, urgent, { includePhotos: true });
    const bartenderTeamHtml = buildBartenderLinesHtml(selectedBartenders, urgent, { includePhotos: true });
    const clockInUrl = bartenderScheduleLink();
    const verifyUrl = eventLink(evt, "review");

    // ✅ bartender email HTML (privacy-aware)
    const htmlForBartender = `
      <p>You’ve been assigned to a <strong>${formatEventType(evt.type)}</strong> event.</p>

      <ul>
        <li><strong>When:</strong> ${facts.when}</li>
        <li><strong>Where:</strong> ${facts.where}</li>
        <li><strong>Guests:</strong> ${facts.guestCount}</li>
        <li><strong>Bartenders:</strong> ${facts.bartendersCount}</li>
        <li><strong>Bar Type:</strong> ${facts.barType}</li>
        <li><strong>Description:</strong> ${facts.description}</li>
        <li><strong>Tips:</strong> ${facts.tips}</li>
        <li><strong>Bartender Notes:</strong> ${facts.bartenderNotes}</li>
        <li><strong>Estimated Gig Pay:</strong> ${estimatedGigPay(evt)}</li>
      </ul>

      <p><strong>Bartending with you:</strong></p>
      <ul>${bartenderTeamHtml || "<li>Team details will appear in your schedule.</li>"}</ul>

      ${
        urgent
          ? `
            <hr style="margin:16px 0;" />
            <p><strong>Main contact:</strong> ${buildMainContactLine(evt, true)}</p>

            ${
              facts.urgentOnly.additionalInstructions
                ? `<p><strong>Additional Instructions:</strong> ${facts.urgentOnly.additionalInstructions}</p>`
                : ""
            }

            ${additionalContactsHtml(facts.urgentOnly.additionalContacts)}
          `
          : `<p style="margin-top:12px;"><em>Full address, contact details, and arrival instructions will be shared in the 24-hour notice email.</em></p>`
      }

      <p style="margin-top:16px;">
        <a href="${clockInUrl}" style="display:inline-block;background:#800020;color:#fff;padding:10px 14px;border-radius:6px;text-decoration:none;">Open Bartender Schedule</a>
      </p>
    `;

    // 🔹 Notify selected bartenders (in-app)
    const recipients = selectedBartenderIds.map((id) => ({ id }));
    if (recipients.length) {
      await sendNotification?.({
        type: "event_assigned",
        entity: evt._id,
        entityId: evt._id,
        entityModel: "Event",
        actor: { id: req.user?.id },
        recipients,
        slug: "bartend/schedule",
        messageBase: "Congratulations! You were assigned to an event!",
      });
    }

    // 🔹 Email selected bartenders individually
    for (const bartender of selectedBartenders) {
      if (!bartender.email) continue;
      await sendEmail?.({
        to: bartender.email,
        subject: `Tipsyverse — You’ve been assigned to event ${evt?.shortCode}`,
        title: `Assigned to Event ${evt?.shortCode}`,
        html: htmlForBartender,
      });
    }

    // 🔹 Notify the organizer (in-app)
    if (evt.organizer) {
      await sendNotification?.({
        type: "event_bartenders_selected",
        entity: evt._id,
        entityId: evt._id,
        entityModel: "Event",
        actor: { id: req.user?._id },
        recipients: [{ id: evt.organizer }],
        slug: "my-events",
        messageBase: `Your ${formatEventType(evt.type)} event now has ${selectedBartenderIds.length} assigned bartender(s).`,
      });
    }

    // 🔹 Email the main event contact with bartender details
    if (evt.contact?.email) {
      await sendEmail?.({
        to: evt.contact.email,
        subject: `Tipsyverse — Your event ${evt.shortCode} has been assigned to bartenders`,
        title: `Bartenders for Event ${evt.shortCode}`,
        html: `
          <p>Hi ${safeText(evt.contact.fullName, "")},</p>
          <p>Great news — we’ve assigned bartender(s) to your event:</p>

          <ul>
            <li><strong>Event Type:</strong> ${formatEventType(evt.type)}</li>
            <li><strong>When:</strong> ${facts.when}</li>
            <li><strong>Where:</strong> ${facts.where}</li>
            <li><strong>Guests:</strong> ${facts.guestCount}</li>
            <li><strong>Bartenders:</strong> ${facts.bartendersCount}</li>
            <li><strong>Bar Type:</strong> ${facts.barType}</li>
            <li><strong>Description:</strong> ${facts.description}</li>
            <li><strong>Tips:</strong> ${facts.tips}</li>
            <li><strong>Bartender Notes:</strong> ${facts.bartenderNotes}</li>
          </ul>

          <p><strong>Assigned Bartenders:</strong></p>
          <ul>
            ${bartenderListHtml || "<li>Details will appear in your Tipsyverse dashboard.</li>"}
          </ul>

          <p style="margin-top:16px;">
            <a href="${verifyUrl}" style="display:inline-block;background:#800020;color:#fff;padding:10px 14px;border-radius:6px;text-decoration:none;">View Event & Verify Attendance</a>
          </p>

          <p>If you have any questions or need changes, reply to this email and our team will help you out.</p>
          <p>— Tipsyverse</p>
        `,
      });
    }

    await req.logActivity?.({
      action: "update",
      target: { model: "Event", id: evt._id },
      actor: {
        type: "User",
        id: req.user.id,
        label: {
          fullName: req.user.fullName,
          email: req.user.email,
          role: req.user.role,
        },
      },
      summary: `Assigned ${selectedBartenderIds.length} bartender(s)`,
      meta: { bartenderIds: selectedBartenderIds, assignedCount, needed },
    });

    return res.json({
      success: true,
      data: { assignedCount, needed, status: evt.status },
    });
  } catch (err) {
    await session.abortTransaction().catch(() => {});
    session.endSession();
    return res.status(400).json({ success: false, message: err.message });
  }
},


  // Remove 1..n assigned bartenders from an event (reopen spots and optionally rebroadcast)
  removeAssignedBartenders: async (req, res) => {
    const session = await mongoose.startSession();
    try {
      const { id } = req.params; // event id
      const { bartenderIds = [], reason } = req.body; // optional reason

      if (!Array.isArray(bartenderIds) || bartenderIds.length === 0) {
        return res
          .status(400)
          .json({ success: false, message: "Select bartender(s) to remove." });
      }

      session.startTransaction();

      const evt = await Event.findById(id).session(session);
      if (!evt) throw new Error("Event not found");

      // 🔹 Mark assignments as "removed" instead of deleting them
      const removalResult = await Assignment.updateMany(
        {
          event: id,
          bartenderUser: { $in: bartenderIds },
          status: "active", // only active assignments
        },
        {
          $set: {
            status: "removed",
            reason: reason || "removed",
          },
        },
        { session }
      );

      const removedCount =
        removalResult.modifiedCount ?? removalResult.nModified ?? 0;

      if (removedCount === 0) {
        // Nothing to remove – either already removed or not assigned
        await session.commitTransaction();
        session.endSession();
        return res.json({
          success: true,
          data: {
            assignedCount: await Assignment.countDocuments({
              event: id,
              status: "active",
            }),
            needed:
              evt.pricing?.bartendersRequested ??
              evt.counts?.neededBartenders ??
              0,
            status: evt.status,
            message: "No active assignments were removed.",
          },
        });
      }

      // 🔹 Re-count ACTIVE assignments
      const assignedCount = await Assignment.countDocuments({
        event: id,
        status: "active",
      }).session(session);

      evt.counts = { ...(evt.counts || {}), assigned: assignedCount };

      // How many bartenders are needed?
      const needed =
        evt.pricing?.bartendersRequested ?? evt.counts?.neededBartenders ?? 0;

      const hasOpenSpots = needed > assignedCount;

      // console.log("needed: ", needed);

      // console.log("assignedCount: ", assignedCount);

      // console.log("hasOpenSpots: ", hasOpenSpots);

      if (hasOpenSpots) {
        // Re-open board
        // evt.visibility = { ...(evt.visibility || {}), onBiddingBoard: true };

        const urgent = isUrgentEvent(evt.startAt, 24);

        // Find potential recipients based on bids
        const bids = await Bid.find({ event: id }).session(session);
        const interested = bids
          .filter((b) => ["interested", "waitlist"].includes(b.status))
          .map((b) => ({ id: b.bartenderUser }));

        if (urgent) {
          await sendNotification?.({
            type: "event_reassign_urgent",
            entity: evt._id,
            entityId: evt._id,
            entityModel: "Event",
            actor: { id: req.user?.id },
            recipients: interested, // or all bartenders if you implement that
            slug: "bartend",
            messageBase: "Urgent: a bartender slot opened on an upcoming event",
          });
        } else if (interested.length) {
          await sendNotification?.({
            type: "event_reassign",
            entity: evt._id,
            entityId: evt._id,
            entityModel: "Event",
            actor: { id: req.user?.id },
            recipients: interested,
            slug: "bartend",
            messageBase:
              "A bartender slot reopened on an event you were watching",
          });
        }

        // If it was confirmed, you’re putting it back into selecting state
        if (evt.status === "confirmed") evt.status = "ready_to_assign";
      }

      await evt.save({ session });

      // 🔹 Optionally move bids back to waitlist if they were selected
      await Bid.updateMany(
        { event: id, bartenderUser: { $in: bartenderIds }, status: "selected" },
        { $set: { status: "waitlist" } },
        { session }
      );

      await req.logActivity?.({
        action: "update",
        target: { model: "Event", id: evt._id },
        actor: {
          type: "User",
          id: req.user.id,
          label: {
            fullName: req.user.fullName,
            email: req.user.email,
            role: req.user.role,
          },
        },
        summary: `Removed ${removedCount} assigned bartender(s)`,
        meta: { bartenderIds, assignedCount, needed, reason: reason || null },
      });

      await session.commitTransaction();
      session.endSession();

      return res.json({
        success: true,
        data: { assignedCount, needed, status: evt.status },
      });
    } catch (err) {
      await session.abortTransaction().catch(() => {});
      session.endSession();
      return res.status(400).json({ success: false, message: err.message });
    }
  },

  // PATCH /events/:eventId/assignments/:assignmentId/replace
  replaceAssignedBartender: async (req, res) => {
    const session = await mongoose.startSession();
    const { eventId, assignmentId } = req.params;
    const { replacementBartenderId, reason } = req.body;

    if (!replacementBartenderId) {
      return res.status(400).json({
        success: false,
        message: "replacementBartenderId is required",
      });
    }

    try {
      session.startTransaction();

      const evt = await Event.findById(eventId).session(session);
      if (!evt) throw new Error("Event not found");

      // Find the existing assignment
      const existingAssignment = await Assignment.findOne({
        _id: assignmentId,
        event: eventId,
        status: "active",
      }).session(session);

      if (!existingAssignment) {
        throw new Error("Active assignment not found for this event.");
      }

      // Mark the old assignment as removed
      existingAssignment.status = "removed";
      existingAssignment.reason = reason || "replaced";
      existingAssignment.replacedBy = replacementBartenderId;
      await existingAssignment.save({ session });

      // Check if replacement already has an assignment for this event
      const replacementExists = await Assignment.findOne({
        event: eventId,
        bartenderUser: replacementBartenderId,
        status: "active",
      }).session(session);

      if (!replacementExists) {
        await Assignment.create(
          [
            {
              event: eventId,
              bartenderUser: replacementBartenderId,
              assignedAt: new Date(),
              notified: true,
              status: "active",
            },
          ],
          { session }
        );
      }

      // Recompute assignedCount based on ACTIVE assignments only
      const assignedCount = await Assignment.countDocuments({
        event: eventId,
        status: "active",
      }).session(session);

      evt.counts = { ...(evt.counts || {}), assigned: assignedCount };
      await evt.save({ session });

      // Optionally: update bids as well
      await Bid.updateOne(
        {
          event: eventId,
          bartenderUser: existingAssignment.bartenderUser,
        },
        { $set: { status: "dropped" } },
        { session }
      );

      await Bid.updateOne(
        {
          event: eventId,
          bartenderUser: replacementBartenderId,
        },
        { $set: { status: "selected" } },
        { session }
      );

      await session.commitTransaction();
      session.endSession();

      // 🔔 AFTER COMMIT: send notifications/emails
      // e.g. notify both bartenders + event organizer
      // (you can reuse the email pieces you already wrote)

      return res.json({
        success: true,
        data: {
          assignedCount,
          replacedAssignmentId: existingAssignment._id,
          replacementBartenderId,
        },
      });
    } catch (err) {
      await session.abortTransaction().catch(() => {});
      session.endSession();
      return res.status(400).json({
        success: false,
        message: err.message || "Failed to replace bartender",
      });
    }
  },
};

export default eventCtrl;
