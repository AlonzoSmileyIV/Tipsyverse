import mongoose from "mongoose";

const PaymentSchema = new mongoose.Schema(
  {
    event: { type: mongoose.Schema.Types.ObjectId, ref: "Event", required: true },
    paymentRequest: { type: mongoose.Schema.Types.ObjectId, ref: "PaymentRequest" },

    amount: { type: Number, required: true },
    method: {
      type: String,
      enum: ["stripe", "square", "paypal", "venmo", "cashapp", "zelle", "cash", "check", "other"],
      required: true,
    },

    reference: String,
    notes: String,
    receivedAt: Date,
    collectedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

    status: {
      type: String,
      enum: ["recorded", "voided", "refunded"],
      default: "recorded",
    },

    // Partial refunds remain attached to the original payment so the ledger
    // can retain the gross receipt while balance calculations use its net.
    refundedAmount: { type: Number, min: 0, default: 0 },
    refunds: [
      {
        amount: { type: Number, min: 0, required: true },
        notes: String,
        method: {
          type: String,
          enum: ["credit_card", "square", "paypal", "venmo", "cashapp", "zelle", "cash", "check", "other"],
        },
        refundedAt: { type: Date, default: Date.now },
        refundedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        providerRefundId: String,
      },
    ],
    refundMethod: {
      type: String,
      enum: ["credit_card", "square", "paypal", "venmo", "cashapp", "zelle", "cash", "check", "other"],
    },

    voidReason: String,
    voidedAt: Date,
    voidedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

    editedAt: Date,
    editedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

    stripe: {
      paymentIntentId: String,
      checkoutSessionId: String,
      chargeId: String,
      customerId: String,
      refundId: String,
    },
  },
  { timestamps: true, optimisticConcurrency: true }
);

PaymentSchema.index({ "stripe.paymentIntentId": 1 }, { unique: true, sparse: true });
PaymentSchema.index({ event: 1, status: 1, receivedAt: -1 });
PaymentSchema.index({ paymentRequest: 1, status: 1 });

export const PaymentModel = mongoose.model("Payment", PaymentSchema);
export default PaymentModel;
