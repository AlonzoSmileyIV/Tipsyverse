// controllers/activityLogCtrl.js
import mongoose from "mongoose";
import {
  ActivityLogModel as ActivityLog,
  UserModel as User,
  LiquorModel as Liquor,
  MixerModel as Mixer,
  GlassModel as Glass,
  HierarchyModel as Hierarchy,
  DepartmentModel as Department,
  PositionModel as Position, // 👈 used to resolve position names
  DrinkModel as Drink,
  CourseModel as Course

} from "../../models/index.js";

// Map the query's entityModel -> actual Mongoose model.
// (Only allow models you're comfortable exposing through this endpoint.)
const modelMap = { User, Liquor, Mixer, Glass, Hierarchy, Department, Position, Drink, Course };

/** Utility: quick check for ObjectId-looking values (string or ObjectId). */
const isObjectIdish = (v) =>
  !!v && (mongoose.isValidObjectId(v) || (typeof v === "object" && v._id && mongoose.isValidObjectId(v._id)));

/** Utility: normalize to string id (handles ObjectId and {_id}). */
const toIdString = (v) => {
  if (!v) return null;
  if (typeof v === "string") return v;
  if (v instanceof mongoose.Types.ObjectId) return v.toString();
  if (typeof v === "object" && v._id) return String(v._id);
  return null;
};

/** Which change paths should be treated as "position id" and resolved to a name? */
const isPositionPath = (path = "") =>
  path === "employeeDetails.position" ||
  path.endsWith(".position"); // flexible: also matches e.g. "some.nested.position"

const activityLogCtrl = {
  getActivityLogForEntity: async (req, res) => {
    const {
      entityModel,
      entityId,
      page = 1,
      limit = -1,              // can be 'all' | 0 | -1 to fetch everything
      sort = "desc",
      start,
      end,
      selectActor = "fullName email profile.photo",
    } = req.query;

    try {
      // 1) Validate inputs
      if (!entityModel || !entityId) {
        return res.status(400).json({ success: false, message: "entityModel and entityId are required" });
      }
      const Model = modelMap[entityModel];
      if (!Model) return res.status(400).json({ success: false, message: `Unsupported entityModel: ${entityModel}` });
      if (!mongoose.isValidObjectId(entityId)) {
        return res.status(400).json({ success: false, message: "Invalid entityId" });
      }

      // 2) Verify target exists
      const exists = await Model.findById(entityId).select("_id");
      if (!exists) return res.status(404).json({ success: false, message: `${entityModel} not found` });

      // 3) Filter
      const filter = {
        "target.model": entityModel,
        "target.id": new mongoose.Types.ObjectId(entityId),
        summary: { $not: /^\s*Issued access token via refresh token\s*$/i },
      };
      if (start || end) {
        filter.actionDate = {};
        if (start) filter.actionDate.$gte = new Date(start);
        if (end)   filter.actionDate.$lte = new Date(end);
      }

      // 4) Sorting (default desc)
      const sortSpec = {
        actionDate: sort === "asc" ? 1 : -1,
        createdAt:  sort === "asc" ? 1 : -1,
      };

      // 5) Paging switch — allow all
      const wantAll =
        String(limit).toLowerCase() === "all" ||
        Number(limit) === 0 ||
        Number(limit) === -1;

      // Optional safety cap (remove if you truly want no cap)
      const ABSOLUTE_MAX = 50000;

      const total = await ActivityLog.countDocuments(filter);

      let query = ActivityLog.find(filter)
        .sort(sortSpec)
        .populate({ path: "actor.id", select: selectActor })
        .select("summary action reason actor actionDate createdAt changes target")
        .lean();

      if (!wantAll) {
        const pageNum  = Math.max(Number(page)  || 1, 1);
        const limitNum = Math.min(Math.max(Number(limit) || 10, 1), 100);
        const skip     = (pageNum - 1) * limitNum;
        query = query.skip(skip).limit(limitNum);

        const data = await query;

        // Resolve position ids (page only)
        const positionIds = new Set();
        for (const row of data) {
          const changes = Array.isArray(row?.changes) ? row.changes : [];
          for (const c of changes) {
            if (!isPositionPath(c?.path)) continue;
            if (isObjectIdish(c?.from)) positionIds.add(toIdString(c.from));
            if (isObjectIdish(c?.to))   positionIds.add(toIdString(c.to));
          }
        }
        let positionNameById = new Map();
        if (positionIds.size > 0) {
          const posDocs = await Position.find({ _id: { $in: [...positionIds] } }).select("_id name").lean();
          positionNameById = new Map(posDocs.map((p) => [String(p._id), p.name]));
        }
        const idToName = (val) => {
          const id = toIdString(val);
          if (!id) return val;
          return positionNameById.get(id) ?? id;
        };

        const rows = data.map((d) => {
          const changes = Array.isArray(d?.changes) ? d.changes : [];
          const mappedChanges = changes.map((c) => {
            if (!isPositionPath(c?.path)) return c;
            return {
              ...c,
              from: isObjectIdish(c?.from) ? idToName(c.from) : c?.from,
              to:   isObjectIdish(c?.to)   ? idToName(c.to)   : c?.to,
            };
          });
          return { ...d, changes: mappedChanges, when: d.actionDate || d.createdAt || null };
        });

        return res.json({
          success: true,
          data: rows,
          meta: { mode: "paged", page: pageNum, limit: limitNum, total },
        });
      }

      // --- wantAll mode ---
      // Hard cap to protect memory if desired:
      if (total > ABSOLUTE_MAX) {
        return res.status(413).json({
          success: false,
          message: `Result set too large (${total}). Narrow your date range or paginate.`,
          total,
          cap: ABSOLUTE_MAX,
        });
      }

      const data = await query; // no skip/limit

      // Resolve position ids for ALL rows
      const positionIds = new Set();
      for (const row of data) {
        const changes = Array.isArray(row?.changes) ? row.changes : [];
        for (const c of changes) {
          if (!isPositionPath(c?.path)) continue;
          if (isObjectIdish(c?.from)) positionIds.add(toIdString(c.from));
          if (isObjectIdish(c?.to))   positionIds.add(toIdString(c.to));
        }
      }
      let positionNameById = new Map();
      if (positionIds.size > 0) {
        const posDocs = await Position.find({ _id: { $in: [...positionIds] } }).select("_id name").lean();
        positionNameById = new Map(posDocs.map((p) => [String(p._id), p.name]));
      }
      const idToName = (val) => {
        const id = toIdString(val);
        if (!id) return val;
        return positionNameById.get(id) ?? id;
      };

      const rows = data.map((d) => {
        const changes = Array.isArray(d?.changes) ? d.changes : [];
        const mappedChanges = changes.map((c) => {
          if (!isPositionPath(c?.path)) return c;
          return {
            ...c,
            from: isObjectIdish(c?.from) ? idToName(c.from) : c?.from,
            to:   isObjectIdish(c?.to)   ? idToName(c.to)   : c?.to,
          };
        });
        return { ...d, changes: mappedChanges, when: d.actionDate || d.createdAt || null };
      });

      return res.json({
        success: true,
        data: rows,
        meta: { mode: "all", total, returned: rows.length, sort: "desc" },
      });
    } catch (error) {
      console.error("getActivityLogForEntity error:", error);
      return res.status(500).json({ success: false, message: error?.message || "Failed to fetch activity logs" });
    }
  },
};


export default activityLogCtrl;
