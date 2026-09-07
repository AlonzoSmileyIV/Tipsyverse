import {
  EventModel as Event,
  PaymentRequestModel as PaymentRequest,
} from "../../models/index.js";
import {
  actorFromReq,
  displayEventType,
  displayLabel,
  displayPaymentType,
  shallowDiff,
  sendEmail,
  validateEmail,
} from "../../utils/index.js";
import { eventAccessLevel } from "../../utils/libs/eventAccess.js";
import { formatDate, formatDateTime } from "../../utils/libs/dateTime.js";
import {
  assertCollectibleEvent,
  eventBalanceSnapshot,
  netRecordedPayments,
} from "../../utils/libs/paymentLedger.js";
import { cancelStripePaymentIntents } from "../../utils/libs/cancelStripePaymentIntents.js";

const isStaff = (user) => ["admin", "employee"].includes(user?.role);

const canViewEvent = async (user, eventId) => {
  const id = eventId?._id || eventId;
  const event = await Event.findById(id).select("organizer contact status").lean();
  return !!event && eventAccessLevel({ event, user }) === "full";
};

const canManagePaymentRequests = (user) => isStaff(user);

const populatePaymentRequest = (query) =>
  query
    .populate("event", "shortCode type status startAt endAt timezone location contact organizer payment")
    .populate("sentBy", "fullName email role");

const formatPaymentAmount = (amount) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(amount || 0));

const paymentTypeLabel = (paymentType) =>
  ({
    deposit: "Deposit",
    full: "Full Payment",
    custom: "Payment",
  }[paymentType] || displayPaymentType(paymentType, "Payment"));

const providerLabel = (provider) =>
  ({
    stripe: "Stripe",
    square: "Square",
    paypal: "PayPal",
    venmo: "Venmo",
    cashapp: "Cash App",
    zelle: "Zelle",
    other: "payment provider",
  }[provider] || displayLabel(provider, "Payment Provider"));

const formatEventDateTime = (date, timeZone) =>
  formatDateTime(date, { timeZone });

const formatEventLocation = (location = {}) =>
  location.formatted ||
  [location.address1, location.address2, location.city, location.state, location.zipcode]
    .filter(Boolean)
    .join(", ") ||
  "Not specified";

const buildPaymentRequestEmail = ({
  recipientName,
  event,
  paymentType,
  amountRequested,
  provider,
  providerUrl,
  expiresAt,
}) => {
  const typeLabel = paymentTypeLabel(paymentType);
  const providerName = providerLabel(provider);
  const eventCode = event?.shortCode || event?._id || "Not specified";
  const firstName = recipientName?.split(" ")[0] || "there";
  const expirationLine = expiresAt
    ? `<p>Please complete this request by <strong>${formatDate(expiresAt, {
        timeZone: event?.timezone || event?.location?.timezone,
      })}</strong>.</p>`
    : "";
  const paymentLink = providerUrl
    ? `
        <p>You can complete your ${typeLabel} using ${providerName} below:</p>
        <a href="${providerUrl}" class="button">Pay ${formatPaymentAmount(amountRequested)}</a><br/>
        <br/>
        <p>If the button does not work, copy and paste this URL into your browser:</p>
        <p><a href="${providerUrl}">${providerUrl}</a></p>
      `
    : `<p>Please complete your ${typeLabel} using ${providerName}.</p>`;

  return `
        <p>Hey ${firstName},</p>
        <p>A ${typeLabel} request has been sent to you for Tipsyverse Event <strong>${eventCode}</strong>.</p>

        <p><strong>Arrival Time:</strong> ${formatEventDateTime(event?.startAt, event?.timezone || event?.location?.timezone)}</p>
        <p><strong>End Time:</strong> ${formatEventDateTime(event?.endAt, event?.timezone || event?.location?.timezone)}</p>
        <p><strong>Event Type:</strong> ${displayEventType(event?.type)}</p>
        <p><strong>Location:</strong> ${formatEventLocation(event?.location)}</p>

        <p><strong>Amount due:</strong> ${formatPaymentAmount(amountRequested)}</p>
        ${paymentLink}
        ${expirationLine}
        <p>If you have any questions, feel free to reach out to the Tipsyverse team.</p>
      `;
};

const sendPaymentRequestEmail = async (paymentRequest, event) => {
  const recipient = paymentRequest.sentTo || {};
  const to = recipient.email;

  if (!to) {
    return {
      success: false,
      message: "Payment request recipient email is required.",
    };
  }

  const typeLabel = paymentTypeLabel(paymentRequest.paymentType);
  const emailContent = buildPaymentRequestEmail({
    recipientName: recipient.fullName,
    event: event || paymentRequest.event,
    paymentType: paymentRequest.paymentType,
    amountRequested: paymentRequest.amountRequested,
    provider: paymentRequest.provider,
    providerUrl: paymentRequest.providerUrl,
    expiresAt: paymentRequest.expiresAt,
  });

  return sendEmail({
    to,
    title: "Tipsyverse Payment Request",
    subject: `Tipsyverse - Payment Request for #${event.shortCode}`,
    html: emailContent,
  });
};

