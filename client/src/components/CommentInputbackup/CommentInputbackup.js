import React, { useState, useRef } from "react";
import {
  Box,
  Avatar,
  IconButton,
  Paper,
  List,
  ListItemButton,
  Typography,
  ClickAwayListener,
} from "@mui/material";
import {
  Editor,
  EditorState,
  CompositeDecorator,
  Modifier,
  convertToRaw,
} from "draft-js";
import { Send } from "@mui/icons-material";
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
  const { userId } = props.contentState
    .getEntity(props.entityKey)
    .getData();

  return (
    <span
      onClick={() => window.alert(`User ID: ${userId}`)}
      style={{
        backgroundColor: "var(--primary-color)",
        color: "#fff",
        padding: "2px 6px",
        borderRadius: "12px",
        fontWeight: 500,
        cursor: "pointer",
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

// --- CommentInput Component ---
const CommentInput = ({
  avatarUrl = "/images/avatar.png",
  mentionUserData = [],
  onSubmit,
}) => {
  const [editorState, setEditorState] = useState(
    EditorState.createEmpty(decorator)
  );
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [mentionStart, setMentionStart] = useState(null);
  const editorRef = useRef();

  const handleEditorChange = (newState) => {
    const content = newState.getCurrentContent();
    const selection = newState.getSelection();
    const block = content.getBlockForKey(selection.getStartKey());
    const text = block.getText();
    const cursorPos = selection.getStartOffset();
    const word = text.slice(0, cursorPos).split(/\s/).pop();

    if (word.startsWith("@")) {
      const query = word.slice(1).toLowerCase();
      const matches = mentionUserData.filter((u) =>
        u.fullName.toLowerCase().includes(query)
      );
      setFilteredUsers(matches);
      setMentionStart(cursorPos - word.length);
      setShowSuggestions(matches.length > 0);
    } else {
      setShowSuggestions(false);
    }

    setEditorState(newState);
  };

  const insertMention = (user) => {
    const contentState = editorState.getCurrentContent();
    const selection = editorState.getSelection();

    const mentionText = `@${user.fullName}`;
    const mentionEntity = contentState.createEntity("MENTION", "IMMUTABLE", {
      fullName: user.fullName,
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
    setShowSuggestions(false);
  };

  const handleSubmit = () => {
    const content = editorState.getCurrentContent();
    const raw = convertToRaw(content);

    const mentions = [];
    raw.blocks.forEach((block) => {
      block.entityRanges.forEach((range) => {
        const entity = raw.entityMap[range.key];
        if (entity.type === "MENTION") {
          mentions.push(entity.data);
        }
      });
    });

    const plain = content.getPlainText();
    onSubmit?.({ text: plain, mentions });
    setEditorState(EditorState.createEmpty(decorator));
  };

  // --- Backspace delete full mention ---
  const handleBeforeInput = (chars, newEditorState) => {
    if (chars === " ") {
      setShowSuggestions(false);
    }
    return "not-handled";
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
          return "handled";
        }
      }
    }
    return "not-handled";
  };

  return (
    <Box sx={{ display: "flex", gap: 2, my: 3 }}>
      <Box sx={{ display: "flex", alignItems: "center" }}>
        <Avatar src={avatarUrl} />
      </Box>
      <Box sx={{ flex: 1, position: "relative" }}>
        <ClickAwayListener onClickAway={() => setShowSuggestions(false)}>
          <Box
            sx={{
              border: "1px solid #ccc",
                borderRadius: "4px",
                padding: "12px",
                minHeight: "80px",
                display: "block",
                cursor: "text",
            }}
            onClick={() => editorRef.current.focus()}
          >
            <Editor
              ref={editorRef}
              editorState={editorState}
              onChange={handleEditorChange}
              placeholder="Add a comment..."
              handleBeforeInput={handleBeforeInput}
              handleKeyCommand={handleKeyCommand}
            />
          </Box>
        </ClickAwayListener>

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
                  <Typography variant="body2">{user.fullName}</Typography>
                </ListItemButton>
              ))}
            </List>
          </Paper>
        )}
      </Box>
       {/* Send Button */}
  <Box sx={{ display: "flex", alignItems: "center" }}>
    <IconButton
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
    </Box>
  );
};

export default CommentInput;
