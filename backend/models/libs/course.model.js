// models/course.model.js
import mongoose from "mongoose";

const { Schema, Types, model, models } = mongoose;

/* ---------- Reusable bits ---------- */
const OptionSchema = new Schema(
  {
    text: { type: String, required: true, trim: true },
    isCorrect: { type: Boolean, default: false },
  },
  { _id: false }
);

const QuestionSchema = new Schema(
  {
    _id: { type: Schema.Types.ObjectId, auto: true },
    prompt: { type: String, required: true, trim: true },
    options: { type: [OptionSchema], default: [] },
    points: { type: Number, default: 1, min: 0 },
  },
 { timestamps: false }
);

const MediaImageSchema = new Schema(
  { url: String, publicId: String },
  { _id: false }
);

const MediaVideoSchema = new Schema(
  { url: String, publicId: String, durationSec: Number },
  { _id: false }
);

/* ---------- Section ---------- */
const SectionSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    sectionOrder: { type: Number, default: 0, index: true }, // ← for drag & drop
    images: { type: [MediaImageSchema], default: [] },
    videos: { type: [MediaVideoSchema], default: [] },
    content: { type: String, default: "" },
    quiz: { questions: { type: [QuestionSchema], default: [] } },
  },
  { timestamps: false }
);

/* ---------- Module ---------- */
const ModuleSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true },
    description: {type: String},
    moduleOrder: { type: Number, default: 0, index: true }, // ← for drag & drop
    sections: { type: [SectionSchema], default: [] },
    quizInfo: {
      poolSize: { type: Number, default: 5, min: 0 }, // allow 0 = all
      passingScorePct: { type: Number, default: 70, min: 0, max: 100 },
    },
  },
  { timestamps: false }
);

/* ---------- Course ---------- */
const AVAILABLE_ROLES = ["employee", "bartender", "regular", "admin"]; // <-- canonicalize here

