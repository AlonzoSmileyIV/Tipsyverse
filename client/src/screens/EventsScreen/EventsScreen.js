// pages/EventsHub.jsx
import React, { useCallback, useEffect, useState } from "react";

import {
  Box,
  Button,
  Chip,
  Divider,
  FormControl,
  Grid,
  Stack,
  Typography,
  Tooltip,
  IconButton,
  InputLabel,
  Menu,
  MenuItem,
  Pagination,
  Paper,
  Select,
  Dialog,
  DialogTitle,
  DialogContent,
  TextField,
  DialogActions,
} from "@mui/material";
import {
  CalendarMonth,
  HowToReg,
  Download,
  MoreVert,
  Refresh,
  Visibility,
} from "@mui/icons-material";
import { Link } from "react-router-dom";
import { Cancel as CancelIcon } from "@mui/icons-material";
import { useDispatch, useSelector } from "react-redux";
import PublicLayout from "../../components/PublicLayout/PublicLayout";
import HelmetHeader from "../../components/HelmetHeader/Helmet";
import ClientEventDetails from "../../components/ClientEventDetails/ClientEventDetails";
import { useNavigate, useParams } from "react-router-dom";

import {
  fetchMyEvents,
  fetchEventCounts,
  fetchEventById,
} from "../../features/events/eventSlice";
import moment from "moment";
import api from "../../services/api";
import { CollapseAlert } from "../../components/CollapseAlert/CollapseAlert";
import { buildSnapshotFromEvent } from "../../components/DetailedEventForm/DetailedEventForm.pricing";
import getCustomerPaymentStatus from "../../utils/customerPaymentStatus";
import getEventPaymentPolicyView from "../../utils/eventPaymentPolicy";
import {
  getEventPaidTotal,
  getEventPaymentTotal,
  getRequiredBartenderCount,
} from "../../utils/eventSummary";
import {
  formatEventTimestamp,
  getEventTimeZone,
} from "../../utils/timestamps";

/* helpers */
const fmtMoney = (n) => `$${(Number(n) || 0).toFixed(2)}`;
const primaryContainedSx = {
  backgroundColor: "var(--primary-color)",
  "&:hover": { backgroundColor: "#5f001f" },
};
const EVENTS_PER_PAGE = 10;
// Map common IANA zones to short US-style TZ abbreviations
const tzAbbr = (tz) => {
  const z = (tz || "").toLowerCase();
  if (
    /new_york|detroit|indiana|toronto|america\/(new_york|detroit|indiana|toronto|kentucky|louisville|monticello)/.test(
      z
    ) ||
    z.includes("eastern") ||
    z.includes("est")
  )
    return "EST";
  if (
    /chicago|mexico_city|winnipeg|america\/(chicago|mexico_city|winnipeg)/.test(
      z
    ) ||
    z.includes("central") ||
    z.includes("cst")
  )
    return "CST";
  if (
    /denver|phoenix|edmonton|america\/(denver|phoenix|edmonton)/.test(z) ||
    z.includes("mountain") ||
    z.includes("mst")
  )
    return "MST";
  if (
    /los_angeles|vancouver|america\/(los_angeles|vancouver)/.test(z) ||
    z.includes("pacific") ||
    z.includes("pst")
  )
    return "PST";
  if (z.includes("alaska")) return "AKST";
  if (z.includes("hawaii") || z.includes("honolulu")) return "HST";
  // Fall back to system’s local TZ short name or blank
  try {
    return (
      new Intl.DateTimeFormat([], { timeZoneName: "short" })
        .formatToParts(new Date())
        .find((p) => p.type === "timeZoneName")?.value || ""
    );
  } catch {
    return "";
  }
};

const STATUS_COLORS = {
  submitted: "info",
  pending: "warning",
  awaiting_response: "warning",
  bidding: "primary",
  selecting: "primary",
  ready_to_assign: "secondary",
  confirmed: "success",
  reminder_sent: "info",
  in_progress: "info",
  completed: "success",
  closed: "default",
  canceled: "error",
};

