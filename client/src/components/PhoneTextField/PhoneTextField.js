import { Box, FormControl, FormHelperText, useTheme } from "@mui/material";
import { useState } from "react";
import { PhoneInput } from "react-international-phone";
import "react-international-phone/style.css";

/** MUI-outlined look & floating label for react-international-phone */
export default function PhoneTextField({
  label = "Contact Phone",
  value,
  onChange,
  defaultCountry = "us",
  name = "contactPhone",
  error = false,
  helperText = "",
  required = false,
  disabled = false,
  fullWidth = true,
}) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);

  return (
    <FormControl
      fullWidth={fullWidth}
      required={required}
      disabled={disabled}
      error={error}
      sx={{
        position: "relative",
        fontFamily: theme.typography.fontFamily,
        fontSize: theme.typography.body1.fontSize,
      }}
    >
      {/* Floating label that matches MUI OutlinedTextField */}
      <Box
        component="label"
        htmlFor={name}
        sx={{
          position: "absolute",
          left: 0,
          top: 12,
          transform: "translate(14px, -9px) scale(0.75)",
          transformOrigin: "left top",
          padding: "0 4px",
          backgroundColor: theme.palette.background.paper,
          color: disabled
            ? theme.palette.text.disabled
            : error
            ? theme.palette.error.main
            : focused
            ? theme.palette.primary.main
            : theme.palette.text.secondary,
          transition: theme.transitions.create(["color", "transform"]),
          pointerEvents: "none",
          lineHeight: 1.4,
        }}
      >
        {label}
      </Box>

      {/* Outlined container */}
      <Box
        sx={{
          mt: 1.5, // space so the non-shrunk label sits right
          height: 56,
          display: "flex",
          alignItems: "center",
          px: 1,
          borderRadius: 1,
          border: "1px solid",
          borderColor: disabled
            ? theme.palette.action.disabledBackground
            : error
            ? theme.palette.error.main
            : focused
            ? theme.palette.primary.main
            : "rgba(0,0,0,0.23)",

          "&:hover": {
            borderColor: disabled
              ? theme.palette.action.disabledBackground
              : error
              ? theme.palette.error.main
              : theme.palette.text.primary,
          },

          boxShadow:
            focused && !disabled
              ? `${theme.palette.primary.main}40 0 0 0 2px`
              : "none",

          // kill library borders + unify typography
          ".react-international-phone-input-container": {
            width: "100%",
            display: "flex",
            alignItems: "center",
            height: "100%",
            border: "none !important",
            boxShadow: "none !important",
            background: "transparent !important",
            padding: 0,
            fontFamily: `${theme.typography.fontFamily} !important`,
            fontSize: `${theme.typography.body1.fontSize} !important`,
          },
          [`.react-international-phone-country-selector,
 .react-international-phone-country-selector-button`]: {
            height: "100%",
            border: "none !important",
            boxShadow: "none !important",
            background: "transparent !important",
            borderRadius: theme.shape.borderRadius,
            color: disabled
              ? theme.palette.text.disabled
              : theme.palette.text.primary,
            opacity: disabled ? 0.6 : 1,
            "&:hover": {
              background: disabled ? "transparent" : theme.palette.action.hover,
            },
          },
          ".react-international-phone-country-selector": {
            position: "relative",
          },
          ".react-international-phone-country-selector-dropdown": {
            minWidth: 280,
            maxHeight: 340,
            backgroundColor: `${theme.palette.background.paper} !important`,
            color: `${theme.palette.text.primary} !important`,
            border: `1px solid ${theme.palette.divider} !important`,
            boxShadow: `${theme.shadows[8]} !important`,
            borderRadius: `${theme.shape.borderRadius}px !important`,
            opacity: "1 !important",
            overflowY: "auto",
            zIndex: `${theme.zIndex.modal + 1} !important`,
          },
          ".react-international-phone-country-selector-dropdown__list-item": {
            backgroundColor: `${theme.palette.background.paper} !important`,
            color: `${theme.palette.text.primary} !important`,
            opacity: "1 !important",
          },
          [`.react-international-phone-country-selector-dropdown__list-item:hover,
 .react-international-phone-country-selector-dropdown__list-item--focused`]: {
            backgroundColor: `${theme.palette.action.hover} !important`,
          },
          ".react-international-phone-country-selector-dropdown__list-item--selected": {
            backgroundColor: `${theme.palette.action.selected} !important`,
          },
          ".react-international-phone-country-selector-dropdown__list-item-dial-code": {
            color: `${theme.palette.text.secondary} !important`,
          },
          ".react-international-phone-input": {
            width: "100%",
            height: "100%",
            border: "none !important",
            boxShadow: "none !important",
            outline: "none !important",
            background: "transparent !important",
            padding: 0,
            fontFamily: `${theme.typography.fontFamily} !important`,
            fontSize: `${theme.typography.body1.fontSize} !important`,
            lineHeight: theme.typography.body1.lineHeight,
            color: disabled
              ? theme.palette.text.disabled
              : theme.palette.text.primary,
          },
        }}
      >
        <PhoneInput
          id={name}
          name={name}
          defaultCountry={defaultCountry}
          value={value}
          onChange={(val, meta) => onChange?.(val, meta)}
          forceDialCode
          disabled={disabled}
          inputProps={{
            id: name,
            name,
            "aria-label": label,
            onFocus: () => setFocused(true),
            onBlur: () => setFocused(false),
            autoComplete: "tel",
          }}
        />
      </Box>

      {helperText ? (
        <FormHelperText sx={{ fontSize: "0.75rem" }}>
          {helperText}
        </FormHelperText>
      ) : null}
    </FormControl>
  );
}
