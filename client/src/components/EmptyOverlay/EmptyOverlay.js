import React from "react";
import {
  Box,
  Button,
  Stack,
  Typography,
} from "@mui/material";

import defaultEmptyImage from "../../assets/images/undraw_empty.svg";

const EmptyOverlay = ({
  image = defaultEmptyImage,
  title = "Nothing here yet",
  message = "No data to display.",
  primaryButton,
  onPrimaryClick,
  secondaryButton,
  onSecondaryClick,
  imageHeight = 180,
  inGrid = true,
}) => {
  return (
    <Box
      role={inGrid ? "row" : undefined}
      sx={{
        height: "100%",
        minHeight: 350,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        p: 4,
      }}
    >
      <Stack
        role={inGrid ? "gridcell" : undefined}
        spacing={2}
        alignItems="center"
        maxWidth={450}
      >
        <Box
          component="img"
          src={image}
          alt="Empty state"
          sx={{
            height: imageHeight,
            width: "auto",
            maxWidth: "100%",
            opacity: 0.95,
            userSelect: "none",
            pointerEvents: "none",
          }}
        />

        <Typography variant="h6" fontWeight={700}>
          {title}
        </Typography>

        <Typography color="text.secondary">
          {message}
        </Typography>

        {(primaryButton || secondaryButton) && (
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1.5}
          >
            {primaryButton && (
              <Button
                variant="contained"
                sx={{
                  backgroundColor: "var(--primary-color)",
                }}
                onClick={onPrimaryClick}
              >
                {primaryButton}
              </Button>
            )}

            {secondaryButton && (
              <Button
                variant="outlined"
                onClick={onSecondaryClick}
              >
                {secondaryButton}
              </Button>
            )}
          </Stack>
        )}
      </Stack>
    </Box>
  );
};

export default EmptyOverlay;
