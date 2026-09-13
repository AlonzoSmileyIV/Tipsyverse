// models/eventRequest.model.js
import mongoose from "mongoose";

/* =====================[ ADDED: tiny counter model + helper ]===================== */
const CounterSchema = new mongoose.Schema(
  { _id: { type: String, required: true }, seq: { type: Number, default: 0 } },
  { versionKey: false }
);
const CounterModel =
  mongoose.models.__Counter || mongoose.model("__Counter", CounterSchema);

/** Atomic sequence getter (scope lets you reuse this for other short codes) */
async function getNextSeq(scope = "event") {
  const doc = await CounterModel.findOneAndUpdate(
    { _id: scope },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  ).lean();
  return doc.seq;
}
/* ============================================================================= */

const GeoPointSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["Point"], default: "Point" },
    coordinates: {
      type: [Number],
      required: true,
      validate: (v) =>
        Array.isArray(v) &&
        v.length === 2 &&
        v[0] >= -180 &&
        v[0] <= 180 &&
        v[1] >= -90 &&
        v[1] <= 90,
    },
  },
  { _id: false }
);

const NeedSchema = new mongoose.Schema(
  {
    item: { type: String, trim: true, required: true },
    qty: { type: Number, min: 1, default: 1 },
  },
  { _id: false }
);

const ProcurementItemSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, required: true },
    qty: { type: Number, min: 1, default: 1 },
    pickedUp: { type: Boolean, default: false },
  },
  { _id: false }
);

const ContactSchema = new mongoose.Schema(
  {
    fullName: { type: String, trim: true, required: true },
    email: { type: String, trim: true, required: true },
    phone: { type: String, trim: true },
    preferred: {
      type: String,
      enum: ["email", "text", "call"],
      default: "call",
    },
    role: { type: String, trim: true },
  },
  { _id: true }
);

const PaymentSnapshotSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: [
        "none",
        "authorized",
        "captured",
        "partially_paid",
        "paid_in_full",
        "released",
        "refunded",
      ],
      default: "none",
      index: true,
    },
    processor: {
      type: String,
      enum: ["stripe", "square", "other"],
      default: "stripe",
    },
    // IDs/tokens only
    paymentMethodId: { type: String }, // e.g. pm_xxx
    customerId: { type: String }, // e.g. cus_xxx
    intentId: { type: String }, // e.g. pi_xxx
    clientSecret: { type: String }, // optional to return for client

    brand: { type: String },
    last4: { type: String },
    currency: { type: String, default: "usd" },
    subtotal: { type: Number, min: 0, default: 0 },
    fees: { type: Number, min: 0, default: 0 },
    gratuity: { type: Number, min: 0, default: 0 },
    total: { type: Number, min: 0, default: 0 },
    paidTotal: { type: Number, min: 0, default: 0 },
    balance: { type: Number, min: 0, default: 0 },
    overpayment: { type: Number, min: 0, default: 0 },

    depositPct: { type: Number, min: 0, max: 1, default: 0 },
    depositAmount: { type: Number, min: 0, default: 0 },
    depositStatus: {
      type: String,
      enum: ["none", "pending", "authorized", "captured", "refunded"],
      default: "none",
    },

    authorizedAt: { type: Date },
    capturedAt: { type: Date },
    refundedAt: { type: Date },
    balanceDueAt: { type: Date, index: true },
    policyScheduledAt: { type: Date, default: null },
    policyStatus: {
      type: String,
      enum: [
        "not_priced",
        "current",
        "due_soon",
        "due_now",
        "past_due",
        "payment_hold",
        "action_required",
        "arrangement",
        "paid",
        "canceled",
        "canceled_nonpayment",
      ],
      default: "not_priced",
      index: true,
    },
    shortNoticeFullPayment: { type: Boolean, default: false },
    firstReminderSentAt: { type: Date, default: null },
    pastDueWarningSentAt: { type: Date, default: null },
    holdNoticeSentAt: { type: Date, default: null },
    actionRequiredNoticeSentAt: { type: Date, default: null },
    arrangementApprovedAt: { type: Date, default: null },
    arrangementApprovedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    arrangementNotes: { type: String, trim: true, default: null },
    ledgerVersion: { type: Number, min: 0, default: 0 },
  },
  { _id: false }
);

