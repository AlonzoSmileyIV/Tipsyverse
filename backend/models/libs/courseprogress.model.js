// models/courseProgress.model.js
import mongoose from "mongoose";

const { Schema, Types, model } = mongoose;

/* -------------------- Quiz pieces -------------------- */
// Keep answers the same
const QuizAnswerSchema = new Schema(
  {
    questionId: { type: Schema.Types.ObjectId, required: true },
    selectedIndex: { type: Number, required: true }, // 0..n
    isCorrect: { type: Boolean, required: true },
    points: { type: Number, default: 0 },
  },
  { _id: false }
);

// Attempts: "stay the same minus the sectionId"
const QuizAttemptSchema = new Schema(
  {
    // moduleId can be useful for auditing; keep optional
    moduleId: { type: Schema.Types.ObjectId, required: false },

    startedAt: { type: Date, default: Date.now },
    completedAt: { type: Date },

    answers: { type: [QuizAnswerSchema], default: [] },
    score: { type: Number, default: 0 },      // points earned
    maxScore: { type: Number, default: 0 },
    percent: { type: Number, default: 0 },    // 0–100
    passed: { type: Boolean, default: false },

    poolSizeUsed: { type: Number, default: 0 }, // how many served in this attempt
  },
  { _id: true, timestamps: false }
);

/* -------------------- Per-section (light) -------------------- */
const SectionProgressLiteSchema = new Schema(
  {
    sectionId:   { type: Schema.Types.ObjectId, required: true },
    startedAt:   { type: Date },
    completedAt: { type: Date },
  },
  { _id: false }
);

/* -------------------- Per-module progress -------------------- */
const ModuleProgressSchema = new Schema(
  {
    moduleId: { type: Schema.Types.ObjectId, required: true, index: true },

    // rollup + lifecycle
    status: {
      type: String,
      enum: ["locked", "in_progress", "failed", "passed"],
      default: "locked",
      index: true,
    },
    startedAt:   { type: Date },
    completedAt: { type: Date },

    // 0..1 fraction for UI progress
    progress:   { type: Number, default: 0, min: 0, max: 1 },
    bestScore:  { type: Number, default: 0 },
    bestPercent:{ type: Number, default: 0 },
    passed:     { type: Boolean, default: false },

    // quiz attempts for the module (aggregated from section questions)
    attempts: { type: [QuizAttemptSchema], default: [] },

    // lightweight section markers
    sections: { type: [SectionProgressLiteSchema], default: [] },
  },
  { _id: false }
);

