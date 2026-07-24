import mongoose from "mongoose";
import {
  CommentModel as Comment,
  ActivityLogModel as ActivityLogs,
  UserModel as User,
  NotificationModel as Notification,
} from "../../models/index.js";
import { abbreviateNumber } from "./abbreviateNumber.js";
import { getSocketIO } from "./socketHub.js";
const { Types: { ObjectId } } = mongoose;

const WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // 7-day grouping window


const toOid = (v) => {
  if (!v) return null;
  // Accept ObjectId, doc with _id, string, or anything castable
  const raw = v._id ? v._id : v;
  try {
    return new ObjectId(String(raw));
  } catch {
    return null;
  }
};

// === UTIL ===
const getCommentSnippet = async (commentId, max = 120) => {
  const id = toOid(commentId);
  if (!id) return null;
  const c = await Comment.findById(id).select("content").lean();
  if (!c?.content) return null;
  const s = c.content.trim().replace(/\s+/g, " ");
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
};

const getActorDisplayNames = async (actors) => {
  const uniqueActorIds = [...new Set(actors.map((a) => a.actor.toString()))].slice(0, 3);
  const users = await User.find({ _id: { $in: uniqueActorIds } })
    .select("username fullName")
    .lean();
  const nameMap = new Map(
    users.map((u) => [u._id.toString(), u.username ? `@${u.username}` : u.fullName || "Someone"])
  );
  return uniqueActorIds.map((id) => nameMap.get(id) || "Someone");
};

const generateGroupedMessage = (names, baseMessage, quoted) => {
  const [first, second, ...rest] = names;
  const others = rest.length;
  const who =
    others > 0 ? `${first}, ${second} and ${abbreviateNumber(others)} other${others > 1 ? 's' : ''}` :
    second ? `${first} and ${second}` :
    first;
  return quoted ? `${who} ${baseMessage}: "${quoted}"` : `${who} ${baseMessage}`;
};

const sendNotification = async ({
  type,
  entityId,
  entity,        // may be doc or id
  entityModel,
  actor,         // { id }
  recipients = [],
  slug,
  messageBase,
  commentId,
  subjectText,
}) => {
  const io = getSocketIO();

  // Normalize all IDs
  const actorId = toOid(actor?.id);
  const entityOid = toOid(entityId ?? entity);     // <- ALWAYS an ObjectId now
  const commentOid = toOid(commentId);

  if (!entityOid) {
    // Avoid creating bad docs; log & bail early
    console.warn("[notify] Missing/invalid entity id for notification:", { type, entityId, entity });
    return;
  }

  // Get actor label early (only for freshly-created messages)
  let actorLabel = "";
  if (actorId) {
    const u = await User.findById(actorId).select("username fullName").lean();
    if (u) actorLabel = u.username ? `@${u.username}` : (u.fullName || "Someone");
  }

  const quoted = subjectText ?? (commentOid ? await getCommentSnippet(commentOid) : null);

  const socketTargets = new Set();

  for (const r of recipients) {
    const recipientOid = toOid(r?.id);
    if (!recipientOid) continue;

    // const sid = connectedUsers.get(recipientOid.toString());
    // if (sid) socketTargets.add(sid);

    const isGroupable = ["like", "reply", "mention"].includes(type);

    // Find existing group within window for the same recipient + entity (+ comment)
    const existing = isGroupable
      ? await Notification.findOne({
          type,
          entityModel,
          entity: entityOid,
          ...(commentOid && { comment: commentOid }),
          grouped: true,
          "recipients.recipient": recipientOid,
          createdAt: { $gte: new Date(Date.now() - WINDOW_MS) },
        })
      : null;

    if (existing) {
      // Add actor if not present
      let changed = false;
      if (actorId && !existing.actors.some(a => a.actor.toString() === actorId.toString())) {
        existing.actors.push({ actorType: "User", actor: actorId, actDateTime: new Date() });
        existing.totalCount = (existing.totalCount || 0) + 1;
        changed = true;
      }

      // Attach subject/comment preview once
      if (quoted && !existing.subjectText) {
        existing.subjectText = quoted;
        changed = true;
      }

      if (changed) {
        const names = await getActorDisplayNames(existing.actors);
        existing.message = generateGroupedMessage(names, messageBase, existing.subjectText);
      }

      // Ensure recipient presence
      if (!existing.recipients.some(rr => rr.recipient.toString() === recipientOid.toString())) {
        existing.recipients.push({ recipient: recipientOid, read: false });
      }

      await existing.save();

      if (io) {
        const populated = await Notification.findById(existing._id)
        .populate("actors.actor", "username fullName profile.photo")
        .populate("recipients.recipient", "username fullName profile.photo")
        .populate({ path: "entity", select: "-__v" })
        .populate("comment");

        // ✅ emit to the user's room (hits all of their tabs/sockets, and no cross-user leaks)
      io.to(recipientOid.toString()).emit("notifications:updated", {
        _id: populated._id,
        entity: populated.entity,
        message: populated.message,
        slug: populated.slug,
        type: populated.type,
        route: `${populated.slug}/${populated.entity?.slug || ""}`,
        actors: populated.actors || [],
        comment: populated.comment,
        subjectText: populated.subjectText,
        totalCount: populated.totalCount,
        ...populated,
      });
    }
    } else {
      // Create new notification
      const doc = await Notification.create({
        type,
        entity: entityOid,              // ✅ stored as ObjectId
        entityId: entityOid,
        entityModel,
        grouped: isGroupable,
        actors: actorId ? [{ actorType: "User", actor: actorId, actDateTime: new Date() }] : [],
        totalCount: actorId ? 1 : 0,
        message: quoted ? `${actorLabel} ${messageBase}: "${quoted}"`
                        : `${actorLabel} ${messageBase}`,
        subjectText: quoted || null,
        timestamp: new Date(),
        recipients: [{ recipient: recipientOid, read: false }],
        slug,
        ...(commentOid && { comment: commentOid }),
      });

      if (io) {
      const populated = await Notification.findById(doc._id)
        .populate("actors.actor", "username fullName profile.photo")
        .populate("recipients.recipient", "username fullName profile.photo")
        .populate({ path: "entity", select: "-__v" })
        .populate("comment");

      // ✅ emit to the user's room
      io.to(recipientOid.toString()).emit("notifications:new", {
        _id: populated._id,
        entity: populated.entity,
        message: populated.message,
        slug: populated.slug,
        type: populated.type,
        route: `${populated.slug}/${populated.entity?.slug || ""}`,
        actors: populated.actors || [],
        comment: populated.comment,
        subjectText: populated.subjectText,
        totalCount: populated.totalCount,
        sound: true,
        ...populated,
      });
    }
    }
  }
};

export default sendNotification;
