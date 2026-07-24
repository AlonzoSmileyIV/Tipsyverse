import mongoose from "mongoose";

const employeeDetailsSchema = new mongoose.Schema(
  {
    position: { type: mongoose.Schema.Types.ObjectId, ref: "Position" },
    reportTo: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    directReports: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    phones: {
      office: {
        country: { type: String },
        phoneNumber: { type: String },
      },
      fax: {
        country: { type: String },
        phoneNumber: { type: String },
      },
      mobile: {
        country: { type: String },
        phoneNumber: { type: String },
      },
    },
    dates: {
      dateStarted: { type: Date, default: Date.now },
      dateStatusLastChanged: { type: Date },
      datesTerminated: [{ type: Date }],
      datesInactivated: [{ type: Date }],
    },
    employmentStatus: {
      state: { type: String, default: "Active" }, // Active, Inactive, Terminated
      isAbsent: { type: Boolean, default: false },
      reasonForTermination: { type: String, default: null },
    },
  },
  { _id: false }
);

const UsernameRegex = /^[a-z0-9._-]{3,32}$/; // adjust allowed chars/range as you like

/* ────────────────────────────────────────────────────────────── */
/* BartenderProfile subdocs                                      */
/* ────────────────────────────────────────────────────────────── */

const GeoPointSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["Point"], default: "Point" },
    coordinates: {
      type: [Number], // [long, lat]
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

const LicenseReminderSchema = new mongoose.Schema(
  {
    threeMonthsSentAt: { type: Date, default: null },
    twoWeeksSentAt: { type: Date, default: null },
    oneDaySentAt: { type: Date, default: null },

    expiredMarkedAt: { type: Date, default: null }, // when you flipped status -> expired
    lastReminderAt: { type: Date, default: null }, // optional: quick “did we email recently?”
  },
  { _id: false }
);

const LicenseSchema = new mongoose.Schema(
  {
    state: { type: String, required: true, uppercase: true, trim: true },
    permitNumber: { type: String, required: true, trim: true },
    expiresAt: { type: Date, required: true },
    verified: { type: Boolean, default: false },
    // NEW: current status for UI
    status: {
      type: String,
      enum: ["pending", "active", "denied", "expired"],
      default: "pending",
    },

    lastStatusChangeAt: {
      type: Date,
      default: null,
    },

    lastStatusChangedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // inside LicenseSchema
    reminders: {
      d90SentOn: { type: String, default: null }, // "YYYY-MM-DD"
      d14SentOn: { type: String, default: null },
      d1SentOn: { type: String, default: null },
      expiredNotifiedOn: { type: String, default: null },
    },

    // OPTIONAL: why it was denied (for admin log / UX)
    decisionNote: { type: String, trim: true, default: "" },
  },
  { _id: true }
);

const BartenderOnboardingDocumentSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      enum: ["w9", "independent_contractor", "service_standards"],
      required: true,
    },
    title: { type: String, trim: true, required: true },
    status: {
      type: String,
      enum: ["not_sent", "sent", "received", "rejected", "expired"],
      default: "not_sent",
    },
    sentAt: { type: Date, default: null },
    receivedAt: { type: Date, default: null },
    lastStatusChangeAt: { type: Date, default: null },
    lastStatusChangedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    notes: { type: String, trim: true, default: "" },
  },
  { _id: false }
);

// Weekly availability rules (recurring)
const AvailabilityRuleSchema = new mongoose.Schema(
  {
    dayOfWeek: { type: Number, min: 0, max: 6, required: true }, // 0=Sun..6=Sat
    blocks: [
      {
        start: {
          type: String,
          match: /^([01]\d|2[0-3]):[0-5]\d$/,
          required: true,
        }, // "HH:mm"
        end: {
          type: String,
          match: /^([01]\d|2[0-3]):[0-5]\d$/,
          required: true,
        },
      },
    ],
  },
  { _id: true }
);

// Hard unavailability blocks (events or custom PTO)
const ScheduleBlockSchema = new mongoose.Schema(
  {
    source: { type: String, enum: ["event", "custom"], required: true },
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: "Event" },
    note: { type: String, trim: true },
  },
  { _id: true }
);

const BartenderProfileSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ["applicant", "approved", "denied"],
      default: "applicant",
    },

    lastStatusChangeAt: {
      type: Date,
      default: null,
    },

    lastStatusChangedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // OPTIONAL: why it was denied (for admin log / UX)
    decisionNote: { type: String, trim: true, default: "" },

    licenses: { type: [LicenseSchema], default: [] },

    onboardingDocuments: {
      type: [BartenderOnboardingDocumentSchema],
      default: [],
    },

    serviceAddresses: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Address" }],
      default: [],
    },

    shareLiveLocation: {
      enabled: { type: Boolean, default: false },
      lastPoint: { type: GeoPointSchema },
      updatedAt: { type: Date },
    },

    contactInfo: {
      phone: { type: String, trim: true, default: "" },
      emergencyContact: {
        fullName: { type: String, trim: true, default: "" },
        relationship: { type: String, trim: true, default: "" },
        phone: { type: String, trim: true, default: "" },
        email: { type: String, trim: true, default: "" },
      },
      updatedAt: { type: Date },
    },

    payoutLinks: {
      preferredProvider: {
        type: String,
        enum: ["", "cashApp", "zelle", "paypal", "venmo"],
        default: "",
      },
      cashApp: { type: String, trim: true, default: "" },
      zelle: { type: String, trim: true, default: "" },
      paypal: { type: String, trim: true, default: "" },
      venmo: { type: String, trim: true, default: "" },
      notes: { type: String, trim: true, default: "" },
      updatedAt: { type: Date },
    },

    availabilityRules: { type: [AvailabilityRuleSchema], default: [] },

    // concrete busy times (events/custom) for conflict checks
    scheduleBlocks: { type: [ScheduleBlockSchema], default: [] },

    dateBartendingStarted: { type: Date, default: null },

    compensation: {
      hourlyRate: { type: Number, min: 40, default: 40 },
      maxHourlyRate: { type: Number, min: 40, default: 60 },
      annualIncrease: { type: Number, min: 0, default: 2 },
      updatedAt: { type: Date, default: null },
      updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
    },

    stats: {
      yearsWithTipsyverse: { type: Number, min: 0, default: 0 },
      totalExperienceYears: { type: Number, min: 0, default: 0 },
      jobsAcceptedLast30d: { type: Number, min: 0, default: 0 },
      upcomingAssignments: { type: Number, min: 0, default: 0 },
      ratingAvg: { type: Number, min: 0, max: 5, default: 0 },
      ratingCount: { type: Number, min: 0, default: 0 },
    },
  },
  { _id: false }
);

// guards
BartenderProfileSchema.pre("validate", function (next) {
  // unique (state, permitNumber) within licenses
  const seen = new Set();
  for (const lic of this.licenses || []) {
    const key = `${lic.state}:${(lic.permitNumber || "").toLowerCase()}`;
    if (seen.has(key))
      return next(new Error("Duplicate license (state + permitNumber)."));
    seen.add(key);
  }
  // schedule blocks sanity
  for (const b of this.scheduleBlocks || []) {
    if (b.startAt >= b.endAt)
      return next(new Error("scheduleBlock startAt must be before endAt."));
  }
  next();
});

/* ────────────────────────────────────────────────────────────── */
/* Main User schema                                               */
/* ────────────────────────────────────────────────────────────── */

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      match: [UsernameRegex, "Invalid username format."],
    },
    email: { type: String, required: true, trim: true, unique: true },
    fullName: { type: String, required: true, trim: true },
    passwordHash: { type: String, required: true, trim: true },

    resetPasswordToken: { type: String, default: null },
    resetPasswordExpires: { type: Date, default: null },

    profile: {
      photo: { type: String, default: "" },
      photoPublicId: { type: String, default: "" },
      bio: { type: String, default: "" },
      birthday: { type: Date },
    },

    preferences: {
      notifications: {
        onMute: { type: Boolean, default: false },
        email: { type: Boolean, default: true },
        sms: { type: Boolean, default: true },
        inApp: { type: Boolean, default: true },
        inWebsite: { type: Boolean, default: true },
      },
      language: { type: String, default: "en" },
      lightTheme: { type: Boolean, default: true },
      allergies: [{ type: String }],
      hasSeenTutorial: { type: Boolean, default: false },
    },

    accountStatus: {
      state: { type: String, default: "Active" },
      isOnline: { type: Boolean, default: false },
      allowedToBookEvent: { type: Boolean, default: true },
      bookingRestrictionReason: { type: String, default: "" },
      reasonForSuspension: { type: String, default: null },
      suspensionExplanation: { type: String, default: null },
      suspensionIndefinite: { type: Boolean, default: false },
      suspensionDateEnds: { type: Date, default: null },
      dateUsernameLastChanged: { type: Date, default: null },
      deactivationDateStarted: { type: Date, default: null },
      deactivationReason: { type: String, default: null },
    },

    role: {
      type: String,
      enum: ["employee", "regular", "bartender"],
      default: "regular",
      required: true,
    },
    createdDrinks: [{ type: mongoose.Schema.Types.ObjectId, ref: "Drink" }],

    // OPTIONAL: keep previous usernames for audit/feature needs
    usernameHistory: { type: [String], default: [] },

    employeeDetails: {
      type: employeeDetailsSchema,
      default: null,
    },
    commentReports: [
      {
        commentId: { type: mongoose.Schema.Types.ObjectId, ref: "Comment" },
        removedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        reason: String,
        deleted: Boolean,
        deletedAt: Date,
      },
    ],
    notes: [{ type: mongoose.Schema.Types.ObjectId, ref: "Note" }],

    /* ✅ NEW: Embedded BartenderProfile */
    bartenderProfile: { type: BartenderProfileSchema, default: null },
  },
  {
    timestamps: true,
  }
);

userSchema.virtual("id").get(function () {
  return this._id.toHexString();
});

userSchema.set("toJSON", {
  virtuals: true,
});

/* Helpful indexes for bartender features */
userSchema.index({ "bartenderProfile.status": 1 });
userSchema.index({ "bartenderProfile.serviceAddresses.location": "2dsphere" });
userSchema.index({
  "bartenderProfile.shareLiveLocation.lastPoint": "2dsphere",
});

userSchema.add({
  primaryServicePoint: {
    type: GeoPointSchema,
    required: false,
    default: undefined,
  },
});

// Make the index partial (only index docs that have coordinates)
userSchema.index(
  { primaryServicePoint: "2dsphere" },
  {
    partialFilterExpression: {
      "primaryServicePoint.coordinates": { $type: "array" },
    },
  }
);

const UserModel = mongoose.model("User", userSchema);
export default UserModel;
