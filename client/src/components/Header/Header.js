// Header.jsx
import { useEffect, useState } from "react";
import {
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Tabs,
  Tab,
  Avatar,
  Button,
  Menu,
  MenuItem,
  Box,
  useMediaQuery,
  Divider,
} from "@mui/material";
import Badge from "@mui/material/Badge";
import { styled, useTheme } from "@mui/material/styles";
import {
  Notifications,
  Menu as MenuIcon,
  ArrowDropDown,
  AccountCircle,
  Logout,
  AdminPanelSettings,
  HomeOutlined,
  LocalBarOutlined,
  FavoriteBorderOutlined,
  CalendarMonthOutlined,
} from "@mui/icons-material";
import { useDispatch, useSelector } from "react-redux";
import { Link, useLocation } from "react-router-dom";
import NotificationBox from "../NotificationBox/NotificationBox";
import { fetchNotificationsByUserId } from "../../features/notifications/notificationSlice";
import { useLogout } from "../../utils/handleLogoutAsync";
import logoImg from "../../assets/images/logo.png";
import api from "../../services/api";

const StyledBadge = styled(Badge)(({ theme }) => ({
  "& .MuiBadge-badge": {
    right: -3,
    top: 13,
    border: `2px solid ${(theme.vars ?? theme).palette.background.paper}`,
    padding: "0 4px",
    backgroundColor: "var(--primary-color)",
  },
}));

const hasBartendAccessSignal = (session, currentUser) => {
  if (currentUser?.role === "admin") return false;
  return (
    ["employee", "bartender"].includes(currentUser?.role) ||
    !!currentUser?.bartenderProfile ||
    !!session?.bartenderInfo ||
    ["applicant", "approved", "active"].includes(currentUser?.bartenderStatus)
  );
};

