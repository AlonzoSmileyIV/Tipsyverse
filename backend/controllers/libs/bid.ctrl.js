import {
  BidModel as Bid,
  UserModel as User,
  EventModel as Event,
} from "../../models/index.js";

/**
 * Helper: Haversine distance in km between two lat/lngs
 */
function distanceKm(a, b) {
  if (!a?.lat || !a?.lng || !b?.lat || !b?.lng) return null;

  const R = 6371; // km
  const toRad = (deg) => (deg * Math.PI) / 180;

  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);

  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const s =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
  return R * c;
}

/**
 * Helper: is bartender available for this event? (very naive placeholder)
 * Replace with your real availability logic.
 */
function computeAvailabilityScore(bartender, event) {
  // Example: if you later store availability slots like:
  // bartender.bartenderProfile.availability = [{ dayOfWeek, start, end }]
  // you’d check overlap with event.startAt/endAt.
  // For now assume they’re available if they’re a bartender & eligible.
  const eligible = bartender?.bartenderProfile?.eligible;
  return eligible ? 40 : 0; // out of 40
}

/**
 * Helper: proximity score (0–25)
 */
function computeProximityScore(bartender, event) {
  const live = bartender?.bartenderProfile?.shareLiveLocation;
  const eventLoc = event?.location?.point?.coordinates; // { lat, lng }

  // Must have live location enabled + valid lastPoint
  if (!live?.enabled) return 0;

  const coords = live?.lastPoint?.coordinates;
  if (
    !Array.isArray(coords) ||
    coords.length !== 2 ||
    typeof coords[0] !== "number" ||
    typeof coords[1] !== "number"
  ) {
    return 0;
  }

  if (
    !eventLoc ||
    typeof eventLoc.lat !== "number" ||
    typeof eventLoc.lng !== "number"
  ) {
    return 0;
  }

  // GeoJSON is [lng, lat]
  const [bartenderLng, bartenderLat] = coords;

  const d = distanceKm(
    { lat: bartenderLat, lng: bartenderLng },
    { lat: eventLoc.lat, lng: eventLoc.lng }
  );

  if (d == null) return 0;

  // 0–10km → 25 pts
  // 10–25km → 18 pts
  // 25–50km → 10 pts
  // >50km → 0
  if (d <= 10) return 25;
  if (d <= 25) return 18;
  if (d <= 50) return 10;
  return 0;
}

/**
 * Helper: review rating score (0–20)
 * assumes 0–5 star avg rating
 */
function computeReviewScore(bartender) {
  const avg = bartender?.bartenderProfile?.reviewSummary?.avgRating || 0;
  // Map 0–5 → 0–20
  return Math.round((avg / 5) * 20);
}

/**
 * Helper: tenure score (0–10)
 * years with Tipsyverse → up to 10 pts
 */
function computeTenureScore(bartender, now = new Date()) {
  const joinedAt =
    bartender?.bartenderProfile?.joinedAt || bartender?.createdAt;
  if (!joinedAt) return 0;

  const years =
    (now.getTime() - new Date(joinedAt).getTime()) /
    (1000 * 60 * 60 * 24 * 365.25);

  if (years <= 0) return 0;
  if (years >= 5) return 10; // cap at 10 pts after 5+ yrs

  return Math.round((years / 5) * 10);
}

/**
 * Helper: speed of response score (0–5)
 * Sooner they respond after event is "ready to assign", the better.
 */
function computeSpeedScore(event, submittedAt) {
  const refTime =
    event?.readyToAssignAt ||
    event?.publishedAt ||
    event?.createdAt ||
    submittedAt;

  const diffMinutes =
    (submittedAt.getTime() - new Date(refTime).getTime()) / (1000 * 60);

  if (diffMinutes <= 15) return 5;
  if (diffMinutes <= 60) return 4;
  if (diffMinutes <= 6 * 60) return 3;
  if (diffMinutes <= 24 * 60) return 2;
  if (diffMinutes <= 72 * 60) return 1;
  return 0;
}

/**
 * Master score builder
 */
function computeBidScore({ bartender, event, submittedAt }) {
  const availabilityScore = computeAvailabilityScore(bartender, event); // 0–40
  const proximityScore = computeProximityScore(bartender, event); // 0–25
  const reviewScore = computeReviewScore(bartender); // 0–20
  const tenureScore = computeTenureScore(bartender, submittedAt); // 0–10
  const speedScore = computeSpeedScore(event, submittedAt); // 0–5

  const total =
    availabilityScore + proximityScore + reviewScore + tenureScore + speedScore;

  return Math.round(total); // integer snapshot
}

