import React, { useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import { InfoOutlined, Paid } from "@mui/icons-material";
import api from "../../services/api";
import EmptyOverlay from "../EmptyOverlay/EmptyOverlay";
import AdminSectionHeader from "../AdminSectionHeader/AdminSectionHeader";
import AdminTableControls from "../AdminTableControls/AdminTableControls";
import DetailDrawerHeader from "../DetailDrawerHeader/DetailDrawerHeader";
import { buildSnapshotFromEvent } from "../DetailedEventForm/DetailedEventForm.pricing";
import { loadSpreadsheet } from "../../utils/loadSpreadsheet";

const fmtMoney = (n) => `$${(Number(n) || 0).toFixed(2)}`;
const roundMoney = (n) => Math.round((Number(n) || 0) * 100) / 100;
const fmtPct = (n) => `${n > 0 ? "+" : ""}${n.toFixed(1)}%`;
const fmtDateTime = (value) =>
  value ? new Date(value).toLocaleString() : "Not recorded";
const titleize = (value) =>
  String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase()) || "Unknown";
const payoutProviderLabel = (value) =>
  ({
    cashApp: "Cash App",
    cashapp: "Cash App",
    zelle: "Zelle",
    paypal: "PayPal",
    venmo: "Venmo",
    manual: "Manual",
  }[value] || (value ? titleize(value) : "No preference"));
const normalizePayoutProvider = (value) =>
  ({
    cashApp: "cashapp",
    cashapp: "cashapp",
    zelle: "zelle",
    paypal: "paypal",
    venmo: "venmo",
  }[value] || "manual");
