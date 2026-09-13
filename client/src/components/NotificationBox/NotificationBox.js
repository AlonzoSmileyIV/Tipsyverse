// Required dependencies
import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  addNotification,
  toggleMarkAllReadOrUnread,
} from "../../features/notifications/notificationSlice";
import socket from "../../services/socket";
import {
  Box,
  IconButton,
  Typography,
  Menu,
  MenuItem,
  Button,
  Paper,
} from "@mui/material";
import {
  Delete as DeleteIcon,
  MoreVert as MoreVertIcon,
  NotificationsOff as NotificationsOffIcon,
  MarkAsUnread as MarkAsUnreadIcon,
  Check as CheckIcon,
  NotificationsActive as NotificationsActiveIcon,
} from "@mui/icons-material";

import NotificationCard from "../NotificationCard/NotificationCard";
import { fetchNotificationsByUserId } from "../../features/notifications/notificationSlice";
import { toggleReadStatus } from "../../features/notifications/notificationSlice";
import { useNavigate } from "react-router-dom";
import { navigateOrReload } from "../../utils/navigateOrReload";
import api from "../../services/api";
import { handleUpdateUser } from "../../utils/handleUpdateUser";
import getNotificationPath from "../../utils/getNotificationPath";

const NotificationBox = ({ onClose }) => {
  const [anchorEl, setAnchorEl] = useState(null);
  const [filter, setFilter] = useState("All");
  const dispatch = useDispatch();
  const { notifications } = useSelector((state) => state.notifications);
  const user = useSelector((state) => state.users.loggedInUser?.user);

  const handleMenuOpen = (event) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
  };
  const handleMenuClose = () => setAnchorEl(null);

  const navigate = useNavigate();

  const handleMarkReadToggle = async (notification) => {
    try {
      const loggedInRecipient = notification.recipients?.find(
        (r) => r.recipient === user._id || r.recipient?._id === user._id
      );
      const newReadStatus = !loggedInRecipient?.read;

      dispatch(
        toggleReadStatus({
          notificationId: notification._id,
          read: newReadStatus,
        })
      );

      socket.emit("notifications:updateReadStatus", {
        notificationId: notification._id,
        userId: user._id,
        read: newReadStatus,
      });
    } catch (error) {
      console.error("❌ Failed to toggle read status:", error);
    }
  };

  const handleDeleteNotification = async (notification) => {
    try {
      await api.delete(`/notifications/${notification._id}`);
      dispatch(fetchNotificationsByUserId());
    } catch (error) {
      console.error("❌ Failed to delete notification:", error);
    }
  };

  const handleMarkAllToggle = async () => {
    const unreadCount = notifications.filter(
      (n) =>
        Array.isArray(n.recipients) &&
        n.recipients.some((r) => !r.read && r.recipient?._id === user._id)
    ).length;

    const shouldMarkAsRead = unreadCount > 0;

    if (shouldMarkAsRead) {
      dispatch(toggleMarkAllReadOrUnread(true));
    } else {
      dispatch(toggleMarkAllReadOrUnread(false));
    }

    // Emit socket event for syncing across devices
    socket.emit("notifications:updateAllReadStatus", {
      read: shouldMarkAsRead,
    });
  };

  const handleAllMuteToggle = async () => {
    try {
      const current = user?.preferences?.notifications?.onMute;

      const updatedNotifications = {
        ...user.preferences.notifications,
        onMute: !current,
      };

      // Ensure allergies is always an array of strings or an empty array
      const updatedAllergies = Array.isArray(user.preferences.allergies)
        ? user.preferences.allergies
        : [];

      await api.put(`/users/update-preferences`, {
        allergies: updatedAllergies,
        notifications: updatedNotifications,
      });

      await handleUpdateUser(dispatch);
    } catch (error) {
      console.error("❌ Failed to update notification mute status:", error);
    }
  };

  const handleAllNotifications = async () => {
    try {
      await api.delete(`/notifications`);
      dispatch(fetchNotificationsByUserId());
      handleMenuClose();
    } catch (err) {
      console.error("❌ Failed to delete all notifications:", err);
    }
  };

  const handleNavigation = (slugFromNotification, type, notification) => {
    if (
      !notification.recipients?.some(
        (r) => r.read && r.recipient?._id === user._id
      )
    ) {
      dispatch(
        toggleReadStatus({ notificationId: notification._id, read: true })
      );
    }
    const path = getNotificationPath({
      ...notification,
      slug: notification?.slug || slugFromNotification,
      type: notification?.type || type,
    });

    if (!path) {
      console.warn("❌ Notification destination is missing.");
      return;
    }

    navigateOrReload(navigate, path);
  };

  const filtered = notifications.filter((n) => {
    if (!Array.isArray(n.recipients)) return false;
    return filter === "All" || !n.recipients[0]?.read;
  });

  const sortedSections = {
    Newest: [],
    Today: [],
    Yesterday: [],
    Earlier: [],
  };

  filtered.forEach((n) => {
    const hoursAgo =
      (Date.now() - new Date(n.timestamp).getTime()) / (1000 * 60 * 60);
    const date = new Date(n.timestamp);
    const now = new Date();

    if (hoursAgo < 6) sortedSections.Newest.push(n);
    else if (date.toDateString() === now.toDateString())
      sortedSections.Today.push(n);
    else if (
      date.toDateString() ===
      new Date(now.setDate(now.getDate() - 1)).toDateString()
    )
      sortedSections.Yesterday.push(n);
    else sortedSections.Earlier.push(n);
  });

  // Sort each section by descending timestamp
  Object.keys(sortedSections).forEach((section) => {
    sortedSections[section].sort(
      (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
    );
  });

  useEffect(() => {
    if (user?._id) {
      dispatch(fetchNotificationsByUserId());
    }
  }, [user?._id, dispatch]);

  useEffect(() => {
    if (!user?._id) return;

    const handleNewNotification = (notification) => {
      if (
        notification?.recipients?.some(
          (r) => r.recipient === user._id || r.recipient?._id === user._id
        )
      ) {
        dispatch(addNotification(notification));
      }
    };

    socket.on("notifications:new", handleNewNotification); // ✅ ADD THIS

    return () => {
      socket.off("notifications:new", handleNewNotification);
    };
  }, [user?._id, dispatch]);

  return (
    <Paper
      sx={{
        position: "absolute",
        top: 60,
        right: 16,
        width: 360,
        maxHeight: 500,
        overflowY: "auto",
        p: 2,
        borderRadius: 2,
        boxShadow: 4,
        zIndex: 10,
      }}
    >
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        mb={1}
      >
        <Typography variant="h6">Notifications</Typography>
        <IconButton onClick={handleMenuOpen}>
          <MoreVertIcon />
        </IconButton>
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleMenuClose}
        >
          {notifications.length > 0 && (
            <MenuItem
              onClick={() => {
                handleMarkAllToggle();
              }}
            >
              {notifications.some(
                (n) =>
                  Array.isArray(n.recipients) &&
                  n.recipients.some(
                    (r) => !r.read && r.recipient?._id === user._id
                  )
              ) ? (
                <CheckIcon sx={{ mr: 1 }} />
              ) : (
                <MarkAsUnreadIcon sx={{ mr: 1 }} />
              )}
              {notifications.some(
                (n) =>
                  Array.isArray(n.recipients) &&
                  n.recipients.some(
                    (r) => !r.read && r.recipient?._id === user._id
                  )
              )
                ? "Mark All as Read"
                : "Mark All as Unread"}
            </MenuItem>
          )}
          <MenuItem
            onClick={async () => {
              await handleAllMuteToggle();
            }}
          >
            {user?.preferences?.notifications?.onMute ? (
              <NotificationsActiveIcon sx={{ mr: 1 }} />
            ) : (
              <NotificationsOffIcon sx={{ mr: 1 }} />
            )}
            {user?.preferences?.notifications?.onMute ? "Unmute" : "Mute"}{" "}
            Notifcations
          </MenuItem>
          {notifications.length > 0 && (
            <MenuItem onClick={handleAllNotifications}>
              <DeleteIcon sx={{ mr: 1 }} /> Delete All Notifications
            </MenuItem>
          )}
        </Menu>
      </Box>

      <Box display="flex" gap={1} mb={2}>
        <Button
          variant={filter === "All" ? "contained" : "outlined"}
          size="small"
          onClick={() => setFilter("All")}
          sx={
            filter === "All"
              ? { backgroundColor: "var(--primary-color)" }
              : {
                  color: "var(--primary-color)",
                  borderColor: "var(--primary-color)",
                }
          }
        >
          All
        </Button>
        <Button
          variant={filter === "Unread" ? "contained" : "outlined"}
          size="small"
          onClick={() => setFilter("Unread")}
          sx={
            filter === "Unread"
              ? { backgroundColor: "var(--primary-color)" }
              : {
                  color: "var(--primary-color)",
                  borderColor: "var(--primary-color)",
                }
          }
        >
          Unread
        </Button>
      </Box>

      {Object.entries(sortedSections).map(
        ([section, items]) =>
          items.length > 0 && (
            <Box key={section} mb={2}>
              <Typography variant="subtitle2" gutterBottom>
                {section}
              </Typography>
              {items.map((n) =>
                n.entity ? (
                  <NotificationCard
                    key={n._id}
                    notification={n}
                    onClick={() => handleNavigation(n.entity?._id, n.type, n)}
                    onMarkReadToggle={handleMarkReadToggle}
                    onDelete={handleDeleteNotification}
                    // onDelete={}
                  />
                ) : null
              )}
            </Box>
          )
      )}

      {Object.values(sortedSections).every((list) => list.length === 0) && (
        <Box textAlign="center" mt={4}>
          {filter === "Unread" ? (
            <Typography variant="body2" color="text.secondary" mb={2}>
              🎉 You read all of your messages!
            </Typography>
          ) : (
            <Typography variant="body2" color="text.secondary" mb={2}>
              🎉 No new notifications for you!
            </Typography>
          )}
          <Button
            variant="outlined"
            size="small"
            onClick={() => window.location.reload()}
          >
            Refresh
          </Button>
        </Box>
      )}
    </Paper>
  );
};

export default NotificationBox;
