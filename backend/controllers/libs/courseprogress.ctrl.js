// controllers/courseProgress.controller.js
import mongoose from "mongoose";
import {
  CourseModel as Course,
  CourseProgressModel as CourseProgress,
} from "../../models/index.js";
import { sendEmail } from "../../utils/index.js";

// ---------- helpers ----------

function ensureObjectId(id) {
  return mongoose.isValidObjectId(id) ? new mongoose.Types.ObjectId(id) : id;
}

// shallow diff helper (path-level). Suitable for activity logs.
function shallowDiff(before = {}, after = {}) {
  const changes = [];
  const keys = new Set([
    ...Object.keys(before || {}),
    ...Object.keys(after || {}),
  ]);
  for (const k of keys) {
    const b = JSON.stringify(before?.[k]);
    const a = JSON.stringify(after?.[k]);
    if (b !== a) changes.push({ path: k, from: before?.[k], to: after?.[k] });
  }
  return changes;
}

// Return { module, section, moduleId } for a given sectionId
function findModuleBySection(course, sectionId) {
  for (const m of course?.modules || []) {
    const hit = (m.sections || []).find(
      (s) => String(s._id) === String(sectionId)
    );
    if (hit) return { module: m, section: hit, moduleId: m._id };
  }
  return { module: null, section: null, moduleId: null };
}

function computeRollupsFromModules(progress) {
  const modules = progress.modules || [];

  const totalSections =
    progress.totalSections ??
    modules.reduce((n, m) => n + (m.sections?.length || 0), 0);

  const sectionsCompleted = modules.reduce(
    (n, m) => n + (m.sections?.filter((s) => s.completedAt).length || 0),
    0
  );

  const bestPercentOverall = modules.length
    ? Math.round(
        modules.reduce((sum, m) => sum + (m.bestPercent || 0), 0) /
          modules.length
      )
    : 0;

  return { totalSections, sectionsCompleted, bestPercentOverall };
}

