import {
  BadgeOutlined,
  CalendarMonthOutlined,
  CheckCircleOutline,
  EmailOutlined,
  HelpOutline,
  Logout as LogoutIcon,
  PersonOutline,
  SecurityOutlined,
  VerifiedUserOutlined,
} from "@mui/icons-material";
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import DeactivateDeleteDialog from "../DeactivateDeleteDialog/DeactivateDeleteDialog";
import { useLogout } from "../../utils/handleLogoutAsync";
import { formatStatus } from "../../utils/formatStatus";

const formatDate = (value) => {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const getAccountState = (user) =>
  user?.accountStatus?.state || user?.status || "Active";

const getProfileChecklist = (user) => [
  {
    label: "Add your full legal name",
    complete: Boolean(user?.fullName),
    route: "/settings",
  },
  {
    label: "Add a username",
    complete: Boolean(user?.username),
    route: "/settings",
  },
  {
    label: "Add your date of birth",
    complete: Boolean(user?.profile?.birthday || user?.profile?.dateOfBirth || user?.dateOfBirth),
    route: "/settings",
  },
  {
    label: "Add a profile photo",
    complete: Boolean(user?.profile?.photo),
    route: "/settings",
  },
  {
    label: "Keep an email address on file",
    complete: Boolean(user?.email),
    route: "/settings",
  },
];

const getProfileCompletion = (checklist) => {
  const complete = checklist.filter((item) => item.complete).length;
  return Math.round((complete / checklist.length) * 100);
};

const SettingAccountForm = ({ user, onNavigateToSettings }) => {
  const logout = useLogout();
  const navigate = useNavigate();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState(null);
  const accountState = getAccountState(user);
  const profileChecklist = getProfileChecklist(user);
  const missingProfileItems = profileChecklist.filter((item) => !item.complete);
  const profileCompletion = getProfileCompletion(profileChecklist);
  const joinedAt =
    user?.createdAt || user?.dateCreated || user?.profile?.dateCreated;
  const isEmployee = user?.role === "employee";

  const handleLogout = () => {
    logout();
  };

  const goToSettingsRoute = (route) => {
    if (onNavigateToSettings) {
      onNavigateToSettings(route);
      return;
    }
    navigate(route);
  };

  return (
    <Stack spacing={2.5}>
      <Box>
        <Typography variant="h4" fontWeight={800}>
          Account
        </Typography>
        <Typography variant="body1" color="text.secondary">
          View your account details, sign-in status, and account actions.
        </Typography>
      </Box>

      <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={2}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", md: "center" }}
        >
          <Stack direction="row" spacing={2} alignItems="center">
            <Box
              sx={{
                width: 58,
                height: 58,
                borderRadius: "50%",
                bgcolor: "rgba(139, 0, 38, 0.08)",
                color: "var(--primary-color)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 900,
                fontSize: 24,
              }}
            >
              {(user?.fullName || user?.username || user?.email || "?")
                .charAt(0)
                .toUpperCase()}
            </Box>
            <Box>
              <Typography variant="h5" fontWeight={800}>
                {user?.fullName || "Your account"}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {user?.email || "No email on file"}
              </Typography>
            </Box>
          </Stack>

          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Chip
              icon={<VerifiedUserOutlined />}
              label={formatStatus(accountState)}
              color={String(accountState).toLowerCase() === "active" ? "success" : "default"}
            />
            <Chip label={formatStatus(user?.role || "user")} variant="outlined" />
          </Stack>
        </Stack>
      </Paper>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr",
            sm: "repeat(2, minmax(0, 1fr))",
            lg: "repeat(4, minmax(0, 1fr))",
          },
          gap: 1.5,
        }}
      >
        {[
          {
            label: "Email",
            value: user?.email || "Not available",
            icon: <EmailOutlined />,
          },
          {
            label: "Username",
            value: user?.username || "Not available",
            icon: <BadgeOutlined />,
          },
          {
            label: "Member Since",
            value: formatDate(joinedAt),
            icon: <CalendarMonthOutlined />,
          },
          {
            label: "Profile",
            value: `${profileCompletion}% complete`,
            icon: <PersonOutline />,
          },
        ].map((item) => (
          <Paper key={item.label} variant="outlined" sx={{ p: 2 }}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Box sx={{ color: "var(--primary-color)", display: "flex" }}>
                {item.icon}
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="caption" color="text.secondary">
                  {item.label}
                </Typography>
                <Typography variant="subtitle2" fontWeight={800} noWrap>
                  {item.value}
                </Typography>
              </Box>
            </Stack>
          </Paper>
        ))}
      </Box>

      <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
        <Typography variant="h6" fontWeight={800}>
          Account Health
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Keep these details current so Tipsyverse can protect your account and reach you when needed.
        </Typography>
        <Stack spacing={1.25}>
          <Alert severity={user?.email ? "success" : "warning"}>
            {user?.email
              ? "Your account has an email address for sign-in and notifications."
              : "Add an email address so you can receive account notifications."}
          </Alert>
          <Alert severity={profileCompletion >= 80 ? "success" : "info"}>
            {profileCompletion >= 80
              ? "Your profile has the main details people need."
              : "Add profile details to make your account easier to verify and support."}
          </Alert>
        </Stack>
        <Divider sx={{ my: 2 }} />
        <Stack spacing={1.25}>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1}
            justifyContent="space-between"
            alignItems={{ xs: "flex-start", sm: "center" }}
          >
            <Box>
              <Typography variant="subtitle1" fontWeight={800}>
                Profile Completion
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {missingProfileItems.length
                  ? `${missingProfileItems.length} item${missingProfileItems.length === 1 ? "" : "s"} left to complete.`
                  : "Everything important is complete."}
              </Typography>
            </Box>
            <Chip
              label={`${profileCompletion}% complete`}
              color={profileCompletion >= 80 ? "success" : "warning"}
              variant={profileCompletion >= 80 ? "filled" : "outlined"}
            />
          </Stack>

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" },
              gap: 1,
            }}
          >
            {profileChecklist.map((item) => (
              <Paper
                key={item.label}
                variant="outlined"
                sx={{
                  p: 1.5,
                  borderColor: item.complete ? "success.light" : "divider",
                  bgcolor: item.complete ? "rgba(46, 125, 50, 0.05)" : "background.paper",
                }}
              >
                <Stack direction="row" spacing={1.25} alignItems="center">
                  <CheckCircleOutline
                    fontSize="small"
                    color={item.complete ? "success" : "disabled"}
                  />
                  <Typography
                    variant="body2"
                    color={item.complete ? "text.primary" : "text.secondary"}
                    sx={{ flex: 1 }}
                  >
                    {item.label}
                  </Typography>
                  {!item.complete && (
                    <Button
                      size="small"
                      onClick={() => goToSettingsRoute(item.route)}
                      sx={{ color: "var(--primary-color)", whiteSpace: "nowrap" }}
                    >
                      Fix
                    </Button>
                  )}
                </Stack>
              </Paper>
            ))}
          </Box>
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
        <Typography variant="h6" fontWeight={800}>
          Quick Actions
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Jump to the settings areas people usually need after opening account settings.
        </Typography>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} flexWrap="wrap" useFlexGap>
          <Button
            variant="outlined"
            startIcon={<PersonOutline />}
            onClick={() => goToSettingsRoute("/settings")}
            sx={{ borderColor: "var(--primary-color)", color: "var(--primary-color)" }}
          >
            Edit Profile
          </Button>
          <Button
            variant="outlined"
            startIcon={<SecurityOutlined />}
            onClick={() => goToSettingsRoute("/settings/security")}
            sx={{ borderColor: "var(--primary-color)", color: "var(--primary-color)" }}
          >
            Security
          </Button>
          <Button
            variant="outlined"
            startIcon={<HelpOutline />}
            onClick={() => goToSettingsRoute("/settings/support")}
            sx={{ borderColor: "var(--primary-color)", color: "var(--primary-color)" }}
          >
            Support
          </Button>
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
        <Typography variant="h6" fontWeight={800}>
          Sign Out
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Sign out when you are finished using Tipsyverse on this device.
        </Typography>
        <Button
          variant="contained"
          startIcon={<LogoutIcon />}
          onClick={handleLogout}
          sx={{ backgroundColor: "var(--primary-color)" }}
        >
          Logout
        </Button>
      </Paper>

      {/* Danger Zone */}
      {!isEmployee && (
        <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderColor: "error.light" }}>
          <Divider sx={{ mb: 2 }} />
          <Typography variant="h6" color="error">
            Danger Zone
          </Typography>

          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            You can deactivate or permanently delete your account here.
          </Typography>

          <Stack spacing={2}>
            <Button
              variant="outlined"
              sx={{
                borderColor: "var(--primary-color)",
                color: "var(--primary-color)",
              }}
              onClick={() => {
                setDialogMode("deactivate");
                setDialogOpen(true);
              }}
            >
              Deactivate Account
            </Button>

            <Button
              variant="contained"
              color="error"
              onClick={() => {
                setDialogMode("delete");
                setDialogOpen(true);
              }}
            >
              Delete Account
            </Button>
          </Stack>
        </Paper>
      )}

      <DeactivateDeleteDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        mode={dialogMode}
        user={user}
      />
    </Stack>
  );
};

export default SettingAccountForm;
