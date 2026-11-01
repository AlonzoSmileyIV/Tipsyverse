import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";
import { mainContactLookup } from "../utils/libs/eventMainContact.js";

test("verified contact user association takes priority over organizer and email", () => {
  const contactId = new mongoose.Types.ObjectId();
  const organizerId = new mongoose.Types.ObjectId();
  assert.deepEqual(
    mainContactLookup({
      organizer: organizerId,
      contact: { userId: contactId, email: "contact@example.com" },
    }),
    { type: "userId", value: contactId }
  );
});

test("main contact lookup never falls back to the event organizer", () => {
  assert.equal(
    mainContactLookup({ organizer: new mongoose.Types.ObjectId(), contact: {} }),
    null
  );
});

test("normalized contact email is used only without a user association", () => {
  assert.deepEqual(
    mainContactLookup({ contact: { email: "  Customer@Example.COM " } }),
    { type: "email", value: "customer@example.com" }
  );
});

test("an invalid persisted user association fails closed", () => {
  assert.equal(
    mainContactLookup({
      organizer: new mongoose.Types.ObjectId(),
      contact: { userId: "not-an-object-id", email: "other@example.com" },
    }),
    null
  );
});

