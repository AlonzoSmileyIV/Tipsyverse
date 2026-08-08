import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Autocomplete,
  Avatar,
  Box,
  Button,
  Checkbox,
  Chip,
  Divider,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import {
  FormatBold,
  FormatClear,
  FormatItalic,
  FormatListBulleted,
  FormatListNumbered,
  FormatUnderlined,
  DeleteOutline,
  EditOutlined,
} from "@mui/icons-material";
import { DataGrid } from "@mui/x-data-grid";
import { useLocation } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import api from "../../services/api";
import CommentInput from "../CommentInput/CommentInput";
import AdminManageReportedComments from "../AdminManageReportedComments/AdminManageReportedComments";
import { fetchReportedComments } from "../../features/comments/commentSlice";
import EmptyOverlay from "../EmptyOverlay/EmptyOverlay";
import AdminSectionHeader from "../AdminSectionHeader/AdminSectionHeader";
import AdminSummaryCards from "../AdminSummaryCards/AdminSummaryCards";
import DetailDrawerHeader from "../DetailDrawerHeader/DetailDrawerHeader";
import AdminTableControls from "../AdminTableControls/AdminTableControls";
import DOMPurify from "dompurify";
import { loadSpreadsheet } from "../../utils/loadSpreadsheet";

const moneyDate = (value) => (value ? new Date(value).toLocaleString() : "-");
const rowId = (row) => row._id || row.id;
const gridRow = (params, row) => params?.row || row || {};
const gridValue = (params) => params?.value ?? params;
const displayTicketNumber = (ticket) =>
  ticket?.ticketNumber || "TKT-00000";
const formatLabel = (value) =>
  String(value || "undecided")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
const userPhoto = (user) => user?.profile?.photo || user?.avatarUrl || user?.photoUrl || "";
function SupportAttachmentGrid({ attachments = [] }) {
  if (!attachments.length) return null;

  return (
    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
      {attachments.map((attachment, index) => (
        <Box
          key={attachment.publicId || attachment.url || index}
          component="a"
          href={attachment.url}
          target="_blank"
          rel="noreferrer"
          sx={{
            width: 112,
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 1,
            overflow: "hidden",
            color: "inherit",
            textDecoration: "none",
            bgcolor: "background.paper",
          }}
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
      ))}
    </Stack>
  );
}
function RichTextNotesEditor({ value = "", onChange, maxLength = 4000 }) {
  const editorRef = useRef(null);
  const lastExternalValue = useRef(null);
  const plainLength = (html) => {
    if (typeof window === "undefined") return String(html || "").length;
    const holder = document.createElement("div");
    holder.innerHTML = DOMPurify.sanitize(html || "");
    return holder.textContent.length;
  };

  useEffect(() => {
    const next = DOMPurify.sanitize(value || "");
    if (next === lastExternalValue.current) return;

    if (editorRef.current && editorRef.current.innerHTML !== next) {
      editorRef.current.innerHTML = next;
    }
    lastExternalValue.current = next;
  }, [value]);

  const emitChange = () => {
    const next = DOMPurify.sanitize(editorRef.current?.innerHTML || "");
    lastExternalValue.current = next;
    onChange(next);
  };

  const runCommand = (command) => {
    editorRef.current?.focus();
    document.execCommand(command, false, null);
    emitChange();
  };

  const handlePaste = (event) => {
    event.preventDefault();
    const text = event.clipboardData.getData("text/plain");
    document.execCommand("insertText", false, text);
    emitChange();
  };

  const actions = [
    ["bold", "Bold", <FormatBold fontSize="small" />],
    ["italic", "Italic", <FormatItalic fontSize="small" />],
    ["underline", "Underline", <FormatUnderlined fontSize="small" />],
    ["insertUnorderedList", "Bulleted list", <FormatListBulleted fontSize="small" />],
    ["insertOrderedList", "Numbered list", <FormatListNumbered fontSize="small" />],
    ["removeFormat", "Clear formatting", <FormatClear fontSize="small" />],
  ];

  return (
    <Stack spacing={1}>
      <Paper
        variant="outlined"
        sx={{
          overflow: "hidden",
          "&:focus-within": {
            borderColor: "primary.main",
            boxShadow: "0 0 0 1px var(--primary-color)",
          },
        }}
      >
        <Stack
          direction="row"
          spacing={0.5}
          sx={{
            borderBottom: "1px solid",
            borderColor: "divider",
            bgcolor: "grey.50",
            p: 0.75,
          }}
        >
          {actions.map(([command, label, icon]) => (
            <Tooltip key={command} title={label}>
              <IconButton
                size="small"
                aria-label={label}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => runCommand(command)}
              >
                {icon}
              </IconButton>
            </Tooltip>
          ))}
        </Stack>
        <Box
          ref={editorRef}
          contentEditable
          role="textbox"
          aria-label="Internal notes and findings"
          suppressContentEditableWarning
          onInput={emitChange}
          onPaste={handlePaste}
          sx={{
            minHeight: 220,
            p: 2,
            outline: "none",
            lineHeight: 1.6,
            "& ul, & ol": { pl: 3, my: 1 },
            "& p": { my: 1 },
            "&:empty:before": {
              content: '"Document notes, findings, screenshots reviewed, and next actions..."',
              color: "text.disabled",
            },
          }}
        />
      </Paper>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        justifyContent="space-between"
        spacing={0.5}
      >
        <Typography variant="caption" color="text.secondary">
          Rich text notes are internal only.
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {plainLength(value)}/{maxLength}
        </Typography>
      </Stack>
    </Stack>
  );
}
const userPhone = (user) => {
  if (typeof user === "string") return user || "-";
  const phones = user?.employeeDetails?.phones || {};
  return (
    user?.bartenderProfile?.contactInfo?.phone ||
    phones.mobile?.phoneNumber ||
    phones.office?.phoneNumber ||
    user?.profile?.phone ||
    user?.phone ||
    user?.phoneNumber ||
    "-"
  );
};
const eventLocation = (event) => {
  const location = event?.location || {};
  return (
    location.formatted ||
    location.formattedAddress ||
    [
      location.address1,
      location.address2,
      location.city,
      location.state,
      location.zipcode,
    ]
      .filter(Boolean)
      .join(", ") ||
    "-"
  );
};
const primaryButtonSx = {
  color: "var(--primary-color)",
  border: "1px solid var(--primary-color)",
  "&:hover": {
    borderColor: "var(--primary-color)",
    backgroundColor: "rgba(128, 0, 32, 0.06)",
  },
};
const primaryContainedSx = {
  backgroundColor: "var(--primary-color)",
  "&:hover": { backgroundColor: "#5f001f" },
};
const tabsSx = {
  "& .MuiTabs-indicator": { backgroundColor: "var(--primary-color)" },
  "& .MuiTab-root.Mui-selected": {
    color: "var(--primary-color)",
    fontWeight: 700,
  },
};