// 1) Track contact attempts
const ContactAttemptSchema = new mongoose.Schema(
  {
    attemptedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    method: {
      type: String,
      enum: ["phone", "voicemail", "email", "text"],
      required: true,
    },
    outcome: {
      type: String,
      enum: [
        "no_answer",
        "left_voicemail",
        "emailed",
        "texted",
        "customer_busy",
        "spoke_confirming",
        "followup_scheduled",
      ],
      required: true,
    },
    notes: { type: String, trim: true },
    attemptAt: { type: Date, default: Date.now },
    followUpAt: { type: Date },
  },
  { _id: true }
);

const EventSchema = new mongoose.Schema(
  {
    organizer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },

    type: {
      type: String,
      required: true,
      trim: true,
      enum: [
        "wedding",
        "birthday",
        "corporate",
        "formal",
        "holiday",
        "fundraiser",
        "other",
      ],
      default: "other",
    },

    private: { type: Boolean, default: true, index: true },

    /** Address linkage + snapshot **/
    // Link to a saved Address (so the user can reuse it)
    locationAddress: { type: mongoose.Schema.Types.ObjectId, ref: "Address" },
    // Snapshot used for quoting/receipts (doesn't change if Address changes later)
    location: {
      address1: { type: String, trim: true, required: true },
      address2: { type: String, trim: true },
      city: { type: String, trim: true },
      county: { type: String, trim: true },
      state: { type: String, trim: true },
      zipcode: { type: String, trim: true },
      country: { type: String, trim: true, default: "US" },
      formatted: { type: String, trim: true },
      placeId: { type: String, trim: true },
      point: { type: GeoPointSchema, default: undefined },
      timezone: { type: String, trim: true },
    },

    startAt: { type: Date, required: true, index: true },
    endAt: { type: Date, required: true },
    timezone: { type: String, trim: true },
    completedAt: { type: Date, default: null },
    completionEmailSentAt: { type: Date, default: null },

    description: { type: String, trim: true },
    additionalInstructions: { type: String, trim: true },
    bartenderNotes: { type: String, trim: true },
    internalNotes: { type: String, trim: true },
    options: {
      barType: {
        type: String,
        enum: [
          "full_bar",
          "beer_wine",
          "cocktail_bar",
          "signature_cocktail",
          "open_bar",
          "cash_bar",
          "non_alcoholic",
          "unknown",
        ],
        default: "unknown",
      },
      procurementRequested: { type: Boolean, default: false },
      procurementItems: { type: [ProcurementItemSchema], default: [] },
      procurementActualCost: { type: Number, min: 0, default: 0 },
      procurementReceiptProof: { type: String, trim: true },
      procurementReceiptPublicId: { type: String, trim: true },
      procurementReceiptNotes: { type: String, trim: true },
      procurementBilledAt: { type: Date, default: null },
      tipJarsAllowed: { type: Boolean, default: true },
    },
    agreements: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    contactAttempts: { type: [ContactAttemptSchema], default: [] },

    contact: { type: ContactSchema, required: true },
    additionalContacts: { type: [ContactSchema], default: [] },

    /** Staff-completed fields **/
    guestCount: { type: Number, min: 1 },
    preferredBartenders: [
      { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    ],
    counts: {
      recommendedBartenders: { type: Number, min: 1, default: null },
      approvedBartenders: { type: Number, min: 1, default: null },
      neededBartenders: { type: Number, min: 0, default: 0 }, // legacy mirror of approvedBartenders
      assigned: { type: Number, min: 0, default: 0 },
    },
    staffingException: {
      active: { type: Boolean, default: false },
      reason: { type: String, trim: true, maxlength: 1000, default: "" },
      approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
      approvedAt: { type: Date, default: null },
      customerAcknowledgedAt: { type: Date, default: null },
    },

    needs: { type: [NeedSchema], default: [] },

    /** Billing & payment links **/
    billingAddress: { type: mongoose.Schema.Types.ObjectId, ref: "Address" },
    paymentMethod: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PaymentMethod",
    },
    payment: { type: PaymentSnapshotSchema, default: () => ({}) },

    status: {
      type: String,
      enum: [
        "submitted",
        "pending",
        "awaiting_response",
        "bidding",
        "selecting",
        "ready_to_assign",
        "confirmed",
        "reminder_sent",
        "in_progress",
        "completed",
        "closed",
        "canceled",
      ],
      default: "submitted",
      index: true,
    },

    // ❌ Cancellation tracking
    canceledAt: {
      type: Date,
      default: null,
      index: true,
    },
    canceledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    cancelReason: {
      type: String,
      trim: true,
      default: null,
    },
    cancelReasonOther: {
      type: String,
      trim: true,
      default: null,
    },
    cancellation: {
      policyVersion: { type: String, trim: true, default: null },
      timingTier: {
        type: String,
        enum: ["unscheduled", "before_48_hours", "inside_48_hours", "event_started"],
        default: null,
      },
      cancellationFee: { type: Number, min: 0, default: 0 },
      retainedAmount: { type: Number, min: 0, default: 0 },
      paidAtCancellation: { type: Number, min: 0, default: 0 },
      refundEligibleAmount: { type: Number, min: 0, default: 0 },
      refundReviewStatus: {
        type: String,
        enum: ["not_required", "pending", "resolved"],
        default: "not_required",
      },
      automaticRefund: { type: Boolean, default: false },
    },

    visibility: {
      onBiddingBoard: { type: Boolean, default: false },
      bidDeadlineAt: { type: Date },
    },

    pricing: {
      bookingFee: { type: Number, min: 0, default: null },
      hourlyRate: { type: Number, min: 0, default: null },

      // Keep business defaults only if you truly want an auto-fill;
      // otherwise also make these null:
      setupHours: { type: Number, min: 0, default: 0.5 },
      breakdownHours: { type: Number, min: 0, default: 0.5 },

      travelPerMile: { type: Number, min: 0, default: null },

      // NOTE: your UI field is "procurementFee", schema uses "procurementServiceFee".
      // Either rename the schema to "procurementFee" or map in the UI on save/load.
      procurementServiceFee: { type: Number, min: 0, default: null },

      publicFee: { type: Number, min: 0, default: null },

      // Fractions in DB (0..1)
      rushPct: { type: Number, min: 0, max: 1, default: null },
      holidayFee: { type: Number, min: 0, default: null },
      gratuityPct: { type: Number, min: 0, max: 1, default: null },
      taxPct: { type: Number, min: 0, max: 1, default: null },

      bartendersRequested: { type: Number, min: 1, default: 1 },
      discountTotal: { type: Number, min: 0, default: 0 },
    },

    shortCode: { type: String, unique: true, sparse: true },
    bartender24hReminderSentAt: { type: Date, default: null, index: true},
    customer24hReminderSentAt: { type: Date, default: null, index: true},
    bartender5mReminderSentAt: { type: Date, default: null, index: true },
    customer5mReminderSentAt: { type: Date, default: null, index: true },
    bartenderClockOut5mReminderSentAt: { type: Date, default: null, index: true },

  },
  { timestamps: true, optimisticConcurrency: true }
);

