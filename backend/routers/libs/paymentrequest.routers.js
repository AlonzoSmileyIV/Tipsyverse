import { Router } from "express";
import { paymentRequestCtrl } from "../../controllers/index.js";
import { auth } from "../../middleware/index.js";

const paymentRequestRouter = Router();

// CREATE
paymentRequestRouter.post("/", auth, paymentRequestCtrl.createPaymentRequest);

// READ
paymentRequestRouter.get("/", auth, paymentRequestCtrl.viewPaymentRequests);
paymentRequestRouter.get("/event/:eventId", auth, paymentRequestCtrl.viewPaymentRequestsByEvent);
paymentRequestRouter.get("/:id", auth, paymentRequestCtrl.viewPaymentRequestById);

// UPDATE
paymentRequestRouter.patch("/:id", auth, paymentRequestCtrl.updatePaymentRequest);
paymentRequestRouter.patch("/:id/send", auth, paymentRequestCtrl.sendPaymentRequest);
paymentRequestRouter.patch("/:id/complete", auth, paymentRequestCtrl.completePaymentRequest);
paymentRequestRouter.patch("/:id/cancel", auth, paymentRequestCtrl.cancelPaymentRequest);

// DELETE
paymentRequestRouter.delete("/:id", auth, paymentRequestCtrl.deletePaymentRequest);

export default paymentRequestRouter;
