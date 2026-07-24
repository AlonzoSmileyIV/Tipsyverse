import React, { useState, useRef, useEffect } from "react";
import {
  Box,
  Avatar,
  IconButton,
  Paper,
  List,
  ListItemButton,
  Typography,
  ClickAwayListener,
  Button,
} from "@mui/material";
import {
  Editor,
  EditorState,
  CompositeDecorator,
  Modifier,
  convertToRaw,
  ContentState,
  convertFromRaw,
} from "draft-js";
import { Send, Save, Close } from "@mui/icons-material";
import "draft-js/dist/Draft.css";

// --- Mention Strategy ---
const mentionStrategy = (contentBlock, callback, contentState) => {
  contentBlock.findEntityRanges((character) => {
    const entityKey = character.getEntity();
    return (
      entityKey && contentState.getEntity(entityKey).getType() === "MENTION"
    );
  }, callback);
};

// --- Mention Component ---
const Mention = (props) => {
  const { userId } = props.contentState.getEntity(props.entityKey).getData();

  return (
    <span
      style={{
        //display: "inline-block", // 👈 makes sure the span wraps fully

        backgroundColor: "var(--primary-color)",
        color: "#fff",
        padding: "2px 6px",
        borderRadius: "12px",
        fontWeight: 500,
        cursor: "pointer",

        whiteSpace: "nowrap", // 👈 prevent wrapping to multiple lines
        maxWidth: "100%",
        overflow: "hidden",
        textOverflow: "ellipsis",
      }}
      data-user-id={userId}
    >
      {props.children}
    </span>
  );
};

const decorator = new CompositeDecorator([
  {
    strategy: mentionStrategy,
    component: Mention,
  },
]);

const DEFAULT_MAX_LENGTH = 500;
const DEFAULT_WARNING_THRESHOLD = 450;