const CourseSchema = new Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      /* consider removing unique */ unique: true,
      index: true,
    },
    slug: {
      type: String,
      required: true,
      trim: true
    },

    courseOrder: { type: Number, default: 0, index: true }, // canonical DB field

    requiredForRoles: { type: [String], default: [], index: true }, // <—


    description: { type: String, default: "" },

    sections: {
      type: [
        /* SectionSchema */
      ],
      default: [],
    },
    modules: {
      type: [
         ModuleSchema
      ],
      default: [],
    },

    restrictedTo: { type: [String], default: ["employee"] },

    quiz: {
      poolSize: { type: Number, default: 0, min: 0 }, // allow 0 = all
      passingScorePct: { type: Number, default: 70, min: 0, max: 100 },
    },

    status: {
      type: String,
      enum: ["draft", "published", "archived"],
      default: "draft",
      index: true,
    },
    publishedAt: { type: Date },

    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
    version: { type: Number, default: 1 },

    stats: {
      sectionsCount: { type: Number, default: 0 },
      questionPoolCount: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

/* ---------- Virtual compatibility: accept sortOrder in payload ---------- */
CourseSchema.virtual("sortOrder")
  .get(function () {
    return this.courseOrder;
  })
  .set(function (v) {
    this.courseOrder = Number(v) || 0;
  });

/* ---------- Indexes ---------- */
// Text index ONLY on text fields
CourseSchema.index(
  { title: "text", description: "text" },
  { weights: { title: 5, description: 1 }, name: "course_text_idx" }
);

// Optional: case-insensitive unique on slug (Mongo 3.4+ with collation)
CourseSchema.index({ slug: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });


/* ---------- Helpers ---------- */
function getAllSections(doc) {
  if (!doc) return [];
  if (Array.isArray(doc.modules) && doc.modules.length) {
    return doc.modules.flatMap((m) => m?.sections || []);
  }
  return Array.isArray(doc.sections) ? doc.sections : [];
}

function countQuestions(sections) {
  return sections.reduce(
    (total, s) => total + (s?.quiz?.questions?.length || 0),
    0
  );
}

/* ---------- Normalize + slug + stats middleware ---------- */
CourseSchema.pre("validate", function (next) {
  // slug from title if missing/changed
  if ((this.isModified("title") || !this.slug) && this.title) {
    this.slug = String(this.title)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  // normalize tags (lowercase, trim, unique, no empties)
  if (Array.isArray(this.tags)) {
    const seen = new Set();
    this.tags = this.tags
      .map((t) =>
        String(t || "")
          .trim()
          .toLowerCase()
      )
      .filter((t) => t.length > 0 && !seen.has(t) && (seen.add(t), true));
  } else {
    this.tags = [];
  }

  // normalize restrictedTo (map “regular” -> “user”, restrict to known roles)
  if (Array.isArray(this.restrictedTo)) {
    const mapRegular = (r) =>
      String(r).toLowerCase() === "regular" ? "user" : String(r).toLowerCase();
    const seen = new Set();
    this.restrictedTo = this.restrictedTo
      .map(mapRegular)
      .filter((r) => AVAILABLE_ROLES.includes(r))
      .filter((r) => !seen.has(r) && (seen.add(r), true));
    if (!this.restrictedTo.length) this.restrictedTo = [];
  } else {
    this.restrictedTo = [];
  }

  // accept sortOrder passthrough (if provided by controllers/UI)
  if (this.isDirectModified?.("sortOrder") && this.sortOrder != null) {
    this.courseOrder = Number(this.sortOrder) || 0;
  }

  next();
});

function toSlug(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

CourseSchema.pre("validate", function (next) {
  // existing course slug logic...
  if ((this.isModified("title") || !this.slug) && this.title) {
    this.slug = toSlug(this.title);
  }

  // ensure module slugs
  if (Array.isArray(this.modules)) {
    this.modules.forEach((m) => {
      if (!m.slug || (m.isModified?.("title") && m.title)) {
        m.slug = toSlug(m.title);
      }
    });
  }

  // (optional) ensure section slugs too if you’ll use them later
  // this.modules?.forEach(m => m.sections?.forEach(s => { if (!s.slug) s.slug = toSlug(s.title) }))

  // ...rest of your pre-validate
  next();
});

// --- helper ---
const toRole = (r) => {
  const v = String(r || "").toLowerCase();
  return v === "regular" ? "user" : v;
};

// in your existing pre("validate") where you normalize arrays:
CourseSchema.pre("validate", function (next) {
  // ... existing slug/tags/restrictedTo normalization ...

  // normalize requiredForRoles
  if (Array.isArray(this.requiredForRoles)) {
    const seen = new Set();
    this.requiredForRoles = this.requiredForRoles
      .map(toRole)
      .filter((r) => AVAILABLE_ROLES.includes(r))
      .filter((r) => !seen.has(r) && (seen.add(r), true));
  } else {
    this.requiredForRoles = [];
  }

  next();
});

// Friendly boolean you asked for:
CourseSchema.virtual("neededToBeABartender")
  .get(function () {
    return (this.requiredForRoles || []).includes("bartender");
  })
  .set(function (v) {
    const has = (this.requiredForRoles || []).includes("bartender");
    if (v && !has) this.requiredForRoles.push("bartender");
    if (!v && has) {
      this.requiredForRoles = this.requiredForRoles.filter((r) => r !== "bartender");
    }
  });

CourseSchema.pre("save", function (next) {
  const sections = getAllSections(this);
  this.stats.sectionsCount = sections.length;
  this.stats.questionPoolCount = countQuestions(sections);

  const total = this.stats.questionPoolCount || 0;
  const pool = Number(this.quiz?.poolSize) || 0; // 0 = use all

  // If a finite poolSize was set (>0), clamp it so it never exceeds total.
  if (pool > 0 && pool > total) {
    // EITHER clamp to total:
    this.quiz.poolSize = total;

    // OR, if you prefer "too big" means "use all", then use:
    // this.quiz.poolSize = 0;
  }

  next();
});

/* ---------- Utility methods (unchanged from yours) ---------- */
CourseSchema.methods.applyModuleOrder = function (orders = []) {
  const map = new Map(orders.map((o) => [String(o._id), o.moduleOrder ?? 0]));
  this.modules = (this.modules || [])
    .map((m) => ({
      ...(m.toObject?.() || m),
      moduleOrder: map.get(String(m._id)) ?? m.moduleOrder ?? 0,
    }))
    .sort((a, b) => (a.moduleOrder || 0) - (b.moduleOrder || 0));
};

CourseSchema.methods.applySectionOrder = function ({
  moduleId,
  orders = [],
} = {}) {
  const map = new Map(orders.map((o) => [String(o._id), o.sectionOrder ?? 0]));
  if (moduleId) {
    const mod = (this.modules || []).find(
      (m) => String(m._id) === String(moduleId)
    );
    if (!mod) return;
    mod.sections = (mod.sections || [])
      .map((s) => ({
        ...(s.toObject?.() || s),
        sectionOrder: map.get(String(s._id)) ?? s.sectionOrder ?? 0,
      }))
      .sort((a, b) => (a.sectionOrder || 0) - (b.sectionOrder || 0));
  } else {
    this.sections = (this.sections || [])
      .map((s) => ({
        ...(s.toObject?.() || s),
        sectionOrder: map.get(String(s._id)) ?? s.sectionOrder ?? 0,
      }))
      .sort((a, b) => (a.sectionOrder || 0) - (b.sectionOrder || 0));
  }
};

/* ---------- Search helper (optional) ---------- */
CourseSchema.statics.searchCatalog = function ({
  q,
  restrictedTo,
  status,
  page = 1,
  limit = 20,
} = {}) {
  const where = {};
  if (q) where.$text = { $search: q };
  if (Array.isArray(restrictedTo) && restrictedTo.length)
    where.restrictedTo = {
      $in: restrictedTo.map((r) => String(r).toLowerCase()),
    };
  if (status) where.status = status;

  const skip = (Number(page) - 1) * Number(limit);
  const projection = q ? { score: { $meta: "textScore" } } : {};
  const sort = q ? { score: { $meta: "textScore" } } : { updatedAt: -1 };

  return this.find(where, projection)
    .sort(sort)
    .skip(skip)
    .limit(Number(limit));
};

export const CourseModel = models.Course || model("Course", CourseSchema);
