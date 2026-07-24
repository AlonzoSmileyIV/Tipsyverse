// screens/UserSettings/UserSettingsScreen.jsx
import React, { useEffect, useState } from "react";
import { Box, Tabs, Tab, Tooltip, useMediaQuery } from "@mui/material";
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

const TabPanel = ({ children, value, index }) => (value === index ? <Box p={2}>{children}</Box> : null);

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
  
  const [tabIndex, setTabIndex] = useState(tabFromPath);

    // Sync tab when URL changes
    useEffect(() => {
      setTabIndex(tabFromPath);
    }, [tabFromPath]);
  
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
      const nextIndex = settingsTabs.findIndex((item) => item.route === route);
      if (nextIndex >= 0) setTabIndex(nextIndex);
      navigate(route);
    },
    [navigate, settingsTabs]
  );

  return (
    <PublicLayout>
      {isLoading ? (
        <LoadingSkeleton />
      ) : (
        <Box sx={{ display: "flex", minHeight: "100vh", p: 3 }}>
          <HelmetHeader title="Tipsyverse | Profile Settings" description="" />
          <Tabs
  orientation="vertical"
  value={tabIndex}
  onChange={(_, v) => {
    goToSettingsRoute(settingsTabs[v].route);
  }}
  sx={{
    borderRight: 1,
    borderColor: "divider",
    minWidth: isMobile ? 72 : 180,
    width: isMobile ? 72 : 180,
    flexShrink: 0,

    "& .MuiTab-root": {
      justifyContent: isMobile ? "center" : "flex-start",
      alignItems: "center",
      minHeight: 56,
      px: isMobile ? 1 : 2,
      textTransform: "none",
      color: "text.secondary",
    },

    "& .Mui-selected": {
      color: "var(--primary-color) !important",
      fontWeight: 700,
      borderRight: "3px solid var(--primary-color)",
      backgroundColor: "rgba(128, 0, 32, 0.06)",
    },

    "& .MuiTabs-indicator": {
      display: "none",
    },
  }}
>
  {settingsTabs.map((item) => (
    <Tooltip
      key={item.label}
      title={isMobile ? item.label : ""}
      placement="right"
      arrow
    >
      <Tab
        icon={item.icon}
        iconPosition={isMobile ? "top" : "start"}
        label={isMobile ? "" : item.label}
        aria-label={item.label}
      />
    </Tooltip>
  ))}
</Tabs>

          <Box sx={{ flexGrow: 1, p: 3 }}>
            <TabPanel value={tabIndex} index={0}><ProfileForm user={user} /></TabPanel>
            <TabPanel value={tabIndex} index={1}><PreferencesForm user={user} /></TabPanel>
            <TabPanel value={tabIndex} index={2}><ActivityForm user={user} /></TabPanel>
            {/* <TabPanel value={tabIndex} index={3}><PaymentMethodsTab user={user} /></TabPanel> */}
            <TabPanel value={tabIndex} index={3}><SecurityForm user={user} /></TabPanel>
            <TabPanel value={tabIndex} index={4}><HowToGuide audience="customer" /></TabPanel>
            <TabPanel value={tabIndex} index={5}><SupportTicketsForm /></TabPanel>
            <TabPanel value={tabIndex} index={6}><SettingAccountForm user={user} onNavigateToSettings={goToSettingsRoute} /></TabPanel>
          </Box>
        </Box>
      )}
    </PublicLayout>
  );
};

export default UserSettingsScreen;
