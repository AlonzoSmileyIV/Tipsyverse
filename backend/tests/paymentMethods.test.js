import assert from "node:assert/strict";
import test from "node:test";
import paymentMethodRouter from "../routers/libs/paymentmethod.routers.js";
import paymentMethodCtrl, {
  canManagePaymentMethodOwner,
  normalizeBillingAddress,
  normalizeNickname,
} from "../controllers/libs/paymentmethod.ctrl.js";
import { PaymentMethodModel, UserModel } from "../models/index.js";

const route = (method, path) =>
  paymentMethodRouter.stack.find(
    (layer) => layer.route?.path === path && layer.route?.methods?.[method]
  );

test("payment method routes expose authenticated create, edit, delete, and default operations", () => {
  for (const [method, path] of [
    ["post", "/setup-intent"],
    ["post", "/"],
    ["get", "/"],
    ["get", "/event/:eventId"],
    ["get", "/:userId"],
    ["patch", "/:id"],
    ["patch", "/:id/set-default"],
    ["delete", "/:id"],
  ]) {
    const layer = route(method, path);
    assert.ok(layer, `${method.toUpperCase()} ${path} should exist`);
    assert.equal(layer.route.stack[0].name, "auth");
  }
});

test("ownership permits self and staff but rejects unrelated users", () => {
  assert.equal(canManagePaymentMethodOwner({ id: "owner", role: "regular" }, "owner"), true);
  assert.equal(canManagePaymentMethodOwner({ id: "other", role: "employee" }, "owner"), true);
  assert.equal(canManagePaymentMethodOwner({ id: "other", role: "admin" }, "owner"), true);
  assert.equal(canManagePaymentMethodOwner({ id: "other", role: "regular" }, "owner"), false);
  assert.equal(canManagePaymentMethodOwner({ id: "other", role: "bartender" }, "owner"), false);
});

test("nickname normalization supports case-insensitive uniqueness", () => {
  assert.equal(normalizeNickname("  Family Card  "), "Family Card");
  const index = PaymentMethodModel.schema.indexes().find(
    ([keys]) => keys.owner === 1 && keys.nicknameKey === 1
  );
  assert.ok(index);
  assert.equal(index[1].unique, true);
  assert.equal(PaymentMethodModel.schema.path("nickname").options.required, true);
});

test("payment method validation derives the normalized nickname key", async () => {
  const method = new PaymentMethodModel({
    owner: "507f1f77bcf86cd799439011",
    provider: "stripe",
    type: "card",
    externalId: "pm_test",
    nickname: "  Travel CARD ",
  });
  await method.validate();
  assert.equal(method.nickname, "Travel CARD");
  assert.equal(method.nicknameKey, "travel card");
});

test("billing address normalization trims complete Stripe-safe fields", () => {
  assert.deepEqual(
    normalizeBillingAddress({
      address1: " 123 Main St ", city: " Indianapolis ", state: " IN ",
      zipcode: " 46204 ", country: "us",
    }),
    {
      address1: "123 Main St", address2: "", city: "Indianapolis", county: "",
      state: "IN", zipcode: "46204", country: "US", placeId: "", formatted: "",
      latitude: null, longitude: null,
    }
  );
});

test("user schema persists one reusable Stripe customer association", () => {
  assert.ok(UserModel.schema.path("stripeCustomerId"));
  assert.equal(UserModel.schema.path("stripeCustomerId").options.select, false);
});

test("Stripe-disabled setup, creation, editing, deletion, and defaults fail safely", async () => {
  const priorEnabled = process.env.STRIPE_ENABLED;
  const priorKey = process.env.STRIPE_SECRET_KEY;
  process.env.STRIPE_ENABLED = "false";
  delete process.env.STRIPE_SECRET_KEY;
  const handlers = [
    paymentMethodCtrl.createSetupIntent,
    paymentMethodCtrl.createPaymentMethod,
    paymentMethodCtrl.updatePaymentMethod,
    paymentMethodCtrl.deletePaymentMethod,
    paymentMethodCtrl.setDefaultPaymentMethod,
  ];
  try {
    for (const handler of handlers) {
      let status;
      let body;
      const res = {
        status(value) { status = value; return this; },
        json(value) { body = value; return this; },
      };
      await handler({ body: {}, params: {}, user: { id: "owner", role: "regular" } }, res);
      assert.equal(status, 503, `${handler.name} should return unavailable`);
      assert.equal(body.message, "Card storage is unavailable.", handler.name);
    }
  } finally {
    if (priorEnabled == null) delete process.env.STRIPE_ENABLED;
    else process.env.STRIPE_ENABLED = priorEnabled;
    if (priorKey == null) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = priorKey;
  }
});
