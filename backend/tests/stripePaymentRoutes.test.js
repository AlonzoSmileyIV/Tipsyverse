import assert from "node:assert/strict";
import test from "node:test";
import paymentCtrl, {
  canApplyStripePaymentStatus,
  setPaymentStripeFactoryForTests,
} from "../controllers/libs/payment.ctrl.js";
import paymentRouter from "../routers/libs/payment.routers.js";
import { PaymentModel, PaymentRequestModel } from "../models/index.js";

const route = (method, path) =>
  paymentRouter.stack.find(
    (layer) => layer.route?.path === path && layer.route?.methods?.[method]
  );

const responseCapture = () => {
  const capture = { statusCode: 200, body: undefined };
  capture.res = {
    status(value) {
      capture.statusCode = value;
      return this;
    },
    json(value) {
      capture.body = value;
      return this;
    },
    send(value) {
      capture.body = value;
      return this;
    },
  };
  return capture;
};

test("saved-card charging uses authenticated deduplicated API routing", () => {
  const layer = route("post", "/stripe/saved-method");
  assert.ok(layer);
  assert.equal(layer.route.stack[0].name, "auth");
  assert.equal(layer.route.stack.length, 3);
  assert.notEqual(layer.route.stack[1].name, "chargeSavedPaymentMethod");
  assert.equal(layer.route.stack[2].name, "chargeSavedPaymentMethod");
});

test("saved-card charging requires staff and explicit customer authorization", async () => {
  let capture = responseCapture();
  await paymentCtrl.chargeSavedPaymentMethod(
    { user: { id: "customer", role: "regular" }, body: {} },
    capture.res
  );
  assert.equal(capture.statusCode, 403);

  capture = responseCapture();
  await paymentCtrl.chargeSavedPaymentMethod(
    { user: { id: "staff", role: "employee" }, body: {} },
    capture.res
  );
  assert.equal(capture.statusCode, 400);
  assert.match(capture.body.message, /authorization/i);
});

test("saved-card charging fails safely when Stripe is unavailable", async () => {
  const priorEnabled = process.env.STRIPE_ENABLED;
  const priorKey = process.env.STRIPE_SECRET_KEY;
  process.env.STRIPE_ENABLED = "false";
  delete process.env.STRIPE_SECRET_KEY;
  try {
    const capture = responseCapture();
    await paymentCtrl.chargeSavedPaymentMethod(
      {
        user: { id: "staff", role: "employee" },
        body: { customerAuthorized: true },
      },
      capture.res
    );
    assert.equal(capture.statusCode, 503);
    assert.match(capture.body.message, /unavailable/i);
  } finally {
    if (priorEnabled == null) delete process.env.STRIPE_ENABLED;
    else process.env.STRIPE_ENABLED = priorEnabled;
    if (priorKey == null) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = priorKey;
  }
});

test("employees cannot initiate refunds", async () => {
  const capture = responseCapture();
  await paymentCtrl.refundPayment(
    { user: { id: "staff", role: "employee" }, params: { id: "unused" } },
    capture.res
  );
  assert.equal(capture.statusCode, 403);
  assert.match(capture.body.message, /administrator/i);
});

test("Stripe payment status transitions cannot downgrade settled money", () => {
  for (const next of ["processing", "requires_action", "failed"]) {
    assert.equal(canApplyStripePaymentStatus("recorded", next), false);
    assert.equal(canApplyStripePaymentStatus("refunded", next), false);
  }
  assert.equal(canApplyStripePaymentStatus("processing", "recorded"), true);
  assert.equal(canApplyStripePaymentStatus("requires_action", "recorded"), true);
  assert.equal(canApplyStripePaymentStatus("failed", "recorded"), true);
});

test("payment ledger supports asynchronous Stripe and refund states", () => {
  const paymentStatuses = PaymentModel.schema.path("status").options.enum;
  for (const status of ["processing", "requires_action", "recorded", "failed", "refunded"]) {
    assert.ok(paymentStatuses.includes(status));
  }
  const refundStatus = PaymentModel.schema.path("refunds").schema.path("status").options.enum;
  assert.deepEqual(refundStatus, ["pending", "succeeded", "failed"]);
  assert.ok(
    PaymentModel.schema.indexes().some(
      ([keys, options]) => keys["stripe.paymentIntentId"] === 1 && options.unique
    )
  );
});

test("Stripe payment requests retain Checkout reconciliation fields", () => {
  assert.ok(PaymentRequestModel.schema.path("stripeCheckoutSessionId"));
  assert.ok(PaymentRequestModel.schema.path("stripePaymentIntentId"));
  assert.ok(PaymentRequestModel.schema.path("status").options.enum.includes("failed"));
});

test("webhooks reject requests when signature verification is unavailable", async () => {
  const priorEnabled = process.env.STRIPE_ENABLED;
  const priorKey = process.env.STRIPE_SECRET_KEY;
  const priorSecret = process.env.STRIPE_WEBHOOK_SECRET;
  process.env.STRIPE_ENABLED = "false";
  delete process.env.STRIPE_SECRET_KEY;
  delete process.env.STRIPE_WEBHOOK_SECRET;
  try {
    const capture = responseCapture();
    await paymentCtrl.handleStripeWebhook(
      { body: Buffer.from("{}"), get: () => "invalid" },
      capture.res
    );
    assert.equal(capture.statusCode, 503);
  } finally {
    if (priorEnabled == null) delete process.env.STRIPE_ENABLED;
    else process.env.STRIPE_ENABLED = priorEnabled;
    if (priorKey == null) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = priorKey;
    if (priorSecret == null) delete process.env.STRIPE_WEBHOOK_SECRET;
    else process.env.STRIPE_WEBHOOK_SECRET = priorSecret;
  }
});

test("mocked out-of-order Stripe webhooks cannot downgrade recorded payments", async () => {
  const priorEnabled = process.env.STRIPE_ENABLED;
  const priorKey = process.env.STRIPE_SECRET_KEY;
  const priorSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const originalUpdateOne = PaymentModel.updateOne;
  let updateFilter;
  process.env.STRIPE_ENABLED = "true";
  process.env.STRIPE_SECRET_KEY = "test-key-placeholder";
  process.env.STRIPE_WEBHOOK_SECRET = "test-webhook-placeholder";
  setPaymentStripeFactoryForTests(() => ({
    webhooks: {
      constructEvent: () => ({
        type: "payment_intent.processing",
        data: { object: { id: "pi_mock_processing" } },
      }),
    },
  }));
  PaymentModel.updateOne = async (filter) => {
    updateFilter = filter;
    return { modifiedCount: 0 };
  };
  try {
    const capture = responseCapture();
    await paymentCtrl.handleStripeWebhook(
      { body: Buffer.from("{}"), get: () => "mock-signature" },
      capture.res
    );
    assert.equal(capture.statusCode, 200);
    assert.deepEqual(updateFilter.status, { $nin: ["recorded", "refunded"] });
  } finally {
    PaymentModel.updateOne = originalUpdateOne;
    setPaymentStripeFactoryForTests();
    if (priorEnabled == null) delete process.env.STRIPE_ENABLED;
    else process.env.STRIPE_ENABLED = priorEnabled;
    if (priorKey == null) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = priorKey;
    if (priorSecret == null) delete process.env.STRIPE_WEBHOOK_SECRET;
    else process.env.STRIPE_WEBHOOK_SECRET = priorSecret;
  }
});

