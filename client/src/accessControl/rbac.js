// RBAC helpers you can reuse across components
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

// Lowest rank allowed to investigate *any* user's comment (even non-employees)
const MIN_INVESTIGATE_RANK = "Supervisor";

// Ranks that can never investigate anyone
const NON_INVESTIGATORS = ["Team Leader", "Employee", "Contractor", "Intern"];

/**
 * Normalize "target" which could be:
 * - a User object
 * - a Comment object with { author: User | userId }
 */
const getTargetAuthorAndDetails = (target) => {
  // If it's a comment, prefer the populated author object, else id
  if (target && target.content !== undefined && target.author !== undefined) {
    const author = typeof target.author === "object" ? target.author : { _id: target.author };
    return { author };
  }
  // Otherwise assume it's a user
  return { author: target };
}


const ORDER_MAP = Object.fromEntries(
  HIERARCHY_ORDER.map((n,i) => [n.toLowerCase(), i])
);

const getHierarchyName = (actor) =>
  actor?.employeeDetails?.position?.hierarchy?.name ?? ""; // adjust if your data differs

const idx = (name) => ORDER_MAP[String(name).trim().toLowerCase()] ?? -1;

// --- TOP-LEVEL ACTIONS -------------------------------------------------------
export const canSeeAddButton = (actor) => {
  const i = idx(getHierarchyName(actor));
  // Only ABOVE Team Leader can add (Owner..Supervisor)
  return i > -1 && i < idx("Team Leader");
};

export const filterPositionsForAdd = (actor, positions = []) => {
  const actorLevel = getHierarchyName(actor);
  const aIdx = idx(actorLevel);

  return positions.filter((p) => {
    const tLevel = p?.hierarchy?.name;
    const tIdx = idx(tLevel);
    if (aIdx === -1 || tIdx === -1) return false;

    // only Owner can create Owner
    if (p?.name === "Owner" && actorLevel !== "Owner") return false;

    // Owner can create anything
    if (actorLevel === "Owner") return true;

    // non-Owner can only create strictly-below positions
    return tIdx > aIdx;
  });
};

// When adding & a position is selected, define how "Reports To" should behave.
export const reportToConstraints = (actor, selectedPosition) => {
  const actorLevel = getHierarchyName(actor);
  const aIdx = idx(actorLevel);

  const tLevel = selectedPosition?.hierarchy?.name || null;
  const tIdx = idx(tLevel);

  if (!selectedPosition || aIdx === -1 || tIdx === -1) {
    return { lock: false, requiredReportToId: null, ownerNoManager: false, helper: null };
  }

  if (selectedPosition.name === "Owner") {
    return {
      lock: true,
      requiredReportToId: null,
      ownerNoManager: true,
      helper: "Owners cannot have a manager.",
    };
  }

  const diff = tIdx - aIdx;

  if (actorLevel !== "Owner" && diff === 1) {
    return {
      lock: true,
      requiredReportToId: actor?._id ?? null,
      ownerNoManager: false,
      helper: "Hires one level below must report to you.",
    };
  }

  return { lock: false, requiredReportToId: null, ownerNoManager: false, helper: null };
};

// Your existing rule (kept here so everything lives in one place)
export const canEditUser = (actor, target) => {
  if (!actor || !target) return false;

  const actorDetails = actor.employeeDetails;
  const targetDetails = target.employeeDetails;

  if (
    !actorDetails ||
    !targetDetails ||
    !actorDetails.position ||
    !targetDetails.position ||
    !actorDetails.position.hierarchy ||
    !targetDetails.position.hierarchy
  ) {
    return false;
  }

  if(actor._id === target._id) return true;

  const actorHierarchyName = actorDetails.position.hierarchy.name;
  const targetHierarchyName = targetDetails.position.hierarchy.name;

  const actorIndex = idx(actorHierarchyName);
  const targetIndex = idx(targetHierarchyName);
  if (actorIndex === -1 || targetIndex === -1) return false;

  if (actorHierarchyName === "Owner") return true;

  const lowestEditors = ["Team Leader", "Employee", "Contractor", "Intern"];
  if (lowestEditors.includes(actorHierarchyName)) return false;

  if (targetIndex <= actorIndex) return false;

  const levelDiff = targetIndex - actorIndex;
  if (levelDiff >= 2) return true;

  const directReports = actorDetails.directReports || [];
  return directReports.some((id) => id.toString() === target._id.toString());
};

