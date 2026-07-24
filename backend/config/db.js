/* CONFIG - Stores configuration files and settings for the application.
Contents:
-Database configuration (e.g., MongoDB connection setup).
-Environment variables (e.g., keys, tokens, or other sensitive data).
-Configuration for external services (e.g., email service, authentication).
*/
import mongoose from "mongoose";
import { updateFieldsImmediately } from "../scripts/index.js";
import { getCurrentMongoURI } from "../utils/libs/getMongoURI.js";

const VALID_ENVIRONMENTS = ["development", "staging", "production", "backup"];

const connectDB = async (env) => {
  if (!VALID_ENVIRONMENTS.includes(env)) {
    console.error(
      `❌ ERROR: Invalid NODE_ENV "${env}". Expected one of: ${VALID_ENVIRONMENTS.join(", ")}`
    );
    process.exit(1); // Stop execution
  }

  try {
    await mongoose.connect(getCurrentMongoURI(env));
    console.log(`✅ Connected to ${env} database...`);
    // await addFieldsImmediately();
    // await updateFieldsImmediately();
    // await removeFieldsImmediately();
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    process.exit(1);
  }
};

export default connectDB;
