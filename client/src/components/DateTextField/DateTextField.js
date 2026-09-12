import React, { useRef } from "react";
import CalendarMonthOutlined from "@mui/icons-material/CalendarMonthOutlined";
import { IconButton, InputAdornment, TextField } from "@mui/material";

const toDisplayDate = (isoDate = "") => {
  const match = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[2]}/${match[3]}/${match[1]}` : "";
};

const toIsoDate = (displayDate = "") => {
  const match = displayDate.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return match ? `${match[3]}-${match[1]}-${match[2]}` : "";
};

/**
 * A normal MM/DD/YYYY text field with an optional native calendar picker.
 * Manual typing continues to flow through the supplied onChange handler.
 */
const DateTextField = ({
  onChange,
  value = "",
  calendarMin,
  calendarMax,
  InputProps,
  inputProps,
  disabled,
  label,
  ...textFieldProps
}) => {
  const calendarRef = useRef(null);

  const openCalendar = () => {
    const calendar = calendarRef.current;
    if (!calendar) return;

    if (typeof calendar.showPicker === "function") {
      calendar.showPicker();
    } else {
      calendar.click();
    }
  };

  const handleCalendarChange = (event) => {
    const displayValue = toDisplayDate(event.target.value);
    if (!displayValue) return;

    onChange?.({
      target: {
        name: textFieldProps.name,
        value: displayValue,
        type: "text",
      },
    });
  };

  return (
    <TextField
      {...textFieldProps}
      label={label}
      disabled={disabled}
      value={value}
      onChange={onChange}
      placeholder="MM/DD/YYYY"
      InputLabelProps={{ shrink: true, ...textFieldProps.InputLabelProps }}
      inputProps={{ inputMode: "numeric", maxLength: 10, ...inputProps }}
      InputProps={{
        ...InputProps,
        endAdornment: (
          <>
            {InputProps?.endAdornment}
            <InputAdornment position="end">
              <IconButton
                type="button"
                edge="end"
                disabled={disabled}
                onClick={openCalendar}
                aria-label={`Choose ${label || "date"} from calendar`}
              >
                <CalendarMonthOutlined />
              </IconButton>
              <input
                ref={calendarRef}
                type="date"
                tabIndex={-1}
                aria-hidden="true"
                value={toIsoDate(value)}
                min={calendarMin}
                max={calendarMax}
                disabled={disabled}
                onChange={handleCalendarChange}
                style={{
                  position: "absolute",
                  width: 1,
                  height: 1,
                  opacity: 0,
                  pointerEvents: "none",
                }}
              />
            </InputAdornment>
          </>
        ),
      }}
    />
  );
};

export default DateTextField;
