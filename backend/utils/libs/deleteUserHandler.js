import mongoose from "mongoose";
import {
  UserModel as User,
  CommentModel as Comment,
  DrinkModel as Drink,
  NotificationModel as Notification,
} from "../../models/index.js";
import { deleteSingleCommentKeepChildren } from "../index.js";

/**
 * Permanently deletes a user and cascades cleanup.
 *
 * @param {string} userId
 * @param {{
 *   bypassStateCheck?: boolean,   // allow cron to delete deactivated/expired, etc.
 *   session?: mongoose.ClientSession | null
 * }} options
 * @returns {Promise<{ meta: any }>}
 */
export async function deleteUserHandler(
  userId,
  { bypassStateCheck = false, session: extSession = null } = {}
) {
  const session = extSession || (await mongoose.startSession());
  const ownSession = !extSession;

  try {
    if (ownSession) session.startTransaction();

    // 1) Load user
    const user = await User.findById(userId).session(session);
    if (!user) throw new Error("User not found.");

    // 2) State guard unless bypassed
    if (!bypassStateCheck) {
      const role = user.role;
      const status = user.accountStatus?.state;
      const canDelete =
        (role === "employee" && status === "Terminated") ||
        (role === "regular" && status === "Inactive");
      if (!canDelete) {
        const msg =
          "Only terminated employees or inactive regular users can be permanently deleted.";
        const err = new Error(msg);
        err.code = "BLOCKED_BY_STATE";
        throw err;
      }
    }

    // 3) Collect authored comments & affected drinks
    const authoredComments = await Comment.find({ author: userId })
      .select("_id drink")
      .lean()
      .session(session);

    const authoredCommentIds = authoredComments.map((c) => c._id.toString());
    const affectedDrinkIdsFromComments = new Set(
      authoredComments.map((c) => c.drink?.toString()).filter(Boolean)
    );
    //----------------------------- ADJUST DRINKS THAT USER LIKED AND BOOKMARKED  --------------------------------

    // 4) Bookmarks/Likes → affected drinks
    const affectedBookmarkDrinkIds = new Set(
      (user.savedDrinks || []).map((d) => d.toString())
    );
    const affectedLikeDrinkIds = new Set(
      (user.likedDrinks || []).map((d) => d.toString())
    );

    //----------------------------- DELETE COMMENTS THAT USER HAS MADE --------------------------------
    // 5) Delete each authored comment recursively
    for (const c of authoredComments) {
      const removed = await deleteSingleCommentKeepChildren(c._id);
      await Drink.findByIdAndUpdate(c.drink, {
        $inc: { "analytics.counts.comments": -1 },
      });
    }
    //----------------------------- PULL USER FROM NOTIFICATION THEY WERE APART OF --------------------------------
    // 6) Clean notifications tied to those comments
    // Find notifications where this user is an actor
    const actorArrayDocs = await Notification.find(
      { "actors.actor": user._id },
      { _id: 1 }
    ).session(session);

    // Pull them from actors
    await Notification.updateMany(
      { _id: { $in: actorArrayDocs.map((d) => d._id) } },
      { $pull: { actors: { actor: user._id } } }
    ).session(session);

    // Delete only those same notifications if they now have no actors left
    if (actorArrayDocs.length) {
      await Notification.deleteMany({
        _id: { $in: actorArrayDocs.map((d) => d._id) },
        $or: [
          { actors: { $exists: true, $size: 0 } },
          { actors: { $exists: false } }, // in case some docs didn’t have the array field
        ],
      }).session(session);
    }

    const singleActorDocs = await Notification.find(
      { "actor.id": user._id },
      { _id: 1 }
    ).session(session);

    // Unset the single actor
    await Notification.updateMany(
      { _id: { $in: singleActorDocs.map((d) => d._id) }, "actor.id": user._id },
      { $unset: { actor: "" } }
    ).session(session);

    // Delete only those same notifications if they now lack an actor field
    if (singleActorDocs.length) {
      await Notification.deleteMany({
        _id: { $in: singleActorDocs.map((d) => d._id) },
        $or: [{ actor: { $exists: false } }, { actor: null }],
      }).session(session);
    }

    await Notification.updateMany(
      { "recipients.id": user._id },
      { $pull: { recipients: { id: user._id } } }
    ).session(session);

    //----------------------------- ADJUST THE COMMENTS THAT THE USER HAS LIKED --------------------------------
    // 1) Find all comments this user has liked
    const likedCommentDocs = await Comment.find(
      { "analytics.userLikes": user._id },
      { _id: 1 }
    ).session(session);

    if (likedCommentDocs.length) {
      const likedCommentIds = likedCommentDocs.map((d) => d._id);

      // 2) Pull their like from those comments and decrement like count
      //    The filter ensures we only $inc for comments that actually contained this user.
      await Comment.updateMany(
        { _id: { $in: likedCommentIds }, "analytics.userLikes": user._id },
        {
          $pull: { "analytics.userLikes": user._id },
          $inc: { "analytics.counts.likes": -1 },
        }
      ).session(session);

      //----------------------------- PULL FROM ANY NOTIFICATION REGARDING THE COMMENT LIKED --------------------------------
      // 3) Clean notifications where this user is an actor for those comment-like events
      //    (Adjust 'type: "like"' if your schema labels it differently; or remove the type filter if not used.)
      const likeActorDocs = await Notification.find(
        {
          comment: { $in: likedCommentIds },
          "actors.actor": user._id,
          // type: "like", // <- uncomment/adjust if you track a type for comment-like notifications
        },
        { _id: 1 }
      ).session(session);

      if (likeActorDocs.length) {
        const likeActorNotifIds = likeActorDocs.map((d) => d._id);

        // Pull this user out of actors for those notifications
        await Notification.updateMany(
          { _id: { $in: likeActorNotifIds } },
          { $pull: { actors: { actor: user._id } } }
        ).session(session);

        // Delete only those same notifications that are now actorless
        await Notification.deleteMany({
          _id: { $in: likeActorNotifIds },
          $or: [
            { actors: { $exists: true, $size: 0 } },
            { actors: { $exists: false } },
          ],
        }).session(session);
      }
    }

    // 6b) Employee relations cleanup (only matters if this user is an employee)
    if (user.role === "employee") {
      // Remove this user from any manager's directReports
      await User.updateMany(
        { "employeeDetails.directReports": { $elemMatch: { $eq: user._id } } },
        { $pull: { "employeeDetails.directReports": user._id } }
      ).session(session);

      // Anyone who reported to this user -> set their reportTo to null
      await User.updateMany(
        { "employeeDetails.reportTo": { $eq: user._id } },
        { $set: { "employeeDetails.reportTo": null } }
      ).session(session);
    }

    // 7) Remove the user
    await User.findByIdAndDelete(userId).session(session);

    // 8) Recompute per-drink comment counts (safety)
    for (const drinkId of affectedDrinkIdsFromComments) {
      const freshCount = await Comment.countDocuments({
        drink: drinkId,
      }).session(session);
      await Drink.updateOne(
        { _id: drinkId },
        { $set: { "analytics.counts.comments": freshCount } },
        { session }
      );
    }

    // 9) Bookmarks: pull user & recompute
    for (const drinkId of affectedBookmarkDrinkIds) {
      await Drink.updateOne(
        { _id: drinkId },
        [
          {
            $set: {
              // 1) Build filtered array without this user (handles missing arrays safely)
              "analytics.userBookmarks": {
                $let: {
                  vars: {
                    filtered: {
                      $filter: {
                        input: { $ifNull: ["$analytics.userBookmarks", []] },
                        as: "b",
                        cond: {
                          $ne: [
                            "$$b.user",
                            new mongoose.Types.ObjectId(user._id),
                          ],
                        },
                      },
                    },
                  },
                  in: "$$filtered",
                },
              },
              // 2) Recompute the counter from that filtered array
              "analytics.counts.bookmarks": {
                $let: {
                  vars: {
                    filtered: {
                      $filter: {
                        input: { $ifNull: ["$analytics.userBookmarks", []] },
                        as: "b",
                        cond: {
                          $ne: [
                            "$$b.user",
                            new mongoose.Types.ObjectId(user._id),
                          ],
                        },
                      },
                    },
                  },
                  in: { $size: "$$filtered" },
                },
              },
            },
          },
        ],
        { session }
      );
    }

    // 10) Likes: pull user & recompute
    for (const drinkId of affectedLikeDrinkIds) {
      await Drink.updateOne(
        { _id: drinkId },
        [
          {
            $set: {
              // 1) Build filtered array without this user (handles missing arrays safely)
              "analytics.userLikes": {
                $let: {
                  vars: {
                    filtered: {
                      $filter: {
                        input: { $ifNull: ["$analytics.userLikes", []] },
                        as: "b",
                        cond: {
                          $ne: [
                            "$$b.user",
                            new mongoose.Types.ObjectId(user._id),
                          ],
                        },
                      },
                    },
                  },
                  in: "$$filtered",
                },
              },
              // 2) Recompute the counter from that filtered array
              "analytics.counts.likes": {
                $let: {
                  vars: {
                    filtered: {
                      $filter: {
                        input: { $ifNull: ["$analytics.userLikes", []] },
                        as: "b",
                        cond: {
                          $ne: [
                            "$$b.user",
                            new mongoose.Types.ObjectId(user._id),
                          ],
                        },
                      },
                    },
                  },
                  in: { $size: "$$filtered" },
                },
              },
            },
          },
        ],
        { session }
      );
    }

    if (ownSession) {
      await session.commitTransaction();
      session.endSession();
    }

    return {
      meta: {
        deletedComments: authoredCommentIds.length,
        updatedCommentDrinks: affectedDrinkIdsFromComments.size,
        updatedBookmarkDrinks: affectedBookmarkDrinkIds.size,
        updatedLikeDrinks: affectedLikeDrinkIds.size,
      },
    };
  } catch (err) {
    if (ownSession) {
      await session.abortTransaction();
      session.endSession();
    }
    throw err;
  }
}
