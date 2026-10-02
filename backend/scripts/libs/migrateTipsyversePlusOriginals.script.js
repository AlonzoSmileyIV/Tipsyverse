import "dotenv/config";
import mongoose from "mongoose";
import { DrinkModel as Drink } from "../../models/index.js";
import { getCurrentMongoURI } from "../../utils/libs/getMongoURI.js";

const DEFAULT_PUBLIC_ORIGINALS = ["berry-after-dark", "kims-kiss", "smokey-mountains"];

const publicOriginals = (process.env.PUBLIC_ORIGINAL_SLUGS || DEFAULT_PUBLIC_ORIGINALS.join(","))
  .split(",")
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean);

const environment = process.env.NODE_ENV || "development";
await mongoose.connect(getCurrentMongoURI(environment));
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
