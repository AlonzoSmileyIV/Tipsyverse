import {
  AssignmentModel as Assignment,
  AttendanceModel as Attendance,
  EventModel as Event,
} from "../../models/index.js";

const isEmployee = (user) => ["admin", "employee"].includes(user?.role);

const parseOptionalDate = (value) => {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid attendance time.");
  }
  return date;
};

const findMyAssignment = async (assignmentId, userId) =>
  Assignment.findOne({ _id: assignmentId, bartenderUser: userId, status: "active" }).lean();

const canVerifyEventAttendance = (event, user) => {
  if (isEmployee(user)) return true;
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

const getAttendanceWindowError = (event, user) => {
  if (isEmployee(user)) return "";
  const now = Date.now();
  const start = event?.startAt ? new Date(event.startAt).getTime() : null;
  const end = event?.endAt ? new Date(event.endAt).getTime() : null;
  if (!start) return "Attendance verification is not open for this event.";
  if (now < start - 5 * 60 * 1000) {
    return "Attendance verification opens 5 minutes before the event starts.";
  }
  if (end && now > end + 24 * 60 * 60 * 1000) {
    return "Attendance verification is closed for this event.";
  }
  return "";
};

const attendanceCtrl = {
  clockIn: async (req, res) => {
    try {
      const assignment = await findMyAssignment(req.params.assignmentId, req.user.id);
      if (!assignment) {
        return res.status(404).json({ success: false, message: "Active assignment not found." });
      }

      const attendance = await Attendance.findOneAndUpdate(
        { assignment: assignment._id },
        {
          $setOnInsert: {
            event: assignment.event,
            assignment: assignment._id,
            bartenderUser: assignment.bartenderUser,
          },
          $set: {
            status: "clocked_in",
            clockInAt: new Date(),
            clockInNote: req.body?.note || "",
          },
        },
        { new: true, upsert: true }
      );

      return res.json({ success: true, data: attendance, message: "Clocked in." });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  clockOut: async (req, res) => {
    try {
      const assignment = await findMyAssignment(req.params.assignmentId, req.user.id);
      if (!assignment) {
        return res.status(404).json({ success: false, message: "Active assignment not found." });
      }

      const attendance = await Attendance.findOneAndUpdate(
        { assignment: assignment._id },
        {
          $setOnInsert: {
            event: assignment.event,
            assignment: assignment._id,
            bartenderUser: assignment.bartenderUser,
            clockInAt: new Date(),
          },
          $set: {
            status: "clocked_out",
            clockOutAt: new Date(),
            clockOutNote: req.body?.note || "",
          },
        },
        { new: true, upsert: true }
      );

      return res.json({ success: true, data: attendance, message: "Clocked out." });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  verifyAttendance: async (req, res) => {
    try {
      const { status, notes, clockInAt, clockOutAt } = req.body || {};
      const attendance = await Attendance.findById(req.params.id);
      if (!attendance) {
        return res.status(404).json({ success: false, message: "Attendance record not found." });
      }

      const event = await Event.findById(attendance.event)
        .select("organizer contact startAt endAt")
        .lean();
      if (!canVerifyEventAttendance(event, req.user)) {
        return res.status(403).json({ success: false, message: "Only the event contact or staff can verify attendance." });
      }
      const windowError = getAttendanceWindowError(event, req.user);
      if (windowError) {
        return res.status(400).json({ success: false, message: windowError });
      }

      attendance.contactVerification = {
        verifiedBy: req.user.id,
        status,
        notes,
        verifiedAt: new Date(),
      };
      const nextClockInAt = parseOptionalDate(clockInAt);
      const nextClockOutAt = parseOptionalDate(clockOutAt);
      if (nextClockInAt !== undefined) attendance.clockInAt = nextClockInAt;
      if (nextClockOutAt !== undefined) attendance.clockOutAt = nextClockOutAt;
      attendance.status = status === "disputed" ? "disputed" : "verified";
      await attendance.save();

      return res.json({ success: true, data: attendance, message: "Attendance verified." });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  verifyAssignmentAttendance: async (req, res) => {
    try {
      const { status, notes, clockInAt, clockOutAt } = req.body || {};
      const assignment = await Assignment.findById(req.params.assignmentId).lean();
      if (!assignment || assignment.status !== "active") {
        return res.status(404).json({ success: false, message: "Active assignment not found." });
      }

      const event = await Event.findById(assignment.event)
        .select("organizer contact startAt endAt")
        .lean();
      if (!canVerifyEventAttendance(event, req.user)) {
        return res.status(403).json({ success: false, message: "Only the event contact or staff can verify attendance." });
      }
      const windowError = getAttendanceWindowError(event, req.user);
      if (windowError) {
        return res.status(400).json({ success: false, message: windowError });
      }

      const nextClockInAt = parseOptionalDate(clockInAt);
      const nextClockOutAt = parseOptionalDate(clockOutAt);
      const set = {
        status: status === "disputed" ? "disputed" : "verified",
        contactVerification: {
          verifiedBy: req.user.id,
          status,
          notes,
          verifiedAt: new Date(),
        },
      };

      if (nextClockInAt !== undefined) set.clockInAt = nextClockInAt;
      if (nextClockOutAt !== undefined) set.clockOutAt = nextClockOutAt;

      const attendance = await Attendance.findOneAndUpdate(
        { assignment: assignment._id },
        {
          $setOnInsert: {
            event: assignment.event,
            assignment: assignment._id,
            bartenderUser: assignment.bartenderUser,
          },
          $set: set,
        },
        { new: true, upsert: true }
      )
        .populate("event", "shortCode type startAt endAt contact")
        .populate("assignment", "status")
        .populate("bartenderUser", "fullName email username profile.photo")
        .populate("contactVerification.verifiedBy", "fullName email username");

      return res.json({ success: true, data: attendance, message: "Attendance verified." });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  viewAttendance: async (req, res) => {
    try {
      const { event, status } = req.query;
      const match = {};
      if (event) match.event = event;
      if (status) match.status = status;
      if (!isEmployee(req.user)) {
        if (event) {
          const foundEvent = await Event.findById(event)
            .select("organizer contact")
            .lean();
          if (!canVerifyEventAttendance(foundEvent, req.user)) {
            match.bartenderUser = req.user.id;
          }
        } else {
          match.bartenderUser = req.user.id;
        }
      }

      const records = await Attendance.find(match)
        .populate("event", "shortCode type startAt endAt contact")
        .populate("assignment", "status")
        .populate("bartenderUser", "fullName email username profile.photo")
        .populate("contactVerification.verifiedBy", "fullName email username")
        .sort({ updatedAt: -1 })
        .lean();

      return res.json({ success: true, data: records });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  deleteAttendance: async (req, res) => {
    try {
      const record = await Attendance.findByIdAndDelete(req.params.id);
      if (!record) {
        return res.status(404).json({ success: false, message: "Attendance record not found." });
      }
      return res.json({ success: true, message: "Attendance record deleted." });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },
};

export default attendanceCtrl;
