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
  { timestamps: true }
);

PaymentSchema.index({ "stripe.paymentIntentId": 1 }, { unique: true, sparse: true });
PaymentSchema.index({ event: 1, status: 1, receivedAt: -1 });
PaymentSchema.index({ paymentRequest: 1, status: 1 });

export const PaymentModel = mongoose.model("Payment", PaymentSchema);
export default PaymentModel;
