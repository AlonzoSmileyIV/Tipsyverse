import mongoose from "mongoose";
import { getCurrentMongoURI } from "../utils/libs/getMongoURI.js";
import { logger } from "../utils/libs/logger.js";

const VALID_ENVIRONMENTS = ["development", "staging", "production", "backup"];

const connectDB = async (env) => {
  if (!VALID_ENVIRONMENTS.includes(env)) {
    logger.error("invalid_database_environment", {
      environment: env,
      validEnvironments: VALID_ENVIRONMENTS,
    });
    process.exit(1); // Stop execution
  }

  try {
    await mongoose.connect(getCurrentMongoURI(env));
    await Promise.all([
      mongoose.connection.db
        .collection("idempotency_responses")
        .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
      mongoose.connection.db
        .collection("rate_limit_buckets")
        .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
      mongoose.connection.db
        .collection("system_leases")
        .createIndex({ expiresAt: 1 }),
    ]);
    logger.info("database_connected", { environment: env });
  } catch (error) {
    logger.error("database_connection_failed", { error, environment: env });
    process.exit(1);
  }
};

connectDB.isReady = () => mongoose.connection.readyState === 1;
connectDB.disconnect = async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
};

export default connectDB;
