import mongoose from "mongoose";
import {
  CourseModel as Course,
  CourseProgressModel as CourseProgress,
} from "../../models/index.js";
import { formatSlug } from "../../utils/index.js";

/* -------------------------- helpers / snapshots -------------------------- */

const KNOWN_ROLES = new Set(["employee", "bartender", "regular", "admin"]); // keep in sync with model

function normalizeRoles (val) {
  return Array.isArray(val)
    ? [...new Set(
        val
          .map(r => String(r || "").trim().toLowerCase())
          .filter(r => KNOWN_ROLES.has(r))
      )]
    : [];
}

function courseSnapshot(c) {
  if (!c) return null;
  const sectionsArr = Array.isArray(c.modules)
    ? c.modules.flatMap((m) => m?.sections || [])
    : Array.isArray(c.sections)
      ? c.sections
      : [];

  return {
    title: c.title,
    description: c.description,
    status: c.status,
    requiredForRoles: c.requiredForRoles || [],
    restrictedTo: c.restrictedTo || [],
    quiz: {
      poolSize: c.quiz?.poolSize ?? 10,
      passingScorePct: c.quiz?.passingScorePct ?? 70,
    },
    stats: {
      sectionsCount: sectionsArr.length,
      questionPoolCount: sectionsArr.reduce(
        (sum, s) => sum + (s.quiz?.questions || []).length,
        0
      ),
    },
  };
}

function diffSnapshots(prev, next) {
  const changes = [];
  const keys = [
    "title",
    "description",
    "status",
    "requiredForRoles",
    "quiz.poolSize",
    "quiz.passingScorePct",
    "stats.sectionsCount",
    "stats.questionPoolCount",
  ];

  const get = (obj, path) =>
    path.split(".").reduce((a, k) => (a == null ? a : a[k]), obj);

  for (const path of keys) {
    const from = get(prev, path);
    const to = get(next, path);
    if (JSON.stringify(from) !== JSON.stringify(to)) {
      changes.push({ path, from, to });
    }
  }
  return changes;
}

function computeCounts(courseDoc) {
  const stored = {
    sectionsCount: courseDoc?.stats?.sectionsCount,
    questionPoolCount: courseDoc?.stats?.questionPoolCount,
  };
  if (
    Number.isFinite(stored.sectionsCount) &&
    Number.isFinite(stored.questionPoolCount)
  ) {
    return stored;
  }
  const sectionsArr = Array.isArray(courseDoc.modules)
    ? courseDoc.modules.flatMap((m) => m?.sections || [])
    : Array.isArray(courseDoc.sections)
      ? courseDoc.sections
      : [];
  const sectionsCount = sectionsArr.length;
  const questionPoolCount = sectionsArr.reduce(
    (sum, s) => sum + (s.quiz?.questions || []).length,
    0
  );
  return { sectionsCount, questionPoolCount };
}

