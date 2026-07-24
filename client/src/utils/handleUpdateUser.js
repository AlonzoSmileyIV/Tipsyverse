// utils/handleUpdateUser.js
import { fetchMe, updateLoggedInUser } from "../features/users/userSlice";

export const handleUpdateUser = async (dispatch) => {
  try {
    const updatedUser = await dispatch(fetchMe()).unwrap();
    const current = JSON.parse(localStorage.getItem("loggedInUser"));

    dispatch(
      updateLoggedInUser({
        user: updatedUser,
        accessToken: current?.accessToken || null,
        refreshToken: current?.refreshToken || null,
      })
    );
  } catch (err) {
    console.error("Failed to update logged-in user:", err);
  }
};