import React from "react";
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography } from "@mui/material";

const DeleteConfirmPaymentDialog = ({ open, onClose, brand = "", last4 = "", onConfirm }) => {
  const resetAndClose = () => {
    onClose?.();
  };

  return (
    <Dialog open={open} onClose={resetAndClose} fullWidth maxWidth="xs">
      <DialogTitle>Confirm delete</DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" sx={{ mb: 2 }}>
          You’re deleting the {brand ? brand.toUpperCase() : "card"} ending in •••• {last4 || "—"}.
        </Typography>
        <Typography variant="body2" color="text.secondary">
          This removes the saved card from your account. Existing payment records are not affected.
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={resetAndClose}>Cancel</Button>
        <Button color="error" variant="contained" onClick={() => onConfirm?.()}>
          Delete
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default DeleteConfirmPaymentDialog;
