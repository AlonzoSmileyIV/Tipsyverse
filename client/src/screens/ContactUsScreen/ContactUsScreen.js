import React, { useState } from "react";
import {
  Box,
  Typography,
  Container,
  TextField,
  Button,
  Alert,
} from "@mui/material";
import HelmetHeader from "../../components/HelmetHeader/Helmet";
import PublicLayout from "../../components/PublicLayout/PublicLayout";
import api from "../../services/api";

const ContactUsScreen = () => {
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    message: "",
  });

  const [errors, setErrors] = useState({});
  const [sending, setSending] = useState(false);
  const [alert, setAlert] = useState({ type: "", message: "" });

  const validate = () => {
    const { name, phone, email, message } = formData;
    const newErrors = {};

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}$/; // US format

    if (!name.trim()) newErrors.name = "Name is required.";
    if (!phoneRegex.test(phone)) newErrors.phone = "Invalid phone number.";
    if (!emailRegex.test(email)) newErrors.email = "Invalid email address.";
    if (!message.trim()) newErrors.message = "Message is required.";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const sendEmail = async () => {
    try {
      const res = await api.post("/contact-us/contact", formData);
      return res.data; // <-- Return backend response
    } catch (err) {
      console.error("Email error:", err);
      return {
        success: false,
        message: "Failed to send message. Please try again later.",
      };
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setSending(true);
    const result = await sendEmail();
    setSending(false);

    setAlert({
      type: result.success ? "success" : "error",
      message: result.message,
    });
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  return (
    <PublicLayout>
      <HelmetHeader
        title="Tipsyverse | Contact Us for Events, Bartenders, and Support"
        description="Contact Tipsyverse for event bartending questions, customer support, bartender help, account assistance, partnerships, and platform support."
        keywords="contact Tipsyverse, event bartender support, bartending services, customer support, bartender help, Indianapolis bartenders"
      />
      <Container maxWidth="sm" sx={{ py: 6 }}>
        <Typography
          component="h1"
          variant="h3"
          gutterBottom
          textAlign="center"
          fontWeight={700}
        >
          Contact Us
        </Typography>

        <Typography
          variant="body1"
          textAlign="center"
          color="text.secondary"
          mb={4}
        >
          Got a question or just want to say hello? Drop us a line below.
        </Typography>

        {alert.message && (
          <Alert severity={alert.type} sx={{ mb: 3 }}>
            {alert.message}
          </Alert>
        )}

        <Box
          component="form"
          onSubmit={handleSubmit}
          sx={{ display: "flex", flexDirection: "column", gap: 3 }}
        >
          <TextField
            label="Name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
            error={!!errors.name}
            helperText={errors.name}
            fullWidth
          />
          <TextField
            label="Phone Number"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            required
            error={!!errors.phone}
            helperText={errors.phone}
            fullWidth
          />
          <TextField
            label="Email"
            name="email"
            type="email"
            value={formData.email}
            onChange={handleChange}
            required
            error={!!errors.email}
            helperText={errors.email}
            fullWidth
          />
          <TextField
            label="Message"
            name="message"
            multiline
            rows={4}
            value={formData.message}
            onChange={handleChange}
            required
            error={!!errors.message}
            helperText={errors.message}
            fullWidth
          />
          <Button
            type="submit"
            variant="contained"
            disabled={sending}
            sx={{ backgroundColor: "var(--primary-color)" }}
          >
            {sending ? "Sending..." : "Submit"}
          </Button>
        </Box>
      </Container>
    </PublicLayout>
  );
};

export default ContactUsScreen;
