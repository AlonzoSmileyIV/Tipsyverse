import { useEffect, useMemo, useRef, useState } from "react";
import { MenuItem, Paper, Popper, Stack, TextField } from "@mui/material";

/* ---------- Shared helpers (copy from your file or import from a utils module) ---------- */

export function useGooglePlaces(apiKey) {
  const [state, setState] = useState(() => ({
    ready: false,
    error: apiKey ? "" : "Google Maps API key is missing from this production build.",
  }));

  useEffect(() => {
    if (!apiKey) {
      setState({ ready: false, error: "Google Maps API key is missing from this production build." });
      return;
    }

    let cancelled = false;
    const callbackName = "__tipsyverseGoogleMapsReady";
    const timeout = window.setTimeout(() => {
      if (!cancelled) {
        setState({
          ready: false,
          error: "Google Maps did not finish loading. Check the browser console for an API key, billing, or API restriction error.",
        });
      }
    }, 10000);

    const finish = async () => {
      try {
        if (!window.google?.maps?.importLibrary) {
          throw new Error("google.maps.importLibrary is unavailable");
        }
        await window.google.maps.importLibrary("places");
        window.clearTimeout(timeout);
        if (!cancelled) setState({ ready: true, error: "" });
      } catch (error) {
        console.error("Google Places library failed to load:", error);
        if (!cancelled) {
          setState({
            ready: false,
            error: "Google Places could not load. Check the browser console for the Google API error.",
          });
        }
      }
    };

    if (window.google?.maps?.importLibrary) {
      finish();
    } else {
      window[callbackName] = finish;
      const oldScript =
        document.getElementById("google-maps-script") ||
        document.getElementById("google-places-script");
      oldScript?.remove();

      const script = document.createElement("script");
      script.id = "google-maps-script";
      script.async = true;
      script.defer = true;
      script.src =
        `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly&libraries=places&loading=async&callback=${callbackName}`;
      script.onerror = () => {
        console.error("Google Maps JavaScript API script failed to load.");
        if (!cancelled) {
          setState({
            ready: false,
            error: "Google Maps JavaScript could not load. Check API restrictions, billing, and the browser console.",
          });
        }
      };
      document.head.appendChild(script);
    }

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      if (window[callbackName]) delete window[callbackName];
    };
  }, [apiKey]);

  return state;
}

export function parsePlace(place) {
  const comps = place.addressComponents || place.address_components || [];
  const get = (t, short = false) =>
    comps.find((c) => c.types.includes(t))?.[short ? "shortText" : "longText"] ||
    comps.find((c) => c.types.includes(t))?.[short ? "short_name" : "long_name"] ||
    "";

  const streetNumber = get("street_number");
  const route = get("route");
  const subpremise = get("subpremise");
  const locality = get("locality") || get("postal_town");
  const county = get("administrative_area_level_2");
  const state = get("administrative_area_level_1", true);
  const zipcode = get("postal_code");
  const country = get("country", true);

  const address1 = [streetNumber, route].filter(Boolean).join(" ");
  const address2 = subpremise || "";

  const location = place.location || place.geometry?.location;
  const lat = typeof location?.lat === "function" ? location.lat() : location?.lat;
  const lng = typeof location?.lng === "function" ? location.lng() : location?.lng;

  return {
    placeId: place.id || place.place_id || "",
    formattedAddress: place.formattedAddress || place.formatted_address || "",
    address1,
    address2,
    city: locality || "",
    county: county || "",
    state: state || "",
    zipcode: zipcode || "",
    country: country || "US",
    latitude: Number.isFinite(lat) ? lat : null,
    longitude: Number.isFinite(lng) ? lng : null,
  };
}

export const regionLabelFor = (c) =>
  ({ US: "State", CA: "Province", GB: "County/Region", AU: "State/Territory" }[
    c
  ] || "Region");

export const regionRequiredFor = (c) => ["US", "CA", "AU"].includes(c);

