import mongoose from "mongoose";

const ShippingAddressSchema = new mongoose.Schema(
  {
    fullName: { type: String, trim: true, default: "" },
    address1: { type: String, trim: true, default: "" },
    address2: { type: String, trim: true, default: "" },
    city: { type: String, trim: true, default: "" },
    state: { type: String, trim: true, default: "" },
    zipcode: { type: String, trim: true, default: "" },
    country: { type: String, trim: true, default: "US" },
    instructions: { type: String, trim: true, default: "" },
  },
  { _id: false }
);

const RewardClaimAnswerSchema = new mongoose.Schema(
  {
    key: { type: String, trim: true, required: true },
    label: { type: String, trim: true, required: true },
    value: { type: String, trim: true, default: "" },
  },
  { _id: false }
);

const RewardClaimSchema = new mongoose.Schema(
  {
    bartenderUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    milestone: { type: Number, required: true, min: 1, index: true },
    reward: { type: String, trim: true, required: true },
    costRange: { type: String, trim: true, default: "" },
    status: {
      type: String,
      enum: ["pending", "approved", "fulfilled", "declined", "canceled"],
      default: "pending",
      index: true,
    },
    shippingAddress: { type: ShippingAddressSchema, default: () => ({}) },
    answers: { type: [RewardClaimAnswerSchema], default: [] },
    shirtSize: {
      type: String,
      enum: ["", "XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL"],
      default: "",
    },
    poloColor: { type: String, trim: true, default: "" },
    personalizationText: { type: String, trim: true, default: "" },
    notes: { type: String, trim: true, default: "" },
    internalNotes: { type: String, trim: true, default: "" },
    requestedAt: { type: Date, default: Date.now },
    reviewedAt: { type: Date, default: null },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    fulfilledAt: { type: Date, default: null },
    fulfilledBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    sentAt: { type: Date, default: null },
    sentBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    declinedAt: { type: Date, default: null },
    declinedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

RewardClaimSchema.index({ bartenderUser: 1, milestone: 1 }, { unique: true });

export const RewardClaimModel = mongoose.model("RewardClaim", RewardClaimSchema);
export default RewardClaimModel;
