import { io } from "socket.io-client";
import { getAccessToken } from "./authSessionStore";

// Keep one socket for the application lifetime. Feature hooks decide when it
// connects, which prevents anonymous pages and React rerenders from creating
// duplicate connections.
const socket = io(`${process.env.REACT_APP_SOCKET_URL}`, {
  withCredentials: true,
  autoConnect: false,
  // Socket.IO calls this function for every connection attempt, so reconnects
  // use the current in-memory token rather than a token captured at startup.
  auth: (callback) => {
    callback({ token: getAccessToken() || "" });
  },
});

export default socket;
