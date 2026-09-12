import "dotenv/config";
import { createHash } from "node:crypto";

const required = (name) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for staging verification.`);
  return value.replace(/\/$/, "");
};

const apiOrigin = required("STAGING_API_URL");
const frontendOrigin = required("STAGING_FRONTEND_URL");
const allowedOrigin = new URL(frontendOrigin).origin;

if (!apiOrigin.startsWith("https://") || !frontendOrigin.startsWith("https://")) {
  throw new Error("Staging API and frontend URLs must use HTTPS.");
}
if (!process.env.MONGO_STAGING_URI || !process.env.MONGO_PROD_URI) {
  throw new Error("Both staging and production Mongo URIs must be configured.");
}
const fingerprint = (value) =>
  createHash("sha256").update(value).digest("hex");
if (fingerprint(process.env.MONGO_STAGING_URI) === fingerprint(process.env.MONGO_PROD_URI)) {
  throw new Error("Staging and production MongoDB URIs must be distinct.");
}

const checks = [];
const check = async (name, operation) => {
  try {
    await operation();
    checks.push({ name, success: true });
  } catch (error) {
    checks.push({ name, success: false, message: error.message });
  }
};

for (const endpoint of ["live", "ready"]) {
  await check(`api_${endpoint}`, async () => {
    const response = await fetch(`${apiOrigin}/api/v1/${endpoint}`);
    if (!response.ok) throw new Error(`returned HTTP ${response.status}`);
  });
}

await check("cors_credentials", async () => {
  const response = await fetch(`${apiOrigin}/api/v1/users/login`, {
    method: "OPTIONS",
    headers: {
      Origin: allowedOrigin,
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "content-type",
    },
  });
  if (!response.ok) throw new Error(`preflight returned HTTP ${response.status}`);
  if (response.headers.get("access-control-allow-origin") !== allowedOrigin) {
    throw new Error("allow-origin does not match the staging frontend.");
  }
  if (response.headers.get("access-control-allow-credentials") !== "true") {
    throw new Error("credentialed CORS is not enabled.");
  }
});

for (const route of ["/", "/drinks", "/book", "/privacy", "/login"]) {
  await check(`frontend_${route}`, async () => {
    const response = await fetch(`${frontendOrigin}${route}`);
    if (!response.ok) throw new Error(`returned HTTP ${response.status}`);
    if (!(await response.text()).includes('id="root"')) {
      throw new Error("SPA root was not returned.");
    }
  });
}

console.log(JSON.stringify({ checkedAt: new Date().toISOString(), checks }, null, 2));
if (checks.some(({ success }) => !success)) process.exitCode = 1;
