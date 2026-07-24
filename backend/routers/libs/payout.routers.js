import { Router } from "express";
import { payoutCtrl } from "../../controllers/index.js";
import { auth } from "../../middleware/index.js";

const payoutRouter = Router();

payoutRouter.get("/", auth, payoutCtrl.viewPayouts);
payoutRouter.post("/", auth, payoutCtrl.createPayout);
payoutRouter.post("/reminders", auth, payoutCtrl.requestPayoutReminder);

export default payoutRouter;
