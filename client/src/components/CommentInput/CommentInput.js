import React, {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Avatar,
  Box,
  Button,
  ClickAwayListener,
  IconButton,
  List,
  ListItemButton,
  Paper,
  TextField,
  Typography,
} from "@mui/material";
import { Close, Save, Send } from "@mui/icons-material";

const DEFAULT_MAX_LENGTH = 500;
const DEFAULT_WARNING_THRESHOLD = 450;

const usernameFor = (user = {}) =>
  String(user.username || user.fullName || user.email || "")
    .trim()
    .replace(/^@/, "")
    .replace(/\s+/g, ".");

const textFromLegacyRawContent = (rawContent) =>
  Array.isArray(rawContent?.blocks)
    ? rawContent.blocks.map((block) => String(block?.text || "")).join("\n")
    : "";

const escapeRegex = (value = "") =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const CommentInput = ({
  loggedInUserId,
  avatarUrl = "/images/avatar.png",
  mentionUserData = [],
  onSubmit,
  initialText = "",
  initialMentions = [],
  initialRawContent,
  isEditing = false,
  onCancelEdit,
  onCancel,
  showActions = false,
  maxLength = DEFAULT_MAX_LENGTH,
  warningThreshold = DEFAULT_WARNING_THRESHOLD,
  placeholder = "Tell us how you feel...",
}) => {
  const initialValue =
    initialText || textFromLegacyRawContent(initialRawContent);
  const [text, setText] = useState(initialValue);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [mentionStart, setMentionStart] = useState(null);
  const inputRef = useRef(null);
  const pendingSelectionRef = useRef(null);

  useEffect(() => {
    if (isEditing) {
      setText(initialText || textFromLegacyRawContent(initialRawContent));
    }
  }, [initialRawContent, initialText, isEditing]);

  useLayoutEffect(() => {
    const position = pendingSelectionRef.current;
    if (position == null || !inputRef.current) return;
    inputRef.current.focus();
    inputRef.current.setSelectionRange(position, position);
    pendingSelectionRef.current = null;
  }, [text]);

  const availableUsers = useMemo(
    () =>
      (Array.isArray(mentionUserData) ? mentionUserData : []).filter(
        (user) => user?._id && String(user._id) !== String(loggedInUserId)
      ),
    [loggedInUserId, mentionUserData]
  );

  const mentionedUserIds = useMemo(() => {
    const ids = new Set(
      (Array.isArray(initialMentions) ? initialMentions : [])
        .map((mention) => mention?.userId || mention?._id)
        .filter(Boolean)
        .map(String)
    );
    availableUsers.forEach((user) => {
      const username = usernameFor(user);
      if (
        username &&
        new RegExp(`(^|\\s)@${escapeRegex(username)}(?=\\s|$|[.,!?;:])`, "i").test(
          text
        )
      ) {
        ids.add(String(user._id));
      }
    });
    return ids;
  }, [availableUsers, initialMentions, text]);

  const updateSuggestions = (nextText, cursorPosition) => {
    const beforeCursor = nextText.slice(0, cursorPosition);
    const match = beforeCursor.match(/(?:^|\s)@([^\s@]*)$/);
    if (!match) {
      setShowSuggestions(false);
      setMentionStart(null);
      return;
    }

    const query = match[1].toLowerCase();
    const start = cursorPosition - query.length - 1;
    const matches = availableUsers.filter((user) => {
      const username = usernameFor(user);
      return (
        username.toLowerCase().includes(query) &&
        !mentionedUserIds.has(String(user._id))
      );
    });
    setMentionStart(start);
    setFilteredUsers(matches);
    setShowSuggestions(matches.length > 0);
  };

  const handleChange = (event) => {
    const nextText = event.target.value.slice(0, maxLength);
    const cursorPosition = Math.min(
      event.target.selectionStart ?? nextText.length,
      nextText.length
    );
    setText(nextText);
    updateSuggestions(nextText, cursorPosition);
  };

  const insertMention = (user) => {
    const username = usernameFor(user);
    if (!username || mentionStart == null) return;

    const input = inputRef.current;
    const cursorPosition = input?.selectionStart ?? text.length;
    const nextText = `${text.slice(0, mentionStart)}@${username} ${text.slice(
      cursorPosition
    )}`.slice(0, maxLength);
    const nextCursor = Math.min(mentionStart + username.length + 2, nextText.length);

    pendingSelectionRef.current = nextCursor;
    setText(nextText);
    setShowSuggestions(false);
    setMentionStart(null);
  };

  const handleSubmit = () => {
    const normalizedText = text.trim();
    if (!normalizedText || text.length > maxLength) return;

    const mentions = availableUsers
      .filter((user) => mentionedUserIds.has(String(user._id)))
      .map((user) => ({ userId: user._id, username: usernameFor(user) }));
    onSubmit?.({ text: normalizedText, mentions });
    if (!isEditing) setText("");
    setShowSuggestions(false);
  };

  const characterCount = text.length;
  const isNearLimit = characterCount >= warningThreshold;
  const hasText = Boolean(text.trim());
  const cancelEdit = onCancelEdit || onCancel;

  return (
    <Box sx={{ display: "flex", gap: 2, my: 3, position: "relative" }}>
      {!isEditing && (
        <Box sx={{ display: "flex", alignItems: "center" }}>
          <Avatar src={avatarUrl} />
        </Box>
      )}

      <Box sx={{ flex: 1, position: "relative" }}>
        <ClickAwayListener onClickAway={() => setShowSuggestions(false)}>
          <Box>
            <TextField
              fullWidth
              multiline
              minRows={3}
              value={text}
              onChange={handleChange}
              placeholder={placeholder}
              inputRef={inputRef}
              slotProps={{ htmlInput: { maxLength } }}
              onKeyDown={(event) => {
                if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                  event.preventDefault();
                  handleSubmit();
                }
              }}
            />

            {showSuggestions && (
              <Paper
                elevation={3}
                sx={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  zIndex: 10,
                  mt: 0.5,
                  maxHeight: 200,
                  overflowY: "auto",
                }}
              >
                <List dense>
                  {filteredUsers.map((user) => (
                    <ListItemButton
                      key={user._id}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => insertMention(user)}
                    >
                      <Avatar
                        src={user.profile?.photo}
                        sx={{ width: 24, height: 24, mr: 1 }}
                      />
                      <Typography variant="body2">@{usernameFor(user)}</Typography>
                    </ListItemButton>
                  ))}
                </List>
              </Paper>
            )}
          </Box>
        </ClickAwayListener>

        <Typography
          component="div"
          variant="caption"
          sx={{
            mt: 0.5,
            textAlign: "right",
            color: isNearLimit ? "warning.main" : "text.secondary",
            fontWeight: isNearLimit ? 700 : 400,
          }}
        >
          {characterCount}/{maxLength}
        </Typography>

        {(isEditing || showActions) && (
          <Box sx={{ mt: 1, display: "flex", gap: 1, justifyContent: "flex-end" }}>
            <Button
              startIcon={<Close />}
              variant="outlined"
              onClick={cancelEdit}
              size="small"
            >
              Cancel
            </Button>
            {isEditing && (
              <Button
                startIcon={<Save />}
                variant="contained"
                onClick={handleSubmit}
                size="small"
                disabled={!hasText}
                sx={{ backgroundColor: "var(--primary-color)" }}
              >
                Save
              </Button>
            )}
          </Box>
        )}
      </Box>

      {!isEditing && (
        <Box sx={{ display: "flex", alignItems: "center" }}>
          <IconButton
            aria-label="Send comment"
            disabled={!hasText}
            onClick={handleSubmit}
            sx={{
              backgroundColor: "var(--primary-color)",
              color: "#fff",
              "&:hover": {
                backgroundColor: "var(--primary-color)",
                opacity: 0.9,
              },
            }}
          >
            <Send fontSize="small" />
          </IconButton>
        </Box>
      )}
    </Box>
  );
};

export default CommentInput;
