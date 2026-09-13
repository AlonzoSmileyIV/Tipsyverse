import { useEffect, useState } from "react";
import { Alert, Box, Button, Paper, Stack, Typography } from "@mui/material";

const maintenanceEnabled =
  String(process.env.REACT_APP_MAINTENANCE_MODE).toLowerCase() === "true";

export default function AvailabilityGate({ children }) {
  const [online, setOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const markOnline = () => setOnline(true);
    const markOffline = () => setOnline(false);
    window.addEventListener("online", markOnline);
    window.addEventListener("offline", markOffline);
    return () => {
      window.removeEventListener("online", markOnline);
      window.removeEventListener("offline", markOffline);
    };
  }, []);

  if (maintenanceEnabled) {
    return (
      <Box
        component="main"
        sx={{ display: "grid", minHeight: "100vh", p: 2, placeItems: "center" }}
      >
        <Paper sx={{ maxWidth: 600, p: { xs: 3, md: 6 }, textAlign: "center" }}>
          <Stack spacing={2} alignItems="center">
            <Typography component="h1" variant="h3" fontWeight={800}>
              We’ll be right back
            </Typography>
            <Typography color="text.secondary">
              Tipsyverse is receiving a scheduled update. Please try again in a
              few minutes.
            </Typography>
            <Button variant="contained" onClick={() => window.location.reload()}>
              Check again
            </Button>
          </Stack>
        </Paper>
      </Box>
    );
  }

  return (
    <>
      {!online && (
        <Alert severity="warning" role="status" sx={{ borderRadius: 0 }}>
          You’re offline. Previously loaded information remains visible, but
          changes cannot be saved until your connection returns.
        </Alert>
      )}
      {children}
    </>
  );
}
