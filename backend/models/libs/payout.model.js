import mongoose from "mongoose";

const PayoutSchema = new mongoose.Schema(
  {
    event:         { type: mongoose.Schema.Types.ObjectId, ref: "Event", required: true, index: true },
    bartenderUser: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    assignment: { type: mongoose.Schema.Types.ObjectId, ref: "Assignment", default: null, index: true },

    amount:   { type: Number, min: 0, required: true },
    currency: { type: String, default: "usd" },

    status: { type: String, enum: ["scheduled","processing","paid","failed"], default: "scheduled", index: true },

    provider:   {
      type: String,
      enum: ["manual", "cashapp", "zelle", "paypal", "venmo", "stripe", "check", "cash"],
      default: "manual",
    },
    transferId: { type: String }, // Stripe transfer id
    reference: { type: String, trim: true, default: "" },
    notes: { type: String, trim: true, default: "" },

    scheduledAt:  { type: Date, default: Date.now },
    paidAt:       { type: Date },
    failureReason:{ type: String },
  },
  { timestamps: true }
);

PayoutSchema.index({ bartenderUser: 1, status: 1, scheduledAt: 1 });

export const PayoutModel = mongoose.model("Payout", PayoutSchema);
export default PayoutModel;
