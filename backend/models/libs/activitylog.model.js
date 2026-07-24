import mongoose from "mongoose";
const { Schema } = mongoose;

const ChangeSchema = new Schema(
  {
    path: { type: String, required: true }, // e.g. "profile.photo", "analytics.counts.likes"
    from: { type: Schema.Types.Mixed }, // previous value
    to: { type: Schema.Types.Mixed }, // new value
  },
  { _id: false }
);

const ActivityLogSchema = new Schema(
  {
    // WHEN + WHAT
    action: {
      type: String,
      enum: [
        "create",
        "upsert",
        "update",
        "delete",
        "restore",
        "soft-delete",
        "login",
        "logout",
        "permission-change",
        "status-change",
        "report",
        "cancel",
        "other",

      ],
      required: true,
    },

    target: {
      model: { type: String, required: true }, // "User" | "Drink" | "Comment" | ...
      id: { type: Schema.Types.ObjectId},
      slug: { type: String },
      name: { type: String },
    },

    actionDate: {
      type: Date,
      default: Date.now, // fallback if not explicitly provided
    },

    // WHO
    actor: {
      type: {
        type: String,
        enum: ["User", "System", "Script", "Cron"],
        default: "User",
      },
      id: { type: Schema.Types.ObjectId, ref: "User" },
      label: {
        fullName: String,
        email: String,
        role: String,
        position: {
          id: { type: Schema.Types.ObjectId, ref: "Position" },
          name: String,
        },
      },
    },

    // HOW/WHY
    summary: { type: String }, // short human summary
    reason: { type: String }, // optional user-provided reason
    request: {
      ip: { type: String },
      userAgent: { type: String },
      requestId: { type: String }, // correlation/trace id
      sessionId: { type: String },
      source: { type: String }, // "web", "mobile", "admin-portal", "api"
    },

    // WHAT CHANGED
    changes: [ChangeSchema], // can be empty on create/delete
    prevSnapshot: Schema.Types.Mixed, // keep these intentionally small
    nextSnapshot: Schema.Types.Mixed,

    // MULTI-TENANCY / SCOPE
    context: {
      tenantId: { type: Schema.Types.ObjectId, ref: "Tenant" },
      organizationId: { type: Schema.Types.ObjectId },
      companyId: { type: Schema.Types.ObjectId },
    },

    // Optional: link discussion/notes to a log line
    notes: [{ type: Schema.Types.ObjectId, ref: "Note" }],
  },
  {
    timestamps: { createdAt: true, updatedAt: false }, // append-only feel
    minimize: false, // keep empty objects if you ever need them
  }
);

// ---- Validation: if actor is a User, require actor.id
ActivityLogSchema.path("actor.id").validate(function (value) {
  // `this` is the document
  const actorType = this?.actor?.type;
  if (actorType === "User") return !!value; // must have id
  return true; // ok for System/Script/Cron
}, "actor.id is required when actor.type is 'User'");

// ---- Useful indexes
ActivityLogSchema.index({ "target.id": 1, "target.model": 1, createdAt: -1 });
ActivityLogSchema.index({ "actor.id": 1, createdAt: -1 });
ActivityLogSchema.index({ action: 1, createdAt: -1 });
ActivityLogSchema.index({ "context.tenantId": 1, createdAt: -1 });
ActivityLogSchema.index({ "request.requestId": 1, createdAt: -1 }); // tracing
ActivityLogSchema.index({ "target.model": 1, action: 1, createdAt: -1 }); // common filters

// OPTIONAL: TTL retention (e.g., 365 days). Remove if you must keep forever.
// ActivityLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 365 });

const ActivityLogModel = mongoose.model("ActivityLog", ActivityLogSchema);
export default ActivityLogModel;
