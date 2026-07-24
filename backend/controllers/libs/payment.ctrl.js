import {
  EventModel as Event,
  PaymentModel as Payment,
  PaymentRequestModel as PaymentRequest,
} from "../../models/index.js";
import { actorFromReq, shallowDiff } from "../../utils/index.js";

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
        stripe,
      } = req.body;

      if (!event || amount == null || !method) {
        return res.status(400).json({ message: "event, amount, and method are required." });
      }

      const eventDoc = await Event.findById(event).select("_id").lean();
      if (!eventDoc) return res.status(404).json({ message: "Event not found" });

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
        amount,
        method,
        reference,
        notes,
        receivedAt: receivedAt || new Date(),
        collectedBy: req.user.id,
        status,
        stripe,
      });

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

      const before = doc.toObject();
      const allowed = [
        "amount",
        "method",
        "reference",
        "notes",
        "receivedAt",
        "status",
        "stripe",
      ];

      for (const field of allowed) {
        if (Object.prototype.hasOwnProperty.call(req.body, field)) {
          doc[field] = req.body[field];
        }
      }

      doc.editedAt = new Date();
      doc.editedBy = req.user.id;
      await doc.save();

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
      doc.status = "refunded";
      doc.editedAt = new Date();
      doc.editedBy = req.user.id;
      if (req.body.notes) doc.notes = req.body.notes;
      if (!doc.stripe) doc.stripe = {};
      if (req.body.refundId) doc.stripe.refundId = req.body.refundId;
      await doc.save();

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

      await doc.deleteOne();
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