const renderMentions = (text = "") => {
  const parts = String(text).split(/(@[A-Za-z0-9_.-]+)/g);
  return parts.map((part, index) =>
    /^@[A-Za-z0-9_.-]+$/.test(part) ? (
      <Box
        key={`${part}-${index}`}
        component="span"
        sx={{
          display: "inline-flex",
          alignItems: "center",
          px: 0.75,
          py: 0.15,
          mx: 0.25,
          borderRadius: 999,
          color: "white",
          backgroundColor: "var(--primary-color)",
          fontSize: "0.85em",
          fontWeight: 700,
        }}
      >
        {part}
      </Box>
    ) : (
      <React.Fragment key={`${part}-${index}`}>{part}</React.Fragment>
    )
  );
};

const buildMessageThreads = (messages = []) => {
  const visibleMessages = [...messages].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const byParent = visibleMessages.reduce((acc, message) => {
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

const statusColor = (status) => {
  if (["open", "urgent", "critical", "disputed"].includes(status)) return "error";
  if (["reviewing", "in_progress", "clocked_in"].includes(status)) return "warning";
  if (["resolved", "closed", "verified", "clocked_out"].includes(status)) return "success";
  return "default";
};

function AdminOperations() {
  const dispatch = useDispatch();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const isTablet = useMediaQuery(theme.breakpoints.down("md"));
  const is800OrLess = useMediaQuery("(max-width:800px)");
  const is1300OrLess = useMediaQuery("(max-width:1300px)");
  const is1400OrLess = useMediaQuery("(max-width:1400px)");
  const location = useLocation();
  const loggedInUser = useSelector((state) => state.users.loggedInUser?.user || state.users.loggedInUser);
  const reportedComments = useSelector((state) => state.comments?.reported);
  const [tab, setTab] = useState("incidents");
  const [incidents, setIncidents] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState(null);
  const [selected, setSelected] = useState(null);
  const [updateForm, setUpdateForm] = useState({});
  const [needReviewOnly, setNeedReviewOnly] = useState(false);
  const [sendCommentToSubmitter, setSendCommentToSubmitter] = useState(false);
  const [pendingSubmitterComment, setPendingSubmitterComment] = useState(null);
  const [supportDialogTab, setSupportDialogTab] = useState("details");
  const [search, setSearch] = useState("");
  const [noteDraft, setNoteDraft] = useState("");
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [notesSaving, setNotesSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [incidentRes, attendanceRes, ticketRes] = await Promise.all([
        api.get("/incidents"),
        api.get("/attendance"),
        api.get("/support-tickets"),
      ]);
      setIncidents(incidentRes.data?.data || []);
      setAttendance(attendanceRes.data?.data || []);
      setTickets(ticketRes.data?.data || []);
    } catch (err) {
      setAlert({ type: "error", message: err?.response?.data?.message || "Failed to load operations." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    dispatch(fetchReportedComments());
    api.get("/users/employees")
      .then((res) => setEmployees(res.data?.data || []))
      .catch(() => setEmployees([]));
  }, [dispatch]);

  useEffect(() => {
    const ticketId = new URLSearchParams(location.search).get("ticket");
    if (!ticketId || !tickets.length) return;
    const ticket = tickets.find((item) => String(item._id) === String(ticketId));
    if (!ticket) return;
    setTab("support");
    setSelected(ticket);
    setUpdateForm({
      status: ticket.status,
      priority: ticket.priority,
      resolution: ticket.resolution || "",
      assignedTo: ticket.assignedTo || null,
    });
    setNoteDraft("");
    setEditingNoteId(null);
  }, [location.search, tickets]);

  const updateIncident = async () => {
    if (
      updateForm.status === "resolved" &&
      !String(updateForm.resolution || "").trim()
    ) {
      setAlert({
        type: "error",
        message: "Add a resolution before resolving this incident.",
      });
      return;
    }
    try {
      await api.patch(`/incidents/${selected._id}`, updateForm);
      const resolved = updateForm.status === "resolved";
      setSelected(null);
      setUpdateForm({});
      setAlert({
        type: "success",
        message: resolved
          ? "Incident resolved and the bartender was emailed."
          : "Incident updated.",
      });
      load();
    } catch (err) {
      setAlert({
        type: "error",
        message: err?.response?.data?.message || "Failed to update incident.",
      });
    }
  };

  const updateTicket = async () => {
    const ticketPatch = {
      status: updateForm.status,
      priority: updateForm.priority,
      resolution: updateForm.resolution,
    };
    await api.patch(`/support-tickets/${selected._id}`, ticketPatch);
    setSelected(null);
    setUpdateForm({});
    setAlert({ type: "success", message: "Ticket updated." });
    load();
  };

  const applyUpdatedTicket = (updatedTicket) => {
    if (!updatedTicket) return;
    setSelected(updatedTicket);
    setTickets((prev) =>
      prev.map((ticket) =>
        String(ticket._id) === String(updatedTicket._id) ? updatedTicket : ticket
      )
    );
  };

  const saveTicketNote = async () => {
    if (!String(noteDraft || "").trim()) {
      setAlert({ type: "error", message: "Add note content before saving." });
      return;
    }

    setNotesSaving(true);
    try {
      const res = editingNoteId
        ? await api.patch(`/support-tickets/${selected._id}/notes/${editingNoteId}`, {
            content: noteDraft,
          })
        : await api.post(`/support-tickets/${selected._id}/notes`, {
            content: noteDraft,
          });
      const updatedTicket = res.data?.data;
      applyUpdatedTicket(updatedTicket);
      setNoteDraft("");
      setEditingNoteId(null);
      setAlert({ type: "success", message: editingNoteId ? "Ticket note updated." : "Ticket note added." });
    } catch (err) {
      setAlert({
        type: "error",
        message: err?.response?.data?.message || "Failed to save ticket notes.",
      });
    } finally {
      setNotesSaving(false);
    }
  };

  const deleteTicketNote = async (noteId) => {
    if (!window.confirm("Delete this internal note? This cannot be undone.")) return;
    try {
      const res = await api.delete(`/support-tickets/${selected._id}/notes/${noteId}`);
      applyUpdatedTicket(res.data?.data);
      if (editingNoteId === noteId) {
        setEditingNoteId(null);
        setNoteDraft("");
      }
      setAlert({ type: "success", message: "Ticket note deleted." });
    } catch (err) {
      setAlert({ type: "error", message: err?.response?.data?.message || "Failed to delete ticket note." });
    }
  };

  const submitTicketToUser = async () => {
    const message = String(updateForm.customerMessage || "").trim();
    if (!message) {
      setAlert({ type: "error", message: "Add a message before submitting this to the user." });
      return;
    }

    await api.patch(`/support-tickets/${selected._id}`, {
      ...updateForm,
      status: "waiting_on_user",
      customerMessage: message,
    });
    setSelected(null);
    setUpdateForm({});
    setAlert({ type: "success", message: "Ticket sent to user for a response." });
    load();
  };

  const completeTicket = async () => {
    const resolution = String(updateForm.resolution || "").trim();
    if (!resolution) {
      setAlert({ type: "error", message: "Add a resolution note before completing this ticket." });
      return;
    }

    await api.patch(`/support-tickets/${selected._id}`, {
      ...updateForm,
      status: "resolved",
      resolution,
    });
    setSelected(null);
    setUpdateForm({});
    setAlert({ type: "success", message: "Ticket completed and resolution sent." });
    load();
  };

  const assignTicket = async () => {
    const assigneeId = updateForm.assignedTo?._id || updateForm.assignedTo;
    if (!assigneeId) {
      setAlert({ type: "error", message: "Choose an assignee first." });
      return;
    }
    await api.patch(`/support-tickets/${selected._id}/assign`, { assignedTo: assigneeId });
    setSelected(null);
    setUpdateForm({});
    setAlert({ type: "success", message: "Ticket assigned." });
    load();
  };

  const addTicketComment = async ({ text, mentions = [], sendToSubmitter = false }) => {
    if (!text?.trim()) return;
    const res = await api.post(`/support-tickets/${selected._id}/messages`, {
      message: text,
      internal: !sendToSubmitter,
      mentionUsers: mentions.map((mention) => mention.userId),
    });
    setSendCommentToSubmitter(false);
    setPendingSubmitterComment(null);
    setSelected(res.data?.data || selected);
    setAlert({
      type: "success",
      message: sendToSubmitter ? "Message sent to submitter." : "Internal comment added.",
    });
    load();
  };

  const handleTicketCommentSubmit = ({ text, mentions }) => {
    if (sendCommentToSubmitter) {
      setPendingSubmitterComment({ text, mentions });
      return;
    }
    addTicketComment({ text, mentions, sendToSubmitter: false });
  };

  const openSupportTicket = (ticket) => {
    setAlert(null);
    setSelected(ticket);
    setSupportDialogTab("details");
    setSendCommentToSubmitter(false);
    setPendingSubmitterComment(null);
    setUpdateForm({
      status: ticket.status,
      priority: ticket.priority,
      resolution: ticket.resolution || "",
      assignedTo: ticket.assignedTo || null,
      customerMessage: "",
    });
    setNoteDraft("");
    setEditingNoteId(null);
  };

  const verifyAttendance = async () => {
    await api.patch(`/attendance/${selected._id}/verify`, updateForm);
    setSelected(null);
    setUpdateForm({});
    setAlert({ type: "success", message: "Attendance verified." });
    load();
  };

  const renderSupportMessage = (message, depth = 0) => (
    <Paper
      variant="outlined"
      sx={{ p: 1.25, bgcolor: depth ? "grey.50" : "background.paper" }}
      key={message._id}
    >
      <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
        <Typography variant="body2" fontWeight={700}>{message.author?.fullName || message.author?.username || "User"}</Typography>
        <Chip
          size="small"
          color={message.internal ? "default" : "primary"}
          variant={message.internal ? "outlined" : "filled"}
          label={message.internal ? "Internal" : "Sent to Submitter"}
        />
      </Stack>
      <Typography variant="body2" color="text.secondary">{new Date(message.createdAt).toLocaleString()}</Typography>
      <Typography variant="body2" sx={{ mt: 0.75 }}>{renderMentions(message.message)}</Typography>
      <Box sx={{ mt: message.attachments?.length ? 1 : 0 }}>
        <SupportAttachmentGrid attachments={message.attachments || []} />
      </Box>
      {message.replies?.length > 0 && (
        <Stack spacing={1} sx={{ mt: 1.25, pl: 2, borderLeft: "3px solid", borderColor: "divider" }}>
          {message.replies.map((reply) => renderSupportMessage(reply, depth + 1))}
        </Stack>
      )}
    </Paper>
  );

  const reportedCommentsCount = Array.isArray(reportedComments?.data) ? reportedComments.data.length : 0;
  const needsReview = useCallback((item, activeTab = tab) => {
    if (activeTab === "incidents") return ["open", "reviewing"].includes(item?.status);
    if (activeTab === "attendance") return ["not_started", "clocked_in", "disputed"].includes(item?.status);
    if (activeTab === "support") return ["open", "in_progress", "waiting_on_user"].includes(item?.status);
    if (activeTab === "reported") return true;
    return false;
  }, [tab]);
  const rows = useMemo(() => {
    const rawRows =
      tab === "incidents"
        ? incidents
        : tab === "attendance"
        ? attendance
        : tab === "support"
        ? tickets
        : [];
    const term = search.trim().toLowerCase();
    return (needReviewOnly ? rawRows.filter((item) => needsReview(item)) : rawRows).filter((item) => {
      if (!term) return true;
      return [
        item.ticketNumber,
        item.subject,
        item.category,
        item.status,
        item.priority,
        item.severity,
        item.type,
        item.description,
        item.event?.shortCode,
        item.submittedBy?.fullName,
        item.submittedBy?.email,
        item.reportedBy?.fullName,
        item.reportedBy?.email,
        item.bartenderUser?.fullName,
        item.bartenderUser?.email,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [attendance, incidents, needReviewOnly, needsReview, search, tab, tickets]);
  const incidentNeedsAttentionCount = incidents.filter((item) => ["open", "reviewing"].includes(item?.status)).length;
  const attendanceNeedsAttentionCount = attendance.filter((item) =>
    ["not_started", "clocked_in", "disputed"].includes(item?.status)
  ).length;
  const supportNeedsAttentionCount = tickets.filter((item) =>
    ["open", "in_progress", "waiting_on_user"].includes(item?.status)
  ).length;
  const activeNeedReviewCount =
    tab === "incidents"
      ? incidentNeedsAttentionCount
      : tab === "attendance"
      ? attendanceNeedsAttentionCount
      : tab === "support"
      ? supportNeedsAttentionCount
      : reportedCommentsCount;
  const operationSummaryCards = [
    {
      key: "incidents",
      count: incidents.length,
      label: "Event Incidents",
      description: `${incidentNeedsAttentionCount} need reviewing`,
    },
    {
      key: "attendance",
      count: attendance.length,
      label: "Bartender Attendance",
      description: `${attendanceNeedsAttentionCount} need reviewing`,
    },
    {
      key: "support",
      count: tickets.length,
      label: "Support Tickets",
      description: `${supportNeedsAttentionCount} need reviewing`,
    },
    {
      key: "reported",
      count: reportedCommentsCount,
      label: "Reported Comments",
      description: `${reportedCommentsCount} need reviewing`,
    },
  ];
  const selectedAssigneeId = selected?.assignedTo?._id || selected?.assignedTo || "";
  const updateAssigneeId = updateForm.assignedTo?._id || updateForm.assignedTo || "";
  const assigneeChanged =
    !!updateAssigneeId && String(updateAssigneeId) !== String(selectedAssigneeId || "");

  const handleRefresh = async () => {
    await load();
    dispatch(fetchReportedComments());
    setAlert({ type: "success", message: "Operations refreshed." });
  };

  const handleDownloadExcel = async () => {
    const XLSX = await loadSpreadsheet();
    if (tab === "reported") {
      const rowsToExport = (reportedComments?.data || []).map((comment) => ({
        Author: comment.author?.fullName || comment.author?.email || "",
        Comment: comment.content || "",
        Reports: comment.analytics?.counts?.reports || 0,
        Drink: comment.drink?.name || comment.drink?.slug || "",
        Created: moneyDate(comment.createdAt),
      }));
      const worksheet = XLSX.utils.json_to_sheet(rowsToExport);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Reported Comments");
      XLSX.writeFile(workbook, "Reported Comments.xlsx");
      return;
    }

    const worksheet = XLSX.utils.json_to_sheet(
      rows.map((row) => {
        if (tab === "attendance") {
          return {
            Event: row.event?.shortCode || "",
            Bartender: row.bartenderUser?.fullName || row.bartenderUser?.username || "",
            Status: row.status,
            "Clock In": moneyDate(row.clockInAt),
            "Clock Out": moneyDate(row.clockOutAt),
            Verification: row.contactVerification?.status || "",
            "Verified By": row.contactVerification?.verifiedBy?.fullName || "",
          };
        }
        if (tab === "support") {
          return {
            "Ticket #": displayTicketNumber(row),
            Subject: row.subject,
            "Submitted By": row.submittedBy?.fullName || row.submittedBy?.email || "",
            Assignee: row.assignedTo?.fullName || row.assignedTo?.email || "Unassigned",
            Category: row.category,
            Priority: formatLabel(row.priority),
            Status: formatLabel(row.status),
            Created: moneyDate(row.createdAt),
            Resolution: row.resolution || "",
          };
        }
        return {
          Event: row.event?.shortCode || "",
          Type: row.type,
          "Reported By": row.reportedBy?.fullName || row.reportedBy?.email || "",
          Severity: row.severity,
          Status: row.status,
          Created: moneyDate(row.createdAt),
          Description: row.description,
          Resolution: row.resolution || "",
        };
      })
    );
    const workbook = XLSX.utils.book_new();
    const sheetName =
      tab === "attendance" ? "Attendance" : tab === "support" ? "Support" : "Incidents";
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    XLSX.writeFile(workbook, `Operations-${sheetName}.xlsx`);
  };

  const columns = useMemo(() => {
    if (tab === "attendance") {
      return [
        { field: "event", headerName: "Event", width: isMobile ? 135 : 155, valueGetter: (value, row) => gridRow(value, row).event?.shortCode || "-" },
        { field: "bartender", headerName: "Bartender", flex: 1.2, valueGetter: (value, row) => gridRow(value, row).bartenderUser?.fullName || gridRow(value, row).bartenderUser?.username || "-" },
        { field: "status", headerName: "Status", flex: 0.8, renderCell: (p) => <Chip size="small" color={statusColor(p.value)} label={formatLabel(p.value)} /> },
        { field: "clockInAt", headerName: "Clock In", flex: 1, valueFormatter: (value) => moneyDate(gridValue(value)) },
        { field: "clockOutAt", headerName: "Clock Out", flex: 1, valueFormatter: (value) => moneyDate(gridValue(value)) },
        {
          field: "actions",
          headerName: "Action",
          sortable: false,
          width: 130,
          align: "center",
          headerAlign: "center",
          renderCell: (p) => (
            <Button 
            sx={primaryButtonSx} size="small" onClick={() => {
              setSelected(p.row);
              setUpdateForm({ status: p.row.contactVerification?.status || "present", notes: "" });
            }}>
              Verify
            </Button>
          ),
        },
      ];
    }

    if (tab === "support") {
      return [
        { field: "ticketNumber", headerName: "Ticket #", width: isMobile ? 135 : 155, valueGetter: (value, row) => displayTicketNumber(gridRow(value, row)) },
        { field: "subject", headerName: "Subject", flex: 1.5 },
        { field: "submittedBy", headerName: "Submitted By", flex: 1, valueGetter: (value, row) => gridRow(value, row).submittedBy?.fullName || gridRow(value, row).submittedBy?.email || (gridRow(value, row).submissionSource === "anonymous_error" ? "Anonymous error report" : "-") },
        { field: "assignedTo", headerName: "Assignee", flex: 1, valueGetter: (value, row) => gridRow(value, row).assignedTo?.fullName || gridRow(value, row).assignedTo?.email || "Unassigned" },
        { field: "category", headerName: "Category", flex: 0.9, valueFormatter: (value) => formatLabel(gridValue(value)) },
        { field: "priority", headerName: "Priority", flex: 0.8, renderCell: (p) => <Chip size="small" color={statusColor(p.value)} label={formatLabel(p.value)} /> },
        { field: "status", headerName: "Status", flex: 0.9, renderCell: (p) => <Chip size="small" color={statusColor(p.value)} label={formatLabel(p.value)} /> },
        {
          field: "actions",
          headerName: "Action",
          sortable: false,
          width: 130,
          align: "center",
          headerAlign: "center",
          renderCell: (p) => (
            <Button size="small" onClick={() => {
              openSupportTicket(p.row);
            }} sx={primaryButtonSx}>
              Review
            </Button>
          ),
        },
      ];
    }

    return [
      { field: "event", headerName: "Event", width: isMobile ? 135 : 155, valueGetter: (value, row) => gridRow(value, row).event?.shortCode || "-" },
      { field: "type", headerName: "Type", flex: 1.2, valueFormatter: (value) => formatLabel(gridValue(value)) },
      { field: "reportedBy", headerName: "Reported By", flex: 1, valueGetter: (value, row) => gridRow(value, row).reportedBy?.fullName || gridRow(value, row).reportedBy?.email || "-" },
      { field: "severity", headerName: "Severity", flex: 0.8, renderCell: (p) => <Chip size="small" color={statusColor(p.value)} label={formatLabel(p.value)} /> },
      { field: "status", headerName: "Status", flex: 0.8, renderCell: (p) => <Chip size="small" color={statusColor(p.value)} label={formatLabel(p.value)} /> },
      { field: "createdAt", headerName: "Created", flex: 1, valueFormatter: (value) => moneyDate(gridValue(value)) },
      {
        field: "actions",
        headerName: "Action",
        sortable: false,
        width: 130,
        align: "center",
        headerAlign: "center",
        renderCell: (p) => (
          <Button 
          sx={primaryButtonSx} size="small" onClick={() => {
            setSelected(p.row);
            setUpdateForm({ status: p.row.status, severity: p.row.severity, resolution: p.row.resolution || "" });
          }}>
            Review
          </Button>
        ),
      },
    ];
  }, [tab, isMobile]);

  const dialogTitle =
    tab === "attendance" ? "Verify Attendance" : tab === "support" ? "Review Support Ticket" : "Review Incident";
  const selectedTitle =
    tab === "support"
      ? displayTicketNumber(selected)
      : tab === "attendance"
      ? selected?.event?.shortCode || "Attendance Review"
      : selected?.event?.shortCode || "Incident Review";
  const selectedSummary =
    tab === "support"
      ? selected?.assignedTo
        ? "This support ticket is assigned. Review comments, notes, and status before responding."
        : "This support ticket is unassigned. Assign an owner before deeper follow-up."
      : tab === "attendance"
      ? "Review the bartender attendance record and verify the timing details."
      : "Review the incident details, customer impact, and follow-up status.";
  const selectedFacts =
    tab === "support"
      ? [
          { label: "Subject", value: selected?.subject },
          { label: "Category", value: formatLabel(selected?.category) },
          {
            label: "Assignee",
            value:
              selected?.assignedTo?.fullName ||
              selected?.assignedTo?.email ||
              "Unassigned",
          },
          { label: "Created", value: moneyDate(selected?.createdAt) },
        ]
      : tab === "attendance"
      ? [
          { label: "Event", value: selected?.event?.shortCode },
          {
            label: "Bartender",
            value:
              selected?.bartenderUser?.fullName ||
              selected?.bartenderUser?.email ||
              selected?.bartender?.fullName,
          },
          { label: "Clock In", value: moneyDate(selected?.clockInAt) },
          { label: "Clock Out", value: moneyDate(selected?.clockOutAt) },
        ]
      : [
          { label: "Event", value: selected?.event?.shortCode },
          {
            label: "Reported By",
            value:
              selected?.reportedBy?.fullName ||
              selected?.reportedBy?.email ||
              "Unknown",
          },
          { label: "Severity", value: formatLabel(selected?.severity) },
          { label: "Created", value: moneyDate(selected?.createdAt) },
        ];
  const operationColumnVisibilityModel =
    tab === "attendance"
      ? {
          bartender: !is800OrLess,
          status: !isMobile,
          clockInAt: !isTablet,
          clockOutAt: !isTablet,
        }
      : tab === "support"
      ? {
          subject: !isMobile,
          submittedBy: !is1400OrLess,
          assignedTo: !is1400OrLess,
          category: !is800OrLess,
          priority: !is800OrLess,
          status: !isMobile,
        }
      : {
          type: !is800OrLess,
          reportedBy: !is1300OrLess,
          severity: !is800OrLess,
          status: !isMobile,
          createdAt: !isTablet,
        };

  return (
    <Box>
      <Box sx={{ mb: 2 }}>
        <AdminSectionHeader
          title="Operations"
          subtitle="Track incident reports, attendance verification, tech support tickets, and reported comments."
          onRefresh={handleRefresh}
          onDownload={handleDownloadExcel}
          downloadLabel={
            tab === "attendance"
              ? "Download Attendance Excel"
              : tab === "support"
              ? "Download Support Excel"
              : tab === "reported"
              ? "Download Reported Comments Excel"
              : "Download Incident Excel"
          }
        />
      </Box>

      {!selected && alert && (
        <Alert severity={alert.type} onClose={() => setAlert(null)} sx={{ mb: 2 }}>
          {alert.message}
        </Alert>
      )}

     

      <AdminSummaryCards
        cards={operationSummaryCards}
        selectedKey={tab}
        onSelect={(key) => {
          setTab(key);
          setNeedReviewOnly(false);
        }}
      />

      <AdminTableControls
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search ticket, event, person, status, or description..."
      >
        <Button
          variant={needReviewOnly ? "contained" : "outlined"}
          onClick={() => setNeedReviewOnly((current) => !current)}
          sx={needReviewOnly ? primaryContainedSx : primaryButtonSx}
        >
          Need Reviewing ({activeNeedReviewCount})
        </Button>
        {needReviewOnly && (
          <Button variant="text" onClick={() => setNeedReviewOnly(false)} sx={{ color: "var(--primary-color)" }}>
            Clear Filter
          </Button>
        )}
      </AdminTableControls>

      {tab === "reported" ? (
        <AdminManageReportedComments reviewOnly={needReviewOnly} search={search} />
      ) : (
        <Paper variant="outlined" sx={{ height: 620 }}>
          <DataGrid
            rows={rows}
            columns={columns}
            getRowId={rowId}
            loading={loading}
            columnVisibilityModel={operationColumnVisibilityModel}
            pageSizeOptions={[10, 25, 50]}
            initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
            disableRowSelectionOnClick
            slots={{
            noRowsOverlay: () => (
              <EmptyOverlay message={tab === "attendance"
                  ? "Sorry, no attendance records."
                  : tab === "support"
                  ? "Sorry, no support tickets."
                  : "Sorry, no incidents."} />
            ),
          }}
          // MUI v5 fallback (safe to keep)
          components={{
            NoRowsOverlay: () => (
              <EmptyOverlay message={tab === "attendance"
                  ? "Sorry, no attendance records."
                  : tab === "support"
                  ? "Sorry, no support tickets."
                  : "Sorry, no incidents."}  />
            )
          }}
          />
        </Paper>
      )}

      <Dialog open={!!selected} onClose={() => setSelected(null)} maxWidth="md" fullWidth>
        {selected && (
          <DialogTitle sx={{ p: 0 }}>
            <DetailDrawerHeader
              title={selectedTitle || dialogTitle}
              summary={selectedSummary}
              statusChip={
                <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                  {selected.status && (
                    <Chip
                      size="small"
                      color={statusColor(selected.status)}
                      label={formatLabel(selected.status)}
                    />
                  )}
                  {selected.priority && (
                    <Chip size="small" label={formatLabel(selected.priority)} />
                  )}
                  {selected.severity && (
                    <Chip size="small" label={formatLabel(selected.severity)} />
                  )}
                </Stack>
              }
              facts={selectedFacts}
              lastUpdated={
                selected.updatedAt
                  ? `Last updated ${moneyDate(selected.updatedAt)}`
                  : "Last updated not recorded"
              }
              onClose={() => setSelected(null)}
            />
          </DialogTitle>
        )}
        <DialogContent dividers>
          {alert && (
            <Alert severity={alert.type} onClose={() => setAlert(null)} sx={{ mb: 2 }}>
              {alert.message}
            </Alert>
          )}
          {selected && tab === "support" ? (
            <Stack spacing={2.5} sx={{ maxWidth: 820 }}>
              <Paper variant="outlined">
                <Tabs value={supportDialogTab} onChange={(e, value) => setSupportDialogTab(value)} variant="scrollable" sx={tabsSx}>
                  <Tab value="details" label="Details" />
                  <Tab value="comments" label="Comments" />
                  <Tab value="notes" label="Notes" />
                  <Tab value="activity" label="Activity Log" />
                </Tabs>
              </Paper>

              {supportDialogTab === "details" && (
                <Stack spacing={2}>
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                      <Paper variant="outlined" sx={{ p: 2, height: "100%" }}>
                        <Stack spacing={1}>
                          <Typography variant="subtitle1" fontWeight={800}>
                            Customer Details
                          </Typography>
                          <Typography variant="body2">
                            <strong>Name:</strong>{" "}
                            {selected.submittedBy?.fullName || selected.submittedBy?.username || (selected.submissionSource === "anonymous_error" ? "Anonymous error report" : "-")}
                          </Typography>
                          <Typography variant="body2">
                            <strong>Email:</strong> {selected.submittedBy?.email || "-"}
                          </Typography>
                        </Stack>
                      </Paper>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <Paper variant="outlined" sx={{ p: 2, height: "100%" }}>
                        <Stack spacing={1}>
                          <Typography variant="subtitle1" fontWeight={800}>
                            Ticket Details
                          </Typography>
                          <Typography variant="body2">
                            <strong>Category:</strong> {formatLabel(selected.category)}
                          </Typography>
                          <Typography variant="body2">
                            <strong>Description:</strong> {selected.description}
                          </Typography>
                          <SupportAttachmentGrid attachments={selected.attachments || []} />
                        </Stack>
                      </Paper>
                    </Grid>
                  </Grid>

                  <Typography variant="subtitle1" fontWeight={800}>Assignment</Typography>
                  <Autocomplete
                    options={employees}
                    value={updateForm.assignedTo || null}
                    onChange={(event, value) => setUpdateForm((p) => ({ ...p, assignedTo: value }))}
                    getOptionLabel={(option) =>
                      option ? `${option.fullName || option.username || "Employee"}${option.email ? ` (${option.email})` : ""}` : ""
                    }
                    isOptionEqualToValue={(option, value) => option?._id === value?._id}
                    renderOption={(props, option) => (
                      <Box component="li" {...props} sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                        <Avatar src={userPhoto(option)} sx={{ width: 32, height: 32 }}>
                          {(option.fullName || option.username || "E").charAt(0)}
                        </Avatar>
                        <Box>
                          <Typography variant="body2">{option.fullName || option.username}</Typography>
                          <Typography variant="caption" color="text.secondary">{option.email}</Typography>
                        </Box>
                      </Box>
                    )}
                    renderInput={(params) => (
                      <TextField {...params} label="Assignee" placeholder="Search team members" />
                    )}
                  />
                  {updateForm.assignedTo && (
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Avatar src={userPhoto(updateForm.assignedTo)} />
                      <Box>
                        <Typography variant="body2" fontWeight={700}>{updateForm.assignedTo.fullName || updateForm.assignedTo.username}</Typography>
                        <Typography variant="caption" color="text.secondary">{updateForm.assignedTo.email}</Typography>
                      </Box>
                    </Stack>
                  )}
                  {assigneeChanged && (
                    <Box>
                      <Button variant="outlined" onClick={assignTicket} sx={primaryButtonSx}>
                        {selected.assignedTo ? "Reassign Ticket" : "Assign Ticket"}
                      </Button>
                    </Box>
                  )}

                  <Divider />

                  <Typography variant="subtitle1" fontWeight={800}>Status & Priority</Typography>
                  <FormControl fullWidth>
                    <InputLabel>Status</InputLabel>
                    <Select label="Status" value={updateForm.status || selected.status} onChange={(e) => setUpdateForm((p) => ({ ...p, status: e.target.value }))}>
                      {["open", "in_progress", "waiting_on_user", "resolved", "closed", "canceled"].map((status) => (
                        <MenuItem key={status} value={status}>{formatLabel(status)}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  {updateForm.status === "waiting_on_user" && (
                    <Stack spacing={1}>
                      <TextField
                        fullWidth
                        multiline
                        minRows={3}
                        label="Message to submitter"
                        value={updateForm.customerMessage || ""}
                        onChange={(e) => setUpdateForm((p) => ({ ...p, customerMessage: e.target.value }))}
                      />
                      <Box>
                        <Button
                          variant="contained"
                          sx={primaryContainedSx}
                          onClick={submitTicketToUser}
                          disabled={!String(updateForm.customerMessage || "").trim()}
                        >
                          Submit to User
                        </Button>
                      </Box>
                    </Stack>
                  )}
                  <FormControl fullWidth>
                    <InputLabel>Priority</InputLabel>
                    <Select label="Priority" value={updateForm.priority || selected.priority || "undecided"} onChange={(e) => setUpdateForm((p) => ({ ...p, priority: e.target.value }))}>
                      {["undecided", "low", "medium", "high", "urgent"].map((priority) => (
                        <MenuItem key={priority} value={priority}>{formatLabel(priority)}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  {updateForm.status === "resolved" && (
                    <Stack spacing={1}>
                      <TextField fullWidth multiline minRows={4} label="Resolution" value={updateForm.resolution || ""} onChange={(e) => setUpdateForm((p) => ({ ...p, resolution: e.target.value }))} />
                      <Box>
                        <Button
                          variant="contained"
                          sx={primaryContainedSx}
                          onClick={completeTicket}
                          disabled={!String(updateForm.resolution || "").trim()}
                        >
                          Complete Ticket
                        </Button>
                      </Box>
                    </Stack>
                  )}
                </Stack>
              )}

              {supportDialogTab === "comments" && (
                <Stack spacing={2}>
                  <Typography variant="subtitle1" fontWeight={800}>Comments</Typography>
                    
                  <CommentInput
                    loggedInUserId={loggedInUser?._id}
                    avatarUrl={userPhoto(loggedInUser)}
                    mentionUserData={employees}
                    onSubmit={handleTicketCommentSubmit}
                    placeholder="Add a comment. Use @username for internal mentions."
                    maxLength={2000}
                    warningThreshold={1800}
                  />
                   <FormControlLabel
                    control={
                      <Checkbox
                        checked={sendCommentToSubmitter}
                        onChange={(e) => setSendCommentToSubmitter(e.target.checked)}
                        sx={{ color: "var(--primary-color)", "&.Mui-checked": { color: "var(--primary-color)" } }}
                      />
                    }
                    label="Send to submitter"
                  />
                  <Divider />
                  {(selected.messages || []).length === 0 ? (
                    <Typography variant="body2" color="text.secondary">No comments yet.</Typography>
                  ) : (
                    buildMessageThreads(selected.messages || []).map((message) =>
                      renderSupportMessage(message)
                    )
                  )}

                

                </Stack>
              )}

              {supportDialogTab === "notes" && (
                <Stack spacing={2}>
                  <Box>
                    <Typography variant="subtitle1" fontWeight={800}>
                      Notes and Findings
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Internal documentation for troubleshooting steps, findings, screenshots reviewed, and next actions.
                    </Typography>
                  </Box>

                  <Typography variant="subtitle2">
                    {editingNoteId ? "Edit note" : "Add another note"}
                  </Typography>
                  <RichTextNotesEditor
                    key={editingNoteId || "new-note"}
                    value={noteDraft}
                    onChange={setNoteDraft}
                    maxLength={4000}
                  />
                  <Stack direction="row" spacing={1}>
                    <Button
                      variant="contained"
                      sx={primaryContainedSx}
                      onClick={saveTicketNote}
                      disabled={notesSaving || !String(noteDraft || "").trim()}
                    >
                      {editingNoteId ? "Save Changes" : "Add Note"}
                    </Button>
                    {editingNoteId && (
                      <Button
                        onClick={() => {
                          setEditingNoteId(null);
                          setNoteDraft("");
                        }}
                      >
                        Cancel
                      </Button>
                    )}
                  </Stack>
                  {(selected.noteEntries || []).length > 0 || selected.notes ? (
                    <Stack spacing={1.5}>
                      {selected.notes && (
                        <Paper variant="outlined" sx={{ p: 1.5, bgcolor: "grey.50" }}>
                          <Typography variant="caption" color="text.secondary">
                            Legacy note
                          </Typography>
                          <Box
                            sx={{ mt: 0.75, lineHeight: 1.6, "& p": { my: 1 } }}
                            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(selected.notes) }}
                          />
                        </Paper>
                      )}
                       <Divider />
                      {[...(selected.noteEntries || [])].reverse().map((note) => (
                        <Paper key={note._id} variant="outlined" sx={{ p: 1.5 }}>
                          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                            <Box>
                              <Typography variant="body2" fontWeight={700}>
                                {note.author?.fullName || note.author?.username || "Team member"}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {moneyDate(note.createdAt)}
                                {note.updatedAt && new Date(note.updatedAt).getTime() !== new Date(note.createdAt).getTime()
                                  ? ` · Edited ${moneyDate(note.updatedAt)}`
                                  : ""}
                              </Typography>
                            </Box>
                            <Stack direction="row" spacing={0.5}>
                              <Tooltip title="Edit note">
                                <IconButton
                                  size="small"
                                  onClick={() => {
                                    setEditingNoteId(note._id);
                                    setNoteDraft(note.content || "");
                                  }}
                                >
                                  <EditOutlined fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Delete note">
                                <IconButton size="small" color="error" onClick={() => deleteTicketNote(note._id)}>
                                  <DeleteOutline fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </Stack>
                          </Stack>
                          <Box
                            sx={{ mt: 1, lineHeight: 1.6, "& ul, & ol": { pl: 3 }, "& p": { my: 1 } }}
                            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(note.content || "") }}
                          />
                        </Paper>
                      ))}
                    </Stack>
                  ) : (
                    <Typography variant="body2" color="text.secondary">No internal notes yet.</Typography>
                  )}

                </Stack>
              )}

              {supportDialogTab === "activity" && (
                <Paper variant="outlined" sx={{ height: 320 }}>
                  <DataGrid
                    rows={[
                      { id: "created", action: "Created", actor: selected.submittedBy?.fullName || selected.submittedBy?.email || (selected.submissionSource === "anonymous_error" ? "Anonymous guest" : "Submitter"), date: selected.createdAt },
                      ...(selected.assignedTo ? [{ id: "assigned", action: "Assigned", actor: selected.assignedTo?.fullName || selected.assignedTo?.email, date: selected.updatedAt }] : []),
                      ...(selected.messages || []).map((message) => ({
                        id: message._id,
                        action: message.internal ? "Internal Comment" : "External Message",
                        actor: message.author?.fullName || message.author?.username || "User",
                        date: message.createdAt,
                      })),
                    ]}
                    columns={[
                      { field: "action", headerName: "Action", flex: 1 },
                      { field: "actor", headerName: "Actor", flex: 1 },
                      { field: "date", headerName: "Date", flex: 1, valueFormatter: (value) => moneyDate(gridValue(value)) },
                    ]}
                    columnVisibilityModel={{
                      actor: !is800OrLess,
                      date: !isMobile,
                    }}
                    pageSizeOptions={[5, 10]}
                    initialState={{ pagination: { paginationModel: { pageSize: 5 } } }}
                    disableRowSelectionOnClick
                  />
                </Paper>
              )}
            </Stack>
          ) : selected && tab === "incidents" ? (
            <Stack spacing={2.5}>
              <Box>
                <Typography variant="caption" color="text.secondary">Event number</Typography>
                <Typography variant="body1" fontWeight={700}>{selected.event?.shortCode || "-"}</Typography>
              </Box>

              <Box>
                <Typography variant="caption" color="text.secondary">Event time</Typography>
                <Typography variant="body1">
                  {moneyDate(selected.event?.startAt)} – {moneyDate(selected.event?.endAt)}
                </Typography>
              </Box>

              <Box>
                <Typography variant="caption" color="text.secondary">Event location</Typography>
                <Typography variant="body1">{eventLocation(selected.event)}</Typography>
              </Box>

              <Divider />

              <Box>
                <Typography variant="subtitle1" fontWeight={800}>Bartender</Typography>
                <Typography variant="body1">{selected.reportedBy?.fullName || selected.reportedBy?.username || "-"}</Typography>
                <Typography variant="body2"><strong>Email:</strong> {selected.reportedBy?.email || "-"}</Typography>
                <Typography variant="body2"><strong>Phone:</strong> {userPhone(selected.reportedBy)}</Typography>
              </Box>

              <Box>
                <Typography variant="subtitle1" fontWeight={800}>Event main contact</Typography>
                <Typography variant="body1">{selected.event?.contact?.fullName || "-"}</Typography>
                <Typography variant="body2"><strong>Email:</strong> {selected.event?.contact?.email || "-"}</Typography>
                <Typography variant="body2"><strong>Phone:</strong> {selected.event?.contact?.phone || "-"}</Typography>
              </Box>

              <Divider />

              <Box>
                <Typography variant="subtitle1" fontWeight={800}>Description of issue</Typography>
                <Typography variant="body1" sx={{ whiteSpace: "pre-wrap" }}>{selected.description || "-"}</Typography>
              </Box>

              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select label="Status" value={updateForm.status || selected.status} onChange={(e) => setUpdateForm((p) => ({ ...p, status: e.target.value }))}>
                  {["open", "reviewing", "resolved", "dismissed"].map((status) => (
                    <MenuItem key={status} value={status}>{formatLabel(status)}</MenuItem>
                  ))}
                </Select>
              </FormControl>

              <TextField
                fullWidth
                multiline
                minRows={4}
                label="Resolution"
                required={updateForm.status === "resolved"}
                value={updateForm.resolution || ""}
                onChange={(e) => setUpdateForm((p) => ({ ...p, resolution: e.target.value }))}
                helperText={updateForm.status === "resolved" ? "This resolution will be emailed to the bartender." : ""}
              />
            </Stack>
          ) : selected ? (
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Typography variant="subtitle2">Summary</Typography>
                <Typography variant="body2" color="text.secondary">
                  {selected.subject || selected.description || selected.event?.shortCode || "Attendance record"}
                </Typography>
              </Grid>
              {tab === "attendance" ? (
                <>
                  <Grid item xs={12}>
                    <FormControl fullWidth>
                      <InputLabel>Status</InputLabel>
                      <Select label="Status" value={updateForm.status || "present"} onChange={(e) => setUpdateForm((p) => ({ ...p, status: e.target.value }))}>
                        <MenuItem value="present">Present</MenuItem>
                        <MenuItem value="absent">Absent</MenuItem>
                        <MenuItem value="late">Late</MenuItem>
                        <MenuItem value="left_early">Left early</MenuItem>
                        <MenuItem value="disputed">Disputed</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12}>
                    <TextField fullWidth multiline minRows={3} label="Verification notes" value={updateForm.notes || ""} onChange={(e) => setUpdateForm((p) => ({ ...p, notes: e.target.value }))} />
                  </Grid>
                </>
              ) : (
                <>
                  <Grid item xs={12}>
                    <FormControl fullWidth>
                      <InputLabel>Status</InputLabel>
                      <Select label="Status" value={updateForm.status || selected.status} onChange={(e) => setUpdateForm((p) => ({ ...p, status: e.target.value }))}>
                        {(tab === "support"
                          ? ["open", "in_progress", "waiting_on_user", "resolved", "closed"]
                          : ["open", "reviewing", "resolved", "dismissed"]
                        ).map((status) => (
                          <MenuItem key={status} value={status}>{status}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12}>
                    <TextField fullWidth multiline minRows={3} label="Resolution" value={updateForm.resolution || ""} onChange={(e) => setUpdateForm((p) => ({ ...p, resolution: e.target.value }))} />
                  </Grid>
                </>
              )}
            </Grid>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelected(null)} sx={primaryButtonSx}>Close</Button>
          <Button
            variant="contained"
            sx={primaryContainedSx}
            onClick={tab === "attendance" ? verifyAttendance : tab === "support" ? updateTicket : updateIncident}
            disabled={
              tab === "incidents" &&
              updateForm.status === "resolved" &&
              !String(updateForm.resolution || "").trim()
            }
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={!!pendingSubmitterComment}
        onClose={() => setPendingSubmitterComment(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Send Comment To Submitter?</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2">
            This comment will be visible to the submitter and they will be notified. Are you sure you want to send it?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPendingSubmitterComment(null)} sx={primaryButtonSx}>
            No
          </Button>
          <Button
            variant="contained"
            sx={primaryContainedSx}
            onClick={() =>
              addTicketComment({
                text: pendingSubmitterComment.text,
                mentions: pendingSubmitterComment.mentions,
                sendToSubmitter: true,
              })
            }
          >
            Yes, Send
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default AdminOperations;
