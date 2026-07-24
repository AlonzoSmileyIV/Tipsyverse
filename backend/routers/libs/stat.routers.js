import { Router } from "express";
import { statCtrl } from "../../controllers/index.js";

const statRouter = Router();

statRouter.get('/', statCtrl.getAppStats);

export default statRouter;