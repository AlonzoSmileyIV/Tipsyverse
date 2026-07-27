import crypto from "crypto";

export const newSessionId = () => crypto.randomUUID();
export const newRefreshTokenId = () => crypto.randomUUID();
export const hashRefreshTokenId = (tokenId) =>
  crypto.createHash("sha256").update(String(tokenId || "")).digest("hex");

export const refreshSessionExpiresAt = (sessionStartedAt) =>
  new Date(Number(sessionStartedAt) + 8 * 60 * 60 * 1000);