/* -------------------- Course progress root -------------------- */
const CourseProgressSchema = new Schema(
  {
    userId:   { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    courseId: { type: Schema.Types.ObjectId, ref: "Course", required: true, index: true },

    status: {
      type: String,
      enum: ["not_started", "in_progress", "completed", "expired"],
      default: "not_started",
      index: true,
    },

    startedAt:     { type: Date },
    completedAt:   { type: Date },
    lastViewedAt:  { type: Date, default: Date.now },

    currentModuleId:     { type: Schema.Types.ObjectId },
    currentSectionId:    { type: Schema.Types.ObjectId },
    currentSectionIndex: { type: Number, default: 0 },

    // per-module state (includes all section markers)
    modules: { type: [ModuleProgressSchema], default: [] },

    // optional snapshots / rollups (handy for quick dashboards)
    totalModules:       { type: Number, default: 0 },
    modulesCompleted:   { type: Number, default: 0 },
    totalSections:      { type: Number, default: 0 },
    sectionsCompleted:  { type: Number, default: 0 },
    bestPercentOverall: { type: Number, default: 0 },
    timeSpentSec:       { type: Number, default: 0 },

    // certification / governance
    certificateId:       { type: String },
    certificateIssuedAt: { type: Date },
    expiresAt:           { type: Date },
    meta:                { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

// Ensure one doc per (user, course)
CourseProgressSchema.index({ userId: 1, courseId: 1 }, { unique: true });

/* -------------------- Instance helpers -------------------- */
CourseProgressSchema.methods._getOrCreateModule = function (moduleId) {
  const mid = String(moduleId);
  let mod = this.modules.find((m) => String(m.moduleId) === mid);
  if (!mod) {
    mod = {
      moduleId,
      status: this.status === "not_started" ? "locked" : "in_progress",
      progress: 0,
      passed: false,
      attempts: [],
      sections: [],
    };
    this.modules.push(mod);
  }
  return mod;
};

// Mark course started (and optionally set the initial pointers)
CourseProgressSchema.methods.startIfNeeded = function ({
  firstModuleId,
  firstSectionId,
  totalModules,
  totalSections,
} = {}) {
  if (this.status === "not_started") {
    this.status = "in_progress";
    this.startedAt = new Date();
  }
  if (firstModuleId) this.currentModuleId = firstModuleId;
  if (firstSectionId) this.currentSectionId = firstSectionId;
  if (Number.isFinite(totalModules)) this.totalModules = totalModules;
  if (Number.isFinite(totalSections)) this.totalSections = totalSections;
  this.lastViewedAt = new Date();

  // ensure module exists, unlock it
  if (firstModuleId) {
    const mod = this._getOrCreateModule(firstModuleId);
    if (mod.status === "locked") mod.status = "in_progress";
    if (!mod.startedAt) mod.startedAt = new Date();
  }
};

// Mark content progress (lightweight: start/complete timestamps)
CourseProgressSchema.methods.markSectionProgress = function ({
  moduleId,
  sectionId,
  complete = false,
  moduleTotalSections, // <-- pass from controller
} = {}) {
  const mod = this._getOrCreateModule(moduleId);
  let sec = mod.sections.find(s => String(s.sectionId) === String(sectionId));
  if (!sec) { sec = { sectionId, startedAt: new Date() }; mod.sections.push(sec); }
  if (!sec.startedAt) sec.startedAt = new Date();
  if (complete) sec.completedAt = sec.completedAt || new Date();

  const done  = mod.sections.filter(s => s.completedAt).length;
  const total = moduleTotalSections || (mod.sections.length || 1);
  mod.progress = Math.max(0, Math.min(1, done / total));

  this.lastViewedAt = new Date();
};

// Record a module-level quiz attempt (aggregated quiz)
CourseProgressSchema.methods.recordModuleQuizAttempt = function ({
  moduleId,
  answers = [],
  score = 0,
  maxScore = 0,
  percent = 0,
  passed = false,
  poolSizeUsed = 0,
} = {}) {
  const mod = this._getOrCreateModule(moduleId);

  const attempt = {
    moduleId,
    startedAt: new Date(),
    completedAt: new Date(),
    answers,
    score,
    maxScore,
    percent,
    passed,
    poolSizeUsed,
  };
  mod.attempts.push(attempt);

  // improve bests
  mod.bestScore = Math.max(mod.bestScore || 0, score || 0);
  mod.bestPercent = Math.max(mod.bestPercent || 0, percent || 0);

  // status transitions
  if (passed) {
    mod.passed = true;
    mod.status = "passed";
    mod.completedAt = mod.completedAt || new Date();
  } else {
    // Only mark failed if the module has been attempted at least once
    if (mod.status !== "passed") mod.status = "failed";
  }

  // roll-up module completion count
  this.modulesCompleted = (this.modules || []).filter((m) => !!m.passed).length;

  // course completion (optional rule: all modules passed)
  if (this.totalModules && this.modulesCompleted >= this.totalModules) {
    this.status = "completed";
    this.completedAt = this.completedAt || new Date();
  } else if (this.status === "not_started") {
    this.status = "in_progress";
  }

  this.lastViewedAt = new Date();
  return attempt;
};

export const CourseProgressModel = model("CourseProgress", CourseProgressSchema);
export default CourseProgressModel;
