import {
  CourseModel as Course,
  CourseProgressModel as CourseProgress,
  UserModel as User,
} from "../../models/index.js";

const BIANCA_EMAIL = "alonzo.smiley+bartender1@tipsyverse.com";

export default async function seedBiancaRequiredCourseProgress() {
  const bianca = await User.findOne({ email: BIANCA_EMAIL }).select("_id email");
  if (!bianca) {
    console.warn(
      `⚠️ Skipped Bianca's course progress because ${BIANCA_EMAIL} was not found.`
    );
    return;
  }

  const requiredCourses = await Course.find({
    status: "published",
    requiredForRoles: "bartender",
  }).lean();

  if (!requiredCourses.length) {
    console.warn(
      "⚠️ No published bartender-required courses were found for Bianca."
    );
    return;
  }

  const completedAt = new Date();

  for (const course of requiredCourses) {
    const modules = (course.modules || []).map((module) => ({
      moduleId: module._id,
      status: "passed",
      startedAt: completedAt,
      completedAt,
      progress: 1,
      bestScore: 100,
      bestPercent: 100,
      passed: true,
      attempts: [],
      sections: (module.sections || []).map((section) => ({
        sectionId: section._id,
        startedAt: completedAt,
        completedAt,
      })),
    }));
    const totalSections = (course.modules || []).reduce(
      (total, module) => total + (module.sections?.length || 0),
      0
    );

    await CourseProgress.findOneAndUpdate(
      { userId: bianca._id, courseId: course._id },
      {
        $set: {
          status: "completed",
          startedAt: completedAt,
          completedAt,
          lastViewedAt: completedAt,
          currentModuleId: course.modules?.at(-1)?._id,
          currentSectionId: course.modules?.at(-1)?.sections?.at(-1)?._id,
          currentSectionIndex: Math.max(
            0,
            (course.modules?.at(-1)?.sections?.length || 1) - 1
          ),
          modules,
          totalModules: modules.length,
          modulesCompleted: modules.length,
          totalSections,
          sectionsCompleted: totalSections,
          bestPercentOverall: 100,
          timeSpentSec: 0,
          meta: {
            seededForQa: true,
          },
        },
      },
      { upsert: true, new: true, runValidators: true }
    );
  }

  console.log(
    `✅ Seeded Bianca as complete for ${requiredCourses.length} required course(s)`
  );
}
