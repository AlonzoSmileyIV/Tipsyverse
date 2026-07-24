import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  fetchAllBartenders,
  fetchBartenderById,
} from "../../features/users/userSlice";
import {
  Avatar,
  Box,
  Button,
  Chip,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { CollapseAlert } from "../CollapseAlert/CollapseAlert";
import { DataGrid } from "@mui/x-data-grid";
import BartenderDetailDrawer from "../BartenderDetailDrawer/BartenderDetailDrawer";
import api from "../../services/api";
import EmptyOverlay from "../EmptyOverlay/EmptyOverlay";
import AdminSectionHeader from "../AdminSectionHeader/AdminSectionHeader";
import AdminTableControls from "../AdminTableControls/AdminTableControls";
import { formatStatus } from "../../utils/formatStatus";

const primaryButtonSx = {
  color: "var(--primary-color)",
  borderColor: "var(--primary-color)",
  "&:hover": {
    borderColor: "var(--primary-color)",
    backgroundColor: "rgba(128, 0, 32, 0.06)",
  },
};

const REQUIRED_DOCUMENT_KEYS = [
  "w9",
  "independent_contractor",
  "service_standards",
];

const getBartenderDocuments = (user) => {
  const docs =
    user?.documents ||
    user?.onboardingDocuments ||
    user?.bartenderProfile?.documents ||
    user?.bartenderProfile?.onboardingDocuments ||
    [];
  return Array.isArray(docs) ? docs : [];
};

const needsDocumentsSent = (user) => {
  const docs = getBartenderDocuments(user);
  const byKey = {};
  docs.forEach((doc) => {
    const key = doc?.key || doc?.documentKey;
    if (key) byKey[key] = doc;
  });

  return REQUIRED_DOCUMENT_KEYS.some((key) => {
    const status = String(byKey[key]?.status || "not_sent").toLowerCase();
    return !["sent", "received"].includes(status);
  });
};

const AdminBartenders = ({ hideHeader = false, reviewOnly = false }) => {
  const dispatch = useDispatch();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const isTablet = useMediaQuery(theme.breakpoints.down("md"));

  // UI state
  const [alert, setAlert] = useState(null);
  const [search, setSearch] = useState("");
  const [selectedBartender, setSelectedBartender] = useState(null); // bartender object
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [quickFilter, setQuickFilter] = useState(reviewOnly ? "approval" : "all");

  const allBartendersPayload = useSelector((state) => state.users?.allBartenders);
  const allBartenders = Array.isArray(allBartendersPayload)
    ? allBartendersPayload
    : allBartendersPayload?.data;

  const bartendersData = useMemo(
    () => (Array.isArray(allBartenders) ? allBartenders : []),
    [allBartenders]
  );

  const fetchAllData = useCallback(() => {
    dispatch(fetchAllBartenders({})); // you can pass filters/pagination here
  }, [dispatch]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  const filteredRows = bartendersData.filter((user) => {
    if (quickFilter === "approval" && user?.bartenderStatus !== "applicant") {
      return false;
    }
    if (quickFilter === "rewards" && !user?.needsReward) return false;
    if (quickFilter === "documents" && !needsDocumentsSent(user)) return false;
    const name = (user?.fullName || "").toLowerCase();
    const username = (user?.username || "").toLowerCase();
    const q = search.toLowerCase();
    return name.includes(q) || username.includes(q);
  });

  const needApprovalCount = bartendersData.filter(
    (user) => user?.bartenderStatus === "applicant"
  ).length;
  const needRewardedCount = bartendersData.filter(
    (user) => user?.needsReward
  ).length;
  const needDocumentsCount = bartendersData.filter(needsDocumentsSent).length;

  const handleRefresh = () => fetchAllData();

  const handleRefreshClick = (message = "Refreshed successfully!") => {
    setAlert({ message: message, severity: "success" });
    handleRefresh();
  };

  const handleView = async (row) => {
    if (!row?.id) return;
    try {
      const payload = await dispatch(fetchBartenderById(row.id)).unwrap();
      setSelectedBartender(payload);
      setDrawerOpen(true);
    } catch (err) {
      console.error(err);
      setAlert({
        message: err?.message || "Failed to load bartender details",
        severity: "error",
      });
    }
  };

  const handleCloseDrawer = () => {
    setDrawerOpen(false);
    setSelectedBartender(null);
  };

const handleDecision = async (decision, note = "") => {
  if (!selectedBartender?.bartenderId) return;

  try {
    setActionLoading(true);

    await api.post(
      `/users/bartenders/${selectedBartender.bartenderId}/profile/decision`,
      {
        action: decision, // "approve" or "deny"
        note,
      }
    );

    setAlert({
      message:
        decision === "approve"
          ? "Bartender profile approved."
          : "Bartender profile denied.",
      severity: "success",
    });

    await fetchAllData();

    const updated = await dispatch(
      fetchBartenderById(selectedBartender.bartenderId)
    ).unwrap();

    setSelectedBartender(updated);
  } catch (err) {
    console.error(err);
    setAlert({
      message:
        err?.response?.data?.message ||
        err?.message ||
        `Failed to ${decision} bartender`,
      severity: "error",
    });
  } finally {
    setActionLoading(false);
  }
};



  const handleExportCSV = () => {
    const header = ["Full Name", "Email", "Status"].join(",");
    const body = bartendersData.map((e) =>
      [
        JSON.stringify(e?.fullName ?? ""),
        JSON.stringify(e?.email ?? ""),
        JSON.stringify(e?.bartenderStatus ?? ""),
      ].join(",")
    );
    const csv = [header, ...body].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "Bartenders.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const columns = [
    {
      field: "user",
      headerName: "Bartender",
      width: isMobile ? 145 : 230,
      sortable: false,
      renderCell: (params) => {
        const { photo, fullName, email } = params.row;
        return (
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Avatar src={photo || undefined}>{!photo && fullName[0]}</Avatar>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="subtitle2" noWrap>{fullName}</Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                noWrap
                sx={{ display: { xs: "none", sm: "block" } }}
              >
                {email}
              </Typography>
            </Box>
          </Stack>
        );
      },
    },

    {
      field: "bartenderStatus",
      headerName: "Bartender Status",
      flex: 1,
      renderCell: (params) => (
        <Chip
          label={formatStatus(params.value)}
          //["applicant", "approved", "denied"]
          color={
            params.value === "approved"
              ? "success"
              : params.value === "applicant"
              ? "default"
              : params.value === "denied"
              ? "error"
              : "default"
          }
          size="small"
        />
      ),
    },
    {
      field: "pendingRewardCount",
      headerName: "Rewards",
      flex: 0.8,
      minWidth: 120,
      renderCell: (params) => (
        <Chip
          label={
            params.value > 0
              ? `${params.value} pending`
              : `${params.row.completedEvents || 0} completed`
          }
          color={params.value > 0 ? "warning" : "default"}
          size="small"
          variant={params.value > 0 ? "filled" : "outlined"}
        />
      ),
    },
    {
      field: "actions",
      headerName: "Action",
      sortable: false,
      filterable: false,
      width: 120,
      align: "center",
      headerAlign: "center",
      renderCell: (params) => (
        <Button
          size="small"
          variant="outlined"
          onClick={() => handleView(params.row)}
          sx={{ textTransform: "none", ...primaryButtonSx }}
        >
          Review
        </Button>
      ),
    },
  ];

  return (
    <Box>
      {/* Header */}
      {!hideHeader && (
        <Box sx={{ mb: 2 }}>
          <AdminSectionHeader
            title="Bartenders"
            subtitle="Review bartender profiles, onboarding documents, rewards, and eligibility."
            onRefresh={() => handleRefreshClick()}
            onDownload={handleExportCSV}
            downloadLabel="Download Excel"
          />
        </Box>
      )}

      {/* Alert Message */}
      {alert && (
        <CollapseAlert
          open={!!alert}
          severity={alert.severity}
          message={alert.message}
          onClose={() => setAlert(null)}
        />
      )}

      <AdminTableControls
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search bartender name, username, or email..."
      >
        <Button
          variant={quickFilter === "approval" ? "contained" : "outlined"}
          onClick={() =>
            setQuickFilter((current) =>
              current === "approval" && !reviewOnly ? "all" : "approval"
            )
          }
          sx={{
            ...(quickFilter === "approval"
              ? { backgroundColor: "var(--primary-color)" }
              : primaryButtonSx),
          }}
        >
          Need Approval ({needApprovalCount})
        </Button>
        <Button
          variant={quickFilter === "rewards" ? "contained" : "outlined"}
          onClick={() =>
            setQuickFilter((current) =>
              current === "rewards" && !reviewOnly ? "all" : "rewards"
            )
          }
          sx={{
            ...(quickFilter === "rewards"
              ? { backgroundColor: "var(--primary-color)" }
              : primaryButtonSx),
          }}
        >
          Need Rewarded ({needRewardedCount})
        </Button>
        <Button
          variant={quickFilter === "documents" ? "contained" : "outlined"}
          onClick={() =>
            setQuickFilter((current) =>
              current === "documents" && !reviewOnly ? "all" : "documents"
            )
          }
          sx={{
            ...(quickFilter === "documents"
              ? { backgroundColor: "var(--primary-color)" }
              : primaryButtonSx),
          }}
        >
          Need Documents Sent({needDocumentsCount})
        </Button>
        {!reviewOnly && quickFilter !== "all" && (
          <Button
            variant="text"
            onClick={() => setQuickFilter("all")}
            sx={{ color: "var(--primary-color)" }}
          >
            Clear Filter
          </Button>
        )}
      </AdminTableControls>

      {/* Data Grid */}
      <Box sx={{ height: 500, width: "100%" }}>
        <DataGrid
          rows={filteredRows}
          columns={columns}
          getRowId={(row) => row.id}
          pageSize={10}
          rowsPerPageOptions={[10, 20, 50]}
          columnVisibilityModel={{
            bartenderStatus: !isMobile,
            pendingRewardCount: !isTablet,
          }}
          disableSelectionOnClick
          slots={{
            noRowsOverlay: () => (
              <EmptyOverlay message={reviewOnly ? "Sorry, no bartenders need approval right now." : "Sorry, no bartenders yet."} />
            ),
          }}
          // MUI v5 fallback (safe to keep)
          components={{
            NoRowsOverlay: () => (
              <EmptyOverlay message={reviewOnly ? "Sorry, no bartenders need approval right now." : "Sorry, no bartenders yet."} />
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
      </Box>

      {/* Drawer */}
      <BartenderDetailDrawer
        open={drawerOpen}
        onClose={handleCloseDrawer}
        bartender={selectedBartender}
        onApprove={(note) => handleDecision("approve", note)}
        onDeny={(note) => handleDecision("deny", note)}
        actionLoading={actionLoading}
      />
    </Box>
  );
};

export default AdminBartenders;
