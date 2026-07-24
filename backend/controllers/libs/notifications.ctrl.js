import { NotificationModel as Notification } from "../../models/index.js";

const notificationCtrl = {
  findNotificationsByUserId: async (req, res) => {
    try {
      const userId = req.user.id;

      const notifications = await Notification.find({
        recipients: {
          $elemMatch: {
            recipient: userId,
          },
        },
      })
        .sort({ timestamp: -1 })
        .populate({
          path: "actors.actor",
          select: "fullName profile.photo",
        })
        .populate({
          path: "entity",
          select: "-__v", // Exclude version field
        })
        .populate({
          path: "comment",
          select: "content author createdAt",
          populate: {
            path: "author",
            select: "fullName profile.photo",
          },
        })
        .populate({
          path: "recipients.recipient", // ✅ populate the user who received it
          select: "fullName profile.photo",
        })
        .lean();

      return res.status(200).json({ success: true, data: notifications });
    } catch (error) {
      console.error("🔴 Error fetching notifications:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to get notifications",
        error: error.message,
      });
    }
  },
  findNotificationById: async (req, res) => {
    try {
      const userId = req.user.id;
      const { id } = req.params;

      const notification = await Notification.findOne({
        _id: id,
        recipients: {
          $elemMatch: {
            recipient: userId,
            recipientType: "User",
          },
        },
      })
        .populate({
          path: "actors.actor",
          select: "fullName profile.photo", // You can add `profile._id` or other fields if needed
        })
        .lean();

      if (!notification) {
        return res
          .status(404)
          .json({ success: false, message: "Notification not found" });
      }

      res.status(200).json({ success: true, data: notification });
    } catch (error) {
      res
        .status(500)
        .json({ success: false, message: "Failed to get notification", error });
    }
  },

  toggleMarkAllAsReadOrUnread: async (req, res) => {
    try {
      const userId = req.user.id;
      const { read } = req.body; // expects: { read: true } or { read: false }

      if (typeof read !== "boolean") {
        return res.status(400).json({
          success: false,
          message: "Missing or invalid 'read' boolean.",
        });
      }

      const result = await Notification.updateMany(
        {
          "recipients.recipient": userId,
          "recipients.read": { $ne: read },
        },
        {
          $set: {
            "recipients.$[elem].read": read,
            "recipients.$[elem].readDateTime": read ? new Date() : null,
          },
        },
        {
          arrayFilters: [
            {
              "elem.recipient": userId,
              "elem.read": { $ne: read },
            },
          ],
        }
      );

      const action = read ? "read" : "unread";
      res.status(200).json({
        success: true,
        message: `All notifications marked as ${action}.`,
        result,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Failed to toggle all read/unread status.",
        error,
      });
    }
  },
  toggleReadStatus: async (req, res) => {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      const { read } = req.body;

      const notification = await Notification.findOneAndUpdate(
        {
          _id: id,
          "recipients.recipient": userId,
        },
        {
          $set: {
            "recipients.$.read": read,
            "recipients.$.readDateTime": read ? new Date() : null,
          },
        },
        { new: true }
      ).lean();

      if (!notification) {
        return res
          .status(404)
          .json({ success: false, message: "Notification not found" });
      }

      res.status(200).json({ success: true, notification });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Failed to update read status",
        error,
      });
    }
  },

  deleteAllNotificationsForUser: async (req, res) => {
    try {
      const userId = req.user.id;

      // Pull the user from all recipient arrays
      const result = await Notification.updateMany(
        { "recipients.recipient": userId },
        {
          $pull: {
            recipients: {
              recipient: userId,
            },
          },
        }
      );

      // Clean up: remove notifications that now have no recipients
      await Notification.deleteMany({ recipients: { $size: 0 } });

      res.status(200).json({
        success: true,
        message: "All your notifications have been deleted.",
        result,
      });
    } catch (error) {
      console.error("🔴 Error deleting all notifications:", error);
      res.status(500).json({
        success: false,
        message: "Failed to delete all notifications",
        error,
      });
    }
  },
  deleteNotificationForUser: async (req, res) => {
    try {
      const userId = req.user.id;
      const { id } = req.params;

      const updated = await Notification.findByIdAndUpdate(
        id,
        {
          $pull: {
            recipients: {
              recipient: userId,
            },
          },
        },
        { new: true }
      );

      if (!updated) {
        return res
          .status(404)
          .json({ success: false, message: "Notification not found" });
      }

      // If no recipients remain, delete the notification entirely
      if (updated.recipients.length === 0) {
        await Notification.findByIdAndDelete(id);
      }

      res.status(200).json({ success: true });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Failed to delete notification",
        error,
      });
    }
  },
};

export default notificationCtrl;
