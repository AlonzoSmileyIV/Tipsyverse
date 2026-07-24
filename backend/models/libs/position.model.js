import mongoose from "mongoose";

const positionSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        unique: true,
    },
    description: {
        type: String,
        required: true,
        trim: true,
    },
    department: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Department",
    },
    hierarchy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Hierarchy",
    },
    notes: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Note",
        },
    ],

}, { timestamps: true });

positionSchema.virtual('id').get(function () {
    return this._id.toHexString();
});

positionSchema.set('toJSON', {
    virtuals: true,
});

const PositionModel = mongoose.model('Position', positionSchema);

export default PositionModel;
