import {
  Box,
  Typography,
  Avatar,
  Paper,
  IconButton,
  Menu,
  MenuItem,
} from "@mui/material";
import {
  MoreVert as MoreVertIcon,
  Delete as DeleteIcon,
  Drafts as DraftsIcon,
  Markunread as MarkunreadIcon,
} from "@mui/icons-material";
import { useState } from "react";
import { useSelector } from "react-redux";

function timeAgo(date) {
  const seconds = Math.floor((Date.now() - new Date(date)) / 1000);

  const intervals = [
    { label: "y", seconds: 31536000 },
    { label: "mo", seconds: 2592000 },
    { label: "w", seconds: 604800 },
    { label: "d", seconds: 86400 },
    { label: "h", seconds: 3600 },
    { label: "m", seconds: 60 },
    { label: "s", seconds: 1 },
  ];

  for (const i of intervals) {
    const value = Math.floor(seconds / i.seconds);
    if (value >= 1) return `${value}${i.label} ago`;
  }

  return "just now";
}


const NotificationCard = ({
  notification,
  onClick,
  onMarkReadToggle,
  onDelete,
}) => {
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);
  const actors = notification.actors;
  const renderMessage = (msg = "") => {
  const out = [];
  let last = 0;
  const mentionRe = /@([a-z0-9](?:[a-z0-9._-]{0,28}[a-z0-9])?)/gi;

  for (const m of msg.matchAll(mentionRe)) {
    const start = m.index;
    const full = m[0]; // "@joshua.smiley"

    if (start > last) out.push(msg.slice(last, start));

    out.push(
      <span
        key={start}
        style={{ fontWeight: 700 /* or 600 */, color: "inherit" }}
      >
        {full}
      </span>
    );

    last = start + full.length;
  }
  if (last < msg.length) out.push(msg.slice(last));
  return out;
};
  const loggedInUserId = useSelector(
    (state) => state.users.loggedInUser?.user?._id
  );
  const isUnread = notification.recipients?.some(
    (r) =>
      (r.recipient === loggedInUserId || r.recipient?._id === loggedInUserId) &&
      !r.read
  );
  const actorAvatars = actors?.slice(0, 2).map((a, i) => (
    <Avatar
      key={i}
      src={a.actor?.profile?.photo}
      alt={a.actor?.fullName}
      sx={{
        width: 32,
        height: 32,
        position: "absolute",
        left: i * 16,
        zIndex: actors.length - i,
        border: "2px solid white",
      }}
    />
  ));
  const truncate = (str, n = 80) => {
  if (!str) return "";
  return str.length > n ? str.slice(0, n).trim() + "…" : str;
};

let messageText = notification.message;

// If you know notifications about comments always append `: "comment text"`
if (notification.comment?.content) {
  const preview = truncate(notification.comment.content, 80);
  // Example: `@joshua.smiley and 2 others liked your comment: "This was nice…"`
  messageText = `${notification.message.split(':')[0]}: "${preview}"`;
}

  const handleMenuOpen = (event) => {
    event.stopPropagation(); // ✅ Prevent propagation just in case
    setAnchorEl(event.currentTarget);
  };
  const handleMenuClose = () => setAnchorEl(null);

  return (
    <Paper
      onClick={onClick}
      sx={{
        backgroundColor: isUnread ? "#ffebee" : "white",
        p: 1.5,
        mb: 1,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: 5,
        borderRadius: 2,
      }}
    >
      <Box sx={{ position: "relative", width: 70, height: 32 }}>
        {actorAvatars}
      </Box>

      <Box>
        <Typography variant="body2">{renderMessage(messageText)}</Typography>
        <Typography variant="caption" color="text.secondary">
            {timeAgo(notification.timestamp)}
        </Typography>
      </Box>

      <Box>
        <IconButton
          onClick={(e) => {
            e.stopPropagation(); // ✅ Prevent triggering card onClick
            handleMenuOpen(e);
          }}
        >
          <MoreVertIcon />
        </IconButton>
        <Menu
          anchorEl={anchorEl}
          open={open}
          onClose={handleMenuClose}
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
          transformOrigin={{ vertical: "top", horizontal: "right" }}
        >
          <MenuItem
            onClick={() => {
              onMarkReadToggle?.(notification);
              handleMenuClose();
            }}
          >
            {isUnread ? (
              <>
                <DraftsIcon fontSize="small" sx={{ mr: 1 }} />
                Mark as Read
              </>
            ) : (
              <>
                <MarkunreadIcon fontSize="small" sx={{ mr: 1 }} />
                Mark as Unread
              </>
            )}
          </MenuItem>
          <MenuItem
            onClick={() => {
              onDelete?.(notification);
              handleMenuClose();
            }}
          >
            <DeleteIcon fontSize="small" sx={{ mr: 1 }} />
            Delete Notification
          </MenuItem>
          {/* <MenuItem
            onClick={() => {
              onReport?.(notification);
              handleMenuClose();
            }}
          >
            <FlagIcon fontSize="small" sx={{ mr: 1 }} />
            Report Notification
          </MenuItem> */}
        </Menu>
      </Box>
    </Paper>
  );
};

export default NotificationCard;
