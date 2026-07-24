// POST /api/comments
import {
  CommentModel as Comment,
  ActivityLogModel as ActivityLog,
  DrinkModel as Drink,
  UserModel as User,
} from "../../models/index.js";
import { sendNotification } from "../../utils/index.js";
import { deleteSingleCommentKeepChildren } from "../../utils/index.js";
// Recursive reply populator

const MAX_COMMENT_LENGTH = 500;

const validateCommentContent = (content) => {
  const normalized = String(content || "").trim();
  if (!normalized) {
    return { valid: false, message: "Comment cannot be empty." };
  }
  if (normalized.length > MAX_COMMENT_LENGTH) {
    return {
      valid: false,
      message: `Comment must be ${MAX_COMMENT_LENGTH} characters or fewer.`,
    };
  }
  return { valid: true, content: normalized };
};

const populateReplies = async (replies) => {
  return Promise.all(
    replies.map(async (replyRef) => {
      const fullReply = await Comment.findById(replyRef._id)
        .populate("author", "username fullName profile.photo")
        .populate("userMentioned", "username fullName")
        .populate("analytics.userLikes", "username fullName profile.photo") // ✅ This is critical

        .populate({
          path: "analytics.userReplies",
          populate: [
            { path: "author", select: "username fullName profile.photo" },
            {
              path: "userMentioned", // ✅ again, not analytics.usersMentioned
              select: "username fullName",
            },
          ],
        })
        .lean();

      // ✅ Add this mapping right after population
      fullReply.analytics.usersMentioned = (fullReply.userMentioned || []).map(
        (user) => ({
          userId: user._id,
          username: user.username,
        })
      );

      // 👇 Normalize for frontend (just array of userId strings)
      fullReply.analytics.userLikes = (fullReply.analytics.userLikes || []).map(
        (user) => user._id.toString()
      );

      // Recursively populate deeper nested replies
      if (fullReply?.analytics?.userReplies?.length > 0) {
        fullReply.analytics.userReplies = await populateReplies(
          fullReply.analytics.userReplies
        );
      }

      return fullReply;
    })
  );
};

