import "dotenv/config";
import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import path from "node:path";
import { getCurrentMongoURI } from "../../utils/libs/getMongoURI.js";

const environment = String(process.env.NODE_ENV || "").toLowerCase();
const source = process.env.DATABASE_RESTORE_SOURCE;
if (environment !== "staging" || process.env.CONFIRM_RESTORE !== "true") {
  throw new Error("Restore drills are restricted to staging and require CONFIRM_RESTORE=true.");
}
if (!source || !path.isAbsolute(source)) {
  throw new Error("DATABASE_RESTORE_SOURCE must be an explicit absolute path.");
}
if (!source.endsWith(".archive.gz")) {
  throw new Error("DATABASE_RESTORE_SOURCE must be a .archive.gz backup.");
}
await access(source);
const child = spawn(
  "mongorestore",
  [
    "--uri",
    getCurrentMongoURI(environment),
    `--archive=${source}`,
    "--gzip",
    "--drop",
  ],
  { stdio: "inherit" }
);
child.on("exit", (code) => process.exit(code ?? 1));
