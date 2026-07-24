// services/activityLog.service.js
import mongoose from "mongoose";
import { ActivityLogModel as ActivityLog } from "../../models/index.js";

const DEFAULT_MAX_JSON = 32_000; // ~32 KB cap per blob to be safe
const REDACTED = "[redacted]";

const DEFAULT_REDACT_PATHS = new Set([
  "password", "passwordHash", "resetPasswordToken", "accessToken",
  "refreshToken", "secret", "apiKey", "authorization",
]);

function ensureObjectId(id) {
  if (!id) return id;
  return mongoose.isValidObjectId(id) ? new mongoose.Types.ObjectId(id) : id;
}

function capJsonSize(value, max = DEFAULT_MAX_JSON) {
  try {
    const s = JSON.stringify(value);
    if (s.length <= max) return value;
    // keep a hint of what it was
    return { _truncated: true, approxBytes: s.length, preview: s.slice(0, 1000) };
  } catch {
    return value;
  }
}

function redactChanges(changes = [], extraRedactPaths = []) {
  const set = new Set([...DEFAULT_REDACT_PATHS, ...extraRedactPaths]);
  return (changes || []).map(ch => {
    const shouldRedact = set.has(ch.path) || [...set].some(p => ch.path?.includes(p));
    return shouldRedact ? { ...ch, from: REDACTED, to: REDACTED } : ch;
  });
}

/**
 * Create an activity log entry.
 *
 * @param {Object} params
 * @param {String} params.action - "create" | "update" | "delete" | ...
 * @param {Object} params.target - { model, id, slug?, name? }
 * @param {Object} [params.actor] - { type, id?, label? }  // label is a structured snapshot object
 * @param {Object} [params.actor.label] - { fullName?, email?, role?, position?: {id?, name?} }
 * @param {String} [params.summary]
 * @param {String} [params.reason]
 * @param {Object} [params.request] - { ip, userAgent, requestId, sessionId, source }
 * @param {Array}  [params.changes] - [{ path, from, to }]
 * @param {*}      [params.prevSnapshot]
 * @param {*}      [params.nextSnapshot]
 * @param {Object} [params.context]
 * @param {Array}  [params.notes]
 * @param {Object} [params.meta]
 * @param {Object} [opts]
 * @param {mongoose.ClientSession} [opts.session]
 * @param {Boolean} [opts.failSilently=false] - swallow errors instead of throwing
 * @param {String[]} [opts.redactPaths] - extra paths to redact in `changes`
 */
export async function logActivity(
  {
    action,
    target,
    actor,
    summary,
    reason,
    request,
    changes,
    prevSnapshot,
    nextSnapshot,
    context,
    notes,
    meta,
  },
  opts = {}
) {
  const { session, failSilently = false, redactPaths = [] } = opts;

  if (!action) return maybeThrow("logActivity: action is required", failSilently);
  if (!target?.model || !target?.id) {
    return maybeThrow("logActivity: target.model and target.id are required", failSilently);
  }

  // Enforce actor rules
  if (actor?.type === "User" && !actor?.id) {
    return maybeThrow("logActivity: actor.id is required when actor.type is 'User'", failSilently);
  }

  // Normalize/cap fields
  const doc = {
    action: String(action),
    target: {
      model: String(target.model),
      id: ensureObjectId(target.id),
      slug: target.slug,
      name: target.name,
    },
    actor: actor ? {
      type: actor.type || "User",
      id: ensureObjectId(actor.id),
      label: actor.label || undefined, // structured snapshot object
    } : { type: "System", label: { fullName: "System" } },
    summary: trimMaybe(summary, 500),
    reason: trimMaybe(reason, 2000),
    request,
    changes: redactChanges(changes, redactPaths),
    prevSnapshot: capJsonSize(prevSnapshot),
    nextSnapshot: capJsonSize(nextSnapshot),
    context,
    notes,
    meta: capJsonSize(meta),
  };

  try {
    return await ActivityLog.create([doc], { session }).then(r => r[0]);
  } catch (err) {
    if (failSilently) {
      // eslint-disable-next-line no-console
      console.warn("logActivity failed (silenced):", err.message);
      return null;
    }
    throw err;
  }
}

function trimMaybe(s, max) {
  if (typeof s !== "string") return s;
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

function maybeThrow(message, failSilently) {
  if (failSilently) {
    console.warn(message);
    return null;
  }
  throw new Error(message);
}
