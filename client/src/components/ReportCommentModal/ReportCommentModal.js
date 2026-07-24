import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  RadioGroup,
  FormControlLabel,
  Radio,
  Button,
  Box,
} from "@mui/material";
import dayjs from "dayjs";

const reportReasons = [
  "Harassment or Bullying",
  "Hate Speech or Discrimination",
  "Sexually Explicit Content",
  "Violence or Threats",
  "Misinformation or False Information",
  "Spam or Irrelevant Advertising",
  "Offensive or Inappropriate Language",
];

const ReportCommentModal = ({
  open,
  onClose,
  commentId,
  commentContent,
  alreadyReported = null, // { dateReported, reason }
  onSubmit,
}) => {
  const [selectedReason, setSelectedReason] = useState("");

  useEffect(() => {
    if (!open) setSelectedReason("");
  }, [open]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Report Comment</DialogTitle>

      <DialogContent dividers>
        {alreadyReported ? (
          <Box mt={2}>
            <Typography variant="body1">
              You already reported this comment on{" "}
              <strong>{dayjs(alreadyReported.dateReported).format("MMMM D, YYYY")}</strong>{" "}
              for <strong>{alreadyReported.reason}</strong>.
            </Typography>

            <Typography variant="body2" color="text.secondary" mt={2}>
              We thank you and take this seriously.
            </Typography>
          </Box>
        ) : (
          <>
            <Typography variant="body1" sx={{ mb: 1 }}>
              What’s going on?
            </Typography>

            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              We’ll check for all Community Guidelines, so don’t worry about making the perfect choice. 
              This user will not be notified that you are reporting this comment.
            </Typography>

            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              The comment you're reporting is:
            </Typography>

            <Box
              sx={{
                mb: 2,
                px: 2,
                py: 1,
                borderLeft: "4px solid var(--primary-color)",
                backgroundColor: "#f9f9f9",
                borderRadius: 1,
              }}
            >
              <Typography variant="subtitle2" fontWeight="bold">
                {commentContent}
              </Typography>
            </Box>

            <RadioGroup
              value={selectedReason}
              onChange={(e) => setSelectedReason(e.target.value)}
            >
              {reportReasons.map((reason, index) => (
                <FormControlLabel
                  key={index}
                  value={reason}
                  control={<Radio />}
                  label={reason}
                />
              ))}
            </RadioGroup>
          </>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          sx={{ backgroundColor: "var(--primary-color)" }}
          disabled={!selectedReason || alreadyReported}
          onClick={() => onSubmit(selectedReason)}
        >
          Report
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ReportCommentModal;
