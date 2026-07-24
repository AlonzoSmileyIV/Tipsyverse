// components/Comments/CommentSection.js
import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Alert,
  Box,
  Typography,
  Avatar,
  Collapse,
  Tooltip,
  Fab,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Skeleton,
  Fade,
  ButtonBase,
} from "@mui/material";
import { FavoriteBorder, Reply, KeyboardArrowUp } from "@mui/icons-material";
import { formatDistanceToNow } from "date-fns";
import ReplyThread from "../ReplyThread/ReplyThread";
import CommentMenu from "../CommentMenu/CommentMenu";
import { abbreviateNumber } from "../../utils/abbreviateNumber";
import { buildNestedComments } from "../../utils/buildNestedComments";
import { countThreaded } from "../../utils/countThread";
import CommentInput from "../CommentInput/CommentInput";
import { useDispatch, useSelector } from "react-redux";
import { fetchAllUsers } from "../../features/users/userSlice";
import { fetchCommentsByDrink } from "../../features/comments/commentSlice";
import CommentSkeleton from "./CommentSectionSkeleton";
import api from "../../services/api";
import "./highlight.scss";
import ReportCommentModal from "../ReportCommentModal/ReportCommentModal";
import { fetchDrinkById } from "../../features/drinks/drinkSlice";

