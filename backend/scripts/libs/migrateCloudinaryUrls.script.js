import mongoose from "mongoose";
import axios from "axios";
import fs from "fs-extra";
import { v2 as cloudinary } from "cloudinary";
import { UserModel as User, DrinkModel as Drink } from "../../models/index.js";

// OLD ACCOUNT CONFIG
cloudinary.config({
  cloud_name: 'dtbgyeyjq',
  api_key: '993513553388888',
  api_secret: 'vzeg2BzRJekTnFASW8oBUOiTHUI'
});

// NEW ACCOUNT CONFIG
const newCloud = {
  cloud_name: 'dv3c5vntb',
  api_key: '641942286814112',
  api_secret: 'KtTnutDGQB7K_U-WkOzeaTPEiMo'
};


const MONGO = process.env.MONGO_DEV_URI;

function forceOldCloudUrl(url) {
  return url.replace(
    "res.cloudinary.com/dv3c5vntb",
    "res.cloudinary.com/dtbgyeyjq"
  );
}


async function uploadToNewCloud(file, publicId, folder, resourceType) {
  cloudinary.config(newCloud);

  return cloudinary.uploader.upload(file, {
    public_id: publicId,
    folder,
    resource_type: resourceType,
    use_filename: true,
    unique_filename: false
  });
}

export async function migrateCloudinaryUrls() {
  await mongoose.connect(MONGO);
  console.log("Connected to MongoDB");

  // ---------------- USERS ----------------
  const users = await User.find({});
  let updatedUsers = 0;

  for (const user of users) {
    const url = user.profile?.photo;
    if (!url) continue;

    console.log(`\n🔍 User photo: ${url}`);

    // Download original image
    const downloadUrl = forceOldCloudUrl(url);

console.log("Downloading from:", downloadUrl);

const response = await axios({ url: downloadUrl, responseType: "arraybuffer" });

    const tmp = "/tmp/user_" + Date.now();
    await fs.writeFile(tmp, response.data);

    // Parse public_id and folder
    const parts = url.split("/upload/")[1];
    const folderAndFile = parts.split("/").slice(1).join("/");
    const folder = folderAndFile.split("/").slice(0, -1).join("/");
    const fileName = folderAndFile.split("/").pop().split(".")[0];

    // Upload to new cloud
    const uploaded = await uploadToNewCloud(
      tmp,
      fileName,
      folder,
      "image"
    );

    // Update DB with **new secure_url**
    await User.updateOne(
      { _id: user._id },
      { $set: { "profile.photo": uploaded.secure_url } }
    );

    updatedUsers++;
    await fs.remove(tmp);
    console.log(`✔ Updated user → ${uploaded.secure_url}`);
  }

  console.log(`\n✅ Updated ${updatedUsers} users`);

  // ---------------- DRINKS ----------------
  const drinks = await Drink.find({});
  let updatedDrinks = 0;

  for (const drink of drinks) {
    const url = drink.photo;
    if (!url) continue;

    console.log(`\n🔍 Drink photo: ${url}`);

const downloadUrl = forceOldCloudUrl(url);

console.log("Downloading:", downloadUrl);

const response = await axios({
  url: downloadUrl,
  responseType: "arraybuffer"
});
    const tmp = "/tmp/drink_" + Date.now();
    await fs.writeFile(tmp, response.data);

    const parts = url.split("/upload/")[1];
    const folderAndFile = parts.split("/").slice(1).join("/");
    const folder = folderAndFile.split("/").slice(0, -1).join("/");
    const fileName = folderAndFile.split("/").pop().split(".")[0];

    const uploaded = await uploadToNewCloud(
      tmp,
      fileName,
      folder,
      "image"
    );

    await Drink.updateOne(
      { _id: drink._id },
      { $set: { photo: uploaded.secure_url } }
    );

    updatedDrinks++;
    await fs.remove(tmp);
    console.log(`✔ Updated drink → ${uploaded.secure_url}`);
  }

  console.log(`\n🎉 Migration complete`);
  mongoose.connection.close();
}

//migrateCloudinaryUrls().catch(console.error);