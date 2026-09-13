import assert from "node:assert/strict";
import test from "node:test";
import { EventModel as Event } from "../models/index.js";

const baseEvent = (type) => ({
  type,
  startAt: new Date("2026-10-01T22:00:00.000Z"),
  endAt: new Date("2026-10-02T02:00:00.000Z"),
  location: { address1: "1 Main St" },
  contact: { fullName: "Guest", email: "guest@example.com" },
});

for (const input of ["private_dinner", "Private Dinner", "private dinner", "private-dinner", "private"]) {
  test(`normalizes ${input} to private_dinner`, () => {
    const event = new Event(baseEvent(input));
    const validationError = event.validateSync();

    assert.equal(validationError, undefined);
    assert.equal(event.type, "private_dinner");
  });
}
