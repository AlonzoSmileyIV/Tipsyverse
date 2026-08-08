const isHttpsUrl = (value) => {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
};

export default function validateRuntimeConfig(environment = process.env.NODE_ENV) {
  const mongoVariable = {
    development: "MONGO_DEV_URI",
    staging: "MONGO_STAGING_URI",
    production: "MONGO_PROD_URI",
    backup: "MONGO_BACKUP_URI",
  }[environment] || "MONGO_URI";
  const required = [
    "API_URL",
    "ACCESS_TOKEN_SECRET",
    "REFRESH_TOKEN_SECRET",
    mongoVariable,
  ];
  if (["staging", "production"].includes(environment)) {
    required.push("CORS_ORIGINS", "PUBLIC_APP_URL");
  }
  const missing = required.filter((name) => !process.env[name]?.trim());
  const errors = missing.map((name) => `${name} is required`);

  if (process.env.ACCESS_TOKEN_SECRET === process.env.REFRESH_TOKEN_SECRET) {
    errors.push("access and refresh token secrets must be different");
  }
  for (const name of ["ACCESS_TOKEN_SECRET", "REFRESH_TOKEN_SECRET"]) {
    if (process.env[name] && process.env[name].length < 32) {
      errors.push(`${name} must contain at least 32 characters`);
    }
  }

  if (environment === "production") {
    const origins = (process.env.CORS_ORIGINS || "").split(",").map((item) => item.trim());
    if (!origins.length || origins.some((origin) => !isHttpsUrl(origin))) {
      errors.push("every production CORS origin must use HTTPS");
    }
    if (!isHttpsUrl(process.env.PUBLIC_APP_URL)) {
      errors.push("PUBLIC_APP_URL must use HTTPS in production");
    }
    const stripeEnabled =
      String(process.env.STRIPE_ENABLED).toLowerCase() === "true";
    if (
      stripeEnabled &&
      (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET)
    ) {
      errors.push("Stripe secret and webhook signing keys are required in production");
    }
  }

  if (errors.length) {
    throw new Error(`Invalid runtime configuration: ${errors.join("; ")}`);
  }
}
