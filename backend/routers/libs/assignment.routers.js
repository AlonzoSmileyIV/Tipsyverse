import { Router } from "express";
import { assignmentCtrl } from "../../controllers/index.js";
import { auth, authEmployee } from "../../middleware/index.js";

const assignmentRouter = Router();

assignmentRouter.get('/me', auth, assignmentCtrl.viewMyAssignments);

assignmentRouter.get('/user/:userId', auth, authEmployee, assignmentCtrl.viewAssignmentsByUserId);

assignmentRouter.get('/event/:eventId', auth, assignmentCtrl.viewAssignmentsByEventId);

assignmentRouter.post('/:id/unassign-my', auth, assignmentCtrl.removeMyAssignmentById);


export default assignmentRouter;
