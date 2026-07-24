import React from "react";
import { Box, Typography, Button } from "@mui/material";
import { Link } from "react-router-dom";
import BlockIcon from "@mui/icons-material/Block"; // access denied icon
import PublicLayout from "../PublicLayout/PublicLayout";

const AccessDenied = () => {
  return (
    <PublicLayout>

    
    <Box
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      minHeight="70vh"
      textAlign="center"
      px={2}
    >
      <BlockIcon
        sx={{
          fontSize: 80,
          color: "var(--primary-color)",
          mb: 2,
        }}
      />
      <Typography variant="h4" fontWeight="bold" gutterBottom>
        Access Denied
      </Typography>
      <Typography variant="body1" color="text.secondary" mb={3}>
        You do not have the required permissions to view this page.
      </Typography>
      <Button
        component={Link}
        to="/"
        variant="contained"
        sx={{
          backgroundColor: "var(--primary-color)",
          textTransform: "none",
          fontWeight: 600,
        }}
      >
        Return to Home
      </Button>
    </Box>
    </PublicLayout>
  );
};

export default AccessDenied;
