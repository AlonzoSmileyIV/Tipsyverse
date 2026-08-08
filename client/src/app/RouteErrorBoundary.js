import React from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import * as Sentry from "@sentry/react";
import api from "../services/api";
import { readPersistedSession } from "../services/authSessionStore";

const FALLBACK_ERROR_MESSAGE = "An unexpected rendering error occurred.";
const FALLBACK_COMPONENT_LOCATION = "The component location was not available.";
const MAX_DESCRIPTION_LENGTH = 1900;

const buildErrorTicket = ({ error, componentStack }) => {
  const message = String(error?.message || FALLBACK_ERROR_MESSAGE).trim();
  const location = String(
    componentStack || FALLBACK_COMPONENT_LOCATION
  ).trim();
  const page =
    typeof window === "undefined" ? "Unknown page" : window.location.pathname;
  const subject = `Application error: ${message}`.slice(0, 120);
  const description = [
    `Error: ${message}`,
    `Page: ${page}`,
    "",
    "Likely location:",
    location,
  ]
    .join("\n")
    .slice(0, MAX_DESCRIPTION_LENGTH);

  return {
    category: "other",
    subject,
    description,
    errorReport: { message, location, page },
  };
};

/**
 * Contains rendering failures to the active route and offers a recovery path.
 * The boundary resets automatically after navigation.
 */
export default class RouteErrorBoundary extends React.Component {
  state = {
    error: null,
    componentStack: "",
    submittingTicket: false,
    ticketNotice: null,
  };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, errorInfo) {
    Sentry.captureException(error, { contexts: { react: errorInfo } });
    this.setState({
      componentStack: errorInfo?.componentStack?.trim() || "",
    });
  }

  componentDidUpdate(previousProps) {
    if (
      this.state.error &&
      previousProps.resetKey !== this.props.resetKey
    ) {
      this.setState({
        error: null,
        componentStack: "",
        submittingTicket: false,
        ticketNotice: null,
      });
    }
  }

  submitSupportTicket = async () => {
    if (this.state.submittingTicket) return;

    this.setState({ submittingTicket: true, ticketNotice: null });
    try {
      const ticketPayload = buildErrorTicket(this.state);
      const hasSession = Boolean(readPersistedSession());
      const response = await api.post(
        hasSession ? "/support-tickets" : "/support-tickets/error-report",
        hasSession ? ticketPayload : { errorReport: ticketPayload.errorReport }
      );
      const duplicate = Boolean(response.data?.duplicate);
      const ticketNumber = response.data?.data?.ticketNumber;

      this.setState({
        ticketNotice: {
          severity: duplicate ? "info" : "success",
          message: duplicate
            ? "We’re already investigating this issue. Please be patient while we work on it. Thanks!"
            : `Support ticket${ticketNumber ? ` ${ticketNumber}` : ""} was submitted automatically.`,
        },
      });
    } catch (error) {
      this.setState({
        ticketNotice: {
          severity: "error",
          message:
            error?.response?.data?.message ||
            "The support ticket could not be submitted. Please try again.",
        },
      });
    } finally {
      this.setState({ submittingTicket: false });
    }
  };

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
            <Paper
              component="pre"
              variant="outlined"
              sx={{
                boxSizing: "border-box",
                color: "error.main",
                fontFamily: "monospace",
                fontSize: "0.8125rem",
                m: 0,
                maxWidth: "100%",
                overflowX: "auto",
                p: 1.5,
                textAlign: "left",
                whiteSpace: "pre-wrap",
                width: "100%",
                wordBreak: "break-word",
              }}
            >
              {this.state.error?.message || "An unexpected rendering error occurred."}
            </Paper>
            <Box sx={{ textAlign: "left", width: "100%" }}>
              <Typography
                component="h2"
                variant="subtitle2"
                fontWeight={700}
                gutterBottom
              >
                Likely location
              </Typography>
              <Paper
                component="pre"
                variant="outlined"
                sx={{
                  boxSizing: "border-box",
                  fontFamily: "monospace",
                  fontSize: "0.75rem",
                  m: 0,
                  maxHeight: 220,
                  maxWidth: "100%",
                  overflow: "auto",
                  p: 1.5,
                  whiteSpace: "pre-wrap",
                  width: "100%",
                  wordBreak: "break-word",
                }}
              >
                {this.state.componentStack ||
                  "The component location was not available."}
              </Paper>
            </Box>
            {this.state.ticketNotice && (
              <Alert severity={this.state.ticketNotice.severity} sx={{ width: "100%" }}>
                {this.state.ticketNotice.message}
              </Alert>
            )}
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
              <Button variant="contained" sx={{backgroundColor: 'var(--primary-color)'}} onClick={() => window.location.reload()}>
                Refresh page
              </Button>
              <Button variant="outlined" sx={{color: 'var(--primary-color)', borderColor: 'var(--primary-color)'}} href="/">
                Return home
              </Button>
              <Button
                variant="outlined"
                sx={{ color: "var(--primary-color)", borderColor: "var(--primary-color)" }}
                onClick={this.submitSupportTicket}
                disabled={this.state.submittingTicket}
                startIcon={
                  this.state.submittingTicket ? (
                    <CircularProgress color="inherit" size={16} />
                  ) : null
                }
              >
                {this.state.submittingTicket
                  ? "Submitting"
                  : "Submit support ticket"}
              </Button>
            </Stack>
          </Stack>
        </Paper>
      </Box>
    );
  }
}
