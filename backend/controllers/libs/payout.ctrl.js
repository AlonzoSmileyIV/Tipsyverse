import {
  AssignmentModel as Assignment,
  EventModel as Event,
  PayoutModel as Payout,
} from "../../models/index.js";
import { sendEmail, sendNotification } from "../../utils/index.js";

const isEmployee = (user) => ["admin", "employee"].includes(user?.role);
const fmtMoney = (n) => `$${(Number(n) || 0).toFixed(2)}`;
const titleize = (value) =>
  String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase()) || "Manual";
const appUrl = () => process.env.PUBLIC_APP_URL || process.env.FRONTEND_URL || "http://localhost:3000";
const roundMoney = (n) => Math.round((Number(n) || 0) * 100) / 100;
const getEventHours = (event) => {
  const start = event?.startAt ? new Date(event.startAt) : null;
  const end = event?.endAt ? new Date(event.endAt) : null;
  if (!start || !end || end <= start) return 0;
  return (end.getTime() - start.getTime()) / (60 * 60 * 1000);
};
const getExpectedAssignmentPay = (event) => {
  const pricing = event?.pricing || {};
  const hours =
    getEventHours(event) +
    (Number(pricing.setupHours) || 0) +
    (Number(pricing.breakdownHours) || 0);
  const hourlyPay = hours * (Number(pricing.hourlyRate) || 0);
  const bartenderCount =
    Number(event?.counts?.neededBartenders) ||
    Number(pricing.bartendersRequested) ||
    1;
  const subtotal =
    Number(event?.payment?.subtotal) ||
    hourlyPay * bartenderCount + (Number(pricing.bookingFee) || 0);
  const gratuity =
    Number(event?.payment?.gratuity) ||
    subtotal * (Number(pricing.gratuityPct) || 0);
  return roundMoney(hourlyPay + gratuity / Math.max(1, bartenderCount));
};

const populatePayout = (query) =>
  query
    .populate("event", "shortCode type startAt endAt location pricing status")
    .populate("bartenderUser", "fullName email bartenderProfile.payoutLinks")
    .populate("assignment", "status assignedAt");

