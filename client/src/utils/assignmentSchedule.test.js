import { expect, test } from "vitest";
import { assignmentScheduleBucket } from "./assignmentSchedule";

const now = new Date("2026-09-13T16:00:00.000Z");
const futureEvent = { startAt: "2026-09-14T16:00:00.000Z", endAt: "2026-09-14T20:00:00.000Z" };

test("keeps only active future events in the upcoming schedule", () => {
  expect(assignmentScheduleBucket({ status: "active", event: futureEvent }, now)).toBe("upcoming");
  expect(assignmentScheduleBucket({ status: "active", event: { ...futureEvent, status: "canceled" } }, now)).toBe("past");
  expect(assignmentScheduleBucket({ status: "active", event: { ...futureEvent, status: "completed" } }, now)).toBe("past");
});

test("keeps removed assignments out of upcoming regardless of date", () => {
  expect(assignmentScheduleBucket({ status: "removed", event: futureEvent }, now)).toBe("removed");
});
