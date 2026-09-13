import crypto from "crypto";

export const ACCOUNT_ACTIVATION_TTL_MS = 30 * 60 * 1000;

export const hashAccountActivationToken = (token) =>
  crypto.createHash("sha256").update(String(token || "")).digest("hex");

export const issueAccountActivation = (
  user,
  { now = Date.now(), ttlMs = ACCOUNT_ACTIVATION_TTL_MS } = {}
) => {
  const token = crypto.randomBytes(32).toString("hex");
  user.activationTokenHash = hashAccountActivationToken(token);
  user.activationTokenExpiresAt = new Date(now + ttlMs);
  user.activationCompletedAt = null;
  user.mustSetPassword = true;
  return token;
};

export const buildAccountActivationUrl = (token) => {
  const base = process.env.ADMIN_PORTAL_URL || process.env.PUBLIC_APP_URL;
  if (!base) throw new Error("Account activation URL is not configured.");
  return `${base.replace(/\/$/, "")}/activate-account/${token}`;
};

export const createUnusablePassword = () =>
  crypto.randomBytes(48).toString("base64url");