const Header = () => {
  const dispatch = useDispatch();
  const logout = useLogout();

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const location = useLocation();
  const pathname = location.pathname;

  const loggedInUser = useSelector((state) => state.users.loggedInUser);
  const user = loggedInUser?.user;
  const [showBartendLink, setShowBartendLink] = useState(false);
  const [showEventsLink, setShowEventsLink] = useState(false);
  //console.log(user);
  // highlight Home/Drinks as tabs (CTA buttons are not tabs)
  const tabValue =
    pathname === "/" || pathname === "/home"
      ? "home"
      : pathname.startsWith("/drinks")
      ? "drinks"
      : pathname.startsWith("/settings/activity")
      ? "activity"
      : pathname.startsWith("/bartend") && showBartendLink
      ? "bartend"
      : (pathname.startsWith("/my-events") || pathname.startsWith("/events")) && showEventsLink
      ? "events"
      : false;

  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);
  const handleMenuOpen = (event) => setAnchorEl(event.currentTarget);
  const handleMenuClose = () => setAnchorEl(null);

  const [showNotificationBox, setShowNotificationBox] = useState(false);
  const [userMenuAnchor, setUserMenuAnchor] = useState(null);
  const notifications =
    useSelector((state) => state.notifications.notifications) || [];

  const unreadCount =
    notifications?.filter((n) =>
      n.recipients?.some((r) => {
        const recipientId =
          typeof r.recipient === "string" ? r.recipient : r.recipient?._id;
        return !r.read && recipientId === user?._id;
      })
    )?.length || 0;

  const handleUserClick = (event) => {
    setUserMenuAnchor(event.currentTarget);
    setShowNotificationBox(false);
  };

  const handleUserMenuClose = () => setUserMenuAnchor(null);

  const handleLogout = () => {
    setUserMenuAnchor(null);
    logout();
  };

  useEffect(() => {
    if (loggedInUser?.accessToken) {
      dispatch(fetchNotificationsByUserId());
    }
  }, [dispatch, loggedInUser?.accessToken]);

  useEffect(() => {
    let cancelled = false;

    const checkMyEvents = async () => {
      if (!loggedInUser?.accessToken || !user?.email) {
        setShowEventsLink(false);
        return;
      }

      try {
        const res = await api.get("/events/mine", { params: { limit: 1 } });
        const rows = res.data?.data || [];
        const total = Number(res.data?.total);
        if (!cancelled) {
          setShowEventsLink(total > 0 || rows.length > 0);
        }
      } catch {
        if (!cancelled) setShowEventsLink(false);
      }
    };

    checkMyEvents();

    return () => {
      cancelled = true;
    };
  }, [loggedInUser?.accessToken, user?.email]);

  useEffect(() => {
    let cancelled = false;

    const checkBartendAccess = async () => {
      if (!loggedInUser?.accessToken || !user?._id) {
        setShowBartendLink(false);
        return;
      }

      if (hasBartendAccessSignal(loggedInUser, user)) {
        setShowBartendLink(true);
        return;
      }

      try {
        const res = await api.get("/course-progresses/my");
        const progress = res.data?.data || [];
        const hasStartedCourse = progress.some(
          (item) => item?.startedAt || ["in_progress", "completed"].includes(item?.status)
        );
        if (!cancelled) setShowBartendLink(hasStartedCourse);
      } catch {
        if (!cancelled) setShowBartendLink(false);
      }
    };

    checkBartendAccess();

    return () => {
      cancelled = true;
    };
  }, [
    loggedInUser,
    loggedInUser?.accessToken,
    user,
    user?._id,
    user?.role,
    user?.bartenderProfile,
    user?.bartenderStatus,
  ]);

  useEffect(() => {
    setShowNotificationBox(false);
  }, [location.pathname]);


  return (
    <>
    <AppBar
      component="header"
      position="sticky"
      sx={{
        backgroundColor: "var(--background-color)",
        color: "var(--text-color)",
      }}
    >
      <Toolbar
        sx={{ justifyContent: "space-between", flexWrap: "wrap", gap: 2 }}
      >
        {/* Logo */}
        <Typography
          variant="h6"
          component={Link}
          to="/"
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            textDecoration: "none",
            fontFamily: "Poppins, sans-serif",
            color: "var(--primary-color)",
            flexGrow: 1,
            fontWeight: "bold",
            fontSize: "1.5rem",
          }}
        >
          <Box
            component="img"
            src={logoImg}
            alt="Tipsyverse Logo"
            sx={{ height: 40, width: 40, objectFit: "contain" }}
          />
          <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>
            Tipsyverse
          </Box>
        </Typography>

        {/* Tabs + CTAs (desktop) */}
        {!isMobile ? (
          <Box
            component="nav"
            aria-label="Primary navigation"
            sx={{ display: "flex", alignItems: "center", gap: 2, mx: "auto" }}
          >
            <Tabs
              value={tabValue}
              textColor="inherit"
              TabIndicatorProps={{
                sx: { backgroundColor: "var(--primary-color)" },
              }}
              sx={{ mr: 1 }}
            >
              <Tab
                value="home"
                icon={<HomeOutlined fontSize="small" />}
                iconPosition="start"
                label="Home"
                component={Link}
                to="/"
                sx={{ textTransform: "none", minHeight: 48 }}
              />

              <Tab
                value="drinks"
                icon={<LocalBarOutlined fontSize="small" />}
                iconPosition="start"
                label="Drinks"
                component={Link}
                to="/drinks"
                sx={{ textTransform: "none", minHeight: 48 }}
              />

              {user && (
                <Tab
                  value="activity"
                  icon={<FavoriteBorderOutlined fontSize="small" />}
                  iconPosition="start"
                  label="Activity"
                  component={Link}
                  to="/settings/activity"
                  sx={{ textTransform: "none", minHeight: 48 }}
                />
              )}
              {showBartendLink && (
                <Tab
                  value="bartend"
                  icon={<LocalBarOutlined fontSize="small" />}
                  iconPosition="start"
                  label="Bartend"
                  component={Link}
                  to="/bartend"
                  sx={{ textTransform: "none", minHeight: 48 }}
                />
              )}
              {/* UNCOMMENT WHEN READY FOR NEXT FEATURES */}
              {showEventsLink && (
                <Tab
                  value="events"
                   icon={<CalendarMonthOutlined fontSize="small" />}
                  iconPosition="start"
                  label="Events"
                  component={Link}
                  to="/my-events"
                  sx={{ textTransform: "none", minHeight: 48 }}
                />
              )}
            </Tabs>

            {/* <Button
              component={Link}
              to="/bartend"
              variant="contained"
              sx={{
                backgroundColor: "var(--primary-color)",
                fontFamily: "Poppins, sans-serif",
                textTransform: "none",
                color: 'white'
              }}
            >
              Bartend in Indy
            </Button> */}
          </Box>
        ) : (
          /* Mobile menu */
          <Box component="nav" aria-label="Primary navigation">
            <IconButton
              onClick={handleMenuOpen}
              color="inherit"
              aria-label="open navigation menu"
              aria-haspopup="menu"
              aria-expanded={open}
            >
              <MenuIcon />
            </IconButton>
            <Menu anchorEl={anchorEl} open={open} onClose={handleMenuClose}>
              <MenuItem
                component={Link}
                to="/"
                onClick={handleMenuClose}
                selected={pathname === "/"}
                sx={{
                  textDecoration: pathname === "/" ? "underline" : "none",
                  textUnderlineOffset: "4px",
                  textDecorationColor: "var(--primary-color)",
                  fontWeight: pathname === "/" ? 600 : 400,
                }}
              >
                <HomeOutlined sx={{ mr: 1 }} fontSize="small" />
                Home
              </MenuItem>

              <MenuItem
                component={Link}
                to="/drinks"
                onClick={handleMenuClose}
                selected={pathname === "/drinks"}
                sx={{
                  textDecoration: pathname === "/drinks" ? "underline" : "none",
                  textUnderlineOffset: "4px",
                  textDecorationColor: "var(--primary-color)",
                  fontWeight: pathname === "/drinks" ? 600 : 400,
                }}
              >
                <LocalBarOutlined sx={{ mr: 1 }} fontSize="small" />
                Drinks
              </MenuItem>

              {user && (
                <MenuItem
                  component={Link}
                  to="/settings/activity"
                  onClick={handleMenuClose}
                  selected={pathname === "/settings/activity"}
                  sx={{
                    textDecoration:
                      pathname === "/settings/activity" ? "underline" : "none",
                    textUnderlineOffset: "4px",
                    textDecorationColor: "var(--primary-color)",
                    fontWeight: pathname === "/settings/activity" ? 600 : 400,
                  }}
                >
                  <FavoriteBorderOutlined sx={{ mr: 1 }} fontSize="small" />
                  Activity
                </MenuItem>
              )}
              
              {showEventsLink && <Divider sx={{ my: 0.5 }} />}
              {showEventsLink && (
                <MenuItem
                  component={Link}
                  to="/my-events"
                  onClick={handleMenuClose}
                  selected={pathname.startsWith("/my-events") || pathname.startsWith("/events")}
                  sx={{
                    textDecoration: pathname.startsWith("/my-events") || pathname.startsWith("/events")
                      ? "underline"
                      : "none",
                    textUnderlineOffset: "4px",
                    textDecorationColor: "var(--primary-color)",
                    fontWeight: pathname.startsWith("/my-events") || pathname.startsWith("/events") ? 600 : 400,
                  }}
                >
                  <CalendarMonthOutlined sx={{ mr: 1 }} fontSize="small" />
                  Events
                </MenuItem>
              )}
              {showBartendLink && (
                <MenuItem
                  component={Link}
                  to="/bartend"
                  onClick={handleMenuClose}
                  selected={pathname.startsWith("/bartend")}
                  sx={{
                    textDecoration: pathname.startsWith("/bartend") ? "underline" : "none",
                    textUnderlineOffset: "4px",
                    textDecorationColor: "var(--primary-color)",
                    fontWeight: pathname.startsWith("/bartend") ? 600 : 400,
                  }}
                >
                  <LocalBarOutlined sx={{ mr: 1 }} fontSize="small" />
                  Bartend
                </MenuItem>
              )}
            </Menu>
          </Box>
        )}

        {/* Notifications + Auth */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          {user && (
            <>
              <IconButton
                color="inherit"
                onClick={() => {
                  setShowNotificationBox((prev) => !prev);
                  setUserMenuAnchor(null);
                }}
                aria-label={`Notifications, ${unreadCount} unread`}
              >
                <StyledBadge
                  showZero={false}
                  badgeContent={unreadCount}
                  color="secondary"
                >
                  <Notifications />
                </StyledBadge>
              </IconButton>
              {showNotificationBox && (
                <NotificationBox
                  notifications={notifications}
                  onClose={() => setShowNotificationBox(false)}
                />
              )}
            </>
          )}

          {user ? (
            <Box
              component="button"
              type="button"
              aria-label="Open account menu"
              aria-haspopup="menu"
              aria-expanded={Boolean(userMenuAnchor)}
              onClick={handleUserClick}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                cursor: "pointer",
                border: 0,
                color: "inherit",
                font: "inherit",
                backgroundColor: "transparent",
                px: 1.5,
                py: 1,
                borderRadius: 2,
                transition: "background-color 0.3s ease",
                "&:hover": { backgroundColor: "rgba(0, 0, 0, 0.08)" },
              }}
            >
              <Typography>
                Hi,{" "}
                {user?.fullName?.split?.(" ")[0]?.length > 20
                  ? user.fullName.split(" ")[0].substring(0, 20) + "..."
                  : user?.fullName?.split(" ")[0] || "User"}
              </Typography>
              <Avatar
                alt={user?.fullName || "User"}
                src={user?.profile?.photo}
              />
              <ArrowDropDown />
            </Box>
          ) : (
            <Button
              component={Link}
              to="/login"
              variant="contained"
              color="primary"
              sx={{
                backgroundColor: "var(--primary-color)",
                fontFamily: "Poppins, sans-serif",
                textTransform: "none",
              }}
            >
              Login
            </Button>
          )}
          <Menu
            anchorEl={userMenuAnchor}
            open={Boolean(userMenuAnchor)}
            onClose={handleUserMenuClose}
            anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
            transformOrigin={{ vertical: "top", horizontal: "right" }}
          >
            {["admin", "employee"].includes(user?.role) && (
              <MenuItem
                component={Link}
                to="/admin"
                onClick={handleUserMenuClose}
              >
                <AdminPanelSettings sx={{ mr: 1 }} /> Admin
              </MenuItem>
            )}
            <MenuItem
              component={Link}
              to="/settings"
              onClick={handleUserMenuClose}
            >
              <AccountCircle sx={{ mr: 1 }} /> Profile Settings
            </MenuItem>
            <MenuItem onClick={handleLogout}>
              <Logout sx={{ mr: 1 }} /> Logout
            </MenuItem>
          </Menu>
        </Box>
      </Toolbar>
    </AppBar>
    </>
  );
};

export default Header;