// --- CommentInput Component ---
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
  showActions = false,
  maxLength = DEFAULT_MAX_LENGTH,
  warningThreshold = DEFAULT_WARNING_THRESHOLD,
  placeholder = "Tell us how you feel...",
}) => {
  const [editorState, setEditorState] = useState(
    EditorState.createEmpty(decorator)
  );
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [mentionStart, setMentionStart] = useState(null);
  const editorRef = useRef();
  const plainText = editorState.getCurrentContent().getPlainText();
  const characterCount = plainText.length;
  const isOverLimit = characterCount > maxLength;
  const isNearLimit = characterCount >= warningThreshold;
  const hasText = editorState.getCurrentContent().hasText();

  const getSelectedTextLength = (state) => {
    const selection = state.getSelection();
    if (selection.isCollapsed()) return 0;

    return state
      .getCurrentContent()
      .getPlainText()
      .slice(selection.getStartOffset(), selection.getEndOffset()).length;
  };

  const getRemainingCharacters = (state) => {
    const currentLength = state.getCurrentContent().getPlainText().length;
    return maxLength - (currentLength - getSelectedTextLength(state));
  };

  const fetchMentionedUserIds = () => {
    const content = editorState.getCurrentContent();
    const raw = convertToRaw(content);
    const userIds = new Set();

    Object.values(raw.entityMap).forEach((entity) => {
      if (entity.type === "MENTION" && entity.data?.userId) {
        userIds.add(entity.data.userId);
      }
    });

    return userIds;
  };

  const handleEditorChange = (newState) => {
    setEditorState(newState); // Always update first for accurate selection

    const content = newState.getCurrentContent();
    const selection = newState.getSelection();
    const block = content.getBlockForKey(selection.getStartKey());
    const text = block.getText();
    const cursorPos = selection.getStartOffset();
    const word = text.slice(0, cursorPos).split(/\s/).pop();

    // ✅ Re-calculate mentioned users from current raw content
    const raw = convertToRaw(content);
    const mentionedUserIds = new Set();
    Object.values(raw.entityMap).forEach((entity) => {
      if (entity.type === "MENTION" && entity.data?.userId) {
        mentionedUserIds.add(entity.data.userId);
      }
    });

    // ✅ Mention filtering logic
    if (word.startsWith("@")) {
      const query = word.slice(1).toLowerCase();
      const matches = mentionUserData.filter(
        (u) =>
          u.username.toLowerCase().includes(query) &&
          u._id !== loggedInUserId &&
          !mentionedUserIds.has(u._id)
      );
      setFilteredUsers(matches);
      setMentionStart(cursorPos - word.length);
      setShowSuggestions(matches.length > 0);
    } else {
      setShowSuggestions(false);
    }
  };

  const insertMention = (user) => {
    const mentionedIds = fetchMentionedUserIds();
    if (mentionedIds.has(user._id)) return;

    const contentState = editorState.getCurrentContent();
    const selection = editorState.getSelection();

    const mentionText = `@${user.username}`;
    const mentionEntity = contentState.createEntity("MENTION", "IMMUTABLE", {
      username: user.username,
      userId: user._id,
    });
    const entityKey =
      mentionEntity.getLastCreatedEntityKey?.() ??
      contentState.getLastCreatedEntityKey();

    const mentionSelection = selection.merge({
      anchorOffset: mentionStart,
      focusOffset: selection.getAnchorOffset(),
    });

    const replacedContent = Modifier.replaceText(
      contentState,
      mentionSelection,
      mentionText,
      null,
      entityKey
    );

    const withSpace = Modifier.insertText(
      replacedContent,
      replacedContent.getSelectionAfter(),
      " "
    );

    const newEditorState = EditorState.push(
      editorState,
      withSpace,
      "insert-mention"
    );

    setEditorState(
      EditorState.forceSelection(newEditorState, withSpace.getSelectionAfter())
    );

    // ✅ Add to mentioned users
    //setMentionedUsers((prev) => [...prev, user]);
    setShowSuggestions(false);
  };

  const handleSubmit = () => {
    const content = editorState.getCurrentContent();
    const text = content.getPlainText(); // or keep as 'plain' if you like
    if (!text.trim() || text.length > maxLength) return;

    const raw = convertToRaw(content);

    const mentionsMap = new Map();

    Object.values(raw.entityMap).forEach((entity) => {
      if (entity.type === "MENTION" && entity.data?.userId) {
        mentionsMap.set(entity.data.userId, {
          userId: entity.data.userId,
          username: entity.data.username,
        });
      }
    });

    const mentions = Array.from(mentionsMap.values());
    onSubmit?.({ text, mentions });

    if (!isEditing) {
      setEditorState(EditorState.createEmpty(decorator));
    }
  };

  // --- Backspace delete full mention ---
  const handleBeforeInput = (chars, newEditorState) => {
    if (chars === " ") {
      setShowSuggestions(false);
    }
    if (getRemainingCharacters(newEditorState) <= 0) {
      return "handled";
    }
    return "not-handled";
  };

  const handlePastedText = (text, html, currentEditorState) => {
    const remaining = getRemainingCharacters(currentEditorState);
    if (remaining <= 0) return "handled";

    if (text.length <= remaining) return "not-handled";

    const content = currentEditorState.getCurrentContent();
    const selection = currentEditorState.getSelection();
    const nextContent = Modifier.replaceText(
      content,
      selection,
      text.slice(0, remaining)
    );
    const nextState = EditorState.push(
      currentEditorState,
      nextContent,
      "insert-characters"
    );

    setEditorState(
      EditorState.forceSelection(nextState, nextContent.getSelectionAfter())
    );
    return "handled";
  };

  const handleKeyCommand = (command, currentEditorState) => {
    if (command === "backspace") {
      const selection = currentEditorState.getSelection();
      if (selection.isCollapsed()) {
        const offset = selection.getStartOffset();
        const content = currentEditorState.getCurrentContent();
        const block = content.getBlockForKey(selection.getStartKey());
        const entityKey = block.getEntityAt(offset - 1);

        if (entityKey) {
          // const entity = currentEditorState
          //   .getCurrentContent()
          //   .getEntity(entityKey);
          // const userId = entity.getData()?.userId;

          const start = block.getText().lastIndexOf("@", offset);
          const newSelection = selection.merge({
            anchorOffset: start,
            focusOffset: offset,
          });

          const newContent = Modifier.removeRange(
            content,
            newSelection,
            "backward"
          );
          const newState = EditorState.push(
            currentEditorState,
            newContent,
            "remove-range"
          );
          setEditorState(
            EditorState.forceSelection(newState, newContent.getSelectionAfter())
          );

          // ✅ Remove from mentionedUsers
          //setMentionedUsers((prev) => prev.filter((u) => u._id !== userId));
          return "handled";
        }
      }
    }
    return "not-handled";
  };

  useEffect(() => {
    if (isEditing && initialRawContent) {
      const contentState = convertFromRaw(initialRawContent);
      const editor = EditorState.createWithContent(contentState, decorator);
      setEditorState(editor);
    }
  }, [isEditing, initialRawContent]);

  useEffect(() => {
    if (isEditing && initialText) {
      let contentState = ContentState.createFromText(initialText);
      const plainText = contentState.getPlainText();

      initialMentions.forEach((mention) => {
        const mentionText = `@${mention.username}`;
        //const start = contentState.getPlainText().indexOf(mentionText);

        // if (start !== -1) {
        //   const selection = contentState.getSelectionAfter().merge({
        //     anchorOffset: start,
        //     focusOffset: start + mentionText.length,
        //   });

        //   contentState = contentState.createEntity("MENTION", "IMMUTABLE", {
        //     fullName: mention.fullName,
        //     userId: mention.userId,
        //   });

        //   const entityKey = contentState.getLastCreatedEntityKey();

        //   contentState = Modifier.applyEntity(contentState, selection, entityKey);
        // }
        let index = -1;
        let start = 0;

        while ((index = plainText.indexOf(mentionText, start)) !== -1) {
          const selection = contentState.getSelectionAfter().merge({
            anchorOffset: index,
            focusOffset: index + mentionText.length,
          });

          contentState = contentState.createEntity("MENTION", "IMMUTABLE", {
            username: mention.username,
            userId: mention.userId,
          });

          const entityKey = contentState.getLastCreatedEntityKey();
          contentState = Modifier.applyEntity(
            contentState,
            selection,
            entityKey
          );

          start = index + mentionText.length;
        }
      });

      const editor = EditorState.createWithContent(contentState, decorator);
      setEditorState(editor);
      //setMentionedUsers(initialMentions);
    }
  }, [isEditing, initialText, initialMentions]);

  return (
    <Box sx={{ display: "flex", gap: 2, my: 3, position: "relative" }}>
      {!isEditing && (
        <Box sx={{ display: "flex", alignItems: "center" }}>
          <Avatar src={avatarUrl} />
        </Box>
      )}

      <Box sx={{ flex: 1, position: "relative" }}>
        <ClickAwayListener onClickAway={() => setShowSuggestions(false)}>
          <Box
            sx={{
              border: "1px solid #ccc",
              borderRadius: "4px",
              padding: "12px",
              minHeight: "80px",
              cursor: "text",
            }}
            onClick={() => editorRef.current.focus()}
          >
            <Editor
              ref={editorRef}
              editorState={editorState}
              onChange={handleEditorChange}
              placeholder={placeholder}
              handleBeforeInput={handleBeforeInput}
              handlePastedText={handlePastedText}
              handleKeyCommand={handleKeyCommand}
            />
          </Box>
        </ClickAwayListener>

        <Box
          sx={{
            mt: 0.5,
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <Typography
            variant="caption"
            sx={{
              color: isOverLimit
                ? "error.main"
                : isNearLimit
                ? "warning.main"
                : "text.secondary",
              fontWeight: isNearLimit ? 700 : 400,
            }}
          >
            {characterCount}/{maxLength}
          </Typography>
        </Box>

        {showSuggestions && (
          <Paper
            elevation={3}
            sx={{
              position: "absolute",
              top: "100%",
              left: 0,
              zIndex: 10,
              mt: 0.5,
              maxHeight: 200,
              overflowY: "auto",
              width: "100%",
            }}
          >
            <List dense>
              {filteredUsers.map((user) => (
                <ListItemButton
                  key={user._id}
                  onClick={() => insertMention(user)}
                >
                  <Avatar
                    src={user.profile?.photo}
                    sx={{ width: 24, height: 24, mr: 1 }}
                  />
                  <Typography variant="body2">{user.username}</Typography>
                </ListItemButton>
              ))}
            </List>
          </Paper>
        )}

        {/* ✅ Save/Cancel buttons for editing */}
        {(isEditing || showActions) && (
          <Box
            sx={{
              mt: 1,
              display: "flex",
              gap: 1,
              justifyContent: "flex-end",
            }}
          >
            <Button
              startIcon={<Close />}
              variant="outlined"
              onClick={onCancelEdit}
              size="small"
              sx={{ minWidth: 80 }}
            >
              Cancel
            </Button>
            {isEditing && (
              <Button
                startIcon={<Save />}
                variant="contained"
                onClick={handleSubmit}
                size="small"
                disabled={!hasText || isOverLimit}
                sx={{ backgroundColor: "var(--primary-color)" }}
              >
                Save
              </Button>
            )}
          </Box>
        )}
      </Box>

      {/* ✅ Send Button (only for new comments) */}
      {!isEditing && (
        <Box sx={{ display: "flex", alignItems: "center" }}>
          <IconButton
            disabled={!hasText || isOverLimit}
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
