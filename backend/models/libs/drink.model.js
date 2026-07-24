import mongoose from "mongoose";
import { v2 as cloudinary } from "cloudinary";

const ingredientSchema = new mongoose.Schema({
  name: { type: String, required: true },
  ounces: { type: Number, required: true, min: 0 },
  brand:   { type: String, trim: true, default: "" },    // e.g., "Hennessy", "Cointreau" (optional)
  flavor: { type: String, trim: true, default: "" },      // e.g., "Strawberry", "Raspberry" (optional)
});

const UserViewSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    anonId: { type: String, default: null }, // per-device marker
    dateViewed: { type: Date, required: true },
  },
  { _id: false }
);

const UserShareSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    anonId: { type: String, default: null }, // per-device marker
    dateShared: { type: Date, required: true },
  },
  { _id: false }
);

const drinkSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    slug: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      lowercase: true
    },
    description: {
      type: String,
    },
    photo: {
      type: String,
      default:
        "https://res.cloudinary.com/dtbgyeyjq/image/upload/v1747893721/default/images/drink.png",
    },
    photoPublicId: {
      type: String,
      default: "default/images/drink",
    },

    video: { type: String, default: "" },
    videoPublicId: { type: String, default: "" },

    colors: [{ type: String }], // e.g., red, orange, yellow, green

    taste: [{ type: String }], // e.g., sweet, salty

     // Flexible tags (contextual, e.g. holidays/occasions)
  tags: [
    {
      type: String,
      enum: [
        "Memorial Day",
        "Juneteenth",
        "Fourth of July",
        "Halloween",
        "Thanksgiving",
        "Christmas",
        "New Years",
        "Valentine's Day",
        "St Patricks Day",
        "Wedding",
        "Game Night",
        "Summer BBQ",
        "Brunch",
      ],
         index: true,
    },
  ],

    glass: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Glass",
    },
    // e.g. cocktail glass, shot glass,

    tools: [{ type: String }], // e.g. shaker,

    garnishes: [{ type: String }], // e.g. cherry, strawberry, lemon, lime

    categories: {
      type: [String],
      enum: [
        "Classic",
        "Fall", "Winter", "Spring", "Summer",
        "Tipsyverse Originals",
        "Easy at Home",
        "Party",
        "Trouble",
      ],
      default: [],
      index: true,
    },

    isAlcoholic: {
      type: Boolean,
      default: true,
    },

    ingredients: [ingredientSchema],

    instructions: [
      {
        type: String,
        required: true,
        trim: true,
      },
    ],

    dates: {
      dateCreated: { type: Date, default: Date.now() },
      datePublishStarts: { type: Date, default: Date.now() },
      datePublishEnds: { type: Date, default: null },
    },

    analytics: {
      counts: {
        views: { type: Number, default: 0 },
        likes: { type: Number, default: 0 },
        comments: { type: Number, default: 0 },
        shares: { type: Number, default: 0 },
        bookmarks: { type: Number, default: 0 },
      },
      userViews: { type: [UserViewSchema], default: [] },
      userComments: [
        {
          comment: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Comment",
          },
          dateCommented: { type: Date },
        },
      ],
      userShares: { type: [UserShareSchema], default: [] },
    },
    author: {
      id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        //required: true,
      },
    },

    status: { type: String, default: "Active" }, // pending, denied, Active, inactive

    notes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Note",
      },
    ],
  },
  { timestamps: true }
);

drinkSchema.virtual("id").get(function () {
  return this._id.toHexString();
});

// helper to build a Cloudinary URL from publicId
function cldUrl(publicId) {
  return cloudinary.url(publicId, { secure: true }); // add transformations if you want
}

function makeDisplayLabel(i) {
  const qty = typeof i.ounces === "number" ? `${i.ounces} oz` : "";
  const flavor = i.flavor ? `${i.flavor} ` : "";
  const brand = i.brand ? `${i.brand}` : "";
  const base = i.name || "Ingredient";
  const displayName = `${flavor}${brand || base}`.trim();
  const note = i.note ? ` (${i.note})` : "";
  return [qty, `${displayName}${note}`].filter(Boolean).join(" ");
}

// In your Drink schema file:
drinkSchema.pre("save", function(next) {
  if (Array.isArray(this.ingredients)) {
    this.ingredients = this.ingredients.map(i => ({
      ...i,
      displayLabel: makeDisplayLabel(i),
    }));
  }
  next();
});

// Auto-fill defaults if missing
drinkSchema.pre("validate", function (next) {
  if (!this.photoPublicId && this.slug) {
    this.photoPublicId = `default/images/${this.slug}`;
  }
  if (!this.photo && this.photoPublicId) {
    this.photo = cldUrl(this.photoPublicId);
  }
  next();
});

drinkSchema.set("toJSON", {
  virtuals: true,
});

const DrinkModel = mongoose.model("Drink", drinkSchema);

export default DrinkModel;
