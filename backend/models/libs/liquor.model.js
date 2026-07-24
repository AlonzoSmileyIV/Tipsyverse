import mongoose from "mongoose";

const liquorSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true, unique: true },
    slug: { type: String, required: true, trim: true, unique: true },
    description: { type: String, required: true },
    photo: { type: String },
    photoPublicId: { type: String },
    status: { type: String, default: 'Active' },
    brands: [{ type: String }],
    notes: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Note",
        },
    ],
}, { timestamps: true });

liquorSchema.virtual("id").get(function () {
    return this._id.toHexString();
});

liquorSchema.set("toJSON", {
    virtuals: true,
});

const LiquorModel = mongoose.model('Liquor', liquorSchema);

export default LiquorModel;
