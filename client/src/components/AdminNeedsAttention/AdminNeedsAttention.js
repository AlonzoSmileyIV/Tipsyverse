import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import {
  AssignmentLate,
  Badge,
  EventBusy,
  Paid,
  ReportProblem,
  SupportAgent,
} from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import AdminSectionHeader from "../AdminSectionHeader/AdminSectionHeader";
import api from "../../services/api";

const REQUIRED_DOCUMENT_KEYS = [
  "w9",
  "independent_contractor",
  "service_standards",
];

const normalizeList = (payload) => {
  const data = payload?.data?.data || payload?.data || payload;
  if (Array.isArray(data?.items)) return data.items;
  return Array.isArray(data) ? data : [];
};

const money = (value) => `$${(Number(value) || 0).toFixed(2)}`;

const formatLabel = (value) =>
  String(value || "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase()) || "Unknown";

const getNeededBartenders = (event) =>
  Number(event?.counts?.neededBartenders) ||
  Number(event?.pricing?.bartendersRequested) ||
  Number(event?.bartendersRequested) ||
  0;

const getAssignedBartenders = (event) => Number(event?.counts?.assigned) || 0;

const getPaymentBalance = (event) => {
  const total = Number(event?.payment?.total) || Number(event?.payment?.totalAfterDiscounts) || 0;
  const paid = Number(event?.payment?.paidTotal) || 0;
  return Math.max(0, total - paid);
};

const getBartenderDocuments = (user) => {
  const docs =
    user?.documents ||
    user?.onboardingDocuments ||
    user?.bartenderProfile?.documents ||
    user?.bartenderProfile?.onboardingDocuments ||
    [];
  return Array.isArray(docs) ? docs : [];
};

const needsDocuments = (user) => {
  const byKey = {};
  getBartenderDocuments(user).forEach((doc) => {
    const key = doc?.key || doc?.documentKey;
    if (key) byKey[key] = doc;
  });

  return REQUIRED_DOCUMENT_KEYS.some((key) => {
    const status = String(byKey[key]?.status || "not_sent").toLowerCase();
    return !["sent", "received"].includes(status);
  });
};

const getLicenseExpiration = (license) =>
  license?.expirationDate ||
  license?.expiresAt ||
  license?.licenseExpiration ||
  license?.expiresOn;

const isExpiringSoon = (license) => {
  const raw = getLicenseExpiration(license);
  if (!raw) return false;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return false;
  const days = (date.getTime() - Date.now()) / 86400000;
  return days >= 0 && days <= 30;
};

const AttentionCard = ({ icon, title, count, description, items, actionLabel, onAction }) => (
  <Paper variant="outlined" sx={{ p: 2, height: "100%" }}>
    <Stack spacing={1.5}>
      <Stack direction="row" spacing={1.25} alignItems="center">
        <Box sx={{ color: "var(--primary-color)", display: "flex" }}>{icon}</Box>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography variant="subtitle1" fontWeight={800}>
            {title}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {description}
          </Typography>
        </Box>
        <Chip
          label={count}
          color={count > 0 ? "warning" : "success"}
          size="small"
          sx={{ fontWeight: 800 }}
        />
      </Stack>

      <Stack spacing={1}>
        {items.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            Nothing needs attention here.
          </Typography>
        ) : (
          items.slice(0, 3).map((item) => (
            <Box key={item.id} sx={{ minWidth: 0 }}>
              <Typography variant="body2" fontWeight={800} noWrap>
                {item.title}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {item.detail}
              </Typography>
            </Box>
          ))
        )}
      </Stack>

      {count > 0 && (
        <Button variant="outlined" size="small" onClick={onAction} sx={{ alignSelf: "flex-start" }}>
          {actionLabel}
        </Button>
      )}
    </Stack>
  </Paper>
);

