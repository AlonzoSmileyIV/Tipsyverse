import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
} from "@mui/material";

const InactivityModal = ({ open, onStayLoggedIn, countdown }) => {
  return (
    <Dialog open={open} maxWidth="xs" fullWidth>
      <DialogTitle>Still there?</DialogTitle>
      <DialogContent>
        <Typography>
  You've been inactive for a while. You will be logged out in{" "}
  <strong>
    {Math.floor(countdown / 60)} minute{Math.floor(countdown / 60) !== 1 ? "s" : ""}{" "}
    {countdown % 60} second{countdown % 60 !== 1 ? "s" : ""}
  </strong>.
</Typography>
      </DialogContent>
      <DialogActions>
        <Button variant="contained"
        style={{backgroundColor: 'var(--primary-color)'}} onClick={onStayLoggedIn}>
          Stay Logged In
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default InactivityModal;
