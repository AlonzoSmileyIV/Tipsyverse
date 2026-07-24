
import { UserModel as User } from "../../models/index.js";

export const renameUserAllergies = async (oldName, newName, session = null) => {
  if (!oldName || !newName || oldName === newName) return { added: 0, removed: 0 };

  console.log('oldName: ', oldName);
  console.log('newName: ', newName);
  // 1) Add newName where oldName exists (no duplicates thanks to $addToSet)
  const addRes = await User.updateMany(
    { "preferences.allergies": oldName },
    { $addToSet: { "preferences.allergies": newName } },
    { session }
  );

  // 2) Remove oldName
  const pullRes = await User.updateMany(
    { "preferences.allergies": oldName },
    { $pull: { "preferences.allergies": oldName } },
    { session }
  );

  return {
    added: addRes.modifiedCount || addRes.nModified || 0,
    removed: pullRes.modifiedCount || pullRes.nModified || 0,
  };
}