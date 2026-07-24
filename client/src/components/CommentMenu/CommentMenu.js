// components/Comments/CommentMenu.js
import React, { useState } from "react";
import { IconButton, Menu, MenuItem } from "@mui/material";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import { Delete, Edit, Flag } from "@mui/icons-material";

const CommentMenu = ({
  onReport,
  onEdit,
  onDelete,
  loggedInUserId,
  commentAuthorId,
}) => {
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);
  const isCommentOwner = loggedInUserId === commentAuthorId;

  return (
    <>
      <IconButton onClick={(e) => setAnchorEl(e.currentTarget)}>
        <MoreVertIcon />
      </IconButton>
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: "top", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        {isCommentOwner ? (
         [
      <MenuItem key="edit" onClick={() => { setAnchorEl(null); onEdit(); }}>
        <Edit sx={{ mr: 2 }} /> Edit Comment
      </MenuItem>,
      <MenuItem key="delete" onClick={() => { setAnchorEl(null); onDelete(); }}>
        <Delete sx={{ mr: 2 }} /> Delete Comment
      </MenuItem>,
    ]
        ) : (
          <MenuItem
            onClick={() => {
              setAnchorEl(null);
              onReport();
            }}
          >
            <Flag sx={{ mr: 2 }} /> Report Comment
          </MenuItem>
        )}
      </Menu>
    </>
  );
};

export default CommentMenu;
