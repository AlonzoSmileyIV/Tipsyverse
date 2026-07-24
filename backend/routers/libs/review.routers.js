import express from "express";
import { auth } from "../../middleware/index.js";
import { reviewCtrl } from "../../controllers/index.js";

const reviewRouter = express.Router();

// create or insert multiple reviews at once
reviewRouter.post("/bartenders/bulk", auth, reviewCtrl.upsertReviews);

// bulk delete
reviewRouter.delete("/bulk", auth, reviewCtrl.deleteReviewsBulk);

// view by event
reviewRouter.get("/event/:eventId", auth, reviewCtrl.viewReviewsByEvent);

// my reviews
reviewRouter.get("/me", auth, reviewCtrl.viewMyReviews);

export default reviewRouter;
