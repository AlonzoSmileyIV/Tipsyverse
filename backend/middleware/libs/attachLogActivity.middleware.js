// middleware/attachLogActivity.js
import { logActivity } from "../../utils/index.js";
import mongoose from "mongoose";

export function attachLogActivity(req, _res, next) {
  req.logActivity = async (payload = {}, opts = {}) => {
    const userId = req.user?.id || req.user?._id || null;

    const actorFromReq = userId
      ? {
          type: "User",
          id: ensureObjectId(userId),              // 👈 handle id/_id
          label: buildActorLabel(req.user),
        }
      : { type: "System", label: { fullName: "System" } };

    const merged = {
      ...payload,
      actor: payload.actor ?? actorFromReq,
      request: {
        ip: req.ip,
        userAgent: req.get?.("user-agent"),
        requestId: req.id,
        sessionId: req.sessionID,
        source: req.headers["x-client"] || "api",
        ...(payload.request || {}),
      },
    };

    return logActivity(merged, opts);
  };
  next();
}

function ensureObjectId(id) {
  if (!id) return id;
  return mongoose.isValidObjectId(id) ? new mongoose.Types.ObjectId(id) : id;
}

function buildActorLabel(user) {
  const pos = user?.employeeDetails?.position;
  return {
    fullName: user?.fullName || null,
    email: user?.email || null,
    role: user?.role || null,
    position: pos
      ? { id: pos._id || pos, name: pos.name || null }
      : null,
  };
}
