import {
  SupportTicketModel as SupportTicket,
  UserModel as User,
} from "../../models/index.js";
import fs from "fs";
import crypto from "crypto";
import {
  displayLabel,
  handleImageUpload,
  sendEmail,
  sendNotification,
} from "../../utils/index.js";

const isEmployee = (user) => user?.role === "employee";
const appUrl = () => process.env.ADMIN_PORTAL_URL || process.env.FRONTEND_URL || "http://localhost:3000";
const adminTicketUrl = (ticket) => `${appUrl()}/admin/operations?ticket=${ticket._id}`;
const customerTicketUrl = (ticket) => `${appUrl()}/settings/support?ticket=${ticket._id}`;
const MAX_TICKET_SUBJECT_LENGTH = 120;
const MAX_TICKET_DESCRIPTION_LENGTH = 5000;
const MAX_TICKET_MESSAGE_LENGTH = 3000;
const MAX_TICKET_NOTE_LENGTH = 4000;
const ACTIVE_TICKET_STATUSES = ["open", "in_progress", "waiting_on_user"];

const ticketLabel = (ticket) => ticket?.ticketNumber || "TKT-00000";
const ticketPopulate = [
  { path: "submittedBy", select: "fullName email username profile.photo" },
  { path: "assignedTo", select: "fullName email username profile.photo" },
  { path: "canceledBy", select: "fullName email username" },
  { path: "reopenedBy", select: "fullName email username" },
  { path: "messages.author", select: "fullName email username profile.photo" },
  { path: "noteEntries.author", select: "fullName email username profile.photo" },
];

const populateTicket = (query) =>
  ticketPopulate.reduce((q, item) => q.populate(item), query);

const parseAttachments = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

const cleanAttachments = (value, userId) =>
  parseAttachments(value)
    .filter((item) => item?.url && item?.publicId)
    .slice(0, 8)
    .map((item) => ({
      url: String(item.url),
      publicId: String(item.publicId),
      originalName: String(item.originalName || ""),
      mimeType: String(item.mimeType || ""),
      size: Number(item.size) || 0,
      uploadedBy: item.uploadedBy || userId,
      uploadedAt: item.uploadedAt || new Date(),
    }));

const cleanErrorReportValue = (value, fallback) =>
  String(value || fallback || "")
    .trim()
    .slice(0, 5000)
    .replace(/\s+/g, " ")
    .toLowerCase();

const errorFingerprintFrom = (errorReport) => {
  if (!errorReport || typeof errorReport !== "object") return null;
  const message = cleanErrorReportValue(errorReport.message);
  const location = cleanErrorReportValue(errorReport.location)
    .replace(/\([^)]*[/\\\\]([^/\\\\)]+):\d+:\d+\)/g, "($1)")
    .replace(/:\d+:\d+/g, "");
  if (!message) return null;

  return crypto
    .createHash("sha256")
    .update(`${message}\n${location}`)
    .digest("hex");
};

const buildAnonymousErrorTicket = (errorReport) => {
  if (!errorReport || typeof errorReport !== "object") return null;

  const message = String(errorReport.message || "").trim().slice(0, 500);
  if (!message) return null;

  const page = String(errorReport.page || "Unknown page").trim().slice(0, 300);
  const location = String(
    errorReport.location || "The component location was not available."
  )
    .trim()
    .slice(0, 1400);

  return {
    subject: `Application error: ${message}`.slice(
      0,
      MAX_TICKET_SUBJECT_LENGTH
    ),
    description: [
      `Error: ${message}`,
      `Page: ${page}`,
      "",
      "Likely location:",
      location,
    ]
      .join("\n")
      .slice(0, 1900),
    errorFingerprint: errorFingerprintFrom({ message, location }),
  };
};

const uploadFilesToCloudinary = async (files = [], userId) => {
  const uploaded = [];

  for (const file of files) {
    try {
      const result = await handleImageUpload(file.path);
      uploaded.push({
        url: result.secure_url,
        publicId: result.public_id,
        originalName: file.originalname || "",
        mimeType: file.mimetype || "",
        size: file.size || 0,
        uploadedBy: userId,
        uploadedAt: new Date(),
      });
    } finally {
      fs.unlink(file.path, (err) => {
        if (err) console.error("Failed to delete support upload temp file:", err);
      });
    }
  }

  return uploaded;
};