const commentCtrl = {
  addComment: async (req, res) => {
    try {
      const { drinkId, content, mentionUsers = [] } = req.body;
      const authorId = req.user.id;

      if (!drinkId || !content || !authorId) {
        return res.status(400).json({
          success: false,
          message: "Missing drinkId, content, or authorId.",
        });
      }

      const contentValidation = validateCommentContent(content);
      if (!contentValidation.valid) {
        return res
          .status(400)
          .json({ success: false, message: contentValidation.message });
      }

      const existingDrink = await Drink.findById(drinkId);
      if (!existingDrink) {
        return res
          .status(404)
          .json({ success: false, message: "Drink not found." });
      }

      // First, resolve all mention users from DB
      const mentionedUserObjects = await Promise.all(
        mentionUsers.map(async (id) => {
          const user = await User.findById(id).select("username");
          return {
            userId: user._id,
            username: user.username,
          };
        })
      );

      const comment = await Comment.create({
        drink: drinkId,
        content: contentValidation.content,
        author: authorId,
        analytics: {
          counts: { likes: 0, replies: 0 },
          usersMentioned: mentionedUserObjects,
        },
        userMentioned: mentionUsers,
      });

      // Update drink analytics
      await Drink.findByIdAndUpdate(drinkId, {
        $push: {
          "analytics.userComments": {
            comment: comment._id,
            dateCommented: new Date(),
          },
        },
        $inc: {
          "analytics.counts.comments": 1,
        },
      });

      await sendNotification({
        type: "mention",
        entity: existingDrink,
        entityId: drinkId,
        entityModel: "Drink",
        actor: {
          id: authorId,
        },
        recipients: mentionUsers.map((id) => ({ id })), // ✅ wrap in object with 'id'
        slug: `drinks`,
        messageBase: "mentioned you in a comment",
        commentId: comment._id,
      });

      await req.logActivity({
        action: "create",
        target: { model: "Comment", id: comment._id },
        actor: {
          type: "User",
          id: req.user.id,
          label: {
            fullName: req.user.fullName,
            email: req.user.email,
            role: req.user.role,
          },
        },
        summary: `Added a comment on drink "${existingDrink.name}"`,
        meta: {
          drinkId,
          content,
          mentions: mentionedUserObjects,
        },
      });

      return res.status(200).json({
        success: true,
        message: "Thank you for your comment.",
        data: comment,
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  editComment: async (req, res) => {
    try {
      const { id } = req.params;
      const { content, mentionUsers = [] } = req.body;
      const userId = req.user.id;
      const contentValidation = validateCommentContent(content);
      if (!contentValidation.valid) {
        return res
          .status(400)
          .json({ success: false, message: contentValidation.message });
      }

      // 1) Load current (previous) state
      const prev = await Comment.findById(id).populate("drink", "_id").lean();

      if (!prev) {
        return res
          .status(400)
          .json({ success: false, message: "This comment doesn't exist." });
      }

      const comment = await Comment.findById(id).populate("drink").lean();

      if (!comment) {
        return res
          .status(400)
          .json({ success: false, message: "This comment doesn't exist." });
      }

      if (comment.author.toString() !== userId) {
        return res.status(403).json({
          success: false,
          message: "You are not authorized to edit this comment.",
        });
      }

      // Build mention objects for analytics
      const mentionedUserObjects = await Promise.all(
        mentionUsers.map(async (id) => {
          const user = await User.findById(id).select("username");
          return {
            userId: user._id,
            username: user.username,
          };
        })
      );

      const previousMentions = comment.userMentioned || [];

      // Identify new mentions
      const newlyMentioned = mentionUsers.filter(
        (id) => !previousMentions.map(String).includes(String(id))
      );

      // ✅ Update the comment
      const updatedComment = await Comment.findByIdAndUpdate(
        id,
        {
          $set: {
            content: contentValidation.content,
            edited: true,
            userMentioned: mentionUsers,
            "analytics.usersMentioned": mentionedUserObjects,
          },
        },
        { new: true }
      );

      // ----- Activity Log payload -----
      const prevMentions = (prev.userMentioned || []).map(String);
      const nextMentions = (updatedComment.userMentioned || []).map(String);

      const contentChanged =
        (prev.content || "") !== (updatedComment.content || "");
      const mentionsChanged =
        prevMentions.length !== nextMentions.length ||
        prevMentions.some((v, i) => v !== nextMentions[i]); // shallow compare order; good enough if you keep order stable

      // Minimal snapshots
      const prevSnapshot = {
        content: prev.content,
        userMentioned: prevMentions, // keep small (ids only)
      };
      const nextSnapshot = {
        content: updatedComment.content,
        userMentioned: nextMentions, // keep small (ids only)
      };

      // Changes array
      const changes = [];
      if (contentChanged) {
        changes.push({
          path: "content",
          from: prev.content,
          to: updatedComment.content,
        });
      }
      if (mentionsChanged) {
        // compute added/removed to keep it readable
        const prevSet = new Set(prevMentions);
        const nextSet = new Set(nextMentions);
        const added = [...nextSet].filter((x) => !prevSet.has(x));
        const removed = [...prevSet].filter((x) => !nextSet.has(x));

        changes.push({
          path: "userMentioned",
          from: removed, // removed ids
          to: added, // added ids
        });
      }

      // Only log if something changed (should be true for edit)
      if (contentChanged || mentionsChanged) {
        await req.logActivity({
          action: "update",
          target: { model: "Comment", id },
          actor: {
            type: "User",
            id: req.user.id,
            label: {
              fullName: req.user.fullName,
              email: req.user.email,
              role: req.user.role,
            },
          },
          summary: "Edited a comment",
          changes, // <- your ChangeSchema[]
          prevSnapshot, // <- minimal previous state
          nextSnapshot, // <- minimal new state
          meta: {
            oldContent: comment.content,
            newContent: contentValidation.content,
            addedMentions: newlyMentioned,
          },
        });
      }

      // ✅ Notify new mentions
      if (newlyMentioned.length > 0) {
        await sendNotification({
          type: "mention",
          entity: comment.drink,
          entityId: comment.drink._id,
          entityModel: "Drink",
          actor: {
            id: userId,
          },
          recipients: newlyMentioned.map((id) => ({ id })),
          slug: `drinks`,
          messageBase: "mentioned you in an edited comment",
          commentId: comment._id,
        });
      }

      return res.status(200).json({
        success: true,
        message: "Your comment has been edited.",
        data: updatedComment,
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  toggleLikeComment: async (req, res) => {
    try {
      const { commentId } = req.params;
      const userId = req.user.id;

      const comment = await Comment.findById(commentId);
      if (!comment) {
        return res
          .status(404)
          .json({ success: false, message: "Comment not found." });
      }

      // Ensure nested paths exist
      comment.analytics = comment.analytics || {};
      comment.analytics.userLikes = comment.analytics.userLikes || [];
      comment.analytics.counts = comment.analytics.counts || {};
      if (typeof comment.analytics.counts.likes !== "number") {
        comment.analytics.counts.likes = 0;
      }

      const alreadyLiked = comment.analytics.userLikes.some(
        (id) => id.toString() === userId.toString()
      );

      if (alreadyLiked) {
        // UNLIKE
        comment.analytics.userLikes = comment.analytics.userLikes.filter(
          (id) => id.toString() !== userId.toString()
        );
        comment.analytics.counts.likes = Math.max(
          comment.analytics.counts.likes - 1,
          0
        );
      } else {
        // LIKE
        comment.analytics.userLikes.push(userId); // string or ObjectId is fine since we compare via toString
        comment.analytics.counts.likes += 1;

        // Notify author (if not self)
        // author might be ObjectId or populated doc; normalize it safely
        const authorId = (
          comment.author &&
          (comment.author._id || comment.author)
        )?.toString?.();
        if (authorId && authorId !== userId.toString()) {
          await sendNotification({
            type: "like",
            entityId: comment.drink, // pass the ObjectId itself (not .id)
            entityModel: "Drink",
            actor: { id: userId },
            recipients: [{ id: authorId }], // normalized string/ObjectId; sendNotification will coerce
            slug: "drinks",
            messageBase: "liked your comment",
            commentId: comment._id, // enables grouping per comment + snippet
          });
        }
      }

      await comment.save();

      await req.logActivity({
        action: "update",
        target: { model: "Comment", id: commentId },
        actor: {
          type: "User",
          id: req.user.id,
          label: {
            fullName: req.user.fullName,
            email: req.user.email,
            role: req.user.role,
          },
        },
        summary: `${alreadyLiked ? "Removed like from" : "Liked"} a comment`,
        meta: { drinkId: comment.drink },
      });

      return res.status(200).json({
        success: true,
        message: `You ${alreadyLiked ? "unliked" : "liked"} the comment.`,
        data: comment,
      });
    } catch (err) {
      console.error("❌ toggleLikeComment error:", err);
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  replyToComment: async (req, res) => {
    try {
      const { parentId } = req.params;
      const { content, mentionUsers = [] } = req.body;
      const userId = req.user.id;
      const contentValidation = validateCommentContent(content);
      if (!contentValidation.valid) {
        return res
          .status(400)
          .json({ success: false, message: contentValidation.message });
      }

      const parentComment = await Comment.findById(parentId).populate("author");

      if (!parentComment) {
        return res
          .status(404)
          .json({ success: false, message: "Parent comment not found." });
      }

      const mentionUserIds = mentionUsers.map((id) => id.toString());
      const parentAuthorId = parentComment.author._id.toString();
      const isParentAuthorMentioned = mentionUserIds.includes(parentAuthorId);

      // Fetch mentioned users as embedded objects
      const mentionedUserObjects = await Promise.all(
        mentionUsers.map(async (id) => {
          const user = await User.findById(id).select("username");
          return {
            userId: user._id,
            username: user.username,
          };
        })
      );

      //  Create reply with embedded usersMentioned objects
      const reply = await Comment.create({
        drink: parentComment.drink,
        content: contentValidation.content,
        author: userId,
        parentComment: parentComment._id,
        parent: parentComment._id,
        analytics: {
          counts: { likes: 0, replies: 0 },
          usersMentioned: mentionedUserObjects,
        },
        userMentioned: mentionUsers,
      });

      await Comment.updateOne(
        { _id: parentComment._id },
        {
          $push: { "analytics.userReplies": reply._id },
          $inc: { "analytics.counts.replies": 1 }, // direct replies only
        }
      );

      // 🧾 Activity log (non-blocking)
      req
        .logActivity({
          action: "create",
          target: { model: "Comment", id: reply._id },
          actor: {
            type: "User",
            id: req.user.id,
            label: {
              fullName: req.user.fullName,
              email: req.user.email,
              role: req.user.role,
            },
          },
          summary: "Replied to a comment",
          meta: {
            parentId: parentComment._id,
            drinkId: String(parentComment.drink),
            mentions: mentionedUserObjects,
          },
        })
        .catch((err) =>
          console.warn("[activity] replyToComment failed:", err?.message)
        );

      const filteredMentionUsers = mentionUsers.filter(
        (id) => id.toString() !== parentAuthorId
      );

      // 🔔 Notify mentioned users
      if (filteredMentionUsers.length > 0) {
        await sendNotification({
          type: "mention",
          entity: parentComment.drink,
          entityId: parentComment.drink,
          entityModel: "Drink",
          actor: {
            actorType: "User",
            id: userId,
          },
          recipients: mentionUsers.map((id) => ({ id })),
          slug: `drinks`,
          messageBase: "mentioned you in a reply",
          commentId: reply._id,
        });
      }

      // 🔔 Notify parent comment's author (if it's not you and not already mentioned)
      if (parentAuthorId !== userId.toString()) {
        await sendNotification({
          type: "reply",
          entity: parentComment.drink,
          entityId: parentComment.drink,
          entityModel: "Drink",
          actor: {
            id: userId,
          },
          recipients: [{ id: parentComment.author._id }],
          slug: `drinks`,
          messageBase: "replied to your comment and said",
          commentId: reply._id,
        });
      }

      return res.status(200).json({
        success: true,
        message: "Reply posted successfully.",
        data: reply,
      });
    } catch (err) {
      console.error("Reply Error:", err);
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  getCommentReport: async (req, res) => {
    try {
      const { commentId } = req.params;
      const userId = req.user.id;

      const comment = await Comment.findById(commentId)
        .select("analytics.userReports")
        .lean();

      // console.log("you want to report: ", comment);

      if (!comment) {
        return res.status(404).json({
          success: false,
          message: "Comment not found",
        });
      }

      const reports = comment?.analytics?.userReports || [];

      // console.log("you have the following reports: ", reports);
      const existingReport = reports.find(
        (r) => r.user.toString() === userId.toString()
      );

      if (existingReport) {
        return res.status(200).json({
          success: true,
          report: {
            reason: existingReport.reason,
            dateReported: existingReport.timestamp,
          },
        });
      }

      return res.status(200).json({ success: true, report: null });
    } catch (err) {
      console.error("Error fetching report info", err);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch report info",
      });
    }
  },

  getCommentsByDrink: async (req, res) => {
    try {
      const { drinkId } = req.params;

      const drink = await Drink.findById(drinkId)
        .populate({
          path: "analytics.userComments.comment",
          populate: [
            {
              path: "author",
              select: "username fullName profile.photo",
            },
            {
              path: "userMentioned",
              select: "username fullName profile.photo",
            },
            {
              path: "analytics.userLikes", //  add this for top-level comments
              select: "username fullName profile.photo",
            },
            {
              path: "analytics.userReplies",
              populate: [
                {
                  path: "author",
                  select: "username fullName profile.photo",
                },
                {
                  path: "userMentioned", // still valid
                  select: "username fullName profile.photo",
                },
                {
                  path: "analytics.userLikes",
                  select: "username fullName profile.photo",
                },
              ],
            },
          ],
        })
        .lean();

      if (!drink) {
        return res
          .status(404)
          .json({ success: false, message: "Drink not found." });
      }

      const comments = await Promise.all(
        drink.analytics.userComments
          .filter((entry) => entry.comment !== null)
          .map(async (entry) => {
            const comment = entry.comment;

            if (comment?.analytics?.userReplies?.length > 0) {
              comment.analytics.userReplies = await populateReplies(
                comment.analytics.userReplies
              );
            }

            comment.analytics.usersMentioned = (
              comment.userMentioned || []
            ).map((user) => ({
              userId: user._id,
              username: user.username,
            }));

            // ✅ Normalize userLikes to just user IDs (string)
            comment.analytics.userLikes = (
              comment.analytics.userLikes || []
            ).map((user) => user._id.toString());

            return {
              comment,
              dateCommented: entry.dateCommented,
            };
          })
      );

      return res.status(200).json({ success: true, data: comments });
    } catch (err) {
      console.error("Get Comments Error:", err);
      return res
        .status(500)
        .json({ success: false, message: "Error fetching comments." });
    }
  },

  getReportedComments: async (req, res) => {
    try {
      const reportedComments = await Comment.find({
        "analytics.counts.reports": { $gt: 0 },
      })
        .sort({ "analytics.counts.reports": -1 })
        .populate({
          path: "author",
          select: "fullName profile.photo employeeDetails role",
          populate: [
            {
              path: "employeeDetails",
              select: "active position directReports",
              populate: {
                path: "position",
                select: "name hierarchy",
                populate: {
                  path: "hierarchy",
                  select: "name",
                },
              },
            },
          ],
        })
        .populate("drink", "slug")
        .populate({
          path: "analytics.userReports.user",
          select: "fullName profile.photo employeeDetails role",
          populate: [
            {
              path: "employeeDetails",
              select: "active position directReports",
              populate: {
                path: "position",
                select: "name hierarchy",
                populate: {
                  path: "hierarchy",
                  select: "name",
                },
              },
            },
          ],
        });

      res.status(200).json({ success: true, data: reportedComments });
    } catch (error) {
      console.error("❌ Error fetching reported comments:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch reported comments.",
      });
    }
  },

  addReportToComment: async (req, res) => {
    try {
      const { commentId } = req.params;
      const { reason } = req.body;
      const userId = req.user.id;

      if (!reason)
        return res
          .status(400)
          .json({ success: false, message: "Reason required." });

      const comment = await Comment.findById(commentId);
      if (!comment)
        return res
          .status(404)
          .json({ success: false, message: "Comment not found." });

      const alreadyReported = comment.analytics.userReports.some(
        (r) => r.user._id.toString() === userId
      );
      if (alreadyReported) {
        return res
          .status(400)
          .json({ success: false, message: "Already reported." });
      }

      comment.analytics.userReports.push({ user: userId, reason });
      comment.analytics.counts.reports = comment.analytics.userReports.length;
      await comment.save();

      // 🧾 Activity log (non-blocking)
      req
        .logActivity({
          action: "report",
          target: { model: "Comment", id: commentId },
          actor: {
            type: "User",
            id: req.user.id,
            label: {
              fullName: req.user.fullName,
              email: req.user.email,
              role: req.user.role,
            },
          },
          summary: "Reported a comment",
          meta: { reason },
        })
        .catch((err) =>
          console.warn("[activity] addReportToComment failed:", err?.message)
        );

      return res.status(200).json({ success: true, message: "Report added." });
    } catch (error) {
      console.error("❌ Error reporting comment:", error);
      res
        .status(500)
        .json({ success: false, message: "Failed to report comment." });
    }
  },

  handleReportAction: async (req, res) => {
    try {
      const { commentId } = req.params;
      const { action, reason } = req.body; // "dismiss" or "remove"
      const actionUser = req.user.id;

      const comment = await Comment.findById(commentId).populate(
        "author",
        "_id"
      );

      if (!comment)
        return res
          .status(404)
          .json({ success: false, message: "Comment not found." });

      if (action === "dismiss") {
        comment.analytics.userReports = [];
        comment.analytics.counts.reports = 0;
        await comment.save();

        // 🧾 Activity log
        req
          .logActivity({
            action: "update",
            target: { model: "Comment", id: commentId },
            actor: {
              type: "User",
              id: req.user.id,
              label: {
                fullName: req.user.fullName,
                email: req.user.email,
                role: req.user.role,
              },
            },
            summary: "Dismissed reports on a comment",
            meta: { decision: "dismiss" },
          })
          .catch((err) =>
            console.warn(
              "[activity] handleReportAction(dismiss) failed:",
              err?.message
            )
          );

        return res.status(200).json({
          success: true,
          message: "Reports for this comment have dismissed.",
        });
      }

      if (action === "remove") {
        if (!reason) {
          return res
            .status(400)
            .json({ success: false, message: "Removal reason is required." });
        }
        const userId = comment.author._id;

        // Save report to user
        await User.findByIdAndUpdate(userId, {
          $push: {
            commentReports: {
              commentId,
              content: comment.content,
              removedBy: actionUser,
              reason: reason,
              deleted: true,
              deletedAt: new Date(),
            },
          },
        });

        const raw = (comment.content || "").trim().replace(/\s+/g, " ");
        const snippet = raw.length > 120 ? `${raw.slice(0, 119)}…` : raw;

        const removed = await deleteSingleCommentKeepChildren(comment._id);

        // decrement the drink once by the full subtree size
        await Drink.findByIdAndUpdate(comment.drink, {
          $inc: { "analytics.counts.comments": -1 },
        });

        // 🧾 Activity log
        req
          .logActivity({
            action: "delete",
            target: { model: "Comment", id: commentId },
            actor: {
              type: "User",
              id: req.user.id,
              label: {
                fullName: req.user.fullName,
                email: req.user.email,
                role: req.user.role,
              },
            },
            summary: "Removed a reported comment",
            meta: {
              decision: "remove",
              reason,
              authorId: userId,
              drinkId: String(comment.drink),
            },
          })
          .catch((err) =>
            console.warn(
              "[activity] handleReportAction(remove) failed:",
              err?.message
            )
          );

        // 🔔 Send notification to the comment's author
        await sendNotification({
          type: "moderation",
          entity: comment.drink,
          entityId: comment.drink,
          entityModel: "Drink",
          actor: { id: null }, // System / Admin — you can replace with moderator ID if you want
          recipients: [{ id: userId }],
          slug: `drinks`,
          messageBase: `Due to violating community guidelines, ${reason}, the following comment was removed`,
          commentId: comment._id,
          subjectText: snippet,
        });

        return res.status(200).json({
          success: true,
          message: "Comment deleted and user notified.",
        });
      }

      res.status(400).json({ success: false, message: "Invalid action." });
    } catch (error) {
      console.error("❌ Failed to handle report action:", error);
      res.status(500).json({ success: false, message: "Server error." });
    }
  },

  deleteComment: async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const comment = await Comment.findById(id);
      if (!comment) {
        return res
          .status(404)
          .json({ success: false, message: "Comment not found." });
      }

      if (comment.author.toString() !== userId.toString()) {
        return res.status(403).json({
          success: false,
          message: "You are not authorized to delete this comment.",
        });
      }

      const removed = await deleteSingleCommentKeepChildren(comment._id);

      // decrement the drink once by the full subtree size
      await Drink.findByIdAndUpdate(comment.drink, {
        $inc: { "analytics.counts.comments": -1 },
      });

      // 🧾 Activity log (non-blocking)
      req
        .logActivity({
          action: "delete",
          target: { model: "Comment", id },
          actor: {
            type: "User",
            id: req.user.id,
            label: {
              fullName: req.user.fullName,
              email: req.user.email,
              role: req.user.role,
            },
          },
          summary: "Deleted a comment (and its replies)",
          meta: { drinkId: String(comment.drink) },
        })
        .catch((err) =>
          console.warn("[activity] deleteComment failed:", err?.message)
        );

      return res
        .status(200)
        .json({ success: true, message: "Comment and all replies deleted." });
    } catch (err) {
      console.error("Delete Error:", err);
      return res.status(500).json({ success: false, message: err.message });
    }
  },
};

export default commentCtrl;
