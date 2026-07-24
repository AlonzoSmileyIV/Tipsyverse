import mongoose from "mongoose";

const MAX_COMMENT_LENGTH = 500;

const commentSchema = new mongoose.Schema(
  {
    drink: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Drink",
      required: true,
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    parentComment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Comment",
      default: null,
      index: true,
    },
    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Comment",
      default: null,
    },
    edited: { type: Boolean, default: false },
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: MAX_COMMENT_LENGTH,
    },
    analytics: {
      counts: {
        likes: { type: Number, default: 0 },
        replies: { type: Number, default: 0 },
        reports: { type: Number, default: 0 }, // NEW
      },
      usersMentioned: [
        {
          userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
          },
          username: {
            type: String,
            required: true,
          },
        },
      ],
      userLikes: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
      ],
      userReplies: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Comment",
        },
      ],
      userReports: [ // NEW
    {
      user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
      reason: { type: String, required: true },
      dateReported: { type: Date, default: Date.now },
      
    },
  ]
    },
    userMentioned: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    ],
    notes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Note",
      },
    ],
  },
  { timestamps: true }
);

commentSchema.virtual("id").get(function () {
  return this._id.toHexString();
});

commentSchema.set("toJSON", {
  virtuals: true,
});

const CommentModel = mongoose.model("Comment", commentSchema);

export default CommentModel;
