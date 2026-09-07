import mongoose from "mongoose";

const PaymentRequestSchema = new mongoose.Schema({
  event: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Event",
    required: true,
  },

  provider: {
    type: String,
    enum: [
      "stripe",
      "square",
      "paypal",
      "venmo",
      "cashapp",
      "zelle",
      "other",
    ],
    required: true,
  },

  paymentType: {
    type: String,
    enum: ["deposit", "full", "custom"],
    required: true,
  },

  amountRequested: {
    type: Number,
    required: true,
  },

  providerUrl: String,
  stripePaymentIntentId: { type: String, index: true },

  sentTo: {
    fullName: String,
    email: String,
    phone: String,
  },

  sentBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },

  status: {
    type: String,
    enum: [
      "draft",
      "sent",
      "expired",
      "cancelled",
      "completed",
    ],
    default: "draft",
  },

  sentAt: Date,
  expiresAt: Date,

  emailId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "EmailLog",
  },
}, { timestamps: true, optimisticConcurrency: true });

// Only one customer-payable request may exist per event. Revised pricing or a
// replacement request must invalidate the previous link first.
PaymentRequestSchema.index(
  { event: 1 },
  {
    name: "one_sent_payment_request_per_event",
    unique: true,
    partialFilterExpression: { status: "sent" },
  }
);
PaymentRequestSchema.index(
  { event: 1, createdAt: -1 },
  { name: "payment_requests_by_event_created" }
);

export const PaymentRequestModel = mongoose.model("PaymentRequest", PaymentRequestSchema);
export default PaymentRequestModel;
