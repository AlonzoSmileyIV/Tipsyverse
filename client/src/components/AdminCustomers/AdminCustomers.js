// AdminCustomers.jsx
import React, {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Box,
  Typography,
  Avatar,
  Drawer,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  MenuItem,
  TextField,
  Checkbox,
  FormControlLabel,
  Chip,
  useMediaQuery,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Alert,
  Tabs,
  Tab,
  Divider,
  Stack,
} from "@mui/material";
import {
  Delete,
  Block,
  Email,
  Cake,
} from "@mui/icons-material";
import { DataGrid } from "@mui/x-data-grid";
import { useTheme } from "@mui/material/styles";
import SafeHtml from "../SafeHtml/SafeHtml";
import { Link } from "react-router-dom";
import moment from "moment";
import { useDispatch, useSelector } from "react-redux";
import { fetchAllRegularUsers } from "../../features/users/userSlice";
import api from "../../services/api";
import EmptyOverlay from "../EmptyOverlay/EmptyOverlay";
import AdminSectionHeader from "../AdminSectionHeader/AdminSectionHeader";
import AdminTableControls from "../AdminTableControls/AdminTableControls";
import DetailDrawerHeader from "../DetailDrawerHeader/DetailDrawerHeader";
import { formatStatus } from "../../utils/formatStatus";
import ActivityLogsTable from "../ActivityLogsTable/LazyActivityLogsTable";
import { loadSpreadsheet } from "../../utils/loadSpreadsheet";

const todayLocalISO = (() => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  // shift to “fake UTC” so toISOString keeps the local date
  const tzSafe = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return tzSafe.toISOString().split("T")[0];
})();

const statusColor = (state) => {
  switch (state) {
    case "Active":
      return "success";
    case "Suspended":
      return "warning";
    case "Terminated":
      return "error";
    case "Deactivated":
      return "default";
    default:
      return "default";
  }
};

const formatDateNice = (d) => {
  if (!d) return "N/A";
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return "N/A";
  // you already use moment; keep it consistent:
  return moment.utc(date).format("MMM DD, YYYY");
};

const BOOKING_RESTRICTION_REASON_MAX = 100;

const pickStatusSince = (as = {}, fallbackDates = {}) => {
  // prefer a dedicated field if you add it
  if (as.statusSince) return as.statusSince;

  // good fallbacks by state
  if (as.state === "Deactivated" && as.deactivationDateStarted) {
    return as.deactivationDateStarted;
  }
  if (as.state === "Suspended" && as.suspensionDateStarts) {
    return as.suspensionDateStarts; // add this if you want
  }
  // last resort
  return fallbackDates.updatedAt || fallbackDates.createdAt || null;
};

const Section = ({ title, children, sx }) => (
  <Box
    sx={{ mt: 1, p: 2, borderRadius: 2, bgcolor: "background.paper", ...sx }}
  >
    {title && (
      <Typography variant="subtitle2" sx={{ mb: 1, color: "text.secondary" }}>
        {title}
      </Typography>
    )}
    {children}
  </Box>
);

const InfoRow = ({ icon: Icon, children }) => (
  <Box sx={{ display: "flex", alignItems: "center", gap: 1, minHeight: 28 }}>
    {Icon && <Icon sx={{ color: "text.disabled", fontSize: 18 }} />}
    <Typography variant="body2" color="text.secondary">
      {children}
    </Typography>
  </Box>
);

