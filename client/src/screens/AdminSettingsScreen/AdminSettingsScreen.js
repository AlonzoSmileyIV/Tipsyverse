// AdminSettingsScreen.jsx
import React, { lazy, Suspense, useEffect, useMemo, useState } from "react";
import {
  Badge,
  Box,
  CircularProgress,
  Tab,
  Tabs,
  Tooltip,
  useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import {
  Category as CategoryIcon,
  Dashboard as DashboardIcon,
  Event as EventIcon,
  FactCheck as FactCheckIcon,
  Groups as GroupsIcon,
  HelpOutline as HelpIcon,
  LocalBar as LocalBarIcon,
  Paid as PaidIcon,
} from "@mui/icons-material";
import { useLocation, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import PublicLayout from "../../components/PublicLayout/PublicLayout";
import HelmetHeader from "../../components/HelmetHeader/Helmet";
import LoadingSkeleton from "../../components/LoadingSkeleton/LoadingSkeleton";
import { fetchAllEvents, selectAllEvents } from "../../features/events/eventSlice";

const AdminNeedsAttention = lazy(() =>
  import("../../components/AdminNeedsAttention/AdminNeedsAttention")
);
const AdminEvents = lazy(() =>
  import("../../components/AdminEvents/AdminEvents")
);
const AdminFinance = lazy(() =>
  import("../../components/AdminFinance/AdminFinance")
);
const AdminUsers = lazy(() =>
  import("../../components/AdminUsers/AdminUsers")
);
const AdminOperationsHub = lazy(() =>
  import("../../components/AdminOperationsHub/AdminOperationsHub")
);
const AdminDrinksHub = lazy(() =>
  import("../../components/AdminDrinksHub/AdminDrinksHub")
);
const AdminCategories = lazy(() =>
  import("../../components/AdminCategories/AdminCategories")
);
const HowToGuide = lazy(() =>
  import("../../components/HowToGuide/HowToGuide")
);

const TabPanel = ({ value, index, children }) =>
  value === index ? (
    <Box sx={{ mt: 4, minWidth: 0 }}>
      <Suspense
        fallback={
          <Box sx={{ display: "grid", minHeight: 320, placeItems: "center" }}>
            <CircularProgress
              aria-label="Loading admin section"
              sx={{ color: "var(--primary-color)" }}
            />
          </Box>
        }
      >
        {children}
      </Suspense>
    </Box>
  ) : null;

const ADMIN_TABS = [
  {
    key: "overview",
    label: "Overview",
    icon: <DashboardIcon />,
    Component: AdminNeedsAttention,
  },
  {
    key: "events",
    label: "Events",
    icon: <EventIcon />,
    Component: AdminEvents,
  },
  {
    key: "finance",
    label: "Finance",
    icon: <PaidIcon />,
    Component: AdminFinance,
  },
  {
    key: "users",
    label: "Users",
    icon: <GroupsIcon />,
    Component: AdminUsers,
  },
  {
    key: "operations",
    label: "Operations",
    icon: <FactCheckIcon />,
    Component: AdminOperationsHub,
  },
  {
    key: "drinks",
    label: "Drinks",
    icon: <LocalBarIcon />,
    Component: AdminDrinksHub,
  },
  {
    key: "categories",
    label: "Catalog Setup",
    icon: <CategoryIcon />,
    Component: AdminCategories,
  },
  {
    key: "how-to",
    label: "How To",
    icon: <HelpIcon />,
    Component: HowToGuide,
    componentProps: { audience: "admin" },
  },
];

const LEGACY_TAB_REDIRECTS = {
  analytics: "drinks",
  "create-drink": "drinks",
  bartenders: "users",
  customers: "users",
  licenses: "users",
  team: "users",
  reported: "operations",
  courses: "operations",
  "operations-center": "operations",
};

const adminTabsSx = (isSmDown) => ({
  borderRight: isSmDown ? 0 : 1,
  borderBottom: isSmDown ? 1 : 0,
  borderColor: "divider",
  minWidth: isSmDown ? "auto" : 200,
  "& .MuiTab-root": {
    justifyContent: isSmDown ? "center" : "flex-start",
    alignItems: "center",
    minHeight: 56,
    px: isSmDown ? 1 : 2,
    textTransform: "none",
    color: "text.secondary",
  },
  "& .MuiTab-root.Mui-selected": {
    color: "var(--primary-color) !important",
    fontWeight: 700,
    borderRight: isSmDown ? 0 : "3px solid var(--primary-color)",
    borderBottom: isSmDown ? "3px solid var(--primary-color)" : 0,
    backgroundColor: "rgba(128, 0, 32, 0.06)",
  },
  "& .MuiTabs-indicator": {
    display: "none",
  },
});

const AdminSettingsScreen = () => {
  const dispatch = useDispatch();
  const theme = useTheme();
  const isSmDown = useMediaQuery(theme.breakpoints.down("sm"));
  const location = useLocation();
  const navigate = useNavigate();
  const allEvents = useSelector(selectAllEvents);
  const [showContent, setShowContent] = useState(false);

  const keyFromPath = useMemo(() => {
    const parts = location.pathname.split("/").filter(Boolean);
    const sub = parts[1];
    if (!sub) return "overview";
    if (LEGACY_TAB_REDIRECTS[sub]) return LEGACY_TAB_REDIRECTS[sub];
    return ADMIN_TABS.some((tab) => tab.key === sub) ? sub : "events";
  }, [location.pathname]);

  const selectedIndex = Math.max(
    0,
    ADMIN_TABS.findIndex((tab) => tab.key === keyFromPath)
  );

  useEffect(() => {
    const timer = setTimeout(() => setShowContent(true), 900);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    dispatch(fetchAllEvents());
  }, [dispatch]);

  const newEventsCount = useMemo(
    () =>
      (allEvents || []).filter((event) =>
        ["submitted", "pending", "awaiting_response"].includes(event?.status)
      ).length,
    [allEvents]
  );

  const goTo = (key) => {
    localStorage.setItem("admin:lastTabKey", key);
    navigate(key === "overview" ? "/admin" : `/admin/${key}`);
  };

  return (
    <PublicLayout>
      {!showContent ? (
        <LoadingSkeleton />
      ) : (
        <Box
          sx={{
            px: { xs: 1, md: 4 },
            py: { xs: 2, md: 3 },
            display: "flex",
            flexDirection: { xs: "column", sm: "row" },
            width: "100%",
            overflowX: "hidden",
          }}
        >
          <HelmetHeader title="Tipsyverse | Admin Panel" description="" />

          <Tabs
            orientation={isSmDown ? "horizontal" : "vertical"}
            value={selectedIndex}
            onChange={(event, newIndex) => goTo(ADMIN_TABS[newIndex].key)}
            variant={isSmDown ? "scrollable" : "standard"}
            scrollButtons
            allowScrollButtonsMobile
            sx={adminTabsSx(isSmDown)}
          >
            {ADMIN_TABS.map((tab) => (
              <Tooltip key={tab.key} title={isSmDown ? tab.label : ""} arrow>
                <Tab
                  icon={tab.icon}
                  iconPosition={isSmDown ? "top" : "start"}
                  label={
                    !isSmDown ? (
                      tab.key === "events" && newEventsCount > 0 ? (
                        <Badge  badgeContent={newEventsCount} sx={{ "& .MuiBadge-badge": { right: -10, top: 0, backgroundColor:'var(--primary-color)', color: 'white' } }}>
                          <Box component="span">{tab.label}</Box>
                        </Badge>
                      ) : (
                        tab.label
                      )
                    ) : (
                      ""
                    )
                  }
                  sx={{
                    fontFamily: "Poppins, sans-serif",
                    transition: "background-color 0.3s ease",
                    "&:hover": { backgroundColor: "rgba(0, 0, 0, 0.08)" },
                  }}
                />
              </Tooltip>
            ))}
          </Tabs>

          <Box
            sx={{
              flexGrow: 1,
              minWidth: 0,
              width: { xs: "100%", sm: "calc(100% - 200px)" },
              pl: { sm: 4 },
              pt: { xs: 3, sm: 0 },
            }}
          >
            {ADMIN_TABS.map((tab, index) => (
              <TabPanel key={tab.key} value={selectedIndex} index={index}>
                <tab.Component {...tab.componentProps} />
              </TabPanel>
            ))}
          </Box>
        </Box>
      )}
    </PublicLayout>
  );
};

export default AdminSettingsScreen;
