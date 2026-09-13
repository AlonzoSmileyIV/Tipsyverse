import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: [
      "like",
      "comment",
      "reply",
      "follow",
      "mention",
      "admin-portal",
      "system",
      "moderation",
      "event_ready_to_assign",
      "event_bartenders_selected",
      "event_assigned",
      "event_assignment_removed",
      "event_reassign",
      "event_reassign_urgent",
      "event_updated",
      "event_canceled",
      "event_completed",
      "event_reviewed",
      "event_reminder",
      "support_ticket_assigned",
      "support_ticket_canceled",
      "support_ticket_resolved",
      "support_ticket_reopened",
      "support_ticket_mention",
      "bartender_profile_approved"
    ],
  },
  entity: {
  type: mongoose.Schema.Types.ObjectId,
  refPath: "entityModel",
  required: true,
},
  entityModel: {
  type: String,
  required: true,
  enum: ["User", "Drink", "Comment", "Event", "SupportTicket"], // Add other models as needed
},
  grouped: { type: Boolean, default: false },
  actors: [
    {
     actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    actDateTime: { type: Date, required: true },
    },
  ],
  totalCount: { type: Number, default: 1 },
  message: { type: String, required: true },
  timestamp: { type: Date, required: true },
  recipients: [
    {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    read: { type: Boolean, default: false },
    readDateTime: { type: Date, default: null },
  }
  ],
  slug: { type: String, required: true },
  comment: {
  type: mongoose.Schema.Types.ObjectId,
  ref: "Comment",
},
}, {
  timestamps: true,
});

notificationSchema.virtual("id").get(function () {
  return this._id.toHexString();
});

notificationSchema.set("toJSON", {
  virtuals: true,
});

notificationSchema.index({ "recipients.recipient": 1 });
notificationSchema.index({ "recipients.recipient": 1, "recipients.read": 1 });
notificationSchema.index({ "recipients.recipient": 1, createdAt: -1 });

const NotificationModel = mongoose.model("Notification", notificationSchema);

export default NotificationModel;
