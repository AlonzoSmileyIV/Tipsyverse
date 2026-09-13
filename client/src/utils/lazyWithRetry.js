import { lazy } from "react";

const DYNAMIC_IMPORT_ERROR =
  /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Loading chunk .* failed/i;

export const isDynamicImportFailure = (error) =>
  DYNAMIC_IMPORT_ERROR.test(String(error?.message || error || ""));

export const loadRouteWithRetry = async (
  importer,
  routeKey,
  {
    storage = typeof window !== "undefined" ? window.sessionStorage : null,
    reload = typeof window !== "undefined" ? () => window.location.reload() : null,
  } = {}
) => {
  const retryKey = `tipsyverse:lazy-route-refresh:${routeKey}`;
  try {
    const module = await importer();
    storage?.removeItem(retryKey);
    return module;
  } catch (error) {
    if (!isDynamicImportFailure(error) || !storage || !reload) throw error;

    const alreadyRetried = storage.getItem(retryKey) === "1";
    if (alreadyRetried) {
      storage.removeItem(retryKey);
      throw error;
    }

    storage.setItem(retryKey, "1");
    reload();
    // Keep Suspense active while the browser replaces the current document.
    return new Promise(() => {});
  }
};

const lazyWithRetry = (importer, routeKey) =>
  lazy(() => loadRouteWithRetry(importer, routeKey));

export default lazyWithRetry;
