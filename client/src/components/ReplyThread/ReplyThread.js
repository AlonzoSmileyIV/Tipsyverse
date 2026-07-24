// components/Comments/ReplyThread.js
import React, { useRef, useEffect, useState } from "react";
import {
  Box,
  Typography,
  Avatar,
  Collapse,
  Button,
  ButtonBase,
} from "@mui/material";
import { FavoriteBorder, Reply } from "@mui/icons-material";
import { formatDistanceToNow } from "date-fns";
import CommentMenu from "../CommentMenu/CommentMenu";
import CommentInput from "../CommentInput/CommentInput";
import { useSelector } from "react-redux";
import { abbreviateNumber } from "../../utils/abbreviateNumber";

const ReplyThread = ({
  replies = [],
  parentId,
  expandedMap = {},
  renderCommentText,
  likedReplies,
  handleToggleLike,
  onUpdateReply,
  setReplyTo,
  replyTo,
  replyText,
  setReplyText,
  handleAddReply,
  handleEditReply,
  handleDeleteReply,
  handleOpenReportModal,
  mentionUserData,
  depth = 1,
}) => {
  const loggedInUser = useSelector((state) => state.users.loggedInUser);
  const [expanded, setExpanded] = useState(false);

  const replyInputRef = useRef(null);
  const newReplyRef = useRef(null);
  const prevReplyCountRef = useRef(replies.length);

  const visibleReplies = expanded ? replies : [];
  const hiddenCount = replies.length - visibleReplies.length;

  const [editingReplyId, setEditingReplyId] = useState(null);
  //const [editingReplyText, setEditingReplyText] = useState("");

  const handleToggleReplies = () => {
    setExpanded((prev) => !prev);
  };

  useEffect(() => {
    if (replyInputRef.current && replyTo === parentId) {
      replyInputRef.current.focus();
    }
    const replyCountIncreased = replies.length > prevReplyCountRef.current;
    if (replyCountIncreased && newReplyRef.current) {
      newReplyRef.current.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
    prevReplyCountRef.current = replies.length;
  }, [replyTo, replies, parentId]);

  useEffect(() => {
    if (expandedMap[parentId]) {
      setExpanded(true);
    }
  }, [expandedMap, parentId]);

  return (
    <Box>
      {replies.length > 0 && (
        <Box sx={{ pl: depth <= 2 ? depth * 2 : 0, mt: 1 }}>
          <Button size="small" onClick={handleToggleReplies}>
            {expanded
              ? "Hide replies"
              : `View ${hiddenCount} more repl${
                  hiddenCount === 1 ? "y" : "ies"
                }`}
          </Button>
        </Box>
      )}

      {visibleReplies.map((reply, index) => {
        const isLiked = likedReplies.includes(reply._id);

        return (
          <Collapse in={true} timeout="auto" key={reply._id}>
            <Box
              id={`comment-${reply._id}`} // ✅ For scroll targeting
              ref={index === replies.length - 1 ? newReplyRef : null}
              sx={{
                pl: depth <= 3 ? depth * 2 : 0, // limit indentation

                mt: 2,
                borderLeft: depth <= 3 ? "2px solid #ccc" : "none", // ✅ optional
                ml: 1,
                transition: "all 0.3s ease-in-out",
                backgroundColor:
                  depth <= 3
                    ? index === replies.length - 1
                      ? "rgba(0,0,0,0.03)"
                      : "inherit"
                    : "inherit", // ✅ no background box for depth > 2
                borderRadius: depth <= 2 ? 1 : 0, // ✅ flatten style
                pb: 1,
              }}
            >
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                  <Avatar src={reply.author?.profile?.photo} />
                  <Box>
                    <Typography variant="subtitle2">
                      {reply.author?.username}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {reply?.createdAt && !isNaN(new Date(reply.createdAt))
                        ? formatDistanceToNow(new Date(reply.createdAt), {
                            addSuffix: true,
                          })
                        : "just now"}
                    </Typography>
                  </Box>
                </Box>
                <CommentMenu
                  loggedInUserId={loggedInUser?.user?._id}
                  commentAuthorId={reply.author?._id}
                  onReport={() => handleOpenReportModal(reply)}
                  onEdit={() => {
                    setEditingReplyId(reply?._id);
                    //setEditingReplyText(reply?.content);
                  }}
                  onDelete={() => {
                    handleDeleteReply(reply?._id);
                  }}
                />
              </Box>

              {editingReplyId === reply?._id ? (
                <CommentInput
                  loggedInUserId={loggedInUser?.user?._id}
                  avatarUrl={
                    loggedInUser?.user?.profile?.photo || "/images/avatar.png"
                  }
                  mentionUserData={mentionUserData}
                  isEditing={true}
                  initialText={reply.content}
                  initialRawContent={reply.rawContent} // 👈 should come from your DB
                  initialMentions={reply.analytics?.usersMentioned || []}
                  onSubmit={({ text, mentions }) => {
                    handleEditReply({ reply, mentions, text });
                    setEditingReplyId(null); // optional: close the edit input after submission
                  }}
                  onCancel={() => {
                    setEditingReplyId(null);
                  }}
                  showActions
                />
              ) : (
                <Typography sx={{ mt: 1 }}>
                  {" "}
                  {renderCommentText(
                    reply?.content,
                    reply.analytics?.usersMentioned || []
                  )}
                </Typography>
              )}

              <Box
                sx={{ display: "flex", alignItems: "center", gap: 2, mt: 1 }}
              >
                <ButtonBase
                  onClick={() => handleToggleLike(parentId, reply?._id)}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 0.5,
                    px: 1.5,
                    py: 0.5,
                    borderRadius: 2,
                    border: `1px solid ${isLiked ? "inherit" : "#d3d3d3"}`,
                    backgroundColor: isLiked
                      ? "var(--primary-color) !important"
                      : "transparent",
                    "&:hover": {
                      backgroundColor: "rgba(0,0,0,0.04)",
                    },
                  }}
                >
                  <FavoriteBorder
                    sx={{
                      color: isLiked ? "white" : "inherit",
                      animation: isLiked ? "bounce 0.4s ease" : "none",
                    }}
                    fontSize="small"
                  />
                  <Typography variant="body2"
                                        sx={{ color: isLiked ? "white" : "inherit" }}
>
                    {`${
                      abbreviateNumber(reply.analytics?.counts?.likes) || 0
                    } like${reply.analytics?.counts?.likes === 1 ? "" : "s"}`}
                  </Typography>
                </ButtonBase>

                <ButtonBase
                  onClick={() => setReplyTo({ parentId, replyId: reply?._id })}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 0.5,
                    px: 1.5,
                    py: 0.5,
                    borderRadius: 2,
                    border: "1px solid #d3d3d3",
                    "&:hover": {
                      backgroundColor: "rgba(0,0,0,0.04)",
                    },
                  }}
                >
                  <Reply fontSize="small" />
                  <Typography variant="body2">Reply</Typography>
                </ButtonBase>
              </Box>

              <Collapse
                in={
                  reply?._id &&
                  replyTo?.replyId?.toString?.() === reply._id?.toString?.()
                }
                timeout="auto"
              >
                <Box sx={{ pt: 1 }}>
                  <CommentInput
                    loggedInUserId={loggedInUser?.user?._id}
                    avatarUrl={
                      loggedInUser?.user?.profile?.photo || "/images/avatar.png"
                    }
                    autoFocus
                    value={replyText}
                    onChange={setReplyText}
                    onSubmit={({ text, mentions }) => {
                      handleAddReply(reply?._id, text, mentions);
                      setReplyTo(null);
                      setReplyText("");
                    }}
                    onCancelEdit={() => {
                      setReplyTo(null);
                      setReplyText("");
                    }}
                    mentionUserData={mentionUserData}
                    showActions
                  />
                </Box>
              </Collapse>

              {reply?.analytics?.userReplies?.length > 0 && (
                <ReplyThread
                  replies={reply?.analytics?.userReplies}
                  parentId={reply?._id}
                  expandedMap={expandedMap}
                  renderCommentText={renderCommentText}
                  likedReplies={likedReplies}
                  handleToggleLike={handleToggleLike}
                  setReplyTo={setReplyTo}
                  replyTo={replyTo}
                  replyText={replyText}
                  setReplyText={setReplyText}
                  handleAddReply={handleAddReply}
                  handleEditReply={handleEditReply}
                  handleDeleteReply={handleDeleteReply}
                  handleOpenReportModal={handleOpenReportModal}
                  mentionUserData={mentionUserData}
                  depth={depth + 1}
                  onUpdateReply={onUpdateReply}
                />
              )}
            </Box>
          </Collapse>
        );
      })}
    </Box>
  );
};

export default ReplyThread;