function sortCourseModules(mods = []) {
  return (mods || [])
    .map((m, i) => ({
      ...m,
      order: Number.isFinite(m.moduleOrder)
        ? m.moduleOrder
        : Number.isFinite(m.order)
          ? m.order
          : i,
    }))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

// ---------- controllers ----------

/**
 * GET /api/progress/:courseId          (or use query ?courseId=)
 * If not exists, upserts a progress doc in "not_started".
 * Optional query: ?create=1 to force upsert.
 */

const courseProgressCtrl = {
  // getOrCreateProgress: async (req, res) => {
  //   try {
  //     const raw = req.params.courseId || req.query.courseId;
  //     if (!mongoose.isValidObjectId(raw)) {
  //       return res
  //         .status(400)
  //         .json({ success: false, message: "Invalid courseId." });
  //     }
  //     const courseId = new mongoose.Types.ObjectId(raw);
  //     const create = String(req.query.create || "1") === "1";

  //     let prog = await CourseProgress.findOne({
  //       userId: req.user.id,
  //       courseId,
  //     });

  //     if (!prog && create) {
  //       const course = await Course.findById(courseId).lean();
  //       if (!course) {
  //         return res
  //           .status(404)
  //           .json({ success: false, message: "Course not found." });
  //       }

  //       const firstModule = (course.modules || [])[0];
  //       const firstSection = firstModule?.sections?.[0];

  //       const modulesSeed = (course.modules || []).map((m, idx) => ({
  //         moduleId: m._id,
  //         status: idx === 0 ? "in_progress" : "locked",
  //         startedAt: idx === 0 ? new Date() : undefined,
  //         completedAt: undefined,
  //         progress: 0,
  //         bestScore: 0,
  //         bestPercent: 0,
  //         passed: false,
  //         attempts: [],
  //         // seed all section ids so progress denominator is correct
  //         sections: (m.sections || []).map((s) => ({ sectionId: s._id })),
  //       }));

  //       const prog = await CourseProgress.create({
  //         userId: req.user.id,
  //         courseId,
  //         status: "in_progress",
  //         totalModules: (course.modules || []).length,
  //         totalSections:
  //           course?.stats?.sectionsCount ??
  //           (course.modules || []).reduce(
  //             (n, m) => n + (m.sections?.length || 0),
  //             0
  //           ),
  //         currentModuleId: firstModule?._id,
  //         currentSectionId: firstSection?._id,
  //         currentSectionIndex: 0,
  //         modules: modulesSeed,
  //       });

  //       await req.logActivity?.(
  //         {
  //           action: "create",
  //           target: {
  //             model: "CourseProgress",
  //             id: prog._id,
  //             name: course.title,
  //           },
  //           actor: {
  //             type: "User",
  //             id: req.user.id,
  //             label: {
  //               fullName: req.user.fullName,
  //               email: req.user.email,
  //               role: req.user.role,
  //             },
  //           },
  //           summary: `Created course progress for "${course.title}"`,
  //           nextSnapshot: {
  //             status: prog.status,
  //             totalSections: prog.totalSections,
  //             currentSectionId: prog.currentSectionId,
  //           },
  //           context: { courseId },
  //         },
  //         { failSilently: true }
  //       );
  //     }

  //     return res.status(200).json({ success: true, data: prog });
  //   } catch (err) {
  //     return res.status(500).json({ success: false, message: err.message });
  //   }
  // },
  getOrCreateProgress: async (req, res) => {
    try {
      const raw = req.params.courseId || req.query.courseId;
      if (!mongoose.isValidObjectId(raw)) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid courseId." });
      }

      const courseId = new mongoose.Types.ObjectId(raw);
      const create = String(req.query.create ?? "1") === "1";

      // find existing progress
      let prog = await CourseProgress.findOne({
        userId: req.user.id,
        courseId,
      });

      // if not found and caller doesn't want to create, 404
      if (!prog && !create) {
        return res
          .status(404)
          .json({ success: false, message: "Progress not found." });
      }

      if (!prog) {
        const course = await Course.findById(courseId).lean();
        if (!course) {
          return res
            .status(404)
            .json({ success: false, message: "Course not found." });
        }

        // stable ordering by moduleOrder (fallback to index)
        const ordered = (course.modules || [])
          .map((m, i) => ({
            ...m,
            order: Number.isFinite(m.moduleOrder)
              ? m.moduleOrder
              : Number.isFinite(m.order)
                ? m.order
                : i,
          }))
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

        const firstModule = ordered[0];
        const firstSection = firstModule?.sections?.[0];

        // seed module + section ids so denominators are correct
        const modulesSeed = ordered.map((m, idx) => ({
          moduleId: m._id,
          status: idx === 0 ? "in_progress" : "locked",
          startedAt: idx === 0 ? new Date() : undefined,
          completedAt: undefined,
          progress: 0,
          bestScore: 0,
          bestPercent: 0,
          passed: false,
          attempts: [],
          sections: (m.sections || []).map((s) => ({ sectionId: s._id })),
        }));

        const totalModules = ordered.length;
        const totalSections =
          course?.stats?.sectionsCount ??
          ordered.reduce((n, m) => n + (m.sections?.length || 0), 0);

        // IMPORTANT: assign to the outer variable (do NOT redeclare)
        prog = await CourseProgress.create({
          userId: req.user.id,
          courseId,
          status: "in_progress",
          totalModules,
          totalSections,
          currentModuleId: firstModule?._id,
          currentSectionId: firstSection?._id,
          currentSectionIndex: 0,
          modules: modulesSeed,
          modulesCompleted: 0,
          startedAt: new Date(),
          lastViewedAt: new Date(),
        });

        // best-effort activity log
        await req.logActivity?.(
          {
            action: "create",
            target: {
              model: "CourseProgress",
              id: prog._id,
              name: course.title,
            },
            actor: {
              type: "User",
              id: req.user.id,
              label: {
                fullName: req.user.fullName,
                email: req.user.email,
                role: req.user.role,
              },
            },
            summary: `Created course progress for "${course.title}"`,
            nextSnapshot: {
              status: prog.status,
              totalSections: prog.totalSections,
              currentSectionId: prog.currentSectionId,
            },
            context: { courseId },
          },
          { failSilently: true }
        );
      }

      return res.status(200).json({ success: true, data: prog });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  /**
   * POST /api/progress/:courseId/sections/:sectionId/content
   * body: { fraction: 0..1 }
   */
  markContentProgress: async (req, res) => {
    try {
      const courseId = ensureObjectId(req.params.courseId);
      const sectionId = ensureObjectId(req.params.sectionId);
      const fraction = Math.max(0, Math.min(1, Number(req.body.fraction ?? 0)));

      const [course, prog] = await Promise.all([
        Course.findById(courseId).lean(),
        CourseProgress.findOne({ userId: req.user.id, courseId }),
      ]);
      if (!course)
        return res
          .status(404)
          .json({ success: false, message: "Course not found." });
      if (!prog)
        return res.status(404).json({
          success: false,
          message: "Progress not found. Start the course first.",
        });

      const { moduleId } = findModuleBySection(course, sectionId);
      if (!moduleId)
        return res
          .status(404)
          .json({ success: false, message: "Section not found in course." });

      const before = {
        status: prog.status,
        currentSectionId: prog.currentSectionId,
        rollups: computeRollupsFromModules(prog),
      };

      // ensure course started and current pointers set
      prog.startIfNeeded({
        firstModuleId: moduleId,
        firstSectionId: sectionId,
        totalModules: (course.modules || []).length,
        totalSections:
          course?.stats?.sectionsCount ??
          (course.modules || []).reduce(
            (n, m) => n + (m.sections?.length || 0),
            0
          ),
      });

      // mark this section (complete if fraction >= 1)
      prog.markSectionProgress({
        moduleId,
        sectionId,
        complete: fraction >= 1,
      });

      prog.currentModuleId = moduleId;
      prog.currentSectionId = sectionId;
      prog.lastViewedAt = new Date();

      await prog.save();

      const after = {
        status: prog.status,
        currentSectionId: prog.currentSectionId,
        rollups: computeRollupsFromModules(prog),
      };

      await req.logActivity?.(
        {
          action: "update",
          target: {
            model: "CourseProgress",
            id: prog._id,
            name: "contentProgress",
          },
          actor: {
            type: "User",
            id: req.user.id,
            label: {
              fullName: req.user.fullName,
              email: req.user.email,
              role: req.user.role,
            },
          },
          summary: `Updated content progress for section`,
          changes: shallowDiff(before, after),
          prevSnapshot: before,
          nextSnapshot: after,
          context: { courseId, sectionId },
        },
        { failSilently: true }
      );

      return res.status(200).json({ success: true, data: prog });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  /**
   * POST /api/progress/:courseId/sections/:sectionId/quiz
   * body: { answers: [{ questionId, selectedIndex }] }
   * Grades attempt server-side and rolls up pass/completion.
   */
  submitQuizAttempt: async (req, res) => {
    try {
      const courseId = ensureObjectId(req.params.courseId);
      const sectionId = ensureObjectId(req.params.sectionId);
      const incoming = Array.isArray(req.body?.answers) ? req.body.answers : [];

      // Guard: no answers
      if (!incoming.length) {
        return res
          .status(400)
          .json({ success: false, message: "No answers submitted." });
      }

      const [course, prog] = await Promise.all([
        Course.findById(courseId).lean(),
        CourseProgress.findOne({ userId: req.user.id, courseId }),
      ]);
      if (!course)
        return res
          .status(404)
          .json({ success: false, message: "Course not found." });
      if (!prog)
        return res.status(404).json({
          success: false,
          message: "Progress not found. Start the course first.",
        });

      const { module, section, moduleId } = findModuleBySection(
        course,
        sectionId
      );
      if (!section)
        return res
          .status(404)
          .json({ success: false, message: "Section not found in course." });

      const passingPct = module?.quizInfo?.passingScorePct ?? 70;

      // Build module-wide pool & map
      const pool = (module.sections || []).flatMap(
        (s) => s.quiz?.questions || []
      );
      const qMap = new Map(pool.map((q) => [String(q._id), q]));

      // Grade only valid submitted answers
      let score = 0;
      let maxScore = 0;
      const gradedAnswers = [];

      for (const a of incoming) {
        const q = qMap.get(String(a?.questionId));
        const selectedIndex = Number(a?.selectedIndex);
        if (!q || !Number.isInteger(selectedIndex) || selectedIndex < 0)
          continue;

        const correctIndex = (q.options || []).findIndex((o) => !!o.isCorrect);
        const pts = q.points || 1;
        const isCorrect = selectedIndex === correctIndex;

        if (isCorrect) score += pts;
        maxScore += pts;

        gradedAnswers.push({
          questionId: ensureObjectId(q._id),
          selectedIndex,
          isCorrect,
          points: pts,
        });
      }

      if (!gradedAnswers.length) {
        return res.status(400).json({
          success: false,
          message: "No valid answers matched questions in this module.",
        });
      }

      const percent = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
      const passed = percent >= passingPct;

      // BEFORE snapshot
      const before = {
        status: prog.status,
        modulesCompleted: prog.modulesCompleted,
        ...computeRollupsFromModules(prog),
      };
      let completedThisAttempt = false;

      // Record attempt at module level
      try {
        // --- record module-level attempt inline (module-wide pool supported) ---
        let mp = (prog.modules || []).find(
          (m) => String(m.moduleId) === String(moduleId)
        );

        // seed a module progress subdoc if missing
        if (!mp) {
          mp = {
            moduleId,
            status: "in_progress",
            startedAt: new Date(),
            completedAt: undefined,
            progress: 0,
            bestScore: 0,
            bestPercent: 0,
            passed: false,
            attempts: [],
            sections: (module.sections || []).map((s) => ({
              sectionId: s._id,
            })),
          };
          prog.modules.push(mp);
        }

        // append attempt
        mp.attempts = mp.attempts || [];
        mp.attempts.push({
          startedAt: new Date(),
          completedAt: new Date(),
          answers: gradedAnswers, // [{ questionId, selectedIndex, isCorrect, points }]
          score, // number
          maxScore, // number
          percent, // 0..100
          passed, // boolean
          poolSizeUsed: gradedAnswers.length,
        });

        // roll up bests
        mp.bestScore = Math.max(mp.bestScore || 0, score);
        mp.bestPercent = Math.max(mp.bestPercent || 0, percent);

        // if first pass, mark module completed and bump modulesCompleted
        if (passed && !mp.passed) {
          mp.passed = true;
          mp.status = "passed";
          mp.completedAt = new Date();
          prog.modulesCompleted = (prog.modulesCompleted || 0) + 1;
        }
      } catch (e) {
        // Surface exact reason if the instance method throws
        return res.status(400).json({
          success: false,
          message: "Failed to record attempt",
          details: e?.message,
        });
      }

      // Pointers
      prog.currentModuleId = moduleId;
      prog.currentSectionId = sectionId;
      prog.lastViewedAt = new Date();
      prog.totalModules = prog.totalModules || (course.modules || []).length;

      // Unlock next module on pass
      if (passed) {
        const curMp = (prog.modules || []).find(
          (m) => String(m.moduleId) === String(moduleId)
        );
        if (curMp && curMp.status !== "passed") curMp.status = "passed";

        const ordered = sortCourseModules(course.modules || []);
        const curIdx = ordered.findIndex(
          (m) => String(m._id) === String(moduleId)
        );
        const next = curIdx >= 0 ? ordered[curIdx + 1] : null;

        if (next) {
          let nextMp = (prog.modules || []).find(
            (m) => String(m.moduleId) === String(next._id)
          );
          if (!nextMp) {
            nextMp = {
              moduleId: next._id,
              status: "in_progress",
              startedAt: new Date(),
              completedAt: undefined,
              progress: 0,
              bestScore: 0,
              bestPercent: 0,
              passed: false,
              attempts: [],
              sections: (next.sections || []).map((s) => ({
                sectionId: s._id,
              })),
            };
            prog.modules.push(nextMp);
          } else {
            // Always ensure the next module is unlocked and started
            nextMp.status = "in_progress";
            if (!nextMp.startedAt) nextMp.startedAt = new Date();
          }

          const firstNextSectionId = next.sections?.[0]?._id;
          if (firstNextSectionId) {
            prog.currentModuleId = next._id;
            prog.currentSectionId = firstNextSectionId;
          }
        } else {
          // No next module → consider course completed if all passed
          const total = (course.modules || []).length;
          const passedCount = (prog.modules || []).filter(
            (m) => !!m.passed
          ).length;
          prog.modulesCompleted = passedCount;
          if (passedCount >= total && total > 0) {
            completedThisAttempt = prog.status !== "completed";
            prog.status = "completed";
            prog.completedAt = prog.completedAt || new Date();
          }
        }
      }

      // Save with validation surface
      try {
        await prog.save();
      } catch (err) {
        // This is the most common source of a silent 500.
        // Return details so you can fix the schema/values quickly.
        return res.status(400).json({
          success: false,
          message: "Validation failed saving progress.",
          details: err?.errors || err?.message,
        });
      }

      if (completedThisAttempt && req.user?.email) {
        sendEmail?.({
          to: req.user.email,
          subject: `Congratulations on completing ${course.title || "your Tipsyverse course"}!`,
          title: "Course Completed",
          html: `
            <p>Congratulations ${req.user.fullName || "there"}!</p>
            <p>You completed <strong>${course.title || "your Tipsyverse course"}</strong> on ${new Date(
              prog.completedAt
            ).toLocaleDateString()}.</p>
            <p>We’re proud of the work you put in. Keep an eye on your bartender checklist for the next steps toward working events with Tipsyverse.</p>
            <p><strong>Certificate:</strong> Your completion is recorded in your account. A downloadable PDF certificate will be added in a future update.</p>
          `,
        }).catch((err) =>
          console.error("Course completion email failed:", err?.message)
        );
      }

      const after = {
        status: prog.status,
        modulesCompleted: prog.modulesCompleted,
        ...computeRollupsFromModules(prog),
      };

      // Best-effort activity log (never blocks)
      try {
        await req.logActivity?.(
          {
            action: "update",
            target: {
              model: "CourseProgress",
              id: prog._id,
              name: "quizAttempt",
            },
            actor: {
              type: "User",
              id: req.user.id,
              label: {
                fullName: req.user.fullName,
                email: req.user.email,
                role: req.user.role,
              },
            },
            summary: `Submitted quiz attempt (passed=${passed}, percent=${percent}%)`,
            changes: shallowDiff(before, after),
            prevSnapshot: before,
            nextSnapshot: {
              ...after,
              attemptSummary: {
                sectionId,
                score,
                maxScore,
                percent,
                passed,
                poolSizeUsed: gradedAnswers.length,
              },
            },
            context: { courseId, sectionId, moduleId },
          },
          { failSilently: true }
        );
      } catch {
        /* ignore */
      }

      return res.status(200).json({
        success: true,
        data: {
          attempt: {
            moduleId,
            startedAt: new Date(),
            completedAt: new Date(),
            answers: gradedAnswers,
            score,
            maxScore,
            percent,
            passed,
            poolSizeUsed: gradedAnswers.length,
          },
          progress: {
            status: prog.status,
            modulesCompleted: prog.modulesCompleted,
            totalModules: prog.totalModules,
            ...computeRollupsFromModules(prog),
            completedAt: prog.completedAt,
          },
        },
      });
    } catch (err) {
      // Final fallback
      console.error("submitQuizAttempt error:", err);
      return res
        .status(500)
        .json({ success: false, message: err?.message || "Server error" });
    }
  },

  /**
   * POST /api/progress/:courseId/reset
   * Resets a user’s progress for a course.
   */
  resetProgress: async (req, res) => {
    try {
      const courseId = ensureObjectId(req.params.courseId);
      const prog = await CourseProgress.findOne({
        userId: req.user.id,
        courseId,
      });
      if (!prog)
        return res
          .status(404)
          .json({ success: false, message: "Progress not found." });

      const before = {
        status: prog.status,
        modulesCompleted: prog.modulesCompleted,
        ...computeRollupsFromModules(prog),
        totalSections: prog.totalSections,
      };

      prog.currentModuleId = undefined;
      prog.currentSectionId = undefined;
      prog.currentSectionIndex = 0;

      prog.modules = [];
      prog.modulesCompleted = 0;

      prog.status = "in_progress";
      prog.startedAt = undefined;
      prog.completedAt = undefined;
      prog.lastViewedAt = new Date();

      // keep totalSections snapshot
      prog.sectionsCompleted = 0;
      prog.bestPercentOverall = 0;

      await prog.save();

      const after = {
        status: prog.status,
        modulesCompleted: prog.modulesCompleted,
        ...computeRollupsFromModules(prog),
        totalSections: prog.totalSections,
      };

      await req.logActivity?.(
        {
          action: "update",
          target: { model: "CourseProgress", id: prog._id, name: "reset" },
          actor: {
            type: "User",
            id: req.user.id,
            label: {
              fullName: req.user.fullName,
              email: req.user.email,
              role: req.user.role,
            },
          },
          summary: "Reset course progress",
          changes: shallowDiff(before, after),
          prevSnapshot: before,
          nextSnapshot: after,
          context: { courseId },
        },
        { failSilently: true }
      );

      return res
        .status(200)
        .json({ success: true, message: "Progress reset.", data: prog });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  /**
   * GET /api/progress/my
   * List current user's course progress with lightweight denormalized course info.
   * Optional query: ?status=in_progress (or completed, etc.)
   */
  listMyProgress: async (req, res) => {
    try {
      const q = { userId: req.user.id };
      if (req.query.status) q.status = req.query.status;

      const items = await CourseProgress.find(q).sort({ updatedAt: -1 }).lean();

      // Attach a small course snapshot (title, slug)
      const courseIds = items.map((i) => i.courseId);
      const courses = await Course.find(
        { _id: { $in: courseIds } },
        { title: 1, slug: 1, status: 1 }
      ).lean();
      const courseMap = new Map(courses.map((c) => [String(c._id), c]));

      const data = items.map((p) => ({
        ...p,
        course: courseMap.get(String(p.courseId)) || null,
      }));

      return res.status(200).json({ success: true, data });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  /**
   * GET /api/progress/slug/:slug
   * Convenience endpoint to fetch (or create) progress via course slug.
   * Optional query: ?create=1 (default), ?light=1 to omit sections.
   */
  // controllers/courseProgress.controller.js
  getProgressBySlug: async (req, res) => {
    try {
      const slug = String(req.params.slug || "").trim();
      const create = String(req.query.create || "1") === "1";
      const light = String(req.query.light || "") === "1";

      const projection = light
        ? { _id: 1, title: 1, slug: 1, stats: 1, modules: 1 }
        : { _id: 1, title: 1, slug: 1, stats: 1, modules: 1 };

      const course = await Course.findOne({ slug }, projection).lean();
      if (!course)
        return res
          .status(404)
          .json({ success: false, message: "Course not found." });

      let prog = await CourseProgress.findOne({
        userId: req.user.id,
        courseId: course._id,
      });

      if (!prog && create) {
        const firstModule = (course.modules || [])[0];
        const firstSection = firstModule?.sections?.[0];

        prog = await CourseProgress.create({
          userId: req.user.id,
          courseId: course._id,
          status: "not_started",
          totalModules: (course.modules || []).length,
          totalSections:
            course?.stats?.sectionsCount ??
            (course.modules || []).reduce(
              (n, m) => n + (m.sections?.length || 0),
              0
            ),
          currentModuleId: firstModule?._id,
          currentSectionId: firstSection?._id,
          currentSectionIndex: 0,
          modules: [], // <- keep modules only
        });

        await req.logActivity?.(
          {
            action: "create",
            target: {
              model: "CourseProgress",
              id: prog._id,
              name: course.title,
            },
            actor: {
              type: "User",
              id: req.user.id,
              label: {
                fullName: req.user.fullName,
                email: req.user.email,
                role: req.user.role,
              },
            },
            summary: `Created course progress for "${course.title}" via slug`,
            nextSnapshot: {
              status: prog.status,
              totalSections: prog.totalSections,
              currentSectionId: prog.currentSectionId,
            },
            context: { courseId: course._id, slug: course.slug },
          },
          { failSilently: true }
        );
      }

      return res.status(200).json({
        success: true,
        data: {
          course: { _id: course._id, title: course.title, slug: course.slug },
          progress: prog,
        },
      });
    } catch (err) {
      console.error("getProgressBySlug error:", err);
      return res.status(500).json({ success: false, message: err.message });
    }
  },
};

export default courseProgressCtrl;
