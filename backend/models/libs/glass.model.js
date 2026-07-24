import mongoose from "mongoose";

const glassSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true,
    },
    maxOunces: { type: Number, required: true },
    notes: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Note",
        },
    ],
}, { timestamps: true });

glassSchema.virtual("id").get(function () {
    return this._id.toHexString();
});

glassSchema.set("toJSON", {
    virtuals: true,
});

const GlassModel = mongoose.model("Glass", glassSchema);

export default GlassModel;
