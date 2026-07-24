import mongoose from "mongoose";

const hierarchySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        unique: true,
    },
    description: { type: String, required: true, trim: true },
    rank: { type: Number },
    reportingTo: {
        type: String,
        ref: "Hierarchy",
        default: null
    },
   
}, { timestamps: true });

hierarchySchema.virtual('id').get(function () {
    return this._id.toHexString();
});

hierarchySchema.set('toJSON', {
    virtuals: true,
});

const HierarchyModel = mongoose.model('Hierarchy', hierarchySchema);

export default HierarchyModel;
