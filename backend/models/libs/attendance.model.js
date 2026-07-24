import mongoose from "mongoose";

const VerificationSchema = new mongoose.Schema(
  {
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    status: {
      type: String,
      enum: ["present", "absent", "late", "left_early", "disputed"],
      required: true,
    },
    notes: { type: String, trim: true, maxlength: 1000 },
    verifiedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const AttendanceSchema = new mongoose.Schema(
  {
    event: { type: mongoose.Schema.Types.ObjectId, ref: "Event", required: true, index: true },
    assignment: { type: mongoose.Schema.Types.ObjectId, ref: "Assignment", required: true, unique: true },
    bartenderUser: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    status: {
      type: String,
      enum: ["not_started", "clocked_in", "clocked_out", "verified", "disputed"],
      default: "not_started",
      index: true,
    },
    clockInAt: { type: Date },
    clockOutAt: { type: Date },
    clockInNote: { type: String, trim: true, maxlength: 500 },
    clockOutNote: { type: String, trim: true, maxlength: 500 },
    contactVerification: { type: VerificationSchema, default: null },
  },
  { timestamps: true }
);

AttendanceSchema.index({ event: 1, bartenderUser: 1 });

export const AttendanceModel = mongoose.model("Attendance", AttendanceSchema);
export default AttendanceModel;
