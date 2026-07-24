import {
  CommentModel as Comment,
  DrinkModel as Drink,
  NotificationModel as Notification,
} from "../../models/index.js";

/**
 * Delete a single comment and keep its children by re-parenting them to the
 * deleted comment's parent (or root if no parent).
 *
 * Returns { removed: 1, reparented: N }
 */
export const deleteSingleCommentKeepChildren = async (commentId) => {
  // Load minimal fields we need
  const node = await Comment.findById(commentId)
    .select("_id parent drink analytics.userReplies")
    .lean();

  if (!node) return { removed: 0, reparented: 0 };

  const parentId = node.parent || null;
  const drinkId = node.drink || null;

  // normalize children -> array of ObjectId strings
  const childIds = (node.analytics?.userReplies || [])
    .map((r) => r?._id?.toString?.() || r?.toString?.())
    .filter(Boolean);

  // 1) If there is a parent, detach this node from parent's replies
  if (parentId) {
    await Comment.updateOne(
      { _id: parentId },
      { $pull: { "analytics.userReplies": node._id } }
    );
  }

  // 2) Re-parent children to the same parent (or root if none)
  if (childIds.length > 0) {
    // update each child's parent pointer
    await Comment.updateMany(
      { _id: { $in: childIds } },
      { $set: { parent: parentId || null } }
    );

    if (parentId) {
      // add children as direct replies to the parent (dedup)
      await Comment.updateOne(
        { _id: parentId },
        { $addToSet: { "analytics.userReplies": { $each: childIds } } }
      );

      // Direct replies count should reflect *direct children only*:
      // We'll recompute properly elsewhere; or if you want to keep it cheap:
      await Comment.updateOne(
        { _id: parentId },
        { $inc: { "analytics.counts.replies": -1 + childIds.length } }
      );
    } else if (drinkId) {
      // Deleted node was TOP-LEVEL → promote children to TOP-LEVEL (with date)
      const childrenDocs = await Comment.find(
        { _id: { $in: childIds } },
        { _id: 1, createdAt: 1 }
      ).lean();

      const topLevelRefs = childrenDocs.map((c) => ({
        comment: c._id,
        dateCommented: c.createdAt || new Date(),
      }));

      // 🚫 First remove any stale variants by id (handles shape differences)
      await Drink.updateOne(
        { _id: drinkId },
        { $pull: { "analytics.userComments": { comment: { $in: childIds } } } }
      );

      await Drink.updateOne(
        { _id: drinkId },
        { $push: { "analytics.userComments": { $each: topLevelRefs } } }
      );
    }
  } else if (parentId) {
    // Deleted a leaf reply => just decrement parent's direct reply count by 1
    await Comment.updateOne(
      { _id: parentId },
      { $inc: { "analytics.counts.replies": -1 } }
    );
  }

  // 3) Pull ONLY THIS comment from the drink's top-level list (if present there)
  if (drinkId) {
    await Drink.updateOne(
      { _id: drinkId },
      { $pull: { "analytics.userComments": { comment: node._id } } }
    );
  }

  // 4) Remove notifications tied ONLY to this comment
  await Notification.deleteMany({ comment: node._id });

  // 5) Delete the comment itself
  await Comment.deleteOne({ _id: node._id });

  return { removed: 1, reparented: childIds.length };
};
