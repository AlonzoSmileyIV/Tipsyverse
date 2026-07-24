// models/course/Enrollment.js
import mongoose from "mongoose";

/** ── Quiz Attempt ───────────────────────────────────────────────────────── **/
const AttemptSchema = new mongoose.Schema(
  {
    at: { type: Date, default: Date.now },
    // One array per question: selected option indices, e.g., [[1],[0,3],...]
    answers: {
      type: [[Number]],
      default: [],
    },
    score: { type: Number, min: 0, max: 1, required: true }, // e.g., 0.8
    passed: { type: Boolean, required: true },
  },
  { _id: false }
);

/** ── Per-Module Progress ───────────────────────────────────────────────── **/
const ModuleProgressSchema = new mongoose.Schema(
  {
    moduleIdx: { type: Number, required: true, min: 0 },

    // Notes path tracking
    readSeconds: { type: Number, min: 0, default: 0 },

    // Video path tracking (kept for future)
    watchedSec: { type: Number, min: 0, default: 0 },

    // If the user fails a quiz, set canSkip=false to force full read/watch next attempt
    canSkip: { type: Boolean, default: true },

    attempts: { type: [AttemptSchema], default: [] },

    passedAt: { type: Date }, // set when first passed
  },
  { _id: false }
);

/** ── Certificate ───────────────────────────────────────────────────────── **/
const CertificateSchema = new mongoose.Schema(
  {
    issued: { type: Boolean, default: false },
    issuedAt: { type: Date },
    certId: { type: String },  // e.g., TIP-COURSE-ABC123
    url: { type: String },     // link to PDF/PNG
  },
  { _id: false }
);

/** ── Enrollment ─────────────────────────────────────────────────────────── **/
const EnrollmentSchema = new mongoose.Schema(
  {
    user:   { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true, index: true },

    moduleProgress: { type: [ModuleProgressSchema], default: [] },
    certificate:    { type: CertificateSchema, default: () => ({}) },
  },
  { timestamps: true }
);

// one enrollment per user+course
EnrollmentSchema.index({ user: 1, course: 1 }, { unique: true });

// Convenience virtual: isComplete (all modules have passedAt)
EnrollmentSchema.virtual("isComplete").get(function () {
  if (!this.moduleProgress?.length) return false;
  return this.moduleProgress.every(mp => !!mp.passedAt);
});

const EnrollmentModel = mongoose.model("Enrollment", EnrollmentSchema);

export default EnrollmentModel;
