// screens/BookEventScreen.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector, shallowEqual } from "react-redux";
import PublicLayout from "../../components/PublicLayout/PublicLayout";
import HelmetHeader from "../../components/HelmetHeader/Helmet";
import BookEventForm from "../../components/BookEventForm/BookEventForm";
import api from "../../services/api";
import {
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Typography,
} from "@mui/material";
import emailSentImg from "../../assets/images/undraw_mail-sent_ujev.svg";

// CRA-style env var (adjust if you use Vite)
const GOOGLE_PLACES_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY || "";

const BookEventScreen = () => {
  const navigate = useNavigate();
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Pull a stable snapshot of logged-in user (avoid rerender churn)
  const user = useSelector((s) => s.users.loggedInUser?.user, shallowEqual);

  const handleSubmit = async (payload) => {
    try {
      setErrorMsg("");
      await api.post("/events", payload);
      setSubmitted(true);
    } catch (err) {
      setErrorMsg(err?.response?.data?.message || "Failed to submit request.");
    }
  };

  const handleCancel = () => navigate(-1);

  return (
    <PublicLayout>
      <HelmetHeader
        title="Tipsyverse | Book an Event"
        description="Tell us the basics about your event and we’ll follow up to confirm details."
        keywords="event bartender booking, mobile bartending, tipsyverse events"
      />

      {submitted ? (
        <Box sx={{ maxWidth: 800, mx: "auto", py: { xs: 3, md: 5 } }}>
          <Card sx={{ borderRadius: 3, textAlign: "center", p: 2 }}>
            <Box sx={{ mb: 2 }}>
              <img
                src={emailSentImg}
                alt="Email sent"
                style={{ width: 200, height: 200, maxWidth: "100%" }}
              />
            </Box>

            <CardHeader
              title={
                <Typography variant="h5" fontWeight={800}>
                  Request received 🎉
                </Typography>
              }
              subheader="Thank you for submitting your request. We’ve emailed you a confirmation. A coordinator will reach out shortly."
            />
            <CardContent>
              <Box sx={{ display: "flex", gap: 1.5, justifyContent: "center" }}>
                <Button
                  variant="contained"
                  onClick={() => navigate("/")}
                  sx={{ backgroundColor: "var(--primary-color)" }}
                >
                  Back to Home
                </Button>
                {user ? (
                  <Button
                    variant="outlined"
                    onClick={() => navigate("/my-events")}
                  >
                    View My Requests
                  </Button>
                ) : (
                  <Button
                    variant="outlined"
                    onClick={() => navigate("/register")}
                  >
                    Create an account
                  </Button>
                )}
              </Box>
            </CardContent>
          </Card>
        </Box>
      ) : (
        <BookEventForm
          googlePlacesApiKey={GOOGLE_PLACES_API_KEY}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
        />
      )}

      {errorMsg && (
        <Box sx={{ color: "error.main", textAlign: "center", mt: 2 }}>
          {errorMsg}
        </Box>
      )}
    </PublicLayout>
  );
};

export default BookEventScreen;
