import { Router } from "express";
import { rewardCtrl } from "../../controllers/index.js";
import { auth, authEmployee, dedupeSuccessfulRequests } from "../../middleware/index.js";

const rewardRouter = Router();
const rewardDedupe = dedupeSuccessfulRequests({ ttlMs: 45 * 1000 });

rewardRouter.get("/me", auth, rewardCtrl.viewMyRewards);
rewardRouter.post("/milestones/:milestone/claim", auth, rewardDedupe, rewardCtrl.claimReward);
rewardRouter.get("/claims", auth, authEmployee, rewardCtrl.viewAllClaims);
rewardRouter.patch("/claims/:claimId/send", auth, authEmployee, rewardDedupe, rewardCtrl.sendReward);
rewardRouter.patch("/claims/:claimId", auth, authEmployee, rewardCtrl.updateClaimStatus);

export default rewardRouter;