export const postalRuleFor = (c) => {
  switch (c) {
    case "US":
      return {
        required: true,
        pattern: /^\d{5}(-\d{4})?$/,
        hint: "##### or #####-####",
      };
    case "CA":
      return {
        required: true,
        pattern: /^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/,
        hint: "A1A 1A1",
      };
    case "GB":
      return {
        required: true,
        pattern:
          /^([Gg][Ii][Rr]\s?0[Aa]{2}|((([A-Za-z][0-9]{1,2})|(([A-Za-z][A-HJ-Ya-hj-y][0-9]{1,2})|(([A-Za-z][0-9][A-Za-z])|([A-Za-z][A-HJ-Ya-hj-y][0-9][A-Za-z]?))))\s?[0-9][A-Za-z]{2}))$/,
        hint: "e.g. SW1A 1AA",
      };
    case "AU":
      return { required: true, pattern: /^\d{4}$/, hint: "4 digits" };
    default:
      return { required: false, pattern: null, hint: "" };
  }
};
export const postalLabelFor = (c) => (c === "US" ? "ZIP Code" : "Postal Code");

/* ---------- Static data ---------- */

const COUNTRIES = [
  { code: "US", label: "United States" },
  { code: "CA", label: "Canada" },
  { code: "GB", label: "United Kingdom" },
  { code: "AU", label: "Australia" },
];

const US_STATES = [
  { code: "AL", label: "Alabama" },
  { code: "AK", label: "Alaska" },
  { code: "AZ", label: "Arizona" },
  { code: "AR", label: "Arkansas" },
  { code: "CA", label: "California" },
  { code: "CO", label: "Colorado" },
  { code: "CT", label: "Connecticut" },
  { code: "DE", label: "Delaware" },
  { code: "DC", label: "District of Columbia" },
  { code: "FL", label: "Florida" },
  { code: "GA", label: "Georgia" },
  { code: "HI", label: "Hawaii" },
  { code: "ID", label: "Idaho" },
  { code: "IL", label: "Illinois" },
  { code: "IN", label: "Indiana" },
  { code: "IA", label: "Iowa" },
  { code: "KS", label: "Kansas" },
  { code: "KY", label: "Kentucky" },
  { code: "LA", label: "Louisiana" },
  { code: "ME", label: "Maine" },
  { code: "MD", label: "Maryland" },
  { code: "MA", label: "Massachusetts" },
  { code: "MI", label: "Michigan" },
  { code: "MN", label: "Minnesota" },
  { code: "MS", label: "Mississippi" },
  { code: "MO", label: "Missouri" },
  { code: "MT", label: "Montana" },
  { code: "NE", label: "Nebraska" },
  { code: "NV", label: "Nevada" },
  { code: "NH", label: "New Hampshire" },
  { code: "NJ", label: "New Jersey" },
  { code: "NM", label: "New Mexico" },
  { code: "NY", label: "New York" },
  { code: "NC", label: "North Carolina" },
  { code: "ND", label: "North Dakota" },
  { code: "OH", label: "Ohio" },
  { code: "OK", label: "Oklahoma" },
  { code: "OR", label: "Oregon" },
  { code: "PA", label: "Pennsylvania" },
  { code: "RI", label: "Rhode Island" },
  { code: "SC", label: "South Carolina" },
  { code: "SD", label: "South Dakota" },
  { code: "TN", label: "Tennessee" },
  { code: "TX", label: "Texas" },
  { code: "UT", label: "Utah" },
  { code: "VT", label: "Vermont" },
  { code: "VA", label: "Virginia" },
  { code: "WA", label: "Washington" },
  { code: "WV", label: "West Virginia" },
  { code: "WI", label: "Wisconsin" },
  { code: "WY", label: "Wyoming" },
];

