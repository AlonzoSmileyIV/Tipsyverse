// ---- Distance helpers (put near top of file) ----
const toRad = (deg) => (deg * Math.PI) / 180;

// returns distance in miles between two { lat, lng } points
function distanceMiles(from, to) {
  if (!from || !to) return null;
  if (
    typeof from.lat !== "number" ||
    typeof from.lng !== "number" ||
    typeof to.lat !== "number" ||
    typeof to.lng !== "number"
  ) {
    return null;
  }

  const R = 3958.8; // Earth radius in miles
  const dLat = toRad(to.lat - from.lat);
  const dLon = toRad(to.lng - from.lng);
  const lat1 = toRad(from.lat);
  const lat2 = toRad(to.lat);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) *
      Math.sin(dLon / 2) *
      Math.cos(lat1) *
      Math.cos(lat2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Internal core: always compute raw miles from `from` to eventLocationPoint
// and be tolerant of coordinates being [lng, lat] OR [lat, lng].
function computeMiles(from, eventLocationPoint) {
  if (!from || !eventLocationPoint) return null;

  const coords = eventLocationPoint.coordinates;

  // Case 1: GeoJSON-style coordinates array
  if (Array.isArray(coords) && coords.length === 2) {
    const [c0, c1] = coords;

    if (typeof c0 !== "number" || typeof c1 !== "number") return null;

    // Treat as [lng, lat]
    const candidateA = { lat: c1, lng: c0 };
    // Treat as [lat, lng]
    const candidateB = { lat: c0, lng: c1 };

    const fromPoint = { lat: from.lat, lng: from.lng };

    const dA = distanceMiles(fromPoint, candidateA);
    const dB = distanceMiles(fromPoint, candidateB);

    if (dA == null && dB == null) return null;
    if (dA == null) return dB;
    if (dB == null) return dA;

    // pick the smaller distance (the "real" one will be the small one)
    return Math.min(dA, dB);
  }

  // Case 2: direct lat/lng object on eventLocationPoint
  const lat2 =
    eventLocationPoint.lat ??
    eventLocationPoint.latitude ??
    null;
  const lng2 =
    eventLocationPoint.lng ??
    eventLocationPoint.longitude ??
    null;

  if (
    typeof lat2 !== "number" ||
    typeof lng2 !== "number" ||
    Math.abs(lat2) > 90 ||
    Math.abs(lng2) > 180
  ) {
    return null;
  }

  const fromPoint = { lat: from.lat, lng: from.lng };
  const toPoint = { lat: lat2, lng: lng2 };

  const distMi = distanceMiles(fromPoint, toPoint);
  return typeof distMi === "number" && !Number.isNaN(distMi) ? distMi : null;
}

// Pretty formatter: feet if very close, otherwise miles
export function formatDistanceLabel(from, eventLocationPoint) {
  const distMi = computeMiles(from, eventLocationPoint);
  if (distMi == null) return null;

  if (distMi < 0.1) {
    // less than ~0.1 mile → show feet
    const feet = distMi * 5280;
    return `${Math.round(feet)} ft away`;
  }

  const miRounded = distMi.toFixed(1);
  return `${miRounded} mi away`;
}

export function computeDistanceMiles(from, eventLocationPoint) {
  return computeMiles(from, eventLocationPoint);
}

export function getDistanceDisplayLabel({
  sharingEnabled,
  from,
  eventLocationPoint,
}) {
  if (!sharingEnabled) return null;
  if (!from || typeof from.lat !== "number" || typeof from.lng !== "number") {
    return "Your live location is not available";
  }
  return (
    formatDistanceLabel(from, eventLocationPoint) ||
    "Event coordinates not available"
  );
}
