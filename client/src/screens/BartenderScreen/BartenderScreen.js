import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Skeleton,
  Stack,
  Step,
  StepLabel,
  Stepper,
  Tab,
  Tabs,
  Typography,
  Paper,
  Drawer,
  TextField,
  FormControlLabel,
  Pagination,
  Switch,
  Dialog,
  DialogTitle,
  DialogContent,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  DialogActions,
  Tooltip,
} from "@mui/material";
import { Link, useLocation } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import {
  CalendarMonth,
  CheckCircle,
  RadioButtonUnchecked,
  Schedule,
  MonetizationOn,
  Badge,
  Tune,
  Login,
  WarningAmber,
  AccountBalanceWallet,
  NotificationsActive,
  ReportProblem,
  HelpOutline,
  EmojiEvents,
  Refresh,
} from "@mui/icons-material";

import { DataGrid } from "@mui/x-data-grid";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip as ReTooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import PublicLayout from "../../components/PublicLayout/PublicLayout";
import HelmetHeader from "../../components/HelmetHeader/Helmet";
import VisibilityIcon from "@mui/icons-material/Visibility";
import MyLocationIcon from "@mui/icons-material/MyLocation";
import LicenseDetailForm from "../../components/LicenseDetailForm/LicenseDetailForm";
import { fetchMe, fetchMyBartenderInfo } from "../../features/users/userSlice";
import CircularProgressRing from "../../components/CircularProgressRing/CircularProgressRing";
import { fetchAvailableEvents } from "../../features/events/eventSlice";
import { updateBartenderLiveLocation } from "../../utils/updateLiveLocation";
import { CollapseAlert } from "../../components/CollapseAlert/CollapseAlert";
import HowToGuide from "../../components/HowToGuide/HowToGuide";
import PhoneTextField from "../../components/PhoneTextField/PhoneTextField";
import LocationInput from "../../components/LocationInput/LocationInput";
import {
  computeDistanceMiles,
  getDistanceDisplayLabel,
} from "../../utils/formatDistanceLabel";
import api from "../../services/api";
import { fetchMyBids } from "../../features/bids/bidSlice";
import { fetchMyAssignments } from "../../features/assignments/assignmentSlice";
import { formatStatus } from "../../utils/formatStatus";
import { fetchMyReviews } from "../../features/reviews/reviewSlice";

/* ---------- Small helpers ---------- */
const fmtMoney = (n) => `$${(Number(n) || 0).toFixed(2)}`;
const MS_DAY = 24 * 60 * 60 * 1000;
const PAYOUT_HELPER_TEXT = {
  cashApp: "Format: https://cash.app/$yourcashtag",
  zelle: "Format: email or phone number connected to Zelle",
  paypal: "Format: https://paypal.me/yourname or PayPal email",
  venmo: "Format: https://venmo.com/u/yourusername or @yourusername",
};
const PRIMARY_TABS_SX = {
  "& .MuiTab-root.Mui-selected": {
    color: "var(--primary-color)",
  },
  "& .MuiTabs-indicator": {
    backgroundColor: "var(--primary-color)",
  },
};
const EVENT_ACTION_WINDOW_MS = 5 * 60 * 1000;
const REWARD_SIZES = ["XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL"];
const POLO_COLORS = ["Black", "Burgundy", "White", "Navy", "Gray"];
const PERSONALIZATION_PATTERN = /^[A-Za-z0-9 .'-]{1,24}$/;
const PREVIEW_ALL_REWARD_CLAIMS = false;

const getRewardQuestions = (rewardName = "") => {
  const name = String(rewardName || "").toLowerCase();
  if (name.includes("polo")) {
    return [
      {
        key: "shirtSize",
        label: "Size",
        type: "select",
        options: REWARD_SIZES,
      },
      {
        key: "poloColor",
        label: "Polo color",
        type: "select",
        options: POLO_COLORS,
      },
    ];
  }
  if (
    name.includes("t-shirt") ||
    name.includes("hoodie") ||
    name.includes("jacket")
  ) {
    return [
      {
        key: "shirtSize",
        label: "Size",
        type: "select",
        options: REWARD_SIZES,
      },
    ];
  }
  if (
    name.includes("mixing glass") ||
    name.includes("personalized") ||
    name.includes("engraved")
  ) {
    return [
      {
        key: "personalizationText",
        label: "Personalization text",
        type: "text",
        helperText:
          "Use 1-24 letters, numbers, spaces, periods, apostrophes, or hyphens.",
      },
    ];
  }
  if (name.includes("apron")) {
    return [
      {
        key: "personalizationText",
        label: "Embroidery name",
        type: "text",
        helperText:
          "Use 1-24 letters, numbers, spaces, periods, apostrophes, or hyphens.",
      },
    ];
  }
  return [];
};

const PROVIDER_LABELS = {
  cashApp: "Cash App",
  zelle: "Zelle",
  paypal: "PayPal",
  venmo: "Venmo",
  manual: "Manual",
};
const EMERGENCY_RELATIONSHIP_OPTIONS = [
  "Parent",
  "Spouse",
  "Partner",
  "Sibling",
  "Child",
  "Family",
  "Friend",
  "Roommate",
  "Coworker",
  "Other",
];

const toPhoneInputValue = (value = "") => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (raw.startsWith("+")) return raw;

  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return raw;
};

const hasValidPhoneNumber = (value = "") => {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.length >= 10;
};

const ONBOARDING_DOCUMENTS = [
  {
    key: "w9",
    title: "W-9",
    summary: "Confirm tax identity and taxpayer information.",
  },
  {
    key: "independent_contractor",
    title: "Independent Contractor Agreement",
    summary: "Review working terms, event expectations, and contractor status.",
  },
  {
    key: "service_standards",
    title: "Service Standards Acknowledgement",
    summary:
      "Confirm attendance, conduct, safety, and incident-reporting expectations.",
  },
];
const DOCUMENT_TASK_TYPES = ["documents", "sign_documents", "signed_documents"];
const PROFILE_TASK_TYPES = [
  "profile",
  "approval",
  "bartender_profile",
  "profile_approved",
];

const getId = (value) => value?._id || value?.id || value;
const sameId = (a, b) => {
  const left = getId(a);
  const right = getId(b);
  return !!left && !!right && String(left) === String(right);
};

const getRangeBounds = (range, customStart, customEnd) => {
  const now = new Date();
  let start = null;
  let end = new Date(now);

  if (range === "week") {
    start = new Date(now);
    start.setDate(now.getDate() - now.getDay());
  } else if (range === "month") {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
  } else if (range === "year") {
    start = new Date(now.getFullYear(), 0, 1);
  } else if (range === "custom") {
    start = customStart ? new Date(`${customStart}T00:00:00`) : null;
    end = customEnd ? new Date(`${customEnd}T23:59:59`) : null;
  }

  if (start) start.setHours(0, 0, 0, 0);
  return { start, end };
};

const isDateInRange = (value, bounds) => {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  if (bounds.start && date < bounds.start) return false;
  if (bounds.end && date > bounds.end) return false;
  return true;
};

const getEventHours = (event) => {
  const start = event?.startAt ? new Date(event.startAt) : null;
  const end = event?.endAt ? new Date(event.endAt) : null;
  if (!start || !end || end <= start) return 0;
  return (end.getTime() - start.getTime()) / (60 * 60 * 1000);
};

const getExpectedAssignmentPay = (assignment) => {
  const event = assignment?.event || {};
  const hourly = Number(event?.pricing?.hourlyRate) || 0;
  const eventHours = getEventHours(event);
  const setup = Number(event?.pricing?.setupHours) || 0;
  const breakdown = Number(event?.pricing?.breakdownHours) || 0;
  const hourlyPay = hourly * (eventHours + setup + breakdown);
  const bartenderCount =
    Number(event?.counts?.neededBartenders) ||
    Number(event?.pricing?.bartendersRequested) ||
    1;
  const subtotal =
    Number(event?.payment?.subtotal) ||
    hourlyPay * bartenderCount + (Number(event?.pricing?.bookingFee) || 0);
  const gratuity =
    Number(event?.payment?.gratuity) ||
    subtotal * (Number(event?.pricing?.gratuityPct) || 0);
  return hourlyPay + gratuity / Math.max(1, bartenderCount);
};

const isEventActionWindowOpen = (startAt) => {
  if (!startAt) return false;
  const start = new Date(startAt);
  if (Number.isNaN(start.getTime())) return false;
  return start.getTime() - Date.now() <= EVENT_ACTION_WINDOW_MS;
};

