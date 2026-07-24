import React, { useMemo, useState } from "react";
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Typography } from "@mui/material";

const DeleteConfirmPaymentDialog = ({ open, onClose, brand = "", last4 = "", onConfirm }) => {
  const [cvv, setCvv] = useState("");
  const needLen = useMemo(() => (brand === "amex" ? 4 : 3), [brand]);
  const valid = cvv.replace(/\D+/g, "").length === needLen;

  const resetAndClose = () => {
    setCvv("");
    onClose?.();
  };

  return (
    <Dialog open={open} onClose={resetAndClose} fullWidth maxWidth="xs">
      <DialogTitle>Confirm delete</DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" sx={{ mb: 2 }}>
          You’re deleting the {brand ? brand.toUpperCase() : "card"} ending in •••• {last4 || "—"}.
        </Typography>
        <TextField
          label={`Enter CVV (${needLen} digits)`}
          fullWidth
          value={cvv}
          onChange={(e) => setCvv(e.target.value.replace(/\D+/g, "").slice(0, 4))}
          inputMode="numeric"
          placeholder={needLen === 4 ? "1234" : "123"}
          helperText={cvv.length === 0 ? " " : valid ? " " : "CVV length doesn’t match"}
          error={cvv.length > 0 && !valid}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={resetAndClose}>Cancel</Button>
        <Button color="error" variant="contained" disabled={!valid} onClick={() => onConfirm?.(cvv)}>
          Delete
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default DeleteConfirmPaymentDialog;
