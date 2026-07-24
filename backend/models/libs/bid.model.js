import mongoose from "mongoose";

const BidSchema = new mongoose.Schema(
  {
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: true,
      index: true,
    },
    bartenderUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    status: {
      type: String,
      enum: [
        "interested",
        "not_interested",
        "rejected",
        "selected",
        "denied",
        "waitlist",
        "dropped"
      ],
      default: "interested",
      index: true,
    },
    score: { type: Number, default: 0 }, // snapshot for ranking
    submittedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// One bid per bartender per event
BidSchema.index({ event: 1, bartenderUser: 1 }, { unique: true });

export const BidModel = mongoose.model("Bid", BidSchema);
export default BidModel;
