import express from "express";
import { courseCtrl } from "../../controllers/index.js";
import { auth, authEmployee, optionalAuth } from "../../middleware/index.js";

const courseRouter = express.Router();

// courses
courseRouter.get("/", courseCtrl.viewCourses);
courseRouter.post("/", auth, authEmployee, courseCtrl.createCourse);
courseRouter.get("/required", optionalAuth, courseCtrl.viewCoursesByRequiredRole);
courseRouter.get("/:id", courseCtrl.viewCourseById);
courseRouter.get("/:id/overview", courseCtrl.viewCourseOverview);
courseRouter.get("/slug/:slug", courseCtrl.viewCourseBySlug);
courseRouter.put("/:id", auth, authEmployee, courseCtrl.updateCourse);
courseRouter.delete("/:id", auth, authEmployee, courseCtrl.deleteCourse);

// modules
courseRouter.get("/:courseId/modules", courseCtrl.listModules);
courseRouter.get("/:courseId/modules/:moduleId", courseCtrl.getModule);
courseRouter.post("/:courseId/modules", auth, authEmployee, courseCtrl.addModule);
courseRouter.put("/:courseId/modules/:moduleId", auth, authEmployee, courseCtrl.updateModule);
courseRouter.put("/:courseId/modules/reorder", auth, authEmployee, courseCtrl.reorderModules);
courseRouter.delete("/:courseId/modules/:moduleId", auth, authEmployee, courseCtrl.deleteModule);

export default courseRouter;