const bidCtrl = {

  /**
   * POST /bids/toggle-interest
   * Body: { eventId }
   * Uses req.user as bartender.
   *
   * If no bid exists → create with status "interested".
   * If bid exists and is "interested" → set "not_interested" + score 0.
   * If bid exists and is not "interested" → set "interested" + recompute score.
   */
  toggleInterestBid: async (req, res) => {
    try {
      const bartenderUserId = req.user?.id;
      const { eventId } = req.body;

      if (!bartenderUserId || !eventId) {
        return res
          .status(400)
          .json({ message: "bartenderUserId and eventId are required." });
      }

      const [bartender, event] = await Promise.all([
        User.findById(bartenderUserId),
        Event.findById(eventId),
      ]);

      if (!bartender || !event) {
        return res
          .status(404)
          .json({ message: "Bartender or event not found." });
      }

      let bid = await Bid.findOne({
        event: eventId,
        bartenderUser: bartenderUserId,
      });

      const now = new Date();

      // No bid yet → create as interested
      if (!bid) {
        const score = computeBidScore({ bartender, event, submittedAt: now });

        bid = await Bid.create({
          event: eventId,
          bartenderUser: bartenderUserId,
          status: "interested",
          score,
          submittedAt: now,
        });

        await req.logActivity({
          action: "create",
          target: { model: "Bid", id: bid._id },
          actor: {
            type: "User",
            id: req.user.id,
            label: {
              fullName: req.user.fullName,
              email: req.user.email,
              role: req.user.role,
            },
          },
          summary: `Bartender ${bartender.fullName} marked event ${event._id} as "interested".`,
        });

        return res.status(200).json(bid);
      }

      // Bid exists → toggle
      const prevStatus = bid.status;

      if (prevStatus === "interested") {
        // Turn OFF interest
        bid.status = "not_interested";
        bid.score = 0;
      } else {
        // Turn ON interest
        const submittedAt = now;
        bid.status = "interested";
        bid.submittedAt = submittedAt;
        bid.score = computeBidScore({
          bartender,
          event,
          submittedAt,
        });
      }

      await bid.save();

      await req.logActivity({
        action: "update",
        target: { model: "Bid", id: bid._id },
        actor: {
          type: "User",
          id: req.user.id,
          label: {
            fullName: req.user.fullName,
            email: req.user.email,
            role: req.user.role,
          },
        },
        summary: `Bid ${bid._id} toggled from "${prevStatus}" → "${bid.status}". Score: ${bid.score}`,
      });

      return res.status(200).json(bid);
    } catch (err) {
      console.error("Error in toggleInterestBid:", err);
      return res.status(500).json({ message: "Failed to toggle interest bid." });
    }
  },

    /**
   * GET /bids/event/:eventId
   * Returns bids for an event, sorted by:
   *  1) score DESC
   *  2) less-booked bartender first
   *  3) earliest submittedAt first
   */
  viewBidsByEventId: async (req, res) => {
    try {
      const { eventId } = req.params;

      const bids = await Bid.find({ event: eventId })
        .populate({
          path: "bartenderUser",
          select:
            "fullName profile.photo bartenderProfile.stats.totalAssignedEvents bartenderProfile.reviewSummary.avgRating bartenderProfile.location bartenderProfile.eligible createdAt",
        })
        .sort({ score: -1, submittedAt: 1 }) // primary sort in DB
        .lean();

      // Secondary fairness tiebreak in JS: less booked wins
      const sorted = bids.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;

        const aAssigned =
          a.bartenderUser?.bartenderProfile?.stats?.totalAssignedEvents || 0;
        const bAssigned =
          b.bartenderUser?.bartenderProfile?.stats?.totalAssignedEvents || 0;

        if (aAssigned !== bAssigned) return aAssigned - bAssigned;

        // last tiebreaker: earlier submittedAt first
        return new Date(a.submittedAt) - new Date(b.submittedAt);
      });

      return res.status(200).json(sorted);
    } catch (err) {
      console.error("Error in viewBidsByEventId:", err);
      return res.status(500).json({ message: "Failed to fetch bids." });
    }
  },

  // ✅ NEW: Returns ONLY *interested* bids for an event
