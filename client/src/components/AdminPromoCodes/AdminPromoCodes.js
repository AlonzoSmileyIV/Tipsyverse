import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { Add, Delete, Edit, Refresh } from "@mui/icons-material";
import { DataGrid } from "@mui/x-data-grid";
import api from "../../services/api";
import EmptyOverlay from "../EmptyOverlay/EmptyOverlay";

const primaryButtonSx = {
  color: "var(--primary-color)",
  borderColor: "var(--primary-color)",
  "&:hover": {
    borderColor: "var(--primary-color)",
    backgroundColor: "rgba(128, 0, 32, 0.06)",
  },
};

const primaryContainedSx = {
  backgroundColor: "var(--primary-color)",
  "&:hover": { backgroundColor: "#5f001f" },
};

const blankPromo = {
  code: "",
  description: "",
  discountType: "percentage",
  discountValue: "",
  minimumSubtotal: "",
  startsAt: "",
  endsAt: "",
  indefinite: false,
  active: true,
  maxRedemptions: "",
  perUserLimit: "",
  audience: "past_customers",
};

const formatDate = (value) => (value ? new Date(value).toLocaleString() : "-");
const formatLabel = (value) =>
  String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
const toLocalInput = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const canManagePromos = (user) => {
  const position = user?.employeeDetails?.position?.name;
  const hierarchy = user?.employeeDetails?.position?.hierarchy?.name;
  const department = user?.employeeDetails?.department?.name || user?.employeeDetails?.department;
  return (
    hierarchy === "Owner" ||
    position === "Owner" ||
    ["Technology", "Finance"].includes(String(department))
  );
};

