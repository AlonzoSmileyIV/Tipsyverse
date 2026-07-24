import mongoose from "mongoose";

const CounterSchema = new mongoose.Schema(
  { _id: { type: String, required: true }, seq: { type: Number, default: 0 } },
  { versionKey: false }
);
const CounterModel =
  mongoose.models.__Counter || mongoose.model("__Counter", CounterSchema);

const AttachmentSchema = new mongoose.Schema(
  {
    url: { type: String, trim: true, required: true },
    publicId: { type: String, trim: true, required: true },
    originalName: { type: String, trim: true, default: "" },
    mimeType: { type: String, trim: true, default: "" },
    size: { type: Number, default: 0 },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

async function getNextSeq(scope = "support-ticket") {
  const doc = await CounterModel.findOneAndUpdate(
    { _id: scope },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  ).lean();
  return doc.seq;
}

const TicketMessageSchema = new mongoose.Schema(
  {
    author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    message: { type: String, trim: true, required: true, maxlength: 2000 },
    internal: { type: Boolean, default: false },
    parentMessage: { type: mongoose.Schema.Types.ObjectId, default: null },
    attachments: [AttachmentSchema],
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const SupportTicketSchema = new mongoose.Schema(
  {
    ticketNumber: { type: String, unique: true, sparse: true, index: true },
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    category: {
      type: String,
      enum: ["login", "booking", "payments", "bartender_portal", "drink_content", "notifications", "other"],
      default: "other",
      index: true,
    },
    priority: {
      type: String,
      enum: ["undecided", "low", "medium", "high", "urgent"],
      default: "undecided",
      index: true,
    },
    status: {
      type: String,
      enum: ["open", "in_progress", "waiting_on_user", "resolved", "closed", "canceled"],
      default: "open",
      index: true,
    },
    subject: { type: String, trim: true, required: true, maxlength: 140 },
    description: { type: String, trim: true, required: true, maxlength: 2000 },
    attachments: [AttachmentSchema],
    notes: { type: String, trim: true, maxlength: 4000, default: "" },
    resolution: { type: String, trim: true, maxlength: 2000 },
    canceledAt: { type: Date, default: null },
    canceledBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    reopenedAt: { type: Date, default: null },
    reopenedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    messages: [TicketMessageSchema],
  },
  { timestamps: true }
);

SupportTicketSchema.index({ status: 1, priority: 1, createdAt: -1 });

SupportTicketSchema.path("ticketNumber").validate(function (value) {
  if (value == null) return true;
  return /^TKT-\d{6}$/.test(value);
}, "Invalid ticket number format.");

SupportTicketSchema.pre("save", async function (next) {
  try {
    if (this.ticketNumber) return next();
    const nextSeq = await getNextSeq("support-ticket");
    this.ticketNumber = `TKT-${String(nextSeq).padStart(6, "0")}`;
    return next();
  } catch (err) {
    return next(err);
  }
});

SupportTicketSchema.pre("findOneAndUpdate", function (next) {
  const update = this.getUpdate() || {};
  if (
    update.ticketNumber ||
    (update.$set && Object.prototype.hasOwnProperty.call(update.$set, "ticketNumber"))
  ) {
    return next(new Error("ticketNumber is immutable and cannot be changed"));
  }
  next();
});

export const SupportTicketModel = mongoose.model("SupportTicket", SupportTicketSchema);
export default SupportTicketModel;
