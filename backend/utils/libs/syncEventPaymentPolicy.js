import mongoose from "mongoose";
import crypto from "node:crypto";
import {
  EventModel as Event,
  PaymentModel as Payment,
} from "../../models/index.js";
import { deriveEventPaymentPolicy } from "./eventPaymentPolicy.js";
import { getEventPaymentTotal } from "./eventSummary.js";
import { summarizePaymentRows } from "./paymentLedger.js";

const ledgerRows = async (eventId) =>
  Payment.find({
    event: eventId,
    status: { $in: ["recorded", "refunded"] },
  })
    .select("_id amount refundedAmount status updatedAt")
    .sort({ _id: 1 })
    .lean();

const fingerprintRows = (rows) =>
  crypto
    .createHash("sha256")
    .update(
      JSON.stringify(
        rows.map((row) => [
          String(row._id),
          row.status,
          Math.round((Number(row.amount) || 0) * 100),
          Math.round((Number(row.refundedAmount) || 0) * 100),
          row.updatedAt ? new Date(row.updatedAt).toISOString() : "",
        ])
      )
    )
    .digest("hex");

export const getRecordedEventPayments = async (eventId) => {
  const [row] = await Payment.aggregate([
    {
      $match: {
        event: new mongoose.Types.ObjectId(String(eventId)),
        status: { $in: ["recorded", "refunded"] },
      },
    },
    {
      $group: {
        _id: "$event",
        total: {
          $sum: { $subtract: ["$amount", { $ifNull: ["$refundedAmount", 0] }] },
        },
      },
    },
  ]);
  return Math.round((Number(row?.total) || 0) * 100) / 100;
};

export const syncEventPaymentPolicy = async (
  eventId,
  { now = new Date(), _attempt = 0 } = {}
) => {
  if (!mongoose.isValidObjectId(eventId)) return null;

  const event = await Event.findById(eventId)
    .select("startAt timezone location.timezone createdAt updatedAt status payment billingOverride cancellation cancelReason")
    .lean();
  if (!event) return null;

  const rows = await ledgerRows(event._id);
  const ledger = summarizePaymentRows(rows);
  const paid = ledger.paid;
  const ledgerFingerprint = fingerprintRows(rows);
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
  const isCanceled = event.status === "canceled";
  const retainedAmount = Math.max(0, Number(event.cancellation?.retainedAmount) || 0);
  const cancellationCredit = Math.max(
    0,
    Math.round((paid - retainedAmount) * 100) / 100
  );
  const paidAtCancellation = Math.max(
    0,
    Number(event.cancellation?.paidAtCancellation) || 0
  );
  const update = {
    // Keep the event's denormalized payment summary aligned with the Payment
    // ledger. Workflow and customer event views can therefore render the same
    // values immediately, while the ledger remains the source of truth.
    "payment.total": total,
    "payment.paidTotal": paid,
    "payment.grossPaidTotal": ledger.grossPaid,
    "payment.refundedTotal": ledger.refunded,
    "payment.balance": isCanceled ? 0 : balance,
    "payment.overpayment": isCanceled ? cancellationCredit : overpayment,
    "payment.status": paymentStatus,
    "payment.policyStatus": isCanceled
      ? event.cancelReason === "nonpayment"
        ? "canceled_nonpayment"
        : "canceled"
      : result.status,
    "payment.ledgerFingerprint": ledgerFingerprint,
    "payment.ledgerSyncedAt": now,
    ...(isCanceled
      ? {
          "cancellation.refundEligibleAmount": cancellationCredit,
          "cancellation.refundReviewStatus":
            cancellationCredit > 0
              ? "pending"
              : paidAtCancellation > 0
              ? "resolved"
              : "not_required",
        }
      : {}),
    ...(schedule
      ? {
          "payment.balanceDueAt": schedule.dueAt,
          "payment.shortNoticeFullPayment": schedule.shortNotice,
        }
      : {}),
  };

  const ledgerChanged = (event.payment?.ledgerFingerprint || "") !== ledgerFingerprint;
  const writeResult = await Event.updateOne(
    { _id: event._id, __v: Number(event.__v) || 0 },
    {
      $set: update,
      $inc: {
        __v: 1,
        ...(ledgerChanged ? { "payment.ledgerVersion": 1 } : {}),
      },
    }
  );

  if (writeResult.modifiedCount !== 1) {
    if (_attempt < 4) {
      return syncEventPaymentPolicy(event._id, {
        now: new Date(),
        _attempt: _attempt + 1,
      });
    }
    throw new Error("Event payment ledger changed too frequently to synchronize safely.");
  }

  // A payment can settle while this snapshot is being written. Recheck the
  // transaction fingerprint after the write and repair immediately instead
  // of allowing an older concurrent sync to become the final event summary.
  const verifiedRows = await ledgerRows(event._id);
  if (fingerprintRows(verifiedRows) !== ledgerFingerprint && _attempt < 4) {
    return syncEventPaymentPolicy(event._id, {
      now: new Date(),
      _attempt: _attempt + 1,
    });
  }
  return {
    ...result,
    event,
    paid,
    grossPaid: ledger.grossPaid,
    refunded: ledger.refunded,
    total,
    balance: isCanceled ? 0 : balance,
    overpayment: isCanceled ? cancellationCredit : overpayment,
    paymentStatus,
  };
};

export default syncEventPaymentPolicy;
