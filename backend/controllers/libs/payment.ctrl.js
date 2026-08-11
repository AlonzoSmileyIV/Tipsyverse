import {
  EventModel as Event,
  PaymentModel as Payment,
  PaymentRequestModel as PaymentRequest,
} from "../../models/index.js";
import { actorFromReq, shallowDiff } from "../../utils/index.js";
import Stripe from "stripe";
import { syncEventPaymentPolicy } from "../../utils/libs/syncEventPaymentPolicy.js";
import { getEventPaymentTotal } from "../../utils/libs/eventSummary.js";

const stripeClient = () => {
  if (
    String(process.env.STRIPE_ENABLED).toLowerCase() !== "true" ||
    !process.env.STRIPE_SECRET_KEY
  ) {
    return null;
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY);
};

const isStaff = (user) => ["admin", "employee"].includes(user?.role);

const canViewEvent = async (user, eventId) => {
  if (isStaff(user)) return true;
  const id = eventId?._id || eventId;
  const event = await Event.findById(id).select("organizer contact").lean();
  if (!event) return false;

  const userId = user?.id || user?._id;
  const userEmail = String(user?.email || "").trim().toLowerCase();
  const contactEmail = String(event.contact?.email || "").trim().toLowerCase();

  return (
    (!!event.organizer && !!userId && String(event.organizer) === String(userId)) ||
    (!!event.contact?.userId && !!userId && String(event.contact.userId) === String(userId)) ||
    (!!contactEmail && !!userEmail && contactEmail === userEmail)
  );
};

const populatePayment = (query) =>
  query
    .populate("event", "shortCode type description additionalInstructions status startAt endAt contact organizer payment pricing")
    .populate("paymentRequest")
    .populate("collectedBy", "fullName email role")
    .populate("voidedBy", "fullName email role")
    .populate("editedBy", "fullName email role");

