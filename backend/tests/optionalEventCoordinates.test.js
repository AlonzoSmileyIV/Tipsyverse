import test from "node:test";
import assert from "node:assert/strict";
import { EventModel as Event } from "../models/index.js";
import { normalizeLocation } from "../utils/libs/normalizeLocation.js";

const eventWithLocation = (location) =>
  new Event({
    type: "birthday",
    startAt: new Date("2030-01-01T17:00:00.000Z"),
    endAt: new Date("2030-01-01T21:00:00.000Z"),
    contact: {
      fullName: "QA Customer",
      email: "qa@example.com",
      preferred: "email",
    },
    location,
  });

test("an event address is valid without map coordinates", () => {
  const event = eventWithLocation({
    address1: "Venue not recognized by Google Maps",
    city: "Indianapolis",
    state: "IN",
    zipcode: "46204",
    country: "US",
  });

  assert.equal(event.validateSync(), undefined);
  assert.equal(event.location.point, undefined);
});

test("valid coordinates are retained when geocoding succeeds", () => {
  const event = eventWithLocation({
    address1: "1 Monument Circle",
    city: "Indianapolis",
    state: "IN",
    zipcode: "46204",
    country: "US",
    point: { type: "Point", coordinates: [-86.1581, 39.7684] },
  });

  assert.equal(event.validateSync(), undefined);
  assert.deepEqual(event.location.point.coordinates, [-86.1581, 39.7684]);
});

test("manual address replacement clears stale coordinates", () => {
  const normalized = normalizeLocation(
    {
      address1: "Manually entered venue",
      city: "Indianapolis",
      state: "IN",
      zipcode: "46204",
      country: "US",
      latitude: null,
      longitude: null,
      placeId: "",
    },
    {
      address1: "Old mapped venue",
      point: { type: "Point", coordinates: [-86.1581, 39.7684] },
    }
  );

  assert.equal(normalized.point, undefined);
  assert.equal(normalized.latitude, undefined);
  assert.equal(normalized.longitude, undefined);
});
