// utils/navigation.js
// utils/navigation.js

export const navigateOrReload = (_navigate, pathWithQuery) => {
  // First navigate away from current route
  window.location.href = pathWithQuery;
  
  // Slight delay ensures React Router fully resets before returning
  // setTimeout(() => {
  //   navigate(pathWithQuery, { replace: true });
  // }, 10); // small delay ensures complete re-mount
};
