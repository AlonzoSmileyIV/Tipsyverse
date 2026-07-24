import mongoose from "mongoose";

const CouponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["PERCENT_TOTAL", "AMOUNT_TOTAL", "FIXED_DEPOSIT"],
      required: true,
    },
    value: { type: Number, required: true, min: 0 },
    discountType: {
      type: String,
      enum: ["percentage", "fixed"],
      required: true,
    },
    discountValue: { type: Number, required: true, min: 0 },
    minimumSubtotal: { type: Number, default: 0, min: 0 },
    startsAt: { type: Date, default: Date.now },
    endsAt: { type: Date, default: null },
    indefinite: { type: Boolean, default: false },
    maxRedemptions: { type: Number, default: null, min: 1 },
    perUserLimit: { type: Number, default: null, min: 1 },
    audience: {
      type: String,
      enum: [
        "past_customers",
        "all_customers",
        "employees_family",
        "review_incentive",
      ],
      default: "all_customers",
    },
    active: { type: Boolean, default: true, index: true },
    expiresAt: { type: Date, default: null },
    description: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

const CouponModel = mongoose.model("Coupon", CouponSchema);

export default CouponModel;
