import { Router } from "express";
import { activityLogCtrl } from "../../controllers/index.js";
import { auth, authEmployee } from "../../middleware/index.js";

const activityLogRouter = Router();

activityLogRouter.get('/', auth, authEmployee, activityLogCtrl.getActivityLogForEntity);

export default activityLogRouter;