function AdminPromoCodes() {
  const [codes, setCodes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(blankPromo);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [loggedInUser, setLoggedInUser] = useState(null);

  const canManage = canManagePromos(loggedInUser);

  const load = async () => {
    setLoading(true);
    try {
      const [codesRes, meRes] = await Promise.allSettled([
        api.get("/promo-codes"),
        api.get("/users/me"),
      ]);
      if (codesRes.status === "fulfilled") {
        setCodes(codesRes.value.data?.data || codesRes.value.data || []);
      } else {
        setAlert({
          type: "error",
          message:
            codesRes.reason?.response?.data?.message ||
            "Failed to load promo codes.",
        });
      }
      if (meRes.status === "fulfilled") {
        setLoggedInUser(meRes.value.data?.user || meRes.value.data?.data || meRes.value.data);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(blankPromo);
    setDialogOpen(true);
  };

  const openEdit = (row) => {
    setEditing(row);
    setDialogOpen(true);
    setForm({
      code: row.code || "",
      description: row.description || "",
      discountType: row.discountType || row.type || "percentage",
      discountValue: row.discountValue ?? row.value ?? "",
      minimumSubtotal: row.minimumSubtotal ?? row.minSubtotal ?? "",
      startsAt: toLocalInput(row.startsAt || row.effectiveStartAt),
      endsAt: toLocalInput(row.endsAt || row.effectiveEndAt),
      indefinite: !!row.indefinite,
      active: row.active !== false && row.disabled !== true,
      maxRedemptions: row.maxRedemptions || "",
      perUserLimit: row.perUserLimit || "",
      audience: row.audience || "past_customers",
    });
  };

  const closeDialog = () => {
    setEditing(null);
    setForm(blankPromo);
    setDialogOpen(false);
  };

  const payload = useMemo(
    () => ({
      ...form,
      code: form.code.trim().toUpperCase(),
      discountValue: Number(form.discountValue) || 0,
      minimumSubtotal: form.minimumSubtotal === "" ? undefined : Number(form.minimumSubtotal),
      startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : undefined,
      endsAt: form.indefinite || !form.endsAt ? null : new Date(form.endsAt).toISOString(),
      maxRedemptions: form.maxRedemptions === "" ? undefined : Number(form.maxRedemptions),
      perUserLimit: form.perUserLimit === "" ? undefined : Number(form.perUserLimit),
    }),
    [form]
  );

  const save = async () => {
    if (!payload.code || !payload.discountValue) {
      setAlert({ type: "error", message: "Code and discount value are required." });
      return;
    }
    setSaving(true);
    try {
      if (editing?._id) {
        await api.patch(`/promo-codes/${editing._id}`, payload);
      } else {
        await api.post("/promo-codes", payload);
      }
      setAlert({ type: "success", message: editing ? "Promo code updated." : "Promo code created." });
      closeDialog();
      load();
    } catch (err) {
      setAlert({ type: "error", message: err?.response?.data?.message || "Failed to save promo code." });
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!deleting?._id) return;
    try {
      await api.delete(`/promo-codes/${deleting._id}`);
      setAlert({ type: "success", message: "Promo code deleted." });
      setDeleting(null);
      load();
    } catch (err) {
      setAlert({ type: "error", message: err?.response?.data?.message || "Failed to delete promo code." });
    }
  };

  const columns = [
    { field: "code", headerName: "Code", flex: 0.9 },
    {
      field: "discount",
      headerName: "Discount",
      flex: 0.9,
      valueGetter: (value, row) => {
        const r = value?.row || row || {};
        const type = r.discountType || r.type;
        const amount = r.discountValue ?? r.value ?? 0;
        return type === "fixed" ? `$${Number(amount).toFixed(2)}` : `${Number(amount)}%`;
      },
    },
    { field: "audience", headerName: "Audience", flex: 1, valueFormatter: (value) => formatLabel(value?.value ?? value) },
    { field: "startsAt", headerName: "Starts", flex: 1, valueFormatter: (value) => formatDate(value?.value ?? value) },
    {
      field: "endsAt",
      headerName: "Ends",
      flex: 1,
      valueGetter: (value, row) => {
        const r = value?.row || row || {};
        return r.indefinite ? "Indefinite" : formatDate(r.endsAt || r.effectiveEndAt);
      },
    },
    {
      field: "active",
      headerName: "Status",
      flex: 0.7,
      renderCell: (params) => (
        <Chip
          size="small"
          color={params.row.active !== false && params.row.disabled !== true ? "success" : "default"}
          label={params.row.active !== false && params.row.disabled !== true ? "Active" : "Disabled"}
        />
      ),
    },
    {
      field: "actions",
      headerName: "Actions",
      sortable: false,
      width: 160,
      renderCell: (params) => (
        <Stack direction="row" spacing={0.5}>
          <Tooltip title="Edit">
          <IconButton 
          sx={{
                  border: "1px solid",
                  borderColor: params.row.name !== "Owner" ? "var(--primary-color)" : 'grey',
                  borderRadius: "5px",
                  color: "var(--primary-color)",
                }}  disabled={!canManage} onClick={() => openEdit(params.row)}>
            <Edit />
          </IconButton>
          </Tooltip>
           <Tooltip title="Delete">
          <IconButton 
           sx={{
                  border: "1px solid",
                  borderColor: params.row.name !== "Owner" ? "var(--primary-color)" : 'grey',
                  borderRadius: "5px",
                  color: "var(--primary-color)",
                }}  disabled={!canManage} onClick={() => setDeleting(params.row)}>
            <Delete />
          </IconButton>
          </Tooltip>
        </Stack>
      ),
    },
  ];

  return (
    <Stack spacing={2}>
      <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1, flexWrap: "wrap" }}>
        <Box>
          <Typography variant="h5" fontWeight={800}>Promo Codes</Typography>
          <Typography variant="body2" color="text.secondary">
            View deals and manage active, scheduled, and indefinite discounts.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" startIcon={<Refresh />} onClick={load} sx={primaryButtonSx}>
            Refresh
          </Button>
          <Button variant="contained" startIcon={<Add />} disabled={!canManage} onClick={openCreate} sx={primaryContainedSx}>
            Add Code
          </Button>
        </Stack>
      </Box>

      {!canManage && (
        <Alert severity="info">
          You can view promo codes. Only Owners, Technology, and Finance can add, edit, disable, or delete them.
        </Alert>
      )}
      {alert && <Alert severity={alert.type} onClose={() => setAlert(null)}>{alert.message}</Alert>}

      <Paper variant="outlined" sx={{ height: 560 }}>
        <DataGrid
          rows={codes}
          columns={columns}
          getRowId={(row) => row._id || row.id || row.code}
          loading={loading}
          disableRowSelectionOnClick
          pageSizeOptions={[10, 25, 50]}
          initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
          slots={{ noRowsOverlay: () => <EmptyOverlay message="No promo codes yet." /> }}
        />
      </Paper>

      <Dialog
        open={dialogOpen}
        onClose={closeDialog}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            width: { xs: "calc(100% - 24px)", sm: 560 },
            maxHeight: { xs: "calc(100% - 24px)", sm: "90vh" },
          },
        }}
      >
        <DialogTitle>{editing ? "Edit Promo Code" : "Add Promo Code"}</DialogTitle>
        <DialogContent dividers sx={{ px: { xs: 2, sm: 3 }, py: 2.5 }}>
          <Stack spacing={2.25}>
            <Box>
              <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 1 }}>
                Promo Details
              </Typography>
              <Stack spacing={1.75}>
                <TextField
                  fullWidth
                  label="Code"
                  placeholder="FAMILY25"
                  value={form.code}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, code: e.target.value.toUpperCase() }))
                  }
                  helperText="Customers will enter this code at booking."
                />
                <TextField
                  fullWidth
                  multiline
                  minRows={3}
                  label="Description"
                  placeholder="25% off for employee family referrals"
                  value={form.description}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, description: e.target.value }))
                  }
                />
              </Stack>
            </Box>

            <Box>
              <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 1 }}>
                Discount
              </Typography>
              <Stack spacing={1.75}>
                <TextField
                  select
                  fullWidth
                  label="Discount Type"
                  value={form.discountType}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, discountType: e.target.value }))
                  }
                >
                  <MenuItem value="percentage">Percentage</MenuItem>
                  <MenuItem value="fixed">Fixed Amount</MenuItem>
                </TextField>
                <TextField
                  fullWidth
                  type="number"
                  label={form.discountType === "fixed" ? "Amount" : "Percent"}
                  placeholder={form.discountType === "fixed" ? "100" : "25"}
                  value={form.discountValue}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, discountValue: e.target.value }))
                  }
                  helperText={
                    form.discountType === "fixed"
                      ? "Dollar amount removed from the event subtotal."
                      : "Percentage removed from the event subtotal."
                  }
                />
                <TextField
                  fullWidth
                  type="number"
                  label="Minimum Event Subtotal"
                  placeholder="800"
                  value={form.minimumSubtotal}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, minimumSubtotal: e.target.value }))
                  }
                  helperText="Optional. Leave blank if there is no minimum spend."
                />
              </Stack>
            </Box>

            <Box>
              <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 1 }}>
                Schedule
              </Typography>
              <Stack spacing={1.75}>
                <TextField
                  fullWidth
                  type="datetime-local"
                  label="Effective Start"
                  value={form.startsAt}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, startsAt: e.target.value }))
                  }
                  InputLabelProps={{ shrink: true }}
                  helperText="When this promo should begin."
                />
                <TextField
                  fullWidth
                  type="datetime-local"
                  label="Effective End"
                  value={form.endsAt}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, endsAt: e.target.value }))
                  }
                  disabled={form.indefinite}
                  InputLabelProps={{ shrink: true }}
                  helperText={
                    form.indefinite
                      ? "Disabled because this promo has no end date."
                      : "When this promo should stop."
                  }
                />
              </Stack>
            </Box>

            <Box>
              <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 1 }}>
                Audience & Limits
              </Typography>
              <Stack spacing={1.75}>
                <TextField
                  select
                  fullWidth
                  label="Audience"
                  value={form.audience}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, audience: e.target.value }))
                  }
                >
                  <MenuItem value="past_customers">Past Customers</MenuItem>
                  <MenuItem value="all_customers">All Customers</MenuItem>
                  <MenuItem value="employees_family">Employee Family</MenuItem>
                  <MenuItem value="review_incentive">Review Incentive</MenuItem>
                </TextField>
                <TextField
                  fullWidth
                  type="number"
                  label="Max Redemptions"
                  value={form.maxRedemptions}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, maxRedemptions: e.target.value }))
                  }
                  helperText="Optional total number of times this promo can be used."
                />
                <TextField
                  fullWidth
                  type="number"
                  label="Per User Limit"
                  value={form.perUserLimit}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, perUserLimit: e.target.value }))
                  }
                  helperText="Optional number of uses allowed per customer."
                />
              </Stack>
            </Box>

            <Box>
              <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 1 }}>
                Status
              </Typography>
              <Stack spacing={0.5}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={form.indefinite}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, indefinite: e.target.checked }))
                      }
                    />
                  }
                  label="No end date"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={form.active}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, active: e.target.checked }))
                      }
                    />
                  }
                  label="Enabled"
                />
              </Stack>
            </Box>
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
          <Button onClick={closeDialog} fullWidth={false}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={save}
            disabled={saving || !canManage}
            sx={primaryContainedSx}
          >
            {saving ? "Saving..." : "Save"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!deleting} onClose={() => setDeleting(null)}>
        <DialogTitle>Delete Promo Code?</DialogTitle>
        <DialogContent>
          <Typography>Delete {deleting?.code}? This cannot be undone.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleting(null)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={remove}>Delete</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

export default AdminPromoCodes;
