// screens/UserSettings/UserSettingsScreen.jsx
import React, { useEffect, useState } from "react";
import { Box, Tabs, Tab, useMediaQuery } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import {
  PersonOutline,
  TuneOutlined,
  FavoriteBorderOutlined,
  SecurityOutlined,
  ManageAccountsOutlined,
  SupportAgentOutlined,
  HelpOutline,
} from "@mui/icons-material";
import PublicLayout from "../../components/PublicLayout/PublicLayout";
import ProfileForm from "../../components/ProfileForm/ProfileForm";
import PreferencesForm from "../../components/PreferencesForm/PreferencesForm";
import ActivityForm from "../../components/ActivityForm/ActivityForm";
import SecurityForm from "../../components/SecurityForm/SecurityForm";
import SettingAccountForm from "../../components/SettingAccountForm/SettingAccountForm";
import SupportTicketsForm from "../../components/SupportTicketsForm/SupportTicketsForm";
import HowToGuide from "../../components/HowToGuide/HowToGuide";
import LoadingSkeleton from "../../components/LoadingSkeleton/LoadingSkeleton";
import HelmetHeader from "../../components/HelmetHeader/Helmet";
import { useSelector } from "react-redux";
import { useLocation, useNavigate } from "react-router-dom";

const TabPanel = ({ children, value, index }) =>
  value === index ? <Box sx={{ p: { xs: 0, md: 2 }, minWidth: 0 }}>{children}</Box> : null;

const UserSettingsScreen = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  // Map routes to tab index
    const tabFromPath = React.useMemo(() => {
  if (location.pathname.includes("/settings/preferences")) return 1;
  if (location.pathname.includes("/settings/activity")) return 2;
  // if (location.pathname.includes("/settings/payment-methods")) return 3;
  if (location.pathname.includes("/settings/security")) return 3;
  if (location.pathname.includes("/settings/how-to")) return 4;
  if (location.pathname.includes("/settings/support")) return 5;
  if (location.pathname.includes("/settings/account")) return 6;
  return 0;
}, [location.pathname]);
  
  const [showContent, setShowContent] = useState(false);
  const loggedInUser = useSelector((s) => s.users.loggedInUser);
  const user = loggedInUser?.user;

  useEffect(() => {
    const t = setTimeout(() => setShowContent(true), 800);
    return () => clearTimeout(t);
  }, []);

  const isLoading = !showContent;

  const settingsTabs = React.useMemo(() => [
  { label: "Profile", icon: <PersonOutline />, route: "/settings" },
  { label: "Preferences", icon: <TuneOutlined />, route: "/settings/preferences" },
  { label: "Activity", icon: <FavoriteBorderOutlined />, route: "/settings/activity" },
  // { label: "Payment Method", icon: <PaymentOutlined />, route: "/settings/payment-methods" },
  { label: "Security", icon: <SecurityOutlined />, route: "/settings/security" },
  { label: "How To", icon: <HelpOutline />, route: "/settings/how-to" },
  { label: "Support", icon: <SupportAgentOutlined />, route: "/settings/support" },
  { label: "Account", icon: <ManageAccountsOutlined />, route: "/settings/account" },
], []);

  const goToSettingsRoute = React.useCallback(
    (route) => {
      navigate(route);
    },
    [navigate]
  );

  return (
    <PublicLayout>
      {isLoading ? (
        <LoadingSkeleton />
      ) : (
        <Box sx={{ display: "flex", flexDirection: { xs: "column", md: "row" }, minHeight: "100vh", width: "100%", minWidth: 0, p: { xs: 1.5, sm: 2, md: 3 } }}>
          <HelmetHeader title="Tipsyverse | Profile Settings" description="" />
          <Tabs
  orientation={isMobile ? "horizontal" : "vertical"}
  variant={isMobile ? "scrollable" : "standard"}
  scrollButtons={isMobile ? "auto" : false}
  allowScrollButtonsMobile
  slotProps={isMobile ? {
    scroller: {
      tabIndex: 0,
      role: "region",
      "aria-label": "Settings sections",
    },
  } : undefined}
  value={settingsTabs[tabFromPath].route}
  onChange={(_, route) => goToSettingsRoute(route)}
  sx={{
    borderRight: isMobile ? 0 : 1,
    borderBottom: isMobile ? 1 : 0,
    borderColor: "divider",
    minWidth: 0,
    width: isMobile ? "100%" : 180,
    maxWidth: "100%",
    flexShrink: 0,

    "& .MuiTab-root": {
      justifyContent: "flex-start",
      alignItems: "center",
      minHeight: 56,
      px: 2,
      minWidth: isMobile ? "auto" : 180,
      textTransform: "none",
      color: "text.secondary",
    },

    "& .Mui-selected": {
      color: "var(--primary-color) !important",
      fontWeight: 700,
      borderRight: isMobile ? 0 : "3px solid var(--primary-color)",
      borderBottom: isMobile ? "3px solid var(--primary-color)" : 0,
      backgroundColor: "rgba(128, 0, 32, 0.06)",
    },

    "& .MuiTabs-indicator": {
      display: "none",
    },
  }}
>
  {settingsTabs.map((item) => (
    <Tab
      key={item.route}
      value={item.route}
      icon={item.icon}
      iconPosition="start"
      label={item.label}
      aria-label={item.label}
    />
  ))}
</Tabs>

          <Box sx={{ flexGrow: 1, minWidth: 0, width: "100%", p: { xs: 1, md: 3 } }}>
            <TabPanel value={tabFromPath} index={0}><ProfileForm user={user} /></TabPanel>
            <TabPanel value={tabFromPath} index={1}><PreferencesForm user={user} /></TabPanel>
            <TabPanel value={tabFromPath} index={2}><ActivityForm user={user} /></TabPanel>
            {/* <TabPanel value={tabIndex} index={3}><PaymentMethodsTab user={user} /></TabPanel> */}
            <TabPanel value={tabFromPath} index={3}><SecurityForm user={user} /></TabPanel>
            <TabPanel value={tabFromPath} index={4}><HowToGuide audience="customer" /></TabPanel>
            <TabPanel value={tabFromPath} index={5}><SupportTicketsForm /></TabPanel>
            <TabPanel value={tabFromPath} index={6}><SettingAccountForm user={user} onNavigateToSettings={goToSettingsRoute} /></TabPanel>
          </Box>
        </Box>
      )}
    </PublicLayout>
  );
};

export default UserSettingsScreen;