/* ---------- Skeleton while loading ---------- */
function BartenderSkeleton() {
  return (
    <Box sx={{ p: 3 }}>
      <Stack
        spacing={2}
        alignItems="center"
        justifyContent="center"
        sx={{ mb: 3 }}
      >
        <Skeleton variant="circular" width={64} height={64} />
        <Skeleton variant="text" width={200} sx={{ fontSize: 28 }} />
        <Skeleton variant="text" width={260} />
      </Stack>

      <Skeleton variant="rectangular" height={48} sx={{ mb: 2 }} />
      <Skeleton variant="rectangular" height={220} sx={{ mb: 2 }} />
      <Skeleton variant="rectangular" height={220} />
    </Box>
  );
}
/* ---------- Home Tab ---------- */
function BartenderHomeTab({
  pins,
  reviewSummary,
  myReviews = [],
  availableEvents,
  myAssignments = [],
  liveCoords = null,
  shareLiveEnabled = false,
  myBids = [], // 🔹 NEW
}) {
  const { eligible, checklist = [] } = pins || {};
  const [documentsOpen, setDocumentsOpen] = useState(false);
  const loggedInUserWrapper = useSelector((state) => state.users.loggedInUser);
  const loggedInUser = loggedInUserWrapper?.user;
  const bartenderInfo = loggedInUserWrapper?.bartenderInfo;
  const documentStatusByKey = useMemo(() => {
    const bartenderDocuments =
      bartenderInfo?.onboardingDocuments ||
      loggedInUser?.bartenderProfile?.documents ||
      loggedInUser?.bartenderProfile?.onboardingDocuments ||
      [];
    const map = {};
    (Array.isArray(bartenderDocuments) ? bartenderDocuments : []).forEach(
      (doc) => {
        if (doc?.key || doc?.documentKey) map[doc.key || doc.documentKey] = doc;
      }
    );
    return map;
  }, [bartenderInfo?.onboardingDocuments, loggedInUser]);
  const allRequiredDocumentsReceived = useMemo(
    () =>
      ONBOARDING_DOCUMENTS.every(
        (doc) => documentStatusByKey[doc.key]?.status === "received"
      ),
    [documentStatusByKey]
  );

  const fullChecklist = useMemo(() => {
    const hasDocumentsTask = checklist.some((task) =>
      DOCUMENT_TASK_TYPES.includes(task.key || task.type)
    );
    const withDocuments = hasDocumentsTask
      ? checklist.map((task) =>
          DOCUMENT_TASK_TYPES.includes(task.key || task.type)
            ? {
                ...task,
                key: task.key || "sign_documents",
                label: "Sign all documents",
                type: "documents",
                done: task.done || allRequiredDocumentsReceived,
              }
            : task
        )
      : [
          ...checklist,
          {
            key: "sign_documents",
            label: "Sign all documents",
            type: "documents",
            done: allRequiredDocumentsReceived,
          },
        ];

    return [...withDocuments].sort((a, b) => {
      const aIsProfile = PROFILE_TASK_TYPES.includes(a.key || a.type);
      const bIsProfile = PROFILE_TASK_TYPES.includes(b.key || b.type);
      if (aIsProfile === bIsProfile) return 0;
      return aIsProfile ? 1 : -1;
    });
  }, [allRequiredDocumentsReceived, checklist]);

  const CHECKLIST_LENGTH = fullChecklist.length;
  const AMOUNT_TASKS_DONE = fullChecklist.filter(
    (task) => task.done === true
  ).length;
  const overallPercent =
    CHECKLIST_LENGTH === 0 ? 0 : (AMOUNT_TASKS_DONE / CHECKLIST_LENGTH) * 100;

  // 🔹 NEW: filters + pagination
  const EVENTS_PER_PAGE = 10;
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const [sortByDistance, setSortByDistance] = useState(false);
  const [readyRange, setReadyRange] = useState("upcoming");
  const [readyCustomStart, setReadyCustomStart] = useState("");
  const [readyCustomEnd, setReadyCustomEnd] = useState("");
  const [productivityRange, setProductivityRange] = useState("month");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const productivity = useMemo(() => {
    const bounds = getRangeBounds(productivityRange, customStart, customEnd);
    const activeAssignments = (myAssignments || []).filter(
      (assignment) => assignment.status !== "removed"
    );
    const completedEvents = activeAssignments.filter((assignment) => {
      const event = assignment.event || {};
      const endAt = event.endAt || event.startAt;
      return (
        (event.status === "completed" ||
          (endAt && new Date(endAt) < new Date())) &&
        isDateInRange(endAt, bounds)
      );
    });
    const upcomingEvents = activeAssignments.filter((assignment) => {
      const event = assignment.event || {};
      const endAt = event.endAt || event.startAt;
      return endAt && new Date(endAt) >= new Date();
    });

    return {
      completed: completedEvents.length,
      upcoming: upcomingEvents.length,
      reviews: Number(reviewSummary?.total) || 0,
      estimatedEarnings: completedEvents.reduce(
        (sum, assignment) => sum + getExpectedAssignmentPay(assignment),
        0
      ),
    };
  }, [
    customEnd,
    customStart,
    myAssignments,
    productivityRange,
    reviewSummary?.total,
  ]);

  const upcomingAssignments = useMemo(() => {
    const now = new Date();
    return (myAssignments || [])
      .filter((assignment) => assignment.status !== "removed")
      .filter((assignment) => {
        const event = assignment.event || {};
        const endAt = event.endAt || event.startAt;
        return endAt && new Date(endAt) >= now;
      })
      .sort(
        (a, b) =>
          new Date(a.event?.startAt || 0) - new Date(b.event?.startAt || 0)
      )
      .slice(0, 3);
  }, [myAssignments]);

  const filteredEvents = React.useMemo(() => {
    // clone so we don't mutate Redux state
    let list = Array.isArray(availableEvents) ? [...availableEvents] : [];
    const now = new Date();

    if (readyRange === "upcoming") {
      list = list.filter((evt) => {
        const endAt = evt.endAt || evt.startAt;
        return endAt && new Date(endAt) >= now;
      });
    } else {
      const bounds = getRangeBounds(
        readyRange,
        readyCustomStart,
        readyCustomEnd
      );
      list = list.filter((evt) => isDateInRange(evt.startAt, bounds));
    }

    // search by type, city, state
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((evt) => {
        const type = evt.type || "";
        const city = evt.location?.city || "";
        const state = evt.location?.state || "";
        return (
          type.toLowerCase().includes(q) ||
          city.toLowerCase().includes(q) ||
          state.toLowerCase().includes(q)
        );
      });
    }

    // sort by distance if enabled + we have liveCoords
    if (sortByDistance && liveCoords) {
      // clone again before sorting, just to be extra safe about immutability
      list = [...list].sort((a, b) => {
        const da = computeDistanceMiles(liveCoords, a.location?.point);
        const db = computeDistanceMiles(liveCoords, b.location?.point);

        if (da == null && db == null) return 0;
        if (da == null) return 1;
        if (db == null) return -1;

        return da - db; // nearest first
      });
    }

    return list;
  }, [
    availableEvents,
    search,
    sortByDistance,
    liveCoords,
    readyRange,
    readyCustomStart,
    readyCustomEnd,
  ]);

  const dispatch = useDispatch(); // we’ll use this for refetch after toggle
  const [interestAlert, setInterestAlert] = useState(null);

  const bidByEventId = useMemo(() => {
    const map = {};
    (myBids || []).forEach((bid) => {
      const eventId = bid.event?._id || bid.event; // depending on how you populate
      if (!eventId) return;
      map[eventId] = bid;
    });
    return map;
  }, [myBids]);

  const handleToggleInterest = async (eventId) => {
    setInterestAlert(null);
    try {
      await api.post("/bids/toggle-interest", { eventId });

      // 🔹 Refetch my bids so UI reflects new status
      dispatch(fetchMyBids());
    } catch (err) {
      setInterestAlert({
        severity: "error",
        message:
          err?.response?.data?.message ||
          err.message ||
          "We could not update your interest for this event. Please try again.",
      });
    }
  };

  // reset to page 1 when filters / list change
  useEffect(() => {
    setPage(1);
  }, [
    search,
    availableEvents?.length,
    readyRange,
    readyCustomStart,
    readyCustomEnd,
  ]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredEvents.length / EVENTS_PER_PAGE)
  );

  const pagedEvents = React.useMemo(() => {
    const start = (page - 1) * EVENTS_PER_PAGE;
    return filteredEvents.slice(start, start + EVENTS_PER_PAGE);
  }, [filteredEvents, page]);

  const reviewsOverview = useMemo(() => {
    const reviews = Array.isArray(myReviews) ? myReviews : [];
    const ratedReviews = reviews.filter((review) => review?.rating != null);
    const total = ratedReviews.length;
    const average =
      total === 0
        ? 0
        : ratedReviews.reduce(
            (sum, review) => sum + (Number(review.rating) || 0),
            0
          ) / total;
    const latest = reviews
      .slice()
      .sort(
        (a, b) =>
          new Date(b?.event?.startAt || b?.createdAt || 0) -
          new Date(a?.event?.startAt || a?.createdAt || 0)
      )[0];
    return { average, total, latest };
  }, [myReviews]);

  return (
    <Stack spacing={3} sx={{ mt: 2 }}>
      {interestAlert && (
        <CollapseAlert
          open={!!interestAlert}
          severity={interestAlert.severity}
          message={interestAlert.message}
          onClose={() => setInterestAlert(null)}
        />
      )}

      <Paper variant="outlined" sx={{ p: 2, order: 4 }}>
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={2}
          justifyContent="space-between"
          alignItems={{ xs: "stretch", md: "center" }}
          sx={{ mb: 2 }}
        >
          <Box>
            <Typography variant="h6">Earnings</Typography>
            <Typography variant="body2" color="text.secondary">
              Track your worked events, upcoming jobs, reviews, and estimated
              pay.
            </Typography>
          </Box>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel id="productivity-range-label">Range</InputLabel>
              <Select
                labelId="productivity-range-label"
                label="Range"
                value={productivityRange}
                onChange={(e) => setProductivityRange(e.target.value)}
              >
                <MenuItem value="week">This week</MenuItem>
                <MenuItem value="month">This month</MenuItem>
                <MenuItem value="year">This year</MenuItem>
                <MenuItem value="custom">Custom</MenuItem>
              </Select>
            </FormControl>
            {productivityRange === "custom" && (
              <>
                <TextField
                  size="small"
                  type="date"
                  label="From"
                  InputLabelProps={{ shrink: true }}
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                />
                <TextField
                  size="small"
                  type="date"
                  label="To"
                  InputLabelProps={{ shrink: true }}
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                />
              </>
            )}
          </Stack>
        </Stack>

        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          {[
            ["Events worked", productivity.completed],
            ["Upcoming events", productivity.upcoming],
            ["Reviews", productivity.reviews],
            ["Est. earned", fmtMoney(productivity.estimatedEarnings)],
          ].map(([label, value]) => (
            <Paper
              key={label}
              variant="outlined"
              sx={{ p: 2, flex: 1, minWidth: 0, bgcolor: "grey.50" }}
            >
              <Typography variant="caption" color="text.secondary">
                {label}
              </Typography>
              <Typography variant="h5" fontWeight={800}>
                {value}
              </Typography>
            </Paper>
          ))}
        </Stack>
      </Paper>

      {/* Onboarding Card */}
      {!eligible && (
        <Paper variant="outlined" sx={{ p: 2, order: 1 }}>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={2}
            justifyContent="space-between"
          >
            <Box sx={{ flex: 1 }}>
              <Typography variant="h6" sx={{ mb: 0.5 }}>
                Bartender Checklist
              </Typography>
              {!eligible && (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mb: 1 }}
                >
                  You’re almost ready to start working events. Complete the
                  checklist below to unlock full eligibility.
                </Typography>
              )}
              {eligible && (
                <Alert severity="success" sx={{ mb: 1 }}>
                  You’re eligible to be assigned to events. Great job!
                </Alert>
              )}
            </Box>

            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                minWidth: 140,
              }}
            >
              <CircularProgressRing value={overallPercent} />
            </Box>
          </Stack>

          <Divider sx={{ my: 2 }} />

          {/* Checklist only when NOT eligible */}
          {!eligible && (
            <>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Checklist
              </Typography>
              <List dense>
                {fullChecklist.map((item) => (
                  <ListItem
                    key={item.key}
                    secondaryAction={
                      PROFILE_TASK_TYPES.includes(
                        item.key || item.type
                      ) ? null : item.type === "documents" ? (
                        <Button
                          size="small"
                          onClick={() => setDocumentsOpen(true)}
                          sx={{
                            textTransform: "none",
                            backgroundColor: "var(--primary-color)",
                            color: "white",
                          }}
                        >
                          Instructions
                        </Button>
                      ) : (
                        <Button
                          component={Link}
                          to={item.link}
                          size="small"
                          sx={{
                            textTransform: "none",
                            backgroundColor: "var(--primary-color)",
                            color: "white",
                          }}
                        >
                          Go
                        </Button>
                      )
                    }
                  >
                    <ListItemIcon>
                      {item.done ? (
                        <CheckCircle color="success" />
                      ) : (
                        <RadioButtonUnchecked color="disabled" />
                      )}
                    </ListItemIcon>
                    <ListItemText
                      primary={item.label}
                      secondary={
                        item.type === "course"
                          ? "Required Tipsyverse course"
                          : item.type === "license"
                          ? "Required valid bartending license"
                          : item.type === "payout"
                          ? "Your payout link for bartender payments"
                          : item.type === "contact"
                          ? "Your phone number and emergency contact"
                          : item.type === "profile"
                          ? "Your public bartender profile"
                          : item.type === "documents"
                          ? item.done
                            ? "Admin received all required documents"
                            : "W-9, Independent Contractor Agreement, and acknowledgements"
                          : null
                      }
                    />
                  </ListItem>
                ))}
              </List>
            </>
          )}
        </Paper>
      )}
      <Dialog
        open={documentsOpen}
        onClose={() => setDocumentsOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: { maxHeight: { xs: "calc(100% - 24px)", sm: "92vh" } },
        }}
      >
        <DialogTitle>Required Documents</DialogTitle>
        <DialogContent dividers sx={{ px: { xs: 2, sm: 3 }, py: 2.5 }}>
          <Stack spacing={2}>
            <Alert severity="info">
              Documents will be emailed to you. Return signed copies to admin.
            </Alert>
            <Stack spacing={1.25}>
              {ONBOARDING_DOCUMENTS.map((doc, index) => {
                const status =
                  documentStatusByKey[doc.key]?.status || "not_sent";
                const receivedAt = documentStatusByKey[doc.key]?.receivedAt;
                return (
                  <Paper key={doc.key} variant="outlined" sx={{ p: 1.5 }}>
                    <Stack
                      direction="row"
                      spacing={1.5}
                      alignItems="flex-start"
                    >
                      <Chip label={index + 1} size="small" />
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Stack
                          direction={{ xs: "column", sm: "row" }}
                          spacing={1}
                          justifyContent="space-between"
                          alignItems={{ xs: "flex-start", sm: "center" }}
                        >
                          <Typography variant="subtitle2" fontWeight={800}>
                            {doc.title}
                          </Typography>
                          <Chip
                            size="small"
                            color={
                              status === "received"
                                ? "success"
                                : status === "sent"
                                ? "info"
                                : status === "rejected"
                                ? "error"
                                : "default"
                            }
                            label={formatStatus(status)}
                          />
                        </Stack>
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{ mt: 0.5 }}
                        >
                          {doc.summary}
                        </Typography>
                        {receivedAt && (
                          <Typography variant="caption" color="text.secondary">
                            Received {new Date(receivedAt).toLocaleDateString()}
                          </Typography>
                        )}
                      </Box>
                    </Stack>
                  </Paper>
                );
              })}
            </Stack>
            <Typography variant="body2" color="text.secondary">
              Your checklist is completed when admin marks every required
              document as received.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions
          sx={{
            px: { xs: 2, sm: 3 },
            py: 2,
            flexDirection: { xs: "column-reverse", sm: "row" },
            alignItems: { xs: "stretch", sm: "center" },
            gap: 1,
            "& > :not(style) ~ :not(style)": { ml: { xs: 0, sm: 1 } },
          }}
        >
          <Button onClick={() => setDocumentsOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Paper variant="outlined" sx={{ p: 2, order: 3 }}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", sm: "center" }}
          spacing={1}
          sx={{ mb: 1.5 }}
        >
          <Box>
            <Typography variant="subtitle1" fontWeight={700}>
              Upcoming / Assigned Events
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Your next active assignments.
            </Typography>
          </Box>
          <Button
            component={Link}
            to="/bartend/schedule"
            size="small"
            variant="outlined"
            sx={{
              color: "var(--primary-color)",
              borderColor: "var(--primary-color)",
            }}
          >
            View Schedule
          </Button>
        </Stack>
        {upcomingAssignments.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            You do not have upcoming assigned events yet.
          </Typography>
        ) : (
          <Stack spacing={1}>
            {upcomingAssignments.map((assignment) => {
              const event = assignment.event || {};
              const loc = event.location || {};
              return (
                <Paper
                  key={assignment._id}
                  variant="outlined"
                  sx={{ p: 1.5, bgcolor: "grey.50" }}
                >
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    justifyContent="space-between"
                    spacing={1}
                  >
                    <Box>
                      <Typography fontWeight={700}>
                        {event.shortCode || event.type || "Event"}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {event.startAt
                          ? new Date(event.startAt).toLocaleString([], {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "Date pending"}
                        {[loc.city, loc.state].filter(Boolean).length
                          ? ` • ${[loc.city, loc.state]
                              .filter(Boolean)
                              .join(", ")}`
                          : ""}
                      </Typography>
                    </Box>
                    <Chip
                      size="small"
                      label={formatStatus(assignment.status || "active")}
                      color="success"
                    />
                  </Stack>
                </Paper>
              );
            })}
          </Stack>
        )}
      </Paper>

      <Paper variant="outlined" sx={{ p: 2, order: 5 }}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", sm: "center" }}
          spacing={1}
        >
          <Box>
            <Typography variant="subtitle1" fontWeight={700}>
              Rewards
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Claim unlocked milestone gifts and review pending reward requests.
            </Typography>
          </Box>
          <Button
            component={Link}
            to="/bartend/rewards"
            size="small"
            variant="outlined"
            sx={{
              color: "var(--primary-color)",
              borderColor: "var(--primary-color)",
            }}
          >
            View Rewards
          </Button>
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2, order: 6 }}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", sm: "center" }}
          spacing={1}
        >
          <Box>
            <Typography variant="subtitle1" fontWeight={700}>
              Reviews Summary
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Your latest rating snapshot and customer feedback.
            </Typography>
          </Box>
          <Button
            component={Link}
            to="/bartend/reviews"
            size="small"
            variant="outlined"
            sx={{
              color: "var(--primary-color)",
              borderColor: "var(--primary-color)",
            }}
          >
            View Reviews
          </Button>
        </Stack>

        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={2}
          sx={{ mt: 1.5 }}
        >
          {[
            [
              "Average Rating",
              reviewsOverview.total
                ? `${reviewsOverview.average.toFixed(1)}/5`
                : "0.0/5",
            ],
            ["Total Reviews", reviewsOverview.total],
          ].map(([label, value]) => (
            <Paper
              key={label}
              variant="outlined"
              sx={{ p: 1.5, flex: 1, bgcolor: "grey.50" }}
            >
              <Typography variant="caption" color="text.secondary">
                {label}
              </Typography>
              <Typography variant="h5" fontWeight={800}>
                {value}
              </Typography>
            </Paper>
          ))}
        </Stack>

        {reviewsOverview.latest?.comment ? (
          <Paper
            variant="outlined"
            sx={{ p: 1.5, mt: 1.5, bgcolor: "grey.50" }}
          >
            <Typography variant="caption" color="text.secondary">
              Latest review
            </Typography>
            <Typography variant="body2" sx={{ mt: 0.5 }}>
              {reviewsOverview.latest.comment}
            </Typography>
          </Paper>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
            No written reviews yet.
          </Typography>
        )}
      </Paper>

      {/* Ready-to-assign events */}
      <Paper variant="outlined" sx={{ p: 2, order: 2 }}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", sm: "center" }}
          spacing={1}
        >
          <Typography variant="subtitle1">Events Ready To Assign</Typography>
          <Typography variant="caption" color="text.secondary">
            These are events that are actively looking for bartenders.
          </Typography>
        </Stack>

        <Divider sx={{ my: 1.5 }} />

        {/* 🔹 NEW: Filters bar */}

        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1.5}
          alignItems={{ xs: "stretch", sm: "center" }}
          sx={{ mb: 2 }}
        >
          <FormControl size="small" sx={{ minWidth: { xs: "100%", sm: 180 } }}>
            <InputLabel>Event Date Range</InputLabel>
            <Select
              label="Event Date Range"
              value={readyRange}
              onChange={(e) => setReadyRange(e.target.value)}
            >
              <MenuItem value="upcoming">All Upcoming</MenuItem>
              <MenuItem value="week">This Week</MenuItem>
              <MenuItem value="month">This Month</MenuItem>
              <MenuItem value="year">This Year</MenuItem>
              <MenuItem value="custom">Custom</MenuItem>
            </Select>
          </FormControl>
          {readyRange === "custom" && (
            <>
              <TextField
                size="small"
                label="From"
                type="date"
                value={readyCustomStart}
                InputLabelProps={{ shrink: true }}
                onChange={(e) => setReadyCustomStart(e.target.value)}
              />
              <TextField
                size="small"
                label="To"
                type="date"
                value={readyCustomEnd}
                InputLabelProps={{ shrink: true }}
                onChange={(e) => setReadyCustomEnd(e.target.value)}
              />
            </>
          )}
          <TextField
            size="small"
            label="Search by event, city, or state"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ minWidth: { xs: "100%", sm: 260 } }}
          />
          {shareLiveEnabled && liveCoords && (
            <Chip
              icon={
                <MyLocationIcon
                  fontSize="small"
                  sx={{
                    color: sortByDistance
                      ? "white !important"
                      : "var(--primary-color) !important",
                  }}
                />
              }
              label={
                sortByDistance ? "Showing jobs near you" : "Find jobs near me"
              }
              variant={sortByDistance ? "filled" : "outlined"}
              onClick={() => setSortByDistance((prev) => !prev)}
              sx={{
                textTransform: "none",
                ...(sortByDistance
                  ? {
                      backgroundColor: "var(--primary-color)",
                      color: "#fff",
                    }
                  : {
                      color: "var(--primary-color)",
                      backgroundColor: "#fff",
                      borderColor: "var(--primary-color)",
                    }),
              }}
            />
          )}
        </Stack>

        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ ml: { sm: "auto" } }}
        >
          Showing {filteredEvents.length} event
          {filteredEvents.length === 1 ? "" : "s"}
        </Typography>

        {!filteredEvents || filteredEvents.length === 0 ? (
          search !== "" || readyRange !== "upcoming" ? (
            <Typography variant="body2" color="text.secondary">
              No ready-to-assign events match these filters. Try a wider date
              range or clear the search.
            </Typography>
          ) : (
            <Typography variant="body2" color="text.secondary">
              There are currently no available events for you. Check back soon!
            </Typography>
          )
        ) : (
          <>
            <Stack spacing={1}>
              {pagedEvents.map((evt) => {
                const bid = bidByEventId[evt._id];
                const status = bid?.status || null;

                // what you consider "interested" visually:
                const interested = status === "interested";

                const needed = Number(evt?.counts?.neededBartenders || 0);
                const assigned = Number(evt?.counts?.assigned || 0);
                const remaining = Math.max(0, needed - assigned);

                // 🔹 NEW: compute distance if we have liveCoords + event coords
                const distanceLabel = getDistanceDisplayLabel({
                  sharingEnabled: shareLiveEnabled,
                  from: liveCoords,
                  eventLocationPoint: evt.location?.point,
                });
                const distanceUnavailable =
                  distanceLabel && !distanceLabel.includes(" away");

                //const bidStatus = evt.myBidStatus || "none";
                //console.log("bidStatus: ", bidStatus);

                return (
                  <Paper key={evt._id} variant="outlined" sx={{ p: 1.5 }}>
                    <Stack
                      direction={{ xs: "column", sm: "row" }}
                      justifyContent="space-between"
                      spacing={1}
                    >
                      {/* Event's Information */}
                      <Box>
                        <Typography variant="body2" fontWeight={600}>
                          {evt.type ? evt.type.toUpperCase() : "Event"} •{" "}
                          {evt.location?.city}, {evt.location?.state}
                        </Typography>

                        <Typography
                          variant="caption"
                          color="text.secondary"
                          display="block"
                        >
                          {evt.startAt
                            ? new Date(evt.startAt).toLocaleString()
                            : "TBD"}
                        </Typography>

                        {distanceLabel && (
                          <Typography
                            variant="caption"
                            color={
                              distanceUnavailable
                                ? "warning.main"
                                : "text.secondary"
                            }
                            display="block"
                          >
                            {distanceLabel}
                          </Typography>
                        )}

                        <Typography variant="caption" display="block">
                          {evt.guestCount
                            ? `${
                                evt.guestCount
                              } guests • ${remaining} bartender${
                                remaining === 1 ? "" : "s"
                              } needed`
                            : "Guest count TBD"}
                        </Typography>
                        <Stack direction="row" spacing={1.5}>
                          {evt.pricing?.hourlyRate && (
                            <Chip
                              size="small"
                              label={`${fmtMoney(evt.pricing.hourlyRate)}/hr`}
                              color="default"
                              sx={{ mt: 0.5 }}
                            />
                          )}
                          {evt.options.barType && (
                            <Chip
                              size="small"
                              label={`${formatStatus(evt.options.barType)}`}
                              color="default"
                              sx={{ mt: 0.5 }}
                            />
                          )}
                          {evt.options.tipJarsAllowed && (
                            <Chip
                              size="small"
                              label={`Tipjars allowed: ${
                                evt.options.tipJarsAllowed ? "Yes" : "No"
                              }`}
                              color={
                                evt.options.tipJarsAllowed ? "success" : "error"
                              }
                              sx={{ mt: 0.5 }}
                            />
                          )}
                        </Stack>
                      </Box>

                      {/* Event's Button and Status */}
                      <Stack
                        direction="row"
                        spacing={1}
                        alignItems="center"
                        justifyContent={{
                          xs: "flex-start",
                          sm: "flex-end",
                        }}
                      >
                        {/* ⚠️ CONFLICT WARNING */}
                        {evt.conflictsSchedule && (
                          <Tooltip title="This event conflicts with one or more of your active assignments.">
                            <WarningAmber
                              fontSize="small"
                              sx={{ color: "warning.main", cursor: "pointer" }}
                            />
                          </Tooltip>
                        )}
                        <Button
                          size="small"
                          variant={interested ? "outlined" : "contained"}
                          sx={{
                            backgroundColor: interested
                              ? "default"
                              : "var(--primary-color)",
                            color: interested ? "default" : "#fff",
                          }}
                          onClick={() => handleToggleInterest(evt._id)}
                        >
                          {interested ? "Uninterested" : "Interested"}
                        </Button>
                      </Stack>
                    </Stack>
                  </Paper>
                );
              })}
            </Stack>

            {/* 🔹 Pagination */}
            {filteredEvents.length > EVENTS_PER_PAGE && (
              <Stack alignItems="center" sx={{ mt: 2 }}>
                <Pagination
                  count={totalPages}
                  page={page}
                  onChange={(_, val) => setPage(val)}
                  size="small"
                  shape="rounded"
                  sx={{
                    "& .MuiPaginationItem-root": {
                      color: "var(--primary-color)",
                    },
                    "& .MuiPaginationItem-root.Mui-selected": {
                      bgcolor: "var(--primary-color)",
                      color: "#fff",
                    },
                    "& .MuiPaginationItem-root.Mui-selected:hover": {
                      bgcolor: "var(--primary-color)",
                    },
                  }}
                />
              </Stack>
            )}
          </>
        )}
      </Paper>
    </Stack>
  );
}

