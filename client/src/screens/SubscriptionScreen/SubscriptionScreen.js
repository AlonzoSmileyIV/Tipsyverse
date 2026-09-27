import React, { useEffect, useState } from "react";
import { Alert, Box, Button, CircularProgress, Paper, Stack, Typography } from "@mui/material";
import LockOpenRoundedIcon from "@mui/icons-material/LockOpenRounded";
import { useDispatch, useSelector } from "react-redux";
import { useLocation, useNavigate } from "react-router-dom";
import PublicLayout from "../../components/PublicLayout/PublicLayout";
import api from "../../services/api";
import { fetchMe } from "../../features/users/userSlice";

export default function SubscriptionScreen() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const loggedInUser = useSelector((state) => state.users.loggedInUser);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const user = loggedInUser?.user;
  const active = user?.subscription?.status === "active";
  const checkout = new URLSearchParams(location.search).get("checkout");

  useEffect(() => {
    if (checkout === "success" && loggedInUser) dispatch(fetchMe());
  }, [checkout, dispatch, loggedInUser]);

  const openBilling = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await api.post("/payments/stripe/tipsyverse-plus-portal");
      if (!response.data?.url) throw new Error("Billing portal URL missing.");
      window.location.assign(response.data.url);
    } catch (err) {
      setError(err.response?.data?.message || "Could not open subscription management.");
      setLoading(false);
    }
  };

  const subscribe = async () => {
    if (!loggedInUser) {
      navigate("/login?redirect=%2Fsubscription");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await api.post("/payments/stripe/tipsyverse-plus-checkout");
      if (!response.data?.url) throw new Error("Checkout URL missing.");
      window.location.assign(response.data.url);
    } catch (err) {
      setError(err.response?.data?.message || "Could not start checkout. Please try again.");
      setLoading(false);
    }
  };

  return (
    <PublicLayout>
      <Box sx={{ minHeight: "65vh", display: "grid", placeItems: "center", px: 2, py: 7 }}>
        <Paper elevation={0} sx={{ width: "100%", maxWidth: 620, p: { xs: 3, sm: 5 }, border: "1px solid", borderColor: "divider", borderRadius: 4 }}>
          <Stack spacing={2.5} alignItems="center" textAlign="center">
            <LockOpenRoundedIcon sx={{ fontSize: 64 }} />
            <Typography variant="overline" fontWeight={800}>TIPSYVERSE+</Typography>
            <Typography variant="h3" fontWeight={900}>Unlock the Originals</Typography>
            <Typography color="text.secondary">
              Get full access to locked Tipsyverse Original recipes, including exact measurements and step-by-step instructions.
            </Typography>
            <Typography variant="h4" fontWeight={900}>$5/month</Typography>
            {checkout === "success" && <Alert severity="success" sx={{ width: "100%" }}>Payment received. Your access will appear as soon as Stripe confirms the subscription.</Alert>}
            {checkout === "canceled" && <Alert severity="info" sx={{ width: "100%" }}>Checkout was canceled. You were not subscribed.</Alert>}
            {error && <Alert severity="error" sx={{ width: "100%" }}>{error}</Alert>}
            <Button variant="contained" size="large" fullWidth disabled={loading} onClick={active ? openBilling : subscribe} sx={{ bgcolor: "var(--primary-color)" }}>
              {loading ? <CircularProgress size={24} color="inherit" /> : active ? "Manage Tipsyverse+" : "Subscribe for $5/month"}
            </Button>
            <Typography variant="caption" color="text.secondary">Cancel anytime through subscription management.</Typography>
          </Stack>
        </Paper>
      </Box>
    </PublicLayout>
  );
}
