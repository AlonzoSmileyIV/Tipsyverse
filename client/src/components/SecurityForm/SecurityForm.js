import {
  CheckCircleOutline,
  Visibility,
  VisibilityOff,
} from "@mui/icons-material";
import {
  Box,
  Button,
  IconButton,
  InputAdornment,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  TextField,
  Typography,
} from "@mui/material";
import { green } from "@mui/material/colors";
import React, { useState } from "react";
import api from "../../services/api";
import { handleUpdateUser } from "../../utils/handleUpdateUser";
import { useDispatch } from "react-redux";
import { CollapseAlert } from "../CollapseAlert/CollapseAlert";
//const { token } = useParams();

const SecurityForm = ({ user }) => {
  const dispatch = useDispatch();

  const [form, setForm] = useState({ password: "", confirmPassword: "" });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [alert, setAlert] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const passwordCriteria = {
    length: (value) => value.length >= 6,
    uppercase: (value) => /[A-Z]/.test(value),
    number: (value) => /[0-9]/.test(value),
    special: (value) => /[!@#$%^&*(),.?":{}|<>]/.test(value),
    match: () =>
      form.password === form.confirmPassword && form.confirmPassword.length > 0,
  };

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setErrors({ ...errors, [e.target.name]: "" });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setAlert(null);

    const newErrors = {};
    const invalidCriteria = Object.entries(passwordCriteria).filter(
      ([key, test]) => key !== "match" && !test(form.password)
    );
    if (!form.password) newErrors.password = "Password is required";
    else if (invalidCriteria.length > 0)
      newErrors.password = "Password does not meet all requirements";

    if (form.password !== form.confirmPassword)
      newErrors.confirmPassword = "Passwords do not match";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setAlert({ severity: "error", text: "Please fix the errors below." });
      setLoading(false);
      return;
    }

    try {
      const res = await api.put("/users/update-password", {
        newPassword: form.password,
      });

      setAlert({ severity: "success", text: res?.data?.message });
      setForm({ password: "", confirmPassword: "" });
      setErrors({});

      // 🔄 Update Redux store with refreshed user info
      await handleUpdateUser(dispatch);
    } catch (err) {
      setAlert({
        severity: "error",
        text:
          err?.response?.data?.message ||
          "An error occurred. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  const passwordChecks = Object.entries(passwordCriteria).map(
    ([key, check]) => ({
      label: {
        length: "At least 6 characters",
        uppercase: "One uppercase letter",
        number: "One number",
        special: "One special character",
        match: "Matches confirm password",
      }[key],
      valid: check(form.password),
    })
  );
  return (
    <Box>
      <Typography variant="h6">Security</Typography>
      <Typography variant="body2" color="text.secondary">
        Update your password. Minimum of 6 characters, one capital letter, one
        number, and one special character.
      </Typography>
      {alert && (
        <CollapseAlert
          open={!!alert}
          severity={alert.severity}
          message={alert.text}
          onClose={() => setAlert(null)}
        />
      )}

      <Box component="form" onSubmit={handleSubmit} sx={{ width: "100%" }}>
        <TextField
          fullWidth
          label="New Password"
          name="password"
          type={showPassword ? "text" : "password"}
          margin="normal"
          value={form.password}
          onChange={handleChange}
          error={!!errors.password}
          helperText={errors.password}
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  onClick={() => setShowPassword(!showPassword)}
                  edge="end"
                >
                  {showPassword ? <VisibilityOff /> : <Visibility />}
                </IconButton>
              </InputAdornment>
            ),
          }}
        />
        <TextField
          fullWidth
          label="Confirm New Password"
          name="confirmPassword"
          type={showConfirmPassword ? "text" : "password"}
          margin="normal"
          value={form.confirmPassword}
          onChange={handleChange}
          error={!!errors.confirmPassword}
          helperText={errors.confirmPassword}
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  edge="end"
                >
                  {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                </IconButton>
              </InputAdornment>
            ),
          }}
        />
        <List dense sx={{ mb: 2 }}>
          {passwordChecks.map(({ label, valid }, index) => (
            <ListItem key={index} disableGutters>
              <ListItemIcon>
                <CheckCircleOutline
                  sx={{ color: valid ? green[500] : "grey.500" }}
                />
              </ListItemIcon>
              <ListItemText primary={label} />
            </ListItem>
          ))}
        </List>

        <Button
          type="submit"
          disabled={loading}
          loading={loading}
          fullWidth
          variant="contained"
          color="primary"
          sx={{ mt: 1, backgroundColor: "var(--primary-color)" }}
        >
          Update Password
        </Button>
      </Box>
    </Box>
  );
};

export default SecurityForm;
