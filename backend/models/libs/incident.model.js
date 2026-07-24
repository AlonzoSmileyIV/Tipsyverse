import mongoose from "mongoose";

const NoteSchema = new mongoose.Schema(
  {
    author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    body: { type: String, trim: true, required: true, maxlength: 1000 },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const IncidentSchema = new mongoose.Schema(
  {
    event: { type: mongoose.Schema.Types.ObjectId, ref: "Event", index: true },
    assignment: { type: mongoose.Schema.Types.ObjectId, ref: "Assignment" },
    reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: {
      type: String,
      enum: [
        "guest_injury",
        "underage_drinking_attempt",
        "intoxicated_guest_refused_service",
        "property_damage",
        "bartender_misconduct",
        "other",
      ],
      required: true,
      index: true,
    },
    severity: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      default: "medium",
      index: true,
    },
    status: {
      type: String,
      enum: ["open", "reviewing", "resolved", "dismissed"],
      default: "open",
      index: true,
    },
    occurredAt: { type: Date, default: Date.now },
    description: { type: String, trim: true, required: true, maxlength: 2000 },
    witnesses: { type: String, trim: true, maxlength: 1000 },
    actionTaken: { type: String, trim: true, maxlength: 1000 },
    resolution: { type: String, trim: true, maxlength: 1000 },
    notes: [NoteSchema],
  },
  { timestamps: true }
);

IncidentSchema.index({ event: 1, createdAt: -1 });
IncidentSchema.index({ status: 1, severity: 1, createdAt: -1 });

export const IncidentModel = mongoose.model("Incident", IncidentSchema);
export default IncidentModel;
