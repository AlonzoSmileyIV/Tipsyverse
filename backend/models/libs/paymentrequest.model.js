import mongoose from "mongoose";

const PaymentRequestSchema = new mongoose.Schema({
  event: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Event",
    required: true,
    index: true,
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
}, { timestamps: true });

export const PaymentRequestModel = mongoose.model("PaymentRequest", PaymentRequestSchema);
export default PaymentRequestModel;