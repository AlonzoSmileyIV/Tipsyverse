import mongoose from "mongoose";

const DrinkSaveSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    drink: { type: mongoose.Schema.Types.ObjectId, ref: "Drink", required: true, index: true },
  },
  { timestamps: true }
);

DrinkSaveSchema.index({ user: 1, drink: 1 }, { unique: true });
DrinkSaveSchema.index({ drink: 1, createdAt: -1 });

const DrinkSaveModel = mongoose.model("DrinkSave", DrinkSaveSchema);

export { DrinkSaveModel };
export default DrinkSaveModel;