const CANCEL_REASONS = [
  { value: "no_longer_needed", label: "No longer need service" },
  { value: "date_changed", label: "Event date changed" },
  { value: "budget", label: "Budget issues" },
  { value: "other_vendor", label: "Found another vendor" },
  { value: "duplicate", label: "Duplicate request" },
  { value: "incorrect_details", label: "Incorrect event details" },
  { value: "other", label: "Other" },
];

const formatLabel = (value) => {
  if (!value) return "—";
  return value
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
};

const getEventTotal = (event) => {
  const snapshotTotal = (buildSnapshotFromEvent(event)?.totals?.totalC || 0) / 100;
  return getEventPaymentTotal(event, snapshotTotal);
};

const getEventBalance = (event) => {
  const paid = getEventPaidTotal(event);
  const total = getEventTotal(event);
  if (event?.payment?.balance != null && paid < total) {
    return Math.max(0, Number(event.payment.balance) || 0);
  }
  return Math.max(0, total - paid);
};

const getEventLocation = (event) =>
  event?.location?.formatted ||
  event?.location?.formattedAddress ||
  [event?.location?.city, event?.location?.state, event?.location?.zipcode]
    .filter(Boolean)
    .join(", ") ||
  "Location pending";

const getRangeBounds = (range, customFrom, customTo) => {
  const now = moment();
  if (range === "week") return { from: now.clone().startOf("week"), to: now.clone().endOf("week") };
  if (range === "year") return { from: now.clone().startOf("year"), to: now.clone().endOf("year") };
  if (range === "custom") {
    const from = customFrom ? moment(customFrom).startOf("day") : null;
    const to = customTo ? moment(customTo).endOf("day") : null;
    return { from, to };
  }
  return { from: now.clone().startOf("month"), to: now.clone().endOf("month") };
};

const eventInRange = (event, from, to) => {
  const start = event?.startAt ? moment(event.startAt) : null;
  if (!start?.isValid?.()) return false;
  if (from && start.isBefore(from)) return false;
  if (to && start.isAfter(to)) return false;
  return true;
};

function StatCard({ label, value, detail }) {
  return (
    <Paper variant="outlined" sx={{ p: 2, height: "100%" }}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="h5" fontWeight={800}>
        {value}
      </Typography>
      {detail && (
        <Typography variant="caption" color="text.secondary">
          {detail}
        </Typography>
      )}
    </Paper>
  );
}

function EventCard({ event, onCancel, onView, onVerifyAttendance }) {
  const paidTotal = getEventPaidTotal(event);
  const paymentTotal = getEventTotal(event);
  const paymentStatus = getCustomerPaymentStatus(paymentTotal, paidTotal);
  const paymentPolicy = getEventPaymentPolicyView(event, {
    total: paymentTotal,
    paid: paidTotal,
  });
  const bartenders = getRequiredBartenderCount(event, 1);
  const start = event?.startAt ? moment(event.startAt) : null;
  const end = event?.endAt ? moment(event.endAt) : null;
  const now = moment();
  const attendanceOpen =
    start?.isValid?.() && now.isSameOrAfter(start.clone().subtract(5, "minutes"));
  const attendanceClosed =
    end?.isValid?.() && now.isAfter(end.clone().add(3, "hours"));
  const attendanceAvailable = attendanceOpen && !attendanceClosed;

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack
        direction={{ xs: "column", md: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", md: "center" }}
        spacing={2}
      >
        <Box sx={{ minWidth: 0 }}>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
            <Typography variant="h6" fontWeight={800}>
              {event.shortCode || "Event"}
            </Typography>
            <Chip
              size="small"
              label={formatLabel(event.status)}
              color={STATUS_COLORS[event.status] || "default"}
            />
          </Stack>
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>
            {getEventLocation(event)}
          </Typography>
          <Typography variant="body2" sx={{ mt: 0.5 }}>
            {start?.isValid?.() && end?.isValid?.()
              ? `${formatEventTimestamp(event, event.startAt)} to ${formatEventTimestamp(
                  event,
                  event.endAt,
                  { includeDate: false }
                )}`
              : "Date pending"}
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mt: 1 }}>
            <Chip size="small" variant="outlined" label={`${bartenders} bartender${bartenders === 1 ? "" : "s"}`} />
            <Chip
              size="small"
              variant="outlined"
              label={paidTotal > 0 ? `Paid ${fmtMoney(paidTotal)}` : "No payments yet"}
            />
            <Chip
              size="small"
              color={
                paymentPolicy.severity === "error"
                  ? "error"
                  : paymentPolicy.severity === "warning"
                  ? "warning"
                  : paymentStatus.color
              }
              label={paymentPolicy.label}
            />
          </Stack>
        </Box>

        <Stack direction="row" spacing={1}>
          {(event.status === "submitted" || event.status === "pending") && (
            <Button
              variant="outlined"
              color="error"
              startIcon={<CancelIcon />}
              onClick={() => onCancel(event)}
            >
              Cancel
            </Button>
          )}
          {attendanceAvailable && (
            <Button
              variant="outlined"
              startIcon={<HowToReg />}
              onClick={() => onVerifyAttendance(event)}
              sx={{
                color: "var(--primary-color)",
                borderColor: "var(--primary-color)",
                "&:hover": {
                  borderColor: "var(--primary-color)",
                  backgroundColor: "rgba(128, 0, 32, 0.06)",
                },
              }}
            >
              Verify Attendance
            </Button>
          )}
          <Button
            variant="contained"
            startIcon={<Visibility />}
            onClick={() => onView(event)}
            sx={primaryContainedSx}
          >
            View Details
          </Button>
        </Stack>
      </Stack>
    </Paper>
  );
}

