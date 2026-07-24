import { Close as CloseIcon } from "@mui/icons-material";
import { Alert, Collapse, IconButton } from "@mui/material";


export const CollapseAlert = ({ open, severity, message, onClose, children }) => (
  <Collapse in={open}>
    <Alert
      severity={severity}
      sx={{ mb: 2 }}
      action={
        <IconButton
          aria-label="close"
          size="small"
          onClick={onClose}
        >
          <CloseIcon fontSize="inherit" />
        </IconButton>
      }
    >
      {message}
      {children}
    </Alert>
  </Collapse>
);
