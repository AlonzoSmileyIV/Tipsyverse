import React, {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Box,
  Tooltip,
  Typography,
  Drawer,
  Chip,
  useTheme,
  useMediaQuery,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  CircularProgress,
  Stack,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import moment from "moment";
import { useDispatch, useSelector } from "react-redux";
import { useSearchParams } from "react-router-dom";
import {
  fetchAllEvents,
  fetchEventById,
  selectAllEvents,
  selectEventsStatus,
} from "../../features/events/eventSlice";
import { CollapseAlert } from "../CollapseAlert/CollapseAlert";
import EmptyOverlay from "../EmptyOverlay/EmptyOverlay";
import AdminSectionHeader from "../AdminSectionHeader/AdminSectionHeader";
import AdminSummaryCards from "../AdminSummaryCards/AdminSummaryCards";
import DetailDrawerHeader from "../DetailDrawerHeader/DetailDrawerHeader";
import AdminTableControls from "../AdminTableControls/AdminTableControls";
import api from "../../services/api";
import { loadSpreadsheet } from "../../utils/loadSpreadsheet";

const DetailedEventForm = lazy(() =>
  import("../DetailedEventForm/DetailedEventForm")
);

// This screen is an operations overview. Detailed editing stays delegated to
// DetailedEventForm; summary policy and table/export projections live here.

// Map common IANA zones to short US-style timezone abbreviations for exports.
// Event timestamps remain ISO values; this helper changes display text only.
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

const formatLabel = (value) => {
  if (!value) return "—";
  const overrides = {
    in_progress: "In Progress",
    ready_to_assign: "Ready To Assign",
    awaiting_response: "Awaiting Response",
    reminder_sent: "Reminder Sent",
    cocktail_bar: "Cocktail Bar",
    beer_wine: "Beer & Wine",
    full_bar: "Full Bar",
    signature_cocktail: "Signature Cocktail Bar",
    non_alcoholic: "Mocktail / Non-Alcoholic",
  };
  const raw = String(value).trim();
  if (overrides[raw]) return overrides[raw];
  return raw
    .replace(/[_-]+/g, " ")
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
};

const statusIs = (event, statuses) =>
  statuses.includes(String(event?.status || "").toLowerCase());

// Older event records use several payment field names. These accessors provide
// one compatibility boundary for cards, filters, exports, and drawer summaries.
const getPaymentTotal = (event) =>
  Number(event?.payment?.total) ||
  Number(event?.payment?.totalAfterDiscount) ||
  Number(event?.payment?.totalAfterDiscounts) ||
  Number(event?.pricing?.estimatedTotal) ||
  0;
const getPaidTotal = (event) =>
  Number(event?.payment?.paidTotal) ||
  Number(event?.recordedPaidTotal) ||
  Number(event?.paidTotal) ||
  0;
const getPaymentBalance = (event) =>
  Math.max(getPaymentTotal(event) - getPaidTotal(event), 0);
const fmtMoney = (value) => `$${(Number(value) || 0).toFixed(2)}`;
const getNeededBartenders = (event) =>
  Number(event?.counts?.neededBartenders) ||
  Number(event?.pricing?.bartendersRequested) ||
  0;
const getAssignedBartenders = (event) => Number(event?.counts?.assigned) || 0;
const getPendingBartenders = (event) =>
  Math.max(0, getNeededBartenders(event) - getAssignedBartenders(event));
const isStaffingActive = (event) =>
  statusIs(event, ["ready_to_assign", "bidding", "selecting", "confirmed"]);
const isUnderstaffed = (event) =>
  isStaffingActive(event) &&
  getNeededBartenders(event) > 0 &&
  getAssignedBartenders(event) < getNeededBartenders(event);
const STAT_FILTERS = {
  // Each definition drives both a summary card and its corresponding table
  // filter, which keeps displayed counts consistent with visible rows.
  all: {
    label: "All Events",
    description: "Every event",
    matches: () => true,
  },
  confirmation: {
    label: "Need Confirmation",
    description: "Submitted / awaiting response",
    matches: (event) =>
      statusIs(event, ["submitted", "pending", "awaiting_response"]),
  },
  assignment: {
    label: "Need Assignment",
    description: "Ready / selecting bartenders",
    matches: (event) =>
      statusIs(event, ["ready_to_assign", "bidding", "selecting"]),
  },
  understaffed: {
    label: "Understaffed",
    description: "Assigned below needed",
    matches: isUnderstaffed,
  },
  payment: {
    label: "Need Payment",
    description: "Balance remaining",
    matches: (event) =>
      getPaymentTotal(event) > 0 && getPaymentBalance(event) > 0,
  },
  paid: {
    label: "Paid",
    description: "No balance remaining",
    matches: (event) =>
      getPaymentTotal(event) > 0 && getPaymentBalance(event) <= 0,
  },
};

const AdminEvents = () => {
  const dispatch = useDispatch();
  const [searchParams, setSearchParams] = useSearchParams();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const isTwoCardsOrLess = useMediaQuery(theme.breakpoints.down("md"));
  const isThreeCardsOrLess = useMediaQuery(theme.breakpoints.down("xl"));

  const all = useSelector(selectAllEvents);
  const status = useSelector(selectEventsStatus);

  const [selected, setSelected] = useState(null);
  const [alert, setAlert] = useState(null);
  const [activeStat, setActiveStat] = useState("all");
  const [invoiceEvent, setInvoiceEvent] = useState(null);
  const [sendingInvoice, setSendingInvoice] = useState(false);
  const [search, setSearch] = useState("");

  // Selectors normally return an array, but normalizing here keeps the admin
  // surface resilient while the initial request is unresolved.
  const eventsData = useMemo(() => (Array.isArray(all) ? all : []), [all]);
  const filteredEventsData = useMemo(() => {
    const stat = STAT_FILTERS[activeStat] || STAT_FILTERS.all;
    const term = search.trim().toLowerCase();
    return eventsData.filter((event) => {
      if (!stat.matches(event)) return false;
      if (!term) return true;
      return [
        event.shortCode,
        event.type,
        event.status,
        event.contact?.fullName,
        event.contact?.email,
        event.contact?.phone,
        event.location?.formatted,
        event.location?.city,
        event.location?.state,
        event.location?.zipcode,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [activeStat, eventsData, search]);

  const eventStats = useMemo(
    () =>
      Object.entries(STAT_FILTERS).map(([key, stat]) => ({
        key,
        ...stat,
        count: eventsData.filter(stat.matches).length,
      })),
    [eventsData]
  );

  const fetchAllData = useCallback(() => {
    dispatch(fetchAllEvents({}));
  }, [dispatch]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  const handleRefresh = () => {
    setAlert({ message: "Refreshed successfully!", severity: "success" });
    fetchAllData();
  };

  const handleView = async (row) => {
    if (!row?._id) return;
    const fullEvent = await dispatch(fetchEventById(row._id)).unwrap();
    setSelected(fullEvent);
  };

  const handleOpenInvoiceDialog = (row) => {
    if (!row?._id) return;
    setInvoiceEvent(row);
  };

  const handleSendInvoice = async () => {
    if (!invoiceEvent?._id) return;
    setSendingInvoice(true);
    setAlert(null);
    try {
      // The server renders and sends the authoritative invoice. The client
      // intentionally sends no calculated totals.
      const res = await api.post(`/events/${invoiceEvent._id}/send-invoice`);
      setAlert({
        message: res?.data?.message || "Invoice sent successfully.",
        severity: "success",
      });
      setInvoiceEvent(null);
      fetchAllData();
    } catch (err) {
      setAlert({
        message: err?.response?.data?.message || "Failed to send invoice.",
        severity: "error",
      });
    } finally {
      setSendingInvoice(false);
    }
  };

  const handleCloseDetails = () => {
    setSelected(null);
    if (searchParams.get("eventId")) {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete("eventId");
      setSearchParams(nextParams, { replace: true });
    }
  };

  useEffect(() => {
    // Supporting eventId in the URL makes links from alerts and other admin
    // modules open the same drawer without duplicating an event-detail route.
    const eventId = searchParams.get("eventId");
    if (!eventId || selected?._id === eventId) return;
    dispatch(fetchEventById(eventId))
      .unwrap()
      .then((fullEvent) => setSelected(fullEvent))
      .catch(() =>
        setAlert({
          message: "We could not open that event from the link.",
          severity: "error",
        })
      );
  }, [dispatch, searchParams, selected?._id]);

  const handleDownloadExcel = async () => {
    const XLSX = await loadSpreadsheet();
    // Export the currently filtered view so the downloaded counts match what
    // the administrator reviewed on screen.
    const worksheet = XLSX.utils.json_to_sheet(
      filteredEventsData.map((event) => ({
        "Event #": event.shortCode || "",
        Type: formatLabel(event.type),
        Address: event.location?.formatted || "",
        City: event.location?.city || "",
        State: event.location?.state || "",
        Zipcode: event.location?.zipcode || "",
        Start: event.startAt ? moment(event.startAt).format("YYYY-MM-DD HH:mm") : "",
        End: event.endAt ? moment(event.endAt).format("YYYY-MM-DD HH:mm") : "",
        Timezone: tzAbbr(event.timezone || ""),
        Status: formatLabel(event.status),
        Needed: getNeededBartenders(event),
        Accepted: getAssignedBartenders(event),
        Pending: getPendingBartenders(event),
        "Staffing Risk": isUnderstaffed(event) ? "Understaffed" : "On track",
        "Paid Total": getPaidTotal(event),
        Balance: getPaymentBalance(event),
      }))
    );
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Events");
    XLSX.writeFile(workbook, "Events.xlsx");
  };

  const columns = [
    {
      field: "shortCode",
      headerName: "EventID",
      width: 125,
      minWidth: 110,
    },

    {
      field: "startAt",
      headerName: "Date Arrives",
      minWidth: 175,
      flex: 0.9,
      // DataGrid sorts the underlying Date while rendering a friendly label.
      valueGetter: (_value, row) =>
        row?.startAt ? new Date(row.startAt) : null,
      sortComparator: (v1, v2) => {
        const t1 = v1 ? new Date(v1).getTime() : 0;
        const t2 = v2 ? new Date(v2).getTime() : 0;
        return t1 - t2;
      },
      renderCell: (params) => {
        const row = params.row;
        if (!row?.startAt) {
          return <Typography variant="body2">—</Typography>;
        }
        return (
          <Typography variant="body2">
            {moment(row.startAt).format("MMM D, YYYY • h:mm a")}
          </Typography>
        );
      },
    },

    {
      field: "type",
      headerName: "Event Type",
      minWidth: 140,
      flex: 0.6,
      renderCell: (params) => (
        <Typography variant="body2">{formatLabel(params?.value)}</Typography>
      ),
    },

    {
      field: "location",
      headerName: "Location",
      minWidth: 200,
      flex: 1.2,
      valueGetter: (_value, row) => row?.location ?? "",
      renderCell: (params) => (
        <Typography
          variant="body2"
          sx={{
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {params?.row?.location?.city
            ? `${params.row.location.city}, ${params.row.location.state} ${params.row.location.zipcode}`
            : "—"}
        </Typography>
      ),
    },

    {
      field: "status",
      headerName: "Status",
      width: 160,
      renderCell: (params) => {
        const raw = params?.value;
        const label = formatLabel(raw);
        const color = STATUS_COLORS[raw] || "default";

        return (
          <Chip size="small" label={label} color={color} variant="filled" />
        );
      },
    },

    {
      field: "staffing",
      headerName: "Staffing",
      width: 145,
      sortable: false,
      valueGetter: (_value, row) =>
        `${getAssignedBartenders(row)}/${getNeededBartenders(row)}`,
      renderCell: (params) => {
        const row = params.row;
        const needed = getNeededBartenders(row);
        const assigned = getAssignedBartenders(row);
        const understaffed = isUnderstaffed(row);

        return (
          <Chip
            size="small"
            color={understaffed ? "warning" : "success"}
            label={`${assigned}/${needed || 0} staffed`}
          />
        );
      },
    },

    {
      field: "actions",
      headerName: "Actions",
      width: 190,
      sortable: false,
      filterable: false,
      renderCell: (params) => (
        <Stack direction="row" spacing={1}>
          <Tooltip title="View details">
            <Button
              size="small"
              variant="outlined"
              onClick={() => params?.row && handleView(params.row)}
              disabled={!params?.row}
              sx={{
                borderColor: "var(--primary-color)",
                color: "var(--primary-color)",
                whiteSpace: "nowrap",
              }}
            >
              Review
            </Button>
          </Tooltip>
          <Tooltip title="Send current invoice to the main contact">
            <Button
              size="small"
              variant="outlined"
              onClick={() => handleOpenInvoiceDialog(params.row)}
              disabled={!params?.row}
              sx={{
                borderColor: "var(--primary-color)",
                color: "var(--primary-color)",
                whiteSpace: "nowrap",
              }}
            >
              Invoice
            </Button>
          </Tooltip>
        </Stack>
      ),
    },
  ];

  return (
    <Box>
      <Box sx={{ mb: 2 }}>
        <AdminSectionHeader
          title="Events"
          subtitle="Manage event bookings, customer follow-ups, bartender assignment status, and payment readiness."
          onRefresh={handleRefresh}
          onDownload={handleDownloadExcel}
        />
      </Box>

      {alert && (
        <CollapseAlert
          message={alert.message}
          open
          severity={alert.severity}
          onClose={() => setAlert(null)}
        />
      )}

      <AdminSummaryCards
        cards={eventStats}
        selectedKey={activeStat}
        onSelect={setActiveStat}
      />

      <AdminTableControls
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search event code, contact, status, type, or location..."
      />

      <Box sx={{ height: 520, width: "100%", minWidth: 0, overflowX: "auto" }}>
        <DataGrid
          rows={filteredEventsData}
          columns={columns}
          getRowId={(row) => row?._id ?? row?.id ?? String(Math.random())}
          pageSize={10}
          rowsPerPageOptions={[10, 25, 50]}
          loading={status === "loading"}
          columnVisibilityModel={{
            startAt: !isTwoCardsOrLess,
            type: !isThreeCardsOrLess,
            location: !isThreeCardsOrLess,
            status: !isMobile,
            staffing: !isTwoCardsOrLess,
          }}
          disableSelectionOnClick
          slots={{
            noRowsOverlay: () => (
              <EmptyOverlay message="No events match this filter." />
            ),
          }}
          // Retain the legacy prop until every deployment uses the slots API.
          components={{
            NoRowsOverlay: () => (
              <EmptyOverlay message="No events match this filter." />
            ),
          }}
          sx={{
            "& .MuiDataGrid-columnHeaderTitle": { width: "100%" },
            "& .MuiDataGrid-columnHeaders": { textAlign: "center" },
            "& .MuiDataGrid-cell": {
              display: "flex",
              alignItems: "center",
              textAlign: "left",
            },
          }}
        />
      </Box>

      <Drawer
        anchor="right"
        open={!!selected}
        onClose={handleCloseDetails}
        PaperProps={{ sx: { width: isMobile ? "90%" : 720, p: 0 } }}
      >
        {selected && (
          <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
            <DetailDrawerHeader
              title={selected.shortCode || "Event Details"}
              summary={
                isUnderstaffed(selected)
                  ? "This event needs staffing attention before it is fully covered."
                  : getPaymentBalance(selected) > 0
                    ? "This event has a customer balance due. Review payment readiness before final closeout."
                    : "This event is staffed or on track. Review details before making changes."
              }
              statusChip={
                <Chip
                  size="small"
                  label={formatLabel(selected.status)}
                  color={
                    isUnderstaffed(selected)
                      ? "warning"
                      : getPaymentBalance(selected) > 0
                        ? "info"
                        : "success"
                  }
                />
              }
              facts={[
                {
                  label: "When",
                  value: selected.startAt
                    ? moment(selected.startAt).format("MMM D, YYYY h:mm A")
                    : "Not scheduled",
                },
                {
                  label: "Staffing",
                  value: `${getAssignedBartenders(selected)}/${getNeededBartenders(selected)}`,
                },
                { label: "Paid", value: fmtMoney(getPaidTotal(selected)) },
                { label: "Balance", value: fmtMoney(getPaymentBalance(selected)) },
              ]}
              lastUpdated={
                selected.updatedAt
                  ? `Last updated ${moment(selected.updatedAt).format("MMM D, YYYY h:mm A")}`
                  : "Last updated not recorded"
              }
              onClose={handleCloseDetails}
            />
            <Box sx={{ flex: 1, overflowY: "auto", p: 2 }}>
              <Suspense
                fallback={
                  <Box
                    sx={{ display: "grid", minHeight: 320, placeItems: "center" }}
                  >
                    <CircularProgress aria-label="Loading event form" />
                  </Box>
                }
              >
                <DetailedEventForm
                  event={selected}
                  readOnly={false}
                  onClose={handleCloseDetails}
                  onSaved={(updated) => {
                    // Keep successful edits visible while synchronizing the
                    // table cards and filters with the saved server state.
                    if (updated) {
                      setSelected(updated);
                    } else {
                      setSelected(null);
                    }
                    fetchAllData();
                  }}
                />
              </Suspense>
            </Box>
          </Box>
        )}
      </Drawer>

      <Dialog
        open={!!invoiceEvent}
        onClose={() => (sendingInvoice ? null : setInvoiceEvent(null))}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Send Current Invoice?</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1}>
            <Typography>
              Send the current invoice for{" "}
              <strong>{invoiceEvent?.shortCode || "this event"}</strong> to the
              main contact?
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Recipient:{" "}
              {invoiceEvent?.contact?.email ||
                invoiceEvent?.contact?.fullName ||
                "No main contact email found"}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Remaining balance:{" "}
              <strong>
                ${getPaymentBalance(invoiceEvent || {}).toFixed(2)}
              </strong>
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setInvoiceEvent(null)}
            disabled={sendingInvoice}
            sx={{ color: "var(--primary-color)" }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSendInvoice}
            disabled={sendingInvoice || !invoiceEvent?.contact?.email}
            sx={{
              backgroundColor: "var(--primary-color)",
              "&:hover": { backgroundColor: "#5f001f" },
            }}
          >
            {sendingInvoice ? "Sending..." : "Send Invoice"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AdminEvents;
