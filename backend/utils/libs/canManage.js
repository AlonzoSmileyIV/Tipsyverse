// utils/permissions.js
export const HIERARCHY_ORDER = [
  "Owner",
  "Board Director",
  "Chief Executive Officer",
  "Executive",
  "Vice President",
  "Director",
  "Manager",
  "Supervisor",
  "Team Leader",
  "Employee",
  "Contractor",
  "Intern",
];

const idxMap = new Map(HIERARCHY_ORDER.map((n, i) => [n, i]));

const getHierarchyName = (u) =>
  u?.employeeDetails?.position?.hierarchy?.name || null;

const getIndex = (name) =>
  name != null && idxMap.has(name) ? idxMap.get(name) : -1;

const isDirectReportOf = (actor, targetId) => {
  const drs = actor?.employeeDetails?.directReports || [];
  return drs.some((id) => id.toString() === targetId.toString());
};

// Detect “status” changes coming from a bulk row
export const rowHasStatusChange = (row) => {
  const hasStatus = !!row["Status"];
  const absentRaw = row["Is Absent"];
  const hasAbsent =
    typeof absentRaw !== "undefined" &&
    String(absentRaw).trim() !== "" &&
    ["true", "t", "yes", "y"].includes(String(absentRaw).trim().toLowerCase());
  const hasTerminationReason =
    typeof row["Termination Reason"] !== "undefined" &&
    String(row["Termination Reason"]).trim() !== "";

  return hasStatus || hasAbsent || hasTerminationReason;
};

/**
 * canManage
 * Decide if `actor` can perform `action` (add | edit | delete) on a user at
 * hierarchy `targetHierarchyName`. When target exists, pass targetId, too.
 * When adding a new user (no target yet), provide reportToEmail and actorEmail
 * for 1-level-below validation (must report to actor).
 *
 * Returns { ok: boolean, reason?: string }
 */
export const canManage = ({
  actor,
  action, // 'add' | 'edit' | 'delete'
  targetHierarchyName,
  targetId = null,
  isStatusChange = false,
  reportToEmail = null,
  actorEmail = null,
}) => {
  if (!actor) return { ok: false, reason: "No actor" };

  // Nobody can delete themselves
  if (action === "delete" && targetId && targetId.toString() === actor._id.toString()) {
    return { ok: false, reason: "You cannot delete yourself." };
  }

  // Nobody can change their own status
  if (action === "edit" && isStatusChange && targetId && targetId.toString() === actor._id.toString()) {
    return { ok: false, reason: "You cannot change your own status." };
  }

  if (actor.role === "admin") return { ok: true };

  const actorName = getHierarchyName(actor);
  const actorIdx = getIndex(actorName);
  if (actorIdx === -1) return { ok: false, reason: "Actor hierarchy missing" };

  // Team Leader and below cannot add/edit/delete anyone
  const teamLeaderIdx = getIndex("Team Leader");
  if (actorIdx >= teamLeaderIdx) {
    return { ok: false, reason: "Insufficient permission for this action." };
  }

  // Owner can manage anyone (except the two self-guards handled above)
  if (actorName === "Owner") {
    return { ok: true };
  }

  // Non-owners need target hierarchy to be below them
  const targetIdx = getIndex(targetHierarchyName);
  if (targetIdx === -1) return { ok: false, reason: "Target hierarchy missing" };

  // 2+ levels below → allowed
  const diff = targetIdx - actorIdx;
  if (diff >= 2) return { ok: true };

  // 1 level below → must be a direct report of the actor
  if (diff === 1) {
    // If we are ADDING a brand-new employee: enforce reportToEmail === actorEmail
    if (!targetId) {
      if (
        reportToEmail &&
        actorEmail &&
        reportToEmail.trim().toLowerCase() === actorEmail.trim().toLowerCase()
      ) {
        return { ok: true };
      }
      return {
        ok: false,
        reason: "New hires one level below must report to you.",
      };
    }

    // If target exists (edit/delete), require direct report
    return isDirectReportOf(actor, targetId)
      ? { ok: true }
      : { ok: false, reason: "User is not your direct report." };
  }

  // same level or higher → not allowed
  return { ok: false, reason: "Target is not below your level." };
};

// Extra guard for Owner record constraints
export const validateOwnerReportTo = ({ targetPositionName, reportToEmail }) => {
  if (String(targetPositionName || "").toLowerCase() === "owner") {
    if (reportToEmail && reportToEmail.trim() !== "") {
      return { ok: false, reason: "Owner cannot have a manager (reportTo must be empty)." };
    }
  }
  return { ok: true };
};

export const idxOf = (name) => HIERARCHY_ORDER.indexOf(String(name || ""));
