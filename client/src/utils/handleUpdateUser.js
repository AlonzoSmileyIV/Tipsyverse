// utils/handleUpdateUser.js
import { fetchMe, updateLoggedInUser } from "../features/users/userSlice";
import { getAccessToken } from "../services/authSessionStore";

export const handleUpdateUser = async (dispatch) => {
  try {
    const updatedUser = await dispatch(fetchMe()).unwrap();
    dispatch(
      updateLoggedInUser({
        user: updatedUser,
        accessToken: getAccessToken(),
      })
    );
  } catch (err) {
    console.error("Failed to update logged-in user:", err);
  }
};
