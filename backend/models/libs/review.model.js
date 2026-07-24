// models/ReviewModel.js
import mongoose from "mongoose";

const { Schema } = mongoose;

const ReviewSchema = new Schema(
  {
    // who is writing the review (client / organizer)
    reviewerUser: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // which bartender is being reviewed
    bartenderUser: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // which event this review is about
    event: {
      type: Schema.Types.ObjectId,
      ref: "Event",
      required: true,
      index: true,
    },

    // 1–5 stars (or whatever scale you want)
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },

    // optional written feedback
    comment: {
      type: String,
      trim: true,
      maxlength: 500,
    },

    // optional: allow hiding reviewer from bartender (but YOU still know)
    isAnonymousToBartender: {
      type: Boolean,
      default: false,
    },

    // optional: bartender can reply
    bartenderReply: {
      body: { type: String, trim: true, maxlength: 2000 },
      repliedAt: { type: Date },
    },
  },
  {
    timestamps: true, // createdAt, updatedAt
  }
);

// one review per (reviewerUser, bartenderUser, event)
ReviewSchema.index(
  { reviewerUser: 1, bartenderUser: 1, event: 1 },
  { unique: true }
);

export const ReviewModel = mongoose.model("Review", ReviewSchema);
export default ReviewModel;