// LIMIT LOCATIONS
// Rough service areas for scaling: city → state → region → nationwide
const SERVICE_AREAS = {
  indy: {
    countries: ["US"],
    center: { lat: 39.7684, lng: -86.1581 }, // Indianapolis center
    radius: 50000, // 50 km radius around Indy
  },
  indianapolis: {
    countries: ["US"],
    center: { lat: 39.7684, lng: -86.1581 }, // Indianapolis center
    radius: 50000, // 50 km radius around Indy
  },
  indiana: {
    countries: ["US"],
    states: ["IN"],
  },
  midwest: {
    countries: ["US"],
    states: ["IN", "IL", "OH", "MI", "WI", "IA", "MN", "MO"],
  },
  us: {
    countries: ["US"],
  },
};

/**
 * Reusable, controlled Location step.
 *
 * Props:
 * - value: {
 *     address1, address2, city, county, state, zipcode, country,
 *     latitude, longitude, placeId, formattedAddress, instructions
 *   }
 * - onChange(patch) => void   // called with partial updates to merge into parent form
 * - errors: { address1?, city?, state?, zipcode?, country? } // optional
 * - googlePlacesApiKey: string
 * - restrictCountry?: "US" | "CA" | "GB" | "AU" | ...
 * - serviceArea: limits locations for right now, could be set to "indy", "indiana", "midwest", "us" to limit
 */