const ensureTicketNumber = async (ticket) => {
  if (!ticket) return ticket;
  if (/^TKT-0\d{5}$/.test(ticket.ticketNumber || "")) {
    ticket.ticketNumber = ticket.ticketNumber.replace("TKT-0", "TKT-");
    await ticket.save();
    return ticket;
  }
  if (ticket.ticketNumber) return ticket;
  await ticket.save();
  return ticket;
};

const findTicketByIdWithNumber = async (id) => {
  const ticket = await SupportTicket.findById(id);
  if (!ticket) return null;
  await ensureTicketNumber(ticket);
  return populateTicket(SupportTicket.findById(ticket._id)).lean();
};

const findTicketsWithNumbers = async (match) => {
  const tickets = await SupportTicket.find(match).sort({ updatedAt: -1 });
  await Promise.all(tickets.map(ensureTicketNumber));
  await SupportTicket.populate(tickets, ticketPopulate);
  return tickets.map((ticket) => ticket.toObject());
};

const safeSendEmail = async (args) => {
  try {
    if (!args?.to) return;
    await sendEmail(args);
  } catch (err) {
    console.error("Support ticket email failed:", err.message);
  }
};

const safeNotify = async (args) => {
  try {
    await sendNotification(args);
  } catch (err) {
    console.error("Support ticket notification failed:", err.message);
  }
};

const notifyUser = async ({ type, ticket, actor, recipientId, messageBase, slug }) => {
  if (!recipientId) return;
  await safeNotify({
    type,
    entityId: ticket._id,
    entity: ticket._id,
    entityModel: "SupportTicket",
    actor: { id: actor?.id || actor?._id },
    recipients: [{ id: recipientId }],
    slug,
    messageBase,
    subjectText: ticketLabel(ticket),
  });
};

const ticketSubmittedEmail = (ticket) => `
  <p>We received your support ticket <strong>${ticketLabel(ticket)}</strong>.</p>
  <p><strong>Subject:</strong> ${ticket.subject}</p>
  <p><strong>Category:</strong> ${displayLabel(ticket.category)}</p>
  <p><strong>Priority:</strong> ${displayLabel(ticket.priority)}</p>
  <p><strong>Description:</strong></p>
  <p>${ticket.description}</p>
  <p>You can view it here:</p>
  <p><a href="${customerTicketUrl(ticket)}" class="button">View Ticket</a></p>
`;

const assignmentEmail = (ticket, assignee) => `
  <p>You have been assigned support ticket <strong>${ticketLabel(ticket)}</strong>.</p>
  <p><strong>Subject:</strong> ${ticket.subject}</p>
  <p><strong>Submitted by:</strong> ${ticket.submittedBy?.fullName || ticket.submittedBy?.email || "Customer"}</p>
  <p><a href="${adminTicketUrl(ticket)}" class="button">Review Ticket</a></p>
  <p>If the button does not work, open this link: <a href="${adminTicketUrl(ticket)}">${adminTicketUrl(ticket)}</a></p>
`;

const resolutionEmail = (ticket) => `
  <p>Your support ticket <strong>${ticketLabel(ticket)}</strong> has been marked resolved.</p>
  <p><strong>Subject:</strong> ${ticket.subject}</p>
  <p><strong>Resolution:</strong></p>
  <p>${ticket.resolution || "Resolved by the Tipsyverse team."}</p>
  <p><a href="${customerTicketUrl(ticket)}" class="button">Review Resolution</a></p>
`;

const ticketMessageEmail = ({ ticket, message, recipientRole }) => `
  <p>There is a new message on support ticket <strong>${ticketLabel(ticket)}</strong>.</p>
  <p><strong>Subject:</strong> ${ticket.subject}</p>
  <p><strong>Message:</strong></p>
  <p>${message}</p>
  <p><a href="${recipientRole === "employee" ? adminTicketUrl(ticket) : customerTicketUrl(ticket)}" class="button">Open Ticket</a></p>
`;

