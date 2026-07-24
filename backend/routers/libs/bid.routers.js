import { Router } from "express";
import { bidCtrl } from "../../controllers/index.js";
import { auth } from "../../middleware/index.js";


const bidRouter = Router();

// -------- CREATE --------
bidRouter.post("/toggle-interest", auth, bidCtrl.toggleInterestBid);

// -------- READ --------
bidRouter.get('/event/:eventId', auth, bidCtrl.viewBidsByEventId);
bidRouter.get('/event/:eventId/interested', auth, bidCtrl.viewInterestedBidsByEventId);
bidRouter.get('/user/:userId', auth, bidCtrl.viewBidsByUserId);
bidRouter.get('/me', auth, bidCtrl.viewMyBids);


// -------- UPDATE --------
bidRouter.patch('/:bidId', auth, bidCtrl.updateBid);


export default bidRouter;