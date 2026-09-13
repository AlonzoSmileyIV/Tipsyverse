import React, { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import ImageOutlinedIcon from "@mui/icons-material/ImageOutlined";
import { useLocation } from "react-router-dom";
import api from "../../services/api";

const statusColor = (status) => {
  if (["open", "urgent"].includes(status)) return "error";
  if (["in_progress", "waiting_on_user"].includes(status)) return "warning";
  if (["resolved", "closed"].includes(status)) return "success";
  if (status === "canceled") return "default";
  return "default";
};

const primaryButtonSx = {
  color: "var(--primary-color)",
  borderColor: "var(--primary-color)",
  "&:hover": {
    borderColor: "var(--primary-color)",
    backgroundColor: "rgba(128, 0, 32, 0.06)",
  },
};

const primaryContainedSx = {
  backgroundColor: "var(--primary-color)",
  "&:hover": { backgroundColor: "#5f001f" },
};
const displayTicketNumber = (ticket) =>
  ticket?.ticketNumber || "TKT-00000";
const formatLabel = (value) =>
  String(value || "undecided")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
const buildExternalThreads = (messages = []) => {
  const externalMessages = messages
    .filter((message) => !message.internal)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const byParent = externalMessages.reduce((acc, message) => {
    const parentId = message.parentMessage ? String(message.parentMessage) : "root";
    acc[parentId] = acc[parentId] || [];
    acc[parentId].push(message);
    return acc;
  }, {});

  const attachReplies = (message) => ({
    ...message,
    replies: (byParent[String(message._id)] || []).map(attachReplies),
  });

  return (byParent.root || []).map(attachReplies);
};

const uploadSupportPhotos = async (files) => {
  const selected = Array.from(files || []).filter((file) =>
    String(file.type || "").startsWith("image/")
  );
  if (!selected.length) return [];

  const formData = new FormData();
  selected.slice(0, 8).forEach((file) => formData.append("photos", file));
  const res = await api.post("/support-tickets/upload-images", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data?.data || [];
};

function AttachmentGrid({ attachments = [], onRemove }) {
  if (!attachments.length) return null;

  return (
    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
      {attachments.map((attachment, index) => (
        <Box
          key={attachment.publicId || attachment.url || index}
          sx={{
            position: "relative",
            width: 112,
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 1,
            overflow: "hidden",
            bgcolor: "background.paper",
          }}
        >
          <Box
            component="a"
            href={attachment.url}
            target="_blank"
            rel="noreferrer"
            sx={{ display: "block", color: "inherit", textDecoration: "none" }}
          >
            <Box
              component="img"
              src={attachment.url}
              alt={attachment.originalName || "Support attachment"}
              sx={{
                display: "block",
                width: "100%",
                height: 78,
                objectFit: "cover",
                bgcolor: "grey.100",
              }}
            />
            <Typography
              variant="caption"
              sx={{
                display: "block",
                px: 0.75,
                py: 0.5,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {attachment.originalName || "Photo"}
            </Typography>
          </Box>
          {onRemove && (
            <IconButton
              size="small"
              aria-label="Remove photo"
              onClick={() => onRemove(index)}
              sx={{
                position: "absolute",
                top: 2,
                right: 2,
                bgcolor: "rgba(255,255,255,0.9)",
                "&:hover": { bgcolor: "background.paper" },
              }}
            >
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          )}
        </Box>
      ))}
    </Stack>
  );
}

function SupportTicketsForm() {
  const location = useLocation();
  const [tickets, setTickets] = useState([]);
  const [alert, setAlert] = useState(null);
  const [saving, setSaving] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [editDescription, setEditDescription] = useState("");
  const [ticketDialogTab, setTicketDialogTab] = useState("details");
  const [replyMessage, setReplyMessage] = useState("");
  const [replyAttachments, setReplyAttachments] = useState([]);
  const [editAttachments, setEditAttachments] = useState([]);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [replyingToMessageId, setReplyingToMessageId] = useState(null);
  const [form, setForm] = useState({
    category: "other",
    subject: "",
    description: "",
    attachments: [],
  });

  const handlePhotoUpload = async (files, setter) => {
    try {
      setUploadingPhotos(true);
      const uploaded = await uploadSupportPhotos(files);
      if (uploaded.length) {
        setter((current) => [...current, ...uploaded].slice(0, 8));
      }
    } catch (err) {
      setAlert({
        type: "error",
        message: err?.response?.data?.message || "Failed to upload photo.",
      });
    } finally {
      setUploadingPhotos(false);
    }
  };

  const loadTickets = async () => {
    try {
      const res = await api.get("/support-tickets?mine=true");
      setTickets(res.data?.data || []);
    } catch (err) {
      setAlert({ type: "error", message: "Failed to load support tickets." });
    }
  };

  useEffect(() => {
    loadTickets();
  }, []);

  useEffect(() => {
    const ticketId = new URLSearchParams(location.search).get("ticket");
    if (!ticketId || !tickets.length) return;
    const ticket = tickets.find((item) => String(item._id) === String(ticketId));
    if (ticket) {
      setSelectedTicket(ticket);
      setEditDescription(ticket.description || "");
      setEditAttachments(ticket.attachments || []);
    }
  }, [location.search, tickets]);

  const handleSubmit = async () => {
    try {
      setSaving(true);
      await api.post("/support-tickets", form);
      setAlert({ type: "success", message: "Support ticket submitted." });
      setForm({ category: "other", subject: "", description: "", attachments: [] });
      loadTickets();
    } catch (err) {
      setAlert({
        type: "error",
        message: err?.response?.data?.message || "Failed to submit support ticket.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleOpenTicket = (ticket) => {
    setSelectedTicket(ticket);
    setEditDescription(ticket.description || "");
    setEditAttachments(ticket.attachments || []);
    setTicketDialogTab("details");
    setReplyMessage("");
    setReplyAttachments([]);
    setReplyingToMessageId(null);
  };

  const refreshSelected = (updatedTicket) => {
    if (!updatedTicket?._id) return;
    setTickets((prev) =>
      prev.map((ticket) =>
        String(ticket._id) === String(updatedTicket._id) ? updatedTicket : ticket
      )
    );
    setSelectedTicket(updatedTicket);
    setEditDescription(updatedTicket.description || "");
    setEditAttachments(updatedTicket.attachments || []);
  };

  const handleEditDescription = async () => {
    if (!selectedTicket || !editDescription.trim()) return;
    try {
      setSaving(true);
      const res = await api.patch(`/support-tickets/${selectedTicket._id}/my`, {
        description: editDescription,
        attachments: editAttachments,
      });
      refreshSelected(res.data?.data);
      setAlert({ type: "success", message: "Ticket description updated." });
    } catch (err) {
      setAlert({ type: "error", message: err?.response?.data?.message || "Failed to update ticket." });
    } finally {
      setSaving(false);
    }
  };

  const handleCancelTicket = async () => {
    if (!selectedTicket) return;
    try {
      setSaving(true);
      const res = await api.patch(`/support-tickets/${selectedTicket._id}/cancel`);
      refreshSelected(res.data?.data);
      setAlert({ type: "success", message: "Ticket canceled." });
    } catch (err) {
      setAlert({ type: "error", message: err?.response?.data?.message || "Failed to cancel ticket." });
    } finally {
      setSaving(false);
    }
  };

  const handleReopenTicket = async () => {
    if (!selectedTicket) return;
    try {
      setSaving(true);
      const res = await api.patch(`/support-tickets/${selectedTicket._id}/reopen`);
      refreshSelected(res.data?.data);
      setAlert({ type: "success", message: "Ticket sent back to support." });
    } catch (err) {
      setAlert({ type: "error", message: err?.response?.data?.message || "Failed to reopen ticket." });
    } finally {
      setSaving(false);
    }
  };

  const handleSendReply = async () => {
    if (!selectedTicket || !replyMessage.trim()) return;
    try {
      setSaving(true);
      const res = await api.post(`/support-tickets/${selectedTicket._id}/messages`, {
        message: replyMessage,
        internal: false,
        parentMessage: replyingToMessageId,
        attachments: replyAttachments,
      });
      setReplyMessage("");
      setReplyAttachments([]);
      setReplyingToMessageId(null);
      const updatedTicket = res.data?.data;
      refreshSelected(
        updatedTicket && !["closed", "canceled"].includes(updatedTicket.status)
          ? { ...updatedTicket, status: "in_progress" }
          : updatedTicket
      );
      setAlert({ type: "success", message: "Reply sent." });
    } catch (err) {
      setAlert({ type: "error", message: err?.response?.data?.message || "Failed to send reply." });
    } finally {
      setSaving(false);
    }
  };

  const renderReplyComposer = (messageId) =>
    replyingToMessageId === messageId ? (
      <Stack spacing={1} sx={{ mt: 1.5 }}>
        <TextField
          fullWidth
          multiline
          minRows={3}
          label="Reply"
          value={replyMessage}
          onChange={(event) => setReplyMessage(event.target.value)}
        />
        <Button
          component="label"
          variant="outlined"
          size="small"
          startIcon={<ImageOutlinedIcon />}
          disabled={uploadingPhotos || replyAttachments.length >= 8}
          sx={{ alignSelf: "flex-start", ...primaryButtonSx }}
        >
          {uploadingPhotos ? "Uploading..." : "Add photos"}
          <input
            hidden
            multiple
            type="file"
            accept="image/*"
            onChange={(event) => {
              handlePhotoUpload(event.target.files, setReplyAttachments);
              event.target.value = "";
            }}
          />
        </Button>
        <AttachmentGrid
          attachments={replyAttachments}
          onRemove={(index) =>
            setReplyAttachments((current) =>
              current.filter((_, i) => i !== index)
            )
          }
        />
        <Stack direction="row" spacing={1} justifyContent="flex-end">
          <Button
            size="small"
            onClick={() => {
              setReplyingToMessageId(null);
              setReplyMessage("");
              setReplyAttachments([]);
            }}
            sx={primaryButtonSx}
          >
            Cancel
          </Button>
          <Button
            size="small"
            variant="contained"
            sx={primaryContainedSx}
            disabled={saving || uploadingPhotos || !replyMessage.trim()}
            onClick={handleSendReply}
          >
            Send Reply
          </Button>
        </Stack>
      </Stack>
    ) : (
      <Button
        size="small"
        variant="outlined"
        sx={{ mt: 1, ...primaryButtonSx }}
        onClick={() => {
          setReplyingToMessageId(messageId);
          setReplyMessage("");
          setReplyAttachments([]);
        }}
      >
        Reply
      </Button>
    );

  const renderExternalMessage = (message, depth = 0) => (
    <Paper
      key={message._id}
      variant="outlined"
      sx={{
        p: 1.25,
        bgcolor: depth ? "grey.50" : "background.paper",
      }}
    >
      <Typography variant="body2" fontWeight={700}>
        {message.author?.fullName || message.author?.username || "User"}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {new Date(message.createdAt).toLocaleString()}
      </Typography>
      <Typography variant="body2" sx={{ mt: 0.75 }}>
        {message.message}
      </Typography>
      <Box sx={{ mt: message.attachments?.length ? 1 : 0 }}>
        <AttachmentGrid attachments={message.attachments || []} />
      </Box>
      {message.replies?.length > 0 && (
        <Stack spacing={1} sx={{ mt: 1.25, pl: 2, borderLeft: "3px solid", borderColor: "divider" }}>
          {message.replies.map((reply) => renderExternalMessage(reply, depth + 1))}
        </Stack>
      )}
      {renderReplyComposer(message._id)}
    </Paper>
  );

  return (
    <Box>
      <Typography variant="h5">Tech Support</Typography>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        Report app issues, booking problems, payment questions, or portal bugs.
      </Typography>

      {alert && (
        <Alert severity={alert.type} onClose={() => setAlert(null)} sx={{ mb: 2 }}>
          {alert.message}
        </Alert>
      )}

      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Stack spacing={2} sx={{ maxWidth: 720 }}>
          <TextField
            fullWidth
            label="Subject"
            value={form.subject}
            onChange={(e) => setForm((p) => ({ ...p, subject: e.target.value }))}
            inputProps={{ maxLength: 140 }}
            helperText={`${form.subject.length}/140`}
          />

          <FormControl fullWidth>
            <InputLabel id="support-ticket-category-label">Category</InputLabel>
            <Select
              labelId="support-ticket-category-label"
              label="Category"
              value={form.category}
              onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
            >
              <MenuItem value="login">Login</MenuItem>
              <MenuItem value="booking">Booking</MenuItem>
              <MenuItem value="payments">Payments</MenuItem>
              <MenuItem value="bartender_portal">Bartender Portal</MenuItem>
              <MenuItem value="drink_content">Drink Content</MenuItem>
              <MenuItem value="notifications">Notifications</MenuItem>
              <MenuItem value="technical_issue">Technical Issue</MenuItem>
              <MenuItem value="other">Other</MenuItem>
            </Select>
          </FormControl>

          <TextField
            fullWidth
            multiline
            minRows={5}
            label="What happened?"
            value={form.description}
            onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
            inputProps={{ maxLength: 2000 }}
            helperText={`${form.description.length}/2000`}
          />

          <Stack spacing={1}>
            <Button
              component="label"
              variant="outlined"
              startIcon={<ImageOutlinedIcon />}
              disabled={uploadingPhotos || form.attachments.length >= 8}
              sx={{ alignSelf: "flex-start", ...primaryButtonSx }}
            >
              {uploadingPhotos ? "Uploading..." : "Add photos"}
              <input
                hidden
                multiple
                type="file"
                accept="image/*"
                onChange={(event) => {
                  handlePhotoUpload(event.target.files, (updater) =>
                    setForm((current) => ({
                      ...current,
                      attachments:
                        typeof updater === "function"
                          ? updater(current.attachments || [])
                          : updater,
                    }))
                  );
                  event.target.value = "";
                }}
              />
            </Button>
            <AttachmentGrid
              attachments={form.attachments}
              onRemove={(index) =>
                setForm((current) => ({
                  ...current,
                  attachments: current.attachments.filter((_, i) => i !== index),
                }))
              }
            />
          </Stack>

          <Box>
            <Button
              variant="contained"
              disabled={saving || !form.subject.trim() || !form.description.trim()}
              onClick={handleSubmit}
              sx={primaryContainedSx}
            >
              Submit Ticket
            </Button>
          </Box>
        </Stack>
      </Paper>

      <Typography variant="h6" sx={{ mb: 1 }}>My Tickets</Typography>
      <Stack spacing={1.5}>
        {tickets.length === 0 ? (
          <Typography color="text.secondary">No support tickets yet.</Typography>
        ) : (
          tickets.map((ticket) => (
            <Paper key={ticket._id} variant="outlined" sx={{ p: 1.5 }}>
              <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={1}>
                <Box>
                  <Typography fontWeight={700}>{displayTicketNumber(ticket)} · {ticket.subject}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {formatLabel(ticket.category)} • {new Date(ticket.createdAt).toLocaleString()}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Assignee: {ticket.assignedTo?.fullName || ticket.assignedTo?.email || "Unassigned"}
                  </Typography>
                </Box>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Chip size="small" color={statusColor(ticket.status)} label={formatLabel(ticket.status)} />
                  <Button size="small" variant="outlined" sx={primaryButtonSx} onClick={() => handleOpenTicket(ticket)}>
                    View
                  </Button>
                </Stack>
              </Stack>
              
            </Paper>
          ))
        )}
      </Stack>

      <Dialog open={!!selectedTicket} onClose={() => setSelectedTicket(null)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {selectedTicket ? displayTicketNumber(selectedTicket) : "Support Ticket"}
        </DialogTitle>
        <DialogContent dividers>
          {selectedTicket && (
            <Stack spacing={2}>
              <Paper variant="outlined">
                <Tabs value={ticketDialogTab} onChange={(event, value) => setTicketDialogTab(value)}>
                  <Tab value="details" label="Details" />
                  {(selectedTicket.messages || []).some((message) => !message.internal) && (
                    <Tab value="communication" label="Communication" />
                  )}
                </Tabs>
              </Paper>

              {ticketDialogTab === "details" && (
                <Stack spacing={2}>
                  <Box>
                    <Typography variant="subtitle2">Subject</Typography>
                    <Typography>{selectedTicket.subject}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="subtitle2">Status</Typography>
                    <Chip size="small" color={statusColor(selectedTicket.status)} label={formatLabel(selectedTicket.status)} />
                  </Box>
                  <Box>
                    <Typography variant="subtitle2">Priority</Typography>
                    <Chip size="small" label={formatLabel(selectedTicket.priority)} />
                  </Box>
                  <Box>
                    <Typography variant="subtitle2">Assignee</Typography>
                    <Typography color="text.secondary">
                      {selectedTicket.assignedTo?.fullName || selectedTicket.assignedTo?.email || "Unassigned"}
                    </Typography>
                  </Box>
                  <TextField
                    fullWidth
                    multiline
                    minRows={5}
                    label="Issue description"
                    value={editDescription}
                    onChange={(event) => setEditDescription(event.target.value)}
                    disabled={selectedTicket.status !== "open"}
                    inputProps={{ maxLength: 2000 }}
                    helperText={
                      selectedTicket.status === "open"
                        ? `${editDescription.length}/2000`
                        : "Only open tickets can be edited."
                    }
                  />
                  <Stack spacing={1}>
                    <Button
                      component="label"
                      variant="outlined"
                      startIcon={<ImageOutlinedIcon />}
                      disabled={
                        uploadingPhotos ||
                        selectedTicket.status !== "open" ||
                        editAttachments.length >= 8
                      }
                      sx={{ alignSelf: "flex-start", ...primaryButtonSx }}
                    >
                      {uploadingPhotos ? "Uploading..." : "Add photos"}
                      <input
                        hidden
                        multiple
                        type="file"
                        accept="image/*"
                        onChange={(event) => {
                          handlePhotoUpload(event.target.files, setEditAttachments);
                          event.target.value = "";
                        }}
                      />
                    </Button>
                    <AttachmentGrid
                      attachments={editAttachments}
                      onRemove={
                        selectedTicket.status === "open"
                          ? (index) =>
                              setEditAttachments((current) =>
                                current.filter((_, i) => i !== index)
                              )
                          : null
                      }
                    />
                  </Stack>
                  {selectedTicket.resolution && (
                    <Alert severity="success">
                      <Typography fontWeight={700}>Resolution</Typography>
                      {selectedTicket.resolution}
                    </Alert>
                  )}
                </Stack>
              )}

              {ticketDialogTab === "communication" && (
                <Stack spacing={1.5}>
                  {(selectedTicket.messages || []).filter((message) => !message.internal).length === 0 ? (
                    <Typography color="text.secondary">No messages yet.</Typography>
                  ) : (
                    buildExternalThreads(selectedTicket.messages || []).map((message) =>
                      renderExternalMessage(message)
                    )
                  )}
                  {replyingToMessageId === null && (
                    <Stack spacing={1}>
                      <TextField
                        fullWidth
                        multiline
                        minRows={3}
                        label="New message"
                        value={replyMessage}
                        onChange={(event) => setReplyMessage(event.target.value)}
                      />
                      <Button
                        component="label"
                        variant="outlined"
                        size="small"
                        startIcon={<ImageOutlinedIcon />}
                        disabled={uploadingPhotos || replyAttachments.length >= 8}
                        sx={{ alignSelf: "flex-start", ...primaryButtonSx }}
                      >
                        {uploadingPhotos ? "Uploading..." : "Add photos"}
                        <input
                          hidden
                          multiple
                          type="file"
                          accept="image/*"
                          onChange={(event) => {
                            handlePhotoUpload(event.target.files, setReplyAttachments);
                            event.target.value = "";
                          }}
                        />
                      </Button>
                      <AttachmentGrid
                        attachments={replyAttachments}
                        onRemove={(index) =>
                          setReplyAttachments((current) =>
                            current.filter((_, i) => i !== index)
                          )
                        }
                      />
                      <Button
                        variant="contained"
                        sx={{ alignSelf: "flex-end", ...primaryContainedSx }}
                        disabled={saving || uploadingPhotos || !replyMessage.trim()}
                        onClick={handleSendReply}
                      >
                        Send Message
                      </Button>
                    </Stack>
                  )}
                </Stack>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ alignItems: "stretch", flexDirection: { xs: "column", sm: "row" }, gap: 1 }}>
          <Button onClick={() => setSelectedTicket(null)} sx={primaryButtonSx}>Close</Button>
          {selectedTicket?.status === "open" && (
            <>
              <Button variant="outlined" sx={primaryButtonSx} disabled={saving} onClick={handleEditDescription}>
                Save Description
              </Button>
              <Button variant="outlined" color="error" disabled={saving} onClick={handleCancelTicket}>
                Cancel Ticket
              </Button>
            </>
          )}
          {selectedTicket?.status === "resolved" && (
            <Button variant="outlined" sx={primaryButtonSx} disabled={saving} onClick={handleReopenTicket}>
              No, Send It Back
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default SupportTicketsForm;