const getPayoutProviderValue = (payoutLinks = {}, provider) => {
  if (provider === "cashapp") return payoutLinks.cashApp || "";
  if (provider === "zelle") return payoutLinks.zelle || "";
  if (provider === "paypal") return payoutLinks.paypal || "";
  if (provider === "venmo") return payoutLinks.venmo || "";
  return "";
};
const getPayoutProviderUrl = (payoutLinks = {}, provider) => {
  const raw = String(
    getPayoutProviderValue(payoutLinks, provider) || ""
  ).trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  if (provider === "cashapp") {
    const tag = raw.startsWith("$") ? raw : `$${raw.replace(/^@/, "")}`;
    return `https://cash.app/${encodeURIComponent(tag)}`;
  }
  if (provider === "venmo") {
    const username = raw.replace(/^@/, "").replace(/^u\//, "");
    return `https://venmo.com/u/${encodeURIComponent(username)}`;
  }
  return "";
};

const getRangeBounds = (range, customStart, customEnd) => {
  const now = new Date();
  let start = null;
  let end = new Date(now);

  if (range === "week") {
    start = new Date(now);
    start.setDate(now.getDate() - now.getDay());
    end = new Date(start);
    end.setDate(start.getDate() + 6);
  } else if (range === "month") {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  } else if (range === "year") {
    start = new Date(now.getFullYear(), 0, 1);
    end = new Date(now.getFullYear(), 11, 31);
  } else if (range === "custom") {
    start = customStart ? new Date(`${customStart}T00:00:00`) : null;
    end = customEnd ? new Date(`${customEnd}T23:59:59`) : null;
  }

  if (start) start.setHours(0, 0, 0, 0);
  if (end) end.setHours(23, 59, 59, 999);
  return { start, end };
};

const getPreviousBounds = (range, bounds) => {
  if (!bounds.start || !bounds.end) return null;

  const start = new Date(bounds.start);
  const end = new Date(bounds.end);
  const prevStart = new Date(start);
  const prevEnd = new Date(end);

  if (range === "week") {
    prevStart.setDate(prevStart.getDate() - 7);
    prevEnd.setDate(prevEnd.getDate() - 7);
  } else if (range === "month") {
    prevStart.setMonth(prevStart.getMonth() - 1);
    prevEnd.setMonth(prevEnd.getMonth() - 1);
  } else if (range === "year") {
    prevStart.setFullYear(prevStart.getFullYear() - 1);
    prevEnd.setFullYear(prevEnd.getFullYear() - 1);
  } else {
    const spanMs = end.getTime() - start.getTime();
    prevEnd.setTime(start.getTime() - 1);
    prevStart.setTime(prevEnd.getTime() - spanMs);
  }

  return { start: prevStart, end: prevEnd };
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

const getExpectedAssignmentPay = (assignment, fallbackEvent) => {
  const event =
    assignment?.event && typeof assignment.event === "object"
      ? assignment.event
      : fallbackEvent || {};
  const pricing = event?.pricing || {};
  const hours =
    getEventHours(event) +
    (Number(pricing.setupHours) || 0) +
    (Number(pricing.breakdownHours) || 0);
  const hourlyPay = hours * (Number(pricing.hourlyRate) || 0);
  const bartenderCount =
    Number(event?.counts?.neededBartenders) ||
    Number(pricing.bartendersRequested) ||
    1;
  const subtotal =
    Number(event?.payment?.subtotal) ||
    hourlyPay * bartenderCount + (Number(pricing.bookingFee) || 0);
  const gratuity =
    Number(event?.payment?.gratuity) ||
    subtotal * (Number(pricing.gratuityPct) || 0);
  return hourlyPay + gratuity / Math.max(1, bartenderCount);
};

const getEventTotal = (event, received) => {
  const snapshotTotal =
    Number(buildSnapshotFromEvent(event)?.totals?.totalC || 0) / 100;
  return (
    Math.max(
      Number(event?.payment?.total) || 0,
      Number(event?.payment?.subtotal) || 0,
      snapshotTotal
    ) ||
    Number(event?.payment?.total) ||
    Number(event?.payment?.subtotal) ||
    Number(received) ||
    0
  );
};

const getCustomerPaymentStatus = (received, total) => {
  if (total > 0 && received >= total) return "Paid in full";
  if (received > 0) return "Partially paid";
  return "Unpaid";
};
const getEventId = (event) => {
  if (!event) return "";
  if (typeof event === "string") return event;
  return String(event._id || event.id || event || "");
};
const getPaymentEvent = (payment) =>
  payment?.event && typeof payment.event === "object" ? payment.event : {};
const getRecordedPaidTotal = (event) =>
  Number(event?.payment?.paidTotal) ||
  Number(event?.recordedPaidTotal) ||
  Number(event?.paidTotal) ||
  0;

const buildFinanceRows = ({
  events,
  payments,
  assignmentsByEvent,
  payoutByAssignmentId,
}) => {
  const map = {};

  (events || []).forEach((event) => {
    const eventId = getEventId(event);
    if (!eventId) return;
    if (event.status === "canceled") return;
    if (!getEventTotal(event, 0)) return;

    map[eventId] = {
      id: eventId,
      event,
      eventLabel: event.shortCode || event.type || "Event",
      date: event.startAt
        ? new Date(event.startAt).toLocaleDateString()
        : "TBD",
      received: getRecordedPaidTotal(event),
      paymentCount: 0,
    };
  });

  (payments || []).forEach((payment) => {
    if (payment.status !== "recorded") return;

    const event = getPaymentEvent(payment);
    const eventId = getEventId(payment.event);
    if (!eventId) return;

    if (!map[eventId]) {
      map[eventId] = {
        id: eventId,
        event,
        eventLabel: event.shortCode || event.type || "Event",
        date: event.startAt
          ? new Date(event.startAt).toLocaleDateString()
          : "TBD",
        received: 0,
        paymentCount: 0,
      };
    }

    const paidFromEventSummary = getRecordedPaidTotal(map[eventId].event);
    if (!map[eventId].paymentCount && paidFromEventSummary) {
      map[eventId].received = 0;
    }
    map[eventId].received += Number(payment.amount) || 0;
    map[eventId].paymentCount += 1;
  });

  return Object.values(map)
    .map((row) => {
      const assignments = assignmentsByEvent[row.id] || [];
      const bartenderExpected = assignments.reduce(
        (sum, assignment) =>
          sum + getExpectedAssignmentPay(assignment, row.event),
        0
      );
      const bartenderPaid = assignments.reduce(
        (sum, assignment) => sum + (payoutByAssignmentId[assignment._id] || 0),
        0
      );
      const customerTotal = getEventTotal(row.event, row.received);
      const customerBalance = Math.max(0, customerTotal - row.received);
      const bartenderBalance = Math.max(0, bartenderExpected - bartenderPaid);

      return {
        ...row,
        customerTotal,
        customerBalance,
        customerStatus: getCustomerPaymentStatus(row.received, customerTotal),
        bartenderExpected,
        bartenderPaid,
        bartenderBalance,
        actualProfit: row.received - bartenderExpected,
        projectedProfit: customerTotal - bartenderExpected,
      };
    })
    .sort(
      (a, b) => b.customerBalance - a.customerBalance || b.received - a.received
    );
};

const sumRows = (rows) =>
  rows.reduce(
    (sum, row) => ({
      received: sum.received + row.received,
      customerBalance: sum.customerBalance + row.customerBalance,
      bartenderBalance: sum.bartenderBalance + row.bartenderBalance,
      actualProfit: sum.actualProfit + row.actualProfit,
      projectedProfit: sum.projectedProfit + row.projectedProfit,
    }),
    {
      received: 0,
      customerBalance: 0,
      bartenderBalance: 0,
      actualProfit: 0,
      projectedProfit: 0,
    }
  );

const getChangePct = (current, previous) => {
  if (!previous) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
};

const sameId = (left, right) => String(left || "") === String(right || "");
const isEventDone = (event) =>
  ["completed", "closed"].includes(String(event?.status || "").toLowerCase()) ||
  !!event?.completedAt;
const PROFIT_ALLOCATIONS = [
  { key: "taxes", label: "Taxes", percent: 25 },
  { key: "emergency", label: "Emergency Fund", percent: 15 },
  { key: "operations", label: "Operations: Tools, Supplies & Payroll", percent: 15 },
  { key: "equipment", label: "Equipment & Welcome Kits", percent: 15 },
  { key: "marketing", label: "Marketing", percent: 10 },
  { key: "technology", label: "Technology & App Development", percent: 10 },
  { key: "owner", label: "Owner Distribution", percent: 10 },
];
const buildProfitAllocationRows = (profit) => {
  const profitCents = Math.max(0, Math.floor((Number(profit) || 0) * 100));
  const rows = PROFIT_ALLOCATIONS.map((bucket) => ({
    ...bucket,
    amountCents: Math.floor((profitCents * bucket.percent) / 100),
  }));
  const allocatedCents = rows.reduce((sum, row) => sum + row.amountCents, 0);

  return {
    rows,
    allocated: allocatedCents / 100,
    remainder: Math.max(0, profitCents - allocatedCents) / 100,
  };
};

export default function AdminFinance() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const isTablet = useMediaQuery(theme.breakpoints.down("md"));
  const isCompactTable = useMediaQuery(theme.breakpoints.down("lg"));
  const loggedInUser = useSelector(
    (state) => state.users.loggedInUser?.user || state.users.loggedInUser
  );
  const [events, setEvents] = useState([]);
  const [payments, setPayments] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const [assignmentsByEvent, setAssignmentsByEvent] = useState({});
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState("month");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [tableFilter, setTableFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [allocationOpen, setAllocationOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [alert, setAlert] = useState(null);
  const [payoutForm, setPayoutForm] = useState({
    reference: "",
    notes: "",
  });
  const [payoutProviderByAssignment, setPayoutProviderByAssignment] = useState(
    {}
  );
  const [payoutAmountByAssignment, setPayoutAmountByAssignment] = useState({});
  const [payoutLinkOpenedByAssignment, setPayoutLinkOpenedByAssignment] =
    useState({});
  const actorPositionName = String(
    loggedInUser?.employeeDetails?.position?.name ||
      loggedInUser?.positionName ||
      ""
  ).toLowerCase();
  const canViewProfitAllocation =
    actorPositionName === "owner" || actorPositionName === "owners";

  const loadFinance = async () => {
    setLoading(true);
    try {
      const [paymentsRes, payoutsRes, eventsRes] = await Promise.allSettled([
        api.get("/payments"),
        api.get("/payouts"),
        api.get("/events"),
      ]);
      const failedSources = [
        paymentsRes.status === "rejected" ? "payments" : null,
        payoutsRes.status === "rejected" ? "payouts" : null,
        eventsRes.status === "rejected" ? "events" : null,
      ].filter(Boolean);
      const nextPayments =
        paymentsRes.status === "fulfilled"
          ? paymentsRes.value.data?.data || paymentsRes.value.data || []
          : [];
      const nextPayouts =
        payoutsRes.status === "fulfilled"
          ? payoutsRes.value.data?.data || payoutsRes.value.data || []
          : [];
      const eventsPayload =
        eventsRes.status === "fulfilled"
          ? eventsRes.value.data?.data || eventsRes.value.data || []
          : [];
      const nextEvents = Array.isArray(eventsPayload?.items)
        ? eventsPayload.items
        : Array.isArray(eventsPayload)
        ? eventsPayload
        : [];
      setPayments(nextPayments);
      setPayouts(nextPayouts);
      setEvents(nextEvents);

      const eventIds = [
        ...new Set(
          [
            ...nextPayments.map(
              (payment) => payment.event?._id || payment.event
            ),
            ...nextEvents.map((event) => event._id),
          ].filter(Boolean)
        ),
      ];

      const assignmentPairs = await Promise.all(
        eventIds.map(async (eventId) => {
          try {
            const res = await api.get(`/assignments/event/${eventId}`);
            return [eventId, res.data?.data || res.data || []];
          } catch {
            return [eventId, []];
          }
        })
      );
      setAssignmentsByEvent(Object.fromEntries(assignmentPairs));
      if (failedSources.length) {
        setAlert({
          severity: "warning",
          message: `Finance loaded partially. Failed to load: ${failedSources.join(
            ", "
          )}.`,
        });
      }
    } catch (err) {
      setAlert({
        severity: "error",
        message: err?.response?.data?.message || "Failed to load finance data.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFinance();
  }, []);

  const bounds = useMemo(
    () => getRangeBounds(range, customStart, customEnd),
    [customEnd, customStart, range]
  );
  const previousBounds = useMemo(
    () => getPreviousBounds(range, bounds),
    [bounds, range]
  );

  const rangePayments = useMemo(
    () =>
      (payments || []).filter((payment) =>
        isDateInRange(
          payment.receivedAt || payment.createdAt || payment.event?.startAt,
          bounds
        )
      ),
    [bounds, payments]
  );

  const rangeEvents = useMemo(
    () =>
      (events || []).filter((event) =>
        isDateInRange(event.startAt || event.createdAt, bounds)
      ),
    [bounds, events]
  );

  const previousRangePayments = useMemo(
    () =>
      previousBounds
        ? (payments || []).filter((payment) =>
            isDateInRange(
              payment.receivedAt || payment.createdAt || payment.event?.startAt,
              previousBounds
            )
          )
        : [],
    [payments, previousBounds]
  );

  const previousRangeEvents = useMemo(
    () =>
      previousBounds
        ? (events || []).filter((event) =>
            isDateInRange(event.startAt || event.createdAt, previousBounds)
          )
        : [],
    [events, previousBounds]
  );

  const payoutByAssignmentId = useMemo(() => {
    const map = {};
    (payouts || []).forEach((payout) => {
      if (payout.status === "failed") return;
      const assignmentId = payout.assignment?._id || payout.assignment;
      if (!assignmentId) return;
      map[assignmentId] =
        (map[assignmentId] || 0) + (Number(payout.amount) || 0);
    });
    return map;
  }, [payouts]);

  const rows = useMemo(
    () =>
      buildFinanceRows({
        events: rangeEvents,
        payments: rangePayments,
        assignmentsByEvent,
        payoutByAssignmentId,
      }),
    [assignmentsByEvent, payoutByAssignmentId, rangeEvents, rangePayments]
  );

  const previousRows = useMemo(
    () =>
      buildFinanceRows({
        events: previousRangeEvents,
        payments: previousRangePayments,
        assignmentsByEvent,
        payoutByAssignmentId,
      }),
    [
      assignmentsByEvent,
      payoutByAssignmentId,
      previousRangeEvents,
      previousRangePayments,
    ]
  );

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filteredByCard =
      tableFilter === "receivable"
        ? rows.filter((row) => row.customerBalance > 0)
        : tableFilter === "payable"
        ? rows.filter((row) => row.bartenderBalance > 0)
        : tableFilter === "paid"
        ? rows.filter((row) => row.customerBalance <= 0)
        : tableFilter === "profit"
        ? rows.filter(
        (row) => row.actualProfit !== 0 || row.projectedProfit !== 0
      )
        : rows;

    if (!term) return filteredByCard;

    return filteredByCard.filter((row) =>
      [
        row.eventLabel,
        row.event?.shortCode,
        row.event?.status,
        row.event?.type,
        row.event?.contact?.fullName,
        row.event?.contact?.email,
        row.event?.contact?.phone,
        row.customerStatus,
        row.bartenderStatus,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    );
  }, [rows, search, tableFilter]);
  const emptyFinanceMessage =
    rows.length === 0
      ? "No finance rows match the selected date range. Confirm an event or record a payment first."
      : "No finance rows match this filter.";

  const selectedRow = rows.find((row) => row.id === selectedEventId) || null;
  const selectedEventDone = isEventDone(selectedRow?.event);
  const selectedAssignments = selectedEventId
    ? assignmentsByEvent[selectedEventId] || []
    : [];
  const selectedPayments = useMemo(
    () =>
      selectedEventId
        ? (payments || [])
            .filter((payment) =>
              sameId(payment.event?._id || payment.event, selectedEventId)
            )
            .sort(
              (a, b) =>
                new Date(b.receivedAt || b.createdAt || 0) -
                new Date(a.receivedAt || a.createdAt || 0)
            )
        : [],
    [payments, selectedEventId]
  );
  const selectedPayouts = useMemo(
    () =>
      selectedEventId
        ? (payouts || [])
            .filter((payout) =>
              sameId(payout.event?._id || payout.event, selectedEventId)
            )
            .sort(
              (a, b) =>
                new Date(b.paidAt || b.scheduledAt || b.createdAt || 0) -
                new Date(a.paidAt || a.scheduledAt || a.createdAt || 0)
            )
        : [],
    [payouts, selectedEventId]
  );

  const payoutRows = selectedAssignments.map((assignment) => {
    const expected = getExpectedAssignmentPay(assignment, selectedRow?.event);
    const paid = payoutByAssignmentId[assignment._id] || 0;
    const preferredProvider = normalizePayoutProvider(
      assignment.bartenderUser?.bartenderProfile?.payoutLinks?.preferredProvider
    );
    return {
      assignment,
      bartender: assignment.bartenderUser,
      expected,
      paid,
      remaining: Math.max(0, expected - paid),
      preferredProvider,
    };
  });

  const totals = useMemo(() => sumRows(rows), [rows]);
  const previousTotals = useMemo(() => sumRows(previousRows), [previousRows]);
  const completedProfit = useMemo(
    () =>
      rows
        .filter((row) => isEventDone(row.event))
        .reduce((sum, row) => sum + Math.max(0, Number(row.actualProfit) || 0), 0),
    [rows]
  );
  const profitAllocation = useMemo(
    () => buildProfitAllocationRows(completedProfit),
    [completedProfit]
  );

  const financeCards = [
    {
      id: "received",
      filter: "all",
      label: "Company received",
      value: totals.received,
      previous: previousTotals.received,
      helper: "Payments collected",
    },
    {
      id: "payable",
      filter: "payable",
      label: "Owed to bartenders",
      value: totals.bartenderBalance,
      previous: previousTotals.bartenderBalance,
      helper: "Accounts payable",
    },
    {
      id: "receivable",
      filter: "receivable",
      label: "Customers owe us",
      value: totals.customerBalance,
      previous: previousTotals.customerBalance,
      helper: "Accounts receivable",
    },
    {
      id: "actualProfit",
      filter: "profit",
      label: "Actual profit",
      value: totals.actualProfit,
      previous: previousTotals.actualProfit,
      helper: "Received - bartender",
    },
    {
      id: "projectedProfit",
      filter: "profit",
      label: "Projected profit",
      value: totals.projectedProfit,
      previous: previousTotals.projectedProfit,
      helper: "Customer - bartender",
    },
  ];

  const recordPayout = async (row) => {
    if (!selectedEventDone) return;
    const amount = roundMoney(payoutAmountByAssignment[row.assignment._id]);
    if (!amount || amount <= 0 || amount > roundMoney(row.remaining)) return;
    const provider =
      payoutProviderByAssignment[row.assignment._id] || row.preferredProvider;
    const providerUrl = getPayoutProviderUrl(
      row.bartender?.bartenderProfile?.payoutLinks,
      provider
    );
    if (providerUrl && !payoutLinkOpenedByAssignment[row.assignment._id])
      return;

    setRecording(true);
    try {
      await api.post("/payouts", {
        event: selectedEventId,
        assignment: row.assignment._id,
        bartenderUser: row.bartender?._id || row.bartender,
        amount,
        provider,
        reference: payoutForm.reference,
        notes: payoutForm.notes,
      });
      setAlert({ severity: "success", message: "Payout recorded." });
      setPayoutForm({ reference: "", notes: "" });
      setPayoutAmountByAssignment((prev) => ({
        ...prev,
        [row.assignment._id]: "",
      }));
      setPayoutLinkOpenedByAssignment((prev) => ({
        ...prev,
        [row.assignment._id]: false,
      }));
      await loadFinance();
    } catch (err) {
      setAlert({
        severity: "error",
        message: err?.response?.data?.message || "Failed to record payout.",
      });
    } finally {
      setRecording(false);
    }
  };

  const handleRefresh = async () => {
    await loadFinance();
    setAlert({ severity: "success", message: "Finance refreshed." });
  };

  const handleDownloadExcel = async () => {
    const XLSX = await loadSpreadsheet();
    const worksheet = XLSX.utils.json_to_sheet(
      filteredRows.map((row) => ({
        "Event Code": row.eventLabel,
        "Event Date": row.date,
        Status: row.customerStatus,
        Received: row.received,
        "Customer Balance": row.customerBalance,
        "Bartender Expected": row.bartenderExpected,
        "Bartender Paid": row.bartenderPaid,
        "Bartender Balance": row.bartenderBalance,
        "Actual Profit": row.actualProfit,
        "Projected Profit": row.projectedProfit,
      }))
    );
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Finance");
    XLSX.writeFile(workbook, "Finance.xlsx");
  };

  const columns = [
    { field: "eventLabel", headerName: "Event Code", width: isMobile ? 135 : 155 },
    { field: "date", headerName: "Event Date", flex: 1, minWidth: 130 },
    {
      field: "customerStatus",
      headerName: "Status",
      flex: 1,
      minWidth: 150,
      renderCell: (params) => (
        <Chip
          size="small"
          label={params.row.customerStatus}
          color={
            params.row.customerBalance <= 0
              ? "success"
              : params.row.received > 0
              ? "warning"
              : "error"
          }
          variant={params.row.customerBalance <= 0 ? "filled" : "outlined"}
        />
      ),
    },
    {
      field: "received",
      headerName: "Received",
      flex: 1,
      minWidth: 120,
      renderCell: (params) => fmtMoney(params.row.received),
    },
    {
      field: "customerBalance",
      headerName: "Customer Balance",
      flex: 1,
      minWidth: 150,
      renderCell: (params) => fmtMoney(params.row.customerBalance),
    },
    {
      field: "bartenderBalance",
      headerName: "Bartender Balance",
      flex: 1,
      minWidth: 160,
      renderCell: (params) => fmtMoney(params.row.bartenderBalance),
    },
    {
      field: "actions",
      headerName: "Action",
      sortable: false,
      filterable: false,
      width: 130,
      align: "center",
      headerAlign: "center",
      renderCell: (params) => (
        <Button
          size="small"
          variant="outlined"
          sx={{
            borderColor: "var(--primary-color)",
            color: "var(--primary-color)",
            whiteSpace: "nowrap",
          }}
          onClick={() => setSelectedEventId(params.row.id)}
        >
          Review
        </Button>
      ),
    },
  ];

  return (
    <Stack spacing={2}>
      <AdminSectionHeader
        title="Finance"
        subtitle="Track event payments received and record bartender payout disbursements."
        onRefresh={handleRefresh}
        onDownload={handleDownloadExcel}
      />

      {alert && (
        <Alert severity={alert.severity} onClose={() => setAlert(null)}>
          {alert.message}
        </Alert>
      )}

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack spacing={2}>
          <Stack
            direction={{ xs: "column", lg: "row" }}
            spacing={1.5}
            alignItems="stretch"
          >
            {financeCards.map((card) => {
              const changePct = getChangePct(card.value, card.previous);
              const active = tableFilter === card.filter;

              return (
                <Paper
                  key={card.id}
                  variant="outlined"
                  role="button"
                  tabIndex={0}
                  onClick={() =>
                    setTableFilter((current) =>
                      current === card.filter ? "all" : card.filter
                    )
                  }
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" && event.key !== " ") return;
                    event.preventDefault();
                    setTableFilter((current) =>
                      current === card.filter ? "all" : card.filter
                    );
                  }}
                  sx={{
                    flex: 1,
                    minWidth: { xs: "100%", lg: 0 },
                    textAlign: "left",
                    p: 1.5,
                    border: "1px solid",
                    position: "relative",
                    cursor: "pointer",
                    borderColor: active
                      ? "var(--primary-color)"
                      : "rgba(0, 0, 0, 0.25)",
                    bgcolor: active
                      ? "rgba(139, 0, 38, 0.06)"
                      : "background.paper",
                    color: "text.primary",
                    font: "inherit",
                    "&:hover": {
                      borderColor: "var(--primary-color)",
                      bgcolor: active
                        ? "rgba(139, 0, 38, 0.08)"
                        : "rgba(128, 0, 32, 0.04)",
                    },
                  }}
                >
                  <Box sx={{ width: "100%" }}>
                    <Stack
                      direction="row"
                      spacing={0.75}
                      justifyContent="space-between"
                      alignItems="center"
                    >
                      <Typography
                        variant="caption"
                        sx={{ color: "text.secondary" }}
                      >
                        {card.label}
                      </Typography>
                      {canViewProfitAllocation && card.id === "actualProfit" && (
                        <Tooltip title="View profit allocation suggestions">
                          <IconButton
                            size="small"
                            aria-label="View profit allocation suggestions"
                            onClick={(event) => {
                              event.stopPropagation();
                              setAllocationOpen(true);
                            }}
                            onKeyDown={(event) => event.stopPropagation()}
                            sx={{ color: "var(--primary-color)", mr: -0.5 }}
                          >
                            <InfoOutlined fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Stack>
                    <Typography variant="h5" fontWeight={800}>
                      {fmtMoney(card.value)}
                    </Typography>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography
                        variant="caption"
                        sx={{ color: "text.secondary" }}
                      >
                        {card.helper}
                      </Typography>
                      {changePct !== null && (
                        <Chip
                          size="small"
                          label={fmtPct(changePct)}
                          color={changePct >= 0 ? "success" : "error"}
                          sx={{ height: 20 }}
                        />
                      )}
                    </Stack>
                  </Box>
                </Paper>
              );
            })}
          </Stack>

          <AdminTableControls
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search event, customer, status, or type..."
            sx={{ mb: 0 }}
          >
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel id="finance-range-label">Range</InputLabel>
              <Select
                labelId="finance-range-label"
                label="Range"
                value={range}
                onChange={(e) => {
                  setRange(e.target.value);
                  setTableFilter("all");
                }}
              >
                <MenuItem value="week">This week</MenuItem>
                <MenuItem value="month">This month</MenuItem>
                <MenuItem value="year">This year</MenuItem>
                <MenuItem value="custom">Custom</MenuItem>
              </Select>
            </FormControl>
            {range === "custom" && (
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
            {tableFilter !== "all" && (
              <Button variant="text" onClick={() => setTableFilter("all")}>
                Clear filter
              </Button>
            )}
          </AdminTableControls>
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ height: 520, width: "100%" }}>
        <DataGrid
          rows={filteredRows}
          columns={columns}
          loading={loading}
          disableRowSelectionOnClick
          columnVisibilityModel={{
            date: !isMobile,
            customerStatus: !isMobile,
            received: !isCompactTable,
            customerBalance: !isTablet,
            bartenderBalance: !isCompactTable,
          }}
          pageSizeOptions={[10, 25, 50]}
          initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
          slots={{
            noRowsOverlay: () => (
              <EmptyOverlay message={emptyFinanceMessage} />
            ),
          }}
          // MUI v5 fallback (safe to keep)
          components={{
            NoRowsOverlay: () => (
              <EmptyOverlay message={emptyFinanceMessage} />
            ),
          }}
        />
      </Paper>

      <Dialog
        open={canViewProfitAllocation && allocationOpen}
        onClose={() => setAllocationOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Profit Allocation Suggestions</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Completed-event profit in selected range
              </Typography>
              <Typography variant="h4" fontWeight={800}>
                {fmtMoney(completedProfit)}
              </Typography>
            </Box>

            {completedProfit <= 0 ? (
              <Alert severity="info">
                No completed-event profit is available to allocate for this
                date range yet.
              </Alert>
            ) : (
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: {
                    xs: "1fr",
                    sm: "repeat(2, minmax(0, 1fr))",
                  },
                  gap: 1,
                }}
              >
                {profitAllocation.rows.map((bucket) => (
                  <Paper key={bucket.key} variant="outlined" sx={{ p: 1.5 }}>
                    <Typography variant="caption" color="text.secondary">
                      {bucket.percent}% · {bucket.label}
                    </Typography>
                    <Typography variant="h6" fontWeight={800}>
                      {fmtMoney(bucket.amountCents / 100)}
                    </Typography>
                  </Paper>
                ))}
              </Box>
            )}

            <Typography variant="body2" color="text.secondary">
              Allocated total: {fmtMoney(profitAllocation.allocated)}
              {profitAllocation.remainder > 0
                ? ` · Unallocated rounding remainder: ${fmtMoney(
                    profitAllocation.remainder
                  )}`
                : ""}
              . These are suggested reserve buckets only. Actual transfers
              still need to be recorded outside Tipsyverse until allocation
              tracking is connected to backend finance records.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAllocationOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={!!selectedRow}
        onClose={() => setSelectedEventId(null)}
        fullWidth
        maxWidth="md"
      >
        {selectedRow && (
          <DialogTitle sx={{ p: 0 }}>
            <DetailDrawerHeader
              title={`${selectedRow.eventLabel || "Event"} Finance`}
              summary={
                selectedRow.customerBalance > 0
                  ? "This event has a customer balance due. Review payment records before sending reminders or closing the event."
                  : selectedEventDone
                    ? "This completed event is paid from the customer side. Review bartender payouts before closing finance work."
                    : "This event is still active. Payout controls unlock after the event is completed."
              }
              statusChip={
                <Chip
                  size="small"
                  label={selectedRow.customerStatus}
                  color={selectedRow.customerBalance > 0 ? "warning" : "success"}
                />
              }
              facts={[
                { label: "Total", value: fmtMoney(selectedRow.customerTotal) },
                { label: "Received", value: fmtMoney(selectedRow.received) },
                { label: "Balance", value: fmtMoney(selectedRow.customerBalance) },
                { label: "Actual Profit", value: fmtMoney(selectedRow.actualProfit) },
              ]}
              lastUpdated={
                selectedRow.event?.updatedAt
                  ? `Last updated ${fmtDateTime(selectedRow.event.updatedAt)}`
                  : "Last updated not recorded"
              }
              onClose={() => setSelectedEventId(null)}
            />
          </DialogTitle>
        )}
        <DialogContent dividers>
          {selectedRow && (
            <Stack spacing={2}>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Stack spacing={1}>
                  <Typography variant="subtitle1" fontWeight={700}>
                    Event Details
                  </Typography>
                  <Typography variant="body2">
                    <strong>{selectedRow.eventLabel}</strong>
                    {selectedRow.event?.type
                      ? ` - ${titleize(selectedRow.event.type)}`
                      : ""}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {selectedRow.event?.startAt
                      ? `${new Date(
                          selectedRow.event.startAt
                        ).toLocaleString()}${
                          selectedRow.event?.endAt
                            ? ` to ${new Date(
                                selectedRow.event.endAt
                              ).toLocaleString()}`
                            : ""
                        }`
                      : "Date not recorded"}
                  </Typography>
                  {(selectedRow.event?.description ||
                    selectedRow.event?.additionalInstructions) && (
                    <Typography variant="body2">
                      {selectedRow.event?.description ||
                        selectedRow.event?.additionalInstructions}
                    </Typography>
                  )}
                </Stack>
              </Paper>

            

              <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                <Paper variant="outlined" sx={{ p: 2, flex: 1 }}>
                  <Typography variant="subtitle2" fontWeight={700}>
                    Customer Detail
                  </Typography>
                  <Typography variant="body2">
                    {selectedRow.event?.contact?.fullName ||
                      selectedRow.event?.contact?.name ||
                      "Customer name not recorded"}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {selectedRow.event?.contact?.email || "Email not recorded"}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {selectedRow.event?.contact?.phone || "Phone not recorded"}
                  </Typography>
                </Paper>
                <Paper variant="outlined" sx={{ p: 2, flex: 1 }}>
                  <Typography variant="subtitle2" fontWeight={700}>
                    Bartender Contacts
                  </Typography>
                  {payoutRows.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                      No assigned bartenders.
                    </Typography>
                  ) : (
                    <Stack spacing={0.5}>
                      {payoutRows.map((row) => (
                        <Box key={row.assignment._id}>
                          <Typography variant="body2">
                            {row.bartender?.fullName || "Bartender"}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {row.bartender?.email || "Email not recorded"}
                          </Typography>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            display="block"
                          >
                            Preferred payout:{" "}
                            {payoutProviderLabel(
                              row.bartender?.bartenderProfile?.payoutLinks
                                ?.preferredProvider
                            )}
                          </Typography>
                        </Box>
                      ))}
                    </Stack>
                  )}
                </Paper>
              </Stack>

              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <Paper variant="outlined" sx={{ p: 2, flex: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    Event
                  </Typography>
                  <Typography fontWeight={700}>
                    {selectedRow.eventLabel}
                  </Typography>
                </Paper>
                <Paper variant="outlined" sx={{ p: 2, flex: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    Customer
                  </Typography>
                  <Typography fontWeight={700}>
                    {selectedRow.customerStatus}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {fmtMoney(selectedRow.received)} /{" "}
                    {fmtMoney(selectedRow.customerTotal)}
                  </Typography>
                </Paper>
                <Paper variant="outlined" sx={{ p: 2, flex: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    Customer balance
                  </Typography>
                  <Typography fontWeight={700}>
                    {fmtMoney(selectedRow.customerBalance)}
                  </Typography>
                </Paper>
              </Stack>

              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <Paper variant="outlined" sx={{ p: 2, flex: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    Bartender balance
                  </Typography>
                  <Typography fontWeight={700}>
                    {fmtMoney(selectedRow.bartenderBalance)}
                  </Typography>
                </Paper>
                <Paper variant="outlined" sx={{ p: 2, flex: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    Actual profit
                  </Typography>
                  <Typography fontWeight={700}>
                    {fmtMoney(selectedRow.actualProfit)}
                  </Typography>
                </Paper>
                <Paper variant="outlined" sx={{ p: 2, flex: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    Projected profit
                  </Typography>
                  <Typography fontWeight={700}>
                    {fmtMoney(selectedRow.projectedProfit)}
                  </Typography>
                </Paper>
              </Stack>

              <Divider />

              <Typography variant="subtitle1" fontWeight={700}>
                Customer Payment Records
              </Typography>

              {selectedPayments.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No customer payment records for this event yet.
                </Typography>
              ) : (
                <Stack spacing={1}>
                  {selectedPayments.map((payment) => (
                    <Paper key={payment._id} variant="outlined" sx={{ p: 1.5 }}>
                      <Stack
                        direction={{ xs: "column", sm: "row" }}
                        justifyContent="space-between"
                        spacing={1}
                      >
                        <Box>
                          <Stack
                            direction="row"
                            spacing={1}
                            alignItems="center"
                          >
                            <Typography fontWeight={700}>
                              {fmtMoney(payment.amount)}
                            </Typography>
                            <Chip
                              size="small"
                              label={titleize(payment.status)}
                              color={
                                payment.status === "recorded"
                                  ? "success"
                                  : payment.status === "refunded"
                                  ? "warning"
                                  : "default"
                              }
                            />
                          </Stack>
                          <Typography variant="body2" color="text.secondary">
                            {titleize(payment.method)} -{" "}
                            {fmtDateTime(
                              payment.receivedAt || payment.createdAt
                            )}
                          </Typography>
                          {(payment.reference ||
                            payment.notes ||
                            payment.voidReason) && (
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              display="block"
                            >
                              {[
                                payment.reference,
                                payment.notes,
                                payment.voidReason,
                              ]
                                .filter(Boolean)
                                .join(" - ")}
                            </Typography>
                          )}
                        </Box>
                        <Typography variant="caption" color="text.secondary">
                          {payment.status === "voided"
                            ? `Voided ${fmtDateTime(payment.voidedAt)}`
                            : payment.status === "refunded"
                            ? `Refunded ${fmtDateTime(
                                payment.voidedAt || payment.updatedAt
                              )}`
                            : payment.collectedBy?.fullName
                            ? `Collected by ${payment.collectedBy.fullName}`
                            : ""}
                        </Typography>
                      </Stack>
                    </Paper>
                  ))}
                </Stack>
              )}

              <Divider />

              <Typography variant="subtitle1" fontWeight={700}>
                Bartender Disbursements
              </Typography>
              {!selectedEventDone && (
                <Alert severity="info">
                  Bartender payout controls unlock after the event is marked
                  completed.
                </Alert>
              )}

              {payoutRows.length === 0 && (
                <Typography variant="body2" color="text.secondary">
                  No active bartenders are assigned to this event.
                </Typography>
              )}

              <Stack spacing={1.5}>
                {payoutRows.map((row) => {
                  const assignmentId = row.assignment._id;
                  const selectedProvider =
                    payoutProviderByAssignment[assignmentId] ||
                    row.preferredProvider;
                  const providerUrl = getPayoutProviderUrl(
                    row.bartender?.bartenderProfile?.payoutLinks,
                    selectedProvider
                  );
                  const amountValue =
                    payoutAmountByAssignment[assignmentId] || "";
                  const amountNumber = roundMoney(amountValue);
                  const remaining = roundMoney(row.remaining);
                  const hasAmount = amountNumber > 0;
                  const exceedsBalance = hasAmount && amountNumber > remaining;
                  const hasOpenedRequiredLink =
                    !providerUrl ||
                    !!payoutLinkOpenedByAssignment[assignmentId];
                  const canRecord =
                    selectedEventDone &&
                    !recording &&
                    remaining > 0 &&
                    hasAmount &&
                    !exceedsBalance &&
                    hasOpenedRequiredLink;
                  const recordDisabledReason = !selectedEventDone
                    ? "Payouts can be recorded after the event is completed."
                    : recording
                    ? "A payout is currently being recorded."
                    : remaining <= 0
                    ? "This bartender has no remaining payout balance."
                    : !hasAmount
                    ? "Enter the payout amount first."
                    : exceedsBalance
                    ? "The payout amount cannot exceed the remaining balance."
                    : !hasOpenedRequiredLink
                    ? `Open the ${payoutProviderLabel(selectedProvider)} link before recording this payout.`
                    : "Record this payout.";

                  return (
                    <Paper
                      key={assignmentId}
                      variant="outlined"
                      sx={{ p: 1.5 }}
                    >
                      <Stack
                        direction={{ xs: "column", md: "row" }}
                        spacing={1.5}
                        alignItems={{ md: "center" }}
                      >
                        <Box sx={{ flex: 1 }}>
                          <Typography fontWeight={700}>
                            {row.bartender?.fullName || "Bartender"}
                          </Typography>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            display="block"
                          >
                            Expected {fmtMoney(row.expected)} - Paid{" "}
                            {fmtMoney(row.paid)}
                          </Typography>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            display="block"
                          >
                            Preferred payout:{" "}
                            {payoutProviderLabel(
                              row.bartender?.bartenderProfile?.payoutLinks
                                ?.preferredProvider
                            )}
                          </Typography>
                          <Chip
                            size="small"
                            color={row.remaining > 0 ? "warning" : "success"}
                            label={`Balance ${fmtMoney(row.remaining)}`}
                            sx={{ mt: 0.5 }}
                          />
                          {exceedsBalance && (
                            <Typography
                              variant="caption"
                              color="error"
                              display="block"
                              sx={{ mt: 0.5 }}
                            >
                              Cannot exceed {fmtMoney(remaining)}.
                            </Typography>
                          )}
                        </Box>
                        {selectedEventDone && (
                          <>
                            <TextField
                              size="small"
                              label="Amount"
                              type="number"
                              value={amountValue}
                              onChange={(e) =>
                                setPayoutAmountByAssignment((prev) => ({
                                  ...prev,
                                  [assignmentId]: e.target.value,
                                }))
                              }
                              inputProps={{
                                min: 0,
                                max: remaining,
                                step: "0.01",
                              }}
                              error={exceedsBalance}
                              placeholder={row.remaining.toFixed(2)}
                              sx={{ width: { xs: "100%", md: 130 } }}
                            />
                            <FormControl size="small" sx={{ minWidth: 130 }}>
                              <InputLabel id={`provider-${assignmentId}`}>
                                Provider
                              </InputLabel>
                              <Select
                                labelId={`provider-${assignmentId}`}
                                label="Provider"
                                value={selectedProvider}
                                onChange={(e) =>
                                  setPayoutProviderByAssignment((prev) => ({
                                    ...prev,
                                    [assignmentId]: e.target.value,
                                  }))
                                }
                              >
                                <MenuItem value="manual">Manual</MenuItem>
                                <MenuItem value="cashapp">Cash App</MenuItem>
                                <MenuItem value="zelle">Zelle</MenuItem>
                                <MenuItem value="paypal">PayPal</MenuItem>
                                <MenuItem value="venmo">Venmo</MenuItem>
                                <MenuItem value="check">Check</MenuItem>
                                <MenuItem value="cash">Cash</MenuItem>
                              </Select>
                            </FormControl>
                          </>
                        )}
                        {selectedEventDone && providerUrl && (
                          <Button
                            variant="outlined"
                            href={providerUrl}
                            target="_blank"
                            rel="noreferrer"
                            onClick={() =>
                              setPayoutLinkOpenedByAssignment((prev) => ({
                                ...prev,
                                [assignmentId]: true,
                              }))
                            }
                            sx={{
                              color: "var(--primary-color)",
                              borderColor: "var(--primary-color)",
                            }}
                          >
                            Go to {payoutProviderLabel(selectedProvider)} Link
                          </Button>
                        )}
                        {selectedEventDone && (
                          <Tooltip title={recordDisabledReason}>
                            <span>
                              <Button
                                variant="contained"
                                startIcon={<Paid />}
                                disabled={!canRecord}
                                onClick={() => recordPayout(row)}
                                sx={{backgroundColor: 'var(--primary-color)'}}
                              >
                                Record
                              </Button>
                            </span>
                          </Tooltip>
                        )}
                      </Stack>
                    </Paper>
                  );
                })}
              </Stack>

              {selectedEventDone && (
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                  <TextField
                    size="small"
                    label="Reference"
                    value={payoutForm.reference}
                    onChange={(e) =>
                      setPayoutForm((p) => ({
                        ...p,
                        reference: e.target.value,
                      }))
                    }
                    fullWidth
                  />
                  <TextField
                    size="small"
                    label="Notes"
                    value={payoutForm.notes}
                    onChange={(e) =>
                      setPayoutForm((p) => ({ ...p, notes: e.target.value }))
                    }
                    fullWidth
                  />
                </Stack>
              )}

              <Typography variant="subtitle1" fontWeight={700}>
                Bartender Payout Records
              </Typography>

              {selectedPayouts.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No bartender payout records for this event yet.
                </Typography>
              ) : (
                <Stack spacing={1}>
                  {selectedPayouts.map((payout) => (
                    <Paper key={payout._id} variant="outlined" sx={{ p: 1.5 }}>
                      <Stack
                        direction={{ xs: "column", sm: "row" }}
                        justifyContent="space-between"
                        spacing={1}
                      >
                        <Box>
                          <Stack
                            direction="row"
                            spacing={1}
                            alignItems="center"
                          >
                            <Typography fontWeight={700}>
                              {fmtMoney(payout.amount)}
                            </Typography>
                            <Chip
                              size="small"
                              label={titleize(payout.status)}
                              color={
                                payout.status === "paid"
                                  ? "success"
                                  : payout.status === "failed"
                                  ? "error"
                                  : "warning"
                              }
                            />
                          </Stack>
                          <Typography variant="body2" color="text.secondary">
                            {payout.bartenderUser?.fullName || "Bartender"} -{" "}
                            {titleize(payout.provider)}
                          </Typography>
                          {(payout.reference ||
                            payout.notes ||
                            payout.failureReason) && (
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              display="block"
                            >
                              {[
                                payout.reference,
                                payout.notes,
                                payout.failureReason,
                              ]
                                .filter(Boolean)
                                .join(" - ")}
                            </Typography>
                          )}
                        </Box>
                        <Typography variant="caption" color="text.secondary">
                          {fmtDateTime(
                            payout.paidAt ||
                              payout.scheduledAt ||
                              payout.createdAt
                          )}
                        </Typography>
                      </Stack>
                    </Paper>
                  ))}
                </Stack>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelectedEventId(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
