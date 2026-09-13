import assert from "node:assert/strict";
import test from "node:test";
import validateRuntimeConfig from "../utils/libs/validateRuntimeConfig.js";

const productionConfig = {
  API_URL: "/api/v1",
  ACCESS_TOKEN_SECRET: "a".repeat(64),
  REFRESH_TOKEN_SECRET: "b".repeat(64),
  MONGO_PROD_URI: "mongodb+srv://example.invalid/tipsyverse-production",
  MONGO_DEV_URI: "mongodb+srv://example.invalid/tipsyverse-development",
  MONGO_STAGING_URI: "mongodb+srv://example.invalid/tipsyverse-staging",
  FRONTEND_URL: "https://tipsyverse.com",
  PUBLIC_APP_URL: "https://tipsyverse.com",
  ADMIN_PORTAL_URL: "https://tipsyverse.com",
  PUBLIC_SHARE_URL: "https://api.tipsyverse.com",
  CORS_ORIGINS: "https://tipsyverse.com,https://www.tipsyverse.com",
  RESEND_EMAIL_KEY: "re_test_value",
  FROM_EMAIL: "Tipsyverse <hello@tipsyverse.com>",
  SUPPORT_EMAIL: "hello@tipsyverse.com",
  CLOUDINARY_CLOUD_NAME: "tipsyverse",
  CLOUDINARY_API_KEY: "cloudinary-key",
  CLOUDINARY_API_SECRET: "cloudinary-secret",
  STRIPE_ENABLED: "false",
};

const withEnvironment = (overrides, callback) => {
  const names = new Set([...Object.keys(productionConfig), ...Object.keys(overrides)]);
  const previous = Object.fromEntries([...names].map((name) => [name, process.env[name]]));
  try {
    Object.assign(process.env, productionConfig, overrides);
    callback();
  } finally {
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
};

test("accepts a complete payment-disabled production configuration", () => {
  withEnvironment({}, () => assert.doesNotThrow(() => validateRuntimeConfig("production")));
});

test("rejects localhost URLs and shared production databases", () => {
  withEnvironment(
    {
      FRONTEND_URL: "http://localhost:3000",
      MONGO_STAGING_URI: "mongodb+srv://other.invalid/tipsyverse-production",
    },
    () =>
      assert.throws(
        () => validateRuntimeConfig("production"),
        /FRONTEND_URL must use HTTPS.*must not use the same database as MONGO_STAGING_URI/
      )
  );
});

test("requires production email and Cloudinary settings", () => {
  withEnvironment(
    { RESEND_EMAIL_KEY: "", CLOUDINARY_API_SECRET: "" },
    () =>
      assert.throws(
        () => validateRuntimeConfig("production"),
        /RESEND_EMAIL_KEY is required.*CLOUDINARY_API_SECRET is required/
      )
  );
});
