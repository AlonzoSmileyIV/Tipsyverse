import { v2 as cloudinary } from 'cloudinary';
import axios from 'axios';
import fs from 'fs-extra';

// OLD ACCOUNT CONFIG
const OLD_CLOUD = {
  cloud_name: 'dtbgyeyjq',
  api_key: '993513553388888',
  api_secret: 'vzeg2BzRJekTnFASW8oBUOiTHUI'
};

// NEW ACCOUNT CONFIG
const NEW_CLOUD = {
  cloud_name: 'dv3c5vntb',
  api_key: '641942286814112',
  api_secret: 'KtTnutDGQB7K_U-WkOzeaTPEiMo'
};

cloudinary.config(OLD_CLOUD);

// --------------------------------------------------------
//  Get assets inside a folder (ex: development/images)
// --------------------------------------------------------
async function getAssetsInFolder(folderPath) {
  let nextCursor = null;
  const results = [];

  do {
    const res = await cloudinary.api.resources({
      type: "upload",
      prefix: folderPath + "/",       // full folder path
      max_results: 500,
      next_cursor: nextCursor
    });

    results.push(...res.resources);
    nextCursor = res.next_cursor;
  } while (nextCursor);

  return results;
}

// --------------------------------------------------------
//  Upload to NEW Cloudinary
// --------------------------------------------------------
async function uploadToNewCloud(localFile, publicId, folder, resourceType) {
  return cloudinary.uploader.upload(localFile, {
    ...NEW_CLOUD,
    public_id: publicId,
    folder,
    resource_type: resourceType,
    use_filename: true,
    unique_filename: false
  });
}

// --------------------------------------------------------
//  MAIN MIGRATION FUNCTION
// --------------------------------------------------------
export async function migrateCloudinary() {
  const subfolders = ["development/images", "development/videos"];

  console.log("\n📁 Migrating ONLY:", subfolders, "\n");

  for (const folder of subfolders) {
    console.log(`📂 Reading assets from: ${folder}`);

    const assets = await getAssetsInFolder(folder);

    if (!assets.length) {
      console.log("   (empty folder)\n");
      continue;
    }

    for (const asset of assets) {
      const url = asset.secure_url;
      const ext = asset.format ? "." + asset.format : "";
      const tmpPath = `/tmp/${asset.public_id.replace(/\//g, "_")}${ext}`;

      console.log(`   ⬇ Downloading: ${asset.public_id}`);

      const fileData = await axios({ url, responseType: "arraybuffer" });
      await fs.writeFile(tmpPath, fileData.data);

      console.log(`   ⬆ Uploading → ${asset.folder}`);

      await cloudinary.uploader.upload(tmpPath, {
        ...NEW_CLOUD,
        public_id: asset.public_id,
        folder: asset.folder,
        resource_type: asset.resource_type,
        use_filename: true,
        unique_filename: false
      });

      await fs.remove(tmpPath);
    }
  }

  console.log("\n🎉 Finished migrating the development folder!\n");
}