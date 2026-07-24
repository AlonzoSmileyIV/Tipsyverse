import mongoose from "mongoose";
import {
  ReviewModel as Review,
  EventModel as Event,
  UserModel as User,
} from "../../models/index.js";

const REVIEW_EDIT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const isStaff = (user) => ["admin", "employee"].includes(user?.role);

const getReviewWindowError = (event, user) => {
  if (isStaff(user)) return "";
  const end = event?.endAt ? new Date(event.endAt).getTime() : null;
  const now = Date.now();
  if (!end || now < end) return "Reviews open after the event ends.";
  if (now > end + REVIEW_EDIT_WINDOW_MS) {
    return "The review window has closed for this event.";
  }
  return "";
};

const reviewCtrl = {
  /**
   * POST /reviews
   * Body: { event, bartenderUserIds: [..], rating, comment }
   * Creates and/or edits multiple reviews at once with the SAME rating+comment.
   */
  upsertReviews: async (req, res) => {
    try {
      const reviewerId = req.user?.id || req.user?._id;
      const { event, bartenderUserIds = [], rating, comment = "" } = req.body;

      if (!reviewerId) {
        return res
          .status(401)
          .json({ success: false, message: "Unauthenticated" });
      }

      if (!event || !mongoose.Types.ObjectId.isValid(event)) {
        return res
          .status(400)
          .json({ success: false, message: "Valid event ID required" });
      }

      if (!Array.isArray(bartenderUserIds) || bartenderUserIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: "bartenderUserIds array required",
        });
      }

      if (rating == null || Number(rating) < 1 || Number(rating) > 5) {
        return res
          .status(400)
          .json({ success: false, message: "Rating must be 1–5" });
      }

      // Make IDs unique & valid
      const uniqueBartenderIds = [
        ...new Set(
          bartenderUserIds
            .map((id) => String(id))
            .filter((id) => mongoose.Types.ObjectId.isValid(id))
        ),
      ];

      if (!uniqueBartenderIds.length) {
        return res.status(400).json({
          success: false,
          message: "No valid bartender IDs provided",
        });
      }

      // Optional: check event exists
      const evt = await Event.findById(event).select("_id type startAt endAt").lean();
      if (!evt) {
        return res
          .status(404)
          .json({ success: false, message: "Event not found" });
      }
      const windowError = getReviewWindowError(evt, req.user);
      if (windowError) {
        return res.status(400).json({ success: false, message: windowError });
      }

      // Optional: filter out invalid bartender users
      const bartenders = await User.find({ _id: { $in: uniqueBartenderIds } })
        .select("_id fullName")
        .lean();

      const validIds = bartenders.map((b) => String(b._id));
      if (!validIds.length) {
        return res.status(400).json({
          success: false,
          message: "No valid bartenders found",
        });
      }

      const now = new Date();
      const cleanComment = (comment || "").trim();
      if (cleanComment.length > 500) {
        return res.status(400).json({
          success: false,
          message: "Review comments must be 500 characters or fewer.",
        });
      }

      // ✅ UPSERT: if exists (event + bartenderUser + reviewerUser) -> update, else insert
      const ops = validIds.map((bid) => ({
        updateOne: {
          filter: {
            event,
            bartenderUser: bid,
            reviewerUser: reviewerId,
          },
          update: {
            $set: {
              rating: Number(rating),
              comment: cleanComment,
              updatedAt: now,
            },
            $setOnInsert: {
              event,
              bartenderUser: bid,
              reviewerUser: reviewerId,
              createdAt: now,
            },
          },
          upsert: true,
        },
      }));

      const result = await Review.bulkWrite(ops, { ordered: false });

      // Return the saved reviews (created or updated)
      const saved = await Review.find({
        event,
        reviewerUser: reviewerId,
        bartenderUser: { $in: validIds },
      })
        .select(
          "event bartenderUser reviewerUser rating comment createdAt updatedAt"
        )
        .lean();

      // ✅ Log activity (target.id required) — use event as the target id for summary logs
      await req.logActivity?.({
        action: "upsert",
        target: { model: "Review", id: event }, // ✅ required and valid
        actor: {
          type: "User",
          id: reviewerId,
          label: {
            fullName: req.user?.fullName,
            email: req.user?.email,
            role: req.user?.role,
          },
        },
        summary: `Created/updated ${validIds.length} bartender review(s)`,
        meta: {
          event,
          bartenderUserIds: validIds,
          rating: Number(rating),
          bulk: {
            matched: result.matchedCount,
            modified: result.modifiedCount,
            upserted: result.upsertedCount,
          },
        },
      });

      return res.status(200).json({
        success: true,
        data: saved,
        meta: {
          matched: result.matchedCount,
          modified: result.modifiedCount,
          upserted: result.upsertedCount,
        },
      });
    } catch (err) {
      console.error("createReviews error:", err);
      return res.status(400).json({
        success: false,
        message: err.message || "Failed to create/update reviews",
      });
    }
  },

  /**
   * PATCH /reviews/bulk
   * Body: { reviewIds: [], rating?, comment? }
   * Applies the SAME edits to all selected reviews.
   */
  updateReviewsBulk: async (req, res) => {
    try {
      const reviewerId = req.user?.id || req.user?._id;
      const { reviewIds = [], rating, comment } = req.body;

      if (!reviewerId) {
        return res
          .status(401)
          .json({ success: false, message: "Unauthenticated" });
      }

      if (!Array.isArray(reviewIds) || reviewIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: "reviewIds array required",
        });
      }

      const validReviewIds = reviewIds.filter((id) =>
        mongoose.Types.ObjectId.isValid(id)
      );
      if (!validReviewIds.length) {
        return res.status(400).json({
          success: false,
          message: "No valid review IDs provided",
        });
      }

      const update = {};
      if (rating != null) {
        if (rating < 1 || rating > 5) {
          return res
            .status(400)
            .json({ success: false, message: "Rating must be 1–5" });
        }
        update.rating = rating;
      }
      if (typeof comment === "string") {
        update.comment = comment;
      }

      if (!Object.keys(update).length) {
        return res.status(400).json({
          success: false,
          message: "Nothing to update",
        });
      }

      // Only allow editing reviews created by this user
      const result = await Review.updateMany(
        {
          _id: { $in: validReviewIds },
          reviewerUser: reviewerId,
        },
        { $set: update }
      );

      const modifiedCount = result.modifiedCount ?? result.nModified ?? 0;

      await req.logActivity?.({
        action: "update",
        target: { model: "Review", id: null },
        actor: {
          type: "User",
          id: reviewerId,
          label: {
            fullName: req.user?.fullName,
            email: req.user?.email,
            role: req.user?.role,
          },
        },
        summary: `Updated ${modifiedCount} bartender review(s)`,
        meta: {
          reviewIds: validReviewIds,
          update,
        },
      });

      return res.json({
        success: true,
        data: { modifiedCount },
      });
    } catch (err) {
      console.error("updateReviewsBulk error:", err);
      return res.status(400).json({
        success: false,
        message: err.message || "Failed to update reviews",
      });
    }
  },

  /**
   * DELETE /reviews/bulk
   * Body: { reviewIds: [] }
   * Deletes multiple reviews at once.
   */
  deleteReviewsBulk: async (req, res) => {
    try {
      const reviewerId = req.user?.id || req.user?._id;
      const { reviewIds = [] } = req.body;

      if (!reviewerId) {
        return res
          .status(401)
          .json({ success: false, message: "Unauthenticated" });
      }

      if (!Array.isArray(reviewIds) || reviewIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: "reviewIds array required",
        });
      }

      const validReviewIds = reviewIds.filter((id) =>
        mongoose.Types.ObjectId.isValid(id)
      );
      if (!validReviewIds.length) {
        return res.status(400).json({
          success: false,
          message: "No valid review IDs provided",
        });
      }

      // Only delete reviews created by this user
      const result = await Review.deleteMany({
        _id: { $in: validReviewIds },
        reviewerUser: reviewerId,
      });

      const deletedCount = result.deletedCount ?? 0;

      await req.logActivity?.({
        action: "delete",
        target: { model: "Review", id: null },
        actor: {
          type: "User",
          id: reviewerId,
          label: {
            fullName: req.user?.fullName,
            email: req.user?.email,
            role: req.user?.role,
          },
        },
        summary: `Deleted ${deletedCount} bartender review(s)`,
        meta: {
          reviewIds: validReviewIds,
        },
      });

      return res.json({
        success: true,
        data: { deletedCount },
      });
    } catch (err) {
      console.error("deleteReviewsBulk error:", err);
      return res.status(400).json({
        success: false,
        message: err.message || "Failed to delete reviews",
      });
    }
  },

  /**
   * GET /reviews/event/:eventId
   * (For client view or admin view of all reviews for an event.)
   */
  viewReviewsByEvent: async (req, res) => {
    try {
      const { eventId } = req.params;
      if (!mongoose.Types.ObjectId.isValid(eventId)) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid event ID" });
      }

      const reviews = await Review.find({ event: eventId })
        .populate({
          path: "bartenderUser",
          select: "fullName email profile.photo avatarUrl photoUrl",
        })
        .populate({
          path: "reviewerUser",
          select: "fullName email",
        })
        .sort({ createdAt: -1 })
        .lean();

      return res.json({
        success: true,
        data: reviews,
      });
    } catch (err) {
      console.error("viewReviewsByEvent error:", err);
      return res.status(500).json({
        success: false,
        message: "Failed to retrieve reviews",
      });
    }
  },

  /**
   * GET /reviews/me
   * Reviews I have submitted (across events/bartenders).
   */
  viewMyReviews: async (req, res) => {
  try {
    const bartenderUserId = req.user?.id || req.user?._id;

    if (!bartenderUserId) {
      return res
        .status(401)
        .json({ success: false, message: "Unauthenticated" });
    }

    const reviews = await Review.find({ bartenderUser: bartenderUserId })
      .populate({
        path: "event",
        select: "shortCode type startAt endAt location options pricing counts status",
      })
      .populate({
        path: "reviewerUser",
        select: "fullName email profile.photo avatarUrl photoUrl",
      })
      .sort({ createdAt: -1 })
      .lean();

    // 🔒 Enforce anonymity at response level
    const sanitized = (reviews || []).map((r) => {
      if (r.isAnonymousToBartender) {
        return {
          ...r,
          reviewerUser: null, // hide identity
        };
      }
      return r;
    });

    return res.json({
      success: true,
      data: sanitized,
    });
  } catch (err) {
    console.error("viewMyReviews error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve your reviews",
    });
  }
},

};

export default reviewCtrl;
