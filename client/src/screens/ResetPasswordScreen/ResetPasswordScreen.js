import api from '../../services/api'; // ✅ make sure this is at the top
import React, { useState } from 'react';
// import { useParams } from 'react-router-dom';
import {
  Box,
  TextField,
  Button,
  Typography,
  Alert,
  InputAdornment,
  IconButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import { Visibility, VisibilityOff, CheckCircleOutline } from '@mui/icons-material';
import { green } from '@mui/material/colors';
import AuthLayout from '../../components/AuthLayout/AuthLayout';
import HelmetHeader from '../../components/HelmetHeader/Helmet';
import { useNavigate, useParams } from 'react-router-dom';
import { navigateOrReload } from '../../utils/navigateOrReload';
import resetPasswordImage from '../../assets/images/undraw_my-password_iyga.svg';

const ResetPasswordScreen = ({ activation = false }) => {
  const navigate = useNavigate();
  const { token } = useParams();
  const [form, setForm] = useState({ password: '', confirmPassword: '' });
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const passwordCriteria = {
    length: (value) => value.length >= 6,
    uppercase: (value) => /[A-Z]/.test(value),
    number: (value) => /[0-9]/.test(value),
    special: (value) => /[!@#$%^&*(),.?":{}|<>]/.test(value),
    match: () => form.password === form.confirmPassword && form.confirmPassword.length > 0,
  };

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setErrors({ ...errors, [e.target.name]: '' });
  };

  // const handleSubmit = (e) => {
  //   e.preventDefault();
  //   const newErrors = {};
  //   const invalidCriteria = Object.entries(passwordCriteria).filter(
  //     ([key, test]) => key !== 'match' && !test(form.password)
  //   );
  //   if (!form.password) newErrors.password = 'Password is required';
  //   else if (invalidCriteria.length > 0)
  //     newErrors.password = 'Password does not meet all requirements';

  //   if (form.password !== form.confirmPassword)
  //     newErrors.confirmPassword = 'Passwords do not match';

  //   if (Object.keys(newErrors).length > 0) {
  //     setErrors(newErrors);
  //     setMessage({ type: 'error', text: 'Please fix the errors below.' });
  //   } else {
  //     setMessage({ type: 'success', text: 'Password reset successful!' });
  //     // Submit password reset with token
  //   }
  // };

  const handleSubmit = async (e) => {
  e.preventDefault();
  setLoading(true);
  const newErrors = {};
  const invalidCriteria = Object.entries(passwordCriteria).filter(
    ([key, test]) => key !== 'match' && !test(form.password)
  );
  if (!form.password) newErrors.password = 'Password is required';
  else if (invalidCriteria.length > 0)
    newErrors.password = 'Password does not meet all requirements';

  if (form.password !== form.confirmPassword)
    newErrors.confirmPassword = 'Passwords do not match';

  if (Object.keys(newErrors).length > 0) {
    setErrors(newErrors);
    setMessage({ type: 'error', text: 'Please fix the errors below.' });
    setLoading(false);
    return;
  }

  try {
    const res = await api.post(
      activation ? "/users/activate-account" : "/users/reset-password",
      activation
        ? { activationToken: token, newPassword: form.password }
        : { resetToken: token, newPassword: form.password }
    );

    setMessage({ type: 'success', text: res.data.message || 'Password reset successful!' });
    setForm({ password: '', confirmPassword: '' });

      // ⏳ Redirect after 5 seconds
  setTimeout(() => {
    navigateOrReload(navigate, '/login');
  }, 5000);

  } catch (err) {
    setMessage({
      type: 'error',
      text:
        err.response?.data?.message ||
        (activation ? "Failed to activate account." : "Failed to reset password."),
    });
    setLoading(false);
  }
};
  const passwordChecks = Object.entries(passwordCriteria).map(([key, check]) => ({
    label: {
      length: 'At least 6 characters',
      uppercase: 'One uppercase letter',
      number: 'One number',
      special: 'One special character',
      match: 'Matches confirm password',
    }[key],
    valid: check(form.password),
  }));

  return (
    <AuthLayout 
    message={
      activation
        ? "Create your password to activate your account."
        : "Set a new password for your account."
    }
    image={resetPasswordImage}
    circleMessage='Remember your password?'
    buttonLabel='Login'
    buttonLink='/login'
    >
            <HelmetHeader
              title={`Tipsyverse | ${activation ? "Activate Account" : "Reset Password"}`}
              description={
                activation
                  ? "Activate your Tipsyverse account by creating a secure password."
                  : "Set a new secure password for your Tipsyverse account."
              }
              keywords="Tipsyverse reset password, secure password reset, account recovery"
              noindex
            />

      <Typography variant="h5" fontWeight={600} gutterBottom>
        {activation ? "Activate Account" : "Reset Password"}
      </Typography>

      {message && <Alert severity={message.type} sx={{ mb: 2 }}>{message.text}</Alert>}

      <Box component="form" onSubmit={handleSubmit} sx={{ width: '100%' }}>
        <TextField
          fullWidth
          label="New Password"
          name="password"
          type={showPassword ? 'text' : 'password'}
          margin="normal"
          value={form.password}
          onChange={handleChange}
          error={!!errors.password}
          helperText={errors.password}
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <IconButton onClick={() => setShowPassword(!showPassword)} edge="end">
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
          type={showConfirmPassword ? 'text' : 'password'}
          margin="normal"
          value={form.confirmPassword}
          onChange={handleChange}
          error={!!errors.confirmPassword}
          helperText={errors.confirmPassword}
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <IconButton onClick={() => setShowConfirmPassword(!showConfirmPassword)} edge="end">
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
                <CheckCircleOutline sx={{ color: valid ? green[500] : 'grey.500' }} />
              </ListItemIcon>
              <ListItemText primary={label} />
            </ListItem>
          ))}
        </List>
       
        <Button type="submit" fullWidth loading={loading} variant="contained" color="primary" sx={{ mt: 1, backgroundColor: 'var(--primary-color)' }}>
          {activation ? "Activate Account" : "Reset Password"}
        </Button>
      </Box>
    </AuthLayout>
  );
};

export default ResetPasswordScreen;