export default function LocationStep({
  value,
  onChange,
  errors = {},
  googlePlacesApiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY || "",
  restrictCountry = "US",
  serviceArea = "indiana", // "indy" | "indiana" | "midwest" | "us"
  touched,
  setTouched,
}) {
  const { ready: placesReady, error: placesLoadError } = useGooglePlaces(googlePlacesApiKey);

  useEffect(() => {
    if (!googlePlacesApiKey) {
      console.error("REACT_APP_GOOGLE_MAPS_API_KEY is missing from this build.");
    }
  }, [googlePlacesApiKey]);

  // local ui state
  const [cityOptions, setCityOptions] = useState([]);
  const [countyOptions, setCountyOptions] = useState([]);
  const [predictions, setPredictions] = useState([]);
  const [showPreds, setShowPreds] = useState(false);
  const [addressLookupError, setAddressLookupError] = useState("");

  // Google refs
  const autocompleteSessionTokenRef = useRef(null);
  const address1Ref = useRef(null);
  const addressAnchorRef = useRef(null);
  const googleAutocompleteHostRef = useRef(null);
  const placesLibraryRef = useRef(null);
  const geocoderRef = useRef(null);

  // Use Google's current autocomplete widget for the visible address search UI.
  useEffect(() => {
    if (!placesReady || !googleAutocompleteHostRef.current) return;
    let autocomplete;
    let handleSelect;
    let cancelled = false;

    (async () => {
      try {
        const { PlaceAutocompleteElement } = await window.google.maps.importLibrary("places");
        if (cancelled || !googleAutocompleteHostRef.current) return;

        autocomplete = new PlaceAutocompleteElement();
        autocomplete.placeholder = "Start typing an event address";
        autocomplete.includedRegionCodes = [
          String(restrictCountry || value.country || "US").toLowerCase(),
        ];
        autocomplete.style.width = "100%";

        handleSelect = async ({ placePrediction }) => {
          try {
            const place = placePrediction.toPlace();
            await place.fetchFields({
              fields: ["addressComponents", "formattedAddress", "location"],
            });
            const parsed = parsePlace(place);
            const area = SERVICE_AREAS[serviceArea] || SERVICE_AREAS.indiana;
            if (area.states?.length && parsed.state && !area.states.includes(parsed.state)) {
              setAddressLookupError("Tipsyverse currently accepts event locations in Indiana.");
              return;
            }
            setCityOptions(parsed.city ? [parsed.city] : []);
            setCountyOptions(parsed.county ? [parsed.county] : []);
            onChange({ ...parsed, address1: parsed.address1 || place.formattedAddress || "" });
            setAddressLookupError("");
          } catch (error) {
            console.error("Google Place selection failed:", error);
            setAddressLookupError("We couldn't load that address. Please try again or enter it manually.");
          }
        };

        autocomplete.addEventListener("gmp-select", handleSelect);
        googleAutocompleteHostRef.current.replaceChildren(autocomplete);
      } catch (error) {
        console.error("Google PlaceAutocompleteElement failed to initialize:", error);
        setAddressLookupError("Google address search is unavailable. You can enter the address manually.");
      }
    })();

    return () => {
      cancelled = true;
      if (autocomplete && handleSelect) {
        autocomplete.removeEventListener("gmp-select", handleSelect);
      }
      googleAutocompleteHostRef.current?.replaceChildren();
    };
  }, [placesReady, restrictCountry, value.country, serviceArea, onChange]);

  // Load the current Places library used by the Autocomplete Data API.
  useEffect(() => {
    if (!placesReady) return;
    let cancelled = false;

    (async () => {
      try {
        const places = await window.google.maps.importLibrary("places");
        if (cancelled) return;
        placesLibraryRef.current = places;
        autocompleteSessionTokenRef.current ||= new places.AutocompleteSessionToken();
        geocoderRef.current ||= new window.google.maps.Geocoder();
      } catch (error) {
        console.error("Google Places library failed to initialize:", error);
        setAddressLookupError("Address suggestions are temporarily unavailable. You can enter the address manually.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [placesReady]);

  // Fetch live predictions with Google's current Autocomplete Data API.
  const onAddressInput = async (e) => {
    const v = e.target.value;
    onChange({
      address1: v,
      latitude: null,
      longitude: null,
      placeId: "",
      formattedAddress: "",
    });
    setAddressLookupError("");

    const places = placesLibraryRef.current;
    if (!places?.AutocompleteSuggestion || !v.trim()) {
      setPredictions([]);
      setShowPreds(false);
      return;
    }

    try {
      autocompleteSessionTokenRef.current ||= new places.AutocompleteSessionToken();
      const country = String(
        restrictCountry || value.country || SERVICE_AREAS[serviceArea]?.countries?.[0] || "US"
      ).toLowerCase();

      const { suggestions } =
        await places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: v.trim(),
          includedRegionCodes: [country],
          region: country,
          sessionToken: autocompleteSessionTokenRef.current,
        });

      const placePredictions = (suggestions || [])
        .map((suggestion) => suggestion.placePrediction)
        .filter(Boolean);

      setPredictions(placePredictions);
      setShowPreds(placePredictions.length > 0);
    } catch (error) {
      console.error("Google Places autocomplete failed:", error);
      setPredictions([]);
      setShowPreds(false);
    }
  };

  const geocodeTypedOrAutofilledAddress = () => {
    setTouched?.((current) => ({ ...current, address1: true }));
    const typedAddress = String(address1Ref.current?.value || value.address1 || "").trim();
    if (!typedAddress || !geocoderRef.current) return;
    setAddressLookupError("");
    if (
      Number.isFinite(value.latitude) &&
      Number.isFinite(value.longitude) &&
      value.placeId
    ) {
      return;
    }

    const address = [
      typedAddress,
      value.city,
      value.state,
      value.zipcode,
      value.country,
    ]
      .filter(Boolean)
      .join(", ");

    geocoderRef.current.geocode(
      {
        address,
        componentRestrictions: {
          country: String(restrictCountry || value.country || "US").toUpperCase(),
        },
      },
      (results, status) => {
      const place = results?.[0];
      if (status !== "OK" || !place) {
        setAddressLookupError("We couldn't find that address. Choose a suggestion or enter City, State, and ZIP manually.");
        return;
      }
      const parsed = parsePlace(place);
      const area = SERVICE_AREAS[serviceArea] || SERVICE_AREAS.indiana;
      if (area.states?.length && parsed.state && !area.states.includes(parsed.state)) {
        setAddressLookupError("Tipsyverse currently accepts event locations in Indiana.");
        return;
      }
      setCityOptions(parsed.city ? [parsed.city] : []);
      setCountyOptions(parsed.county ? [parsed.county] : []);
      onChange({ ...parsed, address1: parsed.address1 || typedAddress });
      setAddressLookupError("");
    });
  };

  // Fetch the selected prediction with the current Place API.
  const pickPrediction = async (prediction) => {
    setShowPreds(false);
    setPredictions([]);

    try {
      const place = prediction.toPlace();
      await place.fetchFields({
        fields: ["addressComponents", "formattedAddress", "location"],
      });

      const parsed = parsePlace(place);
      const area = SERVICE_AREAS[serviceArea] || SERVICE_AREAS.indiana;
      if (area.states?.length && parsed.state && !area.states.includes(parsed.state)) {
        setAddressLookupError("Tipsyverse currently accepts event locations in Indiana.");
        return;
      }

      setCityOptions(parsed.city ? [parsed.city] : []);
      setCountyOptions(parsed.county ? [parsed.county] : []);
      onChange({ ...parsed, address1: parsed.address1 || value.address1 });
      setAddressLookupError("");

      const places = placesLibraryRef.current;
      if (places?.AutocompleteSessionToken) {
        autocompleteSessionTokenRef.current = new places.AutocompleteSessionToken();
      }
    } catch (error) {
      console.error("Google Place details failed:", error);
      setAddressLookupError("We couldn't load that address. Please try another suggestion or enter it manually.");
    }
  };

  const handleCountryChange = (e) => {
    const country = e.target.value;
    onChange({ country, state: country === "US" ? value.state : "" });
  };

  const regionLabel = useMemo(
    () => regionLabelFor(value.country),
    [value.country]
  );
  const regionRequired = useMemo(
    () => regionRequiredFor(value.country),
    [value.country]
  );
  const zipRule = useMemo(() => postalRuleFor(value.country), [value.country]);
  const postalLabel = useMemo(
    () => postalLabelFor(value.country),
    [value.country]
  );
  const showError = (field) => touched?.[field] && errors?.[field];

  useEffect(() => {
    if (!value?.address1 && value?.formattedAddress) {
      onChange({ address1: value.formattedAddress });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value?.formattedAddress]);

  return (
    <Stack spacing={2}>
      <div>
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            marginBottom: 6,
          }}
        >
          Search Event Address
        </div>
        <div ref={googleAutocompleteHostRef} style={{ width: "100%" }} />
        {!placesReady && !placesLoadError && (
          <div style={{ fontSize: 12, marginTop: 6 }}>
            Loading Google address search…
          </div>
        )}
        {placesLoadError && (
          <div
            role="alert"
            style={{ fontSize: 12, marginTop: 6, color: "#b00020", fontWeight: 600 }}
          >
            {placesLoadError}
          </div>
        )}
      </div>

      <div ref={addressAnchorRef} style={{ position: "relative" }}>
        <TextField
          fullWidth
          label="Address Line 1 (manual fallback)"
          inputRef={address1Ref}
          value={value.address1 ?? value.formattedAddress ?? ""}
          onChange={onAddressInput}
          onBlur={geocodeTypedOrAutofilledAddress}
          error={!!showError("address1") || !!addressLookupError}
          helperText={
            showError("address1")
              ? errors.address1
              : addressLookupError ||
                "Search to auto-fill, or enter the address manually. Map coordinates are optional."
          }
          inputProps={{ autoComplete: "off", id: "address-line-1", name: "event-location-search" }}
        />
        <Popper
          open={showPreds && predictions.length > 0}
          anchorEl={addressAnchorRef.current}
          placement="bottom-start"
          style={{ zIndex: 1600, width: addressAnchorRef.current?.offsetWidth || undefined }}
        >
          <Paper
            elevation={6}
            sx={{
              mt: 0.5,
              maxHeight: 320,
              overflowY: "auto",
              borderRadius: 2,
            }}
          >
            {predictions.map((p) => (
              <div
                key={p.placeId || p.text?.text || p.text?.toString()}
                onMouseDown={(e) => e.preventDefault()}
                onTouchStart={(e) => e.stopPropagation()}
                onClick={() => pickPrediction(p)}
                style={{
                  padding: "12px 14px",
                  cursor: "pointer",
                  borderBottom: "1px solid rgba(0,0,0,0.08)",
                }}
              >
                {p.text?.text || p.text?.toString() || ""}
              </div>
            ))}
          </Paper>
        </Popper>
      </div>

      <TextField
        fullWidth
        label="Address Line 2"
        value={value.address2 || ""}
        onChange={(e) => onChange({ address2: e.target.value })}
      />

      {countyOptions.length > 0 ? (
        <TextField
          select
          fullWidth
          label="County"
          value={value.county}
          onChange={(e) => onChange({ county: e.target.value })}
        >
          {countyOptions.map((c) => (
            <MenuItem key={c} value={c}>
              {c}
            </MenuItem>
          ))}
        </TextField>
      ) : (
        <TextField
          fullWidth
          label="County (optional)"
          value={value.county}
          onChange={(e) => onChange({ county: e.target.value })}
        />
      )}

      {cityOptions.length > 0 ? (
        <TextField
          select
          fullWidth
          label="City"
          value={value.city || ""}
          onChange={(e) => onChange({ city: e.target.value })}
          onBlur={() => setTouched?.((t) => ({ ...t, city: true }))}
          error={!!showError("city")}
          helperText={
            showError("city")
          }
        >
          {cityOptions.map((c) => (
            <MenuItem key={c} value={c}>
              {c}
            </MenuItem>
          ))}
        </TextField>
      ) : (
        <TextField
          fullWidth
          label="City"
          required={regionRequired}
          value={value.city || ""}
          onChange={(e) => onChange({ city: e.target.value })}
          onBlur={() => setTouched?.((t) => ({ ...t, city: true }))}
          error={!!showError("city")}
          helperText={
            showError("city")
              ? errors.city
              : "Auto-filled when available; you can also enter it manually."
          }
        />
      )}

      {value.country === "US" ? (
        <TextField
          select
          fullWidth
          required={regionRequired}
          label={regionLabel}
          value={value.state || ""}
          onChange={(e) => onChange({ state: e.target.value })}
          onBlur={() => setTouched?.((t) => ({ ...t, state: true }))}
          error={!!showError("state")}
          helperText={showError("state") ? errors.state : ""}
        >
          {US_STATES.map((s) => (
            <MenuItem key={s.code} value={s.code}>
              {s.label}
            </MenuItem>
          ))}
        </TextField>
      ) : (
        <TextField
          fullWidth
          required={regionRequired}
          label={regionLabel}
          value={value.state || ""}
          onChange={(e) => onChange({ state: e.target.value })}
          onBlur={() => setTouched?.((t) => ({ ...t, state: true }))}
          error={!!showError("state")}
          helperText={showError("state") ? errors.state : ""}
        />
      )}

      <TextField
        fullWidth
        required={zipRule.required}
        label={postalLabel}
        value={value.zipcode || ""}
        onChange={(e) => onChange({ zipcode: e.target.value })}
        onBlur={() => setTouched?.((t) => ({ ...t, zipcode: true }))}
        error={!!showError("zipcode")}
        helperText={showError("zipcode") ? errors.zipcode : zipRule.hint}
      />

      <TextField
        select
        fullWidth
        label="Country"
        value={value.country || "US"}
        onChange={handleCountryChange}
        error={!!errors.country}
        helperText={errors.country}
      >
        {COUNTRIES.map((c) => (
          <MenuItem key={c.code} value={c.code}>
            {c.label}
          </MenuItem>
        ))}
      </TextField>

      <TextField
        fullWidth
        multiline
        minRows={2}
        label="Additional Instructions (optional)"
        placeholder="Gate codes, load-in details, parking, etc."
        value={value.instructions}
        onChange={(e) => onChange({ instructions: e.target.value })}
        helperText="Gate codes, load-in details, parking, etc."
      />
    </Stack>
  );
}
