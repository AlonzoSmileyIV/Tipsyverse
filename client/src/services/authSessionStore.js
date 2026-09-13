let accessToken = null;

export const getAccessToken = () => accessToken;

export const setAccessToken = (token) => {
  accessToken = token || null;
};

export const clearAccessToken = () => {
  accessToken = null;
};

export const readPersistedSession = () => {
  try {
    const value = JSON.parse(localStorage.getItem("loggedInUser") || "null");
    if (!value) return null;
    // Remove tokens written by older builds as soon as they are encountered.
    if (value.accessToken) {
      delete value.accessToken;
      localStorage.setItem("loggedInUser", JSON.stringify(value));
    }
    return value;
  } catch {
    localStorage.removeItem("loggedInUser");
    return null;
  }
};

export const persistSession = (session) => {
  if (!session) {
    localStorage.removeItem("loggedInUser");
    return;
  }
  const { accessToken: _accessToken, ...safeSession } = session;
  localStorage.setItem("loggedInUser", JSON.stringify(safeSession));
};