// Delete shares the same ladder constraints, plus “no self-delete” and “no Owner unless actor is Owner”
export const canDeleteUser = (actor, target) => {
  if (!actor || !target) return false;
  if (String(actor._id) === String(target._id)) return false; // no self-delete

  const actorLevel = getHierarchyName(actor);
  const targetLevel = getHierarchyName(target);

  const aIdx = idx(actorLevel);
  const tIdx = idx(targetLevel);
  if (aIdx === -1 || tIdx === -1) return false;

  if (target.employeeDetails?.position?.name === "Owner") {
    return actorLevel === "Owner"; // only Owner can delete Owner (still not self)
  }

  if (actorLevel === "Owner") return true;

  if (tIdx <= aIdx) return false;

  const diff = tIdx - aIdx;
  if (diff >= 2) return true;

  const dr = actor.employeeDetails?.directReports || [];
  return dr.some((id) => String(id) === String(target._id));
};

// Can investigate the reported Comment
export const canInvestigateComment = (actor, target) => {
  if (!actor || !target) return false;

  const { author: targetAuthor } = getTargetAuthorAndDetails(target);
  if (!targetAuthor?._id) return false;

  // 2) Cannot investigate your own comment
  if (actor._id.toString() === targetAuthor._id.toString()) return false;

  const actorHierarchyName = getHierarchyName(actor);
  const actorIndex = idx(actorHierarchyName);
  if (actorIndex === -1) return false; // actor must be an employee with a known hierarchy

  // 3) Owner can investigate anyone (except self already handled)
  if (actorHierarchyName === "Owner") return true;

  // 4) Team Leader and below cannot investigate
  if (NON_INVESTIGATORS.includes(actorHierarchyName)) return false;

  // If target is a non-employee (e.g., regular user)
  const targetHierarchyName = getHierarchyName(targetAuthor);
  const targetIndex = idx(targetHierarchyName);
  const targetIsEmployee = targetIndex !== -1;

  if (!targetIsEmployee) {
    // 5) Allow if actor rank >= MIN_INVESTIGATE_RANK
    const minIdx = idx(MIN_INVESTIGATE_RANK);
    return actorIndex <= minIdx && minIdx !== -1;
  }

  // 6) Both employees → enforce relative hierarchy
  // Actor must be strictly above target
  if (targetIndex <= actorIndex) return false;

  const levelDiff = targetIndex - actorIndex;
  if (levelDiff >= 2) return true;

  // If exactly 1 level below → must be a direct report
  const directReports = actor?.employeeDetails?.directReports || [];
  return directReports.some((id) => id.toString() === targetAuthor._id.toString());
};

/**
 * Rules:
 * - Owner: can assign any **non-Owner** position.
 * - Team Leader & below: cannot add/edit anyone.
 * - Others:
 *   - Can assign positions 2+ levels below freely.
 *   - If exactly 1 level below, only allowed when:
 *     - EDIT: the target is their direct report.
 *     - ADD: the new hire’s reportTo is the actor.
 * - No assigning "Owner" via UI.
 */
export const canAssignPosition = ({
  actor,
  mode,                 // 'add' | 'edit'
  employee,              // existing employee when editing; null when adding
  position,              // position object from positionsData
  selectedReportToId,    // formData.reportTo (when adding)
}) => {
  if (!actor || !position) return false;

  const actorLevel = getHierarchyName(actor);
  const aI = idx(actorLevel);
  const posLevel = position?.hierarchy?.name;
  const pI = idx(posLevel);

  if (aI === -1 || pI === -1) return false;

  // never assign Owner from UI
  if (position.name === "Owner") return false;

  // team lead & below: no add/edit
  if (!canSeeAddButton(actor)) return false;

  // Owner can assign any non-owner position
  if (actorLevel === "Owner") return true;

  // must be below actor
  if (pI <= aI) return false;

  const diff = pI - aI;

  if (diff >= 2) return true;

  // diff === 1
  if (mode === "edit" && employee) {
    const dr = (actor?.employeeDetails?.directReports || []).map(String);
    return dr.includes(String(employee._id));
  }

  if (mode === "add") {
    return String(selectedReportToId || "") === String(actor._id);
  }

  return false;
};
