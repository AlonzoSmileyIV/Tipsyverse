import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import {
  Box,
  Button,
  Chip,
  Divider,
  Grid,
  IconButton,
  LinearProgress,
  MenuItem,
  Stack,
  Step,
  StepButton,
  StepLabel,
  Stepper,
  TextField,
  Tooltip,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  RadioGroup,
  Radio,
  FormControlLabel,
  Alert,
  Collapse,
  Paper,
  InputAdornment,
  Checkbox,
  Avatar,
  Tabs,
  Tab,
  FormControl,
  InputLabel,
  Select,
} from "@mui/material";
import {
  Phone,
  InfoOutlined,
  Close,
  CopyAllOutlined,
  CheckCircle,
  CloudUpload,
  ArrowBackIos,
  ArrowForwardIos,
  Group,
  History,
} from "@mui/icons-material";
import moment from "moment";
import api from "../../services/api";
import LocationInput from "../LocationInput/LocationInput";
import { useDispatch, useSelector } from "react-redux";
import { fetchBidsByEventId } from "../../features/bids/bidSlice";
import { fetchEventById } from "../../features/events/eventSlice";
import PhoneTextField from "../PhoneTextField/PhoneTextField";
import ActivityLogsTable from "../ActivityLogsTable/LazyActivityLogsTable";
import { isHoliday as getHolidayInfo } from "../../utils/holiday";
import getEventPaymentPolicyView, { formatPaymentDueDate } from "../../utils/eventPaymentPolicy";
import {
  getDatePartInTimeZone,
  getEventTimeZone,
  getTimePartInTimeZone,
  zonedLocalDateTimeToIso,
} from "../../utils/timestamps";
import { COMMON_US_TIMEZONES } from "../../utils/timezones";
import {
  getRecommendedBartenderCount,
  getRequiredBartenderCount,
} from "../../utils/eventSummary";
import { fetchAssignmentsByEventId } from "../../features/assignments/assignmentSlice";
import { parseDateOnlyParts } from "../../utils/dateOnly";
import {
  formatTimeInput,
  parseTimeInput,
  timeValueToInput,
} from "../../utils/timeInput";

const MAX_IMAGE_SIZE_MB = 2;
import {
  BAR_TYPES,
  CANCEL_REASONS,
  EVENT_TYPES,
  OUTCOME_OPTIONS,
  OVERRIDE_REASONS,
  PAYMENT_PROVIDER_LINKS,
  buildProcurementGuide,
  buildPricingSnapshot,
  buildSnapshotFromEvent,
  computeAutoRush,
  diffSnapshots,
  emptyCalc,
  emptyCoupons,
  fmtMoney,
  fmtMoneyC,
  formatLocationPretty,
  formatPhone,
  formatWhen,
  fromCents,
  getProcurementItemsFromEvent,
  pct,
  pctOfCents,
  pctToDecimal,
  procurementBaseline,
  recommendBartenders,
  steps,
  toCents,
  toNumber,
} from "./DetailedEventForm.utils";
import {
  ContactAttemptsList,
  PaymentStatusSummary,
  PricingHeader,
  PricingRow,
  RecordedPaymentsList,
  Row,
} from "./DetailedEventForm.parts";

const formatDateInput = (value) => {
  const digits = String(value || "").replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
};

const datePartsToInput = (value) => {
  const parts = parseDateOnlyParts(value);
  if (!parts) return "";
  const pad = (part) => String(part).padStart(2, "0");
  return `${pad(parts.month)}/${pad(parts.day)}/${parts.year}`;
};

const datePartsToDatePart = (parts) => {
  if (!parts) return "";
  const pad = (part) => String(part).padStart(2, "0");
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
};

const combineLocalDateTime = (datePart, timePart) =>
  datePart && timePart ? `${datePart}T${timePart}` : "";

const getLocalDatePart = (value) => (value ? moment(value).format("YYYY-MM-DD") : "");
const getLocalTimePart = (value) => (value ? moment(value).format("HH:mm") : "");

const getNextWeekendWindow = () => {
  const start = new Date();
  const day = start.getDay();
  const daysUntilSaturday = day === 6 ? 7 : (6 - day + 7) % 7;
  start.setDate(start.getDate() + daysUntilSaturday);
  start.setHours(17, 0, 0, 0);
  const end = new Date(start);
  end.setHours(21, 0, 0, 0);
  return { start, end };
};