const CommentSection = ({ drinkId, scrollToCommentId, numberComments=0 }) => {
  const dispatch = useDispatch();
  const [alert, setAlert] = useState({
    type: "", // "success", "error", "info", "warning"
    message: "", // actual message text
  });
  const [comments, setComments] = useState([]);
  const [replyTo, setReplyTo] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [visibleCount, setVisibleCount] = useState(20);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const observerRef = useRef(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [likedComments, setLikedComments] = useState([]);
  const [likedReplies, setLikedReplies] = useState([]);
  const [sortOrder, setSortOrder] = useState("newest");
  const [loading, setLoading] = useState(true);
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportingComment, setReportingComment] = useState(null); // { id, content }
  const [reportData, setReportData] = useState(null); // { reason, dateReported }

  //const [editingText, setEditingText] = useState("");
  const replyInputRef = useRef(null);
  const { drinkComments } = useSelector((state) => state.comments);
  const loggedInUser = useSelector((state) => state.users.loggedInUser);
  const allUsers = useSelector((state) => state.users?.allUsers);
  const mentionUserData = useMemo(() => {
    const mockUserList = [
      {
        _id: "1",
        fullName: "Alonzo Smiley",
        profile: { photo: "https://randomuser.me/api/portraits/men/1.jpg" },
      },
      {
        _id: "2",
        fullName: "Jane Doe",
        profile: { photo: "https://randomuser.me/api/portraits/women/2.jpg" },
      },
      {
        _id: "3",
        fullName: "Mixologist Mike",
        profile: { photo: "https://randomuser.me/api/portraits/men/3.jpg" },
      },
      {
        _id: "4",
        fullName: "Sophia Rivera",
        profile: { photo: "https://randomuser.me/api/portraits/women/4.jpg" },
      },
      {
        _id: "5",
        fullName: "Ethan Brooks",
        profile: { photo: "https://randomuser.me/api/portraits/men/5.jpg" },
      },
      {
        _id: "6",
        fullName: "Liam Chen",
        profile: { photo: "https://randomuser.me/api/portraits/men/6.jpg" },
      },
    ];
    return Array.isArray(allUsers?.data) && allUsers?.data?.length > 0
      ? allUsers?.data
      : mockUserList;
  }, [allUsers]);
  const drinkCommentsData = useMemo(
    () => (drinkComments?.data?.length ? drinkComments?.data : []),
    [drinkComments]
  );

  // scrollToCommentId might be from props or redux depending on your logic
  const [expandedMap, setExpandedMap] = useState({});

  useEffect(() => {
    if (drinkId) {
      dispatch(fetchCommentsByDrink(drinkId));
    }
  }, [dispatch, drinkId]);

  useEffect(() => {
    dispatch(fetchAllUsers());
  }, [dispatch]);

  useEffect(() => {
    if (!drinkCommentsData || drinkCommentsData.length === 0) {
      setComments([]);
      setLoading(false);
      return;
    }

    const sortedAndNested = buildNestedComments(
      drinkCommentsData
        .map((entry) => ({
          ...entry.comment,
          id: entry.comment._id,
        }))
        .filter(Boolean)
    );

    const timeout = setTimeout(() => {
      setComments(sortedAndNested);
      setLoading(false);
    }, 3000); // simulate loading delay for skeleton display

    return () => clearTimeout(timeout); // cleanup in case component unmounts
  }, [drinkCommentsData]);

  useEffect(() => {
    if (!loggedInUser?.user?._id || comments.length === 0) return;

    const userId = loggedInUser?.user?._id;

    const userIdStr = userId.toString();

    const likedCommentIds = drinkCommentsData
      ?.filter((c) =>
        (c?.comment?.analytics?.userLikes || []).includes(userIdStr)
      )
      .map((c) => c.comment._id);

    const likedReplyIds = [];

    const collectLikedReplies = (replies = []) => {
      replies.forEach((reply) => {
        if (reply.analytics?.userLikes?.some((u) => u.toString() === userId)) {
          likedReplyIds.push(reply._id);
        }
        if (reply.analytics?.userReplies?.length > 0) {
          collectLikedReplies(reply.analytics.userReplies);
        }
      });
    };

    comments.forEach((comment) => {
      if (comment.analytics?.userReplies?.length > 0) {
        collectLikedReplies(comment.analytics.userReplies);
      }
    });

    setLikedComments(likedCommentIds);
    setLikedReplies(likedReplyIds);
  }, [comments, loggedInUser, drinkCommentsData]);

  useEffect(() => {
    const currentRef = observerRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries[0].isIntersecting &&
          !isLoadingMore &&
          visibleCount < comments.length
        ) {
          setIsLoadingMore(true);
          setTimeout(() => {
            setVisibleCount((prev) => prev + 100);
            setIsLoadingMore(false);
          }, 1000);
        }
      },
      { threshold: 1.0 }
    );

    if (currentRef) observer.observe(currentRef);
    return () => {
      if (currentRef) observer.unobserve(currentRef);
    };
  }, [isLoadingMore, visibleCount, comments.length]);

  useEffect(() => {
    setShowScrollTop(visibleCount >= 20);
  }, [visibleCount]);

  useEffect(() => {
    if (replyInputRef.current) replyInputRef.current.focus();
  }, [replyTo]);

  useEffect(() => {
    const sortedAndNested = buildNestedComments(
      drinkCommentsData
        .map((entry) => ({
          ...entry.comment,
          id: entry.comment._id,
        }))
        .filter(Boolean)
    );

    setComments(sortedAndNested);
  }, [drinkCommentsData]);

  useEffect(() => {
    const commentIdFromURL = new URLSearchParams(window.location.search).get(
      "commentId"
    );
    if (!commentIdFromURL || loading || comments.length === 0) return;

    const expandParentChain = (targetId, commentsList) => {
      const map = {};

      const walk = (list) => {
        for (const item of list) {
          if (item._id === targetId) return true;
          if (item.analytics?.userReplies?.length) {
            if (walk(item.analytics.userReplies)) {
              map[item._id] = true;
              return true;
            }
          }
        }
        return false;
      };

      walk(commentsList);
      return map;
    };

    const map = expandParentChain(commentIdFromURL, comments);
    setExpandedMap(map);

    setTimeout(() => {
      const el = document.getElementById(`comment-${commentIdFromURL}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("highlighted-comment");
      }
    }, 600);
  }, [comments, loading]);

  const showAlert = (type, message) => {
    setAlert({ type, message });

    // Auto-hide after 5 seconds
    setTimeout(() => {
      setAlert({ type: "", message: "" });
    }, 5000);
  };

 const renderCommentText = (text, mentions) => {
  if (!mentions?.length) return text;

  const mentionRegex = /@([a-z0-9](?:[a-z0-9._-]{0,28}[a-z0-9])?)/gi;

  const elements = [];
  let lastIndex = 0;

  for (const match of text.matchAll(mentionRegex)) {
    const startIndex = match.index;
    const fullMatch = match[0];     // e.g. "@joshua.smiley"
    const handle = match[1];        // e.g. "joshua.smiley"

    if (startIndex > lastIndex) {
      elements.push(text.slice(lastIndex, startIndex));
    }

    const user = mentions.find(
      (m) => (m.username || "").toLowerCase() === handle.toLowerCase()
    );

    if (user) {
      elements.push(
        <span
          key={startIndex}
          onClick={() => alert(`User ID: ${user.userId || user._id}`)}
          style={{
            backgroundColor: "var(--primary-color)",
            color: "#fff",
            borderRadius: "12px",
            padding: "2px 6px",
            fontWeight: 500,
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          {fullMatch}
        </span>
      );
    } else {
      elements.push(fullMatch);
    }

    lastIndex = startIndex + fullMatch.length;
  }

  if (lastIndex < text.length) {
    elements.push(text.slice(lastIndex));
  }

  return elements;
};

const threadedCount = useMemo(() => countThreaded(comments), [comments]);


  const handleAddComment = async ({ text, mentions }) => {
    if (!text.trim()) return;

    try {
      setLoading(true);
      const res = await api.post("/comments/create", {
        drinkId,
        content: text,
        mentionUsers: mentions.map((m) => m.userId), // assuming { userId, username }
      });

      // Optionally show toast/notification here

      // Refresh comments list
      dispatch(fetchCommentsByDrink(drinkId));
      dispatch(fetchDrinkById(drinkId));
      showAlert("success", res.data.message); // ✅ from backend
      setLoading(false);
    } catch (err) {
      console.error("Error adding comment:", err);
      // Optionally show error toast/alert here
      showAlert(
        "error",
        err?.response?.data?.message || "Something went wrong."
      );
    }
  };

  const handleEditComment = async ({ comment, mentions, text }) => {
    try {
      setLoading(true);
      const res = await api.patch(`/comments/${comment.id}`, {
        content: text,
        mentionUsers: mentions.map((m) => m.userId),
      });

      dispatch(fetchCommentsByDrink(drinkId));
      dispatch(fetchDrinkById(drinkId));
      setEditingCommentId(null);
      setLoading(false);
      showAlert("success", res.data.message);
    } catch (err) {
      console.error("Failed to edit comment", err);
      showAlert(
        "error",
        err?.response?.data?.message || "Failed to edit comment."
      );
    }
  };

  const handleDeleteComment = async ({ commentId }) => {
    if (!commentId) return;

    try {
      setLoading(true);
      const res = await api.delete(`/comments/${commentId}`);
      // Refresh the comment list
      dispatch(fetchCommentsByDrink(drinkId));
      dispatch(fetchDrinkById(drinkId));
      showAlert("success", res.data.message || "Comment deleted successfully.");

      setLoading(false);
    } catch (err) {
      console.error("Failed to delete comment", err);
      showAlert(
        "error",
        err?.response?.data?.message || "Failed to delete comment."
      );
      setLoading(false);
    }
  };

  const handleAddReply = async (parentId, text, mentions) => {
    if (!text.trim()) return;

    try {
      const res = await api.post(`/comments/${parentId}/reply`, {
        content: text,
        mentionUsers: mentions.map((m) => m.userId),
      });

      // Optionally show toast/alert
      showAlert("success", res.data.message || "Reply posted successfully");

      // Refresh comments from backend
      dispatch(fetchCommentsByDrink(drinkId));
      dispatch(fetchDrinkById(drinkId));

      // Reset reply UI
      setReplyTo(null);
      setReplyText("");
    } catch (err) {
      console.error("Failed to post reply:", err);
      showAlert(
        "error",
        err?.response?.data?.message || "Failed to post reply."
      );
    }
  };

  const handleEditReply = async ({ reply, mentions, text }) => {
    if (!reply || !text.trim()) return;

    try {
      const res = await api.patch(`/comments/${reply._id}`, {
        content: text,
        mentionUsers: mentions.map((m) => m.userId),
      });

      dispatch(fetchCommentsByDrink(drinkId));
       dispatch(fetchDrinkById(drinkId));
      showAlert("success", res.data.message || "Reply updated successfully.");
    } catch (err) {
      console.error("Failed to edit reply:", err);
      showAlert(
        "error",
        err?.response?.data?.message || "Failed to edit reply."
      );
    }
  };

  const handleDeleteReply = async (replyId) => {
    if (!replyId) return;

    try {
      const res = await api.delete(`/comments/${replyId}`);

      dispatch(fetchCommentsByDrink(drinkId));
       dispatch(fetchDrinkById(drinkId));
      showAlert("success", res.data.message || "Reply deleted successfully.");
    } catch (err) {
      console.error("Failed to delete reply:", err);
      showAlert(
        "error",
        err?.response?.data?.message || "Failed to delete reply."
      );
    }
  };

  const toggleLike = async (id) => {
    //const hasLiked = likedComments.includes(id);

    try {
      const res = await api.patch(`/comments/${id}/like`); // 🔁 API call

      dispatch(fetchCommentsByDrink(drinkId));
       dispatch(fetchDrinkById(drinkId));
      showAlert("success", res.data.message || "Liked/unliked successfully.");
    } catch (err) {
      console.error("Failed to toggle like:", err);
      showAlert(
        "error",
        err?.response?.data?.message || "Failed to like or unlike."
      );
    }
  };

  const toggleReplyLike = async (commentId, replyId) => {
    try {
      const res = await api.patch(`/comments/${replyId}/like`); // 🔁 API call

      dispatch(fetchCommentsByDrink(drinkId));
       dispatch(fetchDrinkById(drinkId));
      showAlert("success", res.data.message || "Liked/unliked successfully.");
    } catch (err) {
      console.error("Failed to toggle like:", err);
      showAlert(
        "error",
        err?.response?.data?.message || "Failed to like or unlike."
      );
    }
  };

  const getSortedComments = () => {
    return [...comments].sort((a, b) => {
      const aDate = new Date(a.createdAt).getTime();
      const bDate = new Date(b.createdAt).getTime();

      const aLikes = a.analytics?.counts?.likes || 0;
      const bLikes = b.analytics?.counts?.likes || 0;

      if (sortOrder === "newest") return bDate - aDate;
      if (sortOrder === "oldest") return aDate - bDate;
      if (sortOrder === "liked") return bLikes - aLikes;

      return 0;
    });
  };

  

  const handleOpenReportModal = async (comment) => {
    try {
      const res = await api.get(`/comments/${comment._id}/report`);
      setReportData(res.data.report || null);
    } catch (err) {
      console.error("Error fetching report info", err);
    }

    setReportingComment({ id: comment._id, content: comment.content });
    setReportModalOpen(true);
  };

  const handleSubmitReport = async (reason) => {
    try {
      await api.post(`/comments/${reportingComment.id}/report`, {
        reason,
      });

      // ✅ Refresh the comment list after submitting the report
      await dispatch(fetchCommentsByDrink(drinkId));


      showAlert("success", "Report submitted. Thank you!");
    } catch (err) {
      console.error("Failed to report comment", err);
      showAlert("error", "Failed to report. Try again later.");
    }
    setReportModalOpen(false);
  };

  return (
    <Box id="comment-section-top" sx={{ mt: 6, position: "relative" }}>
      <Collapse in={!!alert.message}>
        <Alert
          severity={alert.type || "info"}
          onClose={() => setAlert({ type: "", message: "" })}
          sx={{
            mb: 2,
            borderRadius: 2,
            fontSize: "0.95rem",
            maxWidth: "100%",
          }}
        >
          {alert.message}
        </Alert>
      </Collapse>

      {loading ? (
        <>
          <Skeleton width="30%" height={28} sx={{ mb: 2 }} />
          <Skeleton variant="rounded" height={60} sx={{ mb: 2 }} />
        </>
      ) : (
        <>
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              mb: 2,
            }}
          >
           
            <Typography variant="h6">
              Comments ({abbreviateNumber(threadedCount)})
            </Typography>
            <FormControl size="small">
              <InputLabel>Sort by</InputLabel>
              <Select
                value={sortOrder}
                label="Sort by"
                onChange={(e) => setSortOrder(e.target.value)}
              >
                <MenuItem value="newest">Newest</MenuItem>
                <MenuItem value="oldest">Oldest</MenuItem>
                <MenuItem value="liked">Most Liked</MenuItem>
              </Select>
            </FormControl>
          </Box>

          <CommentInput
            loggedInUserId={loggedInUser?.user?._id}
            avatarUrl={loggedInUser?.user?.profile?.photo}
            mentionUserData={mentionUserData}
            onSubmit={handleAddComment}
          />
        </>
      )}

      {loading ? (
        <CommentSkeleton count={3} />
      ) : (
        getSortedComments()
          .slice(0, visibleCount)
          .map((comment) => {
            const isLiked = likedComments.includes(comment.id);
            return (
              <Box key={comment.id} id={`comment-${comment.id}`} sx={{ mb: 3 }}>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                    <Avatar src={comment.author.profile.photo} />
                    <Box>
                      <Typography variant="subtitle2">
                        {comment.author.username}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatDistanceToNow(new Date(comment.createdAt), {
                          addSuffix: true,
                        })}
                      </Typography>
                    </Box>
                  </Box>
                    <CommentMenu
                      onReport={() => handleOpenReportModal(comment)}
                    onBlock={() =>
                      showAlert(
                        "info",
                        "Blocking users is not available yet."
                      )
                    }
                    onEdit={() => {
                      setEditingCommentId(comment.id);
                      // setEditingText(comment.content);
                    }}
                    onDelete={() =>
                      handleDeleteComment({ commentId: comment.id })
                    }
                    loggedInUserId={loggedInUser?.user?._id}
                    commentAuthorId={comment?.author?._id}
                  />
                </Box>

                {editingCommentId === comment.id ? (
                  <CommentInput
                    loggedInUserId={loggedInUser?.user?._id}
                    avatarUrl={loggedInUser?.user?.profile?.photo}
                    mentionUserData={mentionUserData}
                    isEditing={true}
                    initialText={comment.content}
                    initialRawContent={comment.rawContent} // 👈 should come from your DB
                    initialMentions={comment.analytics?.usersMentioned || []} // Or another source if you track full user objects
                    onSubmit={({ text, mentions }) =>
                      handleEditComment({ comment, mentions, text })
                    }
                    onCancelEdit={() => setEditingCommentId(null)}
                  />
                ) : (
                  <Box sx={{ mt: 1, mb: 2, fontSize: "1rem", lineHeight: 1.5 }}>
                    {renderCommentText(
                      comment.content,
                      comment.analytics?.usersMentioned
                    )}
                  </Box>
                )}
                <Box
                  sx={{ display: "flex", alignItems: "center", gap: 2, mt: 1 }}
                >
                  {/* Like Button */}
                  <ButtonBase
                    onClick={() => toggleLike(comment.id)}
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
                    />
                    <Typography
                      variant="body2"
                      sx={{ color: isLiked ? "white" : "inherit" }}
                    >
                      {`${
                        abbreviateNumber(comment.analytics?.counts?.likes) || 0
                      } like${
                        comment.analytics?.counts?.likes === 1 ? "" : "s"
                      }`}
                    </Typography>
                  </ButtonBase>
                  {/* Reply Button */}
                  <ButtonBase
                    onClick={() => setReplyTo(comment.id)}
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

                {replyTo === comment.id && (
                  <Box sx={{ pl: 6, pt: 1 }}>
                    <CommentInput
                      loggedInUserId={loggedInUser?.user?._id}
                      avatarUrl={
                        loggedInUser?.user?.profile?.photo ||
                        "/images/avatar.png"
                      }
                      mentionUserData={mentionUserData}
                      onSubmit={({ text, mentions }) => {
                        handleAddReply(comment.id, text, mentions);
                        setReplyTo(null);
                      }}
                      onCancelEdit={() => {
                        setReplyTo(null);
                      }}
                      showActions
                    />
                  </Box>
                )}

                <Collapse in={true} timeout="auto">
                  <ReplyThread
                    replies={comment?.analytics?.userReplies}
                    parentId={comment._id}
                    expandedMap={expandedMap}
                    renderCommentText={renderCommentText}
                    likedReplies={likedReplies}
                    handleToggleLike={toggleReplyLike}
                    setReplyTo={setReplyTo}
                    replyTo={replyTo}
                    replyText={replyText}
                    setReplyText={setReplyText}
                    handleAddReply={handleAddReply}
                    handleEditReply={handleEditReply}
                    handleDeleteReply={handleDeleteReply}
                    handleOpenReportModal={handleOpenReportModal} 
                    mentionUserData={mentionUserData}
                    depth={1}
                  />
                </Collapse>
              </Box>
            );
          })
      )}

      {isLoadingMore &&
        Array.from({ length: 3 }).map((_, idx) => (
          <Box key={`loading-${idx}`} sx={{ mb: 3 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
              <Skeleton variant="circular" width={40} height={40} />
              <Box sx={{ flex: 1 }}>
                <Skeleton width="40%" height={16} />
                <Skeleton width="30%" height={14} />
              </Box>
            </Box>
            <Skeleton variant="text" width="100%" height={60} sx={{ mt: 2 }} />
          </Box>
        ))}

      {false && visibleCount < comments.length && (
        <Box textAlign="center" mt={2}>
          <button
            onClick={() => setVisibleCount((prev) => prev + 100)}
            style={{
              backgroundColor: "var(--primary-color)",
              color: "white",
              border: "none",
              borderRadius: "4px",
              padding: "8px 16px",
              cursor: "pointer",
            }}
          >
            Show more
          </button>
        </Box>
      )}

      {/* Message when ALL comments are loaded */}
      {!loading && visibleCount >= comments.length && comments.length > 0 && (
        <Typography
          variant="body2"
          align="center"
          sx={{ mt: 2, color: "text.secondary" }}
        >
          🎉 You’ve reached the end — no more comments!
        </Typography>
      )}

      {/* Message when there are NO comments at all */}
      {!loading && comments.length === 0 && (
        <Typography
          variant="body1"
          align="center"
          sx={{ mt: 4, color: "text.secondary" }}
        >
          😶 No comments yet. Be the first to say something!
        </Typography>
      )}

      <div ref={observerRef} />

      {visibleCount > 20 && showScrollTop && (
        <Fade in={true}>
          <Tooltip title="Scroll to top of comments">
            <Fab
              size="small"
              sx={{
                position: "fixed",
                bottom: 10,
                right: 10,
                zIndex: 1000,
                backgroundColor: "var(--primary-color)",
                color: "white",
                "&:hover": { backgroundColor: "var(--primary-color)" },
              }}
              onClick={() => {
                const topElement = document.getElementById(
                  "comment-section-top"
                );
                if (topElement) {
                  topElement.scrollIntoView({ behavior: "smooth" });
                }
              }}
            >
              <KeyboardArrowUp />
            </Fab>
          </Tooltip>
        </Fade>
      )}

      <ReportCommentModal
        open={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
        commentId={reportingComment?.id}
        commentContent={reportingComment?.content}
        alreadyReported={reportData}
        onSubmit={handleSubmitReport}
      />
    </Box>
  );
};

export default CommentSection;
