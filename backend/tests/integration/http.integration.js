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
// Integration tests must never deliver real email, even when a developer's
// local environment contains valid provider credentials.
process.env.RESEND_EMAIL_KEY = "";

const { app } = await import("../../server.js");
const {
  EventModel,
  AssignmentModel,
  BidModel,
  PaymentModel,
  PaymentRequestModel,
  UserModel,
  AuthSessionModel,
} = await import("../../models/index.js");
const { storeComplianceDocument } = await import("../../utils/libs/complianceDocumentStore.js");
const { hashRefreshTokenId, refreshSessionExpiresAt } = await import(
  "../../utils/libs/refreshSession.js"
);
const { default: createRefreshToken } = await import(
  "../../utils/libs/createRefreshToken.js"
);

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
let recordedPaymentId;

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

test("public stats count only completed or closed events as events served", async () => {
  await EventModel.create([
    {
      organizer: owner._id,
      type: "birthday",
      location: { address1: "1 Completed Way", city: "Indianapolis", state: "IN" },
      startAt: new Date("2026-07-10T21:00:00.000Z"),
      endAt: new Date("2026-07-11T01:00:00.000Z"),
      contact: { fullName: owner.fullName, email: owner.email },
      status: "completed",
    },
    {
      organizer: owner._id,
      type: "corporate",
      location: { address1: "2 Canceled Way", city: "Indianapolis", state: "IN" },
      startAt: new Date("2026-07-12T21:00:00.000Z"),
      endAt: new Date("2026-07-13T01:00:00.000Z"),
      contact: { fullName: owner.fullName, email: owner.email },
      status: "canceled",
    },
  ]);

  const response = await request(app).get("/api/v1/stats").expect(200);
  assert.equal(response.body.totalEventsCompleted, 1);
});

test("event persistence synchronizes both staffing requirement fields", async () => {
  const saved = await EventModel.findById(event._id).lean();
  assert.equal(saved.counts.recommendedBartenders, 1);
  assert.equal(saved.counts.approvedBartenders, 1);
  assert.equal(saved.counts.neededBartenders, 1);
  assert.equal(saved.pricing.bartendersRequested, 1);
});

const bookingPayload = (overrides = {}) => ({
  type: "birthday",
  description: "Integration booking",
  startAt: "2027-09-12T21:00:00.000Z",
  endAt: "2027-09-13T01:00:00.000Z",
  timezone: "America/Indiana/Indianapolis",
  contact: {
    fullName: owner.fullName,
    email: owner.email,
    phone: "+13175550100",
    preferred: "email",
  },
  location: {
    address1: "100 Booking Test Way",
    city: "Indianapolis",
    state: "IN",
    zipcode: "46204",
    country: "US",
    formatted: "100 Booking Test Way, Indianapolis, IN 46204",
  },
  agreements: { acceptedTerms: true, customerConfirmed: true },
  ...overrides,
});

test("booking without a guest count succeeds with safe initial staffing", async () => {
  const response = await request(app)
    .post("/api/v1/events")
    .set("Authorization", `Bearer ${tokenFor(owner)}`)
    .send(bookingPayload())
    .expect(201);

  assert.equal(response.body.data.guestCount, undefined);
  assert.equal(response.body.data.counts.recommendedBartenders, 1);
  assert.equal(response.body.data.counts.approvedBartenders, 1);
  assert.equal(response.body.data.pricing.bartendersRequested, 1);
});

test("booking uses a supplied guest count for initial staffing", async () => {
  const response = await request(app)
    .post("/api/v1/events")
    .set("Authorization", `Bearer ${tokenFor(owner)}`)
    .send(bookingPayload({
      guestCount: 100,
      startAt: "2027-09-14T21:00:00.000Z",
      endAt: "2027-09-15T01:00:00.000Z",
    }))
    .expect(201);

  assert.equal(response.body.data.guestCount, 100);
  assert.equal(response.body.data.counts.recommendedBartenders, 2);
  assert.equal(response.body.data.counts.approvedBartenders, 2);
  assert.equal(response.body.data.pricing.bartendersRequested, 2);
});

