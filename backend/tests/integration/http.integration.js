import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import mongoose from "mongoose";
import request from "supertest";
import jwt from "jsonwebtoken";

const mongoUri = process.env.TEST_MONGO_URI;
if (!mongoUri || !new URL(mongoUri).pathname.includes("tipsyverse_integration")) {
  throw new Error(
    "TEST_MONGO_URI must target an explicitly named tipsyverse_integration database."
  );
}

process.env.NODE_ENV = "test";
process.env.API_URL = "/api/v1";
process.env.ACCESS_TOKEN_SECRET = "integration-access-secret-at-least-32-characters";
process.env.REFRESH_TOKEN_SECRET =
  "integration-refresh-secret-at-least-32-characters";

const { app } = await import("../../server.js");
const {
  EventModel,
  PaymentRequestModel,
  UserModel,
} = await import("../../models/index.js");

const tokenFor = (user) =>
  jwt.sign(
    {
      id: String(user._id),
      email: user.email,
      role: user.role,
      sessionStartedAt: Date.now(),
    },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: "15m" }
  );

let owner;
let unrelatedCustomer;
let employee;
let event;
let paymentRequest;

before(async () => {
  await mongoose.connect(mongoUri);
  [owner, unrelatedCustomer, employee] = await UserModel.create([
    {
      username: "integration.owner",
      email: "owner.integration@example.com",
      fullName: "Integration Owner",
      passwordHash: "not-used-in-this-test",
      role: "regular",
    },
    {
      username: "integration.other",
      email: "other.integration@example.com",
      fullName: "Unrelated Customer",
      passwordHash: "not-used-in-this-test",
      role: "regular",
    },
    {
      username: "integration.employee",
      email: "employee.integration@example.com",
      fullName: "Integration Employee",
      passwordHash: "not-used-in-this-test",
      role: "employee",
    },
  ]);
  event = await EventModel.create({
    organizer: owner._id,
    type: "birthday",
    private: true,
    location: {
      address1: "123 Integration Way",
      city: "Indianapolis",
      state: "IN",
      zipcode: "46204",
      timezone: "America/Indiana/Indianapolis",
    },
    timezone: "America/Indiana/Indianapolis",
    startAt: new Date("2026-10-10T21:00:00.000Z"),
    endAt: new Date("2026-10-11T01:00:00.000Z"),
    contact: {
      fullName: owner.fullName,
      email: owner.email,
    },
    status: "submitted",
    payment: { total: 500, balance: 500 },
  });
  paymentRequest = await PaymentRequestModel.create({
    event: event._id,
    provider: "other",
    paymentType: "custom",
    amountRequested: 500,
    sentTo: { fullName: owner.fullName, email: owner.email },
    sentBy: employee._id,
    status: "sent",
  });
});

after(async () => {
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
});

test("readiness reflects a real MongoDB connection", async () => {
  const response = await request(app).get("/api/v1/ready").expect(200);
  assert.deepEqual(response.body, { success: true, status: "ready" });
});

test("event persistence synchronizes both staffing requirement fields", async () => {
  const saved = await EventModel.findById(event._id).lean();
  assert.equal(saved.counts.neededBartenders, 1);
  assert.equal(saved.pricing.bartendersRequested, 1);
});

test("login validates malformed input before querying", async () => {
  const response = await request(app)
    .post("/api/v1/users/login")
    .send({ password: "example-password" })
    .expect(400);

  assert.equal(response.body.code, "VALIDATION_ERROR");
  assert.equal(
    response.body.issues.some(({ field }) => field === "emailOrUsername"),
    true
  );
});

test("login queries MongoDB and returns a generic credential failure", async () => {
  const response = await request(app)
    .post("/api/v1/users/login")
    .send({
      emailOrUsername: "missing@example.com",
      password: "example-password",
    })
    .expect(400);

  assert.equal(response.body.message, "Invalid credentials.");
});

test("private event details are visible to the owner but hidden from another customer", async () => {
  const ownerResponse = await request(app)
    .get(`/api/v1/events/${event._id}`)
    .set("Authorization", `Bearer ${tokenFor(owner)}`)
    .expect(200);
  assert.equal(ownerResponse.body.data.shortCode, event.shortCode);

  const unrelatedResponse = await request(app)
    .get(`/api/v1/events/${event._id}`)
    .set("Authorization", `Bearer ${tokenFor(unrelatedCustomer)}`)
    .expect(404);
  assert.equal(unrelatedResponse.body.message, "Not found");
});

test("payment requests are visible only to the owning customer or staff", async () => {
  const ownerResponse = await request(app)
    .get(`/api/v1/payment-requests/${paymentRequest._id}`)
    .set("Authorization", `Bearer ${tokenFor(owner)}`)
    .expect(200);
  assert.equal(ownerResponse.body.data._id, String(paymentRequest._id));

  await request(app)
    .get(`/api/v1/payment-requests/${paymentRequest._id}`)
    .set("Authorization", `Bearer ${tokenFor(unrelatedCustomer)}`)
    .expect(403);

  const staffResponse = await request(app)
    .get(`/api/v1/payment-requests/${paymentRequest._id}`)
    .set("Authorization", `Bearer ${tokenFor(employee)}`)
    .expect(200);
  assert.equal(staffResponse.body.data._id, String(paymentRequest._id));
});

test("an unrelated customer cannot cancel another customer's event", async () => {
  await request(app)
    .post(`/api/v1/events/${event._id}/cancel`)
    .set("Authorization", `Bearer ${tokenFor(unrelatedCustomer)}`)
    .send({ cancelReason: "other", cancelReasonOther: "Unauthorized test" })
    .expect(404);

  const unchanged = await EventModel.findById(event._id).lean();
  assert.equal(unchanged.status, "submitted");
  assert.equal(unchanged.canceledAt, null);
});
