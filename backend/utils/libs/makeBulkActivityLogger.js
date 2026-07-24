// utils/activityRowLogger.js
const mapTypeToAction = (t) =>
  t === "delete" ? "delete" : t === "edit" ? "update" : "create";

/**
 * Creates two loggers:
 *  - logRow: call after each successful row (add/edit/delete)
 *  - logBatch: call once at the end for the batch summary (your existing call)
 *
 * Keeps the same shape as your current req.logActivity payload.
 */
export function makeBulkActivityLogger({ req, reqUser, type, entityModel }) {
  const action = mapTypeToAction(type);

  const positionDoc = reqUser?.employeeDetails?.position;

  const actor = {
    type: "User",
    id: req.user.id,
    label: {
      fullName: reqUser.fullName,
      email: reqUser.email,
      role: reqUser.role,
      position: {
        id: positionDoc?._id || null,
        name: positionDoc?.name || "N/A",
      },
    },
  };

  // Base meta reused everywhere
  const baseMeta = {
    fileName: req.file?.originalname,
    mimetype: req.file?.mimetype,
  };

  // Per-row success (target = mutated doc id)
  const logRow = async ({
    targetId,
    label, // e.g., "Jane Doe (jane@x.com)" or "Margarita"
    rowNum, // Excel row number
    extraMeta = {}, // any row details
    reason=null,
    changes = []

  }) => {
    try {
      await req.logActivity({
        action, // derived from type: add->create, edit->update, delete->delete
        target: { model: entityModel, id: targetId },
        actor,
        summary: `Bulk ${type} ${entityModel.toLowerCase()}${label ? ` "${label}"` : ""}`,
        reason: reason,
        changes,
        meta: {
          ...baseMeta,
          rowNum,
          ...extraMeta,
        },
      });
    } catch (e) {
      console.warn("Per-row activity log failed:", e?.message);
    }
  };

  // Batch summary (your existing shape)
  const logBatch = async ({
    counts, // { add, edit, delete }
    errorsCount,
    suggestions = [],
    errorsList, // optional string[] if you want to include lines
  }) => {
    try {
      await req.logActivity({
        action,
        target: { model: "User", id: req.user.id }, // keep your existing target convention
        actor,
        summary: `Bulk ${type} ${entityModel.toLowerCase()}s via upload`,
        reason: null,
        meta: {
          counts,
          errorsCount,
          suggestions,
          ...baseMeta,
          ...(errorsList ? { errorsList } : {}),
        },
      });
    } catch (e) {
      console.warn("Batch activity log failed:", e?.message);
    }
  };

  return { logRow, logBatch };
}
