import cron from "node-cron";
import {
  AssignmentModel as Assignment,
  EventModel as Event,
} from "../../models/index.js";
import { sendEmail, sendNotification } from "../../utils/index.js";

const TZ = "America/Indiana/Indianapolis";

const appUrl = () =>
  process.env.PUBLIC_APP_URL || process.env.FRONTEND_URL || "http://localhost:3000";

const bartenderScheduleLink = () =>
  `${appUrl().replace(/\/$/, "")}/bartend/schedule`;

const eventLink = (evt, path = "review") =>
  `${appUrl().replace(/\/$/, "")}/my-events/${evt._id}/${path}`;

async function sendClockInReminders() {
  const now = new Date();
  const in5m = new Date(now.getTime() + 5 * 60 * 1000);
  const activeStatuses = { $nin: ["completed", "closed", "canceled"] };

  const events = await Event.find({
    status: activeStatuses,
    startAt: { $lte: in5m },
    endAt: { $gte: now },
    $or: [
      { bartender5mReminderSentAt: null },
      { customer5mReminderSentAt: null },
    ],
  }).lean();

  for (const evt of events) {
    const assignments = await Assignment.find({
      event: evt._id,
      status: "active",
    })
      .populate("bartenderUser", "fullName email")
      .lean();

    const bartenders = assignments
      .map((assignment) => assignment.bartenderUser)
      .filter(Boolean);

    if (!evt.bartender5mReminderSentAt && bartenders.length) {
      const clockInUrl = bartenderScheduleLink();
      await Promise.all(
        bartenders
          .filter((bartender) => bartender.email)
          .map((bartender) =>
            sendEmail?.({
              to: bartender.email,
              subject: `Tipsyverse clock-in reminder - ${evt.shortCode}`,
              title: "Time To Clock In",
              html: `
                <p>Your event is starting soon or already in progress. Please clock in when you arrive.</p>
                <p><a href="${clockInUrl}" style="display:inline-block;background:#800020;color:#fff;padding:10px 14px;border-radius:6px;text-decoration:none;">Clock In</a></p>
              `,
            })
          )
      );

      await sendNotification?.({
        type: "event_reminder",
        entity: evt._id,
        entityId: evt._id,
        entityModel: "Event",
        recipients: bartenders.map((bartender) => ({ id: bartender._id })),
        slug: "bartend/schedule",
        messageBase: `Clock-in reminder for event ${evt.shortCode}`,
      });

      await Event.findByIdAndUpdate(evt._id, {
        bartender5mReminderSentAt: now,
      });
    }

    if (!evt.customer5mReminderSentAt && evt.contact?.email) {
      const verifyUrl = eventLink(evt, "review");
      await sendEmail?.({
        to: evt.contact.email,
        subject: `Tipsyverse attendance reminder - ${evt.shortCode}`,
        title: "Bartender Attendance Verification",
        html: `
          <p>Your event is starting soon or already in progress. Once bartenders arrive, you can verify who is present.</p>
          <p><a href="${verifyUrl}" style="display:inline-block;background:#800020;color:#fff;padding:10px 14px;border-radius:6px;text-decoration:none;">Verify Attendance</a></p>
        `,
      });

      if (evt.organizer) {
        await sendNotification?.({
          type: "event_reminder",
          entity: evt._id,
          entityId: evt._id,
          entityModel: "Event",
          recipients: [{ id: evt.organizer }],
          slug: `my-events/${evt._id}/review`,
          messageBase: `Verify bartender attendance for event ${evt.shortCode}`,
        });
      }

      await Event.findByIdAndUpdate(evt._id, {
        customer5mReminderSentAt: now,
      });
    }
  }

  if (events.length) {
    console.log(`Clock-in reminders processed for ${events.length} event(s).`);
  }
}

async function sendClockOutReminders() {
  const now = new Date();
  const in5m = new Date(now.getTime() + 5 * 60 * 1000);
  const activeStatuses = { $nin: ["completed", "closed", "canceled"] };

  const events = await Event.find({
    status: activeStatuses,
    endAt: { $gt: now, $lte: in5m },
    bartenderClockOut5mReminderSentAt: null,
  }).lean();

  for (const evt of events) {
    const assignments = await Assignment.find({
      event: evt._id,
      status: "active",
    })
      .populate("bartenderUser", "fullName email")
      .lean();

    const bartenders = assignments
      .map((assignment) => assignment.bartenderUser)
      .filter(Boolean);

    if (!bartenders.length) continue;

    const clockOutUrl = bartenderScheduleLink();
    await Promise.all(
      bartenders
        .filter((bartender) => bartender.email)
        .map((bartender) =>
          sendEmail?.({
            to: bartender.email,
            subject: `Tipsyverse clock-out reminder - ${evt.shortCode}`,
            title: "Time To Clock Out",
            html: `
              <p>Your event is ending shortly. Please clock out when your shift is complete.</p>
              <p><a href="${clockOutUrl}" style="display:inline-block;background:#800020;color:#fff;padding:10px 14px;border-radius:6px;text-decoration:none;">Clock Out</a></p>
            `,
          })
        )
    );

    await sendNotification?.({
      type: "event_reminder",
      entity: evt._id,
      entityId: evt._id,
      entityModel: "Event",
      recipients: bartenders.map((bartender) => ({ id: bartender._id })),
      slug: "bartend/schedule",
      messageBase: `Clock-out reminder for event ${evt.shortCode}`,
    });

    await Event.findByIdAndUpdate(evt._id, {
      bartenderClockOut5mReminderSentAt: now,
    });
  }

  if (events.length) {
    console.log(`Clock-out reminders processed for ${events.length} event(s).`);
  }
}

const minuteEventClockInReminderJob = () => {
  cron.schedule(
    "* * * * *",
    async () => {
      try {
        await sendClockInReminders();
        await sendClockOutReminders();
      } catch (err) {
        console.error("Clock-in/out reminder job failed:", err);
      }
    },
    { timezone: TZ }
  );
};

export default minuteEventClockInReminderJob;
