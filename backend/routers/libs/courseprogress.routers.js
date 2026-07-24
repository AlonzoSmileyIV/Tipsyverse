import express from "express";
import { courseProgressCtrl } from "../../controllers/index.js";
import { auth } from "../../middleware/index.js";

const courseProgressRouter = express.Router();

courseProgressRouter.get('/my', auth, courseProgressCtrl.listMyProgress);
courseProgressRouter.get('/slug/:slug', auth, courseProgressCtrl.getProgressBySlug);
courseProgressRouter.get('/:courseId', auth, courseProgressCtrl.getOrCreateProgress);

courseProgressRouter.post("/:courseId/sections/:sectionId/content", auth, courseProgressCtrl.markContentProgress);
courseProgressRouter.post("/:courseId/sections/:sectionId/quiz", auth, courseProgressCtrl.submitQuizAttempt);
courseProgressRouter.post("/:courseId/reset", auth, courseProgressCtrl.resetProgress);


export default courseProgressRouter;