/* ---------- Rewards Tab ---------- */
function ReviewsTab({ myReviews = [] }) {
  const [reviewRange, setReviewRange] = useState("month");
  const [reviewCustomStart, setReviewCustomStart] = useState("");
  const [reviewCustomEnd, setReviewCustomEnd] = useState("");
  const COLORS = ["#7B0323", "#f4a261", "#2a9d8f", "#264653", "#e76f51"];

  const reviewBounds = useMemo(
    () => getRangeBounds(reviewRange, reviewCustomStart, reviewCustomEnd),
    [reviewCustomEnd, reviewCustomStart, reviewRange]
  );

  const filteredReviews = useMemo(
    () =>
      (myReviews || []).filter((review) =>
        isDateInRange(
          review?.event?.startAt || review?.createdAt || review?.updatedAt,
          reviewBounds
        )
      ),
    [myReviews, reviewBounds]
  );

  const filteredReviewSummary = useMemo(() => {
    const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    filteredReviews.forEach((review) => {
      const value = Number(review?.rating);
      if (value >= 1 && value <= 5) counts[Math.round(value)] += 1;
    });
    const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
    const breakdown = [5, 4, 3, 2, 1].map((stars) => ({
      stars,
      count: counts[stars],
      pct: total ? Math.round((counts[stars] / total) * 100) : 0,
      label: `${stars} stars`,
      value: counts[stars],
    }));
    return {
      total,
      breakdown,
      pie: breakdown.map(({ label, value }) => ({ label, value })),
    };
  }, [filteredReviews]);

  const filteredReviewHistory = useMemo(
    () =>
      filteredReviews
        .filter((review) => review?.rating != null)
        .sort(
          (a, b) =>
            new Date(a?.event?.startAt || a?.createdAt || 0) -
            new Date(b?.event?.startAt || b?.createdAt || 0)
        )
        .map((review) => ({
          label: new Date(
            review?.event?.startAt || review?.createdAt
          ).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          }),
          rating: Number(review.rating),
        })),
    [filteredReviews]
  );

  return (
    <Stack spacing={2} sx={{ mt: 2 }}>
      <Box>
        <Typography variant="h6">My Reviews</Typography>
        <Typography variant="body2" color="text.secondary">
          Review your rating trends and event feedback.
        </Typography>
      </Box>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1.5}
          alignItems={{ xs: "stretch", sm: "center" }}
        >
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>Review Range</InputLabel>
            <Select
              label="Review Range"
              value={reviewRange}
              onChange={(e) => setReviewRange(e.target.value)}
            >
              <MenuItem value="week">This Week</MenuItem>
              <MenuItem value="month">This Month</MenuItem>
              <MenuItem value="year">This Year</MenuItem>
              <MenuItem value="custom">Custom</MenuItem>
            </Select>
          </FormControl>
          {reviewRange === "custom" && (
            <>
              <TextField
                size="small"
                label="From"
                type="date"
                value={reviewCustomStart}
                InputLabelProps={{ shrink: true }}
                onChange={(e) => setReviewCustomStart(e.target.value)}
              />
              <TextField
                size="small"
                label="To"
                type="date"
                value={reviewCustomEnd}
                InputLabelProps={{ shrink: true }}
                onChange={(e) => setReviewCustomEnd(e.target.value)}
              />
            </>
          )}
        </Stack>
      </Paper>

      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={2}
        alignItems="stretch"
      >
        <Paper
          variant="outlined"
          sx={{ p: 2, flex: 1, minHeight: 260, overflow: "hidden" }}
        >
          <Typography variant="subtitle1" sx={{ mb: 1 }}>
            Review Breakdown
          </Typography>

          {!filteredReviewSummary?.total ||
          filteredReviewSummary.total === 0 ? (
            <Typography variant="body2" color="text.secondary">
              You do not have any reviews for this range yet.
            </Typography>
          ) : (
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={2}
              alignItems="center"
            >
              <Box sx={{ flex: 1, minWidth: 220 }}>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={filteredReviewSummary.pie}
                      dataKey="value"
                      nameKey="label"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label
                    >
                      {filteredReviewSummary.pie.map((entry, index) => (
                        <Cell
                          key={entry.label}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Legend />
                    <ReTooltip />
                  </PieChart>
                </ResponsiveContainer>
              </Box>
              <Box
                sx={{
                  width: { xs: "100%", sm: 220 },
                  p: 1.5,
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 2,
                  backgroundColor: (theme) => theme.palette.grey[50],
                }}
              >
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: "block", mb: 1 }}
                >
                  Total reviews: {filteredReviewSummary.total}
                </Typography>
                <Stack spacing={0.75}>
                  {filteredReviewSummary.breakdown.map((row) => (
                    <Stack
                      key={row.stars}
                      direction="row"
                      justifyContent="space-between"
                      alignItems="center"
                    >
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {row.stars} stars
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {row.count} ({row.pct}%)
                      </Typography>
                    </Stack>
                  ))}
                </Stack>
              </Box>
            </Stack>
          )}
        </Paper>

        <Paper
          variant="outlined"
          sx={{ p: 2, flex: 1, minHeight: 260, overflow: "hidden" }}
        >
          <Typography variant="subtitle1" sx={{ mb: 1 }}>
            Rating Over Time
          </Typography>
          {!filteredReviewHistory || filteredReviewHistory.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No review history found for this range.
            </Typography>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={filteredReviewHistory}>
                <XAxis dataKey="label" />
                <YAxis domain={[0, 5]} />
                <ReTooltip />
                <Line
                  type="monotone"
                  dataKey="rating"
                  stroke="#7B0323"
                  strokeWidth={2}
                  dot
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Paper>
      </Stack>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", sm: "center" }}
          spacing={1}
          sx={{ mb: 1.5 }}
        >
          <Box>
            <Typography variant="subtitle1" fontWeight={700}>
              Review History
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Feedback from events in the selected review range.
            </Typography>
          </Box>
          <Chip
            size="small"
            label={`${filteredReviews.length} review${
              filteredReviews.length === 1 ? "" : "s"
            }`}
          />
        </Stack>

        {filteredReviews.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No reviews found for this range.
          </Typography>
        ) : (
          <Stack spacing={1.25}>
            {filteredReviews
              .slice()
              .sort(
                (a, b) =>
                  new Date(b?.event?.startAt || b?.createdAt || 0) -
                  new Date(a?.event?.startAt || a?.createdAt || 0)
              )
              .map((review) => {
                const event = review?.event || {};
                const reviewer =
                  review?.createdBy?.fullName ||
                  review?.reviewer?.fullName ||
                  event?.contact?.fullName ||
                  "Event contact";

                return (
                  <Paper
                    key={review._id || `${event._id}-${review.createdAt}`}
                    variant="outlined"
                    sx={{ p: 1.5, bgcolor: "grey.50" }}
                  >
                    <Stack
                      direction={{ xs: "column", sm: "row" }}
                      spacing={1}
                      justifyContent="space-between"
                    >
                      <Box>
                        <Typography fontWeight={700}>
                          {event.shortCode || event.type || "Event"}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {event.startAt
                            ? new Date(event.startAt).toLocaleDateString()
                            : "Date not available"}{" "}
                          • {reviewer}
                        </Typography>
                      </Box>
                      <Chip
                        size="small"
                        color="warning"
                        label={`${Number(review.rating || 0).toFixed(1)}/5`}
                      />
                    </Stack>
                    {review.comment && (
                      <Typography sx={{ mt: 1 }}>{review.comment}</Typography>
                    )}
                  </Paper>
                );
              })}
          </Stack>
        )}
      </Paper>
    </Stack>
  );
}

function RewardsTab() {
  const [rewardData, setRewardData] = useState(null);
  const [rewardAlert, setRewardAlert] = useState(null);
  const [claimReward, setClaimReward] = useState(null);
  const [claimStep, setClaimStep] = useState(0);
  const [claimSaving, setClaimSaving] = useState(false);
  const [claimAddressTouched, setClaimAddressTouched] = useState({});
  const [claimForm, setClaimForm] = useState({
    fullName: "",
    address1: "",
    address2: "",
    county: "",
    city: "",
    state: "",
    zipcode: "",
    country: "US",
    instructions: "",
    shirtSize: "",
    poloColor: "",
    personalizationText: "",
    notes: "",
  });
  const claimQuestions = useMemo(
    () => getRewardQuestions(claimReward?.reward),
    [claimReward?.reward]
  );
  const claimStepLabels = useMemo(
    () =>
      claimQuestions.length
        ? ["Delivery", "Reward Details", "Review"]
        : ["Delivery", "Review"],
    [claimQuestions.length]
  );
  const isClaimReviewStep = claimStep === claimStepLabels.length - 1;
  const isClaimDetailsStep = claimQuestions.length > 0 && claimStep === 1;
  const claimAddressComplete =
    claimForm.fullName.trim() &&
    claimForm.address1.trim() &&
    claimForm.city.trim() &&
    claimForm.state.trim() &&
    claimForm.zipcode.trim();
  const personalizationInvalid =
    claimForm.personalizationText.trim() &&
    !PERSONALIZATION_PATTERN.test(claimForm.personalizationText.trim());
  const claimQuestionsComplete = claimQuestions.every((question) => {
    const value = String(claimForm[question.key] || "").trim();
    if (!value) return false;
    if (question.key === "personalizationText") {
      return PERSONALIZATION_PATTERN.test(value);
    }
    return true;
  });
  const claimFormReady =
    !!claimAddressComplete && claimQuestionsComplete && !personalizationInvalid;

  const loadRewards = useCallback(async () => {
    try {
      const res = await api.get("/rewards/me");
      setRewardData(res.data?.data || null);
    } catch (err) {
      setRewardAlert({
        severity: "error",
        message: err?.response?.data?.message || "Failed to load rewards.",
      });
    }
  }, []);

  useEffect(() => {
    loadRewards();
  }, [loadRewards]);

  const handleOpenClaim = (reward) => {
    setClaimReward(reward);
    setClaimStep(0);
    setClaimAddressTouched({});
    setRewardAlert(null);
    setClaimForm((prev) => ({
      ...prev,
      notes: "",
      poloColor: "",
      personalizationText: "",
      shirtSize:
        reward.reward?.toLowerCase().includes("shirt") ||
        reward.reward?.toLowerCase().includes("hoodie") ||
        reward.reward?.toLowerCase().includes("jacket") ||
        reward.reward?.toLowerCase().includes("polo")
          ? prev.shirtSize
          : "",
    }));
  };

  const handleSubmitClaim = async () => {
    if (!claimReward) return;
    setClaimSaving(true);
    setRewardAlert(null);
    try {
      await api.post(`/rewards/milestones/${claimReward.milestone}/claim`, {
        shirtSize: claimForm.shirtSize,
        poloColor: claimForm.poloColor,
        personalizationText: claimForm.personalizationText,
        answers: claimQuestions.map((question) => ({
          key: question.key,
          label: question.label,
          value: claimForm[question.key],
        })),
        notes: claimForm.notes,
        shippingAddress: {
          fullName: claimForm.fullName,
          address1: claimForm.address1,
          address2: claimForm.address2,
          city: claimForm.city,
          state: claimForm.state,
          zipcode: claimForm.zipcode,
          country: claimForm.country,
          instructions: claimForm.instructions,
        },
      });
      setClaimReward(null);
      setClaimStep(0);
      setRewardAlert({
        severity: "success",
        message: "Reward claim submitted. We sent you an email confirmation.",
      });
      await loadRewards();
    } catch (err) {
      setRewardAlert({
        severity: "error",
        message: err?.response?.data?.message || "Failed to claim reward.",
      });
    } finally {
      setClaimSaving(false);
    }
  };

  return (
    <Stack spacing={2}>
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", sm: "center" }}
          spacing={1}
          sx={{ mb: 1.5 }}
        >
          <Box>
            <Typography variant="h6">Rewards</Typography>
            <Typography variant="body2" color="text.secondary">
              Milestone gifts unlock as you complete events.
            </Typography>
          </Box>
          <Chip
            size="small"
            label={`${rewardData?.completedEvents || 0} completed event${
              (rewardData?.completedEvents || 0) === 1 ? "" : "s"
            }`}
          />
        </Stack>

        {rewardAlert && (
          <CollapseAlert
            open={!!rewardAlert}
            severity={rewardAlert.severity}
            message={rewardAlert.message}
            onClose={() => setRewardAlert(null)}
          />
        )}

        <Stack spacing={1.25}>
          {(rewardData?.milestones || []).map((reward) => {
            const hasClaim = !!reward.claim;
            const canClaim =
              reward.requiresClaim &&
              (PREVIEW_ALL_REWARD_CLAIMS || (reward.unlocked && !hasClaim));
            const actionLabel = !reward.requiresClaim
              ? "Included"
              : hasClaim
              ? PREVIEW_ALL_REWARD_CLAIMS
                ? "Preview Claim"
                : "Claim Submitted"
              : "Claim Reward";
            return (
              <Paper
                key={reward.milestone}
                variant="outlined"
                sx={{
                  p: 1.5,
                  bgcolor: reward.unlocked
                    ? "rgba(123, 3, 35, 0.04)"
                    : "background.paper",
                  borderColor: reward.unlocked
                    ? "var(--primary-color)"
                    : "divider",
                }}
              >
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  justifyContent="space-between"
                  spacing={1}
                >
                  <Box>
                    <Typography fontWeight={800}>
                      {reward.milestone} events •{" "}
                      {reward.unlocked ? (
                        reward.reward
                      ) : (
                        <Box
                          component="span"
                          sx={{
                            display: "inline-block",
                            filter: "blur(5px)",
                            userSelect: "none",
                          }}
                        >
                          {reward.reward}
                        </Box>
                      )}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Approx. cost:{" "}
                      {reward.unlocked ? (
                        reward.costRange
                      ) : (
                        <Box
                          component="span"
                          sx={{
                            display: "inline-block",
                            filter: "blur(4px)",
                            userSelect: "none",
                          }}
                        >
                          Mystery value
                        </Box>
                      )}
                    </Typography>
                    {reward.unlocked && reward.description && (
                      <Typography variant="body2" color="text.secondary">
                        {reward.description}
                      </Typography>
                    )}
                    {reward.unlocked && reward.items?.length > 0 && (
                      <Box sx={{ mt: 1 }}>
                        <Typography variant="caption" fontWeight={800}>
                          Includes
                        </Typography>
                        <List dense disablePadding sx={{ mt: 0.25 }}>
                          {reward.items.map((item) => (
                            <ListItem
                              key={item}
                              disableGutters
                              sx={{ py: 0.15 }}
                            >
                              <ListItemIcon sx={{ minWidth: 28 }}>
                                <CheckCircle color="success" fontSize="small" />
                              </ListItemIcon>
                              <ListItemText
                                primary={item}
                                primaryTypographyProps={{
                                  variant: "body2",
                                  color: "text.secondary",
                                }}
                              />
                            </ListItem>
                          ))}
                        </List>
                      </Box>
                    )}
                    {!reward.unlocked && (
                      <Stack spacing={0.5} sx={{ mt: 0.75 }}>
                        <Typography variant="caption" color="text.secondary">
                          Surprise reward details unlock when you hit this
                          milestone.
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {reward.remainingEvents} more event
                          {reward.remainingEvents === 1 ? "" : "s"} to unlock
                        </Typography>
                      </Stack>
                    )}
                  </Box>
                  <Stack
                    direction="row"
                    spacing={1}
                    alignItems="center"
                    justifyContent={{ xs: "flex-start", sm: "flex-end" }}
                  >
                    <Chip
                      size="small"
                      color={reward.unlocked ? "success" : "default"}
                      label={reward.unlocked ? "Unlocked" : "Locked"}
                    />
                    {hasClaim && (
                      <Chip
                        size="small"
                        variant="outlined"
                        label={`Claim: ${formatStatus(reward.claim.status)}`}
                      />
                    )}
                    {reward.requiresClaim ? (
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => handleOpenClaim(reward)}
                        disabled={!canClaim}
                        sx={{
                          borderColor: "var(--primary-color)",
                          color: "var(--primary-color)",
                          "&.Mui-disabled": {
                            borderColor: "divider",
                            color: "text.disabled",
                          },
                        }}
                      >
                        {actionLabel}
                      </Button>
                    ) : (
                      <Chip
                        size="small"
                        variant="outlined"
                        label={actionLabel}
                      />
                    )}
                  </Stack>
                </Stack>
              </Paper>
            );
          })}

          {!rewardData?.milestones?.length && (
            <Typography variant="body2" color="text.secondary">
              Rewards are loading.
            </Typography>
          )}
        </Stack>
      </Paper>

      <Dialog
        open={!!claimReward}
        onClose={() => {
          setClaimReward(null);
          setClaimStep(0);
        }}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Claim {claimReward?.reward || "Reward"}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Alert severity="info">
              Submit your delivery details and reward choices. You will review
              everything before sending.
            </Alert>
            <Stepper activeStep={claimStep} alternativeLabel>
              {claimStepLabels.map((label) => (
                <Step key={label}>
                  <StepLabel>{label}</StepLabel>
                </Step>
              ))}
            </Stepper>

            {isClaimReviewStep ? (
              <Stack spacing={2}>
                <Paper variant="outlined" sx={{ p: 1.5 }}>
                  <Typography variant="subtitle2" fontWeight={800} gutterBottom>
                    Delivery Address
                  </Typography>
                  <Typography variant="body2">
                    {claimForm.fullName}
                    <br />
                    {claimForm.address1}
                    {claimForm.address2 ? (
                      <>
                        <br />
                        {claimForm.address2}
                      </>
                    ) : null}
                    <br />
                    {[claimForm.city, claimForm.state, claimForm.zipcode]
                      .filter(Boolean)
                      .join(", ")}
                    <br />
                    {claimForm.country}
                    {claimForm.instructions ? (
                      <>
                        <br />
                        Instructions: {claimForm.instructions}
                      </>
                    ) : null}
                  </Typography>
                </Paper>
                <Paper variant="outlined" sx={{ p: 1.5 }}>
                  <Typography variant="subtitle2" fontWeight={800} gutterBottom>
                    Reward Details
                  </Typography>
                  {claimQuestions.length ? (
                    <Stack spacing={0.75}>
                      {claimQuestions.map((question) => (
                        <Typography key={question.key} variant="body2">
                          <strong>{question.label}:</strong>{" "}
                          {claimForm[question.key] || "-"}
                        </Typography>
                      ))}
                    </Stack>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      No extra questions are needed for this reward.
                    </Typography>
                  )}
                  {claimForm.notes.trim() && (
                    <Typography variant="body2" sx={{ mt: 1 }}>
                      <strong>Notes:</strong> {claimForm.notes}
                    </Typography>
                  )}
                </Paper>
              </Stack>
            ) : isClaimDetailsStep ? (
              <>
                <Typography variant="subtitle2" fontWeight={800}>
                  Reward Details
                </Typography>
                {claimQuestions.map((question) =>
                  question.type === "select" ? (
                    <FormControl fullWidth required key={question.key}>
                      <InputLabel>{question.label}</InputLabel>
                      <Select
                        label={question.label}
                        value={claimForm[question.key]}
                        onChange={(e) =>
                          setClaimForm((p) => ({
                            ...p,
                            [question.key]: e.target.value,
                          }))
                        }
                      >
                        {question.options.map((option) => (
                          <MenuItem key={option} value={option}>
                            {option}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  ) : (
                    <TextField
                      key={question.key}
                      label={question.label}
                      value={claimForm[question.key]}
                      onChange={(e) =>
                        setClaimForm((p) => ({
                          ...p,
                          [question.key]: e.target.value,
                        }))
                      }
                      fullWidth
                      required
                      error={
                        question.key === "personalizationText" &&
                        personalizationInvalid
                      }
                      helperText={question.helperText}
                    />
                  )
                )}
                <TextField
                  label="Notes"
                  value={claimForm.notes}
                  onChange={(e) =>
                    setClaimForm((p) => ({ ...p, notes: e.target.value }))
                  }
                  fullWidth
                  multiline
                  minRows={2}
                />
              </>
            ) : (
              <>
                <Typography variant="subtitle2" fontWeight={800}>
                  Delivery Address
                </Typography>
                <TextField
                  label="Full name"
                  value={claimForm.fullName}
                  onChange={(e) =>
                    setClaimForm((p) => ({ ...p, fullName: e.target.value }))
                  }
                  fullWidth
                  required
                />
                <LocationInput
                  value={claimForm}
                  onChange={(patch) =>
                    setClaimForm((p) => ({
                      ...p,
                      ...patch,
                    }))
                  }
                  touched={claimAddressTouched}
                  setTouched={setClaimAddressTouched}
                  errors={{
                    address1: !claimForm.address1.trim()
                      ? "Delivery address is required"
                      : "",
                    city: !claimForm.city.trim() ? "City is required" : "",
                    state: !claimForm.state.trim() ? "State is required" : "",
                    zipcode: !claimForm.zipcode.trim()
                      ? "ZIP code is required"
                      : "",
                  }}
                  serviceArea="us"
                />
                {claimQuestions.length === 0 && (
                  <TextField
                    label="Notes"
                    value={claimForm.notes}
                    onChange={(e) =>
                      setClaimForm((p) => ({ ...p, notes: e.target.value }))
                    }
                    fullWidth
                    multiline
                    minRows={2}
                  />
                )}
              </>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setClaimReward(null);
              setClaimStep(0);
            }}
            sx={{ color: "var(--primary-color)" }}
          >
            Cancel
          </Button>
          {claimStep > 0 && (
            <Button
              onClick={() => setClaimStep((step) => Math.max(0, step - 1))}
              sx={{ color: "var(--primary-color)" }}
            >
              Back
            </Button>
          )}
          <Button
            variant="contained"
            onClick={
              isClaimReviewStep
                ? handleSubmitClaim
                : () => setClaimStep((step) => step + 1)
            }
            disabled={
              claimSaving ||
              (claimStep === 0 && !claimAddressComplete) ||
              (isClaimDetailsStep && !claimQuestionsComplete) ||
              (isClaimReviewStep && !claimFormReady)
            }
            sx={{ backgroundColor: "var(--primary-color)" }}
          >
            {claimSaving
              ? "Submitting..."
              : isClaimReviewStep
              ? "Submit Claim"
              : "Continue"}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

/* ---------- Stub components for other tabs ---------- */

function ScheduleTab({ myAssignments = [] }) {
  const [statusFilter, setStatusFilter] = useState("upcoming"); // 'upcoming' | 'past' | 'removed' | 'all'
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const [confirmRemoveOpen, setConfirmRemoveOpen] = useState(false);
  const [removeReason, setRemoveReason] = useState(""); // e.g. "no_show", "sick", etc.
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [removing, setRemoving] = useState(false);
  const [alert, setAlert] = useState(null);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [incidentOpen, setIncidentOpen] = useState(false);
  const [incidentForm, setIncidentForm] = useState({
    type: "intoxicated_guest_refused_service",
    severity: "medium",
    description: "",
    witnesses: "",
    actionTaken: "",
  });
  const PER_PAGE = 5;

  //console.log('myAssignments: ', myAssignments);

  const normalizeStr = (v) => (v ?? "").toString().trim().toLowerCase();

  const filterByStatus = useCallback(
    (assignment) => {
      const now = new Date();
      const status = assignment.status || "active";
      const evt = assignment.event || {};
      const startAt = evt.startAt ? new Date(evt.startAt) : null;
      const endAt = evt.endAt ? new Date(evt.endAt) : startAt;

      const isRemoved = status === "removed";
      const isUpcoming = endAt && endAt >= now;
      const isPast = endAt && endAt < now;

      switch (statusFilter) {
        case "removed":
          return isRemoved;
        case "upcoming":
          return !isRemoved && isUpcoming;
        case "past":
          return !isRemoved && isPast;
        case "all":
        default:
          return true;
      }
    },
    [statusFilter]
  );

  const matchesSearch = useCallback(
    (assignment) => {
      if (!search.trim()) return true;

      const q = normalizeStr(search);

      const evt = assignment.event || {};
      const loc = evt.location || {};

      const startAt = evt.startAt ? new Date(evt.startAt) : null;
      const dateStr = startAt
        ? `${startAt.toLocaleDateString()} ${startAt.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}`
        : "";

      const city = normalizeStr(loc.city);
      const state = normalizeStr(loc.state);
      const zipcode = normalizeStr(loc.zipcode);

      return (
        dateStr.toLowerCase().includes(q) ||
        city.includes(q) ||
        state.includes(q) ||
        zipcode.includes(q)
      );
    },
    [search]
  );

  // 👇 Filter + search
  const filtered = useMemo(
    () => myAssignments.filter((a) => filterByStatus(a) && matchesSearch(a)),
    [myAssignments, filterByStatus, matchesSearch]
  );

  // reset to first page when filters/search change
  useEffect(() => {
    setPage(1);
  }, [statusFilter, search]);

  const loadAttendance = useCallback(async () => {
    try {
      const res = await api.get("/attendance");
      setAttendanceRecords(res.data?.data || []);
    } catch (err) {
      console.warn("Failed to load attendance:", err?.message);
    }
  }, []);

  useEffect(() => {
    loadAttendance();
  }, [loadAttendance]);

  const attendanceByAssignmentId = useMemo(() => {
    const map = {};
    attendanceRecords.forEach((record) => {
      const assignmentId = record.assignment?._id || record.assignment;
      if (assignmentId) map[String(assignmentId)] = record;
    });
    return map;
  }, [attendanceRecords]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));

  const paged = useMemo(() => {
    const startIdx = (page - 1) * PER_PAGE;
    return filtered.slice(startIdx, startIdx + PER_PAGE);
  }, [filtered, page]);

  const ms48h = 48 * 60 * 60 * 1000;

  const shouldShowFullDetails = (startAt, myStatus, eventStatus = "active") => {
    if (!startAt) return false;
    if (myStatus !== "active") return false;
    if (eventStatus === "completed") return false;
    const start = new Date(startAt);
    const now = new Date();
    const diff = start.getTime() - now.getTime();
    // show full details if:
    // - event is within 48h in the future OR already started/past
    return diff <= ms48h;

    //return true;
  };

  const handleConfirmRemoval = async (id) => {
    try {
      setRemoving(true);

      await api.post(`/assignments/${id}/unassign-my`, {
        reason: removeReason,
      });

      // ✅ Success alert
      setAlert({
        severity: "success",
        message: `Successfully removed assignment.`,
      });
      setRemoveReason("");
      setConfirmRemoveOpen(false);
      setRemoving(false);
      fetchMyAssignments();
    } catch (err) {
      setAlert({
        severity: "error",
        message:
          err?.response?.data?.message ||
          "Failed to remove bartender(s). Please try again.",
      });
    } finally {
      setConfirmRemoveOpen(false);
      setRemoving(false);
    }
  };

  const handleClock = async (assignment, action) => {
    try {
      const res = await api.post(
        `/attendance/assignments/${assignment._id}/${action}`
      );
      setAlert({
        severity: "success",
        message: res.data?.message || "Attendance updated.",
      });
      await loadAttendance();
    } catch (err) {
      setAlert({
        severity: "error",
        message: err?.response?.data?.message || "Failed to update attendance.",
      });
    }
  };

  const handleSubmitIncident = async () => {
    try {
      await api.post("/incidents", {
        ...incidentForm,
        assignment: selectedAssignment?._id,
        event: selectedAssignment?.event?._id || selectedAssignment?.event,
      });
      setAlert({ severity: "success", message: "Incident report submitted." });
      setIncidentOpen(false);
      setIncidentForm({
        type: "intoxicated_guest_refused_service",
        severity: "medium",
        description: "",
        witnesses: "",
        actionTaken: "",
      });
    } catch (err) {
      setAlert({
        severity: "error",
        message:
          err?.response?.data?.message || "Failed to submit incident report.",
      });
    }
  };

  return (
    <Box sx={{ mt: 2 }}>
      <Stack spacing={2}>
        <Typography variant="h6">My Schedule</Typography>
        {alert && (
          <CollapseAlert
            open={!!alert}
            severity={alert.severity}
            message={alert.message}
            onClose={() => setAlert(null)}
          />
        )}
        {/* Filter tabs */}
        <Tabs
          value={statusFilter}
          onChange={(e, value) => setStatusFilter(value)}
          variant="scrollable"
          scrollButtons="auto"
          sx={PRIMARY_TABS_SX}
        >
          <Tab label="Upcoming" value="upcoming" />
          <Tab label="Past" value="past" />
          <Tab label="Removed" value="removed" />
          <Tab label="All" value="all" />
        </Tabs>

        {/* Search */}
        <TextField
          size="small"
          fullWidth
          label="Search by date, city, state, or zipcode"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {/* Empty state */}
        {paged.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            No assignments found for this filter.
          </Typography>
        )}

        {/* List */}
        <Stack spacing={2}>
          {paged.map((a) => {
            const evt = a.event || {};
            const startAt = evt.startAt ? new Date(evt.startAt) : null;
            const endAt = evt.endAt ? new Date(evt.endAt) : null;

            const whenStr = startAt
              ? `${startAt.toLocaleDateString()} • ${startAt.toLocaleTimeString(
                  [],
                  { hour: "2-digit", minute: "2-digit" }
                )}${
                  endAt
                    ? ` – ${endAt.toLocaleDateString()} • ${endAt.toLocaleTimeString(
                        [],
                        {
                          hour: "2-digit",
                          minute: "2-digit",
                        }
                      )}`
                    : ""
                }`
              : "TBD";

            const loc = evt.location || {};
            const fullAddress = [
              loc.address1,
              loc.address2,
              loc.city,
              loc.state,
              loc.zipcode,
            ]
              .filter(Boolean)
              .join(", ");

            const cityStateZip = [loc.city, loc.state, loc.zipcode]
              .filter(Boolean)
              .join(", ");

            const showFull = shouldShowFullDetails(
              evt.startAt,
              a.status,
              evt.status
            );
            const attendance = attendanceByAssignmentId[String(a._id)];
            const canShowEventActions =
              a.status === "active" &&
              evt.status !== "completed" &&
              isEventActionWindowOpen(evt.startAt);
            const canRemove =
              a.status === "active" && evt.status !== "completed";
            const canClock = canShowEventActions;
            const hasClockedIn = !!attendance?.clockInAt;
            const hasClockedOut = !!attendance?.clockOutAt;

            const contact = evt.contact || null;
            const contactName = contact?.fullName || contact?.name;
            const contactPhone = contact?.phone;
            const contactEmail = contact?.email;

            return (
              <Paper key={a._id} variant="outlined" sx={{ p: 2 }}>
                <Stack spacing={1}>
                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    alignItems="center"
                    spacing={1}
                  >
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Typography variant="subtitle1" fontWeight={600}>
                        {evt.shortCode || evt.type || "Event"}
                      </Typography>

                      <Chip
                        label={formatStatus(a.status) || "active"}
                        size="small"
                        color={a.status === "removed" ? "error" : "success"}
                        variant={a.status === "removed" ? "outlined" : "filled"}
                      />
                    </Stack>
                    {canRemove && (
                      <Stack
                        direction="row"
                        spacing={1}
                        flexWrap="wrap"
                        useFlexGap
                      >
                        {canClock && !hasClockedIn && (
                          <Button
                            variant="contained"
                            onClick={() => handleClock(a, "clock-in")}
                          >
                            Clock In
                          </Button>
                        )}
                        {canClock && hasClockedIn && !hasClockedOut && (
                          <Button
                            variant="contained"
                            color="success"
                            onClick={() => handleClock(a, "clock-out")}
                          >
                            Clock Out
                          </Button>
                        )}
                        {hasClockedOut && (
                          <Chip
                            size="small"
                            color="success"
                            label="Clocked out"
                          />
                        )}
                        {canShowEventActions && (
                          <Button
                            variant="outlined"
                            color="warning"
                            startIcon={<ReportProblem />}
                            onClick={() => {
                              setSelectedAssignment(a);
                              setIncidentOpen(true);
                            }}
                          >
                            Incident
                          </Button>
                        )}
                        <Button
                          sx={{
                            backgroundColor: "var(--primary-color)",
                            color: "#fff",
                          }}
                          onClick={() => {
                            setSelectedAssignment(a);
                            setConfirmRemoveOpen(true);
                          }}
                        >
                          Remove
                        </Button>
                      </Stack>
                    )}
                  </Stack>

                  <Typography variant="body2">
                    <strong>When:</strong> {whenStr}
                  </Typography>

                  <Typography variant="body2">
                    <strong>Where:</strong>{" "}
                    {showFull
                      ? fullAddress || "Location TBD"
                      : cityStateZip || "Location TBD"}
                  </Typography>

                  {showFull && (
                    <Typography variant="body2">
                      <strong>Additional Instructions:</strong>{" "}
                      {evt.additionalInstructions || "No further instructions"}
                    </Typography>
                  )}

                  {showFull && contact && (
                    <>
                      <Divider sx={{ my: 1 }} />
                      <Typography variant="body2">
                        <strong>Main Contact:</strong> {contactName || "—"}
                      </Typography>
                      {contactPhone && (
                        <Typography variant="body2" color="text.secondary">
                          Phone: {contactPhone}
                        </Typography>
                      )}
                      {contactEmail && (
                        <Typography variant="body2" color="text.secondary">
                          Email: {contactEmail}
                        </Typography>
                      )}
                    </>
                  )}

                  {attendance && (
                    <Alert
                      severity={
                        attendance.status === "disputed" ? "warning" : "info"
                      }
                      sx={{ mt: 1 }}
                    >
                      Attendance: {formatStatus(attendance.status)}{" "}
                      {attendance.clockInAt
                        ? `• In ${new Date(
                            attendance.clockInAt
                          ).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}`
                        : ""}
                      {attendance.clockOutAt
                        ? ` • Out ${new Date(
                            attendance.clockOutAt
                          ).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}`
                        : " • Out not recorded"}
                    </Alert>
                  )}
                </Stack>
              </Paper>
            );
          })}
        </Stack>

        {/* Pagination */}
        {filtered.length > PER_PAGE && (
          <Stack direction="row" justifyContent="center" sx={{ mt: 2 }}>
            <Pagination
              page={page}
              count={totalPages}
              onChange={(e, value) => setPage(value)}
              shape="rounded"
              color="primary"
            />
          </Stack>
        )}
      </Stack>

      <Dialog
        open={confirmRemoveOpen}
        onClose={() => setConfirmRemoveOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Confirm Unassignment</DialogTitle>

        <DialogContent dividers>
          <Stack spacing={2}>
            <Alert severity="warning">
              You are about to remove yourself from this event. This action may
              affect your future assignment priority.
            </Alert>

            {/* Event Summary */}
            {selectedAssignment?.event && (
              <Paper variant="outlined" sx={{ p: 1.5 }}>
                <Typography variant="subtitle2">
                  {selectedAssignment.event.type}
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  display="block"
                >
                  {new Date(selectedAssignment.event.startAt).toLocaleString()}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {selectedAssignment.event.location?.city},{" "}
                  {selectedAssignment.event.location?.state}
                </Typography>
              </Paper>
            )}

            {/* Reason Selector */}
            <FormControl fullWidth sx={{ mt: 1 }}>
              <InputLabel id="remove-reason-label">
                Reason for removal
              </InputLabel>
              <Select
                labelId="remove-reason-label"
                label="Reason for removal"
                value={removeReason}
                onChange={(e) => setRemoveReason(e.target.value)}
              >
                <MenuItem value="">Select reason for removal</MenuItem>
                <MenuItem value="sick">Marked sick</MenuItem>
                <MenuItem value="no_show">No show / unrealiable</MenuItem>
                <MenuItem value="client_change">
                  Client changed event details
                </MenuItem>
                <MenuItem value="schedule_conflict">Schedule conflict</MenuItem>
                <MenuItem value="other">Other</MenuItem>
              </Select>
            </FormControl>
            {/* Optional notes if they pick "Other" */}
            {removeReason === "Other" && (
              <TextField
                label="Additional details"
                multiline
                minRows={2}
                fullWidth
              />
            )}
          </Stack>
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setConfirmRemoveOpen(false)}>Cancel</Button>

          <Button
            color="error"
            variant="contained"
            disabled={!removeReason || removing}
            onClick={() => handleConfirmRemoval(selectedAssignment._id)}
          >
            {removing ? "Removing..." : "Confirm Removal"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={incidentOpen}
        onClose={() => setIncidentOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Submit Incident Report</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <Alert severity="info">
              Use this when something happens during an event, such as injury,
              underage drinking attempt, refused service, property damage, or
              misconduct.
            </Alert>
            <FormControl fullWidth>
              <InputLabel>Incident Type</InputLabel>
              <Select
                label="Incident Type"
                value={incidentForm.type}
                onChange={(e) =>
                  setIncidentForm((p) => ({ ...p, type: e.target.value }))
                }
              >
                <MenuItem value="guest_injury">Guest injury</MenuItem>
                <MenuItem value="underage_drinking_attempt">
                  Underage drinking attempt
                </MenuItem>
                <MenuItem value="intoxicated_guest_refused_service">
                  Intoxicated guest refused service
                </MenuItem>
                <MenuItem value="property_damage">Property damage</MenuItem>
                <MenuItem value="bartender_misconduct">
                  Bartender misconduct
                </MenuItem>
                <MenuItem value="other">Other</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Severity</InputLabel>
              <Select
                label="Severity"
                value={incidentForm.severity}
                onChange={(e) =>
                  setIncidentForm((p) => ({ ...p, severity: e.target.value }))
                }
              >
                <MenuItem value="low">Low</MenuItem>
                <MenuItem value="medium">Medium</MenuItem>
                <MenuItem value="high">High</MenuItem>
                <MenuItem value="critical">Critical</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="What happened?"
              multiline
              minRows={4}
              fullWidth
              value={incidentForm.description}
              onChange={(e) =>
                setIncidentForm((p) => ({ ...p, description: e.target.value }))
              }
            />
            <TextField
              label="Witnesses"
              fullWidth
              value={incidentForm.witnesses}
              onChange={(e) =>
                setIncidentForm((p) => ({ ...p, witnesses: e.target.value }))
              }
            />
            <TextField
              label="Action taken"
              multiline
              minRows={2}
              fullWidth
              value={incidentForm.actionTaken}
              onChange={(e) =>
                setIncidentForm((p) => ({ ...p, actionTaken: e.target.value }))
              }
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            sx={{ color: "var(--primary-color)" }}
            onClick={() => setIncidentOpen(false)}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={!incidentForm.description.trim()}
            onClick={handleSubmitIncident}
            sx={{ backgroundColor: "var(--primary-color)" }}
          >
            Submit Report
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function EarningsTab({ myAssignments = [], loggedInUser }) {
  const dispatch = useDispatch();
  const payoutLinks = loggedInUser?.bartenderProfile?.payoutLinks || {};
  const [payouts, setPayouts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [savingLinks, setSavingLinks] = useState(false);
  const [range, setRange] = useState("week");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [linksForm, setLinksForm] = useState({
    preferredProvider: payoutLinks.preferredProvider || "",
    cashApp: payoutLinks.cashApp || "",
    zelle: payoutLinks.zelle || "",
    paypal: payoutLinks.paypal || "",
    venmo: payoutLinks.venmo || "",
    notes: payoutLinks.notes || "",
  });
  const [alert, setAlert] = useState(null);
  const [transactionRow, setTransactionRow] = useState(null);

  useEffect(() => {
    setLinksForm({
      preferredProvider: payoutLinks.preferredProvider || "",
      cashApp: payoutLinks.cashApp || "",
      zelle: payoutLinks.zelle || "",
      paypal: payoutLinks.paypal || "",
      venmo: payoutLinks.venmo || "",
      notes: payoutLinks.notes || "",
    });
  }, [
    payoutLinks.cashApp,
    payoutLinks.notes,
    payoutLinks.paypal,
    payoutLinks.preferredProvider,
    payoutLinks.venmo,
    payoutLinks.zelle,
  ]);

  const loadPayouts = async () => {
    setLoading(true);
    try {
      const res = await api.get("/payouts");
      setPayouts(res.data?.data || res.data || []);
    } catch (err) {
      setAlert({
        severity: "error",
        message: err?.response?.data?.message || "Failed to load payouts.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPayouts();
  }, []);

  const payoutByAssignmentId = useMemo(() => {
    const map = {};
    (payouts || []).forEach((payout) => {
      const assignmentId = payout.assignment?._id || payout.assignment;
      if (!assignmentId || payout.status === "failed") return;
      map[assignmentId] =
        (map[assignmentId] || 0) + (Number(payout.amount) || 0);
    });
    return map;
  }, [payouts]);

  const bounds = useMemo(
    () => getRangeBounds(range, customStart, customEnd),
    [customEnd, customStart, range]
  );

  const rows = useMemo(() => {
    return (myAssignments || [])
      .filter((assignment) => assignment.status !== "removed")
      .filter((assignment) =>
        isDateInRange(
          assignment.event?.startAt || assignment.event?.createdAt,
          bounds
        )
      )
      .map((assignment) => {
        const event = assignment.event || {};
        const expected = getExpectedAssignmentPay(assignment);
        const paid = payoutByAssignmentId[assignment._id] || 0;
        const remaining = Math.max(0, expected - paid);
        const endAt = event.endAt || event.startAt;
        const overdue =
          remaining > 0 &&
          endAt &&
          Date.now() - new Date(endAt).getTime() >= 7 * MS_DAY;

        return {
          id: assignment._id,
          assignment,
          event,
          eventLabel: event.shortCode || event.type || "Event",
          when: event.startAt
            ? new Date(event.startAt).toLocaleDateString()
            : "TBD",
          expected,
          paid,
          remaining,
          overdue,
        };
      });
  }, [bounds, myAssignments, payoutByAssignmentId]);

  const totals = useMemo(
    () =>
      rows.reduce(
        (sum, row) => ({
          expected: sum.expected + row.expected,
          paid: sum.paid + row.paid,
          remaining: sum.remaining + row.remaining,
        }),
        { expected: 0, paid: 0, remaining: 0 }
      ),
    [rows]
  );

  const transactionPayouts = useMemo(() => {
    if (!transactionRow) return [];
    return (payouts || [])
      .filter(
        (payout) =>
          sameId(payout.assignment, transactionRow.assignment) ||
          sameId(payout.event, transactionRow.event)
      )
      .sort(
        (a, b) =>
          new Date(b.paidAt || b.createdAt || 0) -
          new Date(a.paidAt || a.createdAt || 0)
      );
  }, [payouts, transactionRow]);

  const saveLinks = async () => {
    setSavingLinks(true);
    setAlert(null);
    try {
      await api.patch("/users/me/bartender/payout-links", linksForm);
      await Promise.all([
        dispatch(fetchMe()),
        dispatch(fetchMyBartenderInfo()),
      ]);
      setAlert({ severity: "success", message: "Payout links saved." });
    } catch (err) {
      setAlert({
        severity: "error",
        message: err?.response?.data?.message || "Failed to save payout links.",
      });
    } finally {
      setSavingLinks(false);
    }
  };

  const sendReminder = async (row) => {
    try {
      await api.post("/payouts/reminders", {
        assignment: row.assignment._id,
        event: row.event._id,
        amountDue: row.remaining,
      });
      setAlert({ severity: "success", message: "Reminder sent to the team." });
    } catch (err) {
      setAlert({
        severity: "error",
        message: err?.response?.data?.message || "Failed to send reminder.",
      });
    }
  };

  const columns = [
    { field: "eventLabel", headerName: "Event", flex: 1, minWidth: 120 },
    { field: "when", headerName: "Date", flex: 1, minWidth: 110 },
    {
      field: "expected",
      headerName: "Expected",
      flex: 1,
      minWidth: 110,
      renderCell: (params) => fmtMoney(params.row.expected),
    },
    {
      field: "paid",
      headerName: "Paid",
      flex: 1,
      minWidth: 110,
      renderCell: (params) => fmtMoney(params.row.paid),
    },
    {
      field: "remaining",
      headerName: "Balance",
      flex: 1,
      minWidth: 110,
      renderCell: (params) => (
        <Chip
          size="small"
          color={params.row.remaining > 0 ? "warning" : "success"}
          label={fmtMoney(params.row.remaining)}
        />
      ),
    },
    {
      field: "actions",
      headerName: "",
      sortable: false,
      filterable: false,
      minWidth: 230,
      renderCell: (params) => (
        <Stack direction="row" spacing={1}>
          <Button
            size="small"
            variant="outlined"
            startIcon={<VisibilityIcon />}
            onClick={() => setTransactionRow(params.row)}
            sx={{
              borderColor: "var(--primary-color)",
              color: "var(--primary-color)",
            }}
          >
            Review
          </Button>
          {params.row.overdue && (
            <Button
              size="small"
              variant="outlined"
              startIcon={<NotificationsActive />}
              onClick={() => sendReminder(params.row)}
              sx={{
                borderColor: "var(--primary-color)",
                color: "var(--primary-color)",
              }}
            >
              Remind
            </Button>
          )}
        </Stack>
      ),
    },
  ];

  return (
    <Stack spacing={2} sx={{ mt: 2 }}>
      <Box>
        <Typography variant="h6">Earnings</Typography>
        <Typography variant="body2" color="text.secondary">
          Expected earnings include hourly pay plus your estimated share of
          event gratuity. Actual payouts show what Tipsyverse has recorded as
          paid.
        </Typography>
      </Box>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1.5}
          alignItems={{ xs: "stretch", sm: "center" }}
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
                value={customStart}
                InputLabelProps={{ shrink: true }}
                onChange={(e) => setCustomStart(e.target.value)}
              />
              <TextField
                size="small"
                label="To"
                type="date"
                value={customEnd}
                InputLabelProps={{ shrink: true }}
                onChange={(e) => setCustomEnd(e.target.value)}
              />
            </>
          )}
        </Stack>
      </Paper>

      {alert && (
        <CollapseAlert
          open={!!alert}
          severity={alert.severity}
          message={alert.message}
          onClose={() => setAlert(null)}
        />
      )}

      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        {[
          ["Expected", fmtMoney(totals.expected)],
          ["Paid", fmtMoney(totals.paid)],
          ["Remaining", fmtMoney(totals.remaining)],
        ].map(([label, value]) => (
          <Paper key={label} variant="outlined" sx={{ p: 2, flex: 1 }}>
            <Typography variant="caption" color="text.secondary">
              {label}
            </Typography>
            <Typography variant="h5" fontWeight={800}>
              {value}
            </Typography>
          </Paper>
        ))}
      </Stack>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
          <AccountBalanceWallet sx={{ color: "var(--primary-color)" }} />
          <Typography variant="subtitle1" fontWeight={700}>
            Payout Links
          </Typography>
        </Stack>
        <Stack spacing={1.5}>
          <FormControl size="small" fullWidth>
            <InputLabel>Preferred payout method</InputLabel>
            <Select
              label="Preferred payout method"
              value={linksForm.preferredProvider}
              onChange={(e) =>
                setLinksForm((p) => ({
                  ...p,
                  preferredProvider: e.target.value,
                }))
              }
            >
              <MenuItem value="">No preference</MenuItem>
              <MenuItem value="cashApp">Cash App</MenuItem>
              <MenuItem value="zelle">Zelle</MenuItem>
              <MenuItem value="paypal">PayPal</MenuItem>
              <MenuItem value="venmo">Venmo</MenuItem>
            </Select>
          </FormControl>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
            <TextField
              size="small"
              label="Cash App"
              helperText={PAYOUT_HELPER_TEXT.cashApp}
              value={linksForm.cashApp}
              onChange={(e) =>
                setLinksForm((p) => ({ ...p, cashApp: e.target.value }))
              }
              fullWidth
            />
            <TextField
              size="small"
              label="Zelle"
              helperText={PAYOUT_HELPER_TEXT.zelle}
              value={linksForm.zelle}
              onChange={(e) =>
                setLinksForm((p) => ({ ...p, zelle: e.target.value }))
              }
              fullWidth
            />
          </Stack>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
            <TextField
              size="small"
              label="PayPal"
              helperText={PAYOUT_HELPER_TEXT.paypal}
              value={linksForm.paypal}
              onChange={(e) =>
                setLinksForm((p) => ({ ...p, paypal: e.target.value }))
              }
              fullWidth
            />
            <TextField
              size="small"
              label="Venmo"
              helperText={PAYOUT_HELPER_TEXT.venmo}
              value={linksForm.venmo}
              onChange={(e) =>
                setLinksForm((p) => ({ ...p, venmo: e.target.value }))
              }
              fullWidth
            />
          </Stack>
          <TextField
            size="small"
            label="Payout notes"
            value={linksForm.notes}
            onChange={(e) =>
              setLinksForm((p) => ({ ...p, notes: e.target.value }))
            }
            fullWidth
            multiline
            minRows={2}
          />
          <Box>
            <Button
              sx={{ backgroundColor: "var(--primary-color)" }}
              variant="contained"
              onClick={saveLinks}
              disabled={savingLinks}
            >
              {savingLinks ? "Saving..." : "Save Payout Links"}
            </Button>
          </Box>
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ height: 430, width: "100%" }}>
        <DataGrid
          rows={rows}
          columns={columns}
          loading={loading}
          disableRowSelectionOnClick
          pageSizeOptions={[5, 10, 25]}
          initialState={{ pagination: { paginationModel: { pageSize: 5 } } }}
        />
      </Paper>

      <Dialog
        open={!!transactionRow}
        onClose={() => setTransactionRow(null)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>
          {transactionRow?.eventLabel || "Event"} Transactions
        </DialogTitle>
        <DialogContent dividers>
          {transactionRow && (
            <Stack spacing={2}>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                {[
                  ["Expected", fmtMoney(transactionRow.expected)],
                  ["Paid", fmtMoney(transactionRow.paid)],
                  ["Remaining", fmtMoney(transactionRow.remaining)],
                ].map(([label, value]) => (
                  <Paper key={label} variant="outlined" sx={{ p: 2, flex: 1 }}>
                    <Typography variant="caption" color="text.secondary">
                      {label}
                    </Typography>
                    <Typography variant="h6" fontWeight={800}>
                      {value}
                    </Typography>
                  </Paper>
                ))}
              </Stack>

              <Box>
                <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
                  Payout History
                </Typography>
                {transactionPayouts.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    No payout transactions recorded for this event yet.
                  </Typography>
                ) : (
                  <Stack spacing={1}>
                    {transactionPayouts.map((payout) => (
                      <Paper
                        key={payout._id}
                        variant="outlined"
                        sx={{ p: 1.5, bgcolor: "grey.50" }}
                      >
                        <Stack
                          direction={{ xs: "column", sm: "row" }}
                          justifyContent="space-between"
                          spacing={1}
                        >
                          <Box>
                            <Typography fontWeight={800}>
                              {fmtMoney(payout.amount)}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {PROVIDER_LABELS[payout.provider] ||
                                formatStatus(payout.provider || "manual")}{" "}
                              •{" "}
                              {new Date(
                                payout.paidAt || payout.createdAt
                              ).toLocaleString()}
                            </Typography>
                          </Box>
                          <Chip
                            size="small"
                            color={
                              payout.status === "failed" ? "error" : "success"
                            }
                            label={formatStatus(payout.status || "recorded")}
                          />
                        </Stack>
                        {(payout.reference || payout.notes) && (
                          <Stack spacing={0.5} sx={{ mt: 1 }}>
                            {payout.reference && (
                              <Typography variant="body2">
                                <strong>Reference:</strong> {payout.reference}
                              </Typography>
                            )}
                            {payout.notes && (
                              <Typography variant="body2">
                                <strong>Notes:</strong> {payout.notes}
                              </Typography>
                            )}
                          </Stack>
                        )}
                      </Paper>
                    ))}
                  </Stack>
                )}
              </Box>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setTransactionRow(null)}
            sx={{ color: "var(--primary-color)" }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

function LicensesTab() {
  const dispatch = useDispatch();
  const loggedInUser = useSelector((state) => state.users.loggedInUser?.user);

  const licenses = useMemo(() => {
    return loggedInUser?.bartenderProfile?.licenses || [];
  }, [loggedInUser?.bartenderProfile?.licenses]);

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState("create"); // "create" | "edit"
  const [selectedLicense, setSelectedLicense] = useState(null);

  const isEmployee = loggedInUser?.role === "employee";

  // 🔹 Keep rows in sync with Redux licenses
  useEffect(() => {
    if (!loggedInUser) return;

    setLoading(true);
    try {
      setError("");
      setRows(Array.isArray(licenses) ? licenses : []);
    } catch (e) {
      console.error(e);
      setError("Failed to load licenses. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [loggedInUser, licenses]);

  const handleAddNew = () => {
    setSelectedLicense(null);
    setDrawerMode("create");
    setDrawerOpen(true);
  };

  const handleView = (row) => {
    setSelectedLicense(row);
    setDrawerMode("edit");
    setDrawerOpen(true);
  };

  const handleDrawerClose = () => {
    setDrawerOpen(false);
  };

  const handleSaved = async () => {
    setDrawerOpen(false);
    // 🔹 Refresh user so bartenderProfile.licenses updates
    await dispatch(fetchMe());
  };

  const handleDeleted = async () => {
    setDrawerOpen(false);
    await dispatch(fetchMe());
  };

  const statusChip = (status) => {
    const s = (status || "").toLowerCase();
    let color = "default";
    let label = status || "Unknown";

    if (s === "pending" || s === "under_review") {
      color = "warning";
      label = "Pending";
    } else if (s === "active" || s === "approved") {
      color = "success";
      label = "Active";
    } else if (s === "denied" || s === "rejected") {
      color = "error";
      label = "Denied";
    } else if (s === "expired") {
      color = "default";
      label = "Expired";
    }

    return <Chip size="small" label={label} color={color} />;
  };

  const columns = [
    {
      field: "state",
      headerName: "State",
      flex: 1,
      minWidth: 90,
      // No valueGetter needed since row.state exists
    },
    {
      field: "permitNumber",
      headerName: "License #",
      flex: 1.2,
      minWidth: 140,
      // No valueGetter needed since row.permitNumber exists
    },
    {
      field: "expiresAt",
      headerName: "Expiration Date",
      flex: 1.1,
      minWidth: 140,
      renderCell: (params) => {
        const raw = params?.row?.expiresAt;
        if (!raw) return <Typography variant="body2">—</Typography>;

        // Extract YYYY-MM-DD directly
        const isoDate = String(raw).slice(0, 10); // “2027-05-11”
        const [year, month, day] = isoDate.split("-");

        return (
          <Typography variant="body2">{`${month}/${day}/${year}`}</Typography>
        );
      },
    },

    {
      field: "status",
      headerName: "Status",
      flex: 1,
      minWidth: 120,
      renderCell: (params) => statusChip(params.row?.status),
    },
    {
      field: "actions",
      headerName: "Actions",
      sortable: false,
      filterable: false,
      minWidth: 120,
      renderCell: (params) => (
        <Button
          size="small"
          variant="outlined"
          startIcon={<VisibilityIcon fontSize="small" />}
          onClick={() => handleView(params.row)}
          sx={{
            textTransform: "none",
            color: "var(--primary-color)",
            borderColor: "var(--primary-color)",
          }}
        >
          View
        </Button>
      ),
    },
  ];

  return (
    <Box sx={{ mt: 2 }}>
      {/* Top bar */}
      <Stack
        direction={{ xs: "column", sm: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", sm: "center" }}
        spacing={1.5}
        sx={{ mb: 2 }}
      >
        <Box>
          <Typography variant="h6">Licenses</Typography>
          <Typography variant="body2" color="text.secondary">
            Manage and upload your bartending licenses here.
          </Typography>
        </Box>

        <Button
          variant="contained"
          onClick={handleAddNew}
          sx={{
            textTransform: "none",
            backgroundColor: "var(--primary-color)",
            borderRadius: 2,
          }}
        >
          Add New License
        </Button>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Paper
        variant="outlined"
        sx={{
          height: 420,
          width: "100%",
          position: "relative",
        }}
      >
        {loading && (
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 2,
              bgcolor: "rgba(255,255,255,0.6)",
            }}
          >
            <CircularProgress />
          </Box>
        )}

        <DataGrid
          rows={rows}
          columns={columns}
          getRowId={(row) => row._id || row.id}
          disableRowSelectionOnClick
          slots={{
            noRowsOverlay: () => (
              <Box sx={{ p: 3, textAlign: "center", color: "text.secondary" }}>
                No license yet. Add one to get started.
              </Box>
            ),
          }}
          sx={{
            "& .MuiDataGrid-columnHeaders": {
              backgroundColor: (theme) => theme.palette.grey[100],
              textAlign: "center",
            },
            "& .MuiDataGrid-columnHeaderTitle": { width: "100%" },
            "& .MuiDataGrid-cell": {
              display: "flex",
              alignItems: "center",
              textAlign: "left",
            },
          }}
        />
      </Paper>

      {/* Drawer for Add / View / Edit */}
      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={handleDrawerClose}
        PaperProps={{ sx: { width: { xs: "100%", sm: 420 } } }}
      >
        <LicenseDetailForm
          mode={drawerMode}
          initialValue={selectedLicense}
          onClose={handleDrawerClose}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
          isEmployee={!!isEmployee}
        />
      </Drawer>
    </Box>
  );
}

function PreferencesTab() {
  const dispatch = useDispatch();
  const loggedInUser = useSelector((state) => state.users.loggedInUser?.user);

  const shareLive = loggedInUser?.bartenderProfile?.shareLiveLocation;
  const contactInfo = loggedInUser?.bartenderProfile?.contactInfo || {};
  const emergencyContact = contactInfo.emergencyContact || {};
  const [enabled, setEnabled] = useState(!!shareLive?.enabled);
  const [contactForm, setContactForm] = useState({
    phone: contactInfo.phone || "",
    emergencyFullName: emergencyContact.fullName || "",
    emergencyRelationship: emergencyContact.relationship || "",
    emergencyPhone: emergencyContact.phone || "",
    emergencyEmail: emergencyContact.email || "",
  });
  const [updating, setUpdating] = useState(false);
  const [savingContact, setSavingContact] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Keep local state in sync when user refetches / reloads
  useEffect(() => {
    setEnabled(!!shareLive?.enabled);
  }, [shareLive?.enabled]);

  useEffect(() => {
    setContactForm({
      phone: contactInfo.phone || "",
      emergencyFullName: emergencyContact.fullName || "",
      emergencyRelationship: emergencyContact.relationship || "",
      emergencyPhone: emergencyContact.phone || "",
      emergencyEmail: emergencyContact.email || "",
    });
  }, [
    contactInfo.phone,
    emergencyContact.email,
    emergencyContact.fullName,
    emergencyContact.phone,
    emergencyContact.relationship,
  ]);

  const handleGeolocationAndUpdate = async () => {
    setError("");
    setSuccess("");
    setUpdating(true);

    try {
      await updateBartenderLiveLocation({ dispatch });
      // ⬇️ make sure Redux user is refreshed
      await dispatch(fetchMe());

      setSuccess("Live location updated for better matching.");
      setEnabled(true);
    } catch (err) {
      console.error(err);

      // Geolocation or API error message
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "Failed to update location. Please try again.";

      setError(msg);
      setEnabled(false);
    } finally {
      setUpdating(false);
    }
  };

  const handleLocationToggle = async (e) => {
    const checked = e.target.checked;

    if (checked) {
      // Turning ON → auto call updateCurrentLocation
      handleGeolocationAndUpdate();
    } else {
      // Turning OFF → disable in backend and clear local flags
      setUpdating(true);
      setError("");
      setSuccess("");

      try {
        await api.patch("/users/me/bartender/location", {
          enabled: false,
        });

        // ✅ This updates loggedInUser so shareLiveEnabled changes
        dispatch(fetchMe());

        setEnabled(false);
        setSuccess("Live location sharing has been turned off.");
      } catch (err) {
        console.error(err);
        const msg =
          err?.response?.data?.message ||
          "Failed to turn off live location. Please try again.";
        setError(msg);
      } finally {
        setUpdating(false);
      }
    }
  };

  const handleManualRefresh = () => {
    // Allows “Update location” on demand
    handleGeolocationAndUpdate();
  };

  const setContactField = (field, value) => {
    setContactForm((current) => ({ ...current, [field]: value }));
  };

  const contactFormComplete =
    hasValidPhoneNumber(contactForm.phone) &&
    contactForm.emergencyFullName.trim() &&
    contactForm.emergencyRelationship.trim() &&
    hasValidPhoneNumber(contactForm.emergencyPhone);

  const saveContactInfo = async () => {
    setError("");
    setSuccess("");
    setSavingContact(true);

    try {
      await api.patch("/users/me/bartender/contact-info", {
        phone: contactForm.phone,
        emergencyContact: {
          fullName: contactForm.emergencyFullName,
          relationship: contactForm.emergencyRelationship,
          phone: contactForm.emergencyPhone,
          email: contactForm.emergencyEmail,
        },
      });
      await Promise.all([
        dispatch(fetchMe()),
        dispatch(fetchMyBartenderInfo()),
      ]);
      setSuccess("Contact information saved.");
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          "Failed to save contact information. Please try again."
      );
    } finally {
      setSavingContact(false);
    }
  };

  return (
    <Box sx={{ mt: 2 }}>
      <Typography variant="h6" sx={{ mb: 1 }}>
        Preferences
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Set your preferred locations, event types, and availability here.
      </Typography>

      {error && (
        <CollapseAlert
          message={error}
          severity={"error"}
          open={error}
          onClose={() => setError(null)}
        />
      )}
      {success && (
        <CollapseAlert
          message={success}
          severity={"success"}
          open={success}
          onClose={() => setSuccess(null)}
        />
      )}

      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle1" sx={{ mb: 0.5 }}>
          Contact and Emergency Contact
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          Keep this current so Tipsyverse can reach you before or during events.
          Emergency contact information is used only if there is a safety
          concern.
        </Typography>

        <Stack spacing={2}>
          <PhoneTextField
            label="Your phone number"
            name="bartenderPhone"
            defaultCountry="us"
            value={toPhoneInputValue(contactForm.phone)}
            onChange={(value) => setContactField("phone", value)}
            helperText="Use the best number for event-day communication."
            required
            fullWidth
          />
          <TextField
            label="Emergency contact full name"
            value={contactForm.emergencyFullName}
            onChange={(e) =>
              setContactField("emergencyFullName", e.target.value)
            }
            required
            fullWidth
          />
          <TextField
            select
            label="Relationship"
            value={contactForm.emergencyRelationship}
            onChange={(e) =>
              setContactField("emergencyRelationship", e.target.value)
            }
            required
            fullWidth
          >
            {EMERGENCY_RELATIONSHIP_OPTIONS.map((relationship) => (
              <MenuItem key={relationship} value={relationship}>
                {relationship}
              </MenuItem>
            ))}
          </TextField>
          <PhoneTextField
            label="Emergency contact phone"
            name="emergencyContactPhone"
            defaultCountry="us"
            value={toPhoneInputValue(contactForm.emergencyPhone)}
            onChange={(value) => setContactField("emergencyPhone", value)}
            required
            fullWidth
          />
          <TextField
            label="Emergency contact email"
            value={contactForm.emergencyEmail}
            onChange={(e) => setContactField("emergencyEmail", e.target.value)}
            type="email"
            fullWidth
          />
          <Box>
            <Button
              variant="contained"
              onClick={saveContactInfo}
              disabled={savingContact || !contactFormComplete}
              sx={{ backgroundColor: "var(--primary-color)" }}
            >
              {savingContact ? "Saving..." : "Save Contact Info"}
            </Button>
          </Box>
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle1" sx={{ mb: 0.5 }}>
          Live Location for Matching
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          When enabled, Tipsyverse uses your current location to prioritize
          nearby events and improve matching. Your location is only used for
          assigning gigs.
        </Typography>

        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={2}
          alignItems={{ xs: "flex-start", sm: "center" }}
        >
          <FormControlLabel
            control={
              <Switch
                checked={enabled}
                onChange={handleLocationToggle}
                disabled={updating}
              />
            }
            label={
              enabled
                ? "Live location sharing is ON"
                : "Share my live location for better matching"
            }
          />

          <Button
            variant="outlined"
            size="small"
            onClick={handleManualRefresh}
            disabled={updating || !enabled}
            sx={{
              color: "var(--primary-color)",
              borderColor: "var(--primary-color)",
            }}
          >
            {updating ? "Updating..." : "Refresh Location"}
          </Button>
        </Stack>

        {shareLive?.lastPoint && (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ mt: 1, display: "block" }}
          >
            Last update:{" "}
            {shareLive.updatedAt
              ? new Date(shareLive.updatedAt).toLocaleString()
              : "Recently"}
          </Typography>
        )}
      </Paper>

      {/* Future: add preferred cities, max distance, event types, etc. */}
    </Box>
  );
}

/* ---------- Main Bartender Page (vertical tabs) ---------- */

function BartenderPage({
  loggedInUser,
  pins,
  availableEvents,
  liveCoords = null,
  shareLiveEnabled = false,
  myBids = [], // 🔹 NEW
  myAssignments = [],
  reviewSummary = [],
  reviewHistory = [],
  myReviews = [],
  onRefresh,
  refreshing = false,
  refreshAlert = null,
  onDismissRefreshAlert,
}) {
  //console.log("Current live coords:", liveCoords);
  const location = useLocation();

  // Map routes to tab index
  const tabFromPath = React.useMemo(() => {
    if (location.pathname.includes("/bartend/schedule")) return 1;
    if (location.pathname.includes("/bartend/earnings")) return 2;
    if (location.pathname.includes("/bartend/rewards")) return 3;
    if (location.pathname.includes("/bartend/reviews")) return 4;
    if (location.pathname.includes("/bartend/licenses")) return 5;
    if (location.pathname.includes("/bartend/preferences")) return 6;
    if (location.pathname.includes("/bartend/how-to")) return 7;
    return 0; // default Home
  }, [location.pathname]);

  const [tab, setTab] = useState(tabFromPath);

  // Sync tab when URL changes
  useEffect(() => {
    setTab(tabFromPath);
  }, [tabFromPath]);

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      {/* Header */}
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1}
        alignItems={{ xs: "flex-start", sm: "center" }}
        justifyContent="space-between"
        sx={{ mb: 3 }}
      >
        <Box>
          <Typography variant="h5" fontWeight={800}>
            {`Hi, ${loggedInUser?.fullName.split(" ")[0]} 👋🏾`}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Track your onboarding, schedule, earnings, and performance in one
            place.
          </Typography>
        </Box>
        <Button
          variant="outlined"
          size="small"
          startIcon={<Refresh />}
          onClick={() => onRefresh?.({ silent: false })}
          disabled={refreshing}
          sx={{
            borderColor: "var(--primary-color)",
            color: "var(--primary-color)",
            whiteSpace: "nowrap",
          }}
        >
          {refreshing ? "Refreshing..." : "Refresh"}
        </Button>
      </Stack>

      {refreshAlert && (
        <CollapseAlert
          open={!!refreshAlert}
          severity={refreshAlert.severity}
          message={refreshAlert.message}
          onClose={onDismissRefreshAlert}
        />
      )}

      {/* Vertical tabs + content */}
      <Paper
        variant="outlined"
        sx={{
          display: "flex",
          flexDirection: { xs: "column", sm: "row" },
          minHeight: 360,
        }}
      >
        <Tabs
          orientation="vertical"
          value={tab}
          onChange={(_, v) => {
            setTab(v);
            onRefresh?.({ silent: true });
            const routes = [
              "/bartend",
              "/bartend/schedule",
              "/bartend/earnings",
              "/bartend/rewards",
              "/bartend/reviews",
              "/bartend/licenses",
              "/bartend/preferences",
              "/bartend/how-to",
            ];
            window.history.pushState({}, "", routes[v]);
          }}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            ...PRIMARY_TABS_SX,
            borderRight: { sm: 1, xs: 0 },
            borderColor: "divider",
            minWidth: 200,
          }}
        >
          <Tab
            label="Home"
            icon={<CalendarMonth fontSize="small" />}
            iconPosition="start"
          />
          <Tab
            label="Schedule"
            icon={<Schedule fontSize="small" />}
            iconPosition="start"
          />
          <Tab
            label="Earnings"
            icon={<MonetizationOn fontSize="small" />}
            iconPosition="start"
          />
          <Tab
            label="Rewards"
            icon={<EmojiEvents fontSize="small" />}
            iconPosition="start"
          />
          <Tab
            label="Reviews"
            icon={<VisibilityIcon fontSize="small" />}
            iconPosition="start"
          />
          <Tab
            label="Licenses"
            icon={<Badge fontSize="small" />}
            iconPosition="start"
          />
          <Tab
            label="Preferences"
            icon={<Tune fontSize="small" />}
            iconPosition="start"
          />
          <Tab
            label="How To"
            icon={<HelpOutline fontSize="small" />}
            iconPosition="start"
          />
        </Tabs>

        <Box sx={{ flex: 1, p: 2 }}>
          {tab === 0 && (
            <BartenderHomeTab
              pins={pins}
              availableEvents={availableEvents}
              myAssignments={myAssignments}
              liveCoords={liveCoords}
              shareLiveEnabled={shareLiveEnabled}
              myBids={myBids}
              reviewSummary={reviewSummary}
              reviewHistory={reviewHistory}
              myReviews={myReviews}
            />
          )}
          {tab === 1 && <ScheduleTab myAssignments={myAssignments} />}
          {tab === 2 && (
            <EarningsTab
              myAssignments={myAssignments}
              loggedInUser={loggedInUser}
            />
          )}
          {tab === 3 && <RewardsTab />}
          {tab === 4 && <ReviewsTab myReviews={myReviews} />}
          {tab === 5 && <LicensesTab />}
          {tab === 6 && <PreferencesTab />}
          {tab === 7 && <HowToGuide audience="bartender" />}
        </Box>
      </Paper>
    </Box>
  );
}

/* ---------- Container: handles auth + loading ---------- */

function BartenderHubInner() {
  // Grab the whole wrapper to detect "loading" vs "not logged in"
  const dispatch = useDispatch();

  const loggedInUserWrapper = useSelector((state) => state.users.loggedInUser);

  const loggedInUser = loggedInUserWrapper?.user;

  const bartenderInfo = loggedInUserWrapper?.bartenderInfo;

  const shareLive = loggedInUser?.bartenderProfile?.shareLiveLocation || null;

  const shareLiveEnabled = !!shareLive?.enabled;

  const [liveCoords, setLiveCoords] = useState(null);

  const [hasBootstrappedLiveLoc, setHasBootstrappedLiveLoc] = useState(false);
  const [refreshingDashboard, setRefreshingDashboard] = useState(false);
  const [dashboardRefreshAlert, setDashboardRefreshAlert] = useState(null);

  const myBids = useSelector((state) => state.bids.myBids || []);

  const myAssignments = useSelector(
    (state) => state.assignments.myAssignments || []
  );

  const myReviews = useSelector((state) => state.reviews.myReviews || []);

  const reviewSummary = useMemo(() => {
    const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

    (myReviews || []).forEach((r) => {
      const v = Number(r?.rating);
      if (v >= 1 && v <= 5) counts[Math.round(v)] += 1;
    });

    const total = Object.values(counts).reduce((a, b) => a + b, 0);

    const breakdown = [5, 4, 3, 2, 1].map((n) => ({
      stars: n,
      count: counts[n],
      pct: total ? Math.round((counts[n] / total) * 100) : 0,
      label: `${n}★`,
      value: counts[n], // for pie
    }));

    return {
      total,
      breakdown,
      pie: breakdown.map(({ label, value }) => ({ label, value })),
    };
  }, [myReviews]);

  const reviewHistory = useMemo(() => {
    const list = (myReviews || [])
      .filter((r) => r?.rating != null && r?.event?.startAt)
      .sort((a, b) => new Date(a.event.startAt) - new Date(b.event.startAt));

    return list.map((r) => ({
      label: new Date(r.event.startAt).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      }),
      rating: Number(r.rating),
    }));
  }, [myReviews]);

  // console.log("myBids: ", myBids);

  // console.log('myAssigments: ', myAssigments);

  //console.log('myReviews: ', myReviews);

  const refreshBartenderDashboard = useCallback(
    async ({ silent = true } = {}) => {
      if (!loggedInUser?._id) return;
      if (!silent) {
        setRefreshingDashboard(true);
        setDashboardRefreshAlert(null);
      }

      try {
        const requests = [
          dispatch(fetchMe()).unwrap(),
          dispatch(fetchMyBartenderInfo()).unwrap(),
          dispatch(fetchMyBids()).unwrap(),
          dispatch(fetchMyAssignments()).unwrap(),
          dispatch(fetchMyReviews()).unwrap(),
        ];

        if (bartenderInfo?.eligible) {
          requests.push(dispatch(fetchAvailableEvents()).unwrap());
        }

        await Promise.all(requests);

        if (!silent) {
          setDashboardRefreshAlert({
            severity: "success",
            message: "Dashboard refreshed.",
          });
        }
      } catch (err) {
        if (!silent) {
          setDashboardRefreshAlert({
            severity: "error",
            message: err?.message || "Failed to refresh dashboard.",
          });
        }
      } finally {
        if (!silent) setRefreshingDashboard(false);
      }
    },
    [bartenderInfo?.eligible, dispatch, loggedInUser?._id]
  );

  useEffect(() => {
    dispatch(fetchMe());
  }, [dispatch]);

  useEffect(() => {
    if (!loggedInUser?._id) return;

    dispatch(fetchMyBartenderInfo());
    dispatch(fetchMyBids());
    dispatch(fetchMyAssignments());
    dispatch(fetchMyReviews());
  }, [dispatch, loggedInUser?._id]);

  // Admin assignment changes can happen in another browser. Refresh the
  // schedule when the bartender returns to this tab so removed events leave
  // Upcoming immediately and appear only in Removed/All history.
  useEffect(() => {
    if (!loggedInUser?._id) return undefined;
    const refreshAssignments = () => {
      if (document.visibilityState === "visible") {
        dispatch(fetchMyAssignments());
      }
    };
    window.addEventListener("focus", refreshAssignments);
    document.addEventListener("visibilitychange", refreshAssignments);
    return () => {
      window.removeEventListener("focus", refreshAssignments);
      document.removeEventListener("visibilitychange", refreshAssignments);
    };
  }, [dispatch, loggedInUser?._id]);

  useEffect(() => {
    if (bartenderInfo?.eligible) {
      dispatch(fetchAvailableEvents());
    }
  }, [dispatch, bartenderInfo?.eligible]);

  // 🔹 Global auto-geolocation for the entire Bartender Screen
  useEffect(() => {
    if (!loggedInUser?._id) return;
    if (!shareLiveEnabled) return;
    if (hasBootstrappedLiveLoc) return;

    (async () => {
      try {
        const coords = await updateBartenderLiveLocation({ dispatch });
        if (
          coords &&
          typeof coords.lat === "number" &&
          typeof coords.lng === "number"
        ) {
          setLiveCoords(coords);
        }
        setHasBootstrappedLiveLoc(true);
      } catch (err) {
        console.error("Failed to bootstrap live location:", err);
      }
    })();
  }, [loggedInUser?._id, shareLiveEnabled, hasBootstrappedLiveLoc, dispatch]);

  // When sharing is turned OFF → clear coords
  useEffect(() => {
    if (!shareLiveEnabled) {
      setLiveCoords(null);
      setHasBootstrappedLiveLoc(false);
    }
  }, [shareLiveEnabled]);

  const rawAvailableEvents = useSelector(
    (state) => state.events.availableEvents
  );

  const availableEvents =
    bartenderInfo?.eligible === true && Array.isArray(rawAvailableEvents)
      ? rawAvailableEvents
      : [];

  // If the slice hasn't hydrated at all yet → show skeleton
  if (loggedInUserWrapper === undefined) {
    return <BartenderSkeleton />;
  }

  // Not logged in → show login prompt
  if (!loggedInUser) {
    return (
      <Box
        sx={{
          p: 3,
          minHeight: "60vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
        }}
      >
        <CalendarMonth
          sx={{
            fontSize: 72,
            mb: 2,
            color: "var(--primary-color)",
          }}
        />
        <Typography variant="h5" sx={{ mb: 1 }}>
          You must login to start your journey as a bartender.
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Sign in to view your onboarding progress, schedule, and earnings.
        </Typography>
        <Button
          component={Link}
          to="/login"
          variant="contained"
          startIcon={<Login />}
          sx={{
            textTransform: "none",
            backgroundColor: "var(--primary-color)",
            borderRadius: 2,
            px: 3,
          }}
        >
          Login
        </Button>
      </Box>
    );
  }

  // Be flexible in case the field name changes slightly

  // If user is logged in but bartender info hasn't hydrated yet → skeleton
  if (!bartenderInfo) {
    return <BartenderSkeleton />;
  }

  // Build pins safely with fallbacks
  const pins = {
    eligible: bartenderInfo.eligible ?? false,
    checklist: bartenderInfo.steps || [],
  };

  return (
    <BartenderPage
      loggedInUser={loggedInUser}
      pins={pins}
      availableEvents={availableEvents}
      liveCoords={liveCoords}
      shareLiveEnabled={shareLiveEnabled}
      myBids={myBids} // 🔹 pass down
      myAssignments={myAssignments}
      reviewSummary={reviewSummary}
      reviewHistory={reviewHistory}
      myReviews={myReviews}
      onRefresh={refreshBartenderDashboard}
      refreshing={refreshingDashboard}
      refreshAlert={dashboardRefreshAlert}
      onDismissRefreshAlert={() => setDashboardRefreshAlert(null)}
    />
  );
}

export default function BartenderScreen() {
  return (
    <PublicLayout>
      <HelmetHeader
        title="Tipsyverse | Bartender Dashboard"
        description="Track your onboarding, schedule, earnings, and reviews as a Tipsyverse bartender."
        keywords="tipsyverse bartender, bartender schedule, bartender earnings, bartender dashboard"
      />
      <BartenderHubInner />
    </PublicLayout>
  );
}
