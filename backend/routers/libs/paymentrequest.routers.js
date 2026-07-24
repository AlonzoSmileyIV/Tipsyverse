import { Router } from "express";
import { paymentRequestCtrl } from "../../controllers/index.js";
import { auth, dedupeSuccessfulRequests } from "../../middleware/index.js";

const paymentRequestRouter = Router();
const paymentRequestDedupe = dedupeSuccessfulRequests({ ttlMs: 45 * 1000 });

// CREATE
paymentRequestRouter.post("/", auth, paymentRequestDedupe, paymentRequestCtrl.createPaymentRequest);

// READ
paymentRequestRouter.get("/", auth, paymentRequestCtrl.viewPaymentRequests);
paymentRequestRouter.get("/event/:eventId", auth, paymentRequestCtrl.viewPaymentRequestsByEvent);
paymentRequestRouter.get("/:id", auth, paymentRequestCtrl.viewPaymentRequestById);

// UPDATE
paymentRequestRouter.patch("/:id", auth, paymentRequestCtrl.updatePaymentRequest);
paymentRequestRouter.patch("/:id/send", auth, paymentRequestDedupe, paymentRequestCtrl.sendPaymentRequest);
paymentRequestRouter.patch("/:id/complete", auth, paymentRequestCtrl.completePaymentRequest);
paymentRequestRouter.patch("/:id/cancel", auth, paymentRequestCtrl.cancelPaymentRequest);

// DELETE
paymentRequestRouter.delete("/:id", auth, paymentRequestCtrl.deletePaymentRequest);

export default paymentRequestRouter;
