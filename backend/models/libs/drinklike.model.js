import mongoose from "mongoose";

const DrinkLikeSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    drink: { type: mongoose.Schema.Types.ObjectId, ref: "Drink", required: true, index: true },
  },
  { timestamps: true }
);

DrinkLikeSchema.index({ user: 1, drink: 1 }, { unique: true });
DrinkLikeSchema.index({ drink: 1, createdAt: -1 });

const DrinkLikeModel = mongoose.model("DrinkLike", DrinkLikeSchema);

export { DrinkLikeModel };
export default DrinkLikeModel;
