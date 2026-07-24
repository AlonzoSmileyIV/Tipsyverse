// NotFoundScreen.jsx
import React from "react";
import { Box, Typography, Button } from "@mui/material";
import { useNavigate } from "react-router-dom";
import BrokenImageIcon from "@mui/icons-material/BrokenImage";
import PublicLayout from "../../components/PublicLayout/PublicLayout";
import HelmetHeader from "../../components/HelmetHeader/Helmet";
import { navigateOrReload } from "../../utils/navigateOrReload";

const NotFoundScreen = () => {
  const navigate = useNavigate();

  return (
    <PublicLayout>
      <HelmetHeader
        title="Tipsyverse | Page Not Found"
        description="The Tipsyverse page you are looking for could not be found."
        keywords="Tipsyverse page not found, 404"
        noindex
      />
      <Box
        sx={{
          height: "100vh",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          textAlign: "center",
          px: 2,
        }}
      >
        <BrokenImageIcon sx={{ fontSize: 100, color: "#ccc", mb: 2 }} />

        <Typography variant="h4" gutterBottom fontWeight="bold">
          Oops! Page Not Found
        </Typography>

        <Typography variant="body1" sx={{ maxWidth: 400, mb: 3 }}>
          Sorry, the page you're looking for doesn't exist. Maybe the cocktail
          spilled or the shaker went flying!
        </Typography>

        <Button
          variant="contained"
          onClick={() => navigateOrReload(navigate, "/")}
          sx={{ mt: 2, backgroundColor: "var(--primary-color)" }}
        >
          Go Back Home
        </Button>
      </Box>
    </PublicLayout>
  );
};

export default NotFoundScreen;
