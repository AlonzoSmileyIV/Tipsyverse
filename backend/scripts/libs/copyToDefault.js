// scripts/lib/copyToDefault.js
import { v2 as cloudinary } from "cloudinary";

function buildUrlFromPublicId(publicId) {
  return cloudinary.url(publicId, { secure: true });
}

async function resourceExists(publicId) {
  try {
    await cloudinary.api.resource(publicId, { resource_type: "image", type: "upload" });
    return true;
  } catch (e) {
    const code = e?.http_code || e?.http_status_code || e?.error?.http_code || e?.response?.status;
    if (code === 404) return false;
    throw e; // real error
  }
}

/**
 * Copy a drink's current image into default/images/{slug}
 * @param {Object} drink  - { slug, photo, photoPublicId }
 * @returns {Object}      - { ok, destPublicId, url, skipped, reason }
 */
export async function copyDrinkPhotoToDefault(drink) {
  const slug = drink?.slug?.toString().trim();
  if (!slug) return { ok: false, reason: "missing slug" };

  const destPublicId = `default/images/${slug}`;
  if (await resourceExists(destPublicId)) {
    return { ok: true, skipped: true, destPublicId };
  }

  // Prefer a stored full URL; otherwise derive from publicId
  let srcUrl = drink?.photo && typeof drink.photo === "string" && drink.photo.trim();
  if (!srcUrl) {
    const srcPid = drink?.photoPublicId && drink.photoPublicId.trim();
    if (!srcPid) return { ok: false, reason: "no source photo or photoPublicId" };
    srcUrl = buildUrlFromPublicId(srcPid);
  }

  // Make sure folder exists (no-op if it already does)
  try { await cloudinary.api.create_folder("default/images"); } catch { /* ignore */ }

  // Upload-from-URL INTO the destination public_id (this creates a COPY)
  const res = await cloudinary.uploader.upload(srcUrl, {
    folder: "default/images",   // folder part
    public_id: slug,            // filename part
    resource_type: "image",
    overwrite: false,           // don't clobber if it appears between exists-check and now
    unique_filename: false,
    use_filename: false,
    type: "upload",
  });

  return { ok: true, destPublicId: res.public_id, url: res.secure_url };
}
