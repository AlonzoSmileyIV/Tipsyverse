import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

const source = process.env.DATABASE_BACKUP_ARCHIVE;
if (!source || !path.isAbsolute(source) || !source.endsWith(".archive.gz")) {
  throw new Error(
    "DATABASE_BACKUP_ARCHIVE must be an explicit absolute .archive.gz path."
  );
}

const manifest = JSON.parse(
  await readFile(`${source}.manifest.json`, "utf8")
);
const hash = createHash("sha256");
for await (const chunk of createReadStream(source)) hash.update(chunk);
const details = await stat(source);
const actualHash = hash.digest("hex");

if (manifest.sha256 !== actualHash || manifest.bytes !== details.size) {
  throw new Error("Backup checksum or size does not match its manifest.");
}

console.log(
  JSON.stringify({
    success: true,
    backupId: manifest.backupId,
    environment: manifest.environment,
    bytes: details.size,
    sha256: actualHash,
    verifiedAt: new Date().toISOString(),
  })
);