const AdminNeedsAttention = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState(null);
  const [data, setData] = useState({
    events: [],
    bartenders: [],
    licenses: [],
    incidents: [],
    tickets: [],
    drinks: [],
    liquors: [],
    mixers: [],
    glasses: [],
  });
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setAlert(null);
    try {
      const [
        eventsRes,
        bartendersRes,
        licensesRes,
        incidentsRes,
        ticketsRes,
        drinksRes,
        liquorsRes,
        mixersRes,
        glassesRes,
      ] =
        await Promise.allSettled([
          api.get("/events"),
          api.get("/users/bartenders"),
          api.get("/users/admin/licenses"),
          api.get("/incidents"),
          api.get("/support-tickets"),
          api.get("/drinks"),
          api.get("/liquors"),
          api.get("/mixers"),
          api.get("/glasses"),
        ]);

      const failed = [
        eventsRes.status === "rejected" ? "events" : null,
        bartendersRes.status === "rejected" ? "bartenders" : null,
        licensesRes.status === "rejected" ? "licenses" : null,
        incidentsRes.status === "rejected" ? "incidents" : null,
        ticketsRes.status === "rejected" ? "support tickets" : null,
        drinksRes.status === "rejected" ? "drinks" : null,
        liquorsRes.status === "rejected" ? "liquors" : null,
        mixersRes.status === "rejected" ? "mixers" : null,
        glassesRes.status === "rejected" ? "glasses" : null,
      ].filter(Boolean);

      setData({
        events: eventsRes.status === "fulfilled" ? normalizeList(eventsRes.value) : [],
        bartenders: bartendersRes.status === "fulfilled" ? normalizeList(bartendersRes.value) : [],
        licenses: licensesRes.status === "fulfilled" ? normalizeList(licensesRes.value) : [],
        incidents: incidentsRes.status === "fulfilled" ? normalizeList(incidentsRes.value) : [],
        tickets: ticketsRes.status === "fulfilled" ? normalizeList(ticketsRes.value) : [],
        drinks: drinksRes.status === "fulfilled" ? normalizeList(drinksRes.value) : [],
        liquors: liquorsRes.status === "fulfilled" ? normalizeList(liquorsRes.value) : [],
        mixers: mixersRes.status === "fulfilled" ? normalizeList(mixersRes.value) : [],
        glasses: glassesRes.status === "fulfilled" ? normalizeList(glassesRes.value) : [],
      });

      if (failed.length) {
        setAlert({
          severity: "warning",
          message: `Loaded partially. Failed to load: ${failed.join(", ")}.`,
        });
      }
    } catch (error) {
      setAlert({
        severity: "error",
        message: error?.response?.data?.message || "Could not load admin attention items.",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const attention = useMemo(() => {
    const activeEvents = data.events.filter(
      (event) => !["completed", "closed", "canceled", "cancelled"].includes(event?.status)
    );
    const understaffed = activeEvents.filter(
      (event) => getNeededBartenders(event) > getAssignedBartenders(event)
    );
    const unpaid = data.events.filter((event) => getPaymentBalance(event) > 0);
    const pendingDocuments = data.bartenders.filter(needsDocuments);
    const openIncidents = data.incidents.filter((item) =>
      ["open", "reviewing", "in_progress"].includes(String(item?.status || "").toLowerCase())
    );
    const openTickets = data.tickets.filter((item) =>
      ["open", "in_progress", "waiting_on_user"].includes(String(item?.status || "").toLowerCase())
    );
    const expiringLicenses = data.licenses.filter(isExpiringSoon);

    return {
      understaffed,
      unpaid,
      pendingDocuments,
      openIncidents,
      openTickets,
      expiringLicenses,
    };
  }, [data]);

  const searchResults = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (term.length < 2) return [];

    const matches = (values) =>
      values
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));

    const rows = [
      ...data.events.map((event) => ({
        id: `event-${event._id}`,
        type: "Event",
        title: event.shortCode || event._id || "Event",
        detail: `${formatLabel(event.status)} - ${event.contact?.fullName || event.contact?.email || "No contact"}`,
        route: "/admin/events",
        values: [
          event.shortCode,
          event.status,
          event.type,
          event.contact?.fullName,
          event.contact?.email,
          event.location?.city,
          event.location?.address,
        ],
      })),
      ...data.bartenders.map((user) => ({
        id: `bartender-${user._id || user.bartenderId}`,
        type: "Bartender",
        title: user.fullName || user.email || "Bartender",
        detail: user.email || formatLabel(user.bartenderStatus),
        route: "/admin/users",
        values: [user.fullName, user.email, user.username, user.bartenderStatus],
      })),
      ...data.tickets.map((ticket) => ({
        id: `ticket-${ticket._id}`,
        type: "Support",
        title: ticket.ticketNumber || ticket.subject || "Support Ticket",
        detail: `${formatLabel(ticket.status)} - ${ticket.subject || "No subject"}`,
        route: "/admin/operations?tab=support",
        values: [ticket.ticketNumber, ticket.subject, ticket.status, ticket.category],
      })),
      ...data.incidents.map((incident) => ({
        id: `incident-${incident._id}`,
        type: "Incident",
        title: incident.event?.shortCode || formatLabel(incident.type) || "Incident",
        detail: `${formatLabel(incident.severity)} - ${formatLabel(incident.status)}`,
        route: "/admin/operations",
        values: [incident.event?.shortCode, incident.type, incident.severity, incident.status],
      })),
      ...data.drinks.map((drink) => ({
        id: `drink-${drink._id}`,
        type: "Drink",
        title: drink.name || "Drink",
        detail: drink.isAlcoholic ? "Contains Alcohol" : "Mocktail",
        route: "/admin/drinks",
        values: [drink.name, drink.slug, drink.glass?.name, drink.categories?.join?.(" ")],
      })),
      ...[
        ...data.liquors.map((item) => ({ ...item, setupType: "Liquor" })),
        ...data.mixers.map((item) => ({ ...item, setupType: "Mixer" })),
        ...data.glasses.map((item) => ({ ...item, setupType: "Glass" })),
      ].map((item) => ({
        id: `catalog-${item.setupType}-${item._id}`,
        type: item.setupType,
        title: item.name || "Catalog Item",
        detail: "Catalog Setup",
        route: "/admin/categories",
        values: [item.name, item.category, item.type],
      })),
    ];

    return rows.filter((row) => matches(row.values)).slice(0, 8);
  }, [data, search]);

  const cards = [
    {
      title: "Understaffed Events",
      count: attention.understaffed.length,
      description: "Events where assigned bartenders are below the needed count.",
      icon: <EventBusy />,
      actionLabel: "View Events",
      onAction: () => navigate("/admin/events"),
      items: attention.understaffed.map((event) => ({
        id: event._id,
        title: event.shortCode || "Event",
        detail: `${getAssignedBartenders(event)}/${getNeededBartenders(event)} staffed`,
      })),
    },
    {
      title: "Unpaid Balances",
      count: attention.unpaid.length,
      description: "Events with a customer balance still due.",
      icon: <Paid />,
      actionLabel: "View Finance",
      onAction: () => navigate("/admin/finance"),
      items: attention.unpaid.map((event) => ({
        id: event._id,
        title: event.shortCode || "Event",
        detail: `Balance due ${money(getPaymentBalance(event))}`,
      })),
    },
    {
      title: "Pending Documents",
      count: attention.pendingDocuments.length,
      description: "Bartenders missing sent or received onboarding documents.",
      icon: <AssignmentLate />,
      actionLabel: "View Bartenders",
      onAction: () => navigate("/admin/users"),
      items: attention.pendingDocuments.map((user) => ({
        id: user._id || user.bartenderId,
        title: user.fullName || user.email || "Bartender",
        detail: "Onboarding documents need admin follow-up.",
      })),
    },
    {
      title: "Open Incidents",
      count: attention.openIncidents.length,
      description: "Incident reports that still need review or resolution.",
      icon: <ReportProblem />,
      actionLabel: "View Operations",
      onAction: () => navigate("/admin/operations"),
      items: attention.openIncidents.map((incident) => ({
        id: incident._id,
        title: incident.event?.shortCode || formatLabel(incident.type) || "Incident",
        detail: `${formatLabel(incident.severity)} - ${formatLabel(incident.status)}`,
      })),
    },
    {
      title: "Support Tickets",
      count: attention.openTickets.length,
      description: "Support tickets still open, in progress, or waiting on the user.",
      icon: <SupportAgent />,
      actionLabel: "View Support",
      onAction: () => navigate("/admin/operations?tab=support"),
      items: attention.openTickets.map((ticket) => ({
        id: ticket._id,
        title: ticket.ticketNumber || ticket.subject || "Support Ticket",
        detail: `${formatLabel(ticket.status)} - ${ticket.assignedTo?.fullName || "Unassigned"}`,
      })),
    },
    {
      title: "Expiring Licenses",
      count: attention.expiringLicenses.length,
      description: "Bartender licenses expiring within the next 30 days.",
      icon: <Badge />,
      actionLabel: "View Licenses",
      onAction: () => navigate("/admin/users"),
      items: attention.expiringLicenses.map((license) => ({
        id: license._id || license.licenseId,
        title: license.user?.fullName || license.fullName || "License",
        detail: `Expires ${new Date(getLicenseExpiration(license)).toLocaleDateString()}`,
      })),
    },
  ];

  return (
    <Box>
      <AdminSectionHeader
        title="Needs Attention"
        subtitle="A quick operational view of items that need admin follow-up."
        primaryLabel={loading ? "Refreshing..." : "Refresh"}
        onPrimaryClick={load}
      />

      {alert && (
        <Alert severity={alert.severity} onClose={() => setAlert(null)} sx={{ mb: 2 }}>
          {alert.message}
        </Alert>
      )}

      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Stack spacing={1.5}>
          <TextField
            fullWidth
            label="Global admin search"
            placeholder="Search event code, customer, bartender, ticket, drink, liquor, mixer, or glass"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          {search.trim().length >= 2 && (
            <Stack spacing={1}>
              {searchResults.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No matching admin records found.
                </Typography>
              ) : (
                searchResults.map((result) => (
                  <Stack
                    key={result.id}
                    direction={{ xs: "column", sm: "row" }}
                    spacing={1}
                    alignItems={{ xs: "flex-start", sm: "center" }}
                    justifyContent="space-between"
                    sx={{ borderTop: 1, borderColor: "divider", pt: 1 }}
                  >
                    <Box sx={{ minWidth: 0 }}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Chip size="small" label={result.type} />
                        <Typography variant="body2" fontWeight={800} noWrap>
                          {result.title}
                        </Typography>
                      </Stack>
                      <Typography variant="caption" color="text.secondary">
                        {result.detail}
                      </Typography>
                    </Box>
                    <Button size="small" onClick={() => navigate(result.route)}>
                      Go
                    </Button>
                  </Stack>
                ))
              )}
            </Stack>
          )}
        </Stack>
      </Paper>

      {loading ? (
        <Stack direction="row" spacing={1.5} alignItems="center">
          <CircularProgress size={22} />
          <Typography variant="body2" color="text.secondary">
            Loading admin attention items...
          </Typography>
        </Stack>
      ) : (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr",
              md: "repeat(2, minmax(0, 1fr))",
              xl: "repeat(3, minmax(0, 1fr))",
            },
            gap: 2,
          }}
        >
          {cards.map((card) => (
            <AttentionCard key={card.title} {...card} />
          ))}
        </Box>
      )}
    </Box>
  );
};

export default AdminNeedsAttention;