viewInterestedBidsByEventId: async (req, res) => {
  try {
    const { eventId } = req.params;

    const bids = await Bid.find({
      event: eventId,
      status: "interested", // if you sometimes store differently, adjust here
    })
      .populate({
        path: "bartenderUser",
        select:
          "email fullName profile.photo bartenderProfile.stats.totalAssignedEvents bartenderProfile.reviewSummary.avgRating bartenderProfile.location bartenderProfile.eligible createdAt",
      })
      .sort({ score: -1, submittedAt: 1 }) // primary sort in DB
      .lean();

    // Same fairness tiebreak in JS
    const sorted = bids.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;

      const aAssigned =
        a.bartenderUser?.bartenderProfile?.stats?.totalAssignedEvents || 0;
      const bAssigned =
        b.bartenderUser?.bartenderProfile?.stats?.totalAssignedEvents || 0;

      if (aAssigned !== bAssigned) return aAssigned - bAssigned;

      return new Date(a.submittedAt) - new Date(b.submittedAt);
    });

    return res.status(200).json(sorted);
  } catch (err) {
    console.error("Error in viewInterestedBidsByEventId:", err);
    return res.status(500).json({ message: "Failed to fetch interested bids." });
  }
},

  /**
   * GET /bids/user/:userId
   * You can also default userId = req.user._id if you want “my bids”
   */
  viewBidsByUserId: async (req, res) => {
    try {
      const { userId } = req.params;

      const bids = await Bid.find({ bartenderUser: userId })
        .populate({
          path: "event",
          select: "type status startAt endAt location pricing counts",
        })
        .sort({ submittedAt: -1 })
        .lean();

      return res.status(200).json(bids);
    } catch (err) {
      console.error("Error in viewBidsByUserId:", err);
      return res.status(500).json({ message: "Failed to fetch bids." });
    }
  },

  /**
   * GET /bids/me
   * Returns bids for the currently logged-in bartender user.
   */
  viewMyBids: async (req, res) => {
    try {
      const userId = req.user?.id || req.user?._id;

      if (!userId) {
        return res
          .status(401)
          .json({ message: "You must be logged in to view your bids." });
      }

      const bids = await Bid.find({ bartenderUser: userId })
        .populate({
          path: "event",
          select: "type status startAt endAt location pricing counts",
        })
        .sort({ submittedAt: -1 })
        .lean();

      return res.status(200).json(bids);
    } catch (err) {
      console.error("Error in fetchMyBids:", err);
      return res.status(500).json({ message: "Failed to fetch your bids." });
    }
  },

    /**
   * PATCH /bids/:bidId
   * Body: { status }
   * If status becomes "interested" again, recompute score.
   */

  updateBid: async (req, res) => {
    try {
      const { bidId } = req.params;
      const { status } = req.body;

      const bid = await BidModel.findById(bidId).populate([
        { path: "bartenderUser" },
        { path: "event" },
      ]);

      if (!bid) {
        return res.status(404).json({ message: "Bid not found." });
      }

      // Optional: security check – only the same bartender or an admin can update
      // if (!req.user.isAdmin && String(req.user._id) !== String(bid.bartenderUser._id)) {
      //   return res.status(403).json({ message: "Not authorized to update this bid." });
      // }

      if (status) {
        bid.status = status;
      }

      // If they become interested again, recompute score.
      if (status === "interested") {
        const submittedAt = new Date();
        bid.submittedAt = submittedAt;
        bid.score = computeBidScore({
          bartender: bid.bartenderUser,
          event: bid.event,
          submittedAt,
        });
      } else if (status === "not_interested" || status === "rejected") {
        // you can choose to nuke score for uninterested/rejected
        bid.score = 0;
      }

      await bid.save();

      await req.logActivity({
        action: "update",
        target: { model: "Bid", id: bid._id },
        actor: {
          type: "User",
          id: req.user.id,
          label: {
            fullName: req.user.fullName,
            email: req.user.email,
            role: req.user.role,
          },
        },
        summary: `Bid ${bidId} updated from "${prevStatus}" → "${status}". Score: ${bid.score}`,
      });

      return res.status(200).json(bid);
    } catch (err) {
      console.error("Error in updateBid:", err);
      return res.status(500).json({ message: "Failed to update bid." });
    }
  },

};

export default bidCtrl;
