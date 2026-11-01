import { useEffect, useState } from "react";
import { Alert, Box, Button, CircularProgress, Paper, Typography } from "@mui/material";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { useParams, useSearchParams } from "react-router-dom";
import api from "../../services/api";

const stripeEnabled =
  String(process.env.REACT_APP_STRIPE_ENABLED).toLowerCase() === "true";
const stripePromise =
  stripeEnabled && process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY
    ? loadStripe(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY)
    : null;

function Checkout({ request }) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    setError("");
    const result = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: window.location.href },
    });
    if (result.error) setError(result.error.message || "Payment could not be completed.");
    setSubmitting(false);
  };

  return (
    <Box component="form" onSubmit={submit}>
      <Typography variant="h5" gutterBottom>
        Pay {Number(request.amountRequested).toLocaleString("en-US", {
          style: "currency",
          currency: "USD",
        })}
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Event {request.event?.shortCode || ""}
      </Typography>
      <PaymentElement />
      {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
      <Button
        fullWidth
        type="submit"
        variant="contained"
        disabled={!stripe || submitting}
        sx={{ mt: 3 }}
      >
        {submitting ? "Processing…" : "Pay securely"}
      </Button>
    </Box>
  );
}

export default function PaymentRequestScreen() {
  const { paymentRequestId } = useParams();
  const [searchParams] = useSearchParams();
  const checkoutResult = searchParams.get("checkout");
  const [request, setRequest] = useState(null);
  const [clientSecret, setClientSecret] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!stripeEnabled) return undefined;

    let active = true;
    const requests = [api.get(`/payment-requests/${paymentRequestId}`)];
    if (!checkoutResult) {
      requests.push(api.post("/payments/stripe/payment-intent", { paymentRequestId }));
    }
    Promise.all(requests)
      .then(([requestResponse, intentResponse]) => {
        if (!active) return;
        setRequest(requestResponse.data?.data);
        setClientSecret(intentResponse?.data?.clientSecret || "");
      })
      .catch((err) => {
        if (active) setError(err.response?.data?.message || "This payment request is unavailable.");
      });
    return () => {
      active = false;
    };
  }, [checkoutResult, paymentRequestId]);

  if (!stripeEnabled) {
    return (
      <Box sx={{ maxWidth: 620, mx: "auto", px: 2, py: 8 }}>
        <Paper elevation={2} sx={{ p: { xs: 3, md: 5 } }}>
          <Alert severity="info">
            Online card payments are not available. Please contact Tipsyverse
            for payment instructions.
          </Alert>
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 620, mx: "auto", px: 2, py: 8 }}>
      <Paper elevation={2} sx={{ p: { xs: 3, md: 5 } }}>
        {checkoutResult === "success" && (
          <Alert severity="success">
            Thank you. Stripe received your payment. Tipsyverse will update the event after payment confirmation.
          </Alert>
        )}
        {checkoutResult === "cancelled" && (
          <Alert severity="info">
            Payment was not completed. You can use the secure link from your email when you are ready.
          </Alert>
        )}
        {error ? <Alert severity="error">{error}</Alert> : null}
        {!checkoutResult && !error && (!request || !clientSecret) ? (
          <Box sx={{ display: "flex", justifyContent: "center" }}>
            <CircularProgress />
          </Box>
        ) : null}
        {!checkoutResult && request && clientSecret ? (
          <Elements stripe={stripePromise} options={{ clientSecret }}>
            <Checkout request={request} />
          </Elements>
        ) : null}
      </Paper>
    </Box>
  );
}
