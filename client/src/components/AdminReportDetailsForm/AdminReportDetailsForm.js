import {
  Avatar,
  Box,
  Button,
  Divider,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Select,
  MenuItem,
  IconButton,
} from "@mui/material";
import { Close as CloseIcon } from "@mui/icons-material";
import { DataGrid } from "@mui/x-data-grid";
import { useState } from "react";
import moment from "moment/moment";
import api from "../../services/api";

const AdminReportDetailsForm = ({ comment, onClose, onRefresh }) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [actionType, setActionType] = useState("dismiss");
  const [removalReason, setRemovalReason] = useState("");
  const [submitting, setSubmitting] = useState(false);


const handleAction = async () => {
  if (actionType === "remove" && !removalReason) return;

  try {
    setSubmitting(true);
    await api.post(`/comments/${comment._id}/reportAction`, {
      action: actionType,          // "dismiss" | "remove"
      reason: removalReason || "", // optional
    });

    // UI feedback (optional): toast/snackbar here

    onClose();
    await onRefresh?.(); // re-fetch the table
  } catch (err) {
    // optional: toast/snackbar error
    console.error("reportAction failed:", err);
  } finally {
    setSubmitting(false);
    setDialogOpen(false);
    setRemovalReason("");
    setActionType("dismiss");
  }
};

  const reasonsCount =
    comment?.analytics?.userReports?.reduce((acc, report) => {
      const reason = report.reason;
      if (reason) {
        acc[reason] = (acc[reason] || 0) + 1;
      }
      return acc;
    }, {}) || {};

  const reporterColumns = [
    {
      field: "photo",
      headerName: "Photo",
      width: 70,
      renderCell: (params) => (
        <Avatar
          src={params.row.user?.profile?.photo}
          alt={params.row.user?.fullName}
          sx={{ width: 32, height: 32 }}
        />
      ),
      sortable: false,
      filterable: false,
      cellClassName: "centerCell",
    },
    {
      field: "fullName",
      headerName: "Reporter",
      flex: 1,
      minWidth: 120,
      renderCell: (params) => params.row.user?.fullName || "Unknown",
    },
    {
      field: "reason",
      headerName: "Reason",
      flex: 1,
      minWidth: 150,
    },
    {
      field: "timestamp",
      headerName: "Date Reported",
      flex: 1,
      minWidth: 120,
      renderCell: (params) => (
        //new Date(params.row?.dateReported).toLocaleDateString(),
        <Typography>
          {moment(params.row?.dateReported).format("MM/DD/YY, hh:mm a")}
        </Typography>
      ),
      cellClassName: "centerCell",
    },
  ];

  return (
    <Box sx={{ width: "100%", p: 3 }}>
      <IconButton
        onClick={onClose}
        sx={{
          position: "absolute",
          top: 8,
          right: 8,
          zIndex: 1,
          color: "grey.600",
        }}
      >
        <CloseIcon />
      </IconButton>
      <Typography variant="h6">Investigating Comment</Typography>
      <Box sx={{ my: 2, display: "flex", gap: 2, alignItems: "center" }}>
        <Avatar src={comment.author?.profile?.photo} />
        <Typography>{comment.author?.fullName}</Typography>
      </Box>
      <Typography>
        <strong>Comment:</strong> {comment.content}
      </Typography>
      <Typography sx={{ mt: 2 }}>
        <strong>Total Reports:</strong> {comment.analytics?.counts?.reports}
      </Typography>

      <Box sx={{ mt: 2 }}>
        <Typography>
          <strong>Reason Breakdown:</strong>
        </Typography>
        {Object.entries(reasonsCount).map(([reason, count], index) => (
          <Typography
            key={`${reason}-${index}`}
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              mb: 0.5,
            }}
          >
            <span>{reason}:</span>
            <span>{count}</span>
          </Typography>
        ))}
      </Box>

      <Divider sx={{ my: 2 }} />
      <Typography variant="subtitle1">Reporters</Typography>
      <Box sx={{ maxHeight: 200, overflowY: "auto" }}>
        <DataGrid
          autoHeight
          rows={comment.analytics?.userReports || []}
          columns={reporterColumns}
          getRowId={(row, index) => `${row._id || "report"}-${index}`}
          pageSize={5}
          rowsPerPageOptions={[5, 10]}
          disableSelectionOnClick
          sx={{
            "& .MuiDataGrid-cell": {
              alignItems: "center",
            },

            "& .centerCell": {
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            },
          }}
        />
      </Box>

      <Box sx={{ mt: 3, display: "flex", justifyContent: "space-between" }}>
        <Button
          color="info"
          onClick={() => {
            setActionType("dismiss");
            setDialogOpen(true);
          }}
        >
          Dismiss Reports
        </Button>
        <Button
          color="error"
          onClick={() => {
            setActionType("remove");
            setDialogOpen(true);
          }}
        >
          Remove Comment
        </Button>
      </Box>

      {/* Confirm Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)}>
        <DialogTitle>
          {actionType === "remove" ? "Remove Comment" : "Dismiss Reports"}
        </DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to {actionType}?</Typography>
          {actionType === "remove" && (
            <Select
              fullWidth
              value={removalReason}
              onChange={(e) => setRemovalReason(e.target.value)}
              sx={{ mt: 2 }}
              displayEmpty
            >
              <MenuItem value="" disabled>
                Select removal reason
              </MenuItem>
              <MenuItem value="Harassment or Bullying">
                Harassment or Bullying
              </MenuItem>
              <MenuItem value="Hate Speech or Discrimination">
                Hate Speech or Discrimination
              </MenuItem>
              <MenuItem value="Sexually Explicit Content">
                Sexually Explicit Content
              </MenuItem>
              <MenuItem value="Violence or Threats">
                Violence or Threats
              </MenuItem>
              <MenuItem value="Misinformation or False Information">
                Misinformation or False Information
              </MenuItem>
              <MenuItem value="Spam or Irrelevant Advertising">
                Spam or Irrelevant Advertising
              </MenuItem>
              <MenuItem value="Offensive or Inappropriate Language">
                Offensive or Inappropriate Language
              </MenuItem>
              <MenuItem value="Other">Other</MenuItem>
            </Select>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleAction}
            disabled={submitting || (actionType === "remove" && !removalReason)}
            loading={submitting}
            variant="contained"
            color={actionType === "remove" ? "error" : "primary"}
          >
            Proceed to {actionType}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AdminReportDetailsForm;
