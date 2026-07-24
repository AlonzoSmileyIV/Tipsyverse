import { Router } from "express";
import { attendanceCtrl } from "../../controllers/index.js";
import { auth, authEmployee } from "../../middleware/index.js";

const attendanceRouter = Router();

attendanceRouter.get("/", auth, attendanceCtrl.viewAttendance);
attendanceRouter.patch("/assignments/:assignmentId/verify", auth, attendanceCtrl.verifyAssignmentAttendance);
attendanceRouter.post("/assignments/:assignmentId/clock-in", auth, attendanceCtrl.clockIn);
attendanceRouter.post("/assignments/:assignmentId/clock-out", auth, attendanceCtrl.clockOut);
attendanceRouter.patch("/:id/verify", auth, attendanceCtrl.verifyAttendance);
attendanceRouter.delete("/:id", auth, authEmployee, attendanceCtrl.deleteAttendance);

export default attendanceRouter;