const payoutCtrl = {
  viewPayouts: async (req, res) => {
    try {
      const filter = {};
      const { eventId, bartenderUser, status } = req.query;

      if (!isEmployee(req.user)) {
        filter.bartenderUser = req.user?.id || req.user?._id;
      } else if (bartenderUser) {
        filter.bartenderUser = bartenderUser;
      }

      if (eventId) filter.event = eventId;
      if (status) filter.status = status;

      const docs = await populatePayout(
        Payout.find(filter).sort({ paidAt: -1, scheduledAt: -1, createdAt: -1 })
      ).lean();

      return res.json({ success: true, data: docs });
    } catch (err) {
      return res.status(500).json({ message: "Failed to load payouts." });
    }
  },

  createPayout: async (req, res) => {
    try {
      if (!isEmployee(req.user)) {
        return res.status(403).json({ message: "Only employees can record payouts." });
      }

      const {
        event,
        bartenderUser,
        assignment,
        amount,
        provider = "manual",
        reference = "",
        notes = "",
        paidAt,
        status = "paid",
      } = req.body || {};

      if (!event || !bartenderUser || amount == null) {
        return res.status(400).json({
          message: "event, bartenderUser, and amount are required.",
        });
      }

      const amountNum = Number(amount);
      if (!Number.isFinite(amountNum) || amountNum <= 0) {
        return res.status(400).json({ message: "Payout amount must be greater than $0." });
      }

      let remainingAfterPayout = null;
      if (assignment) {
        const assignmentDoc = await Assignment.findById(assignment).select("event bartenderUser").lean();
        if (!assignmentDoc) return res.status(404).json({ message: "Assignment not found." });
        if (String(assignmentDoc.event) !== String(event)) {
          return res.status(400).json({ message: "Assignment does not belong to this event." });
        }
        if (String(assignmentDoc.bartenderUser) !== String(bartenderUser)) {
          return res.status(400).json({ message: "Assignment does not belong to this bartender." });
        }

        const [eventDoc, existingPayouts] = await Promise.all([
          Event.findById(event).select("startAt endAt pricing counts payment").lean(),
          Payout.find({ assignment, status: { $ne: "failed" } }).select("amount").lean(),
        ]);
        const expected = getExpectedAssignmentPay(eventDoc);
        const alreadyPaid = roundMoney(
          existingPayouts.reduce((sum, payout) => sum + (Number(payout.amount) || 0), 0)
        );
        const remaining = roundMoney(Math.max(0, expected - alreadyPaid));
        if (amountNum > remaining) {
          return res.status(400).json({
            message: `Payout cannot exceed remaining bartender balance of ${fmtMoney(remaining)}.`,
          });
        }
        remainingAfterPayout = roundMoney(Math.max(0, remaining - amountNum));
      }

      const doc = await Payout.create({
        event,
        bartenderUser,
        assignment: assignment || null,
        amount: amountNum,
        provider,
        reference,
        notes,
        status,
        paidAt: paidAt ? new Date(paidAt) : status === "paid" ? new Date() : null,
      });

      await req.logActivity?.({
        action: "create",
        target: { model: "Payout", id: doc._id },
        summary: `Recorded ${provider} payout for $${amountNum.toFixed(2)}`,
      });

      const fresh = await populatePayout(Payout.findById(doc._id)).lean();
      const bartender = fresh?.bartenderUser || {};
      const eventDoc = fresh?.event || {};
      const earningsUrl = `${appUrl().replace(/\/$/, "")}/bartend/earnings`;

      await sendNotification?.({
        type: "system",
        entity: eventDoc?._id || event,
        entityId: eventDoc?._id || event,
        entityModel: "Event",
        actor: { id: req.user?.id || req.user?._id },
        recipients: [{ id: bartender?._id || bartenderUser }],
        slug: "bartend/earnings",
        messageBase: `Payout recorded for ${eventDoc?.shortCode || "your event"}: ${fmtMoney(amountNum)}`,
      });

      if (bartender?.email) {
        await sendEmail?.({
          to: bartender.email,
          subject: `Tipsyverse payout recorded — ${eventDoc?.shortCode || "Event"}`,
          title: "Payout Recorded",
          html: `
            <p>Hi ${bartender.fullName || "there"},</p>
            <p>Tipsyverse has recorded a payout for your event.</p>
            <ul>
              <li><strong>Event:</strong> ${eventDoc?.shortCode || "Event"}</li>
              <li><strong>Amount:</strong> ${fmtMoney(amountNum)}</li>
              <li><strong>Current balance:</strong> ${
                remainingAfterPayout == null ? "Not available" : fmtMoney(remainingAfterPayout)
              }</li>
              <li><strong>Provider:</strong> ${titleize(provider)}</li>
              ${reference ? `<li><strong>Reference:</strong> ${reference}</li>` : ""}
              ${notes ? `<li><strong>Notes:</strong> ${notes}</li>` : ""}
            </ul>
            <p>
              <a href="${earningsUrl}" style="display:inline-block;background:#800020;color:#fff;padding:10px 14px;border-radius:6px;text-decoration:none;">
                View Earnings
              </a>
            </p>
            <p>You can also copy and paste this URL into your browser:<br/>
              <a href="${earningsUrl}">${earningsUrl}</a>
            </p>
          `,
        });
      }

      return res.status(201).json({ success: true, data: fresh });
    } catch (err) {
      return res.status(500).json({ message: "Failed to record payout." });
    }
  },

  requestPayoutReminder: async (req, res) => {
    try {
      const { assignment, event, amountDue } = req.body || {};

      await req.logActivity?.({
        action: "other",
        target: { model: assignment ? "Assignment" : "Event", id: assignment || event },
        summary: `Bartender requested a payout reminder${amountDue ? ` for $${Number(amountDue).toFixed(2)}` : ""}.`,
      });

      return res.json({
        success: true,
        message: "Reminder sent to the team.",
      });
    } catch (err) {
      return res.status(500).json({ message: "Failed to send payout reminder." });
    }
  },
};

export default payoutCtrl;
