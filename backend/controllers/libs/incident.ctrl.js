import {
  AssignmentModel as Assignment,
  EventModel as Event,
  IncidentModel as Incident,
} from "../../models/index.js";
import { sendEmail } from "../../utils/index.js";

const isEmployee = (user) => ["admin", "employee"].includes(user?.role);

const escapeHtml = (value = "") =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const incidentResolutionEmail = (incident) => `
  <p>Hi ${escapeHtml(incident.reportedBy?.fullName || "there")},</p>
  <p>Thank you for informing us about this issue.</p>
  <p>The incident reported for event <strong>${escapeHtml(
    incident.event?.shortCode || "your event"
  )}</strong> has been resolved.</p>
  <p><strong>Our resolution:</strong></p>
  <p>${escapeHtml(incident.resolution).replaceAll("\n", "<br/>")}</p>
  <p>Thank you for helping us maintain a safe and professional experience.</p>
`;

const incidentReceivedEmail = (incident) => `
  <p>Hi ${escapeHtml(incident.reportedBy?.fullName || "there")},</p>
  <p>We received your incident report${incident.event?.shortCode ? ` for event <strong>${escapeHtml(incident.event.shortCode)}</strong>` : ""}.</p>
  <p>Thank you for taking the time to document what happened. Our team will review the report and get back to you as soon as we can.</p>
  <p>If there are any urgent safety concerns or new details, please contact Tipsyverse right away so we can respond appropriately.</p>
`;

const populateIncident = (query) =>
  query
    .populate("event", "shortCode type startAt endAt location contact")
    .populate(
      "reportedBy",
      "fullName email username phone phoneNumber profile.phone profile.photo employeeDetails.phones bartenderProfile.contactInfo.phone"
    )
    .populate("assignment", "bartenderUser status");

const incidentCtrl = {
  createIncident: async (req, res) => {
    try {
      const userId = req.user?.id || req.user?._id;
      const {
        event,
        assignment,
        type,
        severity,
        occurredAt,
        description,
        witnesses,
        actionTaken,
      } = req.body || {};

      if (!type || !description?.trim()) {
        return res.status(400).json({
          success: false,
          message: "Incident type and description are required.",
        });
      }

      let eventId = event || null;
      if (assignment) {
        const foundAssignment = await Assignment.findById(assignment).lean();
        if (!foundAssignment) {
          return res.status(404).json({ success: false, message: "Assignment not found." });
        }
        if (!isEmployee(req.user) && String(foundAssignment.bartenderUser) !== String(userId)) {
          return res.status(403).json({ success: false, message: "You cannot report for this assignment." });
        }
        eventId = foundAssignment.event;
      }

      const incident = await Incident.create({
        event: eventId,
        assignment: assignment || null,
        reportedBy: userId,
        type,
        severity,
        occurredAt,
        description: description.trim(),
        witnesses,
        actionTaken,
      });

      const populatedIncident = await populateIncident(
        Incident.findById(incident._id)
      ).lean();

      if (populatedIncident?.reportedBy?.email) {
        const emailResult = await sendEmail({
          to: populatedIncident.reportedBy.email,
          subject: `Tipsyverse - We received your incident report${populatedIncident.event?.shortCode ? ` for ${populatedIncident.event.shortCode}` : ""}`,
          title: "Incident Report Received",
          html: incidentReceivedEmail(populatedIncident),
        });
        if (!emailResult?.success) {
          console.error("Incident received email failed:", incident._id);
        }
      }

      return res.status(201).json({
        success: true,
        data: populatedIncident || incident,
        message: "Incident report submitted.",
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  viewIncidents: async (req, res) => {
    try {
      const { status, event, type } = req.query;
      const match = {};
      if (status) match.status = status;
      if (event) match.event = event;
      if (type) match.type = type;

      if (!isEmployee(req.user)) {
        match.reportedBy = req.user.id;
      }

      const incidents = await populateIncident(Incident.find(match))
        .sort({ createdAt: -1 })
        .lean();

      return res.json({ success: true, data: incidents });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  viewIncidentById: async (req, res) => {
    try {
      const incident = await populateIncident(Incident.findById(req.params.id))
        .populate("notes.author", "fullName username")
        .lean();

      if (!incident) {
        return res.status(404).json({ success: false, message: "Incident not found." });
      }
      if (!isEmployee(req.user) && String(incident.reportedBy?._id || incident.reportedBy) !== String(req.user.id)) {
        return res.status(403).json({ success: false, message: "Not authorized." });
      }

      return res.json({ success: true, data: incident });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  updateIncident: async (req, res) => {
    try {
      const allowed = ["status", "severity", "resolution", "description", "witnesses", "actionTaken"];
      const patch = {};
      allowed.forEach((key) => {
        if (req.body[key] !== undefined) patch[key] = req.body[key];
      });

      if (patch.status === "resolved" && !String(patch.resolution || "").trim()) {
        return res.status(400).json({
          success: false,
          message: "A resolution is required when resolving an incident.",
        });
      }

      const before = await Incident.findById(req.params.id).select("status").lean();
      if (!before) {
        return res.status(404).json({ success: false, message: "Incident not found." });
      }

      const incident = await populateIncident(
        Incident.findByIdAndUpdate(req.params.id, patch, {
          new: true,
          runValidators: true,
        })
      ).lean();

      if (patch.status === "resolved" && before.status !== "resolved") {
        const emailResult = await sendEmail({
          to: incident.reportedBy?.email,
          subject: `Tipsyverse - Incident ${incident.event?.shortCode || "Report"} Resolved`,
          title: "Incident Resolution",
          html: incidentResolutionEmail(incident),
        });
        if (!emailResult?.success) {
          console.error("Incident resolution email failed:", incident._id);
        }
      }

      return res.json({ success: true, data: incident, message: "Incident updated." });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  addIncidentNote: async (req, res) => {
    try {
      const body = String(req.body?.body || "").trim();
      if (!body) return res.status(400).json({ success: false, message: "Note is required." });

      const incident = await Incident.findByIdAndUpdate(
        req.params.id,
        { $push: { notes: { author: req.user.id, body } } },
        { new: true }
      );
      if (!incident) {
        return res.status(404).json({ success: false, message: "Incident not found." });
      }
      return res.json({ success: true, data: incident, message: "Note added." });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  deleteIncident: async (req, res) => {
    try {
      const incident = await Incident.findByIdAndDelete(req.params.id);
      if (!incident) {
        return res.status(404).json({ success: false, message: "Incident not found." });
      }
      return res.json({ success: true, message: "Incident deleted." });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },
};

export default incidentCtrl;
