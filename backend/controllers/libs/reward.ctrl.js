import {
  AssignmentModel as Assignment,
  RewardClaimModel as RewardClaim,
  UserModel as User,
} from "../../models/index.js";
import {
  BARTENDER_REWARD_MILESTONES,
  buildRewardProgress,
  displayStatus,
  getCompletedBartenderEventsCount,
  sendEmail,
} from "../../utils/index.js";

const appUrl = () =>
  process.env.PUBLIC_APP_URL || process.env.FRONTEND_URL || "http://localhost:3000";

const getRewardForMilestone = (milestone) =>
  BARTENDER_REWARD_MILESTONES.find(
    (reward) => Number(reward.milestone) === Number(milestone)
  );

const escapeHtml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const normalize = (value = "") => String(value || "").trim();

const getRewardQuestions = (rewardName = "") => {
  const name = rewardName.toLowerCase();
  if (name.includes("t-shirt") || name.includes("hoodie") || name.includes("jacket")) {
    return [
      {
        key: "shirtSize",
        label: "Size",
        required: true,
        options: ["XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL"],
      },
    ];
  }
  if (name.includes("polo")) {
    return [
      {
        key: "shirtSize",
        label: "Size",
        required: true,
        options: ["XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL"],
      },
      {
        key: "poloColor",
        label: "Polo color",
        required: true,
        options: ["Black", "Burgundy", "White", "Navy", "Gray"],
      },
    ];
  }
  if (name.includes("mixing glass") || name.includes("personalized") || name.includes("engraved")) {
    return [
      {
        key: "personalizationText",
        label: "Personalization text",
        required: true,
        pattern: /^[A-Za-z0-9 .'-]{1,24}$/,
        helperText: "Use 1-24 letters, numbers, spaces, periods, apostrophes, or hyphens.",
      },
    ];
  }
  if (name.includes("apron")) {
    return [
      {
        key: "personalizationText",
        label: "Embroidery name",
        required: true,
        pattern: /^[A-Za-z0-9 .'-]{1,24}$/,
        helperText: "Use 1-24 letters, numbers, spaces, periods, apostrophes, or hyphens.",
      },
    ];
  }
  return [];
};

const validateShippingAddress = (address = {}) => {
  const normalized = {
    fullName: normalize(address.fullName),
    address1: normalize(address.address1),
    address2: normalize(address.address2),
    city: normalize(address.city),
    state: normalize(address.state),
    zipcode: normalize(address.zipcode),
    country: normalize(address.country) || "US",
    instructions: normalize(address.instructions),
  };
  const missing = ["fullName", "address1", "city", "state", "zipcode"].filter(
    (key) => !normalized[key]
  );
  return { normalized, missing };
};

const normalizeAnswers = (reward, body = {}) => {
  const questions = getRewardQuestions(reward.reward);
  const byKey = new Map(
    (Array.isArray(body.answers) ? body.answers : []).map((answer) => [
      answer?.key,
      normalize(answer?.value),
    ])
  );
  const errors = [];
  const answers = questions.map((question) => {
    const value = normalize(body[question.key] ?? byKey.get(question.key));
    if (question.required && !value) {
      errors.push(`${question.label} is required for ${reward.reward}.`);
    }
    if (value && question.options && !question.options.includes(value)) {
      errors.push(`${question.label} must be one of: ${question.options.join(", ")}.`);
    }
    if (value && question.pattern && !question.pattern.test(value)) {
      errors.push(question.helperText || `${question.label} has invalid characters.`);
    }
    return { key: question.key, label: question.label, value };
  });

  return { answers, errors };
};

const formatAddressHtml = (address = {}) => {
  const lines = [
    address.fullName,
    address.address1,
    address.address2,
    [address.city, address.state, address.zipcode].filter(Boolean).join(", "),
    address.country,
    address.instructions ? `Instructions: ${address.instructions}` : "",
  ].filter(Boolean);
  return lines.map((line) => escapeHtml(line)).join("<br />");
};

const formatAnswersHtml = (answers = []) =>
  answers
    .filter((answer) => answer?.value)
    .map(
      (answer) =>
        `<li><strong>${escapeHtml(answer.label)}:</strong> ${escapeHtml(answer.value)}</li>`
    )
    .join("");

const getCompletedCountForUser = async (userId) => {
  const assignments = await Assignment.find({
    bartenderUser: userId,
    status: "active",
  })
    .populate("event", "status")
    .lean();

  return getCompletedBartenderEventsCount(assignments);
};

const rewardCtrl = {
  viewMyRewards: async (req, res) => {
    try {
      const userId = req.user.id || req.user._id;
      const [completedEvents, claims] = await Promise.all([
        getCompletedCountForUser(userId),
        RewardClaim.find({ bartenderUser: userId }).lean(),
      ]);

      return res.json({
        success: true,
        data: {
          completedEvents,
          milestones: buildRewardProgress(completedEvents, claims),
        },
      });
    } catch (err) {
      console.error("viewMyRewards error:", err);
      return res.status(500).json({
        success: false,
        message: "Failed to load rewards.",
      });
    }
  },

  claimReward: async (req, res) => {
    try {
      const userId = req.user.id || req.user._id;
      const milestone = Number(req.params.milestone);
      const reward = getRewardForMilestone(milestone);

      if (!reward) {
        return res.status(404).json({
          success: false,
          message: "Reward milestone not found.",
        });
      }

      if (reward.requiresClaim === false) {
        return res.status(400).json({
          success: false,
          message: "This reward does not need to be claimed.",
        });
      }

      const completedEvents = await getCompletedCountForUser(userId);
      if (completedEvents < milestone) {
        return res.status(400).json({
          success: false,
          message: `You need ${milestone - completedEvents} more completed event(s) to claim this reward.`,
        });
      }

      const body = req.body || {};
      const { shippingAddress = {}, notes = "" } = body;
      const { normalized: normalizedAddress, missing } =
        validateShippingAddress(shippingAddress);
      if (missing.length) {
        return res.status(400).json({
          success: false,
          message: `Delivery address is missing: ${missing.join(", ")}.`,
        });
      }

      const { answers, errors } = normalizeAnswers(reward, body);
      if (errors.length) {
        return res.status(400).json({
          success: false,
          message: errors[0],
        });
      }

      const existing = await RewardClaim.findOne({
        bartenderUser: userId,
        milestone,
      });

      if (existing && !["canceled", "declined"].includes(existing.status)) {
        return res.status(409).json({
          success: false,
          message: "This reward has already been claimed.",
        });
      }

      const claim = existing || new RewardClaim({ bartenderUser: userId, milestone });
      claim.reward = reward.reward;
      claim.costRange = reward.costRange;
      claim.status = "pending";
      claim.shippingAddress = normalizedAddress;
      claim.answers = answers;
      claim.shirtSize =
        answers.find((answer) => answer.key === "shirtSize")?.value ||
        normalize(body.shirtSize);
      claim.poloColor =
        answers.find((answer) => answer.key === "poloColor")?.value ||
        normalize(body.poloColor);
      claim.personalizationText =
        answers.find((answer) => answer.key === "personalizationText")?.value ||
        normalize(body.personalizationText);
      claim.notes = normalize(notes);
      claim.requestedAt = new Date();
      claim.reviewedAt = null;
      claim.reviewedBy = null;
      claim.fulfilledAt = null;
      claim.fulfilledBy = null;
      claim.sentAt = null;
      claim.sentBy = null;
      claim.declinedAt = null;
      claim.declinedBy = null;
      await claim.save();

      sendEmail?.({
        to: "admin@tipsyverse.com",
        cc: "alonzo.smiley@tipsyverse.com",
        subject: `Reward claim submitted — ${reward.reward}`,
        title: "Bartender Reward Claim",
        html: `
          <p>${req.user.fullName || req.user.email} claimed a milestone reward.</p>
          <p><strong>Milestone:</strong> ${milestone} completed event(s)</p>
          <p><strong>Reward:</strong> ${reward.reward}</p>
          <p><strong>Approx. Cost:</strong> ${reward.costRange}</p>
          <p><strong>Completed Events:</strong> ${completedEvents}</p>
          <p><strong>Delivery Address:</strong><br />${formatAddressHtml(normalizedAddress)}</p>
          ${
            answers.length
              ? `<p><strong>Reward Details:</strong></p><ul>${formatAnswersHtml(answers)}</ul>`
              : ""
          }
          ${claim.notes ? `<p><strong>Notes:</strong> ${escapeHtml(claim.notes)}</p>` : ""}
          <div class="button-wrapper">
            <a href="${appUrl()}/admin/users" class="button">Open Admin Users</a>
          </div>
        `,
      }).catch((err) =>
        console.error("Reward claim admin email failed:", err?.message)
      );

      if (req.user.email) {
        sendEmail?.({
          to: req.user.email,
          subject: `We received your reward claim — ${reward.reward}`,
          title: "Reward Claim Received",
          html: `
            <p>Hi ${escapeHtml(req.user.fullName || "there")},</p>
            <p>We received your claim for <strong>${escapeHtml(reward.reward)}</strong>. The Tipsyverse team will review it and prepare it for delivery.</p>
            <p><strong>Delivery Address:</strong><br />${formatAddressHtml(normalizedAddress)}</p>
            ${
              answers.length
                ? `<p><strong>Your Reward Details:</strong></p><ul>${formatAnswersHtml(answers)}</ul>`
                : ""
            }
          `,
        }).catch((err) =>
          console.error("Reward claim bartender email failed:", err?.message)
        );
      }

      return res.status(201).json({ success: true, data: claim });
    } catch (err) {
      console.error("claimReward error:", err);
      return res.status(500).json({
        success: false,
        message: "Failed to claim reward.",
      });
    }
  },

  viewAllClaims: async (req, res) => {
    try {
      const status = req.query.status ? { status: req.query.status } : {};
      const claims = await RewardClaim.find(status)
        .populate("bartenderUser", "fullName email username profile.photo photo")
        .populate("reviewedBy", "fullName email")
        .populate("fulfilledBy", "fullName email")
        .sort({ createdAt: -1 })
        .lean();

      return res.json({ success: true, data: claims });
    } catch (err) {
      console.error("viewAllClaims error:", err);
      return res.status(500).json({
        success: false,
        message: "Failed to load reward claims.",
      });
    }
  },

  updateClaimStatus: async (req, res) => {
    try {
      const { status } = req.body || {};
      const hasInternalNotesPatch = Object.prototype.hasOwnProperty.call(
        req.body || {},
        "internalNotes"
      );
      const internalNotes = hasInternalNotesPatch
        ? normalize(req.body.internalNotes)
        : undefined;
      const allowed = ["pending", "approved", "fulfilled", "declined", "canceled"];
      if (!allowed.includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid reward claim status.",
        });
      }

      const claim = await RewardClaim.findById(req.params.claimId).populate(
        "bartenderUser",
        "fullName email"
      );
      if (!claim) {
        return res.status(404).json({
          success: false,
          message: "Reward claim not found.",
        });
      }

      const now = new Date();
      claim.status = status;
      if (hasInternalNotesPatch) {
        claim.internalNotes = internalNotes;
      }
      claim.reviewedAt = now;
      claim.reviewedBy = req.user.id;
      if (status === "fulfilled") {
        claim.fulfilledAt = now;
        claim.fulfilledBy = req.user.id;
      }
      if (status === "declined") {
        claim.declinedAt = now;
        claim.declinedBy = req.user.id;
      }
      await claim.save();

      if (claim.bartenderUser?.email && ["approved", "fulfilled", "declined"].includes(status)) {
        const noteForEmail = hasInternalNotesPatch ? internalNotes : claim.internalNotes;
        const statusLabel = displayStatus(status);
        sendEmail?.({
          to: claim.bartenderUser.email,
          subject: `Tipsyverse reward ${statusLabel}: ${claim.reward}`,
          title: `Reward ${statusLabel}`,
          html: `
            <p>Hi ${claim.bartenderUser.fullName || "there"},</p>
            <p>Your reward claim for <strong>${claim.reward}</strong> is now <strong>${statusLabel}</strong>.</p>
            ${noteForEmail ? `<p><strong>Note:</strong> ${escapeHtml(noteForEmail)}</p>` : ""}
          `,
        }).catch((err) =>
          console.error("Reward status email failed:", err?.message)
        );
      }

      return res.json({ success: true, data: claim });
    } catch (err) {
      console.error("updateClaimStatus error:", err);
      return res.status(500).json({
        success: false,
        message: "Failed to update reward claim.",
      });
    }
  },

  sendReward: async (req, res) => {
    try {
      const claim = await RewardClaim.findById(req.params.claimId).populate(
        "bartenderUser",
        "fullName email"
      );
      if (!claim) {
        return res.status(404).json({
          success: false,
          message: "Reward claim not found.",
        });
      }

      if (claim.status === "fulfilled") {
        return res.status(409).json({
          success: false,
          message: "This reward was already marked as sent.",
        });
      }

      const now = new Date();
      claim.status = "fulfilled";
      claim.fulfilledAt = now;
      claim.fulfilledBy = req.user.id;
      claim.sentAt = now;
      claim.sentBy = req.user.id;
      claim.reviewedAt = claim.reviewedAt || now;
      claim.reviewedBy = claim.reviewedBy || req.user.id;
      await claim.save();

      if (claim.bartenderUser?.email) {
        sendEmail?.({
          to: claim.bartenderUser.email,
          subject: `Your Tipsyverse reward is being sent — ${claim.reward}`,
          title: "Reward Delivery Started",
          html: `
            <p>Hi ${escapeHtml(claim.bartenderUser.fullName || "there")},</p>
            <p>Your <strong>${escapeHtml(claim.reward)}</strong> reward has been marked for delivery.</p>
            <p>We will send it to:</p>
            <p>${formatAddressHtml(claim.shippingAddress || {})}</p>
          `,
        }).catch((err) =>
          console.error("Reward sent email failed:", err?.message)
        );
      }

      return res.json({ success: true, data: claim });
    } catch (err) {
      console.error("sendReward error:", err);
      return res.status(500).json({
        success: false,
        message: "Failed to send reward.",
      });
    }
  },
};

export default rewardCtrl;