function toNum(v, def) {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

function nextModuleOrder(mods = []) {
  if (!Array.isArray(mods) || mods.length === 0) return 0; // zero-based start
  let max = -1;
  for (let i = 0; i < mods.length; i++) {
    const n = Number.isFinite(mods[i]?.moduleOrder)
      ? Number(mods[i].moduleOrder)
      : i;
    if (n > max) max = n;
  }
  return max + 1;
}

function sanitizeModulePayload(
  input = {},
  {
    siblings = [], // other modules in the same course
    fallbackOrder = 0, // default order if none provided
    currentId = null, // pass when updating to avoid colliding with self
  } = {}
) {
  const title = String(input.title || "").trim();
  if (!title) throw new Error("Module title is required.");

  // base slug (use provided or derive from title)
  const baseSlug =
    (input.slug ? String(input.slug).trim() : formatSlug(title)) ||
    formatSlug(title);

  // build a set of taken slugs (case-insensitive), excluding the module being edited
  const taken = new Set(
    (siblings || [])
      .filter((m) => !currentId || String(m._id) !== String(currentId))
      .map((m) => String(m.slug || "").toLowerCase())
  );

  // ensure uniqueness within the course
  let slug = baseSlug;
  let i = 2;
  while (taken.has(slug.toLowerCase())) {
    slug = `${baseSlug}-${i++}`;
  }

  // normalize quiz settings (clamp sensible bounds)
  const poolSize = Math.max(0, toNum(input.quizInfo?.poolSize, 5));
  const passingScorePct = Math.max(
    0,
    Math.min(100, toNum(input.quizInfo?.passingScorePct, 70))
  );

  const payload = {
    title,
    slug,
    description: String(input.description || "").trim(),
    moduleOrder: toNum(input.moduleOrder ?? input.order, fallbackOrder),
    sections: Array.isArray(input.sections) ? input.sections : [],
    quizInfo: {
      poolSize,
      passingScorePct,
    },
  };

  return payload;
}

function ensureUniqueSlug(base, siblings = [], excludeId = null) {
  const taken = new Set(
    (siblings || [])
      .filter((m) => !excludeId || String(m._id) !== String(excludeId))
      .map((m) => String(m.slug || "").toLowerCase())
  );
  let slug = base || "module";
  let i = 2;
  while (taken.has(slug.toLowerCase())) slug = `${base}-${i++}`;
  return slug;
}

function moduleQuestionPoolCount(mod) {
  return (mod?.sections || []).reduce(
    (n, s) => n + (s?.quiz?.questions?.length || 0),
    0
  );
}

function renumberOrders(mods = [], oneBased = false) {
  return mods
    .slice()
    .sort((a, b) => (a.moduleOrder ?? 0) - (b.moduleOrder ?? 0))
    .map((m, i) => ({ ...m, moduleOrder: oneBased ? i + 1 : i }));
}

async function recomputeAndSaveCourse(course, userId, activity = null) {
  // refresh stats
  const counts = computeCounts(course);
  course.stats = {
    sectionsCount: counts.sectionsCount,
    questionPoolCount: counts.questionPoolCount,
  };

  // keep course quiz.poolSize valid after module edits/imports
  if (course.quiz && Number.isFinite(course.stats.questionPoolCount)) {
    const pool = Number(course.quiz.poolSize || 0);
    if (pool > course.stats.questionPoolCount) {
      course.quiz.poolSize = course.stats.questionPoolCount;
    }
    if (pool < 0) course.quiz.poolSize = 0;
  }
  course.updatedBy = userId;
  const saved = await course.save();

  if (activity) {
    const { summary, changes, prevSnapshot } = activity;
    const nextSnapshot = courseSnapshot(saved);
    await activity.req
      ?.logActivity?.({
        action: activity.action || "update",
        target: {
          model: "Course",
          id: saved._id,
          name: saved.title,
        },
        actor: activity.req.user
          ? {
              type: "User",
              id: activity.req.user.id,
              label: {
                fullName: activity.req.user.fullName,
                email: activity.req.user.email,
                role: activity.req.user.role,
              },
            }
          : undefined,
        summary,
        changes,
        prevSnapshot,
        nextSnapshot,
      })
      .catch((err) =>
        console.warn("[activity] modules op log failed:", err?.message)
      );
  }

  return saved;
}

/* -------------------------------- controller ----------------------------- */

const courseCtrl = {
  /* CREATE */
  createCourse: async (req, res) => {
    try {
      const {
        title,
        description,
        sections,
        modules,
        restrictedTo = [],
        requiredForRoles = [],
        sortOrder = 0,
        quiz, // { poolSize, passingScorePct }
        poolSize, // legacy support
        passingScorePct, // legacy support
        status = "published",
      } = req.body;

      // console.log(req.body);

      if (!title?.trim()) {
        return res
          .status(400)
          .json({ success: false, message: "Title cannot be empty." });
      }

      // unique by title (and optionally slug)
      const slug = formatSlug(title);
      const exists = await Course.findOne({ $or: [{ title }, { slug }] });
      if (exists) {
        return res.status(400).json({
          success: false,
          message: "A course with that title/slug already exists.",
        });
      }

      const bodyQuiz = {
        poolSize: quiz?.poolSize ?? poolSize ?? 5,
        passingScorePct: quiz?.passingScorePct ?? passingScorePct ?? 70,
      };

      const doc = new Course({
        title: title.trim(),
        slug,
        description: description || "",
        ...(Array.isArray(modules)
          ? { modules }
          : { sections: sections || [] }),
        quiz: bodyQuiz,
        status,
        restrictedTo: Array.isArray(restrictedTo) ? restrictedTo : [],
        requiredForRoles: normalizeRoles(requiredForRoles) ? requiredForRoles : [],
        sortOrder: Number(sortOrder) || 0,
        createdBy: req.user?.id,
        updatedBy: req.user?.id,
      });

      // compute stats AFTER we’ve set sections/modules
      const counts = computeCounts(doc);
      doc.stats = {
        sectionsCount: counts.sectionsCount,
        questionPoolCount: counts.questionPoolCount,
      };

      await doc.save();

      // activity
      const snap = courseSnapshot(doc);
      await req
        .logActivity?.({
          action: "create",
          target: { model: "Course", id: doc._id, name: doc.title },
          actor: req.user
            ? {
                type: "User",
                id: req.user.id,
                label: {
                  fullName: req.user.fullName,
                  email: req.user.email,
                  role: req.user.role,
                },
              }
            : undefined,
          summary: `Created course "${doc.title}"`,
          nextSnapshot: snap,
          changes: [
            { path: "title", from: undefined, to: doc.title },
            { path: "status", from: undefined, to: doc.status },
            { path: "quiz.poolSize", from: undefined, to: snap.quiz.poolSize },
            {
              path: "quiz.passingScorePct",
              from: undefined,
              to: snap.quiz.passingScorePct,
            },
            {
              path: "stats.sectionsCount",
              from: 0,
              to: snap.stats.sectionsCount,
            },
            {
              path: "stats.questionPoolCount",
              from: 0,
              to: snap.stats.questionPoolCount,
            },
          ],
        })
        .catch((err) =>
          console.warn("[activity] createCourse log failed:", err?.message)
        );

      return res.status(200).json({
        success: true,
        message: "Course has been created.",
        data: doc.toObject(),
      });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  },

  /* LIST / GRID */
  viewCourses: async (req, res) => {
    try {
      const {
        page = 1,
        limit = 10,
        q,
        status,
        restrictedTo, // optional filter: comma-separated
        requiredForRoles: reqRoles,
        sort = "-updatedAt",
        fields, // "title,slug,tags,updatedAt,modules.title,modules.order"
      } = req.query;

      const where = {};
      if (q) where.title = { $regex: String(q), $options: "i" };
      if (status) where.status = status;
      if (restrictedTo) {
        const arr = String(restrictedTo)
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        if (arr.length) where.restrictedTo = { $in: arr };
      }
      if (reqRoles) {
       const arr = String(reqRoles).split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
       if (arr.length) where.requiredForRoles = { $in: arr };
    }

      const skip = (Number(page) - 1) * Number(limit);

      // projection for light grids
      const projection =
        typeof fields === "string" && fields.trim().length
          ? fields
              .split(",")
              .map((f) => f.trim())
              .filter(Boolean)
              .join(" ")
          : undefined;

      const [items, total] = await Promise.all([
        Course.find(where, projection)
          .sort(sort)
          .skip(skip)
          .limit(Number(limit))
          .lean(),
        Course.countDocuments(where),
      ]);

      // enrich with section counts for the grid
      const rows = items.map((c) => {
        const { sectionsCount } = computeCounts(c);
        return { ...c, sectionsCount };
      });

      return res.status(200).json({
        success: true,
        data: rows,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit)),
        },
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  /* LIGHT OVERVIEW: counts + minimal metadata by id */
  viewCourseOverview: async (req, res) => {
    try {
      const id = req.params.id;
      if (!mongoose.isValidObjectId(id)) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid course id." });
      }
      const course = await Course.findById(id)
        .select(
          "title slug status restrictedTo requiredForRoles quiz updatedAt modules sections stats"
        )
        .lean();
      if (!course) {
        return res
          .status(404)
          .json({ success: false, message: "Course not found." });
      }
      const { sectionsCount, questionPoolCount } = computeCounts(course);
      return res.status(200).json({
        success: true,
        data: {
          ...course,
          sectionsCount,
          questionPoolCount,
        },
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  /* GET BY ID (full) */
  viewCourseById: async (req, res) => {
    try {
      const id = req.params.id;
      if (!mongoose.isValidObjectId(id)) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid course id." });
      }
      const course = await Course.findById(id).lean();
      if (!course) {
        return res
          .status(404)
          .json({ success: false, message: "Course not found." });
      }
      const { sectionsCount, questionPoolCount } = computeCounts(course);
      return res.status(200).json({
        success: true,
        data: { ...course, sectionsCount, questionPoolCount },
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  // GET COURSES REQUIRED BY THE ROLE
  // usage: GET /api/courses/required?role=bartender&includeProgress=1
  viewCoursesByRequiredRole : async (req, res) => {
  try {
    const role = String(req.query.role || "").trim().toLowerCase();
    if (!role) {
      return res.status(400).json({ success: false, message: "role is required" });
    }

    // optional knobs
    const status = req.query.status || "published";
    const includeProgress = String(req.query.includeProgress || "0") === "1";
    const fields = (req.query.fields || "title slug description stats updatedAt modules.title modules.moduleOrder")
      .split(",").map(s => s.trim()).filter(Boolean).join(" ");

    // base query
    const courses = await Course.find(
      { status, requiredForRoles: role },
      fields
    ).sort({ courseOrder: 1, updatedAt: -1 }).lean();

    if (!includeProgress || !req.user?.id) {
      return res.json({ success: true, data: courses });
    }

    // join user’s progress for checklist UI
    const ids = courses.map(c => c._id);
    const progress = await CourseProgress.find(
      { userId: req.user.id, courseId: { $in: ids } },
      { courseId: 1, status: 1, modulesCompleted: 1, totalModules: 1 }
    ).lean();

    const pMap = new Map(progress.map(p => [String(p.courseId), p]));
    const withProgress = courses.map(c => {
      const p = pMap.get(String(c._id));
      const done = Number(p?.modulesCompleted || 0);
      const total = Number(p?.totalModules || 0);
      const percent = total ? Math.round((done / total) * 100) : 0;
      return {
        ...c,
        progress: {
          status: p?.status || "not_started",
          modulesCompleted: done,
          totalModules: total,
          percent,
          completed: total > 0 && done >= total,
        },
      };
    });

    return res.json({ success: true, data: withProgress });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
},

  /* GET BY SLUG (full) */
  viewCourseBySlug: async (req, res) => {
    try {
      const slug = String(req.params.slug || "").trim();
      if (!slug) {
        return res
          .status(400)
          .json({ success: false, message: "Slug is required." });
      }

      const course = await Course.findOne({ slug }).lean();
      if (!course) {
        return res
          .status(404)
          .json({ success: false, message: "Course not found." });
      }

      const { sectionsCount, questionPoolCount } = computeCounts(course);

      return res.status(200).json({
        success: true,
        data: {
          ...course,
          sectionsCount,
          questionPoolCount,
        },
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  /* UPDATE */
  updateCourse: async (req, res) => {
    try {
      const { id } = req.params;
      const course = await Course.findById(id);
      if (!course) {
        return res
          .status(404)
          .json({ success: false, message: "Course not found." });
      }

      const { title, ...updateFields } = req.body;

      if (!title?.trim()) {
        return res
          .status(400)
          .json({ success: false, message: "Course title cannot be empty." });
      }

      // unique title/slug (exclude self)
      if (title !== course.title) {
        const newSlug = formatSlug(title);
        const nameExists = await Course.findOne({
          $or: [{ title }, { slug: newSlug }],
          _id: { $ne: id },
        });
        if (nameExists) {
          return res.status(400).json({
            success: false,
            message: "There is already a course with that title/slug.",
          });
        }
        course.title = title.trim();
        course.slug = newSlug;
      }

      const prevSnapshot = courseSnapshot(course);

      // apply other fields
      for (const [k, v] of Object.entries(updateFields)) {
        if (k === "quiz" && v && typeof v === "object") {
          course.quiz = {
            poolSize: v.poolSize ?? course.quiz?.poolSize ?? 5,
            passingScorePct:
              v.passingScorePct ?? course.quiz?.passingScorePct ?? 70,
          };
        } else if (k === "sections" && Array.isArray(v)) {
          course.sections = v;
          course.modules = undefined;
        } else if (k === "modules" && Array.isArray(v)) {
          course.modules = v;
          course.sections = undefined;
        } else if (k === "restrictedTo" && Array.isArray(v)) {
          course.restrictedTo = v;
        } else if (k === "requiredForRoles") {
         course.requiredForRoles = normalizeRoles(v);
        } else if (k === "sortOrder") {
          course.sortOrder = Number(v) || 0;
        } else {
          course[k] = v;
        }
      }

      // refresh stats
      const counts = computeCounts(course);
      course.stats = {
        sectionsCount: counts.sectionsCount,
        questionPoolCount: counts.questionPoolCount,
      };

      course.updatedBy = req.user?.id;

      const updated = await course.save();

      const nextSnapshot = courseSnapshot(updated);
      const changes = diffSnapshots(prevSnapshot, nextSnapshot);

      await req
        .logActivity?.({
          action: "update",
          target: { model: "Course", id: updated._id, name: updated.title },
          actor: req.user
            ? {
                type: "User",
                id: req.user.id,
                label: {
                  fullName: req.user.fullName,
                  email: req.user.email,
                  role: req.user.role,
                },
              }
            : undefined,
          summary: `Updated course "${updated.title}"`,
          changes,
          prevSnapshot,
          nextSnapshot,
        })
        .catch((err) =>
          console.warn("[activity] updateCourse log failed:", err?.message)
        );

      return res.status(200).json({
        success: true,
        message: "Course updated successfully.",
        data: updated.toObject(),
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  /* DELETE */
  deleteCourse: async (req, res) => {
    try {
      const { id } = req.params;
      const course = await Course.findById(id);

      if (!course) {
        return res
          .status(404)
          .json({ success: false, message: "Course not found." });
      }

      const prevSnapshot = courseSnapshot(course);
      await Course.findByIdAndDelete(id);

      await req
        .logActivity?.({
          action: "delete",
          target: { model: "Course", id: course._id, name: course.title },
          actor: req.user
            ? {
                type: "User",
                id: req.user.id,
                label: {
                  fullName: req.user.fullName,
                  email: req.user.email,
                  role: req.user.role,
                },
              }
            : undefined,
          summary: `Deleted course "${course.title}"`,
          prevSnapshot,
        })
        .catch((err) =>
          console.warn("[activity] deleteCourse log failed:", err?.message)
        );

      return res
        .status(200)
        .json({ success: true, message: "Course deleted successfully." });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  /* ------------------------------- MODULES -------------------------------- */

  // GET /courses/:courseId/modules
  listModules: async (req, res) => {
    try {
      const { courseId } = req.params;
      const course = await Course.findById(courseId)
        .select("title modules stats")
        .lean();
      if (!course) {
        return res
          .status(404)
          .json({ success: false, message: "Course not found." });
      }
      const modules = (course.modules || []).sort(
        (a, b) => (a.order ?? 0) - (b.order ?? 0)
      );
      return res.status(200).json({ success: true, data: modules });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  // GET /courses/:courseId/modules/:moduleId
  getModule: async (req, res) => {
    try {
      const { courseId, moduleId } = req.params;
      const course = await Course.findById(courseId).select("modules").lean();
      if (!course) {
        return res
          .status(404)
          .json({ success: false, message: "Course not found." });
      }
      const mod = (course.modules || []).find(
        (m) => String(m._id) === String(moduleId)
      );
      if (!mod) {
        return res
          .status(404)
          .json({ success: false, message: "Module not found." });
      }
      return res.status(200).json({ success: true, data: mod });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  // POST /courses/:courseId/modules
  addModule: async (req, res) => {
    try {
      const { courseId } = req.params;
      const course = await Course.findById(courseId);
      if (!course) {
        return res
          .status(404)
          .json({ success: false, message: "Course not found." });
      }

      const prevSnapshot = courseSnapshot(course);

      // ↓↓↓ compute max existing order, append after it
      const existing = Array.isArray(course.modules) ? course.modules : [];
      const nextOrder = nextModuleOrder(existing); // <<— here

      const payload = sanitizeModulePayload(req.body, {
        siblings: course.modules, // ensure unique per course
        fallbackOrder: nextOrder,
      });

      course.modules = existing;
      course.modules.push(payload);

      // then renumber if you want strictly 0..n-1
      course.modules = renumberOrders(course.modules);

      const saved = await recomputeAndSaveCourse(course, req.user?.id, {
        req,
        action: "update",
        summary: `Added module "${payload.title}"`,
        changes: [
          { path: "modules", from: undefined, to: "pushed new module" },
        ],
        prevSnapshot,
      });

      const added = saved.modules[saved.modules.length - 1]; // the module you just pushed
      const newModuleId = added._id; // ObjectId
      const newTotalModules = saved.modules.length;

      // Add this module into progress for all non-completed learners on the course.
      // - Avoid duplicates if this runs twice
      // - Lock by default; auto-unlock only if they had non-zero modules AND all were passed
      await CourseProgress.updateMany(
        { courseId, status: { $ne: "completed" } },
        [
          // Precompute some helpers
          {
            $set: {
              _moduleIds: {
                $map: { input: "$modules", as: "m", in: "$$m.moduleId" },
              },
              _prevCount: { $size: "$modules" },
              _prevPassed: {
                $size: {
                  $filter: {
                    input: "$modules",
                    as: "m",
                    cond: { $eq: ["$$m.passed", true] },
                  },
                },
              },
            },
          },
          {
            $set: {
              _hasNew: { $in: [newModuleId, "$_moduleIds"] },
              _unlockNew: {
                $and: [
                  { $gt: ["$_prevCount", 0] }, // had prior modules
                  { $eq: ["$_prevPassed", "$_prevCount"] }, // and all were passed
                ],
              },
            },
          },
          // Conditionally append the new module progress row
          {
            $set: {
              modules: {
                $cond: [
                  "$_hasNew",
                  "$modules",
                  {
                    $concatArrays: [
                      "$modules",
                      [
                        {
                          moduleId: newModuleId,
                          status: {
                            $cond: ["$_unlockNew", "in_progress", "locked"],
                          },
                          passed: false,
                          sections: [], // (optional) you can preseed section stubs if you want
                        },
                      ],
                    ],
                  },
                ],
              },
              totalModules: newTotalModules,
            },
          },
          // keep their overall status as-is (not completed); or force to "in_progress" if you prefer:
          // { $set: { status: "in_progress" } },

          // Clean up temps
          {
            $unset: [
              "_moduleIds",
              "_prevCount",
              "_prevPassed",
              "_hasNew",
              "_unlockNew",
            ],
          },
        ]
      );

      return res
        .status(200)
        .json({ success: true, message: "Module added.", data: added });
    } catch (err) {
      const msg = err?.message || "Failed to add module.";
      return res.status(400).json({ success: false, message: msg });
    }
  },

  // PUT /courses/:courseId/modules/:moduleId
  // keep this helper aligned with your schema

  updateModule: async (req, res) => {
    try {
      const { courseId, moduleId } = req.params;
      const course = await Course.findById(courseId);
      if (!course) {
        return res
          .status(404)
          .json({ success: false, message: "Course not found." });
      }

      const idx = (course.modules || []).findIndex(
        (m) => String(m._id) === String(moduleId)
      );
      if (idx === -1) {
        return res
          .status(404)
          .json({ success: false, message: "Module not found." });
      }

      const prevSnapshot = courseSnapshot(course);
      const body = req.body || {};
      const mod = course.modules[idx];

      // --- title & slug handling ---
      let titleChanged = false;
      if (body.title != null) {
        const t = String(body.title || "").trim();
        if (!t) {
          return res
            .status(400)
            .json({ success: false, message: "Module title cannot be empty." });
        }
        if (t !== mod.title) {
          mod.title = t;
          titleChanged = true;
        }
      }

      // If slug provided, sanitize & set; otherwise if title changed, regenerate from title.
      if (body.slug != null || titleChanged) {
        const base = body.slug ? formatSlug(body.slug) : formatSlug(mod.title);
        mod.slug = ensureUniqueSlug(base, course.modules, mod._id);
      }

      // --- description ---
      if (body.description != null) {
        mod.description = String(body.description || "").trim();
      }

      // --- order ---
      const ord = body.moduleOrder ?? body.order;
      if (ord != null && Number.isFinite(Number(ord))) {
        mod.moduleOrder = Number(ord);
      }

      // --- sections ---
      if (Array.isArray(body.sections)) {
        mod.sections = body.sections;
      }

      // --- quizInfo (module-level) ---
      if (body.quizInfo != null) {
        const qi = body.quizInfo || {};
        const normalized = {
          poolSize: Math.max(
            0,
            Number.isFinite(Number(qi.poolSize))
              ? Number(qi.poolSize)
              : (mod.quizInfo?.poolSize ?? 5)
          ),
          passingScorePct: Math.max(
            0,
            Math.min(
              100,
              Number.isFinite(Number(qi.passingScorePct))
                ? Number(qi.passingScorePct)
                : (mod.quizInfo?.passingScorePct ?? 70)
            )
          ),
        };
        // Validate pool size against THIS module's question pool
        const modulePool = moduleQuestionPoolCount(mod);
        if (normalized.poolSize > 0 && normalized.poolSize > modulePool) {
          return res.status(400).json({
            success: false,
            message: `Module quizInfo.poolSize (${normalized.poolSize}) exceeds this module's question pool (${modulePool}). Reduce poolSize or add questions.`,
          });
        }
        mod.quizInfo = normalized;
      } else {
        // Even if quizInfo not in body, still guard existing poolSize against current module pool after section edits
        const modulePool = moduleQuestionPoolCount(mod);
        if ((mod.quizInfo?.poolSize || 0) > modulePool) {
          mod.quizInfo.poolSize = Math.min(mod.quizInfo.poolSize, modulePool); // or set to 0 to mean "use all"
        }
      }

      // --- course-level quiz guard you already had ---
      const counts = computeCounts(course);
      if (course.quiz?.poolSize > counts.questionPoolCount) {
        return res.status(400).json({
          success: false,
          message: `Course quiz.poolSize (${course.quiz.poolSize}) exceeds total question pool (${counts.questionPoolCount}) after changes. Reduce poolSize or add questions.`,
        });
      }

      // normalize/sort orders after any moduleOrder changes
      course.modules = renumberOrders(course.modules);
      course.markModified("modules");

      const saved = await recomputeAndSaveCourse(course, req.user?.id, {
        req,
        action: "update",
        summary: `Updated module "${mod.title}"`,
        changes: [{ path: "modules", from: "prev", to: "updated one module" }],
        prevSnapshot,
      });

      const updated = (saved.modules || []).find(
        (m) => String(m._id) === String(moduleId)
      );
      return res
        .status(200)
        .json({ success: true, message: "Module updated.", data: updated });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  // PUT /courses/:courseId/modules/reorder
  reorderModules: async (req, res) => {
    try {
      const { courseId } = req.params;
      const { order } = req.body; // array of moduleIds in desired order
      if (!Array.isArray(order) || !order.length) {
        return res.status(400).json({
          success: false,
          message: "Order must be a non-empty array of module ids.",
        });
      }

      const course = await Course.findById(courseId);
      if (!course) {
        return res
          .status(404)
          .json({ success: false, message: "Course not found." });
      }

      const prevSnapshot = courseSnapshot(course);

      const idToModule = new Map(
        (course.modules || []).map((m) => [String(m._id), m])
      );
      const reordered = order
        .map((id) => idToModule.get(String(id)))
        .filter(Boolean);

      // append any ids that weren't listed (to avoid loss)
      const listed = new Set(order.map(String));
      (course.modules || []).forEach((m) => {
        if (!listed.has(String(m._id))) reordered.push(m);
      });

      course.modules = renumberOrders(reordered);

      const saved = await recomputeAndSaveCourse(course, req.user?.id, {
        req,
        action: "update",
        summary: "Reordered modules",
        changes: [{ path: "modules", from: "prev order", to: "new order" }],
        prevSnapshot,
      });

      return res.status(200).json({
        success: true,
        message: "Modules reordered.",
        data: saved.modules,
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },

 // DELETE /courses/:courseId/modules/:moduleId
deleteModule: async (req, res) => {
  const session = await Course.startSession();
  try {
    await session.withTransaction(async () => {
      const { courseId, moduleId } = req.params;

      const course = await Course.findById(courseId).session(session);
      if (!course) {
        return res.status(404).json({ success: false, message: "Course not found." });
      }

      const idx = (course.modules || []).findIndex(m => String(m._id) === String(moduleId));
      if (idx === -1) {
        return res.status(404).json({ success: false, message: "Module not found." });
      }

      const prevSnapshot = courseSnapshot(course);
      const removed = course.modules[idx];

      // Remove module + renumber
      course.modules.splice(idx, 1);
      course.modules = renumberOrders(course.modules);

      // Persist course first (still inside txn)
      await course.save({ session });

      // Remove the module’s progress for all NON-completed learners
      await CourseProgress.updateMany(
        { courseId, status: { $ne: "completed" } },
        { $pull: { modules: { moduleId: removed._id } } },
        { session }
      );

      // Recompute totals/status in-place for those learners (pipeline update)
      const newTotal = course.modules.length;
      await CourseProgress.updateMany(
        { courseId, status: { $ne: "completed" } },
        [
          // recompute modulesCompleted
          {
            $set: {
              modulesCompleted: {
                $size: {
                  $filter: {
                    input: "$modules",
                    as: "m",
                    cond: { $eq: ["$$m.passed", true] }
                  }
                }
              }
            }
          },
          // set totalModules to new course length
          { $set: { totalModules: newTotal } },
          // flip overall status if they now meet completion
          {
            $set: {
              status: {
                $cond: [{ $eq: ["$modulesCompleted", newTotal] }, "completed", "in_progress"]
              }
            }
          },
          { $set: { updatedAt: new Date() } }
        ],
        { session }
      );

      // Audit/log (after updates, still in txn)
      await recomputeAndSaveCourse(course, req.user?.id, {
        req,
        action: "update",
        summary: `Deleted module "${removed?.title || moduleId}"`,
        changes: [{ path: "modules", from: "included module", to: "removed module" }],
        prevSnapshot,
        session
      });
    });

    return res.status(200).json({ success: true, message: "Module deleted." });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  } finally {
    session.endSession();
  }
},

};

export default courseCtrl;
