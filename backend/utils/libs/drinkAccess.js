const STAFF_ROLES = new Set(["admin", "employee"]);

export function viewerHasPremiumAccess(user) {
  if (!user) return false;
  if (STAFF_ROLES.has(user.role)) return true;

  const subscription = user.subscription;
  if (subscription?.status !== "active") return false;

  const endsAt = subscription?.currentPeriodEndsAt;
  return !endsAt || new Date(endsAt).getTime() > Date.now();
}

export function serializeDrinkForViewer(drink, user) {
  const raw = typeof drink?.toObject === "function" ? drink.toObject() : { ...drink };
  const isPremium = raw.accessLevel === "subscriber";
  const hasPremiumAccess = viewerHasPremiumAccess(user);

  raw.isPremium = isPremium;
  raw.isLocked = isPremium && !hasPremiumAccess;

  if (!raw.isLocked) return raw;

  // Keep enough metadata to advertise the drink without leaking the recipe.
  delete raw.photo;
  delete raw.photoPublicId;
  delete raw.video;
  delete raw.videoPublicId;
  delete raw.description;
  delete raw.ingredients;
  delete raw.instructions;
  delete raw.tools;
  delete raw.garnishes;
  delete raw.glass;

  return raw;
}

export function serializeDrinksForViewer(drinks, user) {
  return (drinks || []).map((drink) => serializeDrinkForViewer(drink, user));
}
