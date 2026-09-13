import crypto from "crypto";
import mongoose from "mongoose";
import { logger } from "../../utils/libs/logger.js";

const hashKey = (value) =>
  crypto.createHash("sha256").update(value).digest("hex");

const collection = () => mongoose.connection.db.collection("idempotency_responses");

const findCached = async (key) => {
  if (mongoose.connection.readyState !== 1) return null;
  const cached = await collection().findOne({ _id: hashKey(key), expiresAt: { $gt: new Date() } });
  return cached;
};

const captureSuccessfulJson = (res, key, ttlMs) => {
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    if (res.statusCode >= 200 && res.statusCode < 300 && mongoose.connection.readyState === 1) {
      const expiresAt = new Date(Date.now() + ttlMs);
      void collection()
        .updateOne(
          { _id: hashKey(key) },
          { $set: { status: res.statusCode, body, expiresAt } },
          { upsert: true }
        )
        .catch((error) =>
          logger.error("idempotency_response_persist_failed", { error })
        );
    }
    return originalJson(body);
  };
};
const stableStringify = (value) => {
  if (!value || typeof value !== "object") return String(value ?? "");
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${key}:${stableStringify(value[key])}`)
    .join(",")}}`;
};

const defaultKey = (req) =>
  [
    req.method,
    req.originalUrl,
    req.user?.id || req.ip || "anonymous",
    req.headers["idempotency-key"] || req.headers["x-idempotency-key"] || "",
  ].join(":");

export const requireIdempotencyKey = ({
  ttlMs = 10 * 60 * 1000,
  keyFactory = defaultKey,
  message = "This action needs an Idempotency-Key header to prevent duplicate submissions.",
} = {}) => {
  return async (req, res, next) => {
    try {
      const providedKey = req.headers["idempotency-key"] || req.headers["x-idempotency-key"];
      if (!providedKey) {
        return res.status(400).json({ success: false, message });
      }

      const cacheKey = keyFactory(req);
      const cached = await findCached(cacheKey);
      if (cached) {
        res.setHeader("Idempotency-Replayed", "true");
        return res.status(cached.status).json(cached.body);
      }

      captureSuccessfulJson(res, cacheKey, ttlMs);
      return next();
    } catch (error) {
      return next(error);
    }
  };
};

export const dedupeSuccessfulRequests = ({
  ttlMs = 30 * 1000,
  keyFactory,
} = {}) => {
  return async (req, res, next) => {
    try {
      const cacheKey = keyFactory
        ? keyFactory(req)
        : [
            req.method,
            req.originalUrl,
            req.user?.id || req.ip || "anonymous",
            stableStringify(req.body),
          ].join(":");

      const cached = await findCached(cacheKey);
      if (cached) {
        res.setHeader("Idempotency-Replayed", "true");
        return res.status(cached.status).json(cached.body);
      }

      captureSuccessfulJson(res, cacheKey, ttlMs);
      return next();
    } catch (error) {
      return next(error);
    }
  };
};