EventSchema.pre("validate", function (next) {
  const zone =
    this.timezone ||
    this.location?.timezone ||
    "America/Indiana/Indianapolis";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone }).format(new Date());
  } catch {
    return next(new Error("timezone must be a valid IANA timezone"));
  }
  this.timezone = zone;
  if (this.location) this.location.timezone = zone;
  const legacyRequired = Math.max(
    Number(this.counts?.neededBartenders) || 0,
    Number(this.pricing?.bartendersRequested) || 0,
    1
  );
  const approvedBartenders =
    Number(this.counts?.approvedBartenders) > 0
      ? Number(this.counts.approvedBartenders)
      : legacyRequired;
  const recommendedBartenders =
    Number(this.counts?.recommendedBartenders) > 0
      ? Number(this.counts.recommendedBartenders)
      : approvedBartenders;
  this.counts = this.counts || {};
  this.pricing = this.pricing || {};
  this.counts.recommendedBartenders = recommendedBartenders;
  this.counts.approvedBartenders = approvedBartenders;
  this.counts.neededBartenders = approvedBartenders;
  this.pricing.bartendersRequested = approvedBartenders;
  const hasStaffingException = approvedBartenders < recommendedBartenders;
  if (hasStaffingException && !String(this.staffingException?.reason || "").trim()) {
    return next(
      new Error(
        "staffingException.reason is required when approved staffing is below the recommendation"
      )
    );
  }
  if (this.staffingException) this.staffingException.active = hasStaffingException;
  if (this.startAt && this.endAt && this.endAt <= this.startAt) {
    return next(new Error("endAt must be after startAt"));
  }
  next();
});