test("staff can approve fewer bartenders than recommended with a documented reason", async () => {
  const staffingEvent = await EventModel.create({
    organizer: owner._id,
    type: "corporate",
    location: {
      address1: "456 Staffing Avenue",
      timezone: "America/Indiana/Indianapolis",
    },
    startAt: new Date("2026-11-10T21:00:00.000Z"),
    endAt: new Date("2026-11-11T01:00:00.000Z"),
    guestCount: 50,
    contact: { fullName: owner.fullName, email: owner.email },
    counts: {
      recommendedBartenders: 1,
      approvedBartenders: 1,
      neededBartenders: 1,
    },
    pricing: { bartendersRequested: 1, hourlyRate: 40 },
  });

  await request(app)
    .patch(`/api/v1/events/${staffingEvent._id}`)
    .set("Authorization", `Bearer ${tokenFor(employee)}`)
    .send({
      guestCount: 100,
      counts: { recommendedBartenders: 2, approvedBartenders: 1 },
    })
    .expect(400);

  await request(app)
    .patch(`/api/v1/events/${staffingEvent._id}`)
    .set("Authorization", `Bearer ${tokenFor(employee)}`)
    .send({
      guestCount: 100,
      counts: { recommendedBartenders: 2, approvedBartenders: 1 },
      staffingException: {
        reason: "Customer approved a limited menu while a second opening remains unfilled.",
      },
    })
    .expect(200);

  const saved = await EventModel.findById(staffingEvent._id).lean();
  assert.equal(saved.counts.recommendedBartenders, 2);
  assert.equal(saved.counts.approvedBartenders, 1);
  assert.equal(saved.counts.neededBartenders, 1);
  assert.equal(saved.pricing.bartendersRequested, 1);
  assert.equal(saved.staffingException.active, true);
  assert.equal(saved.staffingException.approvedBy.toString(), employee._id.toString());
  assert.match(saved.staffingException.reason, /limited menu/);
});

test("contact-only edits normalize values without repricing the event", async () => {
  const contactEvent = await EventModel.create({
    organizer: owner._id,
    type: "birthday",
    location: { address1: "500 Contact Way", city: "Indianapolis", state: "IN" },
    startAt: new Date("2027-01-10T21:00:00.000Z"),
    endAt: new Date("2027-01-11T01:00:00.000Z"),
    contact: { fullName: owner.fullName, email: owner.email },
    pricing: { hourlyRate: 40, bartendersRequested: 1 },
    payment: { total: 500, balance: 500 },
  });

  await request(app)
    .patch(`/api/v1/events/${contactEvent._id}`)
    .set("Authorization", `Bearer ${tokenFor(employee)}`)
    .send({
      contact: {
        fullName: "  Anne-Marie O'Connor  ",
        email: "  qa.contact@example.com  ",
        phone: "  +1 317 555 0199  ",
        preferred: "call",
      },
    })
    .expect(200);

  const saved = await EventModel.findById(contactEvent._id).lean();
  assert.equal(saved.contact.fullName, "Anne-Marie O'Connor");
  assert.equal(saved.contact.email, "qa.contact@example.com");
  assert.equal(saved.payment.total, 500);
  assert.equal(saved.payment.balance, 500);
});

test("approved staffing cannot be reduced below active assignments", async () => {
  const bartenders = await UserModel.create([
    {
      username: "integration.assigned1",
      email: "assigned1.integration@example.com",
      fullName: "Assigned Integration Bartender One",
      passwordHash: "not-used",
      role: "bartender",
    },
    {
      username: "integration.assigned2",
      email: "assigned2.integration@example.com",
      fullName: "Assigned Integration Bartender Two",
      passwordHash: "not-used",
      role: "bartender",
    },
  ]);
  const staffingEvent = await EventModel.create({
    organizer: owner._id,
    type: "corporate",
    location: { address1: "600 Staffing Way", city: "Indianapolis", state: "IN" },
    startAt: new Date("2027-02-10T21:00:00.000Z"),
    endAt: new Date("2027-02-11T01:00:00.000Z"),
    contact: { fullName: owner.fullName, email: owner.email },
    counts: { recommendedBartenders: 2, approvedBartenders: 2, neededBartenders: 2, assigned: 2 },
    pricing: { bartendersRequested: 2, hourlyRate: 40 },
  });
  await AssignmentModel.create(
    bartenders.map((bartender) => ({
      event: staffingEvent._id,
      bartenderUser: bartender._id,
      status: "active",
    }))
  );

  const response = await request(app)
    .patch(`/api/v1/events/${staffingEvent._id}`)
    .set("Authorization", `Bearer ${tokenFor(employee)}`)
    .send({ counts: { approvedBartenders: 1 } })
    .expect(409);
  assert.match(response.body.message, /Remove or replace assigned bartenders first/);
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

test("an overlapping stale refresh does not revoke a newly rotated session", async () => {
  const sessionStartedAt = Date.now();
  const sessionId = "integration-refresh-overlap";
  const tokenId = "integration-refresh-token-1";
  const refreshToken = createRefreshToken({
    id: String(owner._id),
    email: owner.email,
    username: owner.username,
    fullName: owner.fullName,
    role: owner.role,
    sessionStartedAt,
    sid: sessionId,
    jti: tokenId,
  });
  await AuthSessionModel.create({
    sessionId,
    user: owner._id,
    currentTokenHash: hashRefreshTokenId(tokenId),
    sessionStartedAt: new Date(sessionStartedAt),
    expiresAt: refreshSessionExpiresAt(sessionStartedAt),
  });

  const first = await request(app)
    .post("/api/v1/users/refresh-token")
    .set("Cookie", `refreshToken=${refreshToken}`)
    .expect(200);
  assert.ok(first.body.accessToken);

  const overlap = await request(app)
    .post("/api/v1/users/refresh-token")
    .set("Cookie", `refreshToken=${refreshToken}`)
    .expect(200);
  assert.ok(overlap.body.accessToken);

  const session = await AuthSessionModel.findOne({ sessionId });
  assert.equal(session.revokedAt, null);
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

test("only staff can record a payment and the event balance synchronizes", async () => {
  await request(app)
    .post("/api/v1/payments")
    .set("Authorization", `Bearer ${tokenFor(owner)}`)
    .send({ event: event._id, amount: 200, method: "cash" })
    .expect(403);

  const response = await request(app)
    .post("/api/v1/payments")
    .set("Authorization", `Bearer ${tokenFor(employee)}`)
    .send({
      event: event._id,
      paymentRequest: paymentRequest._id,
      amount: 200,
      method: "cash",
      reference: "integration-payment",
    })
    .expect(201);

  recordedPaymentId = response.body.data._id;
  const synchronized = await EventModel.findById(event._id).lean();
  assert.equal(synchronized.payment.total, 500);
  assert.equal(synchronized.payment.paidTotal, 200);
  assert.equal(synchronized.payment.balance, 300);
  assert.equal(synchronized.payment.status, "partially_paid");
  const partialRequest = await PaymentRequestModel.findById(
    paymentRequest._id
  ).lean();
  assert.equal(partialRequest.status, "sent");
});

test("payment edits reject invalid amounts and resynchronize the balance", async () => {
  await request(app)
    .patch(`/api/v1/payments/${recordedPaymentId}`)
    .set("Authorization", `Bearer ${tokenFor(employee)}`)
    .send({ amount: -10 })
    .expect(400);

  await request(app)
    .patch(`/api/v1/payments/${recordedPaymentId}`)
    .set("Authorization", `Bearer ${tokenFor(employee)}`)
    .send({ amount: 150, notes: "Adjusted by integration smoke test" })
    .expect(200);

  const synchronized = await EventModel.findById(event._id).lean();
  assert.equal(synchronized.payment.paidTotal, 150);
  assert.equal(synchronized.payment.balance, 350);
  assert.equal(
    await PaymentModel.countDocuments({ event: event._id, status: "recorded" }),
    1
  );
});

test("overpayments are rejected without changing the payment ledger", async () => {
  await request(app)
    .post("/api/v1/payments")
    .set("Authorization", `Bearer ${tokenFor(employee)}`)
    .send({ event: event._id, amount: 351, method: "cash" })
    .expect(400);

  assert.equal(
    await PaymentModel.countDocuments({ event: event._id, status: "recorded" }),
    1
  );
});

test("concurrent payments cannot consume the same remaining balance", async () => {
  const concurrentEvent = await EventModel.create({
    organizer: owner._id,
    type: "corporate",
    location: { address1: "700 Ledger Way", city: "Indianapolis", state: "IN" },
    startAt: new Date("2027-03-10T21:00:00.000Z"),
    endAt: new Date("2027-03-11T01:00:00.000Z"),
    contact: { fullName: owner.fullName, email: owner.email },
    status: "confirmed",
    payment: { total: 100, balance: 100 },
  });
  const makePayment = (reference) =>
    request(app)
      .post("/api/v1/payments")
      .set("Authorization", `Bearer ${tokenFor(employee)}`)
      .send({ event: concurrentEvent._id, amount: 60, method: "cash", reference });

  const responses = await Promise.all([makePayment("race-a"), makePayment("race-b")]);
  assert.deepEqual(responses.map(({ status }) => status).sort(), [201, 409]);
  assert.equal(
    await PaymentModel.countDocuments({ event: concurrentEvent._id, status: "recorded" }),
    1
  );
  const saved = await EventModel.findById(concurrentEvent._id).lean();
  assert.equal(saved.payment.paidTotal, 60);
  assert.equal(saved.payment.balance, 40);
});

test("cancellation releases operational records in the same transaction", async () => {
  const bartender = await UserModel.create({
    username: "integration.cancelledbartender",
    email: "cancelled.bartender@example.com",
    fullName: "Cancellation Bartender",
    passwordHash: "not-used",
    role: "bartender",
  });
  const cancelEvent = await EventModel.create({
    organizer: owner._id,
    type: "corporate",
    location: { address1: "800 Cancel Way", city: "Indianapolis", state: "IN" },
    startAt: new Date("2027-04-10T21:00:00.000Z"),
    endAt: new Date("2027-04-11T01:00:00.000Z"),
    contact: { fullName: owner.fullName, email: owner.email },
    status: "confirmed",
    visibility: { onBiddingBoard: true },
    counts: { recommendedBartenders: 1, approvedBartenders: 1, neededBartenders: 1, assigned: 1 },
    payment: { total: 100, balance: 100 },
  });
  await AssignmentModel.create({ event: cancelEvent._id, bartenderUser: bartender._id });
  await BidModel.create({ event: cancelEvent._id, bartenderUser: bartender._id, status: "selected" });
  const openRequest = await PaymentRequestModel.create({
    event: cancelEvent._id,
    provider: "other",
    paymentType: "full",
    amountRequested: 100,
    status: "sent",
  });

  await request(app)
    .post(`/api/v1/events/${cancelEvent._id}/cancel`)
    .set("Authorization", `Bearer ${tokenFor(employee)}`)
    .send({ cancelReason: "unable_to_staff" })
    .expect(200);

  const [saved, assignment, bid, savedRequest] = await Promise.all([
    EventModel.findById(cancelEvent._id).lean(),
    AssignmentModel.findOne({ event: cancelEvent._id }).lean(),
    BidModel.findOne({ event: cancelEvent._id }).lean(),
    PaymentRequestModel.findById(openRequest._id).lean(),
  ]);
  assert.equal(saved.status, "canceled");
  assert.equal(saved.cancelReason, "unable_to_staff");
  assert.equal(saved.counts.assigned, 0);
  assert.equal(saved.visibility.onBiddingBoard, false);
  assert.equal(saved.payment.balance, 0);
  assert.equal(saved.payment.policyStatus, "canceled");
  assert.equal(saved.cancellation.refundEligibleAmount, 0);
  assert.equal(saved.cancellation.refundReviewStatus, "not_required");
  assert.equal(saved.cancellation.automaticRefund, false);
  assert.equal(assignment.status, "removed");
  assert.equal(bid.status, "dropped");
  assert.equal(savedRequest.status, "cancelled");
});

test("event price increases and decreases keep the payment ledger and balance aligned", async () => {
  await request(app)
    .patch(`/api/v1/events/${event._id}`)
    .set("Authorization", `Bearer ${tokenFor(employee)}`)
    .send({ pricing: { hourlyRate: 10 } })
    .expect(200);

  const increased = await EventModel.findById(event._id).lean();
  assert.equal(increased.payment.paidTotal, 150);
  assert.ok(increased.payment.total > 500);
  assert.equal(
    increased.payment.balance,
    Math.round((increased.payment.total - 150) * 100) / 100
  );

  await request(app)
    .patch(`/api/v1/events/${event._id}`)
    .set("Authorization", `Bearer ${tokenFor(employee)}`)
    .send({ pricing: { hourlyRate: 0 } })
    .expect(200);

  const decreased = await EventModel.findById(event._id).lean();
  assert.equal(decreased.payment.total, 500);
  assert.equal(decreased.payment.paidTotal, 150);
  assert.equal(decreased.payment.balance, 350);
  assert.equal(
    await PaymentModel.countDocuments({ event: event._id }),
    1,
    "price changes must not create a refund or duplicate payment"
  );
});

test("voiding a payment restores the balance and reopens its request", async () => {
  await request(app)
    .patch(`/api/v1/payments/${recordedPaymentId}/void`)
    .set("Authorization", `Bearer ${tokenFor(employee)}`)
    .send({ voidReason: "Integration smoke test" })
    .expect(200);

  const synchronized = await EventModel.findById(event._id).lean();
  assert.equal(synchronized.payment.paidTotal, 0);
  assert.equal(synchronized.payment.balance, 500);
  assert.equal(synchronized.payment.status, "none");
  const reopenedRequest = await PaymentRequestModel.findById(
    paymentRequest._id
  ).lean();
  assert.equal(reopenedRequest.status, "cancelled");
});

const compliantProfile = ({ state = "IN", status = "active", expiresAt = "2030-12-31" } = {}) => ({
  status: "approved",
  eligible: true,
  licenses: [{
    state,
    permitNumber: `INTEGRATION-${state}`,
    expiresAt: new Date(expiresAt),
    verified: status === "active",
    status,
    serverTraining: {
      attestedAuthenticAndCurrent: true,
      attestedRequiredTraining: true,
      status: status === "active" ? "verified" : status === "denied" ? "rejected" : status,
    },
  }],
});

const assignableEvent = (overrides = {}) => EventModel.create({
  organizer: owner._id,
  type: "corporate",
  location: { address1: "800 Compliance Way", city: "Indianapolis", state: "IN" },
  startAt: new Date("2027-10-10T21:00:00.000Z"),
  endAt: new Date("2027-10-11T01:00:00.000Z"),
  contact: { fullName: owner.fullName, email: owner.email },
  status: "ready_to_assign",
  counts: { recommendedBartenders: 1, approvedBartenders: 1, neededBartenders: 1 },
  pricing: { bartendersRequested: 1, hourlyRate: 40 },
  ...overrides,
});

test("a matching-state verified permit allows bidding while the wrong state is blocked", async () => {
  const [matching, wrongState] = await UserModel.create([
    { username: "integration.matching", email: "matching.bartender@example.com", fullName: "Matching Bartender",
      passwordHash: "not-used", role: "bartender", bartenderProfile: compliantProfile() },
    { username: "integration.wrongstate", email: "wrongstate.bartender@example.com", fullName: "Wrong State Bartender",
      passwordHash: "not-used", role: "bartender", bartenderProfile: compliantProfile({ state: "OH" }) },
  ]);
  const complianceEvent = await assignableEvent();

  await request(app).post("/api/v1/bids/toggle-interest")
    .set("Authorization", `Bearer ${tokenFor(matching)}`).send({ eventId: complianceEvent._id }).expect(200);
  const blocked = await request(app).post("/api/v1/bids/toggle-interest")
    .set("Authorization", `Bearer ${tokenFor(wrongState)}`).send({ eventId: complianceEvent._id }).expect(409);
  assert.equal(blocked.body.code, "STATE_PERMIT_COMPLIANCE_REQUIRED");
  assert.equal(await BidModel.countDocuments({ event: complianceEvent._id, bartenderUser: wrongState._id }), 0);
});

test("pending, rejected, and expired permits are blocked during assignment", async () => {
  for (const [index, state] of ["pending", "denied", "expired"].entries()) {
    const bartender = await UserModel.create({
      username: `integration.blocked${index}`,
      email: `blocked${index}.bartender@example.com`,
      fullName: `Blocked Bartender ${index}`,
      passwordHash: "not-used",
      role: "bartender",
      bartenderProfile: compliantProfile({ status: state, expiresAt: state === "expired" ? "2020-01-01" : "2030-12-31" }),
    });
    const complianceEvent = await assignableEvent({
      startAt: new Date(`2027-11-${10 + index}T21:00:00.000Z`),
      endAt: new Date(`2027-11-${11 + index}T01:00:00.000Z`),
    });
    const bid = await BidModel.create({ event: complianceEvent._id, bartenderUser: bartender._id,
      status: "interested", score: 1, submittedAt: new Date() });
    const response = await request(app).post(`/api/v1/events/${complianceEvent._id}/assign-bartenders`)
      .set("Authorization", `Bearer ${tokenFor(employee)}`).send({ bidIds: [bid._id] }).expect(409);
    assert.equal(response.body.code, "STATE_PERMIT_COMPLIANCE_REQUIRED");
    assert.equal(await AssignmentModel.countDocuments({ event: complianceEvent._id }), 0);
  }
});

test("optional document absence is reported accurately in the admin license list", async () => {
  const bartender = await UserModel.create({
    username: "integration.nodocument", email: "nodocument.bartender@example.com", fullName: "No Document",
    passwordHash: "not-used", role: "bartender", bartenderProfile: compliantProfile(),
  });
  const response = await request(app).get("/api/v1/users/admin/licenses")
    .set("Authorization", `Bearer ${tokenFor(employee)}`).expect(200);
  const row = response.body.data.find((item) => String(item.bartenderId) === String(bartender._id));
  assert.equal(row.serverTraining.hasVerificationDocument, false);
});

test("compliance documents are private to their owner and staff", async () => {
  const [documentOwner, unrelatedBartender] = await UserModel.create([
    { username: "integration.documentowner", email: "document.owner@example.com", fullName: "Document Owner",
      passwordHash: "not-used", role: "bartender", bartenderProfile: compliantProfile() },
    { username: "integration.documentother", email: "document.other@example.com", fullName: "Document Other",
      passwordHash: "not-used", role: "bartender", bartenderProfile: compliantProfile() },
  ]);
  const license = documentOwner.bartenderProfile.licenses[0];
  const payload = Buffer.from("%PDF-1.4\nintegration-private-document\n%%EOF");
  const fileId = await storeComplianceDocument({ buffer: payload, mimeType: "application/pdf",
    ownerId: documentOwner._id, licenseId: license._id });
  license.serverTraining.proofDocument = { fileId, mimeType: "application/pdf", size: payload.length, uploadedAt: new Date() };
  await documentOwner.save();
  const path = `/api/v1/users/licenses/${license._id}/verification-document`;

  const ownerResponse = await request(app).get(path)
    .set("Authorization", `Bearer ${tokenFor(documentOwner)}`).expect(200);
  assert.equal(Buffer.compare(ownerResponse.body, payload), 0);
  await request(app).get(path).set("Authorization", `Bearer ${tokenFor(employee)}`).expect(200);
  await request(app).get(path).set("Authorization", `Bearer ${tokenFor(unrelatedBartender)}`).expect(404);
});
