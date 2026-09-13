import assert from "node:assert/strict";
import test from "node:test";
import { resolveVenueTimezone } from "../utils/libs/resolveVenueTimezone.js";

test("resolves an IANA timezone from venue coordinates without exposing the key", async () => {
  let requestedUrl;
  const result = await resolveVenueTimezone({
    latitude: 39.7684,
    longitude: -86.1581,
    apiKey: "server-only-key",
    timestamp: 1_800_000_000,
    fetchImpl: async (url) => {
      requestedUrl = url;
      return {
        ok: true,
        json: async () => ({
          status: "OK",
          timeZoneId: "America/Indiana/Indianapolis",
          timeZoneName: "Eastern Daylight Time",
        }),
      };
    },
  });

  assert.deepEqual(result, {
    timezone: "America/Indiana/Indianapolis",
    name: "Eastern Daylight Time",
  });
  assert.equal(requestedUrl.searchParams.get("location"), "39.7684,-86.1581");
  assert.equal(requestedUrl.searchParams.get("timestamp"), "1800000000");
  assert.equal(requestedUrl.searchParams.get("key"), "server-only-key");
});

test("rejects invalid coordinates before calling Google", async () => {
  await assert.rejects(
    resolveVenueTimezone({ latitude: 100, longitude: -86, apiKey: "key" }),
    /valid latitude/
  );
});

test("rejects invalid timezone responses", async () => {
  await assert.rejects(
    resolveVenueTimezone({
      latitude: 39.7,
      longitude: -86.1,
      apiKey: "key",
      fetchImpl: async () => ({
        ok: true,
        json: async () => ({ status: "OK", timeZoneId: "Not/A_Timezone" }),
      }),
    }),
    /timezone was not found/
  );
});
