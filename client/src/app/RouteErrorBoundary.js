import React from "react";
import { Box, Button, Paper, Stack, Typography } from "@mui/material";
import * as Sentry from "@sentry/react";

/**
 * Contains rendering failures to the active route and offers a recovery path.
 * The boundary resets automatically after navigation.
 */
export default class RouteErrorBoundary extends React.Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, errorInfo) {
    Sentry.captureException(error, { contexts: { react: errorInfo } });
  }

  componentDidUpdate(previousProps) {
    if (
      this.state.error &&
      previousProps.resetKey !== this.props.resetKey
    ) {
      this.setState({ error: null });
    }
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <Box
        component="main"
        sx={{ display: "grid", minHeight: "70vh", p: 2, placeItems: "center" }}
      >
        <Paper sx={{ maxWidth: 560, p: { xs: 3, md: 5 }, textAlign: "center" }}>
          <Stack spacing={2} alignItems="center">
            <Typography component="h1" variant="h4" fontWeight={800}>
              This page could not be displayed
            </Typography>
            <Typography color="text.secondary">
              Your information is safe. Refresh this page or return home and try
              again.
            </Typography>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
              <Button variant="contained" onClick={() => window.location.reload()}>
                Refresh page
              </Button>
              <Button variant="outlined" href="/">
                Return home
              </Button>
            </Stack>
          </Stack>
        </Paper>
      </Box>
    );
  }
}
