const isValidIanaTimezone = (value) => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date());
    return true;
  } catch {
    return false;
  }
};

export async function resolveVenueTimezone({
  latitude,
  longitude,
  apiKey = process.env.GOOGLE_MAPS_API_KEY,
  fetchImpl = fetch,
  timestamp = Math.floor(Date.now() / 1000),
}) {
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    throw new Error("A valid latitude is required.");
  }
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
    throw new Error("A valid longitude is required.");
  }
  if (!apiKey) throw new Error("Venue timezone lookup is not configured.");

  const url = new URL("https://maps.googleapis.com/maps/api/timezone/json");
  url.searchParams.set("location", `${lat},${lng}`);
  url.searchParams.set("timestamp", String(timestamp));
  url.searchParams.set("key", apiKey);

  const response = await fetchImpl(url, { signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error("Venue timezone lookup is unavailable.");
  const result = await response.json();
  if (result.status !== "OK" || !isValidIanaTimezone(result.timeZoneId)) {
    throw new Error(result.errorMessage || "A timezone was not found for this venue.");
  }

  return {
    timezone: result.timeZoneId,
    name: result.timeZoneName || result.timeZoneId,
  };
}

export { isValidIanaTimezone };