export default function EventsHub() {
  const { eventId, tab } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  //const myEvents = [];
  const { myEvents } = useSelector((s) => s.events);
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [initialDetailsTab, setInitialDetailsTab] = useState("details");
  const [range, setRange] = useState("month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [page, setPage] = useState(1);

  // instead of selectedEventId:
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelReasonOther, setCancelReasonOther] = useState("");
  const [eventToCancel, setEventToCancel] = useState(null);

  const [alert, setAlert] = useState(null);

  const fetchAllData = useCallback(() => {
    dispatch(fetchEventCounts());
    dispatch(fetchMyEvents());
  }, [dispatch]);

  // initial loads
  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  useEffect(() => {
    const run = async () => {
      if (!eventId) return;

      // validate tab
      const allowedTabs = ["details", "payments", "attendance", "reviews", "review"];
      const safeTab = allowedTabs.includes(tab) ? tab : "details";
      setInitialDetailsTab(safeTab);

      //console.log("initialDetailsTab: ", initialDetailsTab);

      try {
        const fullEvent = await dispatch(fetchEventById(eventId)).unwrap();

        if (!fullEvent?._id) {
          return;
        }

        setSelectedEvent(fullEvent);
        setDetailsOpen(true);
      } catch (err) {
        setDetailsOpen(false);
        setSelectedEvent(null);
        setAlert({
          message: "Event not found or you do not have permission to view it.",
          severity: "error",
        });
        navigate("/my-events", { replace: true });
      }
    };

    run();
  }, [eventId, tab, dispatch, navigate]);

  const handleRefresh = () => {
    fetchAllData();
    setAlert({
      message: "Data has been refreshed.",
      severity: "success",
    });
  };

  const { from, to } = getRangeBounds(range, customFrom, customTo);
  const filteredEvents = (myEvents || []).filter((event) =>
    eventInRange(event, from, to)
  );
  const totalPages = Math.max(
    1,
    Math.ceil(filteredEvents.length / EVENTS_PER_PAGE)
  );
  const paginatedEvents = filteredEvents.slice(
    (page - 1) * EVENTS_PER_PAGE,
    page * EVENTS_PER_PAGE
  );
  const eventStats = filteredEvents.reduce(
    (acc, event) => {
      const balance = getEventBalance(event);
      const paid = getEventPaidTotal(event);
      const total = getEventTotal(event);
      acc.balance += balance;
      acc.paid += paid;
      acc.total += total;
      if (event?.startAt && moment(event.startAt).isSameOrAfter(moment())) acc.upcoming += 1;
      if (["completed", "closed"].includes(event?.status)) acc.completed += 1;
      return acc;
    },
    { total: 0, paid: 0, balance: 0, upcoming: 0, completed: 0 }
  );

  useEffect(() => {
    setPage(1);
  }, [range, customFrom, customTo, myEvents?.length]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const handleExportCSV = () => {
    const header = [
      "Type",
      "Formatted Address",
      "Start UTC",
      "End UTC",
      "Event Start",
      "Event End",
      "Event Timezone",
      "Status",
    ].join(",");
    const body = filteredEvents.map((e) =>
      [
        JSON.stringify(e?.type ?? ""),
        JSON.stringify(e?.location?.formatted ?? ""),
        JSON.stringify(
          e?.startAt ? new Date(e.startAt).toISOString() : ""
        ),
        JSON.stringify(
          e?.endAt ? new Date(e.endAt).toISOString() : ""
        ),
        JSON.stringify(formatEventTimestamp(e, e?.startAt)),
        JSON.stringify(formatEventTimestamp(e, e?.endAt)),
        JSON.stringify(getEventTimeZone(e)),
        JSON.stringify(e?.status ?? ""),
      ].join(",")
    );
    const csv = [header, ...body].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "MyEvents.csv";
    a.click();
    URL.revokeObjectURL(url);
    setMenuAnchor(null);
  };

  // Actions
  // const handleView = async (row) => {
  //   if (!row?._id) return;

  //   try {
  //     const fullEvent = await dispatch(fetchEventById(row._id)).unwrap();
  //     // fullEvent = whatever your thunk returns (often res.data.data or res.data)

  //     setSelectedEvent(fullEvent);
  //     setDetailsOpen(true);
  //   } catch (err) {
  //     console.error("Failed to load event details", err);
  //     // optionally show a toast/snackbar here
  //   }
  // };
  const handleView = (row, targetTab = "details") => {
  if (!row?._id) return;
  navigate(`/my-events/${row._id}/${targetTab}`);
};

  // Actions
  const handleOpenCancel = async (row) => {
    if (!row?._id) return;

    try {
      const fullEvent = await dispatch(fetchEventById(row._id)).unwrap();
      setSelectedEvent(fullEvent);
      setEventToCancel(fullEvent);

      setCancelConfirmOpen(true);
    } catch (err) {
      console.error("Failed to load event details", err);
    }
  };

  const submitCancel = async () => {
    if (!eventToCancel?._id) return;

    try {
      await api.post(`/events/${eventToCancel?._id}/cancel`, {
        cancelReason,
        cancelReasonOther,
      });

      setCancelConfirmOpen(false);
      setCancelReason("");
      setEventToCancel(null);
      fetchAllData();
      setAlert({
        message: "Event has been canceled.",
        severity: "success",
      });
    } catch (err) {
      console.error("Cancel failed:", err);
      setAlert({
        message: err?.response?.data?.message || err?.message,
        severity: "error",
      });
    }
  };

  return (
    <PublicLayout>
      <HelmetHeader
        title="Tipsyverse | My Events"
        description="View and manage your Tipsyverse event requests."
        keywords="tipsyverse, events, my events"
      />
      <Box sx={{ p: 5 }}>
        {!myEvents || myEvents.length === 0 ? (
          <Box
            sx={{
              mt: 6,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              textAlign: "center",
            }}
          >
            <CalendarMonth
              sx={{
                fontSize: 80,
                mb: 2,
                color: "text.secondary",
              }}
            />
            <Typography variant="h6" gutterBottom>
              You have no events yet
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ mb: 3, maxWidth: 360 }}
            >
              Please book an event to see it here. Once you submit a request, it
              will show up on this page.
            </Typography>
            <Button
              component={Link}
              to="/book"
              variant="contained"
              size="medium"
              sx={{
                textTransform: "none",
                backgroundColor: "var(--primary-color)",
                borderRadius: 2,
                px: 3,
              }}
            >
              Book An Event
            </Button>
          </Box>
        ) : (
          <>
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                mb: 2,
                gap: 1,
                flexWrap: "wrap",
              }}
            >
              <Box>
                <Typography variant="h4" gutterBottom>
                  My Events
                </Typography>
                <Typography color="text.secondary">
                  Track your bookings, balances, payments, bartenders, and reviews.
                </Typography>
              </Box>
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                <Button
                  component={Link}
                  to="/book"
                  variant="contained"
                  sx={{ textTransform: "none", ...primaryContainedSx }}
                >
                  Book An Event
                </Button>

                <Tooltip title="Refresh">
                  <IconButton onClick={handleRefresh}>
                    <Refresh />
                  </IconButton>
                </Tooltip>

                <IconButton onClick={(e) => setMenuAnchor(e.currentTarget)}>
                  <MoreVert />
                </IconButton>
                <Menu
                  anchorEl={menuAnchor}
                  open={Boolean(menuAnchor)}
                  onClose={() => setMenuAnchor(null)}
                >
                  <MenuItem onClick={handleExportCSV}>
                    <Download fontSize="small" style={{ marginRight: 8 }} />
                    Export CSV
                  </MenuItem>
                </Menu>
              </Stack>
            </Box>

            {alert && (
              <CollapseAlert
                open={!!alert}
                severity={alert.severity}
                message={alert.message}
                onClose={() => setAlert(null)}
              />
            )}

            <Divider sx={{ mb: 2 }} />

            <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
              <Stack
                direction={{ xs: "column", md: "row" }}
                spacing={2}
                alignItems={{ xs: "stretch", md: "center" }}
              >
                <FormControl size="small" sx={{ minWidth: 180 }}>
                  <InputLabel>Date Range</InputLabel>
                  <Select
                    label="Date Range"
                    value={range}
                    onChange={(e) => setRange(e.target.value)}
                  >
                    <MenuItem value="week">This Week</MenuItem>
                    <MenuItem value="month">This Month</MenuItem>
                    <MenuItem value="year">This Year</MenuItem>
                    <MenuItem value="custom">Custom</MenuItem>
                  </Select>
                </FormControl>
                {range === "custom" && (
                  <>
                    <TextField
                      size="small"
                      label="From"
                      type="date"
                      value={customFrom}
                      onChange={(e) => setCustomFrom(e.target.value)}
                      InputLabelProps={{ shrink: true }}
                    />
                    <TextField
                      size="small"
                      label="To"
                      type="date"
                      value={customTo}
                      onChange={(e) => setCustomTo(e.target.value)}
                      InputLabelProps={{ shrink: true }}
                    />
                  </>
                )}
              </Stack>
            </Paper>

            <Grid container spacing={2} sx={{ mb: 2 }}>
              <Grid item xs={12} sm={6} md={3}>
                <StatCard label="Events" value={filteredEvents.length} detail={`${eventStats.completed} completed`} />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <StatCard label="Upcoming" value={eventStats.upcoming} detail="Scheduled in this range" />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <StatCard label="Paid" value={fmtMoney(eventStats.paid)} detail={`Against ${fmtMoney(eventStats.total)}`} />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <StatCard label="You Owe" value={fmtMoney(eventStats.balance)} detail={eventStats.balance > 0 ? "Remaining balance" : "No balance due"} />
              </Grid>
            </Grid>

            {filteredEvents.length === 0 ? (
              <Paper variant="outlined" sx={{ p: 4, textAlign: "center" }}>
                <Typography fontWeight={700}>No events in this range.</Typography>
                <Typography variant="body2" color="text.secondary">
                  Try a different range or book a new event.
                </Typography>
              </Paper>
            ) : (
              <Stack spacing={1.5}>
                {filteredEvents.length > EVENTS_PER_PAGE && (
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    alignItems={{ xs: "stretch", sm: "center" }}
                    justifyContent="space-between"
                    spacing={1.5}
                  >
                    <Typography variant="body2" color="text.secondary">
                      Showing {(page - 1) * EVENTS_PER_PAGE + 1}-
                      {Math.min(page * EVENTS_PER_PAGE, filteredEvents.length)} of{" "}
                      {filteredEvents.length} events
                    </Typography>
                    <Pagination
                      count={totalPages}
                      page={page}
                      onChange={(_, value) => setPage(value)}
                      color="primary"
                      sx={{
                        alignSelf: { xs: "center", sm: "auto" },
                        "& .MuiPaginationItem-root.Mui-selected": {
                          backgroundColor: "var(--primary-color)",
                          color: "#fff",
                        },
                        "& .MuiPaginationItem-root.Mui-selected:hover": {
                          backgroundColor: "#5f001f",
                        },
                      }}
                    />
                  </Stack>
                )}

                {paginatedEvents.map((event) => (
                  <EventCard
                    key={event._id}
                    event={event}
                    onView={handleView}
                    onVerifyAttendance={(row) => handleView(row, "attendance")}
                    onCancel={handleOpenCancel}
                  />
                ))}

                {filteredEvents.length > EVENTS_PER_PAGE && (
                  <Box sx={{ display: "flex", justifyContent: "center", pt: 1 }}>
                    <Pagination
                      count={totalPages}
                      page={page}
                      onChange={(_, value) => setPage(value)}
                      color="primary"
                      sx={{
                        "& .MuiPaginationItem-root.Mui-selected": {
                          backgroundColor: "var(--primary-color)",
                          color: "#fff",
                        },
                        "& .MuiPaginationItem-root.Mui-selected:hover": {
                          backgroundColor: "#5f001f",
                        },
                      }}
                    />
                  </Box>
                )}
              </Stack>
            )}
          </>
        )}

        {/* Drawer (client-friendly details) */}
        {selectedEvent && (
          <ClientEventDetails
            open={detailsOpen}
            event={selectedEvent}
            initialTab={initialDetailsTab}
            onTabChange={(nextTab) => {
              if (!selectedEvent?._id) return;
              navigate(`/my-events/${selectedEvent._id}/${nextTab}`, {
                replace: true,
              });
            }}
            onClose={() => {
              setDetailsOpen(false);
              setSelectedEvent(null);
              navigate(`/my-events`, { replace: true });
            }}
          />
        )}

        <Dialog
          open={cancelConfirmOpen}
          onClose={() => setCancelConfirmOpen(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle sx={{ fontWeight: 700 }}>Cancel Event?</DialogTitle>

          <DialogContent dividers>
            <Typography sx={{ mb: 2 }}>
              Are you sure you want to cancel this event?
            </Typography>

            {eventToCancel && (
              <Box sx={{ mb: 2, p: 2, bgcolor: "#f7f7f7", borderRadius: 2 }}>
                <Typography>
                  <strong>Event:</strong> {eventToCancel.type}
                </Typography>
                <Typography>
                  <strong>Start:</strong>{" "}
                  {formatEventTimestamp(eventToCancel, eventToCancel.startAt)}
                </Typography>
              </Box>
            )}

            <TextField
              select
              fullWidth
              label="Cancellation Reason"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              sx={{ mb: 2 }}
            >
              {CANCEL_REASONS.map((r) => (
                <MenuItem key={r.value} value={r.value}>
                  {r.label}
                </MenuItem>
              ))}
            </TextField>

            {cancelReason === "other" && (
              <TextField
                fullWidth
                label="Please specify"
                value={cancelReasonOther}
                onChange={(e) => setCancelReasonOther(e.target.value)}
                multiline
                minRows={2}
                sx={{ mb: 2 }}
              />
            )}
          </DialogContent>

          <DialogActions sx={{ p: 2 }}>
            <Button
              onClick={() => setCancelConfirmOpen(false)}
              color="inherit"
              variant="outlined"
            >
              Keep Event
            </Button>

            <Button
              color="error"
              variant="contained"
              disabled={
                !cancelReason ||
                (cancelReason === "other" && !cancelReasonOther)
              }
              onClick={submitCancel}
            >
              Cancel Event
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </PublicLayout>
  );
}
