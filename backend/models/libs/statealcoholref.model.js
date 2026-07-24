// models/StateAlcoholRef.ts
import mongoose, { Schema } from "mongoose";

// --- Reusable subdocs ---
const LinkSchema = new Schema(
  {
    label: { type: String, required: true, trim: true },
    url: { type: String, required: true, trim: true },
  },
  { _id: false }
);


// NEW: Fine-grained sale permission by channel (on/off-premise) & beverage class
const SalePermissionSchema = new Schema(
  {
    channel: { type: String, enum: ["on_premise", "off_premise"], required: true },
    status:  { type: String, enum: ["wet", "dry", "moist"], required: true }, // moist = limited (e.g., beer/wine only)
    beverageClasses: [{ type: String, enum: ["beer", "wine", "spirits"] }],    // optional; if omitted, assume all
    hoursOfSale: { type: String },                                             // local override summary
    sundaySales: { type: String },                                             // e.g., “No sales before 12pm”
    notes: { type: String },                                                   // “restaurants only,” “private clubs only,” etc.
    sources: [{ label: String, url: String, _id: false }],
    effectiveFrom: { type: Date },
    effectiveTo:   { type: Date },
  },
  { _id: false }
);

const CountyOrCitySchema = new Schema(
  {
    name: { type: String, required: true, trim: true }, // "Los Angeles County" or "Birmingham"
    kind: { type: String, enum: ["county", "city"], required: true },
    localityStatus: { type: String, enum: ["wet", "dry", "moist"], default: "wet" },
    salePermissions: { type: [SalePermissionSchema], default: [] },

    notes: { type: String, default: "" },

    links: {
      ordinances: { type: [LinkSchema], default: [] },
      licensing: { type: [LinkSchema], default: [] },
      enforcement: { type: [LinkSchema], default: [] },
      other: { type: [LinkSchema], default: [] },
    },

    overrides: {
      hoursOfSale: { type: String },
      sundaySales: { type: String },
      serverAge: { type: Number, min: 14, max: 25 }, // reasonable guardrails
    },

    // Optional: when YOU last checked this locality
    lastVerifiedAt: { type: Date },
  },
  { _id: false }
);

const SourceAttributionSchema = new Schema(
  {
    label: { type: String, required: true, trim: true }, // “ABC – Hours of Sale”
    url: { type: String, required: true, trim: true },
    checkedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

// --- Main schema ---
const StateAlcoholRefModel = new Schema(
  {
    stateName: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    stateCode: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      minlength: 2,
      maxlength: 2, // e.g., CA, TX
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    // Core facts (text so you can explain nuance; keep short, human-readable)
    serverMinimumAge: { type: Number, default: 21 }, // e.g., 18/19/21 (serving in on-premise)
    bartenderLicenseRequired: { type: Boolean, default: false }, // required statewide?
    hoursOfSaleSummary: { type: String }, // “On-premise 6am–2am; local changes may apply”
    sundaySalesSummary: { type: String }, // Sunday-specific rules if any
    lastDrinkCallNotes: { type: String }, // “Stop serving 30 min before closing” (if applicable)
    takeoutDeliveryNotes: { type: String }, // if allowed, sealed containers rules, etc.

    // Links (arrays so you can keep multiple official sources)
    links: {
      bartendingApplication: { type: [LinkSchema], default: [] }, // “State training / permit”
      verifyLicenses: { type: [LinkSchema], default: [] }, // lookup portals
      alcoholBeverageControl: { type: [LinkSchema], default: [] }, // ABC homepage
      lawsAndRegulations: { type: [LinkSchema], default: [] }, // statutes, admin code
      trainingRequirements: { type: [LinkSchema], default: [] }, // Responsible server training
      minorAndIDGuidance: { type: [LinkSchema], default: [] }, // ID checking guides
      hoursOfficialGuidance: { type: [LinkSchema], default: [] }, // hours of sale official page
      other: { type: [LinkSchema], default: [] },
    },

   // Local nuance (county/city overrides)
    localities: { type: [CountyOrCitySchema], default: [] },

    // Provenance / versioning
    sources: { type: [SourceAttributionSchema], default: [] },
    effectiveFrom: { type: Date },
    effectiveTo: { type: Date },
    version: { type: Number, default: 1 },

    // Admin
    isActive: { type: Boolean, default: true },
    notesInternal: { type: String },
  },
  { timestamps: true }
);

StateAlcoholRefModel.index({ stateCode: 1 });
StateAlcoholRefModel.index({ slug: 1 });
StateAlcoholRefModel.index({ isActive: 1 });

// Auto-fill slug from stateName if not provided; normalize stateCode
StateAlcoholRefModel.pre("validate", function (next) {
  if (this.isModified("stateName") || !this.slug) {
    this.slug = String(this.stateName || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }
  if (this.isModified("stateCode") && this.stateCode) {
    this.stateCode = this.stateCode.toUpperCase();
  }
  next();
});

export default StateAlcoholRefModel;
