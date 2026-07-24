import React, { useEffect, useState } from "react";
import {
  Box,
  TextField,
  Button,
  Typography,
  Alert,
  IconButton,
  InputAdornment,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import { Visibility, VisibilityOff } from "@mui/icons-material";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import AuthLayout from "../../components/AuthLayout/AuthLayout";
import HelmetHeader from "../../components/HelmetHeader/Helmet";
import { loginUser } from "../../features/users/userSlice";
import { useDispatch, useSelector } from "react-redux";
import { navigateOrReload } from "../../utils/navigateOrReload";
import signInImage from '../../assets/images/undraw_sign-in_uva0.svg'

const LoginScreen = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const loggedInUser = useSelector((state) => state.users.loggedInUser);
  const loginStatus = useSelector((state) => state.users.loginStatus);
  const loginError = useSelector((state) => state.users.loginError);
  const [form, setForm] = useState({ emailOrUsername: "", password: "" });
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showInactivityMessage, setShowInactivityMessage] = useState(false);


  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setErrors({ ...errors, [e.target.name]: "" });
  };

  useEffect(() => {
    if (loginStatus === "succeeded" && loggedInUser) {
      const redirect = searchParams.get("redirect") || "/";
      navigateOrReload(navigate, redirect);
    }
  }, [loginStatus, loggedInUser, navigate, searchParams]);

  useEffect(() => {
    if (loginStatus === "failed" && loginError) {
      setMessage({ type: "error", text: loginError });
    }
  }, [loginStatus, loginError]);

  useEffect(() => {
    const wasInactive = localStorage.getItem("inactiveLogout") === "true";
    const authLogoutMessage = localStorage.getItem("authLogoutMessage");

    if (authLogoutMessage) {
      setMessage({ type: "warning", text: authLogoutMessage });
      localStorage.removeItem("authLogoutMessage");
    }

    if (wasInactive) {
      setShowInactivityMessage(true);
      localStorage.removeItem("inactiveLogout");
    }
  }, []);


  const handleSubmit = (e) => {
    e.preventDefault();
    const newErrors = {};
    if (!form.emailOrUsername) newErrors.emailOrUsername = "Email/Username is required";
    if (!form.password) newErrors.password = "Password is required";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setMessage({ type: "error", text: "Please fix the errors below." });
    } else {
      setErrors({});
      setMessage(null);
      localStorage.removeItem("inactiveLogout");
      if (showInactivityMessage) setShowInactivityMessage(false); // extra safety
      dispatch(loginUser(form)); // only dispatch when valid
    }
  };

  return (
    <AuthLayout message="Welcome back to Tipsyverse!" 
    image={signInImage} 
    position="left"
    circleMessage="Don't have an account?"
    buttonLabel="Sign Up"
    buttonLink="/register">
      <HelmetHeader
        title="Tipsyverse | Login"
        description="Log in to Tipsyverse to manage your cocktail activity, event bookings, bartender dashboard, support tickets, and account settings."
        keywords="Tipsyverse login, cocktail account login, bartender login, event booking login"
        noindex
      />
      {/* ✅ Modal for inactivity logout */}
      <Dialog open={showInactivityMessage} onClose={() => 
        {setShowInactivityMessage(false);
          localStorage.removeItem("inactiveLogout");
        }
        }>
        <DialogTitle>Session Expired</DialogTitle>
        <DialogContent>
          You were logged out due to inactivity. Please sign back in.
        </DialogContent>
        <DialogActions>
          <Button style={{color: 'var(--primary-color)'}} onClick={() => {
            setShowInactivityMessage(false);
            localStorage.removeItem("inactiveLogout");

            }} autoFocus>
            OK
          </Button>
        </DialogActions>
      </Dialog>
      <Box
    sx={{
      display: "flex",
      flexDirection: { xs: "column", md: "row" },
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
      width: "100%",
    }}
  >


      {/* Login Box */}
      <Box>
      <Typography variant="h5" fontWeight={600} gutterBottom>
        Login
      </Typography>
      {message && (
        <Alert severity={message.type} sx={{ mb: 2 }}>
          {message.text}
        </Alert>
      )}
      <Box component="form" onSubmit={handleSubmit} sx={{ width: "100%" }}>
        <TextField
          fullWidth
          label="Email or Username"
          name="emailOrUsername"
          margin="normal"
          value={form.emailOrUsername}
          onChange={handleChange}
          error={!!errors.emailOrUsername}
          helperText={errors.emailOrUsername}
        />
        <TextField
          fullWidth
          label="Password"
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
        <Box display="flex" justifyContent="space-between" mt={1} mb={2}>
          <Link
            to="/forgot-password"
            style={{ color: "var(--primary-color)", textDecoration: "none" }}
          >
            Forgot Password?
          </Link>
        </Box>
        <Button
          type="submit"
          fullWidth
          variant="contained"
          sx={{ backgroundColor: "var(--primary-color)" }}
        >
          Login
        </Button>
      </Box>
      <Typography sx={{ mt: 2 }}>
        Don’t have an account?{" "}
        <Link
          to="/register"
          style={{ color: "var(--primary-color)", textDecoration: "none" }}
        >
          Sign Up
        </Link>
      </Typography>
      </Box>
      </Box>

    </AuthLayout>
  );
};

export default LoginScreen;
