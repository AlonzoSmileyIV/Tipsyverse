import assert from "node:assert/strict";
import test from "node:test";
import {
  adminEventUrl,
  customerEventUrl,
  publicAppUrl,
} from "../utils/libs/publicAppUrl.js";

test("canonicalizes the apex Tipsyverse frontend domain", () => {
  const env = { PUBLIC_APP_URL: "https://tipsyverse.com/" };
  assert.equal(publicAppUrl(env), "https://www.tipsyverse.com");
  assert.equal(
    customerEventUrl("event-1", "details", env),
    "https://www.tipsyverse.com/my-events/event-1/details"
  );
  assert.equal(
    adminEventUrl("event-1", env),
    "https://www.tipsyverse.com/admin/events?eventId=event-1"
  );
});

test("preserves explicitly configured non-production origins", () => {
  assert.equal(
    publicAppUrl({ FRONTEND_URL: "http://localhost:3000/" }),
    "http://localhost:3000"
  );
});
