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
import LocationStep from "../LocationInput/LocationInput";

const emptyAddress = {
  address1: "", address2: "", city: "", county: "", state: "",
  zipcode: "", country: "US", placeId: "", formattedAddress: "",
  latitude: null, longitude: null,
};

export const requiredBillingAddressErrors = (address) => ({
  address1: address.address1?.trim() ? "" : "Address Line 1 is required.",
  city: address.city?.trim() ? "" : "City is required.",
  state: address.state?.trim() ? "" : "State is required.",
  zipcode: address.zipcode?.trim() ? "" : "ZIP Code is required.",
  country: address.country?.trim() ? "" : "Country is required.",
});

export default function PaymentMethodForm({
  initialValue = null,
  mode = "create",
  onSubmit,
  onCancel,
  submitting = false,
  ownerId,
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [nickname, setNickname] = useState("");
  const [billingName, setBillingName] = useState("");
  const [setDefault, setSetDefault] = useState(false);
  const [billingAddress, setBillingAddress] = useState(emptyAddress);
  const [addressTouched, setAddressTouched] = useState({});
  const [error, setError] = useState("");
  const [processing, setProcessing] = useState(false);
  const billingAddressErrors = requiredBillingAddressErrors(billingAddress);

  useEffect(() => {
    setNickname(initialValue?.nickname || "");
    setBillingName(initialValue?.billingName || "");
    const address = initialValue?.billingAddress || {};
    setBillingAddress({
      ...emptyAddress,
      ...address,
      formattedAddress: address.formattedAddress || address.formatted || "",
    });
    setSetDefault(false);
  }, [initialValue]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setProcessing(true);
    try {
      const requiredAddressFields = ["address1", "city", "state", "zipcode", "country"];
      const missingAddress = requiredAddressFields.some(
        (field) => !String(billingAddress[field] || "").trim()
      );
      if (!nickname.trim()) throw new Error("Payment method nickname is required.");
      if (!billingName.trim()) throw new Error("Cardholder name is required.");
      if (missingAddress) {
        setAddressTouched(Object.fromEntries(requiredAddressFields.map((field) => [field, true])));
        throw new Error("A complete billing address is required.");
      }
      if (mode === "edit") {
        await onSubmit({ nickname, billingName, billingAddress, setDefault });
        return;
      }
      if (!stripe || !elements) throw new Error("Secure card entry is still loading.");
      const { data } = await api.post("/payment-methods/setup-intent", { ownerId });
      const result = await stripe.confirmCardSetup(data.clientSecret, {
        payment_method: {
          card: elements.getElement(CardElement),
          billing_details: {
            name: billingName,
            address: {
              line1: billingAddress.address1,
              line2: billingAddress.address2 || undefined,
              city: billingAddress.city,
              state: billingAddress.state,
              postal_code: billingAddress.zipcode,
              country: billingAddress.country,
            },
          },
        },
      });
      if (result.error) throw new Error(result.error.message);
      await onSubmit({
        setupIntentId: result.setupIntent.id,
        nickname,
        billingName,
        billingAddress,
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
        required
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
      {mode === "create" && (
        <Alert severity="info">
          After this card is saved, its card number, expiration date, and
          security code cannot be edited. To change those details, delete this
          payment method and add the card again.
        </Alert>
      )}
      <Typography variant="subtitle2">Billing address</Typography>
      <LocationStep
        value={billingAddress}
        onChange={(patch) => setBillingAddress((current) => ({ ...current, ...patch }))}
        serviceArea="us"
        restrictCountry="US"
        touched={addressTouched}
        setTouched={setAddressTouched}
        showInstructions={false}
        errors={billingAddressErrors}
      />
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
