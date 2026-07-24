// src/utils/updateLiveLocation.js
import api from "../services/api";
import { fetchMe, fetchMyBartenderInfo } from "../features/users/userSlice";

/**
 * Wrap navigator.geolocation in a Promise
 */
// function getCurrentPosition(options) {
//   return new Promise((resolve, reject) => {
//     if (!("geolocation" in navigator)) {
//       reject(new Error("Geolocation is not supported in this browser."));
//       return;
//     }

//     navigator.geolocation.getCurrentPosition(resolve, reject, options);
//   });
// }

/**
 * Request the current position and update the bartender live-location
 * in the backend. Can be called from ANY page.
 *
 * @param {object} params
 * @param {function} params.dispatch - Redux dispatch (optional but recommended)
 * @returns {Promise<{lat: number, lng: number}>}
 */
// export async function updateBartenderLiveLocation({ dispatch } = {}) {
//   // 1. Get coordinates from browser
//   const position = await getCurrentPosition({
//     enableHighAccuracy: false,
//     timeout: 10000,
//     maximumAge: 60_000, // up to 1 min old is fine
//   });

//   const lat = position.coords.latitude;
//   const lng = position.coords.longitude;

//   // 2. Send to backend
//   await api.patch("/users/me/bartender/location", {
//     lat,
//     lng,
//     enabled: true,
//   });

//   // 3. Optionally refresh bartenderInfo in Redux
//   if (dispatch) {
//     dispatch(fetchMyBartenderInfo());
//   }

//   return { lat, lng };
// }

export async function updateBartenderLiveLocation({ dispatch, onSuccess, onError } = {}) {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      const err = new Error("Geolocation is not supported in this browser.");
      onError?.(err);
      return reject(err);
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;

        try {
          await api.patch("/users/me/bartender/location", {
            lat,
            lng,
            enabled: true,
          });

          // ⬇️ keep Redux in sync so shareLiveEnabled updates
          if (dispatch) {
            await dispatch(fetchMe());               // updates loggedInUser (needed for shareLiveEnabled)
            await dispatch(fetchMyBartenderInfo());  // optional, keeps bartenderInfo fresh too
          }

          const coords = { lat, lng };
          onSuccess?.(coords);
          resolve(coords);
        } catch (apiErr) {
          onError?.(apiErr);
          reject(apiErr);
        }
      },
      (geoErr) => {
        let message = "Unable to retrieve your location. Please try again.";
        if (geoErr?.code === 1) {
          message =
            "Location permission is blocked. Allow location access for this site in your browser settings, then try again.";
        } else if (geoErr?.code === 2) {
          message =
            "Your location is currently unavailable. Check your device location services and try again.";
        } else if (geoErr?.code === 3) {
          message = "Location lookup timed out. Please try again.";
        }
        const error = new Error(message);
        error.code = geoErr?.code;
        onError?.(error);
        reject(error);
      },
      {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 60_000,
      }
    );
  });
}