const AdminCustomers = ({ hideHeader = false }) => {
  const dispatch = useDispatch();
  const [search, setSearch] = useState("");
  const [alertMessage, setAlertMessage] = useState("");
  const [alertSeverity, setAlertSeverity] = useState("info");
  const [selectedUser, setSelectedUser] = useState(null);
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [indefinite, setIndefinite] = useState(false);
  const [reason, setReason] = useState("");
  const [explanation, setExplanation] = useState("");
  const [endDate, setEndDate] = useState("");
  const [dateError, setDateError] = useState("");
  const [bookingAllowed, setBookingAllowed] = useState(true);
  const [bookingRestrictionReason, setBookingRestrictionReason] = useState("");
  const [showMoreLiked, setShowMoreLiked] = useState(false);
  const [showMoreBookmarked, setShowMoreBookmarked] = useState(false);
  const allCustomers = useSelector((state) => state.users?.allRegularUsers);
  const [saving, setSaving] = useState(false);
  const [drawerTab, setDrawerTab] = useState(0); // 0 = Details, 1 = Activity
  const initializedBookingUserId = useRef(null);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const isTablet = useMediaQuery(theme.breakpoints.down("md"));

  const customersData = useMemo(
    () => (allCustomers?.data?.length ? allCustomers?.data : []),
    [allCustomers]
  );

  const fetchAllData = useCallback(() => {
    Promise.all([dispatch(fetchAllRegularUsers())]);
  }, [dispatch]);

  const isSuspendInvalid =
    !reason.trim() ||
    !explanation.trim() ||
    (!indefinite &&
      (!endDate || new Date(endDate) < new Date().setHours(0, 0, 0, 0)));

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  const handleRefresh = () => {
    fetchAllData();
  };

  const handleRefreshClick = (message = "Refreshed successfully!") => {
    setAlertMessage(message);
    setAlertSeverity("success");
    handleRefresh();

    setTimeout(() => {
      setAlertMessage(null);
      setAlertSeverity("info");
    }, 3000);
  };

  const handleDownloadExcel = async () => {
    const XLSX = await loadSpreadsheet();
    if (!filteredRows.length) {
      setAlertMessage("No customers to export yet.");
      setAlertSeverity("info");
      return;
    }
    const data = filteredRows.map(
      ({ fullName, dateOfBirth, dateCreated, status }) => ({
        Name: fullName,
        "Date of Birth": dateOfBirth,
        "Date Created": dateCreated,
        Status: status,
      })
    );
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Customers");
    XLSX.writeFile(workbook, "Customers.xlsx");
  };

  const handleSuspendConfirm = async () => {
    if (!selectedUser?._id) return;

    // basic validation
    if (!reason) {
      setAlertMessage("Please select a suspension reason.");
      setAlertSeverity("warning");
      return;
    }
    if (!indefinite && !endDate) {
      setAlertMessage("Provide an end date or mark as Indefinite.");
      setAlertSeverity("warning");
      return;
    }

    try {
      setSaving(true);
      await api.post(`/users/${selectedUser._id}/suspend`, {
        reason,
        suspensionExplanation: explanation,
        endDate: indefinite ? null : new Date(endDate),
        indefinite: Boolean(indefinite),
      });

      setAlertMessage("User suspended successfully.");
      setAlertSeverity("success");
      setSuspendOpen(false);
      setSelectedUser(null);
      fetchAllData();
    } catch (err) {
      setAlertMessage(
        err?.response?.data?.message || "Failed to suspend user."
      );
      setAlertSeverity("error");
    } finally {
      setSaving(false);
      setTimeout(() => setAlertMessage(""), 3000);
    }
  };

  const handleUnsuspend = async () => {
    if (!selectedUser?._id) return;
    try {
      setSaving(true);
      await api.post(`/users/${selectedUser._id}/unsuspend`);
      setAlertMessage("User unsuspended.");
      setAlertSeverity("success");
      setSuspendOpen(false);
      setSelectedUser(null);
      fetchAllData();
    } catch (err) {
      setAlertMessage(
        err?.response?.data?.message || "Failed to unsuspend user."
      );
      setAlertSeverity("error");
    } finally {
      setSaving(false);
      setTimeout(() => setAlertMessage(""), 3000);
    }
  };

  const openSuspendDialog = () => {
    const s = selectedUser?.accountStatus || {};
    setReason(s?.reasonForSuspension || "");
    setExplanation(s?.suspensionExplanation || ""); // optional, if you don't persist it
    const indefiniteVal = !!s?.suspensionIndefinite;
    setIndefinite(indefiniteVal);
    setEndDate(
      s?.suspensionDateEnds
        ? moment(s.suspensionDateEnds).format("YYYY-MM-DD")
        : ""
    );
    setSuspendOpen(true);
  };

  const handleSaveBookingAccess = async () => {
    if (!selectedUser?._id) return;
    if (!bookingAllowed && !bookingRestrictionReason.trim()) {
      setAlertMessage("Please explain why this customer cannot book events.");
      setAlertSeverity("warning");
      return;
    }

    try {
      setSaving(true);
      const res = await api.put(`/users/${selectedUser._id}`, {
        accountStatus: {
          ...selectedUser.accountStatus,
          allowedToBookEvent: bookingAllowed,
          bookingRestrictionReason: bookingAllowed
            ? ""
            : bookingRestrictionReason
                .trim()
                .slice(0, BOOKING_RESTRICTION_REASON_MAX),
        },
      });
      const updated = res?.data?.data || {
        ...selectedUser,
        accountStatus: {
          ...selectedUser.accountStatus,
          allowedToBookEvent: bookingAllowed,
          bookingRestrictionReason: bookingAllowed
            ? ""
            : bookingRestrictionReason
                .trim()
                .slice(0, BOOKING_RESTRICTION_REASON_MAX),
        },
      };
      setSelectedUser(updated);
      setAlertMessage("Booking access updated.");
      setAlertSeverity("success");
      fetchAllData();
    } catch (err) {
      setAlertMessage(
        err?.response?.data?.message || "Failed to update booking access."
      );
      setAlertSeverity("error");
    } finally {
      setSaving(false);
      setTimeout(() => setAlertMessage(""), 3000);
    }
  };

  const columns = [
    {
      field: "user",
      headerName: "User",
      width: isMobile ? 145 : 230,
      sortable: false,
      renderCell: (params) => {
        const { profile, fullName, email } = params.row;
        return (
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Avatar src={profile.photo || undefined}>
              {!profile.photo && fullName[0]}
            </Avatar>
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
      field: "createdAt",
      headerName: "Date Created",
      flex: 1,
      renderCell: (params) => {
        const createdAt = params.row.createdAt;
        const date = createdAt ? new Date(createdAt) : null;
        return date && !isNaN(date)
          ? new Intl.DateTimeFormat("en-US", { timeZone: "UTC" }).format(date)
          : "N/A";
      },
    },
    {
      field: "status",
      headerName: "Status",
      flex: 1,
      renderCell: (params) => (
        <Chip
          label={formatStatus(params.row?.accountStatus?.state)}
          color={
            params.row?.accountStatus?.state === "Active"
              ? "success"
              : params.row?.accountStatus?.state === "Suspended"
              ? "warning"
              : params.row?.accountStatus?.state === "Terminated"
              ? "error"
              : "default"
          }
          size="small"
        />
      ),
    },
    {
      field: "actions",
      headerName: "Actions",
      width: 120,
      align: "center",
      headerAlign: "center",
      sortable: false,
      filterable: false,
      renderCell: (params) => (
        
          <Button
            variant="outlined"
            sx={{
              borderColor: "var(--primary-color)",
              color: "var(--primary-color)",
              whiteSpace: "nowrap",
            }}
            onClick={() => setSelectedUser(params.row)}
          >
            Review
          </Button>
        
      ),
    },
  ];

  const filteredRows = customersData.filter((user) => {
    const name = (user?.fullName || "").toLowerCase();
    const username = (user?.username || "").toLowerCase();
    const q = search.toLowerCase();
    return name.includes(q) || username.includes(q);
  });

  useEffect(() => {
    if (!selectedUser?._id) {
      initializedBookingUserId.current = null;
      return;
    }
    if (initializedBookingUserId.current === selectedUser._id) return;
    initializedBookingUserId.current = selectedUser._id;
    setDrawerTab(0); // reset to Details on open/user change
    setBookingAllowed(selectedUser?.accountStatus?.allowedToBookEvent !== false);
    setBookingRestrictionReason(
      selectedUser?.accountStatus?.bookingRestrictionReason || ""
    );
  }, [
    selectedUser?._id,
    selectedUser?.accountStatus?.allowedToBookEvent,
    selectedUser?.accountStatus?.bookingRestrictionReason,
  ]);

  return (
    <Box>
      {!hideHeader && (
        <Box sx={{ mb: 2 }}>
          <AdminSectionHeader
            title="Customers"
            subtitle="Manage customer accounts, activity, and account status."
            onRefresh={() => handleRefreshClick()}
            onDownload={handleDownloadExcel}
          />
        </Box>
      )}

      {/* Alert Message */}
      {alertMessage && (
        <Box
          sx={{
            mb: 2,
            maxHeight: 250,
            overflowX: "auto",
            overflowY: "auto",
            width: "100%",
            borderRadius: 2,
          }}
        >
          <Alert
            severity={alertSeverity}
            sx={{
              minWidth: "fit-content",
              width: "100%",
              //display: "inline-block",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            <SafeHtml html={alertMessage} />
          </Alert>
        </Box>
      )}

      <AdminTableControls
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search customer name or username..."
      />

      <Box sx={{ height: 500, width: "100%" }}>
        <DataGrid
          rows={filteredRows}
          columns={columns}
          getRowId={(row) => row._id}
          pageSize={10}
          rowsPerPageOptions={[10, 20, 50]}
          columnVisibilityModel={{
            createdAt: !isTablet,
            status: !isMobile,
          }}
          disableSelectionOnClick
          slots={{
            noRowsOverlay: () => (
              <EmptyOverlay message="No customes match this filter." />
            ),
          }}
          // MUI v5 fallback (safe to keep)
          components={{
            NoRowsOverlay: () => (
              <EmptyOverlay message="No customers match this filter." />
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

      <Drawer
        anchor="right"
        open={!!selectedUser}
        onClose={() => setSelectedUser(null)}
        PaperProps={{ sx: { width: isMobile ? "90%" : 560, p: 0 } }} // was 80% / 400
        ModalProps={{
          keepMounted: true, // you already had this (good)
          disableAutoFocus: true, // 👈 prevents scroll-to-focused-element
          disableEnforceFocus: true, // 👈 optional; avoids focus bouncing
          disableRestoreFocus: true, // 👈 optional; avoids jumping when closing
          // disableScrollLock: true,  // only if body scroll lock causes layout jumps
        }}

        //PaperProps={{ sx: { width: isMobile ? "80%" : 400, p: 2 } }}
      >
        {selectedUser && (
          <Box
            sx={{ display: "flex", flexDirection: "column", height: "100%" }}
          >
            <DetailDrawerHeader
              title={selectedUser.fullName || "Customer Details"}
              summary={
                selectedUser?.accountStatus?.state === "Suspended"
                  ? "This customer is suspended. Review recent activity before restoring access."
                  : selectedUser?.email
                    ? "This customer account is active for bookings, payments, saved drinks, and support history."
                    : "This customer is missing an email address, which may affect booking and payment communication."
              }
              statusChip={
                selectedUser?.accountStatus?.state ? (
                  <Chip
                    label={formatStatus(selectedUser.accountStatus.state)}
                    size="small"
                    color={statusColor(selectedUser.accountStatus.state)}
                  />
                ) : null
              }
              facts={[
                { label: "Email", value: selectedUser.email },
                {
                  label: "Birthday",
                  value: selectedUser?.profile?.birthday
                    ? moment.utc(selectedUser.profile.birthday).format("MMM DD, YYYY")
                    : "Not provided",
                },
                {
                  label: "Saved",
                  value: `${selectedUser?.savedDrinks?.length || 0} drinks`,
                },
                {
                  label: "Last Activity",
                  value: formatDateNice(
                    pickStatusSince(selectedUser.accountStatus, {
                      updatedAt: selectedUser.updatedAt,
                      createdAt: selectedUser.createdAt,
                    })
                  ),
                },
              ]}
              onClose={() => setSelectedUser(null)}
            />
            <Box sx={{ px: 2, pt: 1 }}>
              <Tabs
                value={drawerTab}
                onChange={(_, v) => setDrawerTab(v)}
                sx={{ mb: 2 }}
                TabIndicatorProps={{
                  sx: { backgroundColor: "var(--primary-color)" },
                }}
              >
                <Tab label="Details" sx={{ textTransform: "none" }} />
                <Tab label="Activity" sx={{ textTransform: "none" }} />
              </Tabs>
            </Box>

            <Box sx={{ flex: 1, overflowY: "auto", p: 2 }}>
              {drawerTab === 0 && (
                <>
                  {/* Contact */}
                  <Section title="Email">
                    <InfoRow icon={Email}>{selectedUser.email}</InfoRow>
                  </Section>

                  {/* Birthday */}
                  <Section title="Birthday">
                    <InfoRow icon={Cake}>
                      {moment
                        .utc(selectedUser?.profile?.birthday)
                        .format("MMM DD, YYYY")}
                    </InfoRow>
                  </Section>

                  {/* Bio */}
                  <Section title="Bio">
                    <Box
                      sx={{
                        maxHeight: 140,
                        overflowY: "auto",
                        p: 1,
                        borderRadius: 1,
                        bgcolor: "background.default",
                        border: (theme) => `1px solid ${theme.palette.divider}`,
                      }}
                    >
                      <Typography
                        variant="body2"
                        sx={{ whiteSpace: "pre-wrap" }}
                      >
                        {selectedUser?.profile?.bio || "No bio provided."}
                      </Typography>
                    </Box>
                  </Section>

                  <Section title="Booking Access">
                    <Stack spacing={1.5}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={bookingAllowed}
                            onChange={(event) =>
                              setBookingAllowed(event.target.checked)
                            }
                          />
                        }
                        label="Allowed to book event"
                      />
                      {!bookingAllowed && (
                        <TextField
                          fullWidth
                          multiline
                          minRows={3}
                          label="Reason shown to customer"
                          value={bookingRestrictionReason}
                          onChange={(event) =>
                            setBookingRestrictionReason(
                              event.target.value.slice(
                                0,
                                BOOKING_RESTRICTION_REASON_MAX
                              )
                            )
                          }
                          inputProps={{ maxLength: BOOKING_RESTRICTION_REASON_MAX }}
                          helperText={`${bookingRestrictionReason.length}/${BOOKING_RESTRICTION_REASON_MAX} characters. This appears in the first step of the booking form.`}
                        />
                      )}
                      <Box>
                        <Button
                          variant="contained"
                          onClick={handleSaveBookingAccess}
                          disabled={
                            saving ||
                            (!bookingAllowed && !bookingRestrictionReason.trim())
                          }
                          sx={{ backgroundColor: "var(--primary-color)" }}
                        >
                          {saving ? "Saving..." : "Save Booking Access"}
                        </Button>
                      </Box>
                    </Stack>
                  </Section>

                  {/* Liked Drinks */}
                  <Section title="Liked Drinks">
                    {Array.isArray(selectedUser?.likedDrinks) &&
                    selectedUser.likedDrinks.length > 0 ? (
                      <>
                        <List
                          dense
                          sx={{ maxHeight: 160, overflowY: "auto", pt: 0 }}
                        >
                          {selectedUser.likedDrinks
                            .slice(
                              0,
                              showMoreLiked
                                ? selectedUser.likedDrinks.length
                                : 12
                            )
                            .map((drink, idx) => (
                              <ListItem
                                key={idx}
                                disableGutters
                                component={Link}
                                to={`/drinks/${drink.slug}`}
                              >
                                <ListItemAvatar>
                                  <Avatar src={drink.image} />
                                </ListItemAvatar>
                                <ListItemText
                                  primaryTypographyProps={{ variant: "body2" }}
                                  primary={drink.name}
                                />
                              </ListItem>
                            ))}
                        </List>
                        {selectedUser.likedDrinks.length > 12 && (
                          <Button
                            size="small"
                            onClick={() => setShowMoreLiked((p) => !p)}
                            sx={{ mt: 1 }}
                          >
                            {showMoreLiked
                              ? "Show less"
                              : `${selectedUser.likedDrinks.length - 12} more`}
                          </Button>
                        )}
                      </>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        No liked drinks
                      </Typography>
                    )}
                  </Section>

                  {/* Saved Drinks */}
                  <Section title="Saved Drinks">
                    {Array.isArray(selectedUser?.savedDrinks) &&
                    selectedUser.savedDrinks.length > 0 ? (
                      <>
                        <List
                          dense
                          sx={{ maxHeight: 160, overflowY: "auto", pt: 0 }}
                        >
                          {selectedUser.savedDrinks
                            .slice(
                              0,
                              showMoreBookmarked
                                ? selectedUser.savedDrinks.length
                                : 12
                            )
                            .map((drink, idx) => (
                              <ListItem
                                key={idx}
                                disableGutters
                                component={Link}
                                to={`/drinks/${drink.slug}`}
                              >
                                <ListItemAvatar>
                                  <Avatar src={drink.image} />
                                </ListItemAvatar>
                                <ListItemText
                                  primaryTypographyProps={{ variant: "body2" }}
                                  primary={drink.name}
                                />
                              </ListItem>
                            ))}
                        </List>
                        {selectedUser.savedDrinks.length > 12 && (
                          <Button
                            size="small"
                            onClick={() => setShowMoreBookmarked((p) => !p)}
                            sx={{ mt: 1 }}
                          >
                            {showMoreBookmarked
                              ? "Show less"
                              : `${selectedUser.savedDrinks.length - 12} more`}
                          </Button>
                        )}
                      </>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        No saved drinks
                      </Typography>
                    )}
                  </Section>
                </>
              )}

              {drawerTab === 1 && (
                <Box sx={{ mt: 1 }}>
                  {/* ACTIVITY PANEL (mount only on demand) */}
                  <Suspense
                    fallback={<Typography>Loading activity…</Typography>}
                  >
                    <ActivityLogsTable
                      key={selectedUser._id}
                      entityModel="User"
                      entityId={selectedUser._id}
                    />
                  </Suspense>
                </Box>
              )}
            </Box>

            {/* Actions */}
            <Divider />
            <Box sx={{ p: 2, display: "flex", gap: 1, flexWrap: "wrap" }}>
              <Button
                variant="outlined"
                color="warning"
                startIcon={<Block />}
                onClick={openSuspendDialog}
              >
                {selectedUser.accountStatus.state !== "Suspended"
                  ? "Suspend"
                  : "Edit Suspension"}
              </Button>
              {selectedUser.accountStatus.state === "Suspended" && (
                <Button variant="outlined" color="error" startIcon={<Delete />}>
                  Delete
                </Button>
              )}
            </Box>
          </Box>
        )}
      </Drawer>

      <Dialog
        open={suspendOpen}
        onClose={() => setSuspendOpen(false)}
        disableAutoFocus
        disableEnforceFocus
        disableRestoreFocus
      >
        <DialogTitle>
          {selectedUser?.status === "Suspended"
            ? "Edit Suspension"
            : "Suspend User"}
        </DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <TextField
            fullWidth
            select
            label="Reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            margin="dense"
          >
            <MenuItem value="Abusive behavior">Abusive behavior</MenuItem>
            <MenuItem value="Spamming">Spamming</MenuItem>
            <MenuItem value="Violation of terms">Violation of terms</MenuItem>
          </TextField>

          <TextField
            fullWidth
            label="Explanation"
            multiline
            rows={5}
            value={explanation}
            onChange={(e) => setExplanation(e.target.value)}
            margin="dense"
          />

          <FormControlLabel
            control={
              <Checkbox
                checked={indefinite}
                onChange={(e) => setIndefinite(e.target.checked)}
              />
            }
            label="Indefinite Suspension"
          />

          {!indefinite && (
            <TextField
              fullWidth
              type="date"
              label="End Date"
              InputLabelProps={{ shrink: true }}
              inputProps={{ min: todayLocalISO }}
              value={endDate}
              onChange={(e) => {
                const v = e.target.value; // "YYYY-MM-DD"
                setEndDate(v);
                // simple client-side validation: must be today or later
                if (v && v < todayLocalISO)
                  setDateError("End date cannot be earlier than today.");
                else setDateError("");
              }}
              error={Boolean(dateError)}
              helperText={dateError || ""}
              margin="dense"
              disabled={saving}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSuspendOpen(false)} disabled={saving}>
            Cancel
          </Button>
          {selectedUser?.accountStatus?.state === "Suspended" && (
            <Button color="success" onClick={handleUnsuspend} disabled={saving}>
              {saving ? "Working..." : "Unsuspend"}
            </Button>
          )}
          <Button
            variant="contained"
            onClick={handleSuspendConfirm}
            disabled={saving || isSuspendInvalid}
          >
            {saving ? "Saving..." : "Save"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AdminCustomers;
