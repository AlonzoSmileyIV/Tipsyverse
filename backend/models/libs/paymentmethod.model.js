// models/PaymentMethod.js
import mongoose from "mongoose";

const PaymentMethodSchema = new mongoose.Schema(
  {
    owner:    { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },

    provider: { type: String, enum: ["stripe"], required: true },
    type:     { type: String, enum: ["card","ach"], required: true },

    // Token refs (never store raw numbers)
    externalId:  { type: String, required: true }, // Stripe pm_... or ba_...
    customerId:  { type: String },                 // Stripe cus_...
    fingerprint: { type: String },                 // helps avoid dup adds (optional)

    // Display metadata
    brand:    { type: String },              // "visa", "mastercard", "amex", "bank"
    last4:    { type: String, match: /^\d{2,4}$/ },
    expMonth: { type: Number, min: 1, max: 12 },
    expYear:  { type: Number, min: 2000, max: 2100 },

    nickname: { type: String, trim: true, required: true, maxlength: 80 },
    // Normalized value provides deterministic case-insensitive uniqueness
    // without depending on a deployment's collection collation.
    nicknameKey: { type: String, required: true, select: false },

    isDefault: { type: Boolean, default: false },

    billingName:    { type: String, trim: true },
    billingEmail:   { type: String, trim: true, lowercase: true },
    billingAddress: { type: mongoose.Schema.Types.ObjectId, ref: "Address" },

    status: { type: String, enum: ["active","inactive"], default: "active" },
  },
  { timestamps: true }
);

// One default per owner
PaymentMethodSchema.index(
  { owner: 1, isDefault: 1 },
  { unique: true, partialFilterExpression: { isDefault: true } }
);

// No duplicate provider token for same owner
PaymentMethodSchema.index(
  { owner: 1, provider: 1, externalId: 1 },
  { unique: true }
);

// Optional: avoid duplicate nicknames per owner (nice UX; helps with auto-name retries)
PaymentMethodSchema.index(
  { owner: 1, nicknameKey: 1 },
  { unique: true, name: "payment_method_owner_nickname_ci" }
);

/**
 * Auto-nickname: if none provided, set to "Credit Card #N" for this owner.
 * We keep it simple + resilient (retry on unique error once).
 */

PaymentMethodSchema.pre("validate", function () {
  this.nickname = String(this.nickname || "").trim();
  this.nicknameKey = this.nickname.toLocaleLowerCase("en-US");
});

export const PaymentMethodModel = mongoose.model("PaymentMethod", PaymentMethodSchema);
export default PaymentMethodModel;
