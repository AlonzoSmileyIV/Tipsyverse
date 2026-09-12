import React from "react";
import {
  Box,
  useMediaQuery,
  useTheme,
  Typography,
  Button,
} from "@mui/material";
import { Link } from "react-router-dom";

const AuthLayout = ({
  children,
  image,
  position = "left",
  message = "Welcome to Tipsyverse!",
  circleMessage = "New here?",
  buttonLabel = "Sign Up",
  buttonLink = "/register",
}) => {
  const theme = useTheme();
  const isSmallScreen = useMediaQuery(theme.breakpoints.down("md"));
  const isLeft = position === "left";

  return (
    <Box
      sx={{
        minHeight: "100vh",
        width: "100%",
        display: "flex",
        flexDirection: isSmallScreen ? "column" : "row",
      }}
    >
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <Box
        component="main"
        id="main-content"
        sx={{
          width: isSmallScreen ? "100%" : "50%",
          order: isSmallScreen ? 1 : isLeft ? 1 : 0, // ⬅️ switch order
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          p: 4,
          backgroundColor: "white",
        }}
      >
        <Box
          sx={{
            width: "100%",
            maxWidth: 400,
            boxShadow: isSmallScreen ? 3 : 0,
            borderRadius: 2,
            p: isSmallScreen ? 3 : 0,
          }}
        >
          {children}
        </Box>
      </Box>

      {/* 🔁 Circle Message Panel */}
      <Box
        component="aside"
        aria-label="Account access information"
        sx={{
          width: isSmallScreen ? "100%" : "50%",
          order: isSmallScreen ? 0 : isLeft ? 0 : 1, // ⬅️ switch order
          backgroundColor: "var(--primary-color)",
          color: "white",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          p: 4,
          minHeight: isSmallScreen ? "300px" : "100vh",
          textAlign: "center",
        }}
      >
        <Typography component="h2" variant="h4" fontWeight="bold" sx={{ mb: 6 }}>
          {message}
        </Typography>

        <Box
          sx={{
            width: 320,
            height: 320,
            borderRadius: "50%",
            backgroundColor: "white",
            color: "black",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            p: 3,
            textAlign: "center",
            boxShadow: 3,
          }}
        >
          {image && (
            <Box
              component="img"
              src={image}
              alt="Illustration"
              sx={{
                width: "90%",
                maxWidth: 220,
                objectFit: "contain",
                mb: 1.5,
              }}
            />
          )}
          <Typography variant="body1" fontWeight={600}>
            {circleMessage}
          </Typography>
          <Button
            variant="outlined"
            size="small"
            component={Link}
            to={buttonLink}
            sx={{
              mt: 1.5,
              borderColor: "black",
              color: "black",
              fontWeight: 600,
              "&:hover": {
                borderColor: "black",
                backgroundColor: "#f5f5f5",
              },
            }}
          >
            {buttonLabel}
          </Button>
        </Box>
      </Box>
    </Box>
  );
};

export default AuthLayout;
