import React, { useEffect, useState } from "react";
import {
  Box,
  TextField,
  Button,
  Typography,
  Alert,
  Checkbox,
  FormControlLabel,
  InputAdornment,
  IconButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Link,
} from "@mui/material";
import {
  Visibility,
  VisibilityOff,
  CheckCircleOutline,
} from "@mui/icons-material";
import AuthLayout from "../../components/AuthLayout/AuthLayout";
import { green } from "@mui/material/colors";
import registrationImage from "../../assets/images/undraw_sign-up_z2ku.svg";
import HelmetHeader from "../../components/HelmetHeader/Helmet";
import api from "../../services/api";
import { isAtLeastAge } from "../../utils/dateOnly";
import { useNavigate } from "react-router-dom";
import DateTextField from "../../components/DateTextField/DateTextField";

const passwordCriteria = {
  length: (value) => value.length >= 6,
  uppercase: (value) => /[A-Z]/.test(value),
  number: (value) => /[0-9]/.test(value),
  special: (value) => /[!@#$%^&*(),.?":{}|<>]/.test(value),
};

const initialForm = {
  name: "",
  email: "",
  username: "", // ✅ mandatory now
  dob: "",
  password: "",
  agree: false,
};

const formatDobInput = (value = "") => {
  const digits = value.replace(/\D/g, "").slice(0, 8);

  if (digits.length <= 2) return digits;
  if (digits.length <= 4) {
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  }

  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
};

const dobToIso = (value = "") => {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);

  if (!match) return "";

  const [, month, day, year] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));

  const isValid =
    date.getFullYear() === Number(year) &&
    date.getMonth() === Number(month) - 1 &&
    date.getDate() === Number(day);

  return isValid ? `${year}-${month}-${day}` : "";
};

