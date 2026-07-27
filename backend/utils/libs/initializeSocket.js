// utils/initializeSocket.js
import { NotificationModel as Notification } from "../../models/index.js";
import { setSocketIO } from "./socketHub.js";
import jwt from "jsonwebtoken";
import { UserModel as User } from "../../models/index.js";

export default function initializeSocket(io) {
  setSocketIO(io);

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error("Authentication required."));
      const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
      const user = await User.findById(decoded.id).select("accountStatus role").lean();
      if (!user || user.accountStatus?.state !== "Active") {
        return next(new Error("Account is not active."));
      }
      socket.data.userId = String(user._id);
      socket.data.role = user.role;
      return next();
    } catch {
      return next(new Error("Invalid or expired access token."));
    }
  });

  io.on("connection", (socket) => {
    const userId = socket.data.userId;
    socket.join(userId);

    socket.on("notifications:updateAllReadStatus", async ({ read }) => {
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
      // Socket.IO automatically leaves all rooms.
    });
  });
}
