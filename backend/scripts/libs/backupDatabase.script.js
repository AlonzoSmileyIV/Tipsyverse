import "dotenv/config";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, stat, writeFile, readFile, unlink } from "node:fs/promises";
import path from "node:path";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getCurrentMongoURI } from "../../utils/libs/getMongoURI.js";

const environment = String(
  process.env.NODE_ENV || "production"
).toLowerCase();

if (environment !== "production") {
  throw new Error(
    "Cloud backup job must run with NODE_ENV=production."
  );
}

const backupRoot =
  process.env.DATABASE_BACKUP_DIR || "/tmp/tipsyverse-backups";

const bucket = process.env.R2_BUCKET_NAME;
const endpoint = process.env.R2_ENDPOINT;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

if (!bucket || !endpoint || !accessKeyId || !secretAccessKey) {
  throw new Error("Missing required R2 backup environment variables.");
}

await mkdir(backupRoot, { recursive: true });

const backupId =
  `production-${new Date().toISOString().replace(/[:.]/g, "-")}`;

const destination = path.join(
  backupRoot,
  `${backupId}.archive.gz`
);

const manifestPath = `${destination}.manifest.json`;

function runMongoDump() {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "mongodump",
      [
        "--uri",
        getCurrentMongoURI("production"),
        `--archive=${destination}`,
        "--gzip",
      ],
      { stdio: "inherit" }
    );

    child.on("error", reject);

    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(
          new Error(`mongodump exited with code ${code ?? "unknown"}`)
        );
      }
    });
  });
}

await runMongoDump();

const hash = createHash("sha256");

for await (const chunk of createReadStream(destination)) {
  hash.update(chunk);
}

const details = await stat(destination);

const manifest = {
  backupId,
  environment: "production",
  createdAt: new Date().toISOString(),
  archive: path.basename(destination),
  bytes: details.size,
  sha256: hash.digest("hex"),
  appRelease: process.env.APP_RELEASE || null,
};

await writeFile(
  manifestPath,
  `${JSON.stringify(manifest, null, 2)}\n`,
  { mode: 0o600 }
);

const s3 = new S3Client({
  region: "auto",
  endpoint,
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
});

const archiveKey = `production/${path.basename(destination)}`;
const manifestKey = `${archiveKey}.manifest.json`;

await s3.send(
  new PutObjectCommand({
    Bucket: bucket,
    Key: archiveKey,
    Body: createReadStream(destination),
    ContentType: "application/gzip",
  })
);

await s3.send(
  new PutObjectCommand({
    Bucket: bucket,
    Key: manifestKey,
    Body: await readFile(manifestPath),
    ContentType: "application/json",
  })
);

console.log(
  JSON.stringify({
    success: true,
    backupId,
    bucket,
    archiveKey,
    manifestKey,
    bytes: details.size,
    sha256: manifest.sha256,
    uploadedAt: new Date().toISOString(),
  })
);

// The permanent copies now live in R2.
// Remove Render's temporary local files.
await unlink(destination);
await unlink(manifestPath);