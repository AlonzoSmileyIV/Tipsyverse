// scripts/utils/getMongoURI.js
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env.<env> or fallback to .env
const NODE_ENV = (process.env.NODE_ENV || "development").toLowerCase();
const envCandidates = [
  path.resolve(__dirname, `../../.env.${NODE_ENV}`),
  path.resolve(__dirname, `../../.env`),
];
for (const p of envCandidates) {
  const res = dotenv.config({ path: p });
  if (!res.error) break;
}

export function getCurrentMongoURI(envInput = NODE_ENV) {
  const env = String(envInput || "development").toLowerCase();

  // 1. explicit override
  if (process.env.MONGO_URI) return process.env.MONGO_URI;

  // 2. per-environment vars
  const dbURIs = {
    development: process.env.MONGO_DEV_URI,
    staging: process.env.MONGO_STAGING_URI,
    production: process.env.MONGO_PROD_URI,
    backup: process.env.MONGO_BACKUP_URI,
  };
  const uri = dbURIs[env];

  if (!uri) {
    throw new Error(
      `❌ No Mongo URI found for NODE_ENV=${env}.
Checked:
  MONGO_URI=${process.env.MONGO_URI ? "present" : "missing"}
  MONGO_DEV_URI=${process.env.MONGO_DEV_URI ? "present" : "missing"}
  MONGO_STAGING_URI=${process.env.MONGO_STAGING_URI ? "present" : "missing"}
  MONGO_PROD_URI=${process.env.MONGO_PROD_URI ? "present" : "missing"}
  MONGO_BACKUP_URI=${process.env.MONGO_BACKUP_URI ? "present" : "missing"}`
    );
  }

  return uri;
}
