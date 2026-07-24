import { Router } from "express";
import { rewardCtrl } from "../../controllers/index.js";
import { auth, authEmployee } from "../../middleware/index.js";

const rewardRouter = Router();

rewardRouter.get("/me", auth, rewardCtrl.viewMyRewards);
rewardRouter.post("/milestones/:milestone/claim", auth, rewardCtrl.claimReward);
rewardRouter.get("/claims", auth, authEmployee, rewardCtrl.viewAllClaims);
rewardRouter.patch("/claims/:claimId/send", auth, authEmployee, rewardCtrl.sendReward);
rewardRouter.patch("/claims/:claimId", auth, authEmployee, rewardCtrl.updateClaimStatus);

export default rewardRouter;
