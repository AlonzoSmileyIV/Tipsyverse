import { useEffect, useState } from "react";
import {
  Alert,
  Button,
  Checkbox,
  FormControlLabel,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { CardElement, useElements, useStripe } from "@stripe/react-stripe-js";
import api from "../../services/api";

export default function PaymentMethodForm({
  initialValue = null,
  mode = "create",
  onSubmit,
  onCancel,
  submitting = false,
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [nickname, setNickname] = useState("");
  const [billingName, setBillingName] = useState("");
  const [setDefault, setSetDefault] = useState(false);
  const [error, setError] = useState("");
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    setNickname(initialValue?.nickname || "");
    setBillingName(initialValue?.billingName || "");
    setSetDefault(false);
  }, [initialValue]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setProcessing(true);
    try {
      if (mode === "edit") {
        await onSubmit({ nickname, name: billingName, setDefault });
        return;
      }
      if (!stripe || !elements) throw new Error("Secure card entry is still loading.");
      const { data } = await api.post("/payment-methods/setup-intent");
      const result = await stripe.confirmCardSetup(data.clientSecret, {
        payment_method: {
          card: elements.getElement(CardElement),
          billing_details: { name: billingName },
        },
      });
      if (result.error) throw new Error(result.error.message);
      await onSubmit({
        setupIntentId: result.setupIntent.id,
        nickname,
        setDefault,
      });
    } catch (submitError) {
      setError(submitError?.message || "Unable to save this card.");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Stack component="form" spacing={2} onSubmit={handleSubmit}>
      <Typography variant="h6">
        {mode === "create" ? "Add a card securely" : "Edit payment method"}
      </Typography>
      {error && <Alert severity="error">{error}</Alert>}
      <TextField
        label="Nickname"
        value={nickname}
        onChange={(event) => setNickname(event.target.value)}
        inputProps={{ maxLength: 80 }}
      />
      <TextField
        label="Name on card"
        value={billingName}
        onChange={(event) => setBillingName(event.target.value)}
        required
      />
      {mode === "create" && (
        <Stack
          sx={{
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 1,
            p: 2,
          }}
        >
          <CardElement options={{ hidePostalCode: false }} />
        </Stack>
      )}
      <FormControlLabel
        control={
          <Checkbox
            checked={setDefault}
            onChange={(event) => setSetDefault(event.target.checked)}
          />
        }
        label="Make this my default payment method"
      />
      <Stack direction="row" spacing={1}>
        <Button
          type="submit"
          variant="contained"
          disabled={submitting || processing || (mode === "create" && !stripe)}
        >
          {processing || submitting ? "Saving…" : "Save"}
        </Button>
        <Button type="button" onClick={onCancel} disabled={processing || submitting}>
          Cancel
        </Button>
      </Stack>
    </Stack>
  );
}
