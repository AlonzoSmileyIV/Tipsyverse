import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Drawer,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Rating,
  Select,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import api from "../../services/api";
import { formatStatus } from "../../utils/formatStatus";
import { buildSnapshotFromEvent } from "../DetailedEventForm/DetailedEventForm.pricing";
import getCustomerPaymentStatus from "../../utils/customerPaymentStatus";
import getEventPaymentPolicyView, { formatPaymentDueDate } from "../../utils/eventPaymentPolicy";
import { formatTimestamp, getEventTimeZone } from "../../utils/timestamps";
import {
  getApprovedBartenderCount,
  getEventPaidTotal,
  getEventPaymentTotal,
  getRecommendedBartenderCount,
} from "../../utils/eventSummary";

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

const formatLabel = (value) => {
  if (!value) return "—";
  return value
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
};

// --- tiny helpers ---
const fmtMoney = (n) => `$${(Number(n) || 0).toFixed(2)}`;
const formatLocationPretty = (loc = {}) => {
  if (loc.formattedAddress || loc.formatted)
    return loc.formattedAddress || loc.formatted;
  const line1 = [loc.address1, loc.address2].filter(Boolean).join(" ");
  const line2 = [loc.city, loc.state || loc.stateCode]
    .filter(Boolean)
    .join(", ");
  const line3 = [loc.zipcode, loc.country].filter(Boolean).join(" ");
  return [line1, line2, line3].filter(Boolean).join(" • ");
};
const tzAbbr = (date, timeZone) => {
  if (!timeZone) return "";
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      timeZoneName: "short",
      hour: "2-digit",
    }).formatToParts(date);
    const name = parts.find((p) => p.type === "timeZoneName")?.value || "";
    if (/^[A-Z]{2,5}$/.test(name)) return name;
    if (/^GMT[+]\d{1,2}/i.test(name)) return name.toUpperCase();
  } catch {}
  return "";
};
const formatWhen = (startStr, endStr, timeZone = "UTC") => {
  const s = startStr ? new Date(startStr) : null;
  const e = endStr ? new Date(endStr) : null;
  if (!s || !e || isNaN(s) || isNaN(e)) return "—";
  const sameDay = s.toDateString() === e.toDateString();
  const dateFmt = new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone,
  });
  const timeFmt = new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  });
  const mins = Math.max(0, Math.round((e - s) / 60000));
  const dur =
    mins >= 60
      ? `${Math.floor(mins / 60)}h${mins % 60 ? ` ${mins % 60}m` : ""}`
      : `${mins}m`;
  const abbr = tzAbbr(s, timeZone);
  const abbrSuffix = abbr ? ` ${abbr}` : "";
  if (sameDay)
    return `${dateFmt.format(s)} • ${timeFmt.format(s)}–${timeFmt.format(
      e
    )}${abbrSuffix} (${dur})`;
  return `${dateFmt.format(s)} ${timeFmt.format(s)} → ${dateFmt.format(
    e
  )} ${dateFmt.format(e)}${abbrSuffix} (${dur})`;
};

const toDateTimeLocalValue = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
};

const REVIEW_COMMENT_LIMIT = 500;
const MS_DAY = 24 * 60 * 60 * 1000;
const formatShortTime = (value) =>
  value
    ? new Date(value).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";
const getPaymentStatus = (payment) =>
  String(payment?.status || "recorded").toLowerCase();
const isActivePayment = (payment) =>
  !["voided", "refunded"].includes(getPaymentStatus(payment));
const getEventPaymentBaseTotal = (event) => {
  const snapshotTotal = (buildSnapshotFromEvent(event)?.totals?.totalC || 0) / 100;
  return getEventPaymentTotal(event, snapshotTotal);
};

function LabelVal({ label, value }) {
  return (
    <Stack spacing={0.25} sx={{ mb: 0.5 }}>
      <Typography variant="overline" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body1">{String(value ?? "—")}</Typography>
    </Stack>
  );
}

function PaymentRow({ pmt, timeZone }) {
  const when = formatTimestamp(pmt.receivedAt || pmt.createdAt, { timeZone });
  const statusColor =
    pmt.status === "recorded"
      ? "success"
      : pmt.status === "refunded"
      ? "warning"
      : pmt.status === "voided"
      ? "error"
      : "default";
  return (
    <Paper variant="outlined" sx={{ p: 1 }}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        justifyContent="space-between"
      >
        <Typography variant="body2">
          <strong>{fmtMoney(pmt.amount)}</strong> •{" "}
          {formatLabel(pmt.method?.brand || pmt.methodBrand || pmt.method || "Payment")}{" "}
          {pmt.method?.last4 || pmt.last4
            ? `•••• ${pmt.method?.last4 || pmt.last4}`
            : ""}
        </Typography>
        <Stack direction="row" spacing={1}>
          <Chip size="small" label={pmt.status || "—"} color={statusColor} />
          <Typography variant="caption" color="text.secondary">
            {when}
          </Typography>
        </Stack>
      </Stack>
    </Paper>
  );
}

