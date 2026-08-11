import mongoose from "mongoose";
import {
  EventModel as Event,
  PaymentModel as Payment,
} from "../../models/index.js";
import { deriveEventPaymentPolicy } from "./eventPaymentPolicy.js";
import { getEventPaymentTotal } from "./eventSummary.js";

export const getRecordedEventPayments = async (eventId) => {
  const [row] = await Payment.aggregate([
    {
      $match: {
        event: new mongoose.Types.ObjectId(String(eventId)),
        status: "recorded",
      },
    },
    { $group: { _id: "$event", total: { $sum: "$amount" } } },
  ]);
  return Math.round((Number(row?.total) || 0) * 100) / 100;
};

export const syncEventPaymentPolicy = async (eventId, { now = new Date() } = {}) => {
  if (!mongoose.isValidObjectId(eventId)) return null;

  const event = await Event.findById(eventId)
    .select("startAt timezone location.timezone createdAt updatedAt status payment")
    .lean();
  if (!event) return null;

  const paid = await getRecordedEventPayments(event._id);
  const result = deriveEventPaymentPolicy({
    startAt: event.startAt,
    confirmedAt:
      event.payment?.policyScheduledAt || event.updatedAt || event.createdAt,
    existingDueAt: event.payment?.balanceDueAt,
    total: event.payment?.total,
    paid,
    arrangementApproved: Boolean(event.payment?.arrangementApprovedAt),
    now,
    timeZone:
      event.timezone ||
      event.location?.timezone ||
      "America/Indiana/Indianapolis",
  });
  const schedule = result.schedule;
  const total = Math.round(getEventPaymentTotal(event) * 100) / 100;
  const balance = Math.max(0, Math.round((total - paid) * 100) / 100);
  const overpayment = Math.max(0, Math.round((paid - total) * 100) / 100);
  const paymentStatus =
    total > 0 && paid >= total
      ? "paid_in_full"
      : paid > 0
      ? "partially_paid"
      : "none";
  const update = {
    // Keep the event's denormalized payment summary aligned with the Payment
    // ledger. Workflow and customer event views can therefore render the same
    // values immediately, while the ledger remains the source of truth.
    "payment.paidTotal": paid,
    "payment.balance": balance,
    "payment.overpayment": overpayment,
    "payment.status": paymentStatus,
    "payment.policyStatus": result.status,
    ...(schedule
      ? {
          "payment.balanceDueAt": schedule.dueAt,
          "payment.shortNoticeFullPayment": schedule.shortNotice,
        }
      : {}),
  };

  await Event.updateOne({ _id: event._id }, { $set: update });
  return {
    ...result,
    event,
    paid,
    total,
    balance,
    overpayment,
    paymentStatus,
  };
};

export default syncEventPaymentPolicy;
