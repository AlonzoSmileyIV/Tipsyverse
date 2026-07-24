import "dotenv/config";
import mongoose from "mongoose";
import {
  DrinkLikeModel as DrinkLike,
  DrinkModel as Drink,
  DrinkSaveModel as DrinkSave,
} from "../../models/index.js";

const VALID_ENVIRONMENTS = ["development", "staging", "production", "backup"];

async function recomputeDrinkCounts(drinkIds) {
  for (const drinkId of drinkIds) {
    const [likeCount, saveCount] = await Promise.all([
      DrinkLike.countDocuments({ drink: drinkId }),
      DrinkSave.countDocuments({ drink: drinkId }),
    ]);

    await Drink.findByIdAndUpdate(drinkId, {
      $set: {
        "analytics.counts.likes": likeCount,
        "analytics.counts.bookmarks": saveCount,
      },
    });
  }
}

async function migrate() {
  const env = (process.env.NODE_ENV || "development").toLowerCase();
  const cleanLegacyArrays = process.env.CLEAN_LEGACY_ARRAYS === "true";
  if (!VALID_ENVIRONMENTS.includes(env)) {
    throw new Error(`Invalid NODE_ENV "${env}".`);
  }

  const dbURIs = {
    development: process.env.MONGO_DEV_URI,
    staging: process.env.MONGO_STAGING_URI,
    production: process.env.MONGO_PROD_URI,
    backup: process.env.MONGO_BACKUP_URI,
  };

  const mongoUri = dbURIs[env];
  if (!mongoUri) throw new Error(`Missing Mongo URI for NODE_ENV=${env}.`);

  await mongoose.connect(mongoUri);

  const users = await mongoose.connection.collection("users").find({
    $or: [
      { likedDrinks: { $exists: true, $ne: [] } },
      { savedDrinks: { $exists: true, $ne: [] } },
    ],
  })
    .project({ likedDrinks: 1, savedDrinks: 1 })
    .toArray();

  const touchedDrinkIds = new Set();
  let likeWrites = 0;
  let saveWrites = 0;

  for (const user of users) {
    for (const drink of user.likedDrinks || []) {
      await DrinkLike.updateOne(
        { user: user._id, drink },
        { $setOnInsert: { user: user._id, drink } },
        { upsert: true }
      );
      touchedDrinkIds.add(String(drink));
      likeWrites += 1;
    }

    for (const drink of user.savedDrinks || []) {
      await DrinkSave.updateOne(
        { user: user._id, drink },
        { $setOnInsert: { user: user._id, drink } },
        { upsert: true }
      );
      touchedDrinkIds.add(String(drink));
      saveWrites += 1;
    }
  }

  await recomputeDrinkCounts([...touchedDrinkIds]);

  if (cleanLegacyArrays) {
    await Promise.all([
      mongoose.connection.collection("users").updateMany(
        {
          $or: [
            { likedDrinks: { $exists: true } },
            { savedDrinks: { $exists: true } },
          ],
        },
        { $unset: { likedDrinks: "", savedDrinks: "" } }
      ),
      mongoose.connection.collection("drinks").updateMany(
        {
          $or: [
            { "analytics.userLikes": { $exists: true } },
            { "analytics.userBookmarks": { $exists: true } },
          ],
        },
        {
          $unset: {
            "analytics.userLikes": "",
            "analytics.userBookmarks": "",
          },
        }
      ),
    ]);
  }

  console.log(
    `Migrated drink activity: ${likeWrites} like refs, ${saveWrites} save refs, ${touchedDrinkIds.size} drinks touched.`
  );
  if (cleanLegacyArrays) {
    console.log("Removed legacy liked/saved arrays from users and drinks.");
  }

  await mongoose.disconnect();
}

migrate().catch(async (err) => {
  console.error("Drink activity migration failed:", err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
