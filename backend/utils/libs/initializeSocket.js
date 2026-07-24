// utils/initializeSocket.js
import { NotificationModel as Notification } from "../../models/index.js";
import { setSocketIO } from "./socketHub.js";

export default function initializeSocket(io) {
  setSocketIO(io);

  io.on("connection", (socket) => {
    // Client should call this right after connect
    socket.on("register", (userId) => {
      const room = String(userId);
      socket.join(room);
      // console.log(`joined room ${room} (socket ${socket.id})`);
    });

    // Optional, but nice on logout
    socket.on("unregister", (userId) => {
      const room = String(userId);
      socket.leave(room);
    });

    // Mark-all read/unread — use arrayFilters so we update the correct recipient
    socket.on("notifications:updateAllReadStatus", async ({ userId, read }) => {
      try {
        await Notification.updateMany(
          { "recipients.recipient": userId },
          {
            $set: {
              "recipients.$[r].read": read,
              "recipients.$[r].readDateTime": new Date(),
            },
          },
          { arrayFilters: [{ "r.recipient": userId }] }
        );

        io.to(String(userId)).emit("notifications:bulkReadUpdated", { read });
      } catch (err) {
        console.error("❌ Failed to update notification read status:", err);
      }
    });

    socket.on("disconnect", () => {
      // no map cleanup needed; leaving rooms is automatic on disconnect
    });
  });
}
