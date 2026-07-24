// models/Address.js
import mongoose from "mongoose";

const GeoPointSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["Point"], default: "Point" },
    coordinates: {
      type: [Number], // [lng, lat]
      required: true,
      validate: v =>
        Array.isArray(v) && v.length === 2 &&
        v[0] >= -180 && v[0] <= 180 &&
        v[1] >= -90 && v[1] <= 90,
    },
  },
  { _id: false }
);

const AddressSchema = new mongoose.Schema(
  {
    owner:       { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    addressType: { type: String, enum: ["service","billing","shipping","other"], default: "service", index: true },

    address1: { type: String, trim: true, required: true },
    address2: { type: String, trim: true },
    city:     { type: String, trim: true, required: true },
    county:   { type: String, trim: true },
    state:    { type: String, trim: true, required: true },
    zipcode:  { type: String, trim: true, required: true },
    country:  { type: String, trim: true, default: "US" },

    // Google Places enrichment
    placeId:   { type: String, trim: true },
    formatted: { type: String, trim: true },
    timezone:  { type: String, trim: true },

    instructions: { type: String, trim: true },

    isPrimary: { type: Boolean, default: false },

    location: { type: GeoPointSchema, required: true }, // GeoJSON [lng, lat]
  },
  { timestamps: true }
);

AddressSchema.index({ location: "2dsphere" });

// One primary per owner+type
AddressSchema.index(
  { owner: 1, addressType: 1, isPrimary: 1 },
  { unique: true, partialFilterExpression: { isPrimary: true } }
);

export const AddressModel = mongoose.model("Address", AddressSchema);
export default AddressModel;
