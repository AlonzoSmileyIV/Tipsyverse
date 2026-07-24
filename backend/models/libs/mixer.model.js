import mongoose from "mongoose";

const mixerSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
            unique: true
        },
        photo: { type: String },
        photoPublicId: { type: String },
        description: { type: String },
        isAlcoholic: { type: Boolean, default: false },
        brands: [{
            type: String
        }],
        notes: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Note",
            },
        ],
    }, { timestamps: true });

mixerSchema.virtual("id").get(function () {
    return this._id.toHexString();
});

mixerSchema.set("toJSON", {
    virtuals: true,
});

const MixerModel = mongoose.model('Mixer', mixerSchema);

export default MixerModel;