EventSchema.virtual("durationHours").get(function () {
  if (!this.startAt || !this.endAt) return 0;
  return Math.max(0, (this.endAt - this.startAt) / 36e5);
});

EventSchema.virtual("openSpots").get(function () {
  const needed =
    Number(this.counts?.approvedBartenders) ||
    Number(this.counts?.neededBartenders) ||
    Number(this.pricing?.bartendersRequested) ||
    1;
  const assigned = this.counts?.assigned ?? 0;
  return Math.max(0, needed - assigned);
});

/* =====================[ ADDED: shortCode format validator ]===================== */
EventSchema.path("shortCode").validate(function (v) {
  if (v == null) return true; // allow null/undefined before assignment
  return /^EVT-\d{5}$/.test(v); // adjust if you later switch to a dated format
}, "Invalid shortCode format.");
/* ============================================================================= */

/* =====================[ ADDED: pre-save to assign once, immutably ]===================== */
EventSchema.pre("save", async function (next) {
  try {
    if (this.shortCode) return next(); // never overwrite once set
    // GLOBAL sequence style: EVT-00001, EVT-00002, ...
    const n = await getNextSeq("event");
    this.shortCode = `EVT-${String(n).padStart(5, "0")}`.toUpperCase();
    return next();
  } catch (e) {
    return next(e);
  }
});
/* ============================================================================= */

/* =====================[ ADDED: guard against later updates to shortCode ]===================== */
EventSchema.pre("findOneAndUpdate", function (next) {
  const u = this.getUpdate() || {};
  if (
    u.shortCode ||
    (u.$set && Object.prototype.hasOwnProperty.call(u.$set, "shortCode"))
  ) {
    return next(new Error("shortCode is immutable and cannot be changed"));
  }
  next();
});

// Auto-populate attemptedBy on any find / findOne / findById
EventSchema.pre(/^find/, function (next) {
  this.populate({
    path: "contactAttempts.attemptedBy",
    select: "fullName fullname name email profile avatarUrl photoUrl image",
  });
  next();
});
/* ============================================================================= */

EventSchema.index({ "location.point": "2dsphere" });
EventSchema.index({ status: 1, startAt: 1 });
EventSchema.index({ private: 1, status: 1, startAt: 1 });
EventSchema.index({ organizer: 1, createdAt: -1 });
EventSchema.index({
  status: 1,
  endAt: 1,
  completionEmailSentAt: 1,
});

export const EventModel = mongoose.model("Event", EventSchema);
export default EventModel;
