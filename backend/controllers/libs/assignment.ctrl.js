import {
  AssignmentModel as Assignment,
  EventModel as Event,
  BidModel as Bid,
  ReviewModel as Review,
} from "../../models/index.js";
import { isUrgentEvent, sendNotification } from "../../utils/index.js";
import mongoose from "mongoose";

const canViewEventAssignments = (event, user) => {
  if (["admin", "employee"].includes(user?.role)) return true;
  if (!event || !user) return false;

  const userId = String(user.id || user._id || "");
  const userEmail = String(user.email || "").trim().toLowerCase();
  const contactEmail = String(event.contact?.email || "").trim().toLowerCase();

  return (
    (event.organizer && String(event.organizer) === userId) ||
    (event.contact?.userId && String(event.contact.userId) === userId) ||
    (userEmail && contactEmail && userEmail === contactEmail)
  );
};

const assignmentCtrl = {
  viewMyAssignments: async (req, res) => {
    try {
      const userId = req.user?.id || req.user?._id;

      if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(401).json({
          success: false,
          message: "Unauthenticated or invalid user ID",
        });
      }

      
      const match = { bartenderUser: userId };

      // 1️⃣ Fetch assignments + event (with contact)
      const rawAssignments = await Assignment.find(match)
        .populate({
          path: "event",
          select:
            "shortCode type startAt endAt location additionalInstructions pricing counts status options visibility contact",
        })
        .sort({ "event.startAt": 1 }) // note: sort by populated field may require aggregation for perfect accuracy
        .lean();

      // 2️⃣ Normalize event.contact to ONLY the organizer contact
      const assignments = rawAssignments.map((a) => {
        if (!a.event) return a;

        const evt = a.event;
        let organizerContact = evt.contact ?? null;

        if (Array.isArray(evt.contact)) {
          // find contact with role === 'organizer'
          organizerContact =
            evt.contact.find((c) => c?.role === "organizer") ||
            evt.contact[0] || // fallback to first if no explicit organizer
            null;
        } else if (evt.contact && evt.contact.role !== "organizer") {
          // if it's a single contact but not organizer, you can choose:
          // either null it out or leave it — here we null it
          organizerContact = null;
        }

        return {
          ...a,
          event: {
            ...evt,
            contact: organizerContact,
          },
        };
      });

      return res.json({
        success: true,
        data: assignments,
      });
    } catch (err) {
      console.error("viewMyAssignments error:", err);
      return res.status(500).json({
        success: false,
        message: "Failed to retrieve your assignments",
      });
    }
  },

  viewAssignmentsByEventId: async (req, res) => {
  try {
    const { eventId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid event ID",
      });
    }

    const event = await Event.findById(eventId)
      .select("organizer contact")
      .lean();

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found",
      });
    }

    if (!canViewEventAssignments(event, req.user)) {
      return res.status(403).json({
        success: false,
        message: "Only the event contact or staff can view assignments.",
      });
    }

    // ✅ Use match (event + active)
    const match = { event: eventId, status: "active" };

    // ✅ Use .lean() so we can add fields easily
    const assignments = await Assignment.find(match)
      .populate({
        path: "bartenderUser",
        select: "fullName email phone profile.avatar profile.photo photoUrl avatarUrl bartenderProfile.payoutLinks",
      })
      .sort({ createdAt: 1 })
      .lean();

    if (!assignments.length) {
      return res.json({ success: true, data: [] });
    }

    // Pull bartender ids from assignments
    const bartenderIds = assignments
      .map((a) => a?.bartenderUser?._id || a?.bartenderUser)
      .filter(Boolean)
      .map((id) => String(id));

    // ✅ Fetch reviews for this event + these bartenders
    const reviews = await Review.find({
      event: eventId,
      bartenderUser: { $in: bartenderIds },
    })
      .select("bartenderUser rating")
      .lean();

    // Map bartenderId -> rating
    const ratingByBartenderId = new Map(
      reviews.map((r) => [String(r.bartenderUser), r.rating])
    );

    // ✅ Attach reviewRate (or null)
    const enrichedAssignments = assignments.map((a) => {
      const bartenderId = String(a?.bartenderUser?._id || a?.bartenderUser);
      return {
        ...a,
        reviewRate: ratingByBartenderId.has(bartenderId)
          ? ratingByBartenderId.get(bartenderId)
          : null,
      };
    });

    return res.json({
      success: true,
      data: enrichedAssignments,
    });
  } catch (err) {
    console.error("viewAssignmentsByEventId error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve assignments",
    });
  }
},

  viewAssignmentsByUserId: async (req, res) => {
    try {
      const { userId } = req.params;
      const {
        status, // optional filter
        includeRemoved, // "true" to include removed
      } = req.query;

      if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid user ID",
        });
      }

      const match = {
        bartenderUser: userId,
      };

      if (status) {
        match.status = status;
      } else if (includeRemoved !== "true") {
        // default: only active assignments
        match.status = "active";
      }

      const assignments = await Assignment.find(match)
        .populate({
          path: "event",
          select:
            "type startAt endAt location pricing counts status options slug visibility contact",
        })
        .sort({ createdAt: -1 })
        .lean();

      return res.json({
        success: true,
        data: assignments,
      });
    } catch (err) {
      console.error("viewAssignmentsByUserId error:", err);
      return res.status(500).json({
        success: false,
        message: "Failed to retrieve assignments for this user",
      });
    }
  },

  removeMyAssignmentById: async (req, res) => {
    const session = await mongoose.startSession();

    try {
      const userId = req.user?.id || req.user?._id;
      const { id: assignmentId } = req.params; // assignment id
      const { reason } = req.body || {};

      if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
        return res
          .status(401)
          .json({ success: false, message: "Unauthenticated or invalid user" });
      }

      if (!mongoose.Types.ObjectId.isValid(assignmentId)) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid assignment ID" });
      }

      session.startTransaction();

      // 🔹 Find the assignment that belongs to this bartender and is active
      const assignment = await Assignment.findOne({
        _id: assignmentId,
        bartenderUser: userId,
        status: "active",
      })
        .session(session)
        .exec();

      if (!assignment) {
        await session.commitTransaction();
        session.endSession();
        return res.status(404).json({
          success: false,
          message: "Active assignment not found for this user.",
        });
      }

      const eventId = assignment.event;

      const evt = await Event.findById(eventId).session(session);
      if (!evt) {
        throw new Error("Event not found for this assignment.");
      }

      // 🔹 Mark THIS assignment as removed
      const removalResult = await Assignment.updateOne(
        {
          _id: assignmentId,
          bartenderUser: userId,
          status: "active",
        },
        {
          $set: {
            status: "removed",
            reason: reason || "self_unassigned",
          },
        },
        { session }
      );

      const removedCount =
        removalResult.modifiedCount ?? removalResult.nModified ?? 0;

      if (removedCount === 0) {
        // nothing changed – already removed or no longer active
        await session.commitTransaction();
        session.endSession();
        return res.json({
          success: true,
          data: {
            message: "Assignment was already removed or not active.",
          },
        });
      }

      // 🔹 Re-count ACTIVE assignments for this event
      const assignedCount = await Assignment.countDocuments({
        event: eventId,
        status: "active",
      })
        .session(session)
        .exec();

      evt.counts = { ...(evt.counts || {}), assigned: assignedCount };

      // How many bartenders are needed?
      const needed =
        evt.pricing?.bartendersRequested ?? evt.counts?.neededBartenders ?? 0;

      const hasOpenSpots = needed > assignedCount;

      if (hasOpenSpots) {
        const urgent = isUrgentEvent(evt.startAt, 48); // your existing helper

        // Find potential recipients based on bids
        const bids = await Bid.find({ event: eventId }).session(session);
        const interested = bids
          .filter((b) => ["interested", "waitlist"].includes(b.status))
          .map((b) => ({ id: b.bartenderUser }));

        if (urgent) {
          await sendNotification?.({
            type: "event_reassign_urgent",
            entity: evt._id,
            entityId: evt._id,
            entityModel: "Event",
            actor: { id: userId },
            recipients: interested,
            slug: "bartend",
            messageBase: "Urgent: a bartender slot opened on an upcoming event",
          });
        } else if (interested.length) {
          await sendNotification?.({
            type: "event_reassign",
            entity: evt._id,
            entityId: evt._id,
            entityModel: "Event",
            actor: { id: userId },
            recipients: interested,
            slug: "bartend",
            messageBase:
              "A bartender slot reopened on an event you were watching",
          });
        }

        // If it was confirmed, drop it back to ready_to_assign
        if (evt.status === "confirmed") {
          evt.status = "ready_to_assign";
        }
      }

      await evt.save({ session });

      // 🔹 Move this bartender’s bids from selected → waitlist (for this event)
      await Bid.updateMany(
        {
          event: eventId,
          bartenderUser: userId,
          status: "selected",
        },
        { $set: { status: "waitlist" } },
        { session }
      );

      await req.logActivity?.({
        action: "update",
        target: { model: "Event", id: evt._id },
        actor: {
          type: "User",
          id: userId,
          label: {
            fullName: req.user?.fullName,
            email: req.user?.email,
            role: req.user?.role,
          },
        },
        summary: "Bartender self-unassigned from event",
        meta: {
          assignmentId,
          eventId,
          bartenderUser: userId,
          reason: reason || "self_unassigned",
          assignedCount,
          needed,
        },
      });

      await session.commitTransaction();
      session.endSession();

      return res.json({
        success: true,
        data: {
          assignedCount,
          needed,
          status: evt.status,
        },
      });
    } catch (err) {
      await session.abortTransaction().catch(() => {});
      session.endSession();
      console.error("removeMyAssignmentById error:", err);
      return res
        .status(400)
        .json({ success: false, message: err.message || "Failed to unassign" });
    }
  },
};

export default assignmentCtrl;
