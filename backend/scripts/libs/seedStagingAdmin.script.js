import "dotenv/config";
import bcrypt from "bcrypt";
import mongoose from "mongoose";
import { UserModel as User } from "../../models/index.js";

if (process.env.NODE_ENV !== "staging") {
  throw new Error("The staging admin fixture may only run with NODE_ENV=staging.");
}

const uri = process.env.MONGO_STAGING_URI;
const username = process.env.ADMIN_SEED_USERNAME;
const email = process.env.ADMIN_SEED_EMAIL?.toLowerCase();
const fullName = process.env.ADMIN_SEED_FULL_NAME;
const password = process.env.ADMIN_SEED_PASSWORD;

if (!uri || !username || !email || !fullName || !password) {
  throw new Error(
    "MONGO_STAGING_URI and all ADMIN_SEED_* identity credentials are required."
  );
}

await mongoose.connect(uri, { autoIndex: false });
try {
  const conflicting = await User.findOne({
    $or: [{ username: username.toLowerCase() }, { email }],
  }).select("username email role isSeeded");

  if (
    conflicting &&
    (conflicting.username !== username.toLowerCase() || conflicting.email !== email)
  ) {
    throw new Error(
      "The configured admin username or email belongs to a different account."
    );
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const admin = await User.findOneAndUpdate(
    { email },
    {
      $set: {
        username: username.toLowerCase(),
        email,
        fullName,
        passwordHash,
        role: "admin",
        isSeeded: true,
        "accountStatus.state": "Active",
        "accountStatus.isOnline": false,
      },
      $setOnInsert: {
        "profile.birthday": new Date("1990-01-01T00:00:00.000Z"),
      },
    },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
  ).select("username email fullName role accountStatus.state");

  console.log(
    JSON.stringify({
      username: admin.username,
      email: admin.email,
      fullName: admin.fullName,
      role: admin.role,
      accountState: admin.accountStatus?.state,
    })
  );
} finally {
  await mongoose.disconnect();
}
