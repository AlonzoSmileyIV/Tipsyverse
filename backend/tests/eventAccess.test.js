import test from "node:test";
import assert from "node:assert/strict";
import { canCancelEvent, eventAccessLevel } from "../utils/libs/eventAccess.js";

const event = {
  organizer: "customer-a",
  contact: { userId: "customer-a", email: "customer-a@example.com" },
  status: "ready_to_assign",
};

test("an unrelated customer cannot view a copied private event URL", () => {
  assert.equal(
    eventAccessLevel({
      event,
      user: { id: "customer-b", email: "customer-b@example.com", role: "regular" },
    }),
    "none"
  );
});

test("the event owner can view their event by user id or normalized email", () => {
  assert.equal(eventAccessLevel({ event, user: { id: "customer-a", role: "regular" } }), "full");
  assert.equal(
    eventAccessLevel({ event, user: { id: "other-id", email: "CUSTOMER-A@example.com", role: "regular" } }),
    "full"
  );
});

test("employees and assigned bartenders receive full access", () => {
  assert.equal(eventAccessLevel({ event, user: { id: "staff", role: "Supervisor" } }), "full");
  assert.equal(
    eventAccessLevel({ event, user: { id: "bartender", role: "bartender" }, isAssigned: true }),
    "full"
  );
});

test("unassigned bartenders only receive masked access to assignable events", () => {
  assert.equal(eventAccessLevel({ event, user: { id: "bartender", role: "bartender" } }), "masked");
  assert.equal(
    eventAccessLevel({
      event: { ...event, status: "confirmed" },
      user: { id: "bartender", role: "bartender" },
    }),
    "none"
  );
});

test("only staff or the customer who owns an event can cancel it", () => {
  assert.equal(
    canCancelEvent({ event, user: { id: "customer-a", role: "regular" } }),
    true
  );
  assert.equal(
    canCancelEvent({ event, user: { id: "staff", role: "employee" } }),
    true
  );
  assert.equal(
    canCancelEvent({ event, user: { id: "customer-b", role: "regular" } }),
    false
  );
  assert.equal(
    canCancelEvent({ event, user: { id: "bartender", role: "bartender" } }),
    false
  );
});

test("contact-linked customers receive full access for payment requests", () => {
  assert.equal(
    eventAccessLevel({
      event,
      user: { id: "other-id", email: "customer-a@example.com", role: "regular" },
    }),
    "full"
  );
  assert.equal(
    eventAccessLevel({
      event,
      user: { id: "customer-b", email: "customer-b@example.com", role: "regular" },
    }),
    "none"
  );
});
