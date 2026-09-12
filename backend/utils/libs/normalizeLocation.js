// utils/normalizeLocation.js (or wherever it lives)
export const normalizeLocation = (loc, prev = null) => {
  // If nothing new and nothing old, just bail
  if (!loc && !prev) return loc;

  // Start with previous location so we don't accidentally lose fields
  const base =
    prev && typeof prev.toObject === "function"
      ? prev.toObject()
      : prev || {};

  // Merge incoming over existing
  const merged = {
    ...base,
    ...(loc || {}),
  };

  const incoming = loc || {};
  const hasCoordinateUpdate = ["latitude", "longitude", "lat", "lng", "point"].some(
    (key) => Object.prototype.hasOwnProperty.call(incoming, key)
  );
  const lat = hasCoordinateUpdate
    ? incoming.latitude ?? incoming.lat ?? incoming.point?.coordinates?.[1] ?? null
    : merged.latitude ?? merged.lat ?? merged.point?.coordinates?.[1] ?? null;
  const lng = hasCoordinateUpdate
    ? incoming.longitude ?? incoming.lng ?? incoming.point?.coordinates?.[0] ?? null
    : merged.longitude ?? merged.lng ?? merged.point?.coordinates?.[0] ?? null;

  const hasCoords =
    lat !== null &&
    lat !== "" &&
    lng !== null &&
    lng !== "" &&
    Number.isFinite(Number(lat)) &&
    Number.isFinite(Number(lng));

  const point = hasCoords
    ? {
        type: "Point",
        coordinates: [Number(lng), Number(lat)], // [lng, lat] for GeoJSON
      }
    : hasCoordinateUpdate
      ? undefined
      : merged.point;

  return {
    address1: merged.address1,
    address2: merged.address2,
    city: merged.city,
    county: merged.county,
    state: merged.state,
    zipcode: merged.zipcode,
    country: merged.country ?? "US",
    formatted: merged.formatted || merged.formattedAddress,
    placeId: merged.placeId,
    timezone: merged.timezone,
    // keep scalar coords around if you want them on the doc too:
    ...(hasCoords
      ? {
          latitude: Number(lat),
          longitude: Number(lng),
          lat: Number(lat),
          lng: Number(lng),
        }
      : {}),
    ...(point ? { point } : {}),
  };
};