const paymentCtrl = {
  createStripePaymentIntent: async (req, res) => {
    try {
      const stripe = stripeClient();
      if (!stripe) return res.status(503).json({ message: "Card payments are unavailable." });
      const requestDoc = await PaymentRequest.findById(req.body?.paymentRequestId).lean();
      if (!requestDoc || requestDoc.provider !== "stripe" || requestDoc.status !== "sent") {
        return res.status(404).json({ message: "Active Stripe payment request not found." });
      }
      if (!(await canViewEvent(req.user, requestDoc.event))) {
        return res.status(403).json({ message: "Not allowed" });
      }
      const amount = Math.round(Number(requestDoc.amountRequested) * 100);
      if (!Number.isSafeInteger(amount) || amount < 50) {
        return res.status(400).json({ message: "Invalid payment request amount." });
      }
      const intent = await stripe.paymentIntents.create(
        {
          amount,
          currency: "usd",
          automatic_payment_methods: { enabled: true },
          receipt_email: requestDoc.sentTo?.email || req.user?.email,
          metadata: {
            paymentRequestId: String(requestDoc._id),
            eventId: String(requestDoc.event),
          },
        },
        { idempotencyKey: `payment-request-${requestDoc._id}` }
      );
      return res.json({ clientSecret: intent.client_secret });
    } catch (error) {
      console.error("Stripe PaymentIntent creation failed:", error);
      return res.status(502).json({ message: "Unable to initialize card payment." });
    }
  },

  handleStripeWebhook: async (req, res) => {
    const stripe = stripeClient();
    if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) {
      return res.status(503).send("Stripe webhook is not configured.");
    }
    let event;
    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        req.get("stripe-signature"),
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch {
      return res.status(400).send("Invalid webhook signature.");
    }

    try {
      if (event.type === "payment_intent.succeeded") {
        const intent = event.data.object;
        const paymentRequest = await PaymentRequest.findById(
          intent.metadata?.paymentRequestId
        ).lean();
        if (paymentRequest && String(paymentRequest.event) === intent.metadata?.eventId) {
          await Payment.updateOne(
            { "stripe.paymentIntentId": intent.id },
            {
              $setOnInsert: {
                event: paymentRequest.event,
                paymentRequest: paymentRequest._id,
                amount: intent.amount_received / 100,
                method: "stripe",
                reference: intent.latest_charge || intent.id,
                receivedAt: new Date(),
              },
              $set: {
                status: "recorded",
                "stripe.paymentIntentId": intent.id,
                "stripe.chargeId": intent.latest_charge || "",
                "stripe.customerId": intent.customer || "",
              },
            },
            { upsert: true }
          );
          await PaymentRequest.updateOne(
            { _id: paymentRequest._id },
            { $set: { status: "completed" } }
          );
          await syncEventPaymentPolicy(paymentRequest.event);
        }
      }

      if (event.type === "charge.refunded") {
        const charge = event.data.object;
        await Payment.updateOne(
          { "stripe.chargeId": charge.id },
          {
            $set: {
              status: "refunded",
              editedAt: new Date(),
              "stripe.refundId": charge.refunds?.data?.[0]?.id || "",
            },
          }
        );
      }
      return res.json({ received: true });
    } catch (error) {
      console.error("Stripe webhook reconciliation failed:", error);
      return res.status(500).json({ message: "Webhook reconciliation failed." });
    }
  },

  createPayment: async (req, res) => {
    try {
      if (!isStaff(req.user)) return res.status(403).json({ message: "Not allowed" });

      const {
        event,
        paymentRequest,
        amount,
        method,
        reference,
        notes,
        receivedAt,
        status = "recorded",
      } = req.body;

      if (!event || amount == null || !method) {
        return res.status(400).json({ message: "event, amount, and method are required." });
      }
      if (method === "stripe") {
        return res.status(400).json({
          message: "Stripe payments are recorded only through verified webhooks.",
        });
      }
      const paymentAmount = Number(amount);
      if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
        return res.status(400).json({ message: "Payment amount must be greater than $0.00." });
      }

      const eventDoc = await Event.findById(event)
        .select("_id payment.total")
        .lean();
      if (!eventDoc) return res.status(404).json({ message: "Event not found" });

      if (status === "recorded") {
        const paidRows = await Payment.aggregate([
          { $match: { event: eventDoc._id, status: "recorded" } },
          { $group: { _id: "$event", total: { $sum: "$amount" } } },
        ]);
        const billedTotal = getEventPaymentTotal(eventDoc);
        const paidTotal = Number(paidRows[0]?.total) || 0;
        const remainingBalance = Math.max(
          0,
          Math.round((billedTotal - paidTotal) * 100) / 100
        );
        if (paymentAmount > remainingBalance + 0.001) {
          return res.status(400).json({
            message:
              remainingBalance > 0
                ? `Payment cannot exceed the current balance of $${remainingBalance.toFixed(2)}.`
                : "This event has no balance due. Existing excess payments remain recorded as customer credit.",
          });
        }
      }

      if (paymentRequest) {
        const requestDoc = await PaymentRequest.findById(paymentRequest).select("event").lean();
        if (!requestDoc) {
          return res.status(404).json({ message: "Payment request not found" });
        }
        if (String(requestDoc.event) !== String(event)) {
          return res.status(400).json({
            message: "Payment request does not belong to this event.",
          });
        }
      }

      const doc = await Payment.create({
        event,
        paymentRequest,
        amount: paymentAmount,
        method,
        reference,
        notes,
        receivedAt: receivedAt || new Date(),
        collectedBy: req.user.id,
        status,
      });
      await syncEventPaymentPolicy(event);

      if (paymentRequest && status === "recorded") {
        await PaymentRequest.findByIdAndUpdate(paymentRequest, {
          status: "completed",
        });
      }

      req.logActivity?.({
        action: "create",
        target: { model: "Payment", id: doc._id },
        actor: actorFromReq(req),
        summary: `Recorded ${method} payment`,
        nextSnapshot: doc.toObject(),
        request: {
          ip: req.ip,
          userAgent: req.get?.("user-agent"),
          source: "web",
        },
      });

      const fresh = await populatePayment(Payment.findById(doc._id)).lean();
      return res.status(201).json({ data: fresh });
    } catch (err) {
      return res.status(400).json({ message: err.message });
    }
  },

  viewPayments: async (req, res) => {
    try {
      const filter = {};
      const { eventId, paymentRequestId, status, method } = req.query;

      if (eventId) filter.event = eventId;
      if (paymentRequestId) filter.paymentRequest = paymentRequestId;
      if (status) filter.status = status;
      if (method) filter.method = method;

      if (!isStaff(req.user)) {
        const userId = req.user?.id || req.user?._id;
        const userEmail = String(req.user?.email || "").trim();
        const events = await Event.find({
          $or: [
            ...(userId
              ? [{ organizer: userId }, { "contact.userId": userId }]
              : []),
            ...(userEmail
              ? [{ "contact.email": new RegExp(`^${userEmail.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") }]
              : []),
          ],
        }).select("_id").lean();
        if (eventId && !(await canViewEvent(req.user, eventId))) {
          return res.status(403).json({ message: "Not allowed" });
        }
        filter.event = eventId || { $in: events.map((event) => event._id) };
      }

      const docs = await populatePayment(
        Payment.find(filter).sort({ receivedAt: -1, createdAt: -1 })
      ).lean();

      return res.json({ data: docs });
    } catch (err) {
      return res.status(400).json({ message: err.message });
    }
  },

  viewPaymentsByEvent: async (req, res) => {
    try {
      const { eventId } = req.params;
      if (!(await canViewEvent(req.user, eventId))) {
        return res.status(403).json({ message: "Not allowed" });
      }

      const docs = await populatePayment(
        Payment.find({ event: eventId }).sort({ receivedAt: -1, createdAt: -1 })
      ).lean();

      return res.json({ data: docs });
    } catch (err) {
      return res.status(400).json({ message: err.message });
    }
  },

  viewPaymentsByPaymentRequest: async (req, res) => {
    try {
      const { paymentRequestId } = req.params;
      const requestDoc = await PaymentRequest.findById(paymentRequestId).select("event").lean();
      if (!requestDoc) return res.status(404).json({ message: "Payment request not found" });
      if (!(await canViewEvent(req.user, requestDoc.event))) {
        return res.status(403).json({ message: "Not allowed" });
      }

      const docs = await populatePayment(
        Payment.find({ paymentRequest: paymentRequestId }).sort({
          receivedAt: -1,
          createdAt: -1,
        })
      ).lean();

      return res.json({ data: docs });
    } catch (err) {
      return res.status(400).json({ message: err.message });
    }
  },

  viewPaymentById: async (req, res) => {
    try {
      const doc = await populatePayment(Payment.findById(req.params.id)).lean();
      if (!doc) return res.status(404).json({ message: "Not found" });
      if (!(await canViewEvent(req.user, doc.event?._id || doc.event))) {
        return res.status(403).json({ message: "Not allowed" });
      }

      return res.json({ data: doc });
    } catch (err) {
      return res.status(400).json({ message: err.message });
    }
  },

  updatePayment: async (req, res) => {
    try {
      if (!isStaff(req.user)) return res.status(403).json({ message: "Not allowed" });

      const doc = await Payment.findById(req.params.id);
      if (!doc) return res.status(404).json({ message: "Not found" });
      if (req.body.method === "stripe") {
        return res.status(400).json({
          message: "Stripe payments are recorded only through verified webhooks.",
        });
      }

      const before = doc.toObject();
      const allowed = [
        "amount",
        "method",
        "reference",
        "notes",
        "receivedAt",
        "status",
      ];

      for (const field of allowed) {
        if (Object.prototype.hasOwnProperty.call(req.body, field)) {
          doc[field] = req.body[field];
        }
      }

      if (doc.status === "recorded") {
        const [eventDoc, paidRows] = await Promise.all([
          Event.findById(doc.event).select("payment.total").lean(),
          Payment.aggregate([
            {
              $match: {
                event: doc.event,
                status: "recorded",
                _id: { $ne: doc._id },
              },
            },
            { $group: { _id: "$event", total: { $sum: "$amount" } } },
          ]),
        ]);
        const billedTotal = getEventPaymentTotal(eventDoc);
        const otherPaidTotal = Number(paidRows[0]?.total) || 0;
        const maximumPayment = Math.max(
          0,
          Math.round((billedTotal - otherPaidTotal) * 100) / 100
        );
        if (Number(doc.amount) > maximumPayment + 0.001) {
          return res.status(400).json({
            message: `Payment cannot exceed the current available balance of $${maximumPayment.toFixed(2)}.`,
          });
        }
      }

      doc.editedAt = new Date();
      doc.editedBy = req.user.id;
      await doc.save();
      await syncEventPaymentPolicy(doc.event);

      req.logActivity?.({
        action: "update",
        target: { model: "Payment", id: doc._id },
        actor: actorFromReq(req),
        summary: "Updated payment",
        changes: shallowDiff(before, doc.toObject()),
        prevSnapshot: before,
        nextSnapshot: doc.toObject(),
        request: {
          ip: req.ip,
          userAgent: req.get?.("user-agent"),
          source: "web",
        },
      });

      const fresh = await populatePayment(Payment.findById(doc._id)).lean();
      return res.json({ data: fresh });
    } catch (err) {
      return res.status(400).json({ message: err.message });
    }
  },

  voidPayment: async (req, res) => {
    try {
      if (!isStaff(req.user)) return res.status(403).json({ message: "Not allowed" });

      const doc = await Payment.findById(req.params.id);
      if (!doc) return res.status(404).json({ message: "Not found" });

      const before = doc.toObject();
      doc.status = "voided";
      doc.voidReason = req.body.voidReason;
      doc.voidedAt = new Date();
      doc.voidedBy = req.user.id;
      await doc.save();
      await syncEventPaymentPolicy(doc.event);

      if (doc.paymentRequest) {
        const hasOtherRecordedPayment = await Payment.exists({
          paymentRequest: doc.paymentRequest,
          _id: { $ne: doc._id },
          status: "recorded",
        });

        if (!hasOtherRecordedPayment) {
          await PaymentRequest.findByIdAndUpdate(doc.paymentRequest, {
            status: "sent",
          });
        }
      }

      req.logActivity?.({
        action: "update",
        target: { model: "Payment", id: doc._id },
        actor: actorFromReq(req),
        summary: "Voided payment",
        changes: shallowDiff(before, doc.toObject()),
        prevSnapshot: before,
        nextSnapshot: doc.toObject(),
        request: {
          ip: req.ip,
          userAgent: req.get?.("user-agent"),
          source: "web",
        },
      });

      const fresh = await populatePayment(Payment.findById(doc._id)).lean();
      return res.json({ data: fresh });
    } catch (err) {
      return res.status(400).json({ message: err.message });
    }
  },

  refundPayment: async (req, res) => {
    try {
      if (!isStaff(req.user)) return res.status(403).json({ message: "Not allowed" });

      const doc = await Payment.findById(req.params.id);
      if (!doc) return res.status(404).json({ message: "Not found" });

      const before = doc.toObject();
      if (doc.method === "stripe") {
        const stripe = stripeClient();
        if (!stripe || !doc.stripe?.paymentIntentId) {
          return res.status(503).json({ message: "Stripe refund is unavailable." });
        }
        const refund = await stripe.refunds.create(
          { payment_intent: doc.stripe.paymentIntentId },
          { idempotencyKey: `refund-payment-${doc._id}` }
        );
        doc.stripe.refundId = refund.id;
      }
      doc.status = "refunded";
      doc.editedAt = new Date();
      doc.editedBy = req.user.id;
      if (req.body.notes) doc.notes = req.body.notes;
      if (!doc.stripe) doc.stripe = {};
      await doc.save();
      await syncEventPaymentPolicy(doc.event);

      if (doc.paymentRequest) {
        const hasOtherRecordedPayment = await Payment.exists({
          paymentRequest: doc.paymentRequest,
          _id: { $ne: doc._id },
          status: "recorded",
        });

        if (!hasOtherRecordedPayment) {
          await PaymentRequest.findByIdAndUpdate(doc.paymentRequest, {
            status: "sent",
          });
        }
      }

      req.logActivity?.({
        action: "update",
        target: { model: "Payment", id: doc._id },
        actor: actorFromReq(req),
        summary: "Refunded payment",
        changes: shallowDiff(before, doc.toObject()),
        prevSnapshot: before,
        nextSnapshot: doc.toObject(),
        request: {
          ip: req.ip,
          userAgent: req.get?.("user-agent"),
          source: "web",
        },
      });

      const fresh = await populatePayment(Payment.findById(doc._id)).lean();
      return res.json({ data: fresh });
    } catch (err) {
      return res.status(400).json({ message: err.message });
    }
  },

  deletePayment: async (req, res) => {
    try {
      if (!isStaff(req.user)) return res.status(403).json({ message: "Not allowed" });

      const doc = await Payment.findById(req.params.id);
      if (!doc) return res.status(404).json({ message: "Not found" });

      const eventId = doc.event;
      await doc.deleteOne();
      await syncEventPaymentPolicy(eventId);
      req.logActivity?.({
        action: "delete",
        target: { model: "Payment", id: req.params.id },
        actor: actorFromReq(req),
        summary: "Deleted payment",
        prevSnapshot: doc.toObject(),
        request: {
          ip: req.ip,
          userAgent: req.get?.("user-agent"),
          source: "web",
        },
      });

      return res.json({ success: true });
    } catch (err) {
      return res.status(400).json({ message: err.message });
    }
  },
};

export default paymentCtrl;
