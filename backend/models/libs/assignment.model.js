import mongoose from "mongoose";

const AssignmentSchema = new mongoose.Schema(
  {
    event:         { type: mongoose.Schema.Types.ObjectId, ref: "Event", required: true, index: true },
    bartenderUser: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },

    assignedAt: { type: Date, default: Date.now },
    notified:   { type: Boolean, default: true },
    status: {
      type: String,
      enum: [
        "active",
        "removed",
      ],
      default: "active",
      index: true,
    },
    reason: {type: String, default: null},
    replacedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null }, // if swapped out
  },
  { timestamps: true }
);

// Avoid duplicate assignment of same user to same event
AssignmentSchema.index({ event: 1, bartenderUser: 1 }, { unique: true });

export const AssignmentModel = mongoose.model("Assignment", AssignmentSchema);
export default AssignmentModel;
