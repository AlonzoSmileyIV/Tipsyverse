import assert from "node:assert/strict";
import test from "node:test";
import { formatDate, formatDateTime } from "../utils/libs/dateTime.js";

test("event timestamps render in the requested venue timezone", () => {
  const instant = "2026-08-17T21:00:00.000Z";

  assert.equal(
    formatDateTime(instant, {
      timeZone: "America/Indiana/Indianapolis",
      dateStyle: "short",
      timeStyle: "short",
    }),
    "8/17/26, 5:00 PM"
  );
  assert.equal(
    formatDateTime(instant, {
      timeZone: "America/Denver",
      dateStyle: "short",
      timeStyle: "short",
    }),
    "8/17/26, 3:00 PM"
  );
});

test("date-only output honors the requested timezone near midnight", () => {
  const instant = "2026-08-18T01:00:00.000Z";

  assert.equal(
    formatDate(instant, {
      timeZone: "America/Indiana/Indianapolis",
      dateStyle: "short",
    }),
    "8/17/26"
  );
  assert.equal(
    formatDate(instant, { timeZone: "UTC", dateStyle: "short" }),
    "8/18/26"
  );
});