const RegistrationScreen = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState(null); // { type, text, recommended? }
  const [showPassword, setShowPassword] = useState(false);
  const [redirectCountdown, setRedirectCountdown] = useState(null);

  useEffect(() => {
    if (redirectCountdown == null) return undefined;

    if (redirectCountdown <= 0) {
      navigate("/login", { replace: true });
      return undefined;
    }

    const timer = setTimeout(() => {
      setRedirectCountdown((seconds) =>
        typeof seconds === "number" ? seconds - 1 : seconds
      );
    }, 1000);

    return () => clearTimeout(timer);
  }, [redirectCountdown, navigate]);

  const handleChange = (e) => {
    const { name, value, checked, type } = e.target;
    setForm({ ...form, [name]: type === "checkbox" ? checked : value });
    setErrors({ ...errors, [name]: "" });
  };

  const isOver21 = (dob) => {
    const isoDob = dobToIso(dob);
    return isoDob ? isAtLeastAge(isoDob, 21) : false;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const newErrors = {};
    if (!form.name) newErrors.name = "Name is required";
    if (!form.email) newErrors.email = "Email is required";
    if (!form.username) newErrors.username = "Username is required"; // ✅ mandatory check
    if (!form.dob) {
      newErrors.dob = "Date of birth is required";
    } else if (!dobToIso(form.dob)) {
      newErrors.dob = "Enter a valid date using MM/DD/YYYY";
    } else if (!isOver21(form.dob)) {
      newErrors.dob = "You must be at least 21 years old";
    } else if (!isOver21(form.dob)) newErrors.dob = "You must be over 21";
    if (!form.password) newErrors.password = "Password is required";
    if (!form.agree) newErrors.agree = "You must agree to terms and policy";

    const invalidCriteria = Object.entries(passwordCriteria).filter(
      ([key, test]) => !test(form.password)
    );
    if (invalidCriteria.length > 0)
      newErrors.password = "Password does not meet all requirements";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setMessage({ type: "error", text: "Please fix the errors below." });
      setRedirectCountdown(null);
      return;
    }

    // Prepare payload to match backend expectations
    const payload = {
      fullName: form.name,
      email: form.email,
      username: form.username.trim(), // ✅ required now
      password: form.password,
      birthday: form.dob,
      role: "regular",
    };

    try {
      const res = await api.post("/users/register", payload);
      setMessage({ type: "success", text: res.data.message, recommended: [] });
      setRedirectCountdown(10);
      setForm(initialForm);
    } catch (err) {
      setRedirectCountdown(null);
      const msg =
        err?.response?.data?.message || "Something went wrong. Try again.";
      const recommended = err?.response?.data?.recommended || [];
      if (/username/i.test(msg)) {
        setErrors((prev) => ({ ...prev, username: msg }));
      }
      setMessage({ type: "error", text: msg, recommended });
    }
  };

  const passwordChecks = Object.entries(passwordCriteria).map(
    ([key, check]) => ({
      label: {
        length: "At least 6 characters",
        uppercase: "One uppercase letter",
        number: "One number",
        special: "One special character",
      }[key],
      valid: check(form.password),
    })
  );

  return (
    <AuthLayout
      message="Join the Tipsyverse community!"
      position="right"
      image={registrationImage}
      circleMessage="Already have an account?"
      buttonLabel="Login"
      buttonLink="/login"
    >
      <HelmetHeader
        title="Tipsyverse | Create an Account"
        description="Create a Tipsyverse account to save cocktail recipes, book bartending events, submit support tickets, and apply for bartender opportunities."
        keywords="Tipsyverse registration, create account, cocktail account, book bartenders, bartender signup"
      />
      <Typography variant="h5" fontWeight={600} gutterBottom>
        Register
      </Typography>

      {message && (
        <Alert severity={message.type} sx={{ mb: 2 }}>
          <Typography
            component="div"
            sx={{ mb: message?.recommended?.length ? 1 : 0 }}
          >
            {message.text}
            {message.type === "success" &&
              typeof redirectCountdown === "number" && (
                <Typography component="span" display="block" sx={{ mt: 0.5 }}>
                  Redirecting to login in {redirectCountdown} second
                  {redirectCountdown === 1 ? "" : "s"}.
                </Typography>
              )}
          </Typography>
          {Array.isArray(message.recommended) &&
            message.recommended.length > 0 && (
              <>
                <Typography
                  component="div"
                  sx={{ mb: message?.recommended?.length ? 1 : 0 }}
                >
                  Perhaps use one of the following usernames:
                </Typography>
                <Box component="ul" sx={{ pl: 3, m: 0 }}>
                  {message.recommended.map((u) => {
                    return (
                      <li key={u.toLowerCase()}>
                        <Button
                          variant="text"
                          size="small"
                          onClick={() => {
                            setForm((f) => ({
                              ...f,
                              username: u.toLowerCase(),
                            }));
                            setErrors((e) => ({ ...e, username: "" }));
                          }}
                        >
                          {u.toLowerCase()}
                        </Button>
                      </li>
                    );
                  })}
                </Box>
              </>
            )}
        </Alert>
      )}

      <Box component="form" onSubmit={handleSubmit} sx={{ width: "100%" }}>
        <TextField
          fullWidth
          label="Name"
          name="name"
          margin="normal"
          value={form.name}
          onChange={handleChange}
          error={!!errors.name}
          helperText={errors.name}
        />
        <TextField
          fullWidth
          label="Email"
          name="email"
          type="email"
          margin="normal"
          value={form.email}
          onChange={handleChange}
          error={!!errors.email}
          helperText={errors.email}
        />

        {/* ✅ Username required */}
        <TextField
          fullWidth
          label="Username"
          name="username"
          margin="normal"
          value={form.username}
          onChange={handleChange}
          error={!!errors.username}
          helperText={errors.username}
        />

        <DateTextField
          fullWidth
          label="Date of Birth"
          name="dob"
          margin="normal"
          value={form.dob}
          onChange={(e) => {
            const formattedDob = formatDobInput(e.target.value);

            setForm((prev) => ({
              ...prev,
              dob: formattedDob,
            }));

            setErrors((prev) => ({
              ...prev,
              dob: "",
            }));
          }}
          error={!!errors.dob}
          helperText={errors.dob || "Use MM/DD/YYYY, like 07/02/1998."}
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
        <FormControlLabel
          control={
            <Checkbox
              checked={form.agree}
              name="agree"
              onChange={handleChange}
            />
          }
          label={
            <Typography variant="body2">
              I agree to the{" "}
              <Link
                href="/terms-conditions"
                target="_blank"
                sx={{ color: "var(--primary-color)" }}
              >
                Terms
              </Link>{" "}
              and{" "}
              <Link
                href="/privacy"
                target="_blank"
                sx={{ color: "var(--primary-color)" }}
              >
                Privacy Policy
              </Link>
            </Typography>
          }
        />
        {errors.agree && (
          <Typography color="error" variant="caption">
            {errors.agree}
          </Typography>
        )}
        <Typography sx={{ mt: 2 }}>
          Already have an account?{" "}
          <Link
            href="/login"
            underline="hover"
            sx={{ color: "var(--primary-color)" }}
          >
            Login
          </Link>
        </Typography>
        <Button
          type="submit"
          fullWidth
          variant="contained"
          sx={{ mt: 2, backgroundColor: "var(--primary-color)" }}
        >
          Register
        </Button>
      </Box>
    </AuthLayout>
  );
};

export default RegistrationScreen;
