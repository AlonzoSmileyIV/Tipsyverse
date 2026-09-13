// utils/navigation.js
// utils/navigation.js

export const navigateOrReload = (navigate, pathWithQuery, options = {}) => {
  // Internal navigation must preserve the in-memory access token. Reloading
  // the document immediately after login can overlap refresh-token rotation.
  navigate(pathWithQuery, options);
};