const normalizeSentTo = (sentTo, fallbackContact) => {
  if (typeof sentTo === "string") {
    return {
      ...fallbackContact,
      email: sentTo,
    };
  }

  return sentTo || fallbackContact;
};

const assertRequestFitsBalance = async (event, amount) => {
  assertCollectibleEvent(event);
  const summary = await eventBalanceSnapshot(event);
  if (summary.balance <= 0) {
    const error = new Error("This event has no balance due.");
    error.statusCode = 409;
    throw error;
  }
  if (Number(amount) > summary.balance + 0.001) {
    const error = new Error(
      `Payment request cannot exceed the current balance of $${summary.balance.toFixed(2)}.`
    );
    error.statusCode = 409;
    throw error;
  }
  return summary;
};

const paymentRequestCtrl = {
  createPaymentRequest: async (req, res) => {
    try {
      if (!canManagePaymentRequests(req.user)) {
        return res.status(403).json({ message: "Not allowed" });
      }

      const {
        event,
        provider,
        paymentType,
        amountRequested,
        providerUrl,
        sentTo,
        sentAt,
        expiresAt,
        emailId,
      } = req.body;

      if (!event || !provider || !paymentType || amountRequested == null) {
        return res.status(400).json({
          message: "event, provider, paymentType, and amountRequested are required.",
        });
      }
      if (
        provider === "stripe" &&
        String(process.env.STRIPE_ENABLED).toLowerCase() !== "true"
      ) {
        return res.status(503).json({
          message:
            "Online card payments are unavailable. Select a manual payment provider.",
        });
      }
      const requestAmount = Number(amountRequested);
      if (!Number.isFinite(requestAmount) || requestAmount <= 0) {
        return res.status(400).json({
          message: "Payment request amount must be greater than $0.00.",
        });
      }

      const eventDoc = await Event.findById(event)
        .select("_id shortCode type status startAt endAt timezone location contact payment pricing")
        .lean();
      if (!eventDoc) return res.status(404).json({ message: "Event not found" });
      await assertRequestFitsBalance(eventDoc, requestAmount);
      const recipient = normalizeSentTo(sentTo, eventDoc.contact);
      if (!recipient?.email || !validateEmail(String(recipient.email).trim())) {
        return res.status(400).json({
          message: "A valid recipient email is required before sending a payment request.",
        });
      }

      const doc = await PaymentRequest.create({
        event,
        provider,
        paymentType,
        amountRequested: requestAmount,
        providerUrl: provider === "stripe" ? undefined : providerUrl,
        sentTo: {
          ...recipient,
          email: String(recipient.email).trim(),
        },
        sentBy: req.user.id,
        status: "draft",
        sentAt: undefined,
        expiresAt,
        emailId,
      });
      if (provider === "stripe") {
        doc.providerUrl = `${process.env.PUBLIC_APP_URL.replace(/\/$/, "")}/pay/${doc._id}`;
        await doc.save();
      }

      await PaymentRequest.updateMany(
        { event, _id: { $ne: doc._id }, status: "sent" },
        { $set: { status: "cancelled" } }
      );

      const emailResult = await sendPaymentRequestEmail(doc, eventDoc);
      if (!emailResult.success) {
        return res.status(400).json({
          success: false,
          message: emailResult.message || "Payment request email failed to send.",
          data: doc,
        });
      }

      doc.status = "sent";
      doc.sentAt = sentAt || new Date();
      await doc.save();

      req.logActivity?.({
        action: "create",
        target: { model: "PaymentRequest", id: doc._id },
        actor: actorFromReq(req),
        summary: `Created ${paymentTypeLabel(paymentType)} request`,
        nextSnapshot: doc.toObject(),
        request: {
          ip: req.ip,
          userAgent: req.get?.("user-agent"),
          source: "web",
        },
      });

      const fresh = await populatePaymentRequest(PaymentRequest.findById(doc._id)).lean();
      const recipientEmail = fresh?.sentTo?.email || doc.sentTo?.email;
      return res.status(201).json({
        success: true,
        message: `Payment request was sent to ${recipientEmail} successfully.`,
        data: fresh,
      });
    } catch (err) {
      return res.status(err.statusCode || 400).json({ message: err.message });
    }
  },

  viewPaymentRequests: async (req, res) => {
    try {
      const filter = {};
      const { eventId, status, provider, paymentType } = req.query;

      if (status) filter.status = status;
      if (provider) filter.provider = provider;
      if (paymentType) filter.paymentType = paymentType;
      if (eventId) filter.event = eventId;

      if (!isStaff(req.user)) {
        const userId = req.user?.id || req.user?._id;
        const userEmail = String(req.user?.email || "").trim();
        const escapedEmail = userEmail.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const events = await Event.find({
          $or: [
            ...(userId
              ? [{ organizer: userId }, { "contact.userId": userId }]
              : []),
            ...(userEmail
              ? [{ "contact.email": new RegExp(`^${escapedEmail}$`, "i") }]
              : []),
          ],
        })
          .select("_id")
          .lean();
        if (eventId && !(await canViewEvent(req.user, eventId))) {
          return res.status(403).json({ message: "Not allowed" });
        }
        filter.event = eventId || { $in: events.map((event) => event._id) };
      }

      const docs = await populatePaymentRequest(
        PaymentRequest.find(filter).sort({ createdAt: -1 })
      ).lean();

      return res.json({ data: docs });
    } catch (err) {
      return res.status(err.statusCode || 400).json({ message: err.message });
    }
  },

  viewPaymentRequestsByEvent: async (req, res) => {
    try {
      const { eventId } = req.params;
      if (!(await canViewEvent(req.user, eventId))) {
        return res.status(403).json({ message: "Not allowed" });
      }

      const docs = await populatePaymentRequest(
        PaymentRequest.find({ event: eventId }).sort({ createdAt: -1 })
      ).lean();

      return res.json({ data: docs });
    } catch (err) {
      return res.status(err.statusCode || 400).json({ message: err.message });
    }
  },

  viewPaymentRequestById: async (req, res) => {
    try {
      const doc = await populatePaymentRequest(
        PaymentRequest.findById(req.params.id)
      ).lean();
      if (!doc) return res.status(404).json({ message: "Not found" });
      if (!(await canViewEvent(req.user, doc.event?._id || doc.event))) {
        return res.status(403).json({ message: "Not allowed" });
      }

      return res.json({ data: doc });
    } catch (err) {
      return res.status(err.statusCode || 400).json({ message: err.message });
    }
  },

  updatePaymentRequest: async (req, res) => {
    try {
      if (!canManagePaymentRequests(req.user)) {
        return res.status(403).json({ message: "Not allowed" });
      }

      const doc = await PaymentRequest.findById(req.params.id);
      if (!doc) return res.status(404).json({ message: "Not found" });
      if (
        doc.status === "sent" &&
        ["provider", "paymentType", "amountRequested", "providerUrl"].some(
          (field) => Object.prototype.hasOwnProperty.call(req.body, field)
        )
      ) {
        return res.status(409).json({
          message: "A sent payment request is immutable. Cancel it and create a revised request.",
        });
      }
      if (
        req.body.provider === "stripe" &&
        String(process.env.STRIPE_ENABLED).toLowerCase() !== "true"
      ) {
        return res.status(503).json({
          message:
            "Online card payments are unavailable. Select a manual payment provider.",
        });
      }

      const before = doc.toObject();
      const allowed = [
        "provider",
        "paymentType",
        "amountRequested",
        "providerUrl",
        "sentTo",
        "sentAt",
        "expiresAt",
        "emailId",
      ];
      if (req.paymentRequestTransition) allowed.push("status");

      for (const field of allowed) {
        if (Object.prototype.hasOwnProperty.call(req.body, field)) {
          doc[field] = req.body[field];
        }
      }

      if (Object.prototype.hasOwnProperty.call(req.body, "amountRequested")) {
        const requestAmount = Number(req.body.amountRequested);
        if (!Number.isFinite(requestAmount) || requestAmount <= 0) {
          return res.status(400).json({
            message: "Payment request amount must be greater than $0.00.",
          });
        }
        doc.amountRequested = requestAmount;
      }

      if (doc.sentTo?.email) {
        doc.sentTo.email = String(doc.sentTo.email).trim();
        if (!validateEmail(doc.sentTo.email)) {
          return res.status(400).json({
            message: "A valid recipient email is required before saving a payment request.",
          });
        }
      }

      if (doc.status === "sent" && !doc.sentAt) doc.sentAt = new Date();
      const eventDoc = await Event.findById(doc.event)
        .select("status payment pricing")
        .lean();
      if (doc.status === "draft" || doc.status === "sent") {
        await assertRequestFitsBalance(eventDoc, doc.amountRequested);
      }
      await doc.save();

      req.logActivity?.({
        action: "update",
        target: { model: "PaymentRequest", id: doc._id },
        actor: actorFromReq(req),
        summary: "Updated payment request",
        changes: shallowDiff(before, doc.toObject()),
        prevSnapshot: before,
        nextSnapshot: doc.toObject(),
        request: {
          ip: req.ip,
          userAgent: req.get?.("user-agent"),
          source: "web",
        },
      });

      const fresh = await populatePaymentRequest(PaymentRequest.findById(doc._id)).lean();
      return res.json({ data: fresh });
    } catch (err) {
      return res.status(err.statusCode || 400).json({ message: err.message });
    }
  },

  sendPaymentRequest: async (req, res) => {
    try {
      if (!canManagePaymentRequests(req.user)) {
        return res.status(403).json({ message: "Not allowed" });
      }

      const doc = await PaymentRequest.findById(req.params.id).populate(
        "event",
        "shortCode type status startAt endAt timezone location contact payment pricing"
      );
      if (!doc) return res.status(404).json({ message: "Not found" });
      if (!["draft", "sent"].includes(doc.status)) {
        return res.status(409).json({ message: "Only a draft or active request can be sent." });
      }
      if (
        doc.provider === "stripe" &&
        String(process.env.STRIPE_ENABLED).toLowerCase() !== "true"
      ) {
        return res.status(503).json({
          message:
            "Online card payments are unavailable. Select a manual payment provider.",
        });
      }
      if (!doc.sentTo?.email || !validateEmail(String(doc.sentTo.email).trim())) {
        return res.status(400).json({
          message: "A valid recipient email is required before sending a payment request.",
        });
      }
      const requestAmount = Number(doc.amountRequested);
      if (!Number.isFinite(requestAmount) || requestAmount <= 0) {
        return res.status(400).json({
          message: "Payment request amount must be greater than $0.00.",
        });
      }
      await assertRequestFitsBalance(doc.event, requestAmount);

      const before = doc.toObject();
      const emailResult = await sendPaymentRequestEmail(doc);
      if (!emailResult.success) {
        return res.status(400).json({
          success: false,
          message: emailResult.message || "Payment request email failed to send.",
        });
      }

      doc.status = "sent";
      doc.sentAt = req.body.sentAt || new Date();
      await doc.save();

      req.logActivity?.({
        action: "update",
        target: { model: "PaymentRequest", id: doc._id },
        actor: actorFromReq(req),
        summary: "Sent payment request",
        changes: shallowDiff(before, doc.toObject()),
        prevSnapshot: before,
        nextSnapshot: doc.toObject(),
        request: {
          ip: req.ip,
          userAgent: req.get?.("user-agent"),
          source: "web",
        },
      });

      const fresh = await populatePaymentRequest(PaymentRequest.findById(doc._id)).lean();
      return res.json({
        success: true,
        message: `Payment request was sent to ${fresh?.sentTo?.email || doc.sentTo?.email} successfully.`,
        data: fresh,
      });
    } catch (err) {
      return res.status(err.statusCode || 400).json({ message: err.message });
    }
  },

  completePaymentRequest: async (req, res) => {
    const doc = await PaymentRequest.findById(req.params.id).lean();
    if (!doc) return res.status(404).json({ message: "Not found" });
    const paid = await netRecordedPayments(doc.event, { paymentRequest: doc._id });
    if (paid < Number(doc.amountRequested) - 0.001) {
      return res.status(409).json({
        message: "A payment request cannot be completed until its requested amount is recorded.",
      });
    }
    req.paymentRequestTransition = true;
    req.body.status = "completed";
    return paymentRequestCtrl.updatePaymentRequest(req, res);
  },

  cancelPaymentRequest: async (req, res) => {
    const doc = await PaymentRequest.findById(req.params.id)
      .select("stripePaymentIntentId")
      .lean();
    if (doc?.stripePaymentIntentId) {
      await cancelStripePaymentIntents([doc.stripePaymentIntentId]);
    }
    req.paymentRequestTransition = true;
    req.body.status = "cancelled";
    return paymentRequestCtrl.updatePaymentRequest(req, res);
  },

  deletePaymentRequest: async (req, res) => {
    try {
      if (!canManagePaymentRequests(req.user)) {
        return res.status(403).json({ message: "Not allowed" });
      }

      const doc = await PaymentRequest.findById(req.params.id);
      if (!doc) return res.status(404).json({ message: "Not found" });

      await doc.deleteOne();
      req.logActivity?.({
        action: "delete",
        target: { model: "PaymentRequest", id: req.params.id },
        actor: actorFromReq(req),
        summary: "Deleted payment request",
        prevSnapshot: doc.toObject(),
        request: {
          ip: req.ip,
          userAgent: req.get?.("user-agent"),
          source: "web",
        },
      });

      return res.json({ success: true });
    } catch (err) {
      return res.status(err.statusCode || 400).json({ message: err.message });
    }
  },
};

export default paymentRequestCtrl;
