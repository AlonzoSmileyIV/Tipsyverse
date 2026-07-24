// hooks/useLogout.js
import { useCallback } from "react";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { logoutUserAsync } from "../features/users/userSlice";
import socket from "../services/socket";

export const useLogout = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  return useCallback(
    async (reason = "manual") => {
            // tell the server to detach this socket from the current user room

       try {
        socket.emit("unregister");
        socket.removeAllListeners(); // prevent ghost handlers
        socket.disconnect();         // close transport
      } catch {}

      // optional client cleanups
      localStorage.removeItem("ageVerified");
      localStorage.removeItem("hasSeenBirthdayPopup");

      try {
        await dispatch(logoutUserAsync(reason)).unwrap();
      } catch (e) {
        console.warn("Server logout failed, cleared client anyway:", e);
      }

      navigate("/login", { replace: true });
    },
    [dispatch, navigate]
  );
};
