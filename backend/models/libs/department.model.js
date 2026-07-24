import mongoose from "mongoose";

const departmentSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        unique: true,
    },
    description: { type: String, required: true, trim: true },
    head: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Employee",
    },
    notes: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Note",
        },
    ],

}, { timestamps: true });

departmentSchema.virtual('id').get(function () {
    return this._id.toHexString();
});

departmentSchema.set('toJSON', {
    virtuals: true,
});

const DepartmentModel = mongoose.model('Department', departmentSchema);

export default DepartmentModel;