/* ----------------------- main event detail component ----------------------- */
const DetailedEventForm = ({ event, readOnly = true, onClose, onSaved }) => {
  const loggedInUser = useSelector((state) => state.users.loggedInUser)?.user;
  const dispatch = useDispatch();

  // UI state
  const [active, setActive] = useState(0);
  const [saving, setSaving] = useState(false);
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertMsg, setAlertMsg] = useState("");
  const [stepDialogOpen, setStepDialogOpen] = useState(false);
  const [alertType, setAlertType] = useState("info");
  const [bartendersTouched, setBartendersTouched] = useState(false);
  const [contactDialog, setContactDialog] = useState(false);
  const [procurementGuideOpen, setProcurementGuideOpen] = useState(false);
  const [procurementGuideMode, setProcurementGuideMode] = useState("rule");
  const [activityLogOpen, setActivityLogOpen] = useState(false);

  // Which tab is active: "assign" | "remove" | "replace"
  const [manageBartendersOpen, setManageBartendersOpen] = useState(false);
  const [bartenderTab, setBartenderTab] = useState("assign");

  const [confirmPricingOpen, setConfirmPricingOpen] = useState(false);
  const [pricingDiff, setPricingDiff] = useState(null);
  const [pendingPayload, setPendingPayload] = useState(null);

  // Assign bids
  const allBids = useSelector((state) => state.bids.currentEventBids || []);
  const [checkedBidIds, setCheckedBidIds] = useState([]); // ids checked in UI
  const [selectedBidIds, setSelectedBidIds] = useState([]); // ids on "chosen" side
  const [searchAvailable, setSearchAvailable] = useState("");
  const [searchChosen, setSearchChosen] = useState("");

  const allAssignments = useSelector(
    (state) => state.assignments.currentEventAssignments || []
  );
  //console.log("allAssignments: ", allAssignments);
  const [searchAssigned, setSearchAssigned] = useState("");
  const [checkedAssignments, setCheckedAssignments] = useState([]);
  const [removeReason, setRemoveReason] = useState("");

  const [confirmRemoveOpen, setConfirmRemoveOpen] = useState(false);
  const [removing, setRemoving] = useState(false);

  // additional contacts inline
  const [newContact, setNewContact] = useState({
    fullName: "",
    email: "",
    phone: "",
  });

  // contact attempt
  const [attempt, setAttempt] = useState({
    method: "phone",
    outcome: "no_answer",
    notes: "",
    followUpAt: "",
  });

  const [showAttempts, setShowAttempts] = useState(false);

  // Normalize incoming event.location to the shape LocationInput expects
  const initialLocation = (() => {
    const l = event?.location || {};

    const fallbackFromPieces = [l.city, l.state, l.zipcode, l.country]
      .filter(Boolean)
      .join(", ");

    const formatted = l.formattedAddress || l.formatted || fallbackFromPieces;

    // Safely pull from GeoJSON-style point if present
    const coords = Array.isArray(l.point?.coordinates)
      ? l.point.coordinates
      : null;

    // Your backend is probably storing [lng, lat]
    const latFromPoint = coords ? coords[1] : null;
    const lngFromPoint = coords ? coords[0] : null;

    const latitude = l.latitude ?? l.lat ?? latFromPoint ?? null;
    const longitude = l.longitude ?? l.lng ?? lngFromPoint ?? null;

    return {
      placeId: l.placeId || "",
      formattedAddress: formatted,
      address1: l.address1 || formatted || "",
      address2: l.address2 || "",
      city: l.city || "",
      county: l.county || "",
      state: l.state || "",
      zipcode: l.zipcode || "",
      country: l.country || "US",
      latitude: latitude,
      longitude: longitude,
      instructions: l.instructions || "",
    };
  })();

  // —— Editable form state (Confirm + Questions) ——
  const [form, setForm] = useState(() => ({
    type: event?.type || "",
    status: event?.status || "pending",
    startAt: event?.startAt || getNextWeekendWindow().start.toISOString(),
    endAt: event?.endAt || getNextWeekendWindow().end.toISOString(),
    timezone:
      getEventTimeZone(event),
    location: initialLocation,
    contact: {
      fullName: event?.contact?.fullName || "",
      email: event?.contact?.email || "",
      phone: event?.contact?.phone || "",
      preferred: event?.contact?.preferred || "call",
    },
    guestCount: event?.guestCount || "",
    bartendersRequested: getRequiredBartenderCount(event, 1),
    recommendedBartenders: getRecommendedBartenderCount(
      event,
      recommendBartenders(event?.guestCount) || 1
    ),
    staffingExceptionReason: event?.staffingException?.reason || "",
    barType: event?.options?.barType || "unknown",
    bartenderNotes: event?.bartenderNotes || "",
    additionalContacts: Array.isArray(event?.additionalContacts)
      ? event.additionalContacts
      : [],
    procurementRequested: event?.options?.procurementRequested || false,
    procurementItems: getProcurementItemsFromEvent(event),
    procurementActualCost: event?.options?.procurementActualCost ?? "",
    procurementReceiptProof: event?.options?.procurementReceiptProof || "",
    procurementReceiptPublicId: event?.options?.procurementReceiptPublicId || "",
    procurementReceiptNotes: event?.options?.procurementReceiptNotes || "",
    allowTipJars: event?.options?.tipJarsAllowed !== false,
    description: event?.description || "",
    additionalInstructions: event?.additionalInstructions || "",
    internalNotes: event?.internalNotes || "",
    private: !!event?.private,
  }));
  const [dateInputs, setDateInputs] = useState(() => ({
    startAt: datePartsToInput(
      getDatePartInTimeZone(
        event?.startAt || getNextWeekendWindow().start,
        getEventTimeZone(event)
      )
    ),
    endAt: datePartsToInput(
      getDatePartInTimeZone(
        event?.endAt || getNextWeekendWindow().end,
        getEventTimeZone(event)
      )
    ),
  }));
  const [timeInputs, setTimeInputs] = useState(() => ({
    startAt: timeValueToInput(
      getTimePartInTimeZone(
        event?.startAt || getNextWeekendWindow().start,
        getEventTimeZone(event)
      )
    ),
    endAt: timeValueToInput(
      getTimePartInTimeZone(
        event?.endAt || getNextWeekendWindow().end,
        getEventTimeZone(event)
      )
    ),
  }));
  const previousEventIdRef = useRef(event?._id);

  useEffect(() => {
    if (!event?._id) return;
    const eventChanged = previousEventIdRef.current !== event._id;
    const incomingItems = getProcurementItemsFromEvent(event);
    previousEventIdRef.current = event._id;

    setForm((current) => {
      const shouldSyncItems = eventChanged || incomingItems.length > 0;
      return {
        ...current,
        procurementRequested:
          event?.options?.procurementRequested ||
          current.procurementRequested ||
          incomingItems.length > 0,
        procurementItems: shouldSyncItems
          ? incomingItems
          : current.procurementItems,
        procurementActualCost:
          event?.options?.procurementActualCost ??
          current.procurementActualCost,
        procurementReceiptProof:
          event?.options?.procurementReceiptProof ||
          current.procurementReceiptProof,
        procurementReceiptPublicId:
          event?.options?.procurementReceiptPublicId ||
          current.procurementReceiptPublicId,
        procurementReceiptNotes:
          event?.options?.procurementReceiptNotes ||
          current.procurementReceiptNotes,
      };
    });
  // Keep this scoped to event procurement fields so local checklist edits are not
  // overwritten by unrelated parent re-renders with stale event data.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    event?._id,
    event?.options?.procurementActualCost,
    event?.options?.procurementItems,
    event?.options?.itemsToPickup,
    event?.options?.pickupItems,
    event?.options?.procurementReceiptNotes,
    event?.options?.procurementReceiptProof,
    event?.options?.procurementReceiptPublicId,
    event?.options?.procurementRequested,
    event?.needs,
  ]);

  // how many bartenders we are trying to assign
  const isAssignmentChecked = (a) =>
    checkedAssignments.some((x) => x._id === a._id);
  // ---- handler ----
  const handleOpenManageBartenders = async () => {
    // Always start on the "From Bids" tab
    setBartenderTab("assign");

    // Reset selection state
    setCheckedBidIds([]);
    setSelectedBidIds([]);

    setCheckedAssignments([]);
    setRemoveReason("");

    if (event?._id) {
      // Fetch all bids for this event
      await dispatch(fetchBidsByEventId(event._id));
      await dispatch(fetchAssignmentsByEventId(event._id));
    }

    // Open the dialog after we’ve kicked off / finished the fetch
    setManageBartendersOpen(true);
    //setSelectDialogOpen(true);
  };

  const handleConfirmRemove = async () => {
    try {
      setRemoving(true);
      const bartenderIds = checkedAssignments
        .map((assignment) =>
          String(
            assignment.bartenderUser?._id || assignment.bartenderUser || ""
          )
        )
        .filter(Boolean);
      if (bartenderIds.length !== checkedAssignments.length) {
        throw new Error(
          "One or more selected assignments are missing a bartender account. Refresh and try again."
        );
      }

      const response = await api.post(`/events/${event._id}/remove-bartenders`, {
        bartenderIds,
        reason: removeReason,
      });
      const removedCount = Number(response.data?.data?.removedCount) || 0;
      if (!removedCount) {
        throw new Error(
          response.data?.data?.message || "No active assignments were removed."
        );
      }
      // Close dialog
      setConfirmRemoveOpen(false);

      // Reset UI state
      setCheckedAssignments([]);
      setRemoveReason("");

      await dispatch(fetchBidsByEventId(event._id));
      await dispatch(fetchAssignmentsByEventId(event._id));

      // Your existing removal logic here:
      // e.g. await removeAssignedBartenders(checkedAssignments, removeReason);
      //await removeAssignedBartenders(); // if it already reads from state
      setConfirmRemoveOpen(false);
      setManageBartendersOpen(false);
      setAlertType("success");
      setAlertMsg(`Successfully removed ${removedCount} bartender(s).`);
      setAlertOpen(true);
    } catch (e) {
      setConfirmRemoveOpen(false);
      setManageBartendersOpen(false);
      setAlertType("error");
      setAlertMsg(e?.response?.data?.message || e.message || "Save failed");
      setAlertOpen(true);
    } finally {
      setRemoving(false);
    }
  };

  // how many bartenders we are trying to assign
  const totalBartendersNeeded = Math.max(
    1,
    Number(form.bartendersRequested) || getRequiredBartenderCount(event, 1)
  );
  const maxBartendersNeeded = Math.max(
    0,
    totalBartendersNeeded - allAssignments.length
  );

  // helper to normalize a bid id
  const getBidId = (bid) => String(bid._id || bid.id || "");

  const compareBidPriority = (a, b) => {
    // Hard availability is always the first gate. Interested bartenders with
    // conflicts stay visible, but are grouped at the bottom.
    if (!!a.conflictsSchedule !== !!b.conflictsSchedule)
      return a.conflictsSchedule ? 1 : -1;
    if ((Number(b.score) || 0) !== (Number(a.score) || 0))
      return (Number(b.score) || 0) - (Number(a.score) || 0);

    const profileA = a.bartenderUser?.bartenderProfile || {};
    const profileB = b.bartenderUser?.bartenderProfile || {};
    const ratingDelta =
      (Number(profileB.reviewSummary?.avgRating) || 0) -
      (Number(profileA.reviewSummary?.avgRating) || 0);
    if (ratingDelta) return ratingDelta;

    const experienceA = new Date(
      profileA.dateBartendingStarted || a.bartenderUser?.createdAt || Date.now()
    ).getTime();
    const experienceB = new Date(
      profileB.dateBartendingStarted || b.bartenderUser?.createdAt || Date.now()
    ).getTime();
    if (experienceA !== experienceB) return experienceA - experienceB;

    const assignedDelta =
      (Number(profileA.stats?.totalAssignedEvents) || 0) -
      (Number(profileB.stats?.totalAssignedEvents) || 0);
    if (assignedDelta) return assignedDelta;
    return new Date(a.submittedAt || 0) - new Date(b.submittedAt || 0);
  };

  const not = (a, b) => a.filter((v) => !b.includes(v));
  const intersection = (a, b) => a.filter((v) => b.includes(v));

  const leftBids = useMemo(() => {
    const selectedSet = new Set(selectedBidIds);
    return allBids
      .filter((b) => !selectedSet.has(getBidId(b)))
      .sort(compareBidPriority);
  }, [allBids, selectedBidIds]);

  const rightBids = useMemo(() => {
    const selectedSet = new Set(selectedBidIds);
    return allBids.filter((b) => selectedSet.has(getBidId(b)));
  }, [allBids, selectedBidIds]);

  const bidMatchesSearch = (bid, query) => {
    const q = String(query || "")
      .trim()
      .toLowerCase();
    if (!q) return true;

    const bartender =
      bid.bartenderUser || bid.bartender || bid.user || bid.owner || {};

    const name =
      bartender.fullName ||
      bartender.fullname ||
      bartender.name ||
      bartender.displayName ||
      "";

    const email =
      bartender.email || bartender.contactEmail || bartender.loginEmail || "";

    const notes = bid.notes ? String(bid.notes) : "";

    return (
      name.toLowerCase().includes(q) ||
      email.toLowerCase().includes(q) ||
      notes.toLowerCase().includes(q)
    );
  };

  const filteredAvailableBids = useMemo(
    () => leftBids.filter((b) => bidMatchesSearch(b, searchAvailable)),
    [leftBids, searchAvailable]
  );

  const filteredChosenBids = useMemo(
    () => rightBids.filter((b) => bidMatchesSearch(b, searchChosen)),
    [rightBids, searchChosen]
  );

  const leftIds = leftBids.map((b) => getBidId(b));
  const rightIds = rightBids.map((b) => getBidId(b));

  const leftChecked = intersection(checkedBidIds, leftIds);
  const rightChecked = intersection(checkedBidIds, rightIds);

  const handleToggleBid = (id) => () => {
    const bid = allBids.find((item) => getBidId(item) === id);
    if (bid?.conflictsSchedule && !selectedBidIds.includes(id)) return;
    setCheckedBidIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleCheckedRight = () => {
    if (!leftChecked.length) return;

    const merged = [...selectedBidIds, ...leftChecked];
    const unique = Array.from(new Set(merged));
    const capped = unique.slice(0, maxBartendersNeeded);

    setSelectedBidIds(capped);
    setCheckedBidIds((prev) => not(prev, leftChecked));
  };

  const handleCheckedLeft = () => {
    if (!rightChecked.length) return;

    setSelectedBidIds((prev) => not(prev, rightChecked));
    setCheckedBidIds((prev) => not(prev, rightChecked));
  };

  const getAssignmentId = (a) =>
    String(a._id || a.id || a.bartenderUser?._id || "");

  // simple search by name/email/phone
  const assignmentMatchesSearch = (a, term) => {
    if (!term) return true;
    const v = term.toLowerCase();
    const u = a.bartenderUser || {};
    const fields = [
      u.fullName,
      u.email,
      u.phone,
      a.reason, // previous reason (if any)
    ]
      .filter(Boolean)
      .map(String);

    return fields.some((f) => f.toLowerCase().includes(v));
  };

  const filteredAssignments = useMemo(
    () =>
      allAssignments.filter((a) => assignmentMatchesSearch(a, searchAssigned)),
    [allAssignments, searchAssigned]
  );

  const allAssignedChecked =
    filteredAssignments.length > 0 &&
    filteredAssignments.every((a) => isAssignmentChecked(a));

  const someAssignedChecked =
    filteredAssignments.length > 0 &&
    !allAssignedChecked &&
    filteredAssignments.some((a) => isAssignmentChecked(a));

  const toggleHeaderAssignedCheckbox = () => {
    setCheckedAssignments((prev) => {
      const allVisibleChecked = filteredAssignments.every((a) =>
        prev.some((x) => x._id === a._id)
      );

      if (allVisibleChecked) {
        // unselect all visible assignments
        return prev.filter(
          (x) => !filteredAssignments.some((a) => a._id === x._id)
        );
      }

      // select all visible assignments
      const map = new Map(prev.map((x) => [x._id, x]));
      filteredAssignments.forEach((a) => {
        map.set(a._id, a);
      });
      return Array.from(map.values());
    });
  };

  const toggleAssignedRow = (assignment) => () => {
    setCheckedAssignments((prev) => {
      const exists = prev.some((x) => x._id === assignment._id);

      return exists
        ? prev.filter((x) => x._id !== assignment._id)
        : [...prev, assignment];
    });
  };

  const canAssignBartenders = selectedBidIds.length > 0;

  //console.log('selectedBidIds: ', selectedBidIds);

  const customBidList = (title, items, side) => {
    const isAvailableSide = side === "available";

    const searchValue = isAvailableSide ? searchAvailable : searchChosen;
    const onSearchChange = isAvailableSide
      ? setSearchAvailable
      : setSearchChosen;

    const idsInThisList = items
      .filter((bid) => !isAvailableSide || !bid.conflictsSchedule)
      .map((bid) => getBidId(bid));

    const checkedInThisList = idsInThisList.filter((id) =>
      checkedBidIds.includes(id)
    );

    const allChecked =
      idsInThisList.length > 0 &&
      checkedInThisList.length === idsInThisList.length;
    const someChecked =
      checkedInThisList.length > 0 &&
      checkedInThisList.length < idsInThisList.length;

    const handleHeaderCheckbox = () => {
      setCheckedBidIds((prev) => {
        if (allChecked) {
          // Unselect everything in this list
          return prev.filter((id) => !idsInThisList.includes(id));
        }
        // Select everything in this list
        const set = new Set(prev);
        idsInThisList.forEach((id) => set.add(id));
        return Array.from(set);
      });
    };

    return (
      <Paper
        sx={{ width: 320, height: 360, overflow: "hidden" }}
        variant="outlined"
      >
        {/* 🔹 Header like the screenshot */}
        <Box
          sx={{
            p: 1.5,
            borderBottom: "1px solid",
            borderColor: "divider",
            bgcolor: "background.paper",
          }}
        >
          <Stack direction="row" alignItems="center">
            <Checkbox
              checked={allChecked}
              indeterminate={someChecked}
              onChange={handleHeaderCheckbox}
            />

            <Box>
              <Typography variant="subtitle2">{title}</Typography>
              <Typography variant="caption" color="text.secondary">
                {checkedInThisList.length}/{items.length} selected
              </Typography>
            </Box>
          </Stack>

          {/* Search input under the header text */}
          <TextField
            size="small"
            placeholder="Search name, email, notes…"
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            fullWidth
            sx={{ mt: 1 }}
          />
        </Box>

        {/* 🔹 Scrollable list body */}
        <Box sx={{ p: 1, height: "calc(360px - 80px)", overflowY: "auto" }}>
          {items.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No bartenders in this list.
            </Typography>
          ) : (
            items.map((bid) => {
              const id = getBidId(bid);
              const isChecked = checkedBidIds.includes(id);
              const hasConflict =
                isAvailableSide && !!bid.conflictsSchedule;

              const bartender =
                bid.bartenderUser ||
                bid.bartender ||
                bid.user ||
                bid.owner ||
                {};

              const bartenderName =
                bartender.fullName ||
                bartender.fullname ||
                bartender.name ||
                bartender.displayName ||
                "Unnamed bartender";

              const email =
                bartender.email ||
                bartender.contactEmail ||
                bartender.loginEmail ||
                "";

              const avatarSrc =
                bartender.profile?.photo ||
                bartender.profile?.photoUrl ||
                bartender.avatarUrl ||
                bartender.photoUrl ||
                bartender.image ||
                "";

              const totalAssignedEvents =
                bartender.bartenderProfile?.stats?.totalAssignedEvents ?? 0;

              const avgRating =
                bartender.bartenderProfile?.reviewSummary?.avgRating ?? null;

              const rate =
                bid.hourlyRate != null
                  ? `$${Number(bid.hourlyRate).toFixed(2)}/hr`
                  : null;

              const submittedAt = bid.submittedAt
                ? moment(bid.submittedAt).format("MMM D, YYYY • h:mm a")
                : null;

              const notes =
                bid.notes && String(bid.notes).length > 120
                  ? `${String(bid.notes).slice(0, 120)}…`
                  : bid.notes || "";

              return (
                <Box key={id} sx={{ mb: 1 }}>
                  <Paper
                    variant="outlined"
                    onClick={() => !hasConflict && handleToggleBid(id)()}
                    sx={{
                      p: 1.25,
                      borderRadius: 1.5,
                      cursor: hasConflict ? "not-allowed" : "pointer",
                      opacity: hasConflict ? 0.72 : 1,
                      borderColor: isChecked
                        ? "var(--primary-color)"
                        : "divider",
                      boxShadow: isChecked ? 1 : 0,
                      "&:hover": {
                        borderColor: "var(--primary-color)",
                        boxShadow: 1,
                        backgroundColor: "rgba(0,0,0,0.02)",
                      },
                    }}
                  >
                    <Stack direction="row" alignItems="flex-start">
                      {/* ✅ Checkbox on the far left, clickable */}
                      <Checkbox
                        edge="start"
                        checked={isChecked}
                        disabled={hasConflict}
                        tabIndex={-1}
                        disableRipple
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!hasConflict) handleToggleBid(id)();
                        }}
                        sx={{ mt: 0.5 }}
                      />

                      <Avatar
                        src={avatarSrc}
                        sx={{ width: 40, height: 40, flexShrink: 0 }}
                      >
                        {bartenderName?.[0]?.toUpperCase?.() || "?"}
                      </Avatar>

                      <Box sx={{ flexGrow: 1 }}>
                        <Typography variant="subtitle2">
                          {bartenderName}
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

                        {hasConflict && (
                          <Typography
                            variant="caption"
                            color="error"
                            display="block"
                            sx={{ mt: 0.5, fontWeight: 600 }}
                          >
                            Schedule conflict
                            {bid.conflictEvents?.length
                              ? `: ${bid.conflictEvents.join(", ")}`
                              : " — unavailable for this event time"}
                          </Typography>
                        )}

                        <Stack
                          direction="row"
                          spacing={1}
                          flexWrap="wrap"
                          sx={{ mt: 0.5 }}
                        >
                          {rate && (
                            <Typography
                              variant="caption"
                              sx={{
                                px: 0.75,
                                py: 0.25,
                                borderRadius: 999,
                                border: "1px solid",
                                borderColor: "divider",
                              }}
                            >
                              {rate}
                            </Typography>
                          )}

                          <Typography
                            variant="caption"
                            sx={{
                              px: 0.75,
                              py: 0.25,
                              borderRadius: 999,
                              border: "1px solid",
                              borderColor: "divider",
                            }}
                          >
                            Assigned: {totalAssignedEvents}
                          </Typography>

                          {avgRating != null && (
                            <Typography
                              variant="caption"
                              sx={{
                                px: 0.75,
                                py: 0.25,
                                borderRadius: 999,
                                border: "1px solid",
                                borderColor: "divider",
                              }}
                            >
                              Rating: {avgRating.toFixed(1)}/5
                            </Typography>
                          )}
                        </Stack>

                        {notes && (
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{ mt: 0.75 }}
                          >
                            {notes}
                          </Typography>
                        )}

                        {submittedAt && (
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ mt: 0.5, display: "block" }}
                          >
                            Submitted: {submittedAt}
                          </Typography>
                        )}
                      </Box>
                    </Stack>
                  </Paper>
                </Box>
              );
            })
          )}
        </Box>
      </Paper>
    );
  };

  // —— Pricing inputs (Cost & Details) ——
  const [calcInput, setCalcInput] = useState(() => {
    const p = event?.pricing || {};
    const asPct = (v, fallback) => {
      if (v == null) return fallback;
      const n = Number(v) || 0;
      // Round to avoid float junk like 7.000000000000001
      return Math.round(n * 100 * 1000) / 1000; // up to 3 decimal places, or:
      // return Math.round(n * 100); // if you only want whole %s
    };

    return {
      ...emptyCalc,
      hourlyRate: p.hourlyRate ?? emptyCalc.hourlyRate,
      gratuityPct: asPct(p.gratuityPct, emptyCalc.gratuityPct),
      bookingFee: p.bookingFee ?? emptyCalc.bookingFee,
      procurementFee: p.procurementServiceFee ?? emptyCalc.procurementFee,
      // we don't actually use p.rushPct directly in the UI, rush is handled via rushMode/rushPctManual
      holidayFee: p.holidayFee ?? emptyCalc.holidayFee,
      publicFee: p.publicFee ?? emptyCalc.publicFee,
      setupHours: p.setupHours ?? emptyCalc.setupHours,
      breakdownHours: p.breakdownHours ?? emptyCalc.breakdownHours,
      taxPct: asPct(p.taxPct, emptyCalc.taxPct),
      rushMode: (p.rushPct ?? 0) > 0 ? "manual" : "auto",
      rushPctManual: asPct(p.rushPct, 0),
    };
  });

  // Local inputs for new line
  const [newItem, setNewItem] = useState({ name: "", qty: "" });
  const receiptInputRef = useRef(null);
  const [receiptUploading, setReceiptUploading] = useState(false);
  const [receiptDragActive, setReceiptDragActive] = useState(false);

  const addProcureItem = () => {
    const name = (newItem.name || "").trim();
    const qty = Math.max(1, Number(newItem.qty) || 1);
    if (!name) return;
    setForm((f) => ({
      ...f,
      procurementItems: [
        ...(f.procurementItems || []),
        { name, qty, pickedUp: false },
      ],
    }));
    setNewItem({ name: "", qty: "" });
  };

  const updateProcureItem = (index, patch) => {
    setForm((f) => {
      const arr = [...(f.procurementItems || [])];
      const curr = arr[index] || {};
      arr[index] = {
        ...curr,
        ...patch,
        qty:
          patch.qty !== undefined
            ? Math.max(1, Number(patch.qty) || 1)
            : curr.qty,
      };
      return { ...f, procurementItems: arr };
    });
  };

  const removeProcureItem = (index) => {
    setForm((f) => {
      const arr = [...(f.procurementItems || [])];
      arr.splice(index, 1);
      return { ...f, procurementItems: arr };
    });
  };

  const uploadProcurementReceipt = async (file) => {
    if (!file || receiptUploading || !event?._id) return;
    if (!String(file.type || "").startsWith("image/")) {
      setAlertType("error");
      setAlertMsg("Choose a JPG, PNG, GIF, or WebP receipt image.");
      setAlertOpen(true);
      return;
    }
    if (file.size > MAX_IMAGE_SIZE_MB * 1024 * 1024) {
      setAlertType("error");
      setAlertMsg(`The receipt image must be ${MAX_IMAGE_SIZE_MB} MB or smaller.`);
      setAlertOpen(true);
      return;
    }

    setReceiptUploading(true);
    try {
      const formData = new FormData();
      formData.append("photo", file);
      const res = await api.post(
        `/events/${event._id}/procurement-receipt`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );
      const receiptUrl = res.data?.data?.receiptUrl || "";
      const receiptPublicId = res.data?.data?.receiptPublicId || "";
      setForm((f) => ({
        ...f,
        procurementRequested: true,
        procurementReceiptProof: receiptUrl,
        procurementReceiptPublicId: receiptPublicId,
      }));
      setAlertType("success");
      setAlertMsg("Receipt uploaded.");
      setAlertOpen(true);
      onSaved?.(res.data?.data?.event || event);
    } catch (err) {
      setAlertType("error");
      setAlertMsg(
        err?.response?.data?.message || err.message || "Receipt upload failed"
      );
      setAlertOpen(true);
    } finally {
      setReceiptUploading(false);
      setReceiptDragActive(false);
      if (receiptInputRef.current) receiptInputRef.current.value = "";
    }
  };

  const [couponCode, setCouponCode] = useState("");
  const [coupons, setCoupons] = useState(() => emptyCoupons);
  const [promoCatalog, setPromoCatalog] = useState([]);

  // —— Pricing override ——
  const [overrideEnabled, setOverrideEnabled] = useState(false);
  const [overrideDialogOpen, setOverrideDialogOpen] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const [overrideNote, setOverrideNote] = useState("");
  const isValidOverride =
    overrideReason &&
    (overrideReason !== "other" || overrideNote.trim().length >= 5);

  const [overrideAmount, setOverrideAmount] = useState("0"); // dollars, string for TextField

  // —— Cancel event ——
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelOtherReason, setCancelOtherReason] = useState("");

  // —— Payment step ——
  // derive duration hours
  const durationHours = useMemo(() => {
    if (!form.startAt || !form.endAt) return 0;
    const s = new Date(form.startAt);
    const e = new Date(form.endAt);
    const mins = Math.max(0, (e - s) / 60000);
    return +(mins / 60).toFixed(2);
  }, [form.startAt, form.endAt]);

  const procurementGuide = useMemo(
    () =>
      buildProcurementGuide({
        guestCount: form.guestCount,
        durationHours,
        barType: form.barType,
      }),
    [durationHours, form.barType, form.guestCount]
  );
  const eventWorkflowStatus = String(form.status || event?.status || "").toLowerCase();
  const procurementFulfillmentStatuses = [
    "ready_to_assign",
    "bidding",
    "selecting",
    "confirmed",
    "completed",
  ];
  const canFulfillProcurement =
    procurementFulfillmentStatuses.includes(eventWorkflowStatus);
  const hasProcurementItems = (form.procurementItems || []).length > 0;

  // Recommended bartenders (simple heuristic)
  useEffect(() => {
    const guests = Number(form.guestCount) || 0;
    const rec = recommendBartenders(guests);
    setForm((current) => ({
      ...current,
      recommendedBartenders: rec || 1,
      ...(!bartendersTouched && !getRequiredBartenderCount(event)
        ? { bartendersRequested: rec || 1 }
        : {}),
    }));
  }, [
    event?.counts?.neededBartenders,
    event?.pricing?.bartendersRequested,
    form.guestCount,
    bartendersTouched,
  ]);

  useEffect(() => {
    if (!manageBartendersOpen) return;

    const preselectedIds = allBids
      .filter((b) => String(b.status).toLowerCase() === "selected")
      .map((b) => getBidId(b));

    setSelectedBidIds(preselectedIds);
    // optional: also clear checked state when opening
    setCheckedBidIds([]);
  }, [manageBartendersOpen, allBids]);

  // derive auto rush (decimal + whole)
  const autoRush = useMemo(() => {
    const out = computeAutoRush(event, form.startAt);
    return {
      pctDecimal: out.pct,
      pctPercent: Math.round(out.pct * 100),
      label: out.label,
      reason: out.reason,
    };
  }, [event, form.startAt]);

  // ---------- PRICING MATH (ALL IN CENTS) ----------
  const hoursTotal =
    toNumber(durationHours) +
    toNumber(calcInput.setupHours) +
    toNumber(calcInput.breakdownHours);
  const bartenders = Math.max(1, toNumber(form.bartendersRequested));

  // $ inputs -> cents once
  const hourlyRateC = toCents(calcInput.hourlyRate);
  const bookingFeeC = toCents(calcInput.bookingFee);
  const procurementBaseC = toCents(calcInput.procurementFee);
  const procurementActualC = toCents(form.procurementActualCost);
  const privateAdderC = form.private ? 0 : toCents(150);
  const publicFeeC = toCents(calcInput.publicFee) + privateAdderC;

  // line items (cents)
  const laborC = Math.round(hourlyRateC * hoursTotal * bartenders);
  const bookingC = bookingFeeC;

  // +$50 if client asked us to pickup items
  const procurementAdderC = form.procurementRequested ? toCents(50) : 0;
  const procurementC = procurementBaseC + procurementAdderC;
  const publicC = publicFeeC;

  // Inside your pricing math:
  const holidayInfo = getHolidayInfo(form.startAt, form.endAt);
  const holidayFeeC = toCents(holidayInfo.maxFee || 0);

  // flat subtotal (cents)
  const flatSubtotalC =
    laborC + bookingC + procurementC + publicC + holidayFeeC;

  // rush % (manual or auto)
  const rushPctWhole =
    calcInput.rushMode === "manual"
      ? Math.max(0, toNumber(calcInput.rushPctManual))
      : Math.round(toNumber(autoRush.pctDecimal) * 100);

  // percentage adders (cents)
  const gratuityC = pctOfCents(flatSubtotalC, calcInput.gratuityPct);
  const rushC = pctOfCents(flatSubtotalC, rushPctWhole);
  const taxC = pctOfCents(flatSubtotalC, calcInput.taxPct);

  // totals (cents)
  const percentSubtotalC = gratuityC + rushC + taxC;
  const preDiscountTotalC = flatSubtotalC + percentSubtotalC;

  // apply coupons in cents
  let runningC = preDiscountTotalC;
  const appliedCoupons = [];
  coupons.forEach((c) => {
    const type = String(c.type || "").toUpperCase();
    const val = toNumber(c.value);
    let deltaC = 0;
    if (type === "PERCENT_TOTAL") {
      const percent = val <= 1 ? val * 100 : val;
      deltaC = Math.round(runningC * (percent / 100));
    }
    if (type === "FIXED_TOTAL" || type === "AMOUNT_TOTAL") deltaC = toCents(val);
    if (deltaC > 0) {
      runningC = Math.max(0, runningC - deltaC);
      appliedCoupons.push({
        code: c.code,
        type,
        value: c.value,
        amountOffTotalC: deltaC,
      });
    }
  });
  const grandTotalC = runningC + procurementActualC;

  // deposit (cents)
  // hours until event
  const soonHours = form.startAt
    ? (new Date(form.startAt) - new Date()) / 36e5
    : Infinity;

  let depositPct;

  // ≤ 7 days (168 hours): FULL payment required
  if (soonHours <= 168) {
    depositPct = 1.0;
  }
  // > 7 days: standard deposit
  else {
    depositPct = 0.3;
  }

  const minDepositC = Math.round(grandTotalC * depositPct);

  // readable dollars for UI outside Step 3
  const computedTotal = fromCents(grandTotalC);

  // Preserve any discount/override already embedded in the confirmed payment
  // snapshot while previewing the price delta from unsaved form edits. This is
  // the same rule used by the backend when the event is saved.
  const savedComputedTotal =
    Number(buildSnapshotFromEvent(event)?.totals?.totalC || 0) / 100;
  const savedBilledTotal = Number(event?.payment?.total) || 0;
  const billingAdjustment =
    savedBilledTotal > 0 ? savedBilledTotal - savedComputedTotal : 0;

  // If override is enabled, the "discountedTotal" becomes the override
  const discountedTotal = overrideEnabled
    ? Number(overrideAmount) || 0
    : Math.max(0, computedTotal + billingAdjustment);

  // deposit (reuses your timing rule), now based on possibly-overridden total
  const depositDue =
    fromCents(minDepositC).toString() && overrideEnabled
      ? soonHours <= 168
        ? (Number(overrideAmount) || 0) * 0.75
        : (Number(overrideAmount) || 0) * 0.3
      : fromCents(minDepositC);

  const [paymentProvider, setPaymentProvider] = useState("paypal");
  const [paymentType, setPaymentType] = useState("deposit");
  const [paymentRequest, setPaymentRequest] = useState(null);
  const [paymentRequests, setPaymentRequests] = useState([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [customPaymentAmount, setCustomPaymentAmount] = useState("");

  const [collectPaymentOpen, setCollectPaymentOpen] = useState(false);
  const [paymentActionOpen, setPaymentActionOpen] = useState(false);
  const [paymentActionType, setPaymentActionType] = useState("");
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [paymentActionReason, setPaymentActionReason] = useState("");
  const [paymentActionSaving, setPaymentActionSaving] = useState(false);
  const [arrangementNotes, setArrangementNotes] = useState(
    event?.payment?.arrangementNotes || ""
  );
  const [policySaving, setPolicySaving] = useState(false);
  const [payments, setPayments] = useState(event?.payments || []);
  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    method: paymentProvider || "paypal",
    reference: "",
    receivedAt: new Date().toISOString().slice(0, 10),
    notes: "",
  });

  const activePayments = payments.filter(
    (payment) =>
      !["voided", "refunded"].includes(
        String(payment.status || "recorded").toLowerCase()
      )
  );
  const eventSummaryPaidTotal =
    Number(event?.payment?.paidTotal) ||
    Number(event?.recordedPaidTotal) ||
    Number(event?.paidTotal) ||
    0;

  const recordedAmountPaid = activePayments.reduce(
    (sum, p) => sum + (Number(p.amount) || 0),
    0
  );
  const amountPaid = activePayments.length
    ? recordedAmountPaid
    : eventSummaryPaidTotal;

  const remainingBalance = Math.max(discountedTotal - amountPaid, 0);
  const overpaymentCredit = Math.max(amountPaid - discountedTotal, 0);
  const paymentAmountReceived = Number(paymentForm.amount) || 0;
  const collectPaymentAmountInvalid =
    paymentAmountReceived <= 0 || paymentAmountReceived > remainingBalance;

  const paymentStatus =
    amountPaid <= 0
      ? "Pending"
      : overpaymentCredit > 0
      ? "Overpaid / Credit"
      : remainingBalance <= 0
      ? "Paid in Full"
      : "Partially Paid";

  const paymentChipColor =
    paymentStatus === "Paid in Full" || paymentStatus === "Overpaid / Credit"
      ? "success"
      : paymentStatus === "Partially Paid"
      ? "warning"
      : "default";
  const paymentPolicy = getEventPaymentPolicyView(
    { ...event, startAt: form.startAt || event?.startAt },
    { total: discountedTotal, paid: amountPaid }
  );

  const resolvePaymentPolicy = async (action) => {
    setPolicySaving(true);
    try {
      const res = await api.post(`/events/${eventId}/payment-policy/resolve`, {
        action,
        notes: arrangementNotes,
      });
      const updatedEvent = res.data?.data;
      if (updatedEvent) onSaved?.(updatedEvent);
      setAlertSeverity("success");
      setAlertMsg(
        action === "approve_arrangement"
          ? "Payment arrangement approved and documented."
          : "Payment arrangement removed."
      );
      setAlertOpen(true);
    } catch (error) {
      setAlertSeverity("error");
      setAlertMsg(error?.response?.data?.message || "Could not update the payment policy.");
      setAlertOpen(true);
    } finally {
      setPolicySaving(false);
    }
  };

  const isCustomPayment = paymentType === "custom";
  const maxRequestAmount = remainingBalance;
  const depositRequestAmount = Math.min(depositDue, maxRequestAmount);

  const requestedAmount =
    paymentType === "full"
      ? maxRequestAmount
      : paymentType === "deposit"
      ? depositRequestAmount
      : Number(customPaymentAmount || 0);

  const paymentAmountInvalid =
    Number.isNaN(requestedAmount) ||
    requestedAmount <= 0 ||
    requestedAmount > maxRequestAmount;

  const paymentRequestInvalid = paymentAmountInvalid;
  const paymentRequestHelperText = paymentRequestInvalid
    ? maxRequestAmount <= 0
      ? "There is no remaining balance to invoice."
      : `Enter an amount greater than $0 and no more than ${fmtMoney(
          maxRequestAmount
        )}.`
    : "Ready to send.";

  useEffect(() => {
    if (!event?._id) return;

    let ignore = false;

    const loadPaymentActivity = async () => {
      try {
        setPaymentsLoading(true);
        const [requestRes, paymentRes] = await Promise.all([
          api.get(`/payment-requests/event/${event._id}`),
          api.get(`/payments/event/${event._id}`),
        ]);

        if (ignore) return;

        const existingRequests = requestRes.data?.data || [];
        const existingPayments = paymentRes.data?.data || [];
        const summaryPaidTotal =
          Number(event?.payment?.paidTotal) ||
          Number(event?.recordedPaidTotal) ||
          Number(event?.paidTotal) ||
          0;
        const displayPayments =
          existingPayments.length || summaryPaidTotal <= 0
            ? existingPayments
            : [
                {
                  _id: `summary-${event._id}`,
                  amount: summaryPaidTotal,
                  method: event?.payment?.processor || "recorded",
                  status: "recorded",
                  receivedAt: event?.updatedAt || event?.createdAt,
                  notes:
                    "Payment total from event summary. Refresh after backend restart to see individual records.",
                },
              ];

        setPaymentRequests(existingRequests);
        setPayments(displayPayments);

        const collectableRequest = existingRequests.find(
          (request) =>
            !["cancelled", "expired", "completed"].includes(
              String(request.status || "").toLowerCase()
            )
        );

        if (collectableRequest) {
          setPaymentRequest(collectableRequest);
          setPaymentProvider(collectableRequest.provider || "paypal");
          setPaymentType(collectableRequest.paymentType || "deposit");
          if (collectableRequest.paymentType === "custom") {
            setCustomPaymentAmount(
              String(collectableRequest.amountRequested || "")
            );
          }
        }
      } catch (err) {
        if (!ignore) {
          setAlertType("error");
          setAlertMsg(
            err?.response?.data?.message ||
              "Failed to load payment activity for this event."
          );
          setAlertOpen(true);
        }
      } finally {
        if (!ignore) setPaymentsLoading(false);
      }
    };

    loadPaymentActivity();

    return () => {
      ignore = true;
    };
  }, [
    event?._id,
    event?.createdAt,
    event?.paidTotal,
    event?.payment?.paidTotal,
    event?.payment?.processor,
    event?.recordedPaidTotal,
    event?.updatedAt,
  ]);

  useEffect(() => {
    let ignore = false;

    const loadPromoCatalog = async () => {
      try {
        const res = await api.get("/promo-codes");
        if (!ignore) setPromoCatalog(res.data?.data || res.data || []);
      } catch (err) {
        if (!ignore) setPromoCatalog([]);
      }
    };

    loadPromoCatalog();

    return () => {
      ignore = true;
    };
  }, []);

  // form setter by path
  const setField = (path, val) =>
    setForm((f) => {
      const next = { ...f };
      const parts = path.split(".");
      let ref = next;
      for (let i = 0; i < parts.length - 1; i++) {
        ref[parts[i]] = { ...(ref[parts[i]] || {}) };
        ref = ref[parts[i]];
      }
      ref[parts[parts.length - 1]] = val;
      return next;
    });

  const updateEventDateTextPart = (field) => (e) => {
    const value = formatDateInput(e.target.value);
    setDateInputs((current) => ({ ...current, [field]: value }));

    const parts = parseDateOnlyParts(value);
    if (!parts) return;

    const datePart = datePartsToDatePart(parts);
    const timePart =
      parseTimeInput(timeInputs[field]) ||
      (field === "startAt" ? "17:00" : "21:00");
    const isoValue = zonedLocalDateTimeToIso(datePart, timePart, form.timezone);
    if (!isoValue) return;
    setField(field, isoValue);
  };

  const updateEventTimePart = (field) => (e) => {
    const displayValue = formatTimeInput(e.target.value);
    setTimeInputs((current) => ({ ...current, [field]: displayValue }));
    const timePart = parseTimeInput(displayValue);
    if (!timePart) return;
    const dateParts = parseDateOnlyParts(dateInputs[field]);
    const datePart = datePartsToDatePart(dateParts);
    const isoValue = zonedLocalDateTimeToIso(datePart, timePart, form.timezone);
    if (!isoValue) return;
    setField(field, isoValue);
  };

  const normalizeEventTimePart = (field) => () => {
    const parsed = parseTimeInput(timeInputs[field]);
    if (!parsed) return;
    setTimeInputs((current) => ({
      ...current,
      [field]: timeValueToInput(parsed),
    }));
  };

  const onBartendersChange = (val) => {
    setBartendersTouched(true);
    setField("bartendersRequested", Math.max(1, Number(val) || 1));
  };
  const applyRecommended = () => {
    const rec = recommendBartenders(form.guestCount);
    setBartendersTouched(false);
    setForm((current) => ({
      ...current,
      bartendersRequested: rec || 1,
      recommendedBartenders: rec || 1,
      staffingExceptionReason: "",
    }));
  };

  // Returns true if we have a usable location
  const hasLocation = useCallback((loc = {}) => {
    if (!loc || typeof loc !== "object") return false;
    if ((loc.formattedAddress && loc.formattedAddress.trim()) || loc.placeId) {
      return true;
    }
    const a1 = (loc.address1 || "").trim();
    const city = (loc.city || "").trim();
    const country = (loc.country || "").trim();
    if (a1 && city && country) return true;
    return false;
  }, []);

  // Lightweight email validator (RFC5322-lite, good for UI)
  const isEmail = (s = "") =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s).trim());

  const hasRequiredLocation = useCallback(
    (loc = {}) => {
      if (!hasLocation(loc)) return false;
      return Boolean(
        String(
          loc.address1 || loc.formattedAddress || loc.formatted || ""
        ).trim() &&
          String(loc.city || "").trim() &&
          String(loc.state || "").trim() &&
          String(loc.zipcode || "").trim() &&
          String(loc.country || "").trim()
      );
    },
    [hasLocation]
  );

  const stepBlockers = useMemo(() => {
    const confirm = [];
    if (!form.type) confirm.push("Select an event type");
    if (!form.startAt) confirm.push("Pick a start date/time");
    if (!form.endAt) confirm.push("Pick an end date/time");
    if (!parseTimeInput(timeInputs.startAt)) confirm.push("Enter a valid arrival time");
    if (!parseTimeInput(timeInputs.endAt)) confirm.push("Enter a valid leaving time");
    if (
      form.startAt &&
      form.endAt &&
      new Date(form.endAt) <= new Date(form.startAt)
    ) {
      confirm.push("End time must be after start time");
    }
    if (!hasRequiredLocation(form.location)) {
      confirm.push("Provide address, city, state, ZIP, and country");
    }
    if (!form.contact?.fullName?.trim())
      confirm.push("Enter contact full name");
    if (!isEmail(form.contact?.email))
      confirm.push("Enter a valid contact email");
    if (!String(form.contact?.phone || "").trim())
      confirm.push("Enter contact phone");
    if (!form.contact?.preferred)
      confirm.push("Select preferred contact method");

    const questions = [];
    if (!(Number(form.guestCount) > 0))
      questions.push("Enter estimated guests");
    if (!(Number(form.bartendersRequested) >= 1)) {
      questions.push("Set bartenders needed");
    }
    if (
      Number(form.bartendersRequested) < Number(form.recommendedBartenders) &&
      !String(form.staffingExceptionReason || "").trim()
    ) {
      questions.push("Explain the approved staffing exception");
    }
    if (!form.barType || form.barType === "unknown") {
      questions.push("Select type of bar");
    }
    if (typeof form.procurementRequested !== "boolean") {
      questions.push("Answer whether procurement is needed");
    }
    if (typeof form.allowTipJars !== "boolean") {
      questions.push("Answer whether tip jars are allowed");
    }

    const cost = [];
    if (!(discountedTotal > 0))
      cost.push("Total amount must be greater than $0");

    const payment = [];
    if (!activePayments.length) payment.push("Record at least one payment");

    return {
      0: confirm,
      1: questions,
      2: cost,
      3: payment,
      4: [],
    };
  }, [
    activePayments.length,
    discountedTotal,
    form.allowTipJars,
    form.barType,
    form.bartendersRequested,
    form.recommendedBartenders,
    form.staffingExceptionReason,
    form.contact?.email,
    form.contact?.fullName,
    form.contact?.phone,
    form.contact?.preferred,
    form.endAt,
    form.guestCount,
    form.location,
    form.procurementRequested,
    form.startAt,
    form.type,
    hasRequiredLocation,
    timeInputs.endAt,
    timeInputs.startAt,
  ]);

  const stepReady = useMemo(
    () =>
      steps.map((_, index) => {
        if (index === 4) return true;
        return (stepBlockers[index] || []).length === 0;
      }),
    [stepBlockers]
  );

  const isStepUnlocked = useCallback(
    (index) => {
      if (index <= 0) return true;
      return stepReady.slice(0, index).every(Boolean);
    },
    [stepReady]
  );

  const currentStepBlockers = stepBlockers[active] || [];
  const canContinueToNextStep =
    active < steps.length - 1 && isStepUnlocked(active + 1);

  // What still blocks "Continue to Assign"?
  const assignBlockers = useMemo(() => {
    const errs = [];
    Object.values(stepBlockers).forEach((blockers) => errs.push(...blockers));
    return errs;
  }, [stepBlockers]);

  const canContinueToAssign =
    (assignBlockers.length === 0 && event.status === "submitted") ||
    event.status === "awaiting_response";

  // 🔗 Handler used by LocationInput
  const handleLocationChange = (patch) => {
    setForm((f) => {
      const loc = { ...(f.location || {}), ...patch };
      const formatted = loc.formattedAddress || formatLocationPretty(loc);
      return {
        ...f,
        location: {
          ...loc,
          formattedAddress: loc.formattedAddress || formatted,
        },
      };
    });
  };

  const normalizePromoCoupon = (promo) => {
    if (!promo?.code) return null;
    const promoType = String(promo.type || "").toUpperCase();
    const discountType = String(promo.discountType || "").toLowerCase();
    const isPercent = promoType === "PERCENT_TOTAL" || discountType === "percentage";
    const isFixed = promoType === "AMOUNT_TOTAL" || promoType === "FIXED_TOTAL" || discountType === "fixed";
    if (!isPercent && !isFixed) return null;

    const rawValue =
      promo.discountValue !== undefined && promo.discountValue !== null
        ? Number(promo.discountValue)
        : Number(promo.value);
    const value = isPercent && rawValue <= 1 ? rawValue * 100 : rawValue;

    return {
      code: String(promo.code).trim().toUpperCase(),
      type: isPercent ? "PERCENT_TOTAL" : "AMOUNT_TOTAL",
      value,
      minimumSubtotal: Number(promo.minimumSubtotal || promo.minSubtotal || 0),
      startsAt: promo.startsAt || promo.effectiveStartAt || null,
      expiresAt: promo.endsAt || promo.effectiveEndAt || promo.expiresAt || null,
      active: promo.active !== false && promo.disabled !== true,
      description: promo.description || "",
    };
  };

  const catalogCoupons = useMemo(
    () => (promoCatalog || []).map(normalizePromoCoupon).filter(Boolean),
    [promoCatalog]
  );

  // Fallback parser supports quick one-off codes like PCT:15 or FIXED:20.
  const toDateOrNull = (d) => {
    if (d == null) return null;
    if (d instanceof Date) return isNaN(+d) ? null : d;
    const parsed = new Date(d);
    return isNaN(+parsed) ? null : parsed;
  };

  const isCouponActiveNow = (c, now = new Date()) => {
    const start = toDateOrNull(c.startsAt);
    const end = toDateOrNull(c.expiresAt);
    // Inclusive boundaries: valid if now >= start and now <= end (when present)
    if (start && now < start) return { active: false, reason: "not_started" };
    if (end && now > end) return { active: false, reason: "expired" };
    return { active: true, reason: "ok" };
  };

  function lookupCoupon(rawCode = "") {
    const code = String(rawCode).trim().toUpperCase();
    if (!code) return null;

    const found = catalogCoupons.find((c) => c.code.toUpperCase() === code);
    if (found) return found;

    const pctMatch = code.match(/^PCT:(\d{1,3})$/);
    if (pctMatch) {
      const pct = Math.min(100, Math.max(0, Number(pctMatch[1])));
      return {
        code,
        type: "PERCENT_TOTAL",
        value: pct,
        startsAt: null,
        expiresAt: null,
      };
    }
    const fixedMatch = code.match(/^FIXED:(\d+(?:\.\d{1,2})?)$/);
    if (fixedMatch) {
      const dollars = Math.max(0, Number(fixedMatch[1]));
      return {
        code,
        type: "FIXED_TOTAL",
        value: dollars,
        startsAt: null,
        expiresAt: null,
      };
    }
    return null;
  }

  const addCoupon = () => {
    const code = String(couponCode || "").trim();
    if (!code) return;

    const c = lookupCoupon(code);
    if (!c) {
      setAlertType("error");
      setAlertMsg("Invalid code");
      setAlertOpen(true);
      return;
    }

    if (c.active === false) {
      setAlertType("error");
      setAlertMsg("This code is disabled.");
      setAlertOpen(true);
      return;
    }

    const { active, reason } = isCouponActiveNow(c);
    if (!active) {
      const msg =
        reason === "not_started"
          ? "This code is not active yet."
          : "This code has expired.";
      setAlertType("error");
      setAlertMsg(msg);
      setAlertOpen(true);
      return;
    }

    const minimumSubtotalC = toCents(c.minimumSubtotal || 0);
    if (minimumSubtotalC > preDiscountTotalC) {
      setAlertType("error");
      setAlertMsg(`This code requires a minimum event subtotal of ${fmtMoneyC(minimumSubtotalC)}.`);
      setAlertOpen(true);
      return;
    }

    setCoupons((arr) =>
      arr.some((x) => x.code?.toUpperCase() === c.code?.toUpperCase())
        ? arr
        : [...arr, c]
    );
    setCouponCode("");
    setAlertType("success");
    setAlertMsg(`Coupon ${c.code} applied.`);
    setAlertOpen(true);
  };

  const removeCoupon = (code) =>
    setCoupons((arr) => arr.filter((c) => c.code !== code));

  const scriptName = (user) => {
    const groupEmails = ["admin@tipsyverse.com", "support@tipsyverse.com"];
    return groupEmails.includes(user?.email) ? "{your name}" : user?.fullName;
  };

  // Step help dialog content
  const stepHelp = (stepIndex) => {
    switch (stepIndex) {
      case 0:
        return {
          title: "Confirm Information — Call Script",
          body: (
            <>
              <Typography fontWeight="bold">
                If someone else answers:
              </Typography>

              <p>
                Hi, this is <strong>{scriptName(loggedInUser)}</strong> from
                Tipsyverse. May I speak with{" "}
                <strong>{form.contact?.fullName || "the customer"}</strong>,
                please?
              </p>

              <p>
                <strong>If they ask what it's regarding:</strong>
              </p>

              <p>
                I'm calling regarding an event request that was recently
                submitted through Tipsyverse.
              </p>

              <Typography
                sx={{ color: "success.main", fontWeight: "bold", mb: 1 }}
              >
                This is the person speaking:
              </Typography>

              <p>
                Hi{" "}
                <strong>
                  {form.contact?.fullName.split(" ")[0] || "there"}
                </strong>{" "}
                Is now a good time to talk?
              </p>

              <Divider sx={{ my: 2 }} />

              <Typography
                sx={{ color: "success.main", fontWeight: "bold", mb: 1 }}
              >
                Customer is available
              </Typography>

              <p>
                Perfect! I just wanted to confirm the information you submitted,
                ask a few quick questions, and then prepare your final quote and
                staffing recommendations.
              </p>

              <p>
                I have your event down as a(n){" "}
                <strong>
                  {form.type === "other" ? "Other Event" : form.type || "—"}
                </strong>
                .
              </p>

              <p>
                You need us to arrive there on{" "}
                <strong>
                  {formatWhen(form.startAt, form.endAt, form.timezone) || "—"}
                </strong>
                .
              </p>

              <p>
                And it will be taking place at{" "}
                <strong>{formatLocationPretty(form.location) || "—"}</strong>.
              </p>

              <p>Is that correct?</p>

              <Divider sx={{ my: 2 }} />

              <Typography
                sx={{ color: "error.main", fontWeight: "bold", mb: 1 }}
              >
                Customer isn't available
              </Typography>

              <p>
                No problem at all! Is there a better time I can give{" "}
                <strong>{form.contact?.fullName || "them"}</strong> a call back?
                It should only take about 5–10 minutes.
              </p>

              <p>
                If it's easier, I can also send a text message or email with the
                questions so they can respond whenever it's convenient.
              </p>
            </>
          ),
        };
      case 1:
        return {
          title: "Questions — Finalizing Your Quote",
          body: (
            <>
              <p>
                Thanks again for choosing Tipsyverse! Before we can prepare your
                quote and confirm availability, I just have a few questions.
                These help us recommend the right staffing, supplies, and
                overall bar experience for your event.
              </p>

              <ol style={{ lineHeight: 1.8 }}>
                <li>
                  <strong>
                    Approximately how many guests do you expect to be at the
                    event?
                  </strong>
                  <br />
                </li>

                <li>
                  <strong>
                    What type of bar service are you looking for in this event?
                  </strong>
                  <br />
                  Would this be a full bar, cash bar, mocktail bar, beer & wine
                  only station?
                </li>

                <li>
                  <strong>
                    Would you like us to purchase any items for you?
                  </strong>
                  <br />
                  Like any alcohol, mixers, ice, garnishes, cups, etc.?
                </li>

                <li>
                  <strong>
                    Are bartenders allowed to accept tips or use tip jars in
                    this area?
                  </strong>
                </li>

                <li>
                  <strong>
                    Are there any special requests or important details we
                    should know?
                  </strong>
                  <br />
                  Like any Allergies or dietary concerns for certain people,
                  theme colors, dress codes, setup instructions, etc.?
                </li>

                <li>
                  <strong>
                    Is there another person we should communicate with about
                    this event?
                  </strong>
                  <br />
                  If so, can we have their name, phone number, and email
                  address?
                </li>
              </ol>
            </>
          ),
        };
      case 2:
        return {
          title: "Cost & Details — Talking Points",
          body: (
            <>
              <p>Thank you for the details. Based on what we discussed:</p>
              <ul style={{ marginTop: 0 }}>
                <li>
                  The total amount will be:{" "}
                  <strong>{fmtMoney(discountedTotal)}</strong>
                </li>
                <li>
                  With a minimum deposit of{" "}
                  <strong>{fmtMoney(depositDue)}</strong> to secure the date.
                </li>
                {Array.isArray(form.procurementItems) &&
                  form.procurementItems.length > 0 && (
                    <li>
                      That is not to include the items that we’ll pickup these
                      on your behalf. Those items will be billed later at cost.
                    </li>
                  )}
              </ul>
              <p>
                We can adjust if anything changes, and we’ll itemize the
                breakdown (labor, fees, and any discounts) in your confirmation.
              </p>
            </>
          ),
        };
      case 3:
        return {
          title: "Payment — Guidance",
          body: (
            <>
              <p>
                Based on everything we've discussed today, your total comes to{" "}
                <strong>{fmtMoney(discountedTotal)}</strong>.
              </p>

              {fmtMoney(discountedTotal) === fmtMoney(depositDue) ? (
                <>
                  <p>
                    Because of the timing of the event, the full balance is
                    required to secure your booking.
                  </p>
                </>
              ) : (
                <>
                  <p>
                    We do have a few payment options available depending on what
                    works best for you.
                  </p>

                  <ul style={{ marginTop: 0 }}>
                    <li>
                      Pay the <strong>full balance</strong> today (
                      <strong>{fmtMoney(discountedTotal)}</strong>).
                    </li>
                    <li>
                      Pay the required <strong>deposit</strong> today (
                      <strong>{fmtMoney(depositDue)}</strong>) and pay the
                      remaining balance before your event.
                    </li>
                    <li>
                      Pay a <strong>custom amount</strong>, as long as it meets
                      or exceeds the required minimum deposit.
                    </li>
                  </ul>
                </>
              )}

              <p>
                We accept several payment methods, including{" "}
                <strong>
                  PayPal, Venmo, Cash App, Square, and Zelle
                </strong>
                , depending on your preference.
              </p>

              <p>
                Once you decide how you'd like to pay, I'll send you a secure
                payment request. As soon as the payment is received, we'll
                reserve your date and move your event into the staffing process.
              </p>

              <p>
                Do you have a preference for which payment method you'd like to
                use?
              </p>
            </>
          ),
        };
      case 4:
        return {
          title: "Review — Final Check",
          body: (
            <>
              <p>Before we proceed to assignment, here’s a quick summary:</p>
              <ul style={{ marginTop: 0 }}>
                <li>
                  We have a(n) <strong>{form.type || "—"} event</strong>
                </li>
                <li>
                  on{" "}
                  <strong>
                    {formatWhen(form.startAt, form.endAt, form.timezone) || "—"}
                  </strong>
                </li>
                <li>
                  at{" "}
                  <strong>{formatLocationPretty(form.location) || "—"}.</strong>
                </li>
                <li>
                  We have <strong>{form.bartendersRequested || "—"}</strong>{" "}
                  bartender(s) • for{" "}
                  <strong>
                    {form.guestCount || "unknown number of"} guests
                  </strong>
                </li>
                {Array.isArray(form.procurementItems) &&
                  form.procurementItems.length > 0 && (
                    <>
                      <li>
                        Items to be procured:
                        <ul style={{ marginTop: 4 }}>
                          {form.procurementItems.map((it, i) => (
                            <li key={i}>
                              <strong>{Number(it.qty) || 1}</strong> ×{" "}
                              {String(it.name || "").trim() || "Unnamed item"}
                            </li>
                          ))}
                        </ul>
                      </li>
                      <li>
                        <em>Note:</em> These items will be billed separately
                        after purchase (at cost plus any applicable fees).
                      </li>
                    </>
                  )}
                <li>
                  Payment status: <strong>{paymentStatus}</strong>. Remaining
                  balance: <strong>{fmtMoney(remainingBalance)}</strong>.
                </li>
              </ul>
              <p>
                If everything looks good, I’ll move this forward to staffing.
              </p>
            </>
          ),
        };
      default:
        return { title: "Help", body: <p>No guidance for this step.</p> };
    }
  };

  const { title, body } = stepHelp(active);

  const buildEventPayload = useCallback(() => {
    const loc = form.location || {};
    const formatted = loc.formattedAddress || formatLocationPretty(loc);

    const lat = loc.latitude ?? loc.lat ?? null;
    const lng = loc.longitude ?? loc.lng ?? null;

    return {
      type: form.type,
      description: form.description,
      additionalInstructions: form.additionalInstructions,
      startAt: form.startAt,
      endAt: form.endAt,
      contact: form.contact,
      additionalContacts: (form.additionalContacts || []).map((c) => ({
        fullName: (c.fullName || "").trim(),
        email: (c.email || "").trim(),
        phone: (c.phone || "").trim(),
      })),
      timezone: form.timezone,
      location: {
        ...loc,
        formattedAddress: formatted,
        formatted,
        latitude: lat,
        longitude: lng,
        lat,
        lng,
      },
      options: {
        barType: form.barType || event?.options?.barType || "unknown",
        procurementRequested: !!form.procurementRequested,
        procurementItems: (form.procurementItems || []).map(
          ({ name, qty, pickedUp }) => ({
            name: String(name || "").trim(),
            qty: Number(qty) || 1,
            pickedUp: !!pickedUp,
          })
        ),
        procurementActualCost:
          form.procurementActualCost === "" ||
          form.procurementActualCost == null
            ? 0
            : Number(form.procurementActualCost) || 0,
        procurementReceiptProof: String(
          form.procurementReceiptProof || ""
        ).trim(),
        procurementReceiptPublicId: String(
          form.procurementReceiptPublicId || ""
        ).trim(),
        procurementReceiptNotes: String(
          form.procurementReceiptNotes || ""
        ).trim(),
        procurementBilledAt:
          Number(form.procurementActualCost) > 0
            ? event?.options?.procurementBilledAt || new Date().toISOString()
            : null,
        tipJarsAllowed: !!form.allowTipJars,
      },
      guestCount:
        form.guestCount === "" || form.guestCount == null
          ? undefined
          : Number(form.guestCount),
      preferredBartenders: event?.preferredBartenders || [],
      pricing: {
        hourlyRate: Number(calcInput.hourlyRate) || 0, // $ amount
        bookingFee: Number(calcInput.bookingFee) || 0, // $ amount
        procurementServiceFee: Number(calcInput.procurementFee) || 0,
        holidayFee: Number(calcInput.holidayFee) || 0, // ✅ $ amount (NOT pctToDecimal)
        publicFee: Number(calcInput.publicFee) || 0, // $ amount

        gratuityPct: pctToDecimal(calcInput.gratuityPct), // ✅ percent stored as decimal (0.18)
        rushPct: pctToDecimal(rushPctWhole), // ✅ decimal
        taxPct: pctToDecimal(calcInput.taxPct), // ✅ decimal

        setupHours: Number(calcInput.setupHours) || 0, // hours
        breakdownHours: Number(calcInput.breakdownHours) || 0,
        bartendersRequested: Number(form.bartendersRequested) || 1,
      },
      counts: {
        ...(event?.counts || {}),
        recommendedBartenders:
          Number(form.recommendedBartenders) ||
          recommendBartenders(form.guestCount) ||
          1,
        approvedBartenders: Number(form.bartendersRequested) || 1,
        neededBartenders: Number(form.bartendersRequested) || 1,
      },
      staffingException: {
        reason: String(form.staffingExceptionReason || "").trim(),
      },
      private: !!form.private,
      bartenderNotes: form.bartenderNotes,
      internalNotes: form.internalNotes,
      status: form.status,
    };
  }, [form, calcInput, event, rushPctWhole]);

  const saveEvent = useCallback(async () => {
    setSaving(true);
    try {
      const payload = buildEventPayload();

      if (event.status !== "submitted") {
        // 2) compute snapshots
        const oldSnap = buildSnapshotFromEvent(event);

        const newSnap = buildPricingSnapshot({
          form,
          calcInput,
          rushPctWholeEffective: rushPctWhole,
          event,
        });

        const d = diffSnapshots(oldSnap, newSnap);

        // 3) if pricing changed, ask first
        if (d.hasChanges) {
          setPricingDiff(d);
          setPendingPayload(payload);
          setConfirmPricingOpen(true);
          setSaving(false);
          return;
        }
      }

      const res = await api.patch(`/events/${event._id}`, payload);
      setAlertType("success");
      setAlertMsg("Saved.");
      setAlertOpen(true);
      onSaved?.(res.data?.data || event);
    } catch (e) {
      setAlertType("error");
      setAlertMsg(e?.response?.data?.message || e.message || "Save failed");
      setAlertOpen(true);
    } finally {
      setSaving(false);
    }
  }, [buildEventPayload, form, calcInput, event, onSaved, rushPctWhole]);

  const confirmSaveWithNewPricing = async () => {
    if (!pendingPayload) return;

    setConfirmPricingOpen(false);
    setSaving(true);
    try {
      const res = await api.patch(`/events/${event._id}`, pendingPayload);
      setAlertType("success");
      setAlertMsg("Saved with updated pricing.");
      setAlertOpen(true);
      onSaved?.(res.data?.data || event);
    } catch (e) {
      setAlertType("error");
      setAlertMsg(e?.response?.data?.message || e.message || "Save failed");
      setAlertOpen(true);
    } finally {
      setSaving(false);
      setPendingPayload(null);
      setPricingDiff(null);
    }
  };

  const cancelEvent = useCallback(async () => {
    // basic validation
    if (!cancelReason) {
      setAlertType("error");
      setAlertMsg("Please select a reason for canceling the event.");
      setAlertOpen(true);
      return;
    }
    if (cancelReason === "other" && !cancelOtherReason.trim()) {
      setAlertType("error");
      setAlertMsg("Please enter a custom reason for canceling the event.");
      setAlertOpen(true);
      return;
    }

    setSaving(true);
    try {
      const payload = {
        status: "canceled",
        cancelReason,
        cancelReasonOther:
          cancelReason === "other" ? cancelOtherReason.trim() : "",
      };

      // adjust endpoint if your backend uses a different route
      const res = await api.post(`/events/${event._id}/cancel`, payload);

      setAlertType("success");
      setAlertMsg("Event canceled.");
      setAlertOpen(true);

      // update local form status so UI reflects cancellation immediately
      setForm((f) => ({ ...f, status: "canceled" }));

      onSaved?.(res.data?.data || event);
      setCancelDialogOpen(false);
    } catch (e) {
      setAlertType("error");
      setAlertMsg(
        e?.response?.data?.message || e.message || "Failed to cancel event"
      );
      setAlertOpen(true);
    } finally {
      setSaving(false);
    }
  }, [cancelReason, cancelOtherReason, event, onSaved]);

  const submitPaymentAndAssign = async () => {
    setSaving(true);
    try {
      const payload = buildEventPayload();
      await api.patch(`/events/${event._id}`, payload);

      const res = await api.post(`/events/${event._id}/send-to-assign`, {
        couponCode: coupons[0]?.code,
      });

      const refreshedEvent = await dispatch(
        fetchEventById(event._id)
      ).unwrap();
      await dispatch(fetchBidsByEventId(event._id));

      setForm((current) => ({
        ...current,
        status: refreshedEvent.status || "ready_to_assign",
      }));

      setAlertType("success");
      setAlertMsg("Event moved to assignment.");
      setAlertOpen(true);
      onSaved?.(refreshedEvent || res.data?.data || event);
    } catch (e) {
      setAlertType("error");
      setAlertMsg(
        e?.response?.data?.message ||
          e.message ||
          "Failed to move to assignment"
      );
      setAlertOpen(true);
    } finally {
      setSaving(false);
    }
  };

  const logContactAttempt = async (event) => {
    try {
      const eventId = event?._id || event?.id;

      if (!eventId) {
        throw new Error(
          "Missing event id. Please refresh the event and try again."
        );
      }

      if (attempt.outcome === "followup_scheduled" && !attempt.followUpAt) {
        throw new Error(
          "Choose a follow-up date and time before logging this attempt."
        );
      }

      const nowIso = new Date().toISOString();

      const payload = {
        ...attempt,
        at: attempt.at || nowIso,
      };

      await api.post(`/events/${eventId}/contact-attempts`, payload);

      const refetch = await api.get(`/events/${eventId}`);
      const updatedEvent = refetch.data?.data;

      // ✅ Let parent/Redux own the source of truth
      onSaved?.(updatedEvent);

      setContactDialog(false);
      setAttempt({
        method: "phone",
        outcome: "no_answer",
        notes: "",
        followUpAt: "",
      });
      setAlertType("success");
      setAlertMsg("Contact attempt logged.");
      setAlertOpen(true);
    } catch (e) {
      setAlertType("error");
      setAlertMsg(
        e?.response?.data?.message || e.message || "Failed to log attempt"
      );
      setAlertOpen(true);
    }
  };

  const handleSendPaymentRequest = async () => {
    try {
      const payload = {
        event: event._id,
        provider: paymentProvider,
        paymentType,
        amountRequested: requestedAmount,
        providerUrl: PAYMENT_PROVIDER_LINKS[paymentProvider],
        status: "sent",
        sentTo: {
          fullName: form.contact.fullName,
          email: form.contact.email,
          phone: form.contact.phone,
        },
      };

      const res = await api.post("/payment-requests", payload);
      const result = res.data;

      if (!result?.success) {
        throw new Error(result?.message || "Failed to send payment request.");
      }

      setPaymentRequest(result.data);
      setPaymentRequests((prev) => [result.data, ...prev]);
      setAlertType("success");
      setAlertMsg(result.message || "Payment request sent successfully.");
      setAlertOpen(true);
    } catch (err) {
      setAlertType("error");
      setAlertMsg(
        err?.response?.data?.message || "Failed to send payment request."
      );
      setAlertOpen(true);
    }
  };

  const handleRecordPayment = async () => {
    if (collectPaymentAmountInvalid) {
      setAlertType("error");
      setAlertMsg(
        `Payment amount must be greater than $0 and no more than ${fmtMoney(
          remainingBalance
        )}.`
      );
      setAlertOpen(true);
      return;
    }

    try {
      const payload = {
        event: event._id,
        paymentRequest: paymentRequest?._id,
        amount: Number(paymentForm.amount),
        method: paymentForm.method,
        reference: paymentForm.reference,
        receivedAt: paymentForm.receivedAt,
        notes: paymentForm.notes,
      };

      const res = await api.post("/payments", payload);

      setPayments((prev) => [...prev, res.data.data]);
      if (paymentRequest?._id) {
        setPaymentRequests((prev) =>
          prev.map((request) =>
            request._id === paymentRequest._id
              ? { ...request, status: "completed" }
              : request
          )
        );
        setPaymentRequest(null);
      }

      setCollectPaymentOpen(false);
      setAlertType("success");
      setAlertMsg("Payment recorded successfully.");
      setAlertOpen(true);
    } catch (err) {
      setAlertType("error");
      setAlertMsg(err?.response?.data?.message || "Failed to record payment.");
      setAlertOpen(true);
    }
  };

  const openPaymentAction = (payment, actionType) => {
    setSelectedPayment(payment);
    setPaymentActionType(actionType);
    setPaymentActionReason("");
    setPaymentActionOpen(true);
  };

  const closePaymentAction = () => {
    if (paymentActionSaving) return;
    setPaymentActionOpen(false);
    setSelectedPayment(null);
    setPaymentActionType("");
    setPaymentActionReason("");
  };

  const handlePaymentAction = async () => {
    if (!selectedPayment?._id || !paymentActionType) return;

    setPaymentActionSaving(true);
    try {
      const endpoint =
        paymentActionType === "void"
          ? `/payments/${selectedPayment._id}/void`
          : `/payments/${selectedPayment._id}/refund`;

      const payload =
        paymentActionType === "void"
          ? { voidReason: paymentActionReason }
          : { notes: paymentActionReason };

      const res = await api.patch(endpoint, payload);
      const updatedPayment = res.data?.data;

      setPayments((prev) =>
        prev.map((payment) =>
          payment._id === selectedPayment._id ? updatedPayment : payment
        )
      );

      const reopenedRequest =
        updatedPayment?.paymentRequest &&
        typeof updatedPayment.paymentRequest === "object"
          ? updatedPayment.paymentRequest
          : null;

      if (reopenedRequest) {
        setPaymentRequests((prev) =>
          prev.map((request) =>
            request._id === reopenedRequest._id ? reopenedRequest : request
          )
        );

        if (
          !["cancelled", "expired", "completed"].includes(
            String(reopenedRequest.status || "").toLowerCase()
          )
        ) {
          setPaymentRequest(reopenedRequest);
        }
      }

      setAlertType("success");
      setAlertMsg(
        paymentActionType === "void"
          ? "Payment voided successfully."
          : "Payment marked as refunded successfully."
      );
      setAlertOpen(true);
      setPaymentActionOpen(false);
      setSelectedPayment(null);
      setPaymentActionType("");
      setPaymentActionReason("");
    } catch (err) {
      setAlertType("error");
      setAlertMsg(
        err?.response?.data?.message ||
          err.message ||
          `Failed to ${paymentActionType} payment.`
      );
      setAlertOpen(true);
    } finally {
      setPaymentActionSaving(false);
    }
  };

  const assignSelectedBartenders = useCallback(async () => {
    if (!canAssignBartenders) return;

    const eventId = event?._id || event?.id;
    if (!eventId) {
      setAlertType("error");
      setAlertMsg("Missing event ID. Close and reopen this event before assigning bartenders.");
      setAlertOpen(true);
      return;
    }

    setSaving(true);
    try {
      // payload assumes your backend uses bidIds to assign bartenders
      const res = await api.post(`/events/${eventId}/assign-bartenders`, {
        bidIds: selectedBidIds,
      });

      await dispatch(fetchBidsByEventId(eventId));
      await dispatch(fetchAssignmentsByEventId(eventId));

      setAlertType("success");
      setAlertMsg("Bartenders assigned successfully.");
      setAlertOpen(true);
      setManageBartendersOpen(false);

      onSaved?.({ ...event, ...(res.data?.data || {}), _id: eventId });
    } catch (e) {
      setAlertType("error");
      setAlertMsg(
        e?.response?.data?.message || e.message || "Failed to assign bartenders"
      );
      setAlertOpen(true);
    } finally {
      setSaving(false);
    }
  }, [canAssignBartenders, dispatch, event, onSaved, selectedBidIds]);

  const DefaultScripts = {
    phone: `Hi, this is $ from Tipsyverse calling about your event. Is now a good time?
We wanted to confirm the details you entered and ask a few quick questions so we can finalize pricing and availability.`,
    voicemail: `Hi, this is $ with Tipsyverse. 
Sorry we missed you!
We’re following up about your event request. Call us back at <YOUR NUMBER> or reply to the email so we can confirm a few details and finalize pricing. Thanks!`,
    email: `Subject: Tipsyverse — Quick follow-up on your event

Hi {{name}},

Thanks for your event request! We have a couple quick questions to confirm details and lock in pricing/availability.
Can you please share:
(1) How many guests do you expect to be at this event?
(2) What type of bar setup are you planning? Something like a full bar, cash bar, open bar, cocktails only, beer & wine, or a custom theme?
(3) Should we pickup any items on your behalf? If so, please provide a list of what you would like for us to pickup along with the quantity amount.
(4) Would bartenders be allowed to pull out tipjars at the event?
(5) Any special notes our bartenders should know?
(6) Is there additional contact to include for this event (name / phone / email)?


Thank you and we hope to hear from you soon!

Best,
Tipsyverse Team`,
    text: `Hi, this is $ from Tipsyverse calling about your event. Is now a good time?
We wanted to confirm the details you entered and ask a few quick questions so we can finalize pricing and availability.`,
  };

  const ScriptHelper = ({ attempt, form, loggedInUser }) => {
    const nameRaw =
      loggedInUser?.fullName ||
      loggedInUser?.fullname ||
      loggedInUser?.name ||
      "our team";

    const phoneRaw = loggedInUser?.phone || loggedInUser?.phoneNumber || "";
    const phonePretty = formatPhone(phoneRaw) || phoneRaw || "(317) 608-7361";

    const method = attempt?.method === "texted" ? "text" : attempt?.method;

    const buildScript = (fmt = "md") => {
      const bold = fmt === "md" ? (s) => `${s}` : (s) => s;
      const name = bold(nameRaw);
      const phone = bold(phonePretty);

      let base = DefaultScripts.phone;
      if (method === "voicemail") base = DefaultScripts.voicemail;
      else if (method === "email") base = DefaultScripts.email;
      else if (method === "text") base = DefaultScripts.text;

      let text = base;
      text = text.replace("$", name);
      text = text
        .replaceAll("<YOUR NAME>", name)
        .replaceAll("<YOUR NUMBER>", phone);

      const contactName = form?.contact?.fullName?.trim() || "there";
      text = text.replaceAll("{{name}}", bold(contactName));

      if (method === "email") {
        const lines = text.split(/\r?\n/);
        const subjectLine =
          lines.find((l) => /^Subject:/i.test(l)) || "Subject: (no subject)";
        const subject = subjectLine.replace(/^Subject:\s*/i, "");
        const body = lines
          .filter((l) => !/^Subject:/i.test(l))
          .join("\n")
          .trim();
        return { subject, body };
      }

      return { subject: "", body: text };
    };

    const md = buildScript("md");
    const [copied, setCopied] = useState(false);

    const handleCopy = async (val) => {
      try {
        await navigator.clipboard.writeText(val);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500); // revert after 1.5s
      } catch (e) {
        console.error("Copy failed", e);
      }
    };

    return (
      <Stack spacing={2} sx={{ mt: 1 }}>
        <Typography variant="subtitle2">Script Preview</Typography>

        {method === "email" ? (
          <>
            <Paper variant="outlined" sx={{ p: 1 }}>
              <Typography variant="caption" color="text.secondary">
                Email (Markdown) to {form?.contact?.email}
              </Typography>
              <Box
                component="pre"
                sx={{ fontFamily: "monospace", whiteSpace: "pre-wrap", m: 0 }}
              >
                Subject: {md.subject}
                {"\n\n"}
                {md.body}
              </Box>
            </Paper>
            <Stack direction="row" spacing={1}>
              <Button
                size="small"
                variant="outlined"
                sx={{
                  borderColor: "var(--primary-color)",
                  color: "var(--primary-color)",
                }}
                onClick={() =>
                  handleCopy(`Subject: ${md.subject}\n\n${md.body}`)
                }
                startIcon={copied ? <CheckCircle /> : <CopyAllOutlined />}
              >
                {copied ? "Copied" : "Copy Script"}
              </Button>
            </Stack>
          </>
        ) : (
          <>
            <Paper variant="outlined" sx={{ p: 1 }}>
              <Typography variant="caption" color="text.secondary">
                {method === "text" ? "Text Message" : "Call/Voicemail"}{" "}
                (Markdown)
              </Typography>
              <Box
                component="pre"
                sx={{ fontFamily: "monospace", whiteSpace: "pre-wrap", m: 0 }}
              >
                {md.body}
              </Box>
            </Paper>
            <Stack direction="row" spacing={1}>
              <Button
                size="small"
                variant="outlined"
                onClick={() => handleCopy(md.body)}
                sx={{
                  borderColor: "var(--primary-color)",
                  color: "var(--primary-color)",
                }}
                startIcon={copied ? <CheckCircle /> : <CopyAllOutlined />}
              >
                {copied ? "Copied" : "Copy Markdown"}
              </Button>
              {/* <Button size="small" onClick={() => handleCopy(plain.body)}>
                {copied ? "Copied" : "Copy Plain Text"}
              </Button> */}
            </Stack>
          </>
        )}
      </Stack>
    );
  };


  if (readOnly) {
    const tz =
      form.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    return (
      <Box>

        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Row label="Type" value={form.type} />
          </Grid>
          <Grid item xs={12} md={6}>
            <Row
              label="Status"
              value={
                <Chip
                  size="small"
                  label={form.status || "—"}
                  color={
                    form.status === "confirmed"
                      ? "success"
                      : form.status === "canceled"
                      ? "error"
                      : "warning"
                  }
                />
              }
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <Row
              label="Starts"
              value={
                form.startAt
                  ? `${moment(form.startAt).format(
                      "MMM D, YYYY • h:mm a"
                    )} ${tz}`
                  : "—"
              }
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <Row
              label="Ends"
              value={
                form.endAt
                  ? `${moment(form.endAt).format("MMM D, YYYY • h:mm a")} ${tz}`
                  : "—"
              }
            />
          </Grid>
          <Grid item xs={12}>
            <Row label="Location" value={formatLocationPretty(form.location)} />
          </Grid>
          <Grid item xs={12} md={6}>
            <Row label="Contact Name" value={form.contact?.fullName} />
          </Grid>
          <Grid item xs={12} md={6}>
            <Row
              label="Contact Email / Phone"
              value={[form.contact?.email, form.contact?.phone]
                .filter(Boolean)
                .join(" • ")}
            />
          </Grid>
          <Grid item xs={12}>
            <Row label="Description" value={form.description} />
          </Grid>
        </Grid>
        <Stack
          direction="row"
          spacing={1}
          justifyContent="flex-end"
          sx={{ mt: 2 }}
        >
          <Button onClick={onClose}>Close</Button>
        </Stack>
      </Box>
    );
  }

  return (
    <Box>

      <Stepper activeStep={active} alternativeLabel sx={{ mb: 3 }}>
        {steps.map((label, index) => {
          const unlocked = isStepUnlocked(index);
          return (
            <Step key={label} completed={index < active && stepReady[index]}>
              <StepButton
                onClick={() => unlocked && setActive(index)}
                disabled={!unlocked || saving}
              >
                <StepLabel
                  StepIconProps={{
                    sx: {
                      color: "grey",
                      "&.Mui-active": {
                        color: "var(--primary-color) !important",
                      },
                      "&.Mui-completed": {
                        color: "var(--primary-color) !important",
                      },
                    },
                  }}
                >
                  {label}
                </StepLabel>
              </StepButton>
            </Step>
          );
        })}
      </Stepper>

      {saving && <LinearProgress sx={{ mb: 2 }} />}

      <Box
        sx={{
          mb: 2,
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: 1,
          "& .MuiButton-root": { width: "100%" },
        }}
      >
        <Tooltip title="Helpful script for this step">
          <Button
            variant="outlined"
            startIcon={<InfoOutlined />}
            onClick={() => setStepDialogOpen(true)}
            sx={{
              borderColor: "var(--primary-color)",
              color: "var(--primary-color)",
            }}
          >
            Open Step Script
          </Button>
        </Tooltip>
        <Tooltip
          title="This will allow you to log your attempts of contacting."
        >
          <Button
            variant="outlined"
            onClick={() => setContactDialog(true)}
            startIcon={<Phone />}
            sx={{
              borderColor: "var(--primary-color)",
              color: "var(--primary-color)",
            }}
          >
            Log Attempt Contact
          </Button>
        </Tooltip>
        {[
          "ready_to_assign",
          "bidding",
          "selecting",
          "confirmed",
          "reminder_sent",
          "in_progress",
        ].includes(
          String(form.status || event?.status || "").toLowerCase()
        ) && (
          <Button
            variant="outlined"
            onClick={handleOpenManageBartenders}
            startIcon={<Group />}
            sx={{
              borderColor: "var(--primary-color)",
              color: "var(--primary-color)",
            }}
          >
            Manage Bartenders
          </Button>
        )}
        <Button
          variant="outlined"
          onClick={() => setActivityLogOpen((open) => !open)}
          startIcon={<History />}
          sx={{
            borderColor: "var(--primary-color)",
            color: "var(--primary-color)",
          }}
        >
          {activityLogOpen ? "Hide Activity Log" : "Show Activity Log"}
        </Button>
      </Box>

      {activityLogOpen && (
        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 0.5 }}>
            Activity Log
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            Review event edits, actors, timestamps, and field-level changes.
          </Typography>
          <ActivityLogsTable entityModel="Event" entityId={event?._id} />
        </Paper>
      )}

      {/* STEP 1: Confirm Information */}
      {active === 0 && (
        <Stack>
          <Stack spacing={2}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Contact
            </Typography>
            <TextField
              label="Contact Name"
              fullWidth
              disabled={true}
              value={form.contact.fullName}
              onChange={(e) => setField("contact.fullName", e.target.value)}
            />
            <TextField
              label="Contact Email"
              fullWidth
              disabled={true}
              value={form.contact.email}
              onChange={(e) => setField("contact.email", e.target.value)}
            />
            <PhoneTextField
              label="Contact Phone"
              disabled={true}
              value={form.contact.phone}
              onChange={(e) => setField("contact.phone", e.target.value)}
            />
            <TextField
              select
              fullWidth
              label="Preferred Method of Contact"
              value={form.contact.preferred || "call"}
              onChange={(e) => setField("contact.preferred", e.target.value)}
            >
              <MenuItem value="call">Call</MenuItem>
              <MenuItem value="email">Email</MenuItem>
              <MenuItem value="text">Text</MenuItem>
            </TextField>

            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Info
            </Typography>

            <TextField
              label="Event Type"
              select
              fullWidth
              value={form.type}
              onChange={(e) => setField("type", e.target.value)}
            >
              {EVENT_TYPES.map((t) => (
                <MenuItem key={t.value} value={t.value}>
                  {t.label}
                </MenuItem>
              ))}
            </TextField>
             <TextField
              label="Description"
              fullWidth
              multiline
              minRows={2}
              value={form.description}
              onChange={(e) => setField("description", e.target.value)}
            />

            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Time
            </Typography>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                label="Arrival Date"
                placeholder="MM/DD/YYYY"
                fullWidth
                value={dateInputs.startAt}
                onChange={updateEventDateTextPart("startAt")}
                InputLabelProps={{ shrink: true }}
                inputProps={{ inputMode: "numeric", maxLength: 10 }}
                helperText="Use MM/DD/YYYY."
              />
              <TextField
                label="Arrival Time"
                type="text"
                fullWidth
                placeholder="5:30 PM"
                value={timeInputs.startAt}
                onChange={updateEventTimePart("startAt")}
                onBlur={normalizeEventTimePart("startAt")}
                InputLabelProps={{ shrink: true }}
                inputProps={{ inputMode: "text", maxLength: 8 }}
                helperText="Type a time such as 5:30 PM."
              />
            </Stack>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                label="Leaving Date"
                placeholder="MM/DD/YYYY"
                fullWidth
                value={dateInputs.endAt}
                onChange={updateEventDateTextPart("endAt")}
                InputLabelProps={{ shrink: true }}
                inputProps={{ inputMode: "numeric", maxLength: 10 }}
                helperText="Use MM/DD/YYYY."
              />
              <TextField
                label="Leaving Time"
                type="text"
                fullWidth
                placeholder="9:30 PM"
                value={timeInputs.endAt}
                onChange={updateEventTimePart("endAt")}
                onBlur={normalizeEventTimePart("endAt")}
                InputLabelProps={{ shrink: true }}
                inputProps={{ inputMode: "text", maxLength: 8 }}
                helperText="Type a time such as 9:30 PM."
              />
            </Stack>
            <TextField
              label="Event Timezone"
              select
              fullWidth
              value={form.timezone}
              onChange={(e) => {
                const zone = e.target.value;
                setField("timezone", zone);
                ["startAt", "endAt"].forEach((field) => {
                  const parts = parseDateOnlyParts(dateInputs[field]);
                  const datePart = datePartsToDatePart(parts);
                  const timePart = parseTimeInput(timeInputs[field]);
                  const isoValue = zonedLocalDateTimeToIso(datePart, timePart, zone);
                  if (isoValue) setField(field, isoValue);
                });
              }}
              helperText="All event times and deadlines use this venue timezone."
            >
              {COMMON_US_TIMEZONES.map(([value, label]) => (
                <MenuItem key={value} value={value}>
                  {label} ({value})
                </MenuItem>
              ))}
            </TextField>

            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Location
            </Typography>
            <LocationInput
              value={form.location}
              onChange={handleLocationChange}
              restrictCountry="US"
            />
          </Stack>
        </Stack>
      )}

      {/* STEP 2: Questions */}
      {active === 1 && (
        <Stack spacing={2}>
          <TextField
            label="Estimated Number of Guests"
            type="number"
            fullWidth
            value={form.guestCount}
            onChange={(e) => setField("guestCount", e.target.value)}
          />

          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={2}
            display={"flex"}
            alignItems="center"
          >
            <TextField
              label="Approved Number of Bartenders"
              type="number"
              value={form.bartendersRequested}
              onChange={(e) => onBartendersChange(e.target.value)}
              helperText={`Recommended for ${Number(form.guestCount) || 0} guests: ${
                Number(form.recommendedBartenders) || 1
              }${bartendersTouched ? " (approved override)" : ""}`}
            />
            {bartendersTouched && (
              <Button
                variant="outlined"
                onClick={applyRecommended}
                sx={{
                  whiteSpace: "nowrap",
                  borderColor: "var(--primary-color)",
                  color: "var(--primary-color)",
                }}
              >
                Use Recommended #
              </Button>
            )}
          </Stack>

          {Number(form.bartendersRequested) <
            Number(form.recommendedBartenders) && (
            <TextField
              label="Staffing Exception Reason"
              value={form.staffingExceptionReason}
              onChange={(e) =>
                setField("staffingExceptionReason", e.target.value)
              }
              multiline
              minRows={2}
              required
              fullWidth
              helperText="Document why fewer bartenders were approved. The hourly rate is unchanged; pricing uses the approved bartender count."
            />
          )}

          <TextField
            select
            fullWidth
            label="Type of bar setup"
            value={form.barType}
            onChange={(e) => setField("barType", e.target.value)}
            helperText="Choose the service style for this event"
          >
            {BAR_TYPES.map((t) => (
              <MenuItem key={t.value} value={t.value}>
                {t.label} - {t.description}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            select
            fullWidth
            label="Would you like for us to pickup any items on your behalf?"
            value={form.procurementRequested ? "yes" : "no"}
            onChange={(e) => {
              const yes = e.target.value === "yes";
              setField("procurementRequested", yes);
              if (!yes && (form.procurementItems?.length ?? 0) > 0) {
                const ok = window.confirm(
                  "Turn off procurement and remove all items you’ve added?"
                );
                if (ok) setField("procurementItems", []);
                else setField("procurementRequested", true);
              }
            }}
          >
            <MenuItem value="yes">Yes</MenuItem>
            <MenuItem value="no">No</MenuItem>
          </TextField>

          {(form.procurementRequested || hasProcurementItems) && (
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                spacing={1}
                sx={{ mb: 1 }}
              >
                <Typography variant="subtitle2">Items to pickup</Typography>
                <Tooltip title="Buying rule of thumb">
                  <IconButton
                    size="small"
                    aria-label="Open pickup buying guide"
                    onClick={() => setProcurementGuideOpen(true)}
                    sx={{ color: "var(--primary-color)" }}
                  >
                    <InfoOutlined fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Stack>

              {/* Add row */}
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1}
                sx={{ mb: 1 }}
              >
                <TextField
                  label="Qty"
                  type="number"
                  sx={{ width: { xs: "100%", sm: 140 } }}
                  value={newItem.qty}
                  onChange={(e) =>
                    setNewItem((i) => ({ ...i, qty: e.target.value }))
                  }
                  inputProps={{ min: 1 }}
                />
                <TextField
                  label="Item"
                  fullWidth
                  value={newItem.name}
                  onChange={(e) =>
                    setNewItem((i) => ({ ...i, name: e.target.value }))
                  }
                />
                <Button
                  variant="outlined"
                  onClick={addProcureItem}
                  sx={{
                    whiteSpace: "nowrap",
                    borderColor: "var(--primary-color)",
                    color: "var(--primary-color)",
                  }}
                >
                  Add Item
                </Button>
              </Stack>

              {/* Checklist */}
              <Box sx={{ maxHeight: 220, overflowY: "auto" }}>
                <Stack spacing={1}>
                  {(form.procurementItems || []).map((it, idx) => (
                    <Paper
                      key={idx}
                      variant="outlined"
                      sx={{
                        p: 1,
                        borderColor: it.pickedUp
                          ? "success.light"
                          : "divider",
                        backgroundColor: it.pickedUp
                          ? "rgba(46, 125, 50, 0.06)"
                          : "background.paper",
                      }}
                    >
                      <Stack
                        direction={{ xs: "column", sm: "row" }}
                        spacing={1}
                        alignItems="center"
                      >
                        {canFulfillProcurement ? (
                          <FormControlLabel
                            sx={{
                              minWidth: { xs: "100%", sm: 150 },
                              m: 0,
                            }}
                            control={
                              <Checkbox
                                checked={!!it.pickedUp}
                                onChange={(e) =>
                                  updateProcureItem(idx, {
                                    pickedUp: e.target.checked,
                                  })
                                }
                              />
                            }
                            label={
                              it.pickedUp ? "Picked up" : ""
                            }
                          />
                        ) : null}
                        <TextField
                          label="Qty"
                          type="number"
                          sx={{ width: { xs: "100%", sm: 120 } }}
                          value={it.qty}
                          onChange={(e) =>
                            updateProcureItem(idx, { qty: e.target.value })
                          }
                          inputProps={{ min: 1 }}
                        />
                        <TextField
                          label="Item"
                          fullWidth
                          value={it.name}
                          onChange={(e) =>
                            updateProcureItem(idx, { name: e.target.value })
                          }
                        />
                        <Button
                          color="inherit"
                          onClick={() => removeProcureItem(idx)}
                        >
                          Delete
                        </Button>
                      </Stack>
                    </Paper>
                  ))}
                  {!(form.procurementItems || []).length && (
                    <Typography variant="body2" color="text.secondary">
                      No items added yet.
                    </Typography>
                  )}
                </Stack>
              </Box>

              <Alert severity="info" sx={{ mt: 1 }}>
                We’ll pickup these on your behalf.{" "}
                <strong>Items will be billed later</strong> at cost (plus
                applicable fees).
              </Alert>

              {hasProcurementItems && canFulfillProcurement && (
                <>
                  <Divider sx={{ my: 2 }} />

                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    Receipt and billing
                  </Typography>
                  <Stack spacing={1.5}>
                    <TextField
                      label="Receipt Total to Add to Event Bill"
                      type="number"
                      fullWidth
                      value={form.procurementActualCost}
                      onChange={(e) =>
                        setField("procurementActualCost", e.target.value)
                      }
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">$</InputAdornment>
                        ),
                      }}
                      inputProps={{ min: 0, step: "0.01" }}
                      helperText="Enter the actual receipt total after items are purchased. This amount is added to the customer balance."
                    />
                    <Box>
                      <Typography variant="subtitle2" sx={{ mb: 1 }}>
                        Receipt Photo
                      </Typography>
                      <input
                        ref={receiptInputRef}
                        type="file"
                        accept="image/*"
                        hidden
                        onChange={(e) =>
                          uploadProcurementReceipt(e.target.files?.[0])
                        }
                      />
                      <Paper
                        variant="outlined"
                        onClick={() => receiptInputRef.current?.click()}
                        onDragOver={(e) => {
                          e.preventDefault();
                          setReceiptDragActive(true);
                        }}
                        onDragLeave={() => setReceiptDragActive(false)}
                        onDrop={(e) => {
                          e.preventDefault();
                          const file = e.dataTransfer.files?.[0];
                          uploadProcurementReceipt(file);
                        }}
                        sx={{
                          p: 2,
                          borderStyle: "dashed",
                          borderWidth: 2,
                          borderColor: receiptDragActive
                            ? "var(--primary-color)"
                            : "divider",
                          backgroundColor: receiptDragActive
                            ? "rgba(140, 0, 45, 0.05)"
                            : "grey.50",
                          cursor: receiptUploading ? "wait" : "pointer",
                        }}
                      >
                        <Stack
                          direction={{ xs: "column", sm: "row" }}
                          spacing={1.5}
                          alignItems={{ xs: "flex-start", sm: "center" }}
                          justifyContent="space-between"
                        >
                          <Stack direction="row" spacing={1.5} alignItems="center">
                            <CloudUpload sx={{ color: "var(--primary-color)" }} />
                            <Box>
                              <Typography variant="subtitle2" fontWeight={800}>
                                {receiptUploading
                                  ? "Uploading receipt..."
                                  : form.procurementReceiptProof
                                  ? "Receipt uploaded"
                                  : "Click or drag receipt photo here"}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                JPG, PNG, GIF, or WebP · max {MAX_IMAGE_SIZE_MB} MB
                              </Typography>
                            </Box>
                          </Stack>
                          {form.procurementReceiptProof ? (
                            <Button
                              variant="outlined"
                              onClick={(e) => {
                                e.stopPropagation();
                                window.open(
                                  form.procurementReceiptProof,
                                  "_blank",
                                  "noopener,noreferrer"
                                );
                              }}
                              sx={{
                                borderColor: "var(--primary-color)",
                                color: "var(--primary-color)",
                              }}
                            >
                              View Receipt
                            </Button>
                          ) : null}
                        </Stack>
                      </Paper>

                      {form.procurementReceiptProof ? (
                        <Box
                          component="img"
                          src={form.procurementReceiptProof}
                          alt="Uploaded receipt preview"
                          sx={{
                            mt: 1.5,
                            width: "100%",
                            maxHeight: 280,
                            objectFit: "contain",
                            border: "1px solid",
                            borderColor: "divider",
                            borderRadius: 2,
                            backgroundColor: "grey.50",
                          }}
                        />
                      ) : null}
                    </Box>
                    <TextField
                      label="Receipt Notes"
                      fullWidth
                      multiline
                      minRows={2}
                      value={form.procurementReceiptNotes}
                      onChange={(e) =>
                        setField("procurementReceiptNotes", e.target.value)
                      }
                      placeholder="Example: Kroger receipt uploaded to Drive; includes ice, mixers, and cups."
                    />
                    <Stack
                      direction={{ xs: "column", sm: "row" }}
                      spacing={1}
                      alignItems={{ xs: "stretch", sm: "center" }}
                      justifyContent="space-between"
                    >
                      <Typography variant="body2" color="text.secondary">
                        Current receipt-backed charge:{" "}
                        <strong>
                          {fmtMoney(Number(form.procurementActualCost) || 0)}
                        </strong>
                      </Typography>
                      <Button
                        variant="contained"
                        onClick={saveEvent}
                        disabled={
                          saving ||
                          (Number(form.procurementActualCost) || 0) <= 0
                        }
                        sx={{ backgroundColor: "var(--primary-color)" }}
                      >
                        Save and Add to Bill
                      </Button>
                    </Stack>
                  </Stack>
                </>
              )}
            </Paper>
          )}

          <TextField
            select
            fullWidth
            label="Are bartenders allowed to pull out their tipjars for tips?"
            value={form.allowTipJars ? "yes" : "no"}
            onChange={(e) => {
              setField("allowTipJars", e.target.value === "yes");
              e.target.value === "yes"
                ? setCalcInput((c) => ({ ...c, gratuityPct: 18 }))
                : setCalcInput((c) => ({ ...c, gratuityPct: 25 }));
            }}
          >
            <MenuItem value="yes">Yes</MenuItem>
            <MenuItem value="no">No</MenuItem>
          </TextField>

          <TextField
            label="Are there any special notes our bartenders should know?"
            fullWidth
            multiline
            minRows={3}
            value={form.bartenderNotes}
            onChange={(e) => setField("bartenderNotes", e.target.value)}
          />
          <TextField
            label="Internal Notes for Ops (private)"
            fullWidth
            multiline
            minRows={3}
            value={form.internalNotes}
            onChange={(e) => setField("internalNotes", e.target.value)}
          />

          {/* Additional contact inline editor */}
          <Divider />
          <Typography variant="subtitle2">Additional Contact</Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <TextField
              label="Full Name"
              value={newContact.fullName}
              onChange={(e) =>
                setNewContact((c) => ({ ...c, fullName: e.target.value }))
              }
              fullWidth
            />
            <TextField
              label="Phone"
              value={newContact.phone}
              onChange={(e) =>
                setNewContact((c) => ({ ...c, phone: e.target.value }))
              }
              fullWidth
            />
            <TextField
              label="Email"
              value={newContact.email}
              onChange={(e) =>
                setNewContact((c) => ({ ...c, email: e.target.value }))
              }
              fullWidth
            />
            <Button
              variant="outlined"
              onClick={() => {
                const nc = {
                  fullName: (newContact.fullName || "").trim(),
                  phone: (newContact.phone || "").trim(),
                  email: (newContact.email || "").trim(),
                };
                if (!nc.fullName && !nc.phone && !nc.email) return;
                setForm((f) => ({
                  ...f,
                  additionalContacts: [...(f.additionalContacts || []), nc],
                }));
                setNewContact({ fullName: "", phone: "", email: "" });
              }}
              sx={{
                whiteSpace: "nowrap",
                color: "var(--primary-color)",
                borderColor: "var(--primary-color)",
              }}
            >
              Add
            </Button>
          </Stack>

          {!!form.additionalContacts?.length && (
            <Stack spacing={1}>
              {form.additionalContacts.map((c, i) => (
                <Paper key={i} variant="outlined" sx={{ p: 1 }}>
                  <Typography variant="body2">
                    <strong>{c.fullName || "Unnamed"}</strong>
                    {c.phone ? ` • ${c.phone}` : ""}
                    {c.email ? ` • ${c.email}` : ""}
                  </Typography>
                  <Button
                    size="small"
                    color="inherit"
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        additionalContacts: f.additionalContacts.filter(
                          (_, idx) => idx !== i
                        ),
                      }))
                    }
                  >
                    Remove
                  </Button>
                </Paper>
              ))}
            </Stack>
          )}
        </Stack>
      )}

      {/* STEP 3: Cost & Details */}
      {active === 2 && (
        <>
          <Box
            sx={{
              opacity: overrideEnabled ? 0.4 : 1,
              textDecoration: overrideEnabled ? "line-through" : "none",
              pointerEvents: overrideEnabled ? "none" : "auto",
            }}
          >
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle1" sx={{ mb: 1 }}>
                Pricing Builder
              </Typography>
              <PricingHeader />
              <Divider sx={{ mb: 2 }} />

              {/* Hourly / Labor */}
              <PricingRow
                left={
                  <TextField
                    label="Hourly Rate"
                    type="number"
                    fullWidth
                    value={calcInput.hourlyRate ?? ""}
                    onChange={(e) =>
                      setCalcInput((c) => ({
                        ...c,
                        hourlyRate: e.target.value,
                      }))
                    }
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">$</InputAdornment>
                      ),
                    }}
                    helperText={`Hours: ${hoursTotal.toFixed(
                      2
                    )} • Bartenders: ${bartenders}`}
                  />
                }
                middle={
                  <>
                    × {bartenders} bartenders × {hoursTotal.toFixed(2)} hours
                  </>
                }
                right={<>+ {fmtMoneyC(laborC)}</>}
              />

              {/* Booking Fee */}
              <PricingRow
                left={
                  <TextField
                    label="Booking Fee"
                    type="number"
                    disabled
                    fullWidth
                    value={calcInput.bookingFee ?? ""}
                    onChange={(e) =>
                      setCalcInput((c) => ({
                        ...c,
                        bookingFee: e.target.value,
                      }))
                    }
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">$</InputAdornment>
                      ),
                    }}
                  />
                }
                middle={"Flat fee"}
                right={<>+ {fmtMoneyC(bookingC)}</>}
              />

              {/* Procurement */}
              <PricingRow
                left={
                  <TextField
                    label="Procurement Fee"
                    type="number"
                    disabled
                    fullWidth
                    value={calcInput.procurementFee ?? ""}
                    onChange={(e) =>
                      setCalcInput((c) => ({
                        ...c,
                        procurementFee: e.target.value,
                      }))
                    }
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">$</InputAdornment>
                      ),
                    }}
                    helperText="+$50 applied automatically when items will be procured"
                  />
                }
                middle={
                  form.procurementRequested
                    ? "Procurement requested: base fee + $50"
                    : "No procurement requested: base fee only"
                }
                right={<>+ {fmtMoneyC(procurementC)}</>}
              />

              <PricingRow
                left={
                  <TextField
                    label="Pickup Receipt Total"
                    type="number"
                    disabled
                    fullWidth
                    value={form.procurementActualCost || 0}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">$</InputAdornment>
                      ),
                    }}
                    helperText="Actual purchased items added after discounts"
                  />
                }
                middle={
                  Number(form.procurementActualCost) > 0
                    ? "Receipt-backed customer reimbursement"
                    : "No receipt total recorded yet"
                }
                right={<>+ {fmtMoneyC(procurementActualC)}</>}
              />

              {/* Procurement */}
              <PricingRow
                left={
                  <TextField
                    label="Holiday Fee"
                    type="number"
                    fullWidth
                    value={holidayInfo.maxFee || 0}
                    disabled
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">$</InputAdornment>
                      ),
                    }}
                    helperText={
                      holidayInfo.isHoliday
                        ? `Applied: ${holidayInfo.holidays
                            .map((h) => h.name)
                            .join(", ")}`
                        : "No holiday fee (date is not on a listed holiday)"
                    }
                  />
                }
                middle={
                  holidayInfo.isHoliday
                    ? holidayInfo.holidays
                        .map((h) => `${h.name} (${h.date})`)
                        .join(" • ")
                    : "Event does not fall on a holiday from the list"
                }
                right={<>+ {fmtMoneyC(holidayFeeC)}</>}
              />

              <Divider sx={{ my: 1.5 }} />

              {/* Flat Subtotal */}
              <PricingRow
                dense
                left={
                  <Typography color="text.secondary">Flat Subtotal</Typography>
                }
                middle={<span />}
                right={
                  <Typography variant="subtitle1">
                    {fmtMoneyC(flatSubtotalC)}
                  </Typography>
                }
              />

              {/* Gratuity % */}
              <PricingRow
                left={
                  <TextField
                    label="Gratuity %"
                    type="number"
                    fullWidth
                    value={calcInput.gratuityPct ?? ""}
                    onChange={(e) =>
                      setCalcInput((c) => ({
                        ...c,
                        gratuityPct: e.target.value,
                      }))
                    }
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">%</InputAdornment>
                      ),
                    }}
                    helperText={`Tip jars ${
                      form.allowTipJars === false ? "not " : " "
                    }allowed → should be set to ${
                      form.allowTipJars ? "18" : "25"
                    }%`}
                  />
                }
                middle={
                  <>
                    {pct(calcInput.gratuityPct)} ×{" "}
                    {fmtMoney(fromCents(flatSubtotalC))}
                  </>
                }
                right={<>+ {fmtMoneyC(gratuityC)}</>}
              />

              {/* Rush % */}
              <PricingRow
                left={
                  <Stack direction="row" spacing={1} alignItems="center">
                    <TextField
                      label={
                        calcInput.rushMode === "manual"
                          ? "Rush % (manual)"
                          : "Rush % (auto)"
                      }
                      type="number"
                      fullWidth
                      disabled={calcInput.rushMode !== "manual"}
                      value={
                        calcInput.rushMode === "manual"
                          ? calcInput.rushPctManual ?? 0
                          : autoRush.pctPercent
                      }
                      onChange={(e) =>
                        setCalcInput((c) => ({
                          ...c,
                          rushPctManual: e.target.value,
                        }))
                      }
                      InputProps={{
                        endAdornment: (
                          <InputAdornment position="end">%</InputAdornment>
                        ),
                      }}
                      helperText={
                        calcInput.rushMode === "manual"
                          ? "Override the auto rule"
                          : `Auto: ${autoRush.label}`
                      }
                    />
                    <TextField
                      select
                      label="Mode"
                      size="small"
                      value={calcInput.rushMode}
                      onChange={(e) =>
                        setCalcInput((c) => ({
                          ...c,
                          rushMode: e.target.value,
                        }))
                      }
                      sx={{ width: 140 }}
                    >
                      <MenuItem value="auto">Auto</MenuItem>
                      <MenuItem value="manual">Manual</MenuItem>
                    </TextField>
                  </Stack>
                }
                middle={
                  <>
                    {calcInput.rushMode === "manual"
                      ? `${Math.max(
                          0,
                          Number(calcInput.rushPctManual || 0)
                        )}% (manual)`
                      : `${autoRush.pctPercent}% — ${autoRush.reason}`}{" "}
                    × {fmtMoney(fromCents(flatSubtotalC))}
                  </>
                }
                right={<>+ {fmtMoneyC(rushC)}</>}
              />

              {/* Tax % */}
              <PricingRow
                left={
                  <TextField
                    label="Tax %"
                    type="number"
                    fullWidth
                    value={calcInput.taxPct ?? ""}
                    onChange={(e) =>
                      setCalcInput((c) => ({ ...c, taxPct: e.target.value }))
                    }
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">%</InputAdornment>
                      ),
                    }}
                  />
                }
                middle={
                  <>
                    {pct(calcInput.taxPct)} ×{" "}
                    {fmtMoney(fromCents(flatSubtotalC))}
                  </>
                }
                right={<>+ {fmtMoneyC(taxC)}</>}
              />

              <Divider sx={{ my: 1.5 }} />

              {/* % Subtotal */}
              <PricingRow
                dense
                left={
                  <Typography color="text.secondary">% Subtotal</Typography>
                }
                middle={<span />}
                right={
                  <Typography variant="subtitle1">
                    {fmtMoneyC(percentSubtotalC)}
                  </Typography>
                }
              />

              {/* Coupon entry */}
              <PricingRow
                left={
                  <TextField
                    label="Discount / Coupon Code"
                    fullWidth
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value)}
                  />
                }
                middle={
                  <Button
                    variant="contained"
                    sx={{ backgroundColor: "var(--primary-color)" }}
                    onClick={addCoupon}
                  >
                    Apply Code
                  </Button>
                }
                right={
                  <>
                    {appliedCoupons?.map((c) => {
                      const src = coupons.find((x) => x.code === c.code) || {};
                      const start =
                        toDateOrNull(src.startsAt)?.toLocaleString() ?? "—";
                      const end =
                        toDateOrNull(src.expiresAt)?.toLocaleString() ?? "—";
                      const tip =
                        (src.startsAt ? `Starts: ${start}` : "No start limit") +
                        " • " +
                        (src.expiresAt ? `Expires: ${end}` : "No end limit");
                      return (
                        <Tooltip key={c.code} title={tip}>
                          <Chip
                            label={c.code}
                            onDelete={() => removeCoupon(c.code)}
                            sx={{ ml: 0.5, mb: 0.5 }}
                          />
                        </Tooltip>
                      );
                    })}
                  </>
                }
              />

              {/* Pre-Discount Total */}
              <PricingRow
                dense
                left={
                  <Typography color="text.secondary">
                    Pre-Discount Total
                  </Typography>
                }
                middle={<span />}
                right={
                  <Typography variant="subtitle1">
                    {fmtMoneyC(preDiscountTotalC)}
                  </Typography>
                }
              />

              {!!appliedCoupons?.length && (
                <Stack sx={{ mb: 1 }}>
                  {appliedCoupons.map((a) => (
                    <PricingRow
                      key={a.code}
                      dense
                      left={
                        <Typography variant="body2">
                          {a.code}
                          {a.type === "PERCENT_TOTAL"
                            ? ` (${a.value}% off)`
                            : ""}
                        </Typography>
                      }
                      middle={<span />}
                      right={<span>− {fmtMoneyC(a.amountOffTotalC)}</span>}
                    />
                  ))}
                </Stack>
              )}

              <Divider sx={{ my: 1.5 }} />

              {/* GRAND TOTAL */}
              <PricingRow
                left={<Typography variant="h6">TOTAL</Typography>}
                middle={<span />}
                right={
                  <Typography variant="h6">{fmtMoneyC(grandTotalC)}</Typography>
                }
              />

              {/* Minimum Deposit */}
              <PricingRow
                dense
                left={
                  <Typography variant="subtitle2" color="text.secondary">
                    Minimum Deposit
                  </Typography>
                }
                middle={<span />}
                right={
                  <Typography variant="subtitle2">
                    {fmtMoneyC(minDepositC)}
                  </Typography>
                }
              />
            </Paper>
          </Box>
          <Divider sx={{ my: 2 }} />

          {/* OVERRIDE TOGGLE + AMOUNT */}
          <Stack spacing={1}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={overrideEnabled}
                  onChange={(e) => {
                    const next = e.target.checked;
                    if (next) {
                      // Turn ON: ask for reason first
                      setOverrideDialogOpen(true);
                    } else {
                      // Turn OFF: reset and restore normal pricing
                      setOverrideEnabled(false);
                      setOverrideReason("");
                      setOverrideAmount("0");
                    }
                  }}
                />
              }
              label="Override total"
            />

            {/* Only show the amount input while override is enabled */}
            {overrideEnabled && (
              <TextField
                label="Override Amount"
                type="number"
                inputProps={{ min: 0, step: "0.01" }}
                value={overrideAmount}
                onChange={(e) => setOverrideAmount(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">$</InputAdornment>
                  ),
                }}
                helperText={
                  overrideReason
                    ? `Reason: ${overrideReason}`
                    : "Reason required (set when enabling override)"
                }
              />
            )}

            {/* Prominent 'OVERRIDDEN TOTAL' display */}
            {overrideEnabled && (
              <Alert severity="warning">
                <strong>
                  OVERRIDDEN TOTAL: {fmtMoney(Number(overrideAmount) || 0)}
                </strong>
                {" • "}
                This replaces all calculated line items above.
              </Alert>
            )}
          </Stack>
        </>
      )}

      {/* STEP 4: Payment */}
      {active === 3 && (
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
              <PaymentStatusSummary
                paymentStatus={paymentStatus}
                paymentChipColor={paymentChipColor}
                amountPaid={amountPaid}
                discountedTotal={discountedTotal}
                overpaymentCredit={overpaymentCredit}
                paymentsLoading={paymentsLoading}
                paymentRequest={paymentRequest}
                paymentRequests={paymentRequests}
                formatMoney={fmtMoney}
              />

              {paymentPolicy.dueAt && (
                <Alert severity={paymentPolicy.severity} sx={{ mb: 2 }}>
                  <strong>{paymentPolicy.label}.</strong> Balance due date:{" "}
                  {formatPaymentDueDate(paymentPolicy.dueAt, getEventTimeZone(event))}.
                  {event?.payment?.shortNoticeFullPayment
                    ? " This was confirmed within seven days of the event, so full payment was due at confirmation."
                    : ""}
                  {paymentPolicy.status === "payment_hold" || paymentPolicy.status === "action_required"
                    ? " Bartenders remain assigned while final instructions, optional purchases, and additional event changes are paused."
                    : ""}
                </Alert>
              )}

              {remainingBalance > 0 &&
                ["due_now", "past_due", "payment_hold", "action_required", "arrangement"].includes(
                  paymentPolicy.status
                ) && (
                  <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
                    <Typography variant="subtitle2" fontWeight={700}>
                      Payment arrangement
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                      Document an approved exception here. Otherwise, use Cancel Event and select
                      “Unpaid balance / nonpayment” no later than 48 hours before the event.
                    </Typography>
                    <TextField
                      fullWidth
                      multiline
                      minRows={2}
                      label="Arrangement terms and payment deadline"
                      value={arrangementNotes}
                      onChange={(e) => setArrangementNotes(e.target.value)}
                      sx={{ mb: 1.5 }}
                    />
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                      {paymentPolicy.status !== "arrangement" ? (
                        <Button
                          variant="contained"
                          disabled={policySaving || arrangementNotes.trim().length < 5}
                          onClick={() => resolvePaymentPolicy("approve_arrangement")}
                        >
                          Approve Arrangement
                        </Button>
                      ) : (
                        <Button
                          variant="outlined"
                          disabled={policySaving}
                          onClick={() => resolvePaymentPolicy("remove_arrangement")}
                        >
                          Remove Arrangement
                        </Button>
                      )}
                      <Button
                        variant="outlined"
                        onClick={() => {
                          setCancelReason("nonpayment");
                          setCancelDialogOpen(true);
                        }}
                      >
                        Cancel for Nonpayment
                      </Button>
                    </Stack>
                  </Paper>
                )}

              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
                Send Invoice / Payment Request
              </Typography>

              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Choose the payment amount, paste the external payment link, then
                send an invoice-style payment request to the client.
              </Typography>

              <Stack spacing={2} sx={{ mt: 2 }}>
                <TextField
                  select
                  fullWidth
                  label="Payment Provider"
                  value={paymentProvider}
                  onChange={(e) => setPaymentProvider(e.target.value)}
                >
                  <MenuItem value="paypal">PayPal</MenuItem>
                  <MenuItem value="venmo">Venmo</MenuItem>
                  <MenuItem value="cashapp">Cash App</MenuItem>
                  <MenuItem value="square">Square</MenuItem>
                  <MenuItem value="zelle">Zelle</MenuItem>
                </TextField>

                <TextField
                  select
                  fullWidth
                  label="Payment Type"
                  value={paymentType}
                  onChange={(e) => setPaymentType(e.target.value)}
                >
                  <MenuItem value="full">
                    Remaining Balance — {fmtMoney(maxRequestAmount)}
                  </MenuItem>

                  {}
                  <MenuItem value="deposit">
                    Deposit — {fmtMoney(depositRequestAmount)}
                  </MenuItem>

                  <MenuItem value="custom">Custom Amount</MenuItem>
                </TextField>

                <TextField
                  fullWidth
                  label={
                    isCustomPayment
                      ? "Custom Amount Requested"
                      : "Amount Requested"
                  }
                  type="number"
                  value={
                    isCustomPayment ? customPaymentAmount : requestedAmount
                  }
                  disabled={!isCustomPayment}
                  onChange={(e) => {
                    const raw = e.target.value;
                    const next = Number(raw);
                    const amount =
                      raw === ""
                        ? ""
                        : Number.isFinite(next)
                        ? Math.min(next, maxRequestAmount)
                        : "";
                    setCustomPaymentAmount(amount);
                  }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">$</InputAdornment>
                    ),
                  }}
                  inputProps={{
                    min: 0,
                    max: maxRequestAmount,
                    step: "0.01",
                  }}
                  error={isCustomPayment && paymentAmountInvalid}
                  helperText={
                    isCustomPayment && paymentAmountInvalid
                      ? `Must be greater than $0 and no more than ${fmtMoney(
                          maxRequestAmount
                        )}.`
                      : " "
                  }
                />

                <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                  <TextField
                    fullWidth
                    disabled
                    label="Provider Payment Link"
                    value={PAYMENT_PROVIDER_LINKS[paymentProvider] || ""}
                  />

                  <Button
                    variant="outlined"
                    onClick={() =>
                      navigator.clipboard.writeText(
                        PAYMENT_PROVIDER_LINKS[paymentProvider] || ""
                      )
                    }
                  >
                    Copy
                  </Button>
                </Stack>

                <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                  <Tooltip
                    title={paymentRequestInvalid ? paymentRequestHelperText : "Send this invoice to the main contact."}
                  >
                    <span>
                      <Button
                        variant="contained"
                        sx={{ backgroundColor: "var(--primary-color)" }}
                        onClick={handleSendPaymentRequest}
                        disabled={paymentRequestInvalid}
                      >
                        Send Invoice
                      </Button>
                    </span>
                  </Tooltip>

                  <Tooltip
                    title={
                      !paymentRequest
                        ? "Send an invoice first so this payment can be connected to a request."
                        : "Record a payment against this event."
                    }
                  >
                    <span>
                      <Button
                        variant="outlined"
                        disabled={paymentsLoading || !paymentRequest}
                        onClick={() => {
                          setPaymentForm((p) => ({
                            ...p,
                            amount:
                              paymentRequest?.amountRequested ||
                              requestedAmount ||
                              maxRequestAmount,
                            method: paymentProvider,
                          }));
                          setCollectPaymentOpen(true);
                        }}
                      >
                        {amountPaid > 0
                          ? "Record Additional Payment"
                          : "Collect Payment"}
                      </Button>
                    </span>
                  </Tooltip>
                </Stack>

                <Typography
                  variant="caption"
                  color={paymentRequestInvalid ? "error" : "text.secondary"}
                >
                  {paymentRequestHelperText}
                </Typography>

                <RecordedPaymentsList
                  payments={payments}
                  formatMoney={fmtMoney}
                  formatDate={(value) => moment(value).format("MMM D, YYYY")}
                  onPaymentAction={openPaymentAction}
                />
              </Stack>
            </Paper>
          </Grid>

          <Grid item xs={12}>
            <Alert severity="info">
              Amount requested now: <strong>{fmtMoney(requestedAmount)}</strong>
            </Alert>
          </Grid>
        </Grid>
      )}

      {/* STEP 5: Review */}
      {active === 4 && (
        <Stack container spacing={2}>
          <Stack item xs={12}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle1" sx={{ mb: 1 }}>
                Review Summary
              </Typography>

              {/* SINGLE-COLUMN, VERTICAL ROWS */}
              <Stack container spacing={1}>
                <Stack item xs={12}>
                  <Row label="Type" value={form.type} />
                </Stack>
                <Stack item xs={12}>
                  <Row
                    label="Date"
                    value={
                      formatWhen(form.startAt, form.endAt, form.timezone) || "—"
                    }
                  />
                </Stack>
                <Stack item xs={12}>
                  <Row
                    label="Location"
                    value={formatLocationPretty(form.location)}
                  />
                </Stack>
                <Stack item xs={12}>
                  <Row label="Guest Count" value={form.guestCount} />
                </Stack>
                <Stack item xs={12}>
                  <Row label="Bartenders" value={form.bartendersRequested} />
                </Stack>

                {/* Procurement summary in Review */}
                {(form.procurementRequested ||
                  (Array.isArray(form.procurementItems) &&
                    form.procurementItems.length > 0)) && (
                    <Stack item xs={12}>
                      <Typography variant="overline" color="text.secondary">
                        Items to pickup
                      </Typography>
                      {(form.procurementItems || []).length > 0 ? (
                        <Box component="ul" sx={{ pl: 3, mt: 0.5, mb: 1 }}>
                          {form.procurementItems.map((it, i) => (
                            <li key={i}>
                              <Typography variant="body2">
                                {it.pickedUp ? "Picked up: " : "Need: "}
                                <strong>{Number(it.qty) || 1}</strong> ×{" "}
                                {String(it.name || "").trim() ||
                                  "Unnamed item"}
                              </Typography>
                            </li>
                          ))}
                        </Box>
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          No pickup items listed yet.
                        </Typography>
                      )}
                      <Typography variant="caption" color="text.secondary">
                        Note: Items will be billed separately after purchase (at
                        cost plus any applicable fees).
                      </Typography>
                      <Stack spacing={0.75} sx={{ mt: 1 }}>
                        <Row
                          label="Pickup Receipt Total"
                          value={fmtMoney(
                            Number(form.procurementActualCost) || 0
                          )}
                        />
                        <Row
                          label="Receipt Proof"
                          value={form.procurementReceiptProof || "Not added"}
                        />
                        {form.procurementReceiptNotes ? (
                          <Row
                            label="Receipt Notes"
                            value={form.procurementReceiptNotes}
                          />
                        ) : null}
                      </Stack>
                    </Stack>
                  )}

                <Stack item xs={12}>
                  <Row
                    label="Payment Status"
                    value={`${paymentStatus} • ${fmtMoney(
                      remainingBalance
                    )} remaining${
                      overpaymentCredit > 0
                        ? ` • ${fmtMoney(overpaymentCredit)} credit`
                        : ""
                    }`}
                  />
                </Stack>
                <Stack item xs={12}>
                  <Row
                    label="Total (after discounts)"
                    value={fmtMoney(discountedTotal)}
                  />
                </Stack>
              </Stack>
            </Paper>
          </Stack>

          {/* Blocking reasons */}
          {!canContinueToAssign && event.status !== "completed" && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                To enable “Continue to Assign”, please complete:
              </Typography>
              <ul style={{ margin: 0, paddingLeft: 16 }}>
                {assignBlockers.map((msg, i) => (
                  <li key={i}>
                    <Typography variant="body2">{msg}</Typography>
                  </li>
                ))}
              </ul>
            </Alert>
          )}
        </Stack>
      )}

      {active < steps.length - 1 && currentStepBlockers.length > 0 && (
        <Alert severity="warning" sx={{ mt: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
            To continue, please complete:
          </Typography>
          <ul style={{ margin: 0, paddingLeft: 16 }}>
            {currentStepBlockers.map((msg, i) => (
              <li key={i}>
                <Typography variant="body2">{msg}</Typography>
              </li>
            ))}
          </ul>
        </Alert>
      )}

      {/* Footer actions */}
      <Divider sx={{ my: 2 }} />
      <Stack direction="row" spacing={1} justifyContent="space-between">
        <Stack direction="row" spacing={1}>
          {event.status !== "completed" && (
            <Button
              variant="outlined"
              sx={{
                color: "var(--primary-color)",
                borderColor: "var(--primary-color)",
              }}
              onClick={saveEvent}
              disabled={saving}
            >
              Save
            </Button>
          )}
          {active > 0 && (
            <Button
              variant="text"
              onClick={() => setActive((s) => s - 1)}
              disabled={saving}
              sx={{ color: "var(--primary-color)" }}
            >
              Back
            </Button>
          )}
        </Stack>

        <Stack direction="row" spacing={1} alignItems="center">
          {event.status === "submitted" && (
            <Button
              variant="outlined"
              color="error"
              onClick={() => {
                setCancelDialogOpen(true);
                setCancelReason("");
                setCancelOtherReason("");
              }}
              disabled={
                saving ||
                form.status === "canceled" ||
                form.status === "confirmed"
              }
            >
              Cancel Event
            </Button>
          )}

          {active < steps.length - 1 ? (
            <Button
              variant="contained"
              onClick={() =>
                setActive((s) => Math.min(s + 1, steps.length - 1))
              }
              disabled={saving || !canContinueToNextStep}
              sx={{ backgroundColor: "var(--primary-color)" }}
            >
              Continue
            </Button>
          ) : (
            <Button
              variant="contained"
              color="success"
              onClick={submitPaymentAndAssign}
              disabled={
                saving ||
                !canContinueToAssign ||
                event.status === "ready_to_assign"
              }
            >
              Continue to Assign
            </Button>
          )}
        </Stack>
      </Stack>

      {/* Manage Bartenders Dialog */}
      <Dialog
        open={manageBartendersOpen}
        onClose={() => setManageBartendersOpen(false)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>Manage Bartenders</DialogTitle>
        <DialogContent dividers>
          <Tabs
            value={bartenderTab}
            onChange={(e, value) => setBartenderTab(value)}
          >
            <Tab label="Assign" value="assign" />
            <Tab label="Remove" value="remove" />
          </Tabs>

          {bartenderTab === "assign" && (
            <Stack spacing={2}>
              <Alert severity="info">
                Select up to <strong>{maxBartendersNeeded}</strong> more bartender
                {maxBartendersNeeded > 1 ? "s" : ""} for this event. You
                currently have{" "}
                <strong>
                  {selectedBidIds.length} / {maxBartendersNeeded}
                </strong>{" "}
                selected.
              </Alert>

              {allBids.length === 0 && (
                <Alert severity="warning">
                  There are currently no bids with an{" "}
                  <strong>interested</strong> status for this event.
                </Alert>
              )}

              {!!allBids.length && (
                <Grid
                  container
                  spacing={2}
                  alignItems="center"
                  justifyContent="center"
                >
                  <Grid item>
                    {customBidList(
                      "Available (Interested)",
                      filteredAvailableBids,
                      "available"
                    )}
                  </Grid>

                  <Grid item>
                    <Stack spacing={1} alignItems="center">
                      <Button
                        variant="outlined"
                        onClick={handleCheckedRight}
                        disabled={
                          !leftChecked.length ||
                          selectedBidIds.length >= maxBartendersNeeded
                        }
                        endIcon={<ArrowForwardIos />}
                      >
                        Add
                      </Button>
                      <Button
                        variant="outlined"
                        onClick={handleCheckedLeft}
                        disabled={!rightChecked.length}
                        startIcon={<ArrowBackIos />}
                      >
                        Remove
                      </Button>
                    </Stack>
                  </Grid>

                  <Grid item>
                    {customBidList(
                      "Select for assignment",
                      filteredChosenBids,
                      "chosen"
                    )}
                  </Grid>
                </Grid>
              )}
            </Stack>
          )}

          {bartenderTab === "remove" && (
            <Stack spacing={2} sx={{ mt: 2 }}>
              <Alert severity="info">
                Select one or more currently assigned bartenders and choose a
                reason for removal. This will free their spot and optionally
                reopen the event if you now have open slots.
              </Alert>
              {allAssignments.length === 0 && (
                <Alert severity="warning">
                  There are currently <strong>no assigned bartenders</strong>{" "}
                  for this event.
                </Alert>
              )}
              {allAssignments.length > 0 && (
                <>
                  {/* Header with Select All + Search */}
                  <Paper variant="outlined" sx={{ p: 1.5 }}>
                    <Stack spacing={1}>
                      <Stack direction="row" alignItems="center">
                        <Checkbox
                          checked={allAssignedChecked}
                          indeterminate={someAssignedChecked}
                          onChange={toggleHeaderAssignedCheckbox}
                        />
                        <Box>
                          <Typography variant="subtitle2">
                            Assigned Bartenders
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {checkedAssignments.length}/{allAssignments.length}{" "}
                            selected
                          </Typography>
                        </Box>
                      </Stack>

                      <TextField
                        size="small"
                        placeholder="Search by name, email, or phone…"
                        value={searchAssigned}
                        onChange={(e) => setSearchAssigned(e.target.value)}
                        fullWidth
                      />
                    </Stack>
                  </Paper>

                  {/* Scrollable list, same style as customBidList */}
                  <Paper
                    variant="outlined"
                    sx={{ maxHeight: 320, overflowY: "auto", p: 1 }}
                  >
                    {filteredAssignments.length === 0 ? (
                      <Typography variant="body2" color="text.secondary">
                        No assigned bartenders match your search.
                      </Typography>
                    ) : (
                      filteredAssignments.map((assign) => {
                        const bartender = assign.bartenderUser || {};
                        const id = getAssignmentId(assign);
                        const isChecked = isAssignmentChecked(assign);
                        //console.log("assign status", assign.status);

                        const name =
                          bartender.fullName ||
                          bartender.displayName ||
                          "Unnamed bartender";
                        const email = bartender.email || "";
                        const phone = bartender.phone || "";
                        return (
                          <Box key={id} sx={{ mb: 1 }}>
                            <Paper
                              variant="outlined"
                              onClick={toggleAssignedRow(assign)}
                              sx={{
                                p: 1.25,
                                borderRadius: 1.5,
                                cursor: "pointer",
                                borderColor: isChecked
                                  ? "var(--primary-color)"
                                  : "divider",
                                boxShadow: isChecked ? 1 : 0,
                                "&:hover": {
                                  borderColor: "var(--primary-color)",
                                  boxShadow: 1,
                                  backgroundColor: "rgba(0,0,0,0.02)",
                                },
                              }}
                            >
                              <Stack
                                direction="row"
                                alignItems="flex-start"
                                spacing={1}
                              >
                                <Checkbox
                                  edge="start"
                                  checked={isChecked}
                                  tabIndex={-1}
                                  disableRipple
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleAssignedRow(assign)();
                                  }}
                                  sx={{ mt: 0.5 }}
                                />

                                <Avatar sx={{ width: 40, height: 40, flexShrink: 0 }}>
                                  {name?.[0]?.toUpperCase?.() || "?"}
                                </Avatar>

                                <Box sx={{ flexGrow: 1 }}>
                                  <Typography variant="subtitle2">
                                    {name}
                                  </Typography>
                                  {(email || phone) && (
                                    <Typography
                                      variant="caption"
                                      color="text.secondary"
                                      display="block"
                                    >
                                      {[phone, email]
                                        .filter(Boolean)
                                        .join(" • ")}
                                    </Typography>
                                  )}
                                </Box>
                              </Stack>
                            </Paper>
                          </Box>
                        );
                      })
                    )}
                  </Paper>

                  {/* Reason dropdown */}
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
                      <MenuItem value="schedule_conflict">
                        Schedule conflict
                      </MenuItem>
                      <MenuItem value="other">Other</MenuItem>
                    </Select>
                  </FormControl>
                </>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setManageBartendersOpen(false)}>Close</Button>
          {bartenderTab === "assign" && (
            <Button
              variant="contained"
              color="success"
              onClick={assignSelectedBartenders}
              disabled={!canAssignBartenders || saving}
            >
              Assign Bartenders
            </Button>
          )}
          {bartenderTab === "remove" && (
            <Button
              variant="contained"
              color="error"
              onClick={() => setConfirmRemoveOpen(true)}
              disabled={checkedAssignments.length === 0 || removeReason === ""}
            >
              Remove Bartender(s)
            </Button>
          )}
        </DialogActions>
      </Dialog>

      <Dialog
        open={confirmRemoveOpen}
        onClose={() => !removing && setConfirmRemoveOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Confirm Removal</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <Alert severity="warning">
              You’re about to remove{" "}
              <strong>{checkedAssignments.length}</strong> bartender
              {checkedAssignments.length > 1 ? "s" : ""} from this event for the
              following:
            </Alert>

            <Typography variant="body2">
              <strong>Reason:</strong> {removeReason || "—"}
            </Typography>

            <Typography variant="subtitle2">
              Bartenders to be removed:
            </Typography>
            <Box
              sx={{
                maxHeight: 240, // adjust as needed (200–300px is typical)
                overflowY: "auto",
                pr: 1, // avoids scroll bar overlapping content
              }}
            >
              <Stack spacing={1}>
                {checkedAssignments.map((a) => {
                  const u = a.bartenderUser || {};
                  const name =
                    u.fullName ||
                    u.name ||
                    u.displayName ||
                    "Unnamed bartender";
                  const email = u.email || "";

                  return (
                    <Paper key={a._id} variant="outlined" sx={{ p: 1 }}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Avatar sx={{ width: 32, height: 32 }}>
                          {name?.[0]?.toUpperCase?.() || "?"}
                        </Avatar>
                        <Box>
                          <Typography variant="body2" fontWeight={600}>
                            {name}
                          </Typography>

                          <Typography
                            variant="caption"
                            color="text.secondary"
                            display="block"
                          >
                            {email}
                          </Typography>
                        </Box>
                      </Stack>
                    </Paper>
                  );
                })}
              </Stack>
            </Box>

            <Alert severity="info">
              This will free up their spot on the event. The event may reopen to
              bids or show as having open slots again.
            </Alert>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setConfirmRemoveOpen(false)}
            disabled={removing}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleConfirmRemove}
            disabled={removing}
          >
            {removing ? "Removing…" : "Confirm Remove"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Cancel Event Dialog */}
      <Dialog
        open={cancelDialogOpen}
        onClose={() => setCancelDialogOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Cancel Event</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <Alert severity="warning">
              This will mark the event as <strong>canceled</strong>. It will no
              longer be moved to assignment or staffed.
            </Alert>

            <TextField
              select
              label="Reason for canceling"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              fullWidth
              required
              error={!cancelReason}
              helperText={!cancelReason ? "Please select a reason" : " "}
            >
              {CANCEL_REASONS.map((r) => (
                <MenuItem key={r.value} value={r.value}>
                  {r.label}
                </MenuItem>
              ))}
            </TextField>

            {cancelReason === "other" && (
              <TextField
                label="Custom reason"
                multiline
                minRows={2}
                fullWidth
                value={cancelOtherReason}
                onChange={(e) => setCancelOtherReason(e.target.value)}
                required
                error={!cancelOtherReason.trim()}
                helperText={
                  !cancelOtherReason.trim()
                    ? "Please describe why this event is being canceled."
                    : " "
                }
              />
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCancelDialogOpen(false)}>Close</Button>
          <Button
            variant="contained"
            color="error"
            onClick={cancelEvent}
            disabled={
              saving ||
              !cancelReason ||
              (cancelReason === "other" && !cancelOtherReason.trim())
            }
          >
            Confirm Cancel
          </Button>
        </DialogActions>
      </Dialog>

      {/* Contact Attempt Dialog */}
      <Dialog
        open={contactDialog}
        onClose={() => setContactDialog(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
          >
            <Typography variant="h6">Log Contact Attempt</Typography>

            <Button
              size="small"
              variant="text"
              onClick={() => setShowAttempts((s) => !s)}
            >
              {showAttempts ? "Hide Attempts" : "View Attempts"}
            </Button>
          </Stack>
        </DialogTitle>

        <DialogContent dividers>
          <Stack spacing={2}>
            {/* 🆕 Attempts list (toggleable) */}
            {showAttempts && (
              <>
                <ContactAttemptsList
                  attempts={event?.contactAttempts || []}
                  outcomeOptions={OUTCOME_OPTIONS}
                />
                <Divider sx={{ my: 2 }} />
              </>
            )}

            {/* existing form fields */}
            <RadioGroup
              row
              value={attempt.method}
              onChange={(e) =>
                setAttempt((a) => ({ ...a, method: e.target.value }))
              }
            >
              <FormControlLabel
                value="voicemail"
                control={<Radio />}
                label="Voicemail Script"
              />
              <FormControlLabel
                value="email"
                control={<Radio />}
                label="Email Script"
              />
              <FormControlLabel
                value="text"
                control={<Radio />}
                label="Text Script"
              />
            </RadioGroup>

            <TextField
              select
              label="Outcome"
              value={attempt.outcome}
              onChange={(e) =>
                setAttempt((a) => ({ ...a, outcome: e.target.value }))
              }
              fullWidth
            >
              {OUTCOME_OPTIONS.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              label={
                attempt.outcome === "followup_scheduled"
                  ? "Follow-up At"
                  : "Follow-up At (optional)"
              }
              type="datetime-local"
              value={attempt.followUpAt}
              onChange={(e) =>
                setAttempt((a) => ({ ...a, followUpAt: e.target.value }))
              }
              InputLabelProps={{ shrink: true }}
              required={attempt.outcome === "followup_scheduled"}
              fullWidth
            />

            <TextField
              label="Notes"
              multiline
              minRows={3}
              fullWidth
              value={attempt.notes}
              onChange={(e) =>
                setAttempt((a) => ({ ...a, notes: e.target.value }))
              }
            />

            <ScriptHelper
              attempt={attempt}
              form={form}
              loggedInUser={loggedInUser}
            />
          </Stack>
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setContactDialog(false)}>Close</Button>
          <Button
            variant="contained"
            onClick={() => logContactAttempt(event)}
            sx={{ backgroundColor: "var(--primary-color)" }}
          >
            Log Attempt
          </Button>
        </DialogActions>
      </Dialog>

      {/* Step Dialog */}
      <Dialog
        open={stepDialogOpen}
        onClose={() => setStepDialogOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>{title}</DialogTitle>

        <DialogContent dividers>
          <Box
            sx={{
              "& p": { mb: 1 },
              "& ul": { pl: 3, mb: 1 },
              "& li": { mb: 0.5 },
            }}
          >
            {body}
          </Box>
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setStepDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Prices Changed Dialog */}
      <Dialog
        open={confirmPricingOpen}
        onClose={() => setConfirmPricingOpen(false)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle sx={{ fontWeight: 800 }}>
          Pricing changes detected
        </DialogTitle>

        <DialogContent dividers>
          {pricingDiff && (
            <Stack spacing={2}>
              <Alert severity="warning">
                You changed details that affect pricing. Review the differences
                before saving.
              </Alert>

              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  justifyContent="space-between"
                >
                  <Typography variant="body2" color="text.secondary">
                    Old total:{" "}
                    <strong>{fmtMoneyC(pricingDiff.oldTotalC ?? 0)}</strong>
                  </Typography>

                  <Typography variant="body2" color="text.secondary">
                    New total:{" "}
                    <strong>{fmtMoneyC(pricingDiff.newTotalC ?? 0)}</strong>
                  </Typography>

                  <Typography
                    variant="body2"
                    sx={{ fontWeight: 800 }}
                    color={
                      pricingDiff.deltaTotalC >= 0
                        ? "error.main"
                        : "success.main"
                    }
                  >
                    {pricingDiff.deltaTotalC >= 0 ? "Increase" : "Decrease"}:{" "}
                    {fmtMoneyC(Math.abs(pricingDiff.deltaTotalC ?? 0))}
                  </Typography>
                </Stack>
              </Paper>

              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  Line item changes
                </Typography>

                <Stack spacing={1}>
                  {(pricingDiff.changes || []).map((row) => (
                    <Stack
                      key={row.key}
                      direction="row"
                      justifyContent="space-between"
                      alignItems="flex-start"
                      sx={{ py: 0.5 }}
                    >
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          {row.label}
                        </Typography>
                        {row.details ? (
                          <Typography variant="caption" color="text.secondary">
                            {row.details}
                          </Typography>
                        ) : null}
                      </Box>

                      <Box sx={{ textAlign: "right" }}>
                        <Typography variant="body2">
                          {fmtMoneyC(row.oldC ?? 0)} →{" "}
                          {fmtMoneyC(row.newC ?? 0)}
                        </Typography>

                        <Typography
                          variant="caption"
                          sx={{ fontWeight: 700 }}
                          color={
                            (row.deltaC ?? 0) >= 0
                              ? "error.main"
                              : "success.main"
                          }
                        >
                          {(row.deltaC ?? 0) >= 0 ? "+" : "–"}
                          {fmtMoneyC(Math.abs(row.deltaC ?? 0))}
                        </Typography>
                      </Box>
                    </Stack>
                  ))}
                </Stack>
              </Paper>
            </Stack>
          )}
        </DialogContent>

        <DialogActions sx={{ p: 2 }}>
          <Button
            variant="outlined"
            onClick={() => {
              setConfirmPricingOpen(false);
              setPendingPayload(null);
              setPricingDiff(null);
            }}
          >
            No, go back
          </Button>
          <Button
            variant="contained"
            sx={{ backgroundColor: "var(--primary-color)" }}
            onClick={confirmSaveWithNewPricing}
          >
            Yes, save changes
          </Button>
        </DialogActions>
      </Dialog>

      {/* OVERRIDE TOTAL Dialog */}
      <Dialog
        open={overrideDialogOpen}
        onClose={() => {
          setOverrideDialogOpen(false);
          // If they close without confirming, keep the checkbox off
          if (!overrideEnabled) {
            setOverrideReason("");
          }
        }}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Confirm Price Override</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" sx={{ mb: 2 }}>
            You’re about to override the calculated price. Please provide a
            reason:
          </Typography>
          <FormControl fullWidth>
            <InputLabel id="override-reason-label">
              Reason for override
            </InputLabel>

            <Select
              labelId="override-reason-label"
              value={overrideReason}
              label="Reason for override"
              onChange={(e) => setOverrideReason(e.target.value)}
            >
              {OVERRIDE_REASONS.map((reason) => (
                <MenuItem key={reason.value} value={reason.value}>
                  {reason.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {overrideReason === "other" && (
            <TextField
              sx={{ mt: 2 }}
              label="Additional details"
              fullWidth
              multiline
              minRows={2}
              value={overrideNote}
              onChange={(e) => setOverrideNote(e.target.value)}
              placeholder="Explain the override..."
            />
          )}

          <Alert severity="info" sx={{ mt: 2 }}>
            After confirming, an “Override Amount” field will appear. The total
            and deposit will be based on that amount.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setOverrideDialogOpen(false);
              // Keep override off if canceled
              setOverrideEnabled(false);
            }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              setOverrideDialogOpen(false);
              setOverrideEnabled(true);
              if (!overrideAmount) setOverrideAmount("0");
            }}
            disabled={!isValidOverride}
            color="warning"
          >
            CONFIRM OVERRIDE
          </Button>
        </DialogActions>
      </Dialog>

      {/* Collect Payment Dialog */}
      <Dialog
        open={collectPaymentOpen}
        onClose={() => setCollectPaymentOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Collect Payment</DialogTitle>

        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              fullWidth
              label="Amount Received"
              type="number"
              value={paymentForm.amount}
              onChange={(e) => {
                const raw = e.target.value;
                const next = Number(raw);
                const amount =
                  raw === ""
                    ? ""
                    : Number.isFinite(next)
                    ? Math.min(next, remainingBalance)
                    : "";
                setPaymentForm((p) => ({ ...p, amount }));
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">$</InputAdornment>
                ),
              }}
              inputProps={{
                min: 0,
                max: remainingBalance,
                step: "0.01",
              }}
              error={paymentAmountReceived > remainingBalance}
              helperText={`Current balance: ${fmtMoney(remainingBalance)}`}
            />

            <TextField
              select
              fullWidth
              label="Payment Method"
              value={paymentForm.method}
              onChange={(e) =>
                setPaymentForm((p) => ({ ...p, method: e.target.value }))
              }
            >
              <MenuItem value="square">Square</MenuItem>
              <MenuItem value="paypal">PayPal</MenuItem>
              <MenuItem value="venmo">Venmo</MenuItem>
              <MenuItem value="cashapp">Cash App</MenuItem>
              <MenuItem value="zelle">Zelle</MenuItem>
              <MenuItem value="cash">Cash</MenuItem>
              <MenuItem value="check">Check</MenuItem>
              <MenuItem value="other">Other</MenuItem>
            </TextField>

            <TextField
              fullWidth
              label="Reference / Transaction ID"
              value={paymentForm.reference}
              onChange={(e) =>
                setPaymentForm((p) => ({ ...p, reference: e.target.value }))
              }
            />

            <TextField
              fullWidth
              type="date"
              label="Date Received"
              InputLabelProps={{ shrink: true }}
              value={paymentForm.receivedAt}
              onChange={(e) =>
                setPaymentForm((p) => ({ ...p, receivedAt: e.target.value }))
              }
            />

            <TextField
              fullWidth
              multiline
              rows={3}
              label="Notes"
              value={paymentForm.notes}
              onChange={(e) =>
                setPaymentForm((p) => ({ ...p, notes: e.target.value }))
              }
            />
          </Stack>
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setCollectPaymentOpen(false)}>Cancel</Button>

          <Tooltip
            title={
              collectPaymentAmountInvalid
                ? `Enter a valid payment amount up to ${fmtMoney(maxRequestAmount)}.`
                : "Record this customer payment."
            }
          >
            <span>
              <Button
                variant="contained"
                sx={{ backgroundColor: "var(--primary-color)" }}
                disabled={collectPaymentAmountInvalid}
                onClick={handleRecordPayment}
              >
                Record Payment
              </Button>
            </span>
          </Tooltip>
        </DialogActions>
      </Dialog>

      {/* Procurement Buying Guide Dialog */}
      <Dialog
        open={procurementGuideOpen}
        onClose={() => setProcurementGuideOpen(false)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>Pickup Buying Guide</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                Use this as a planning guide when a customer is unsure what to
                buy. Final quantities should still be adjusted for the menu,
                drinking preferences, venue rules, weather, and whether alcohol
                is client-supplied.
              </Typography>

              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1}
                sx={{
                  p: 0.75,
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 2,
                  backgroundColor: "grey.50",
                }}
              >
                {[
                  { value: "rule", label: "Rule of Thumb" },
                  { value: "estimate", label: "Estimate for this event" },
                ].map((tab) => {
                  const selected = procurementGuideMode === tab.value;
                  return (
                    <Button
                      key={tab.value}
                      fullWidth
                      variant={selected ? "contained" : "text"}
                      onClick={() => setProcurementGuideMode(tab.value)}
                      sx={{
                        borderRadius: 999,
                        fontWeight: 800,
                        color: selected ? "#fff" : "text.primary",
                        backgroundColor: selected
                          ? "var(--primary-color)"
                          : "transparent",
                        boxShadow: selected ? 2 : "none",
                        "&:hover": {
                          backgroundColor: selected
                            ? "var(--primary-color)"
                            : "rgba(140, 0, 45, 0.08)",
                        },
                      }}
                    >
                      {tab.label}
                    </Button>
                  );
                })}
              </Stack>
            </Box>

            {procurementGuideMode === "rule" ? (
              <Paper
                variant="outlined"
                sx={{
                  p: { xs: 1.5, sm: 2 },
                  borderRadius: 2,
                  backgroundColor: "#fff",
                }}
              >
                <Stack spacing={1.5}>
                  {procurementBaseline.map((row, index) => (
                    <Paper
                      key={row.name}
                      variant="outlined"
                      sx={{
                        p: 1.5,
                        borderRadius: 2,
                        borderColor: "rgba(140, 0, 45, 0.18)",
                        background:
                          "linear-gradient(135deg, rgba(140, 0, 45, 0.045), rgba(255, 255, 255, 1) 55%)",
                      }}
                    >
                      <Stack
                        direction={{ xs: "column", sm: "row" }}
                        spacing={1.5}
                        alignItems={{ xs: "flex-start", sm: "center" }}
                      >
                        <Chip
                          label={index + 1}
                          size="small"
                          sx={{
                            backgroundColor: "var(--primary-color)",
                            color: "#fff",
                            fontWeight: 800,
                          }}
                        />
                        <Box>
                          <Typography variant="subtitle2" fontWeight={900}>
                            {row.name}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {row.amount}
                          </Typography>
                        </Box>
                      </Stack>
                    </Paper>
                  ))}
                </Stack>
              </Paper>
            ) : (
              <Paper
                variant="outlined"
                sx={{
                  p: { xs: 1.5, sm: 2 },
                  borderRadius: 2,
                  backgroundColor: "#fff",
                }}
              >
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={1}
                  alignItems={{ xs: "flex-start", sm: "center" }}
                  justifyContent="space-between"
                  sx={{ mb: 1.5 }}
                >
                  <Box>
                    <Typography variant="subtitle1" fontWeight={900}>
                      Estimate for this event
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Based on {procurementGuide.guests} guests,{" "}
                      {procurementGuide.hours} hour
                      {procurementGuide.hours === 1 ? "" : "s"}, and{" "}
                      {procurementGuide.typeLabel.toLowerCase()}.
                    </Typography>
                  </Box>
                  <Chip
                    label={procurementGuide.typeLabel}
                    sx={{
                      alignSelf: { xs: "flex-start", sm: "center" },
                      fontWeight: 800,
                      backgroundColor: "rgba(140, 0, 45, 0.08)",
                      color: "var(--primary-color)",
                    }}
                  />
                </Stack>

                <Grid container spacing={1.5}>
                  {procurementGuide.items.map((item) => (
                    <Grid item xs={12} sm={6} key={item.name}>
                      <Paper
                        variant="outlined"
                        sx={{
                          p: 1.5,
                          height: "100%",
                          borderRadius: 2,
                          borderColor: "rgba(140, 0, 45, 0.16)",
                        }}
                      >
                        <Stack spacing={1}>
                          <Stack
                            direction="row"
                            spacing={1}
                            alignItems="flex-start"
                            justifyContent="space-between"
                          >
                            <Typography variant="subtitle2" fontWeight={900}>
                              {item.name}
                            </Typography>
                            <Chip
                              label={item.amount}
                              size="small"
                              sx={{
                                maxWidth: "55%",
                                height: "auto",
                                py: 0.5,
                                "& .MuiChip-label": {
                                  whiteSpace: "normal",
                                  fontWeight: 900,
                                },
                                backgroundColor: "var(--primary-color)",
                                color: "#fff",
                              }}
                            />
                          </Stack>
                          <Typography variant="body2" color="text.secondary">
                            {item.note}
                          </Typography>
                        </Stack>
                      </Paper>
                    </Grid>
                  ))}
                </Grid>
              </Paper>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setProcurementGuideOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Void / Refund Payment Dialog */}
      <Dialog
        open={paymentActionOpen}
        onClose={closePaymentAction}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          {paymentActionType === "void" ? "Void Payment" : "Refund Payment"}
        </DialogTitle>

        <DialogContent dividers>
          <Stack spacing={2}>
            <Alert severity={paymentActionType === "void" ? "warning" : "info"}>
              {paymentActionType === "void" ? (
                <>
                  Void this payment if it was recorded by mistake. It will no
                  longer count toward the amount paid.
                </>
              ) : (
                <>
                  Mark this payment as refunded if money was returned to the
                  client. It will no longer count toward the amount paid.
                </>
              )}
            </Alert>

            <Typography variant="body2">
              <strong>Payment:</strong> {fmtMoney(selectedPayment?.amount || 0)}{" "}
              via {selectedPayment?.method || "unknown method"}
            </Typography>

            <TextField
              fullWidth
              multiline
              minRows={3}
              label={
                paymentActionType === "void" ? "Void reason" : "Refund notes"
              }
              value={paymentActionReason}
              onChange={(e) => setPaymentActionReason(e.target.value)}
              placeholder={
                paymentActionType === "void"
                  ? "Example: Full payment was recorded by accident."
                  : "Example: Client was refunded through the original provider."
              }
            />
          </Stack>
        </DialogContent>

        <DialogActions>
          <Button onClick={closePaymentAction} disabled={paymentActionSaving}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color={paymentActionType === "void" ? "error" : "warning"}
            onClick={handlePaymentAction}
            disabled={paymentActionSaving || !selectedPayment?._id}
          >
            {paymentActionSaving
              ? "Saving..."
              : paymentActionType === "void"
              ? "Void Payment"
              : "Mark Refunded"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DetailedEventForm;
