import React, { useState } from "react";
import { Box, TextField, Button, Typography, Alert } from "@mui/material";
import AuthLayout from "../../components/AuthLayout/AuthLayout";
import HelmetHeader from "../../components/HelmetHeader/Helmet";
import { Link } from "react-router-dom";
import forgotPasswordImage from '../../assets/images/undraw_forgot-password_odai.svg';
import api from "../../services/api"; // ✅ Add your axios instance


const ForgotPasswordScreen = () => {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState(null);

 const handleSubmit = async (e) => {
    e.preventDefault();

    if (!email) {
      setError("Email is required");
      setMessage({ type: "error", text: "Please enter your email address." });
      return;
    }

    try {
      setError("");
      const res = await api.post("/users/forgot-password", { email });

      setMessage({
        type: "success",
        text: res.data?.message || "If your email exists, a reset link was sent.",
      });
    } catch (err) {
      setMessage({
        type: "error",
        text: err.response?.data?.message || "Something went wrong. Please try again.",
      });
    }
  };

  return (
    <AuthLayout message="Need help accessing your account?"
    circleMessage="Remember now?"
    image={forgotPasswordImage}
    buttonLabel="Login"
    buttonLink="/login">
      <HelmetHeader
        title="Tipsyverse | Forgot Password"
        description="Request a secure password reset link for your Tipsyverse account."
        keywords="Tipsyverse forgot password, password reset, account recovery"
        noindex
      />
      <Typography component="h1" variant="h5" fontWeight={600} gutterBottom>
        Forgot Password
      </Typography>

      {message && (
        <Alert severity={message.type} sx={{ mb: 2 }}>
          {message.text}
        </Alert>
      )}

      <Box component="form" onSubmit={handleSubmit} sx={{ width: "100%" }}>
        <TextField
          fullWidth
          label="Email"
          type="email"
          margin="normal"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={!!error}
          helperText={error}
        />
       
        <Button
          type="submit"
          fullWidth
          variant="contained"
          color="primary"
          sx={{ mt: 2, backgroundColor: "var(--primary-color)" }}
        >
          Send Reset Password Link
        </Button>

         <Typography sx={{ mt: 2 }}>
        Remember now?{' '}
        <Link to="/login" underline="always">
          Login
        </Link>
      </Typography>
      </Box>
    </AuthLayout>
  );
};

export default ForgotPasswordScreen;
