import "dotenv/config";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { getCurrentMongoURI } from "../../utils/libs/getMongoURI.js";

const environment = String(process.env.NODE_ENV || "production").toLowerCase();
const backupRoot = process.env.DATABASE_BACKUP_DIR;
if (!backupRoot || !path.isAbsolute(backupRoot)) {
  throw new Error("DATABASE_BACKUP_DIR must be an explicit absolute path.");
}
await mkdir(backupRoot, { recursive: true });
const backupId =
  `${environment}-${new Date().toISOString().replace(/[:.]/g, "-")}`;
const destination = path.join(
  backupRoot,
  `${backupId}.archive.gz`
);
const child = spawn(
  "mongodump",
  [
    "--uri",
    getCurrentMongoURI(environment),
    `--archive=${destination}`,
    "--gzip",
  ],
  { stdio: "inherit" }
);
child.on("error", (error) => {
  throw error;
});
child.on("exit", async (code) => {
  if (code !== 0) process.exit(code ?? 1);
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(destination)) hash.update(chunk);
  const details = await stat(destination);
  const manifest = {
    backupId,
    environment,
    createdAt: new Date().toISOString(),
    archive: path.basename(destination),
    bytes: details.size,
    sha256: hash.digest("hex"),
    appRelease: process.env.APP_RELEASE || null,
  };
  await writeFile(
    `${destination}.manifest.json`,
    `${JSON.stringify(manifest, null, 2)}\n`,
    { mode: 0o600 }
  );
  console.log(JSON.stringify({ success: true, ...manifest }));
});
