import "dotenv/config";
import mongoose from "mongoose";
import { DrinkModel as Drink } from "../../models/index.js";

const DEFAULT_PUBLIC_ORIGINALS = ["berry-after-dark", "kims-kiss", "smokey-mountains"];

const publicOriginals = (process.env.PUBLIC_ORIGINAL_SLUGS || DEFAULT_PUBLIC_ORIGINALS.join(","))
  .split(",")
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean);

const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
if (!uri) throw new Error("MONGODB_URI (or MONGO_URI) is required.");

await mongoose.connect(uri);
try {
  const originals = { categories: "Tipsyverse Originals" };
  const premiumResult = await Drink.updateMany(originals, { $set: { accessLevel: "subscriber" } });
  const publicResult = await Drink.updateMany(
    { ...originals, slug: { $in: publicOriginals } },
    { $set: { accessLevel: "public" } }
  );

  console.log(`Tipsyverse Originals premium: ${premiumResult.modifiedCount}`);
  console.log(`Public preview Originals: ${publicResult.modifiedCount}`);
  console.log(`Public slugs: ${publicOriginals.join(", ")}`);
} finally {
  await mongoose.disconnect();
}
