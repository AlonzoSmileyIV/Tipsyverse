import mongoose from "mongoose";
import { PaymentModel as Payment } from "../../models/index.js";
import { getEventPaymentTotal } from "./eventSummary.js";

export const inactiveEventStatuses = new Set(["canceled", "completed", "closed"]);

export const netRecordedPayments = async (eventId, { session, paymentRequest } = {}) => {
  const match = {
    event: new mongoose.Types.ObjectId(String(eventId)),
    status: "recorded",
    ...(paymentRequest
      ? { paymentRequest: new mongoose.Types.ObjectId(String(paymentRequest)) }
      : {}),
  };
  const aggregate = Payment.aggregate([
    { $match: match },
    {
      $group: {
        _id: "$event",
        total: { $sum: { $subtract: ["$amount", { $ifNull: ["$refundedAmount", 0] }] } },
      },
    },
  ]);
  if (session) aggregate.session(session);
  const [row] = await aggregate;
  return Math.round((Number(row?.total) || 0) * 100) / 100;
};

export const eventBalanceSnapshot = async (event, options = {}) => {
  const paid = await netRecordedPayments(event._id, options);
  const total = Math.round(getEventPaymentTotal(event) * 100) / 100;
  return {
    total,
    paid,
    balance: Math.max(0, Math.round((total - paid) * 100) / 100),
    overpayment: Math.max(0, Math.round((paid - total) * 100) / 100),
  };
};

export const assertCollectibleEvent = (event) => {
  if (!event) {
    const error = new Error("Event not found");
    error.statusCode = 404;
    throw error;
  }
  if (inactiveEventStatuses.has(event.status)) {
    const error = new Error(`Payments cannot be requested or recorded for a ${event.status} event.`);
    error.statusCode = 409;
    throw error;
  }
};

export const assertActivePaymentRequest = (request, { now = new Date() } = {}) => {
  if (!request || request.status !== "sent") {
    const error = new Error("An active sent payment request is required.");
    error.statusCode = 409;
    throw error;
  }
  if (request.expiresAt && new Date(request.expiresAt) <= now) {
    const error = new Error("This payment request has expired.");
    error.statusCode = 409;
    throw error;
  }
};
