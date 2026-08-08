import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Drawer,
  Paper,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import { useDispatch, useSelector } from "react-redux";

import { fetchAllBartenderLicenses } from "../../features/users/userSlice";
import LicenseDetailForm from "../../components/LicenseDetailForm/LicenseDetailForm";
import AdminTableControls from "../AdminTableControls/AdminTableControls";


function statusChip(status) {
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
}

const primaryButtonSx = {
  color: "var(--primary-color)",
  borderColor: "var(--primary-color)",
  "&:hover": {
    borderColor: "var(--primary-color)",
    backgroundColor: "rgba(128, 0, 32, 0.06)",
  },
};

export default function AdminBartenderLicenses({ hideHeader = false, reviewOnly = false }) {
  const dispatch = useDispatch();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const is800OrLess = useMediaQuery("(max-width:800px)");
  const isTablet = useMediaQuery("(max-width:1000px)");

  const {
    allBartenderLicenses,
    allBartenderLicensesStatus,
    allBartenderLicensesError,
  } = useSelector((state) => state.users);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedLicense, setSelectedLicense] = useState(null);
  const [search, setSearch] = useState("");

  const loading = allBartenderLicensesStatus === "loading";
  const error = allBartenderLicensesError;

  useEffect(() => {
    dispatch(fetchAllBartenderLicenses());
  }, [dispatch]);

  const handleView = (row) => {
    setSelectedLicense(row);
    setDrawerOpen(true);
  };

  const handleDrawerClose = () => {
    setDrawerOpen(false);
  };

  const handleSaved = async () => {
    setDrawerOpen(false);
    dispatch(fetchAllBartenderLicenses());
  };

  const handleDeleted = async () => {
    setDrawerOpen(false);
    dispatch(fetchAllBartenderLicenses());
  };

  const safeRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (allBartenderLicenses || [])
      .filter((row) =>
        reviewOnly
          ? ["pending", "under_review"].includes(String(row?.status || "").toLowerCase())
          : true
      )
      .filter((row) => {
        if (!term) return true;
        const user = row.user || row.bartender || {};
        return [
          row.bartenderName,
          row.bartenderEmail,
          user.fullName,
          user.email,
          row.state,
          row.permitNumber,
          row.licenseNumber,
          row.status,
          row.type,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term));
      })
      .map((row, index) => ({
        id: row.licenseId || row.id || `row-${index}`,
        ...row,
      }));
  }, [allBartenderLicenses, reviewOnly, search]);

  const columns = [
    {
      field: "user",
      headerName: "User",
      width: isMobile ? 145 : 230,
      sortable: false,
      renderCell: (params) => {
        const user = params.row.user || params.row.bartender || {};
        const fullName =
          params.row.bartenderName || user.fullName || "Unknown User";
        const email = params.row.bartenderEmail || user.email || "";
        const photo =
          params.row.bartenderPhoto || user.profile?.photo || user.photo || "";

        return (
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Avatar
              src={photo || undefined}
              alt={fullName}
              sx={{ width: 36, height: 36 }}
            >
              {fullName?.charAt(0)?.toUpperCase() || "?"}
            </Avatar>
            <Box sx={{ lineHeight: 1.2, minWidth: 0 }}>
              <Typography variant="body2" fontWeight={600} noWrap>
                {fullName}
              </Typography>
              {email && (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  noWrap
                  sx={{ display: { xs: "none", sm: "block" } }}
                >
                  {email}
                </Typography>
              )}
            </Box>
          </Stack>
        );
      },
    },
    {
      field: "state",
      headerName: "State",
      flex: 0.7,
      minWidth: 90,
    },
    {
      field: "permitNumber",
      headerName: "Permit Number",
      flex: 1.1,
      minWidth: 140,
    },
    {
      field: "status",
      headerName: "Status",
      flex: 0.9,
      minWidth: 120,
      renderCell: (params) => statusChip(params.row?.status),
    },
    {
      field: "expiresAt",
      headerName: "Expiration Date",
      flex: 1.1,
      minWidth: 140,
      renderCell: (params) => {
        const raw = params?.row?.expiresAt;
        if (!raw) return <Typography variant="body2">—</Typography>;

        const isoDate = String(raw).slice(0, 10); // “2027-05-11”
        const [year, month, day] = isoDate.split("-");

        return (
          <Typography variant="body2">{`${month}/${day}/${year}`}</Typography>
        );
      },
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
      {!hideHeader && (
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="flex-start"
          sx={{ mb: 2 }}
          spacing={1.5}
        >
          <Box>
            <Typography variant="h5" fontWeight={700}>
              Bartender Licenses
            </Typography>
            <Typography variant="body2" color="text.secondary">
              View and review all bartender licenses in the system.
            </Typography>
          </Box>
        </Stack>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <AdminTableControls
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search bartender, license, state, or status..."
      />

      <Paper
        variant="outlined"
        sx={{
          height: 520,
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
          rows={safeRows}
          columns={columns}
          getRowId={(row) => row._id || row.id}
          columnVisibilityModel={{
            state: !is800OrLess,
            permitNumber: !isTablet,
            status: !is800OrLess,
            expiresAt: !isTablet,
          }}
          disableRowSelectionOnClick
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
          slots={{
            noRowsOverlay: () => (
              <Box sx={{ p: 3, textAlign: "center", color: "text.secondary" }}>
                {reviewOnly ? "Sorry, no bartender licenses need review right now." : "Sorry, no bartender licenses found."}
              </Box>
            ),
          }}
        />
      </Paper>

      {/* Drawer: view / approve / deny */}
      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={handleDrawerClose}
        PaperProps={{ sx: { width: { xs: "100%", sm: 420 } } }}
      >
        {selectedLicense && (
          <LicenseDetailForm
            mode="edit"
            initialValue={selectedLicense}
            onClose={handleDrawerClose}
            onSaved={handleSaved}
            onDeleted={handleDeleted}
            isEmployee={true} // ✅ show Approve/Deny buttons + activity log
            keepInputsDisabled={true}
            disableDeleteAndSave={true}
          />
        )}
      </Drawer>
    </Box>
  );
}