export default function ClientEventDetailsDrawer({
  open,
  onClose,
  event,
  initialTab,
  onTabChange,
}) {
  const [loading, setLoading] = useState(false);
  const [payments, setPayments] = useState([]);
  const [detailsTab, setDetailsTab] = useState("details");
  // "details" | "payments" | "attendance" | "reviews"

  const [eventAssignments, setEventAssignments] = useState([]);
  const [assignmentsError, setAssignmentsError] = useState("");
  const [searchAssignedBartenders, setSearchAssignedBartenders] = useState("");
  const [checkedAssignments, setCheckedAssignments] = useState([]);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewAlert, setReviewAlert] = useState(null);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [attendanceVerify, setAttendanceVerify] = useState({});
  const [reviews, setReviews] = useState([]);
  const [bulkAttendance, setBulkAttendance] = useState({
    status: "present",
    notes: "",
    clockInAt: "",
    clockOutAt: "",
  });
  const [verifyingAttendance, setVerifyingAttendance] = useState(false);
  const appliedInitialTabRef = useRef("");

  // { severity: "success" | "error", message: string } or null

  // Normalize assignment id
  const getAssignmentId = (a) => String(a._id || a.id || "");

  // Search helper
  const assignmentMatchesSearch = (assignment, raw) => {
    if (!raw) return true;
    const q = raw.trim().toLowerCase();
    if (!q) return true;

    const u = assignment.bartenderUser || {};
    const name = u.fullName || u.name || u.displayName || "";
    const email = u.email || "";

    return name.toLowerCase().includes(q) || email.toLowerCase().includes(q);
  };

  // Filtered list based on search
  const filteredAssignments = useMemo(
    () =>
      eventAssignments.filter((a) =>
        assignmentMatchesSearch(a, searchAssignedBartenders)
      ),
    [eventAssignments, searchAssignedBartenders]
  );

  // For header checkbox (select all on current filter)
  const assignmentIdsInList = filteredAssignments.map(getAssignmentId);

  const allAssignedChecked =
    assignmentIdsInList.length > 0 &&
    assignmentIdsInList.every((id) =>
      checkedAssignments.some((x) => getAssignmentId(x) === id)
    );

  const someAssignedChecked =
    assignmentIdsInList.length > 0 &&
    !allAssignedChecked &&
    assignmentIdsInList.some((id) =>
      checkedAssignments.some((x) => getAssignmentId(x) === id)
    );

  // Toggle header checkbox (select/unselect all visible)
  const toggleHeaderAssignedCheckbox = () => {
    setCheckedAssignments((prev) => {
      if (allAssignedChecked) {
        // unselect all visible
        return prev.filter(
          (x) => !assignmentIdsInList.includes(getAssignmentId(x))
        );
      }
      // select all visible
      const map = new Map(prev.map((x) => [getAssignmentId(x), x]));
      filteredAssignments.forEach((a) => map.set(getAssignmentId(a), a));
      return Array.from(map.values());
    });
  };

  // Toggle row checkbox
  const toggleAssignedRow = (assignment) => () => {
    setCheckedAssignments((prev) => {
      const id = getAssignmentId(assignment);
      const exists = prev.some((x) => getAssignmentId(x) === id);
      return exists
        ? prev.filter((x) => getAssignmentId(x) !== id)
        : [...prev, assignment];
    });
  };

  //console.log("eventAssignments: ", eventAssignments);
  const evt = event; // alias for convenience
  const eventId = evt?._id || evt?.id || null;

  const loadDrawerData = useCallback(async () => {
    if (!eventId) return;

    setLoading(true);
    setAssignmentsError("");
    try {
      // Load each section independently so one failing request does not hide the others.
      const [paymentsResult, attendanceResult, assignmentsResult, reviewsResult] =
        await Promise.allSettled([
          api.get(`/payments/event/${eventId}`),
          api.get(`/attendance?event=${eventId}`),
          api.get(`/assignments/event/${eventId}`),
          api.get(`/reviews/event/${eventId}`),
        ]);

      if (paymentsResult.status === "fulfilled") {
        setPayments(paymentsResult.value.data?.data || paymentsResult.value.data || []);
      } else {
        console.error("Failed to load event payments", paymentsResult.reason);
      }

      if (attendanceResult.status === "fulfilled") {
        setAttendanceRecords(attendanceResult.value.data?.data || []);
      } else {
        console.error("Failed to load attendance records", attendanceResult.reason);
      }

      if (assignmentsResult.status === "fulfilled") {
        setEventAssignments(assignmentsResult.value.data?.data || []);
      } else {
        const message =
          assignmentsResult.reason?.response?.data?.message ||
          "Assigned bartenders could not be loaded.";
        setEventAssignments([]);
        setAssignmentsError(message);
        console.error("Failed to load event assignments", assignmentsResult.reason);
      }

      if (reviewsResult.status === "fulfilled") {
        setReviews(reviewsResult.value.data?.data || []);
      } else {
        console.error("Failed to load event reviews", reviewsResult.reason);
      }
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    if (!open || !eventId) return;
    loadDrawerData();
  }, [open, eventId, loadDrawerData]);

  const now = new Date();
  const attendanceOpen = evt?.startAt
    ? new Date(evt.startAt).getTime() - 5 * 60 * 1000 <= now.getTime()
    : false;
  const readyForReview = evt?.endAt
    ? new Date(evt.endAt) <= now
    : evt?.status === "completed";
  const attendanceClosed =
    !!evt?.endAt && now.getTime() > new Date(evt.endAt).getTime() + 3 * 60 * 60 * 1000;
  const reviewClosed =
    !!evt?.endAt && now.getTime() > new Date(evt.endAt).getTime() + 7 * MS_DAY;
  const canEditAttendance = attendanceOpen && !attendanceClosed;
  const canEditReviews = readyForReview && !reviewClosed;

  useEffect(() => {
    if (!open || !initialTab || !eventId) return;
    const key = `${eventId}:${initialTab}`;
    if (appliedInitialTabRef.current === key) return;
    appliedInitialTabRef.current = key;
    if (initialTab === "review") {
      setDetailsTab(readyForReview ? "reviews" : "attendance");
      return;
    }
    setDetailsTab(initialTab);
  }, [eventId, open, initialTab, readyForReview]);

  useEffect(() => {
    if (!open) appliedInitialTabRef.current = "";
  }, [open]);

  const handleTabChange = (e, value) => {
    setDetailsTab(value);
    onTabChange?.(value);
  };

  const attendanceByAssignmentId = useMemo(() => {
    const map = {};
    attendanceRecords.forEach((record) => {
      const assignmentId = record.assignment?._id || record.assignment;
      if (assignmentId) map[String(assignmentId)] = record;
    });
    return map;
  }, [attendanceRecords]);

  const reviewByBartenderId = useMemo(() => {
    const map = {};
    reviews.forEach((review) => {
      const bartenderId = review.bartenderUser?._id || review.bartenderUser;
      if (bartenderId) map[String(bartenderId)] = review;
    });
    return map;
  }, [reviews]);

  const verifyAttendance = async (recordId, assignmentId) => {
    const payload = attendanceVerify[assignmentId] || { status: "present", notes: "" };
    try {
      const res = recordId
        ? await api.patch(`/attendance/${recordId}/verify`, payload)
        : await api.patch(`/attendance/assignments/${assignmentId}/verify`, payload);
      setAttendanceRecords((prev) =>
        recordId
          ? prev.map((record) => (record._id === recordId ? res.data.data : record))
          : [res.data.data, ...prev]
      );
      setReviewAlert({ severity: "success", message: "Attendance verified." });
    } catch (err) {
      setReviewAlert({
        severity: "error",
        message: err?.response?.data?.message || "Failed to verify attendance.",
      });
    }
  };

  const selectedAttendanceAssignments = checkedAssignments.filter((assignment) =>
    filteredAssignments.some((item) => getAssignmentId(item) === getAssignmentId(assignment))
  );

  const applyBulkAttendanceToSelected = () => {
    if (!selectedAttendanceAssignments.length) return;
    setAttendanceVerify((prev) => {
      const next = { ...prev };
      selectedAttendanceAssignments.forEach((assignment) => {
        const id = getAssignmentId(assignment);
        next[id] = {
          ...(next[id] || {}),
          ...bulkAttendance,
        };
      });
      return next;
    });
  };

  const verifySelectedAttendance = async () => {
    if (!selectedAttendanceAssignments.length) return;

    setVerifyingAttendance(true);
    try {
      const results = await Promise.allSettled(
        selectedAttendanceAssignments.map((assignment) => {
          const id = getAssignmentId(assignment);
          const attendance = attendanceByAssignmentId[id];
          const payload = attendanceVerify[id] || bulkAttendance;
          return attendance?._id
            ? api.patch(`/attendance/${attendance._id}/verify`, payload)
            : api.patch(`/attendance/assignments/${id}/verify`, payload);
        })
      );

      const updatedRecords = results
        .filter((result) => result.status === "fulfilled")
        .map((result) => result.value.data?.data)
        .filter(Boolean);

      if (updatedRecords.length) {
        setAttendanceRecords((prev) => {
          const map = new Map(prev.map((record) => [String(record._id), record]));
          updatedRecords.forEach((record) => map.set(String(record._id), record));
          return Array.from(map.values());
        });
      }

      const failedCount = results.filter((result) => result.status === "rejected").length;
      setReviewAlert({
        severity: failedCount ? "warning" : "success",
        message: failedCount
          ? `Verified ${updatedRecords.length}; ${failedCount} could not be updated.`
          : `Verified ${updatedRecords.length} bartender${updatedRecords.length === 1 ? "" : "s"}.`,
      });
    } finally {
      setVerifyingAttendance(false);
    }
  };

  const tz =
    getEventTimeZone(evt);
  const recordedPayments = payments.filter(isActivePayment);
  const paidTotal = payments.length
    ? recordedPayments.reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0)
    : getEventPaidTotal(evt);
  const displayPayments =
    payments.length || paidTotal <= 0
      ? payments
      : [
          {
            _id: `${eventId || "event"}-payment-summary`,
            amount: paidTotal,
            method: "payment summary",
            status: "recorded",
            receivedAt: evt?.payment?.paidAt || evt?.updatedAt || evt?.createdAt,
            notes: "Payment total from event summary. Refresh after backend restart to see individual records.",
          },
        ];
  const displayRecordedPayments = displayPayments.filter(isActivePayment);
  const displayAdjustedPayments = displayPayments.filter((payment) =>
    ["refunded", "voided"].includes(getPaymentStatus(payment))
  );
  const paymentTotal = getEventPaymentBaseTotal(evt);
  const balance = Math.max(0, paymentTotal - paidTotal);
  const overpayment = Math.max(0, paidTotal - paymentTotal);
  const paymentStatus = getCustomerPaymentStatus(paymentTotal, paidTotal);
  const paymentPolicy = getEventPaymentPolicyView(evt, {
    total: paymentTotal,
    paid: paidTotal,
  });

  useEffect(() => {
    if (detailsTab === "reviews" && !readyForReview) {
      setDetailsTab("attendance");
    }
  }, [detailsTab, readyForReview]);

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: { xs: "100%", sm: 560, md: 760 },
          maxWidth: "100vw",
        },
      }}
    >
      {/* HEADER */}
      <Box
        sx={{
          position: "sticky",
          top: 0,
          zIndex: 1,
          bgcolor: "background.paper",
          p: 2,
          borderBottom: 1,
          borderColor: "divider",
        }}
      >
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
        >
          <Typography variant="h6" fontWeight={800}>
            {evt
              ? `Event ${evt.shortCode || `#${evt._id?.slice(-6)}`}`
              : "Event"}
          </Typography>
          <IconButton onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Stack>
        <Typography variant="body2" color="text.secondary">
          If you wish to make changes please call <strong>(317)608-7361</strong>{" "}
          or email{" "}
          <a href="mailto:admin@tipsyverse.com">admin@tipsyverse.com</a>.
        </Typography>
      </Box>

      {/* BODY */}
      <Box sx={{ p: 2, pb: 4 }}>
        {loading && !evt && <Typography>Loading…</Typography>}
        {!loading && !evt && <Typography>Not found.</Typography>}
        {!loading && evt && (
          <>
            {/* Status strip (now includes cancel info) */}
            <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: "wrap" }}>
              <Chip
                label={formatLabel(evt.status) || "—"}
                color={STATUS_COLORS[evt.status]}
                size="small"
              />

              {evt.status === "canceled" && (
                <>
                  <Chip
                    size="small"
                    label={`Reason: ${evt.cancelReason || "—"}`}
                    color="default"
                    variant="outlined"
                  />
                  {evt.canceledAt && (
                    <Chip
                      size="small"
                      label={`Canceled at ${formatTimestamp(evt.canceledAt, {
                        timeZone: tz,
                      })}`}
                      variant="outlined"
                    />
                  )}
                </>
              )}
            </Stack>

            {/* 🔹 Tabs for sections */}
            <Tabs
              value={detailsTab}
              onChange={(e, value) => handleTabChange(e, value)}
              sx={{ mb: 2 }}
              variant="scrollable"
              allowScrollButtonsMobile
            >
              <Tab label="Event Details" value="details" />
              <Tab label="Payments" value="payments" />
              <Tab label="Attendance" value="attendance" />
              {readyForReview && <Tab label="Reviews" value="reviews" />}
            </Tabs>

            {/* 🔹 EVENT DETAILS TAB */}
            {detailsTab === "details" && (
              <>
                {/* Confirm Info (read-only) */}
                <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
                  <Typography variant="subtitle1" sx={{ mb: 1 }}>
                    Confirm Info
                  </Typography>

                  <Grid item xs={12} md={6}>
                    <LabelVal label="Type" value={evt.type || "—"} />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <LabelVal
                      label="When"
                      value={formatWhen(evt.startAt, evt.endAt, tz)}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <LabelVal
                      label="Location"
                      value={formatLocationPretty(evt.location)}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <LabelVal
                      label="Contact"
                      value={
                        [
                          evt.contact?.fullName,
                          evt.contact?.email,
                          evt.contact?.phone,
                        ]
                          .filter(Boolean)
                          .join(" • ") || "—"
                      }
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <LabelVal
                      label="Description"
                      value={evt.description || "—"}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <LabelVal
                      label="Additional Instructions"
                      value={evt.additionalInstructions || "—"}
                    />
                  </Grid>
                </Paper>

                {/* Questions (read-only) */}
                <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
                  <Typography variant="subtitle1" sx={{ mb: 1 }}>
                    Questions
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={4}>
                      <LabelVal
                        label="Estimated Guests"
                        value={evt.guestCount ?? "—"}
                      />
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <LabelVal
                        label="Recommended Bartenders"
                        value={getRecommendedBartenderCount(evt, 1)}
                      />
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <LabelVal
                        label="Approved Bartenders"
                        value={getApprovedBartenderCount(evt, 1)}
                      />
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <LabelVal
                        label="Bar Style"
                        value={formatStatus(evt.options?.barType || "unknown")}
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <LabelVal
                        label="Tip Jars Allowed"
                        value={
                          evt.options?.tipJarsAllowed !== false ? "Yes" : "No"
                        }
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <LabelVal
                        label="Items to Pickup"
                        value={
                          (evt.options?.procurementItems || [])
                            .map(
                              (it) => `${it.qty || 1} × ${it.name || "Item"}`
                            )
                            .join(", ") || "None"
                        }
                      />
                    </Grid>
                    {/* <Grid item xs={12}>
                  <LabelVal
                    label="Notes for Bartenders"
                    value={evt.bartenderNotes || "—"}
                  />
                </Grid> */}
                  </Grid>
                </Paper>
              </>
            )}

            {/* 🔹 PAYMENTS TAB */}
            {detailsTab === "payments" && (
              <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
                <Stack spacing={2}>
                  <Box>
                    <Typography variant="subtitle1">Payments</Typography>
                    <Typography variant="body2" color="text.secondary">
                      View your balance and every recorded payment, refund, or void in one place.
                    </Typography>
                  </Box>

                  <Grid container spacing={1.5}>
                    <Grid item xs={12} sm={4}>
                      <Paper variant="outlined" sx={{ p: 1.5, height: "100%" }}>
                        <Typography variant="caption" color="text.secondary">
                          Total
                        </Typography>
                        <Typography variant="h6" fontWeight={800}>
                          {fmtMoney(paymentTotal)}
                        </Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <Paper variant="outlined" sx={{ p: 1.5, height: "100%" }}>
                        <Typography variant="caption" color="text.secondary">
                          Paid
                        </Typography>
                        <Typography variant="h6" fontWeight={800}>
                          {fmtMoney(paidTotal)}
                        </Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <Paper variant="outlined" sx={{ p: 1.5, height: "100%" }}>
                        <Typography variant="caption" color="text.secondary">
                          Balance
                        </Typography>
                        <Typography
                          variant="h6"
                          fontWeight={800}
                          color={
                            paymentStatus.key === "pricing_pending"
                              ? "text.secondary"
                              : balance > 0
                              ? "error.main"
                              : "success.main"
                          }
                        >
                          {fmtMoney(balance)}
                        </Typography>
                      </Paper>
                    </Grid>
                  </Grid>

                  <Grid container spacing={1.5}>
                    <Grid item xs={12} sm={6}>
                      <LabelVal
                        label="Recorded Payments"
                        value={`${displayRecordedPayments.length} transaction${displayRecordedPayments.length === 1 ? "" : "s"}`}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <LabelVal
                        label="Refunds / Voids"
                        value={`${displayAdjustedPayments.length} adjustment${displayAdjustedPayments.length === 1 ? "" : "s"}`}
                      />
                    </Grid>
                  </Grid>

                  <Alert severity={paymentStatus.severity}>
                    {paymentStatus.key === "pricing_pending"
                      ? "Pricing has not been confirmed yet. No payment is currently due."
                      : balance > 0
                      ? `Current balance due: ${fmtMoney(balance)}. Contact Tipsyverse to make or discuss a payment.`
                      : overpayment > 0
                      ? `This event is paid in full. Recorded payments exceed the event total by ${fmtMoney(overpayment)}.`
                      : "This event is paid in full based on recorded payments."}
                  </Alert>

                  {paymentPolicy.dueAt && paymentStatus.key !== "pricing_pending" && (
                    <Alert severity={paymentPolicy.severity}>
                      <strong>{paymentPolicy.label}.</strong>{" "}
                      The remaining balance is due by {formatPaymentDueDate(paymentPolicy.dueAt, tz)}.
                      {paymentPolicy.status === "payment_hold" || paymentPolicy.status === "action_required"
                        ? " Bartenders remain assigned, but final instructions, optional purchases, and event changes are paused."
                        : ""}
                    </Alert>
                  )}

                  <Divider />

                  <Typography variant="subtitle2">Payment History</Typography>
                  {displayPayments.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                      No payments recorded yet.
                    </Typography>
                  ) : (
                    <Stack spacing={1}>
                      {displayPayments.map((pmt) => (
                        <PaymentRow key={pmt._id} pmt={pmt} timeZone={tz} />
                      ))}
                    </Stack>
                  )}
                </Stack>
              </Paper>
            )}

            {/* Assigned Bartenders + Attendance */}
            {detailsTab === "attendance" && (
              <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={2}
                  justifyContent="space-between"
                  alignItems={{ xs: "flex-start", sm: "center" }}
                  sx={{ mb: 1.5 }}
                >
                  <Box>
                    <Typography variant="subtitle1">Attendance</Typography>
                    <Typography variant="caption" color="text.secondary" display="block">
                      Confirm which bartenders were present and when they arrived or left.
                    </Typography>
                    <Typography variant="caption" color="text.secondary" display="block">
                      Attendance opens 5 minutes before the event starts and closes 24 hours after it ends.
                    </Typography>
                    {attendanceClosed && (
                      <Typography variant="caption" color="text.secondary" display="block">
                        Attendance verification is closed. Contact Tipsyverse if anything needs to be corrected.
                      </Typography>
                    )}
                  </Box>
                </Stack>

                <TextField
                  size="small"
                  placeholder="Search by name or email…"
                  value={searchAssignedBartenders}
                  onChange={(e) => setSearchAssignedBartenders(e.target.value)}
                  sx={{ minWidth: 220, mb: 1 }}
                />

                {assignmentsError && (
                  <Alert severity="warning" sx={{ mb: 1 }}>
                    Could not load assigned bartenders: {assignmentsError}
                  </Alert>
                )}

                {/* Header row with "select all" */}
                {canEditAttendance && (
                  <Stack direction="row" alignItems="center" sx={{ mb: 1 }}>
                    <Checkbox
                      size="small"
                      checked={allAssignedChecked}
                      indeterminate={someAssignedChecked}
                      onChange={toggleHeaderAssignedCheckbox}
                    />
                    <Typography variant="caption" color="text.secondary">
                      {checkedAssignments.length}/{filteredAssignments.length}{" "}
                      selected for attendance
                    </Typography>
                  </Stack>
                )}

                {canEditAttendance && selectedAttendanceAssignments.length > 0 && (
                  <Paper
                    variant="outlined"
                    sx={{
                      p: 1.5,
                      mb: 1.5,
                      borderColor: "var(--primary-color)",
                      bgcolor: "rgba(151, 0, 45, 0.04)",
                    }}
                  >
                   <Stack spacing={2}>
  <Typography variant="subtitle2">
    Verify all that apply ({selectedAttendanceAssignments.length})
  </Typography>

  <Grid container spacing={2}>
    {/* Status */}
    <Grid item xs={12} md={3}>
      <FormControl fullWidth size="small">
        <InputLabel>Status</InputLabel>
        <Select
          label="Status"
          value={bulkAttendance.status}
          onChange={(e) =>
            setBulkAttendance((prev) => ({
              ...prev,
              status: e.target.value,
            }))
          }
        >
          <MenuItem value="present">Present</MenuItem>
          <MenuItem value="absent">Absent</MenuItem>
          <MenuItem value="late">Late</MenuItem>
          <MenuItem value="left_early">Left Early</MenuItem>
          <MenuItem value="disputed">Disputed</MenuItem>
        </Select>
      </FormControl>
    </Grid>

    {/* Clock In / Clock Out */}
    <Grid item xs={12} md={4.5}>
      <TextField
        fullWidth
        size="small"
        label="Clock In"
        type="datetime-local"
        value={bulkAttendance.clockInAt}
        InputLabelProps={{ shrink: true }}
        onChange={(e) =>
          setBulkAttendance((prev) => ({
            ...prev,
            clockInAt: e.target.value,
          }))
        }
      />
    </Grid>

    <Grid item xs={12} md={4.5}>
      <TextField
        fullWidth
        size="small"
        label="Clock Out"
        type="datetime-local"
        value={bulkAttendance.clockOutAt}
        InputLabelProps={{ shrink: true }}
        onChange={(e) =>
          setBulkAttendance((prev) => ({
            ...prev,
            clockOutAt: e.target.value,
          }))
        }
      />
    </Grid>

    {/* Notes */}
    <Grid item xs={12}>
      <TextField
        fullWidth
        size="small"
        label="Notes"
        multiline
        minRows={3}
        value={bulkAttendance.notes}
        onChange={(e) =>
          setBulkAttendance((prev) => ({
            ...prev,
            notes: e.target.value,
          }))
        }
      />
    </Grid>
  </Grid>

  {/* Action Buttons */}
  <Stack
    direction={{ xs: "column", sm: "row" }}
    spacing={1.5}
    justifyContent="flex-end"
  >
    <Button
      variant="outlined"
      sx={{
        color: "var(--primary-color)",
        borderColor: "var(--primary-color)",
      }}
      onClick={applyBulkAttendanceToSelected}
    >
      Apply to Selected
    </Button>

    <Button
      variant="contained"
      sx={{ backgroundColor: "var(--primary-color)" }}
      disabled={verifyingAttendance}
      onClick={verifySelectedAttendance}
    >
      Verify Selected
    </Button>
  </Stack>
</Stack>
                  </Paper>
                )}

                {/* Scrollable list */}
                <Box sx={{ maxHeight: 520, overflowY: "auto", pr: 0.5 }}>
                  {!assignmentsError && eventAssignments.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                      No bartenders have been assigned yet, so there is no attendance to verify.
                    </Typography>
                  ) : assignmentsError ? (
                    <Typography variant="body2" color="text.secondary">
                      Once the assignments request succeeds, the assigned bartenders will appear here.
                    </Typography>
                  ) : filteredAssignments.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                      No assigned bartenders match your search.
                    </Typography>
                  ) : (
                    <Stack spacing={1}>
                      {filteredAssignments.map((assignment) => {
                        const u = assignment.bartenderUser || {};
                        const id = getAssignmentId(assignment);
                        const name =
                          u.fullName ||
                          u.name ||
                          u.displayName ||
                          "Unnamed bartender";
                        const email = u.email || "";
                        const avatarSrc =
                          u.profile?.photo ||
                          u.profile?.avatar ||
                          u.avatarUrl ||
                          u.photoUrl ||
                          "";

                        const rateRaw =
                          assignment.hourlyRate ??
                          evt.pricing?.hourlyRate ??
                          null;
                        const hourlyRate = Number(rateRaw);
                        const rate =
                          Number.isFinite(hourlyRate)
                            ? `$${hourlyRate.toFixed(2)}/hr`
                            : null;

                        const checked = checkedAssignments.some(
                          (x) => getAssignmentId(x) === id
                        );
                        const attendance = attendanceByAssignmentId[id];
                        const verification = attendance?.contactVerification;
                        const verifyDraft = attendanceVerify[id] || {
                          status: verification?.status || "present",
                          notes: verification?.notes || "",
                          clockInAt: toDateTimeLocalValue(attendance?.clockInAt),
                          clockOutAt: toDateTimeLocalValue(attendance?.clockOutAt),
                        };

                        return (
                          <Paper
                            key={id}
                            variant="outlined"
                            sx={{
                              p: 1,
                              borderRadius: 1.5,
                              borderColor: checked
                                ? "var(--primary-color)"
                                : "divider",
                              boxShadow: checked ? 1 : 0,
                              "&:hover": {
                                borderColor: "var(--primary-color)",
                                boxShadow: 1,
                                cursor: canEditAttendance ? "pointer" : "default",
                              },
                            }}
                            onClick={canEditAttendance ? toggleAssignedRow(assignment) : undefined}
                          >
                            <Stack
                              direction="row"
                              spacing={1.5}
                              alignItems="center"
                            >
                              {canEditAttendance && (
                                <Checkbox
                                  size="small"
                                  checked={checked}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleAssignedRow(assignment)();
                                  }}
                                />
                              )}
                              <Avatar
                                src={avatarSrc}
                                sx={{ width: 40, height: 40, flexShrink: 0 }}
                              >
                                {name?.[0]?.toUpperCase?.() || "?"}
                              </Avatar>
                              <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                                <Typography variant="subtitle2" noWrap>
                                  {name}
                                </Typography>
                                {email && (
                                  <Typography
                                    variant="caption"
                                    color="text.secondary"
                                    noWrap
                                    display="block"
                                  >
                                    {email}
                                  </Typography>
                                )}
                                {rate && (
                                  <Typography
                                    variant="caption"
                                    color="text.secondary"
                                    noWrap
                                    display="block"
                                  >
                                    {rate}
                                  </Typography>
                                )}
                                {canEditAttendance && (
                                  <Stack spacing={1} sx={{ mt: 1 }}>
                                    {attendance ? (
                                      <Chip
                                        size="small"
                                        sx={{ alignSelf: "flex-start" }}
                                        color={
                                          attendance.status === "disputed"
                                            ? "warning"
                                            : attendance.status === "verified"
                                            ? "success"
                                            : "info"
                                        }
                                        label={`Attendance: ${formatStatus(attendance.status)}${
                                          attendance.clockInAt
                                            ? ` • In ${formatShortTime(attendance.clockInAt)}`
                                            : ""
                                        }${
                                          attendance.clockOutAt
                                            ? ` • Out ${formatShortTime(attendance.clockOutAt)}`
                                            : " • Out not recorded"
                                        }`}
                                      />
                                    ) : (
                                      <Chip
                                        size="small"
                                        sx={{ alignSelf: "flex-start" }}
                                        color="warning"
                                        variant="outlined"
                                        label="No clock-in record yet"
                                      />
                                    )}
                                    <Stack
                                      spacing={1}
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <Stack direction="row" alignItems="center" spacing={0.5}>
                                        <Checkbox
                                          checked={verifyDraft.status === "present"}
                                          onChange={(e) =>
                                            setAttendanceVerify((p) => ({
                                              ...p,
                                              [id]: {
                                                ...verifyDraft,
                                                status: e.target.checked ? "present" : "absent",
                                              },
                                            }))
                                          }
                                        />
                                        <Typography variant="body2">
                                          Yes, they are here
                                        </Typography>
                                      </Stack>
                                      <FormControl size="small" fullWidth>
                                        <InputLabel>Status</InputLabel>
                                        <Select
                                          label="Status"
                                          value={verifyDraft.status}
                                          onChange={(e) =>
                                            setAttendanceVerify((p) => ({
                                              ...p,
                                              [id]: { ...verifyDraft, status: e.target.value },
                                            }))
                                          }
                                        >
                                          <MenuItem value="present">Present</MenuItem>
                                          <MenuItem value="absent">Absent</MenuItem>
                                          <MenuItem value="late">Late</MenuItem>
                                          <MenuItem value="left_early">Left early</MenuItem>
                                          <MenuItem value="disputed">Disputed</MenuItem>
                                        </Select>
                                      </FormControl>
                                      <TextField
                                        fullWidth
                                        size="small"
                                        label="Notes"
                                        value={verifyDraft.notes}
                                        onChange={(e) =>
                                          setAttendanceVerify((p) => ({
                                            ...p,
                                            [id]: { ...verifyDraft, notes: e.target.value },
                                          }))
                                        }
                                      />
                                      <TextField
                                        fullWidth
                                        size="small"
                                        label="Clock In"
                                        type="datetime-local"
                                        value={verifyDraft.clockInAt || ""}
                                        InputLabelProps={{ shrink: true }}
                                        onChange={(e) =>
                                          setAttendanceVerify((p) => ({
                                            ...p,
                                            [id]: { ...verifyDraft, clockInAt: e.target.value },
                                          }))
                                        }
                                      />
                                      <TextField
                                        fullWidth
                                        size="small"
                                        label="Clock Out"
                                        type="datetime-local"
                                        value={verifyDraft.clockOutAt || ""}
                                        InputLabelProps={{ shrink: true }}
                                        onChange={(e) =>
                                          setAttendanceVerify((p) => ({
                                            ...p,
                                            [id]: { ...verifyDraft, clockOutAt: e.target.value },
                                          }))
                                        }
                                      />
                                      <Button
                                        variant="contained"
                                        sx={{ backgroundColor: "var(--primary-color)" }}
                                        onClick={() => verifyAttendance(attendance?._id, id)}
                                      >
                                        Verify Attendance
                                      </Button>
                                    </Stack>
                                  </Stack>
                                )}
                                {!canEditAttendance && (
                                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
                                    {attendanceClosed
                                      ? "Attendance verification is closed."
                                      : "Attendance verification opens 5 minutes before this event starts."}
                                  </Typography>
                                )}
                              </Box>
                            </Stack>
                          </Paper>
                        );
                      })}
                    </Stack>
                  )}
                </Box>
              </Paper>
            )}

            {detailsTab === "reviews" && readyForReview && (
              <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={2}
                  justifyContent="space-between"
                  alignItems={{ xs: "flex-start", sm: "center" }}
                  sx={{ mb: 1.5 }}
                >
                  <Box>
                    <Typography variant="subtitle1">Reviews</Typography>
                    <Typography variant="caption" color="text.secondary" display="block">
                      Reviews open after the event ends and close 7 days later.
                    </Typography>
                    {canEditReviews ? (
                      <Typography variant="caption" color="text.secondary" display="block">
                        Select one or more bartenders to leave a rating and comment.
                      </Typography>
                    ) : (
                      <Typography variant="caption" color="text.secondary" display="block">
                        The review window is closed. You can still view submitted reviews below.
                      </Typography>
                    )}
                  </Box>
                  {canEditReviews && (
                    <Button
                      variant="contained"
                      size="small"
                      sx={{ backgroundColor: "var(--primary-color)" }}
                      disabled={!checkedAssignments.length}
                      onClick={() => setReviewDialogOpen(true)}
                    >
                      Review Selected ({checkedAssignments.length})
                    </Button>
                  )}
                </Stack>

                <TextField
                  size="small"
                  placeholder="Search by name or email…"
                  value={searchAssignedBartenders}
                  onChange={(e) => setSearchAssignedBartenders(e.target.value)}
                  sx={{ minWidth: 220, mb: 1 }}
                />

                {assignmentsError && (
                  <Alert severity="warning" sx={{ mb: 1 }}>
                    Could not load assigned bartenders: {assignmentsError}
                  </Alert>
                )}

                {canEditReviews && (
                  <Stack direction="row" alignItems="center" sx={{ mb: 1 }}>
                    <Checkbox
                      size="small"
                      checked={allAssignedChecked}
                      indeterminate={someAssignedChecked}
                      onChange={toggleHeaderAssignedCheckbox}
                    />
                    <Typography variant="caption" color="text.secondary">
                      {checkedAssignments.length}/{filteredAssignments.length} selected for review
                    </Typography>
                  </Stack>
                )}

                <Box sx={{ maxHeight: 520, overflowY: "auto", pr: 0.5 }}>
                  {!assignmentsError && eventAssignments.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                      No bartenders have been assigned yet, so there is nobody to review.
                    </Typography>
                  ) : assignmentsError ? (
                    <Typography variant="body2" color="text.secondary">
                      Once the assignments request succeeds, assigned bartenders will appear here.
                    </Typography>
                  ) : filteredAssignments.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                      No assigned bartenders match your search.
                    </Typography>
                  ) : (
                    <Stack spacing={1}>
                      {filteredAssignments.map((assignment) => {
                        const u = assignment.bartenderUser || {};
                        const id = getAssignmentId(assignment);
                        const bartenderId = String(
                          assignment.bartenderUser?._id || assignment.bartenderUser || ""
                        );
                        const review = reviewByBartenderId[bartenderId];
                        const reviewRate = Number(review?.rating ?? assignment.reviewRate);
                        const hasReviewRate = Number.isFinite(reviewRate);
                        const name =
                          u.fullName ||
                          u.name ||
                          u.displayName ||
                          "Unnamed bartender";
                        const email = u.email || "";
                        const avatarSrc =
                          u.profile?.photo ||
                          u.profile?.avatar ||
                          u.avatarUrl ||
                          u.photoUrl ||
                          "";
                        const rateRaw =
                          assignment.hourlyRate ??
                          evt.pricing?.hourlyRate ??
                          null;
                        const hourlyRate = Number(rateRaw);
                        const rate = Number.isFinite(hourlyRate)
                          ? `$${hourlyRate.toFixed(2)}/hr`
                          : null;
                        const checked = checkedAssignments.some(
                          (x) => getAssignmentId(x) === id
                        );

                        return (
                          <Paper
                            key={id}
                            variant="outlined"
                            sx={{
                              p: 1.25,
                              borderRadius: 1.5,
                              borderColor: checked
                                ? "var(--primary-color)"
                                : "divider",
                              boxShadow: checked ? 1 : 0,
                              "&:hover": {
                                borderColor: "var(--primary-color)",
                                boxShadow: 1,
                                cursor: canEditReviews ? "pointer" : "default",
                              },
                            }}
                            onClick={canEditReviews ? toggleAssignedRow(assignment) : undefined}
                          >
                            <Stack direction="row" spacing={1.5} alignItems="center">
                              {canEditReviews && (
                                <Checkbox
                                  size="small"
                                  checked={checked}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleAssignedRow(assignment)();
                                  }}
                                />
                              )}
                              <Avatar
                                src={avatarSrc}
                                sx={{ width: 40, height: 40, flexShrink: 0 }}
                              >
                                {name?.[0]?.toUpperCase?.() || "?"}
                              </Avatar>
                              <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                                <Typography variant="subtitle2" noWrap>
                                  {name}
                                </Typography>
                                {email && (
                                  <Typography
                                    variant="caption"
                                    color="text.secondary"
                                    noWrap
                                    display="block"
                                  >
                                    {email}
                                  </Typography>
                                )}
                                {rate && (
                                  <Typography
                                    variant="caption"
                                    color="text.secondary"
                                    noWrap
                                    display="block"
                                  >
                                    {rate}
                                  </Typography>
                                )}
                                <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mt: 0.5 }}>
                                  {hasReviewRate ? (
                                    <>
                                      <Rating
                                        value={reviewRate}
                                        precision={0.5}
                                        size="small"
                                        readOnly
                                      />
                                      <Typography variant="caption" color="text.secondary">
                                        {reviewRate.toFixed(1)}
                                      </Typography>
                                    </>
                                  ) : (
                                    <Typography variant="caption" color="text.secondary">
                                      No rating yet
                                    </Typography>
                                  )}
                                </Stack>
                                {review?.comment && (
                                  <Typography
                                    variant="body2"
                                    color="text.secondary"
                                    sx={{ mt: 0.75, whiteSpace: "pre-wrap" }}
                                  >
                                    {review.comment}
                                  </Typography>
                                )}
                              </Box>
                            </Stack>
                          </Paper>
                        );
                      })}
                    </Stack>
                  )}
                </Box>
              </Paper>
            )}

            <Divider sx={{ my: 3 }} />
            <Typography variant="caption" color="text.secondary">
              Close this panel to return to your events.
            </Typography>
          </>
        )}
      </Box>
      <Dialog
        open={reviewDialogOpen}
        onClose={() => setReviewDialogOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          Review {checkedAssignments.length} bartender
          {checkedAssignments.length === 1 ? "" : "s"}
        </DialogTitle>
        <DialogContent dividers>
          {reviewAlert && (
            <Alert
              severity={reviewAlert.severity}
              sx={{ mb: 2 }}
              onClose={() => setReviewAlert(null)}
            >
              {reviewAlert.message}
            </Alert>
          )}

          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Your rating and comment will be applied to all selected bartenders
            for this event. A comment is required.
          </Typography>

          {/* Selected bartenders list */}
          <Box sx={{ maxHeight: 200, overflowY: "auto", mb: 2 }}>
            <Stack spacing={1}>
              {checkedAssignments.map((a) => {
                const u = a.bartenderUser || {};
                const name =
                  u.fullName || u.name || u.displayName || "Unnamed bartender";
                const email = u.email || "";
                const avatarSrc =
                  u.profile?.photo ||
                  u.profile?.avatar ||
                  u.avatarUrl ||
                  u.photoUrl ||
                  "";

                return (
                  <Paper
                    key={getAssignmentId(a)}
                    variant="outlined"
                    sx={{ p: 1 }}
                  >
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Avatar src={avatarSrc} sx={{ width: 32, height: 32 }}>
                        {name?.[0]?.toUpperCase?.() || "?"}
                      </Avatar>
                      <Box>
                        <Typography variant="body2" fontWeight={600}>
                          {name}
                        </Typography>
                        {email && (
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            display="block"
                          >
                            {email}
                          </Typography>
                        )}
                      </Box>
                    </Stack>
                  </Paper>
                );
              })}
            </Stack>
          </Box>

          {/* Rating + comment */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Rating
            </Typography>
            <Rating
              name="bartender-rating"
              value={reviewRating}
              onChange={(e, newValue) => setReviewRating(newValue || 0)}
            />
          </Box>

          <TextField
            label="Comment"
            value={reviewComment}
            onChange={(e) =>
              setReviewComment(e.target.value.slice(0, REVIEW_COMMENT_LIMIT))
            }
            fullWidth
            multiline
            minRows={3}
            required
            inputProps={{ maxLength: REVIEW_COMMENT_LIMIT }}
            helperText={`${reviewComment.length}/${REVIEW_COMMENT_LIMIT} characters`}
          />
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setReviewDialogOpen(false);
              setReviewAlert(null);
            }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            sx={{ backgroundColor: "var(--primary-color)" }}
            disabled={
              submittingReview ||
              !canEditReviews ||
              !checkedAssignments.length ||
              !reviewRating ||
              !reviewComment.trim() ||
              reviewComment.trim().length > REVIEW_COMMENT_LIMIT
            }
            onClick={async () => {
              try {
                setSubmittingReview(true);
                setReviewAlert(null);

                const payload = {
                  event: evt._id,
                  bartenderUserIds: checkedAssignments.map(
                    (a) => a.bartenderUser?._id || a.bartenderUser
                  ),
                  rating: reviewRating,
                  comment: reviewComment.trim(),
                };

                // 🔧 adjust endpoint to whatever you implement on backend
                await api.post("/reviews/bartenders/bulk", payload);

                setReviewAlert({
                  severity: "success",
                  message: "Thank you! Your reviews have been submitted.",
                });

                // Optionally clear selection / reset form
                setCheckedAssignments([]);
                setReviewRating(0);
                setReviewComment("");
                setReviewDialogOpen(false);
                await loadDrawerData();
              } catch (e) {
                console.error(e);
                setReviewAlert({
                  severity: "error",
                  message:
                    e?.response?.data?.message ||
                    "Failed to submit reviews. Please try again.",
                });
              } finally {
                setSubmittingReview(false);
              }
            }}
          >
            {submittingReview ? "Submitting..." : "Submit Reviews"}
          </Button>
        </DialogActions>
      </Dialog>
    </Drawer>
  );
}