const resolveEmployeeMentions = async (message) => {
  const usernames = [...String(message || "").matchAll(/@([a-z0-9._-]{3,32})/gi)]
    .map((match) => match[1].toLowerCase());
  if (!usernames.length) return [];
  return User.find({
    role: "employee",
    username: { $in: [...new Set(usernames)] },
  })
    .select("_id fullName email username")
    .lean();
};

const resolveMentionedEmployees = async ({ message, mentionUsers = [] }) => {
  const explicitIds = Array.isArray(mentionUsers) ? mentionUsers.filter(Boolean) : [];
  const byId = explicitIds.length
    ? await User.find({ _id: { $in: explicitIds }, role: "employee" })
        .select("_id fullName email username")
        .lean()
    : [];
  const byUsername = await resolveEmployeeMentions(message);
  const map = new Map();
  [...byId, ...byUsername].forEach((user) => map.set(String(user._id), user));
  return [...map.values()];
};

const supportTicketCtrl = {
  createAnonymousErrorTicket: async (req, res) => {
    const report = buildAnonymousErrorTicket(req.body?.errorReport);
    if (!report?.errorFingerprint) {
      return res.status(400).json({
        success: false,
        message: "A valid application error report is required.",
      });
    }

    try {
      const existing = await SupportTicket.findOne({
        errorFingerprint: report.errorFingerprint,
        status: { $in: ACTIVE_TICKET_STATUSES },
      }).select("ticketNumber");
      if (existing) {
        return res.json({
          success: true,
          duplicate: true,
          message: "We’re already investigating this issue.",
        });
      }

      await SupportTicket.create({
        submittedBy: null,
        submissionSource: "anonymous_error",
        category: "technical_issue",
        priority: "undecided",
        subject: report.subject,
        description: report.description,
        errorFingerprint: report.errorFingerprint,
      });

      return res.status(201).json({
        success: true,
        message: "Anonymous error report submitted.",
      });
    } catch (err) {
      if (err?.code === 11000 && err?.keyPattern?.errorFingerprint) {
        return res.json({
          success: true,
          duplicate: true,
          message: "We’re already investigating this issue.",
        });
      }
      return res.status(500).json({
        success: false,
        message: "The error report could not be submitted.",
      });
    }
  },

  createTicket: async (req, res) => {
    try {
      const { category, subject, description } = req.body || {};
      const cleanSubject = String(subject || "").trim();
      const cleanDescription = String(description || "").trim();
      if (!cleanSubject || !cleanDescription) {
        return res.status(400).json({ success: false, message: "Subject and description are required." });
      }
      if (cleanSubject.length > MAX_TICKET_SUBJECT_LENGTH) {
        return res.status(400).json({
          success: false,
          message: `Subject must be ${MAX_TICKET_SUBJECT_LENGTH} characters or fewer.`,
        });
      }
      if (cleanDescription.length > MAX_TICKET_DESCRIPTION_LENGTH) {
        return res.status(400).json({
          success: false,
          message: `Description must be ${MAX_TICKET_DESCRIPTION_LENGTH} characters or fewer.`,
        });
      }

      const errorFingerprint = errorFingerprintFrom(req.body?.errorReport);
      if (errorFingerprint) {
        const existing = await SupportTicket.findOne({
          errorFingerprint,
          status: { $in: ACTIVE_TICKET_STATUSES },
        }).select("ticketNumber");
        if (existing) {
          return res.json({
            success: true,
            duplicate: true,
            data: { ticketNumber: existing.ticketNumber },
            message: "We’re already investigating this issue.",
          });
        }
      }

      const ticket = await SupportTicket.create({
        submittedBy: req.user.id,
        category: errorFingerprint ? "technical_issue" : category,
        priority: "undecided",
        subject: cleanSubject,
        description: cleanDescription,
        errorFingerprint,
        attachments: cleanAttachments(req.body?.attachments, req.user.id),
      });

      const populated = await populateTicket(SupportTicket.findById(ticket._id)).lean();
      await safeSendEmail({
        to: req.user.email,
        subject: `Tipsyverse Support - ${ticketLabel(populated)} Received`,
        title: `Support Ticket ${ticketLabel(populated)}`,
        html: ticketSubmittedEmail(populated),
      });

      return res.status(201).json({ success: true, data: populated, message: "Support ticket submitted." });
    } catch (err) {
      if (err?.code === 11000 && err?.keyPattern?.errorFingerprint) {
        const errorFingerprint = errorFingerprintFrom(req.body?.errorReport);
        const existing = errorFingerprint
          ? await SupportTicket.findOne({
              errorFingerprint,
              status: { $in: ACTIVE_TICKET_STATUSES },
            }).select("ticketNumber")
          : null;
        if (existing) {
          return res.json({
            success: true,
            duplicate: true,
            data: { ticketNumber: existing.ticketNumber },
            message: "We’re already investigating this issue.",
          });
        }
      }
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  viewTickets: async (req, res) => {
    try {
      const { status, priority, category, mine } = req.query;
      const match = {};
      if (status) match.status = status;
      if (priority) match.priority = priority;
      if (category) match.category = category;
      if (!isEmployee(req.user) || mine === "true") match.submittedBy = req.user.id;

      const tickets = await findTicketsWithNumbers(match);

      return res.json({ success: true, data: tickets });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  viewTicketById: async (req, res) => {
    try {
      const ticket = await findTicketByIdWithNumber(req.params.id);

      if (!ticket) return res.status(404).json({ success: false, message: "Ticket not found." });
      if (!isEmployee(req.user) && String(ticket.submittedBy?._id || ticket.submittedBy) !== String(req.user.id)) {
        return res.status(403).json({ success: false, message: "Not authorized." });
      }

      return res.json({ success: true, data: ticket });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  updateTicket: async (req, res) => {
    try {
      const allowed = ["status", "priority", "category", "resolution", "notes"];
      const patch = {};
      allowed.forEach((key) => {
        if (req.body[key] !== undefined) patch[key] = req.body[key];
      });

      const beforeDoc = await SupportTicket.findById(req.params.id);
      await ensureTicketNumber(beforeDoc);
      const before = beforeDoc?.toObject();
      const ticket = await SupportTicket.findByIdAndUpdate(req.params.id, patch, { new: true });
      if (!ticket) return res.status(404).json({ success: false, message: "Ticket not found." });

      const populated = await populateTicket(SupportTicket.findById(ticket._id)).lean();
      const customerMessage = String(req.body?.customerMessage || "").trim();
      if (patch.status === "waiting_on_user" && customerMessage) {
        const withMessage = await SupportTicket.findByIdAndUpdate(
          ticket._id,
          {
            $push: {
              messages: {
                author: req.user.id,
                message: customerMessage,
                internal: false,
              },
            },
          },
          { new: true }
        );
        const messaged = await populateTicket(SupportTicket.findById(withMessage._id)).lean();
        await safeSendEmail({
          to: messaged.submittedBy?.email,
          subject: `Tipsyverse Support - Response Needed on ${ticketLabel(messaged)}`,
          title: `Response Needed: ${ticketLabel(messaged)}`,
          html: ticketMessageEmail({ ticket: messaged, message: customerMessage, recipientRole: "customer" }),
        });
        await notifyUser({
          type: "support_ticket_reopened",
          ticket: messaged,
          actor: req.user,
          recipientId: messaged.submittedBy?._id,
          slug: `settings/support?ticket=${messaged._id}`,
          messageBase: "needs more information on your support ticket",
        });
        return res.json({ success: true, data: messaged, message: "Ticket updated." });
      }

      if (patch.status === "resolved" && before?.status !== "resolved") {
        await safeSendEmail({
          to: populated.submittedBy?.email,
          subject: `Tipsyverse Support - ${ticketLabel(populated)} Resolved`,
          title: `Support Ticket ${ticketLabel(populated)} Resolved`,
          html: resolutionEmail(populated),
        });
        await notifyUser({
          type: "support_ticket_resolved",
          ticket: populated,
          actor: req.user,
          recipientId: populated.submittedBy?._id,
          slug: `settings/support?ticket=${populated._id}`,
          messageBase: "resolved your support ticket",
        });
      }

      return res.json({ success: true, data: populated, message: "Ticket updated." });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  addNote: async (req, res) => {
    try {
      const content = String(req.body?.content || "").trim();
      if (!content) {
        return res.status(400).json({ success: false, message: "Note content is required." });
      }
      if (content.length > MAX_TICKET_NOTE_LENGTH) {
        return res.status(400).json({ success: false, message: `Each note must be ${MAX_TICKET_NOTE_LENGTH} characters or fewer.` });
      }

      const ticket = await SupportTicket.findByIdAndUpdate(
        req.params.id,
        { $push: { noteEntries: { author: req.user.id, content } } },
        { new: true, runValidators: true }
      );
      if (!ticket) return res.status(404).json({ success: false, message: "Ticket not found." });

      const populated = await populateTicket(SupportTicket.findById(ticket._id)).lean();
      return res.status(201).json({ success: true, data: populated, message: "Ticket note added." });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  updateNote: async (req, res) => {
    try {
      const content = String(req.body?.content || "").trim();
      if (!content) {
        return res.status(400).json({ success: false, message: "Note content is required." });
      }
      if (content.length > MAX_TICKET_NOTE_LENGTH) {
        return res.status(400).json({ success: false, message: `Each note must be ${MAX_TICKET_NOTE_LENGTH} characters or fewer.` });
      }

      const ticket = await SupportTicket.findOneAndUpdate(
        { _id: req.params.id, "noteEntries._id": req.params.noteId },
        {
          $set: {
            "noteEntries.$.content": content,
            "noteEntries.$.updatedAt": new Date(),
          },
        },
        { new: true, runValidators: true }
      );
      if (!ticket) return res.status(404).json({ success: false, message: "Ticket note not found." });

      const populated = await populateTicket(SupportTicket.findById(ticket._id)).lean();
      return res.json({ success: true, data: populated, message: "Ticket note updated." });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  deleteNote: async (req, res) => {
    try {
      const ticket = await SupportTicket.findOneAndUpdate(
        { _id: req.params.id, "noteEntries._id": req.params.noteId },
        { $pull: { noteEntries: { _id: req.params.noteId } } },
        { new: true }
      );
      if (!ticket) return res.status(404).json({ success: false, message: "Ticket note not found." });

      const populated = await populateTicket(SupportTicket.findById(ticket._id)).lean();
      return res.json({ success: true, data: populated, message: "Ticket note deleted." });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  assignTicket: async (req, res) => {
    try {
      const { assignedTo } = req.body || {};
      if (!assignedTo) {
        return res.status(400).json({ success: false, message: "Assignee is required." });
      }

      const assignee = await User.findOne({ _id: assignedTo, role: "employee" })
        .select("_id fullName email username profile.photo")
        .lean();
      if (!assignee) {
        return res.status(400).json({ success: false, message: "Assignee must be an internal employee." });
      }

      const ticket = await SupportTicket.findByIdAndUpdate(
        req.params.id,
        { assignedTo: assignee._id, status: "in_progress" },
        { new: true }
      );
      if (!ticket) return res.status(404).json({ success: false, message: "Ticket not found." });

      const populated = await populateTicket(SupportTicket.findById(ticket._id)).lean();
      await safeSendEmail({
        to: assignee.email,
        subject: `Tipsyverse Support - Assigned ${ticketLabel(populated)}`,
        title: `Assigned Support Ticket ${ticketLabel(populated)}`,
        html: assignmentEmail(populated, assignee),
      });
      await notifyUser({
        type: "support_ticket_assigned",
        ticket: populated,
        actor: req.user,
        recipientId: assignee._id,
        slug: `admin/operations?ticket=${populated._id}`,
        messageBase: "assigned you a support ticket",
      });

      return res.json({ success: true, data: populated, message: "Ticket assigned." });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  updateMyTicket: async (req, res) => {
    try {
      const ticket = await SupportTicket.findById(req.params.id);
      if (!ticket) return res.status(404).json({ success: false, message: "Ticket not found." });
      if (String(ticket.submittedBy) !== String(req.user.id)) {
        return res.status(403).json({ success: false, message: "Not authorized." });
      }
      if (ticket.status !== "open") {
        return res.status(400).json({ success: false, message: "Only open tickets can be edited." });
      }

      const description = String(req.body?.description || "").trim();
      if (!description) {
        return res.status(400).json({ success: false, message: "Description is required." });
      }
      if (description.length > MAX_TICKET_DESCRIPTION_LENGTH) {
        return res.status(400).json({
          success: false,
          message: `Description must be ${MAX_TICKET_DESCRIPTION_LENGTH} characters or fewer.`,
        });
      }
      ticket.description = description;
      if (req.body?.attachments !== undefined) {
        ticket.attachments = cleanAttachments(req.body.attachments, req.user.id);
      }
      await ticket.save();

      const populated = await populateTicket(SupportTicket.findById(ticket._id)).lean();
      return res.json({ success: true, data: populated, message: "Ticket description updated." });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  cancelMyTicket: async (req, res) => {
    try {
      const ticket = await SupportTicket.findById(req.params.id);
      if (!ticket) return res.status(404).json({ success: false, message: "Ticket not found." });
      if (String(ticket.submittedBy) !== String(req.user.id)) {
        return res.status(403).json({ success: false, message: "Not authorized." });
      }
      if (["resolved", "closed", "canceled"].includes(ticket.status)) {
        return res.status(400).json({ success: false, message: "This ticket cannot be canceled." });
      }

      ticket.status = "canceled";
      ticket.canceledAt = new Date();
      ticket.canceledBy = req.user.id;
      await ticket.save();

      const populated = await populateTicket(SupportTicket.findById(ticket._id)).lean();
      if (populated.assignedTo?._id) {
        await notifyUser({
          type: "support_ticket_canceled",
          ticket: populated,
          actor: req.user,
          recipientId: populated.assignedTo._id,
          slug: `admin/operations?ticket=${populated._id}`,
          messageBase: "canceled a support ticket assigned to you",
        });
      }

      return res.json({ success: true, data: populated, message: "Ticket canceled." });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  reopenMyTicket: async (req, res) => {
    try {
      const ticket = await SupportTicket.findById(req.params.id);
      if (!ticket) return res.status(404).json({ success: false, message: "Ticket not found." });
      if (String(ticket.submittedBy) !== String(req.user.id)) {
        return res.status(403).json({ success: false, message: "Not authorized." });
      }
      if (ticket.status !== "resolved") {
        return res.status(400).json({ success: false, message: "Only resolved tickets can be sent back." });
      }

      ticket.status = "open";
      ticket.reopenedAt = new Date();
      ticket.reopenedBy = req.user.id;
      await ticket.save();

      const populated = await populateTicket(SupportTicket.findById(ticket._id)).lean();
      if (populated.assignedTo?._id) {
        await notifyUser({
          type: "support_ticket_reopened",
          ticket: populated,
          actor: req.user,
          recipientId: populated.assignedTo._id,
          slug: `admin/operations?ticket=${populated._id}`,
          messageBase: "sent a resolved support ticket back for more help",
        });
      }

      return res.json({ success: true, data: populated, message: "Ticket sent back to support." });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  addMessage: async (req, res) => {
    try {
      const message = String(req.body?.message || "").trim();
      if (!message) return res.status(400).json({ success: false, message: "Message is required." });
      if (message.length > MAX_TICKET_MESSAGE_LENGTH) {
        return res.status(400).json({
          success: false,
          message: `Message must be ${MAX_TICKET_MESSAGE_LENGTH} characters or fewer.`,
        });
      }

      const existing = await populateTicket(SupportTicket.findById(req.params.id)).lean();
      if (!existing) return res.status(404).json({ success: false, message: "Ticket not found." });
      const isSubmitter = String(existing.submittedBy?._id || existing.submittedBy) === String(req.user.id);
      if (!isEmployee(req.user) && !isSubmitter) {
        return res.status(403).json({ success: false, message: "Not authorized." });
      }
      if (req.body?.internal && !isEmployee(req.user)) {
        return res.status(403).json({ success: false, message: "Only employees can add internal comments." });
      }

      const shouldReturnToInProgress =
        (isSubmitter || !isEmployee(req.user)) &&
        !req.body?.internal &&
        !["closed", "canceled"].includes(existing.status);
      const messageUpdate = {
          $push: {
            messages: {
              author: req.user.id,
              message,
              internal: isEmployee(req.user) && !!req.body?.internal,
              parentMessage: req.body?.parentMessage || null,
              attachments: cleanAttachments(req.body?.attachments, req.user.id),
            },
          },
        };

      if (shouldReturnToInProgress) {
        messageUpdate.$set = {
          status: "in_progress",
          reopenedAt: new Date(),
          reopenedBy: req.user.id,
        };
      }

      const ticket = await SupportTicket.findByIdAndUpdate(
        req.params.id,
        messageUpdate,
        { new: true }
      );
      if (!ticket) return res.status(404).json({ success: false, message: "Ticket not found." });

      if (isEmployee(req.user) && req.body?.internal) {
        const mentionedEmployees = await resolveMentionedEmployees({
          message,
          mentionUsers: req.body?.mentionUsers,
        });
        await Promise.all(
          mentionedEmployees
            .filter((employee) => String(employee._id) !== String(req.user.id))
            .map((employee) =>
              notifyUser({
                type: "support_ticket_mention",
                ticket,
                actor: req.user,
                recipientId: employee._id,
                slug: `admin/operations?ticket=${ticket._id}`,
                messageBase: "mentioned you in an internal support note",
              })
            )
        );
      }

      if (!req.body?.internal) {
        const populatedForNotify = await populateTicket(SupportTicket.findById(ticket._id)).lean();
        const employeeAuthor = isEmployee(req.user);
        const recipient = employeeAuthor
          ? populatedForNotify.submittedBy
          : populatedForNotify.assignedTo;

        if (recipient?._id) {
          await notifyUser({
            type: employeeAuthor ? "support_ticket_reopened" : "support_ticket_assigned",
            ticket: populatedForNotify,
            actor: req.user,
            recipientId: recipient._id,
            slug: employeeAuthor
              ? `settings/support?ticket=${populatedForNotify._id}`
              : `admin/operations?ticket=${populatedForNotify._id}`,
            messageBase: employeeAuthor
              ? "replied to your support ticket"
              : "replied to a support ticket assigned to you",
          });
          await safeSendEmail({
            to: recipient.email,
            subject: `Tipsyverse Support - New message on ${ticketLabel(populatedForNotify)}`,
            title: `New Message: ${ticketLabel(populatedForNotify)}`,
            html: ticketMessageEmail({
              ticket: populatedForNotify,
              message,
              recipientRole: employeeAuthor ? "customer" : "employee",
            }),
          });
        }
      }

      const populated = await populateTicket(SupportTicket.findById(ticket._id)).lean();
      return res.json({ success: true, data: populated, message: "Message added." });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  uploadImages: async (req, res) => {
    try {
      const files = Array.isArray(req.files) ? req.files : [];
      if (!files.length) {
        return res.status(400).json({ success: false, message: "No image files provided." });
      }

      const uploaded = await uploadFilesToCloudinary(files, req.user.id);
      return res.status(200).json({
        success: true,
        data: uploaded,
        message: `${uploaded.length} image${uploaded.length === 1 ? "" : "s"} uploaded.`,
      });
    } catch (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
  },

  deleteTicket: async (req, res) => {
    try {
      const ticket = await SupportTicket.findByIdAndDelete(req.params.id);
      if (!ticket) return res.status(404).json({ success: false, message: "Ticket not found." });
      return res.json({ success: true, message: "Ticket deleted." });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },
};

export default supportTicketCtrl;
