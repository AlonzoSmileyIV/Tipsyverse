import { Router } from "express";
import { paymentCtrl } from "../../controllers/index.js";
import { auth, dedupeSuccessfulRequests } from "../../middleware/index.js";

const paymentRouter = Router();
const paymentDedupe = dedupeSuccessfulRequests({ ttlMs: 45 * 1000 });

// CREATE
paymentRouter.post("/", auth, paymentDedupe, paymentCtrl.createPayment);
paymentRouter.post(
  "/stripe/payment-intent",
  auth,
  paymentDedupe,
  paymentCtrl.createStripePaymentIntent
);

// READ
paymentRouter.get("/", auth, paymentCtrl.viewPayments);
paymentRouter.get("/event/:eventId", auth, paymentCtrl.viewPaymentsByEvent);
paymentRouter.get("/request/:paymentRequestId", auth, paymentCtrl.viewPaymentsByPaymentRequest);
paymentRouter.get("/:id", auth, paymentCtrl.viewPaymentById);

// UPDATE
paymentRouter.patch("/:id", auth, paymentCtrl.updatePayment);
paymentRouter.patch("/:id/void", auth, paymentCtrl.voidPayment);
paymentRouter.patch("/:id/refund", auth, paymentCtrl.refundPayment);

// DELETE
paymentRouter.delete("/:id", auth, paymentCtrl.deletePayment);

export default paymentRouter;
