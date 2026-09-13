import cron from "node-cron";
import { EventModel as Event } from "../../models/index.js";
import { sendEmail } from "../../utils/index.js";

const checkCompletedEvents = async () => {
  try {
    const now = new Date(); // UTC

    const endedEvents = await Event.find({
      status: { $in: ["confirmed"] },
      endAt: { $lte: now },
      completionEmailSentAt: null,
    }).limit(200);

    let processed = 0;

    for (const event of endedEvents) {
      const updated = await Event.updateOne(
        { _id: event._id, completionEmailSentAt: null },
        {
          $set: {
            status: "completed",
            completedAt: now,
            completionEmailSentAt: now,
          },
        }
      );

      if (!updated.modifiedCount) continue;

      const recipient = event.contact.email;
       

      if (recipient) {
        await sendEmail({
          to: recipient,
          subject: `Event ${event.shortCode} Completed — Please review your bartender(s)`,
          title: `Event ${event.shortCode} Completed`,
          html: `
            <p>Your event has been successfully <b>completed</b>.</p>
            <p>Thank you for choosing Tipsyverse for your event.</p>
            <p>
            Your feedback helps us recognize outstanding bartenders and continue delivering
            high-quality experiences for our community.
            </p>
            <p>The review only takes a minute and helps future guests make confident decisions.</p>
            <p style="margin-top:16px;">
            <a
                href="${process.env.PUBLIC_APP_URL}/my-events"
                class="button"
                "
            >
                Leave a Bartender Review
            </a>
            </p>
            <p style="margin-top:20px;">
            If you have any questions or feedback about your experience, we’re here to help.
            </p>
            <p>— The Tipsyverse Team 🍸</p>
          `,
        });
      }

      processed++;
    }

    console.log(`✅ Completion pass done. Processed: ${processed}`);
  } catch (err) {
    console.error("❌ Error during event completed check:", err.message);
    console.error(err);
  }
};

const tenMinuteCheckCompletedEventsJob = () => {
  return cron.schedule("*/10 * * * *", async () => {
    console.log(`⏱️ 10 minute event complete check job triggered.`);
    await checkCompletedEvents();
  });
};

export default tenMinuteCheckCompletedEventsJob;
