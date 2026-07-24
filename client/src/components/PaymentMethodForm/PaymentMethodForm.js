import React, { useEffect, useMemo, useState } from "react";
import {
  Grid,
  TextField,
  Typography,
  Button,
  Stack,
  FormControlLabel,
  Checkbox,
  Tooltip,
  MenuItem,
} from "@mui/material";

const METHOD_TYPES = [
  { label: "Card", value: "card" },
  { label: "ACH (Bank Account)", value: "ach" },
];

const ACCOUNT_TYPES = [
  { label: "Checking", value: "checking" },
  { label: "Savings", value: "savings" },
];

const HOLDER_TYPES = [
  { label: "Individual", value: "individual" },
  { label: "Company", value: "company" },
];

const PaymentMethodForm = ({
  initialValue = null,
  mode = "create", // "create" | "edit"
  onChange,
  onSubmit,
  onCancel,
  submitting = false,
  allowACHInput = false, // NEW PROP (default false)
}) => {
  const [pm, setPm] = useState({
    type: "card", // "card" | "ach"
    nickname: "",
    // Card fields
    brand: "",
    name: "",
    number: "",
    expMonth: "",
    expYear: "",
    cvc: "",
    postalCode: "",
    // ACH fields
    routingNumber: "",
    accountNumber: "",
    accountType: "checking",
    holderType: "individual",
    accountHolderName: "",
    setDefault: false,
  });

  useEffect(() => {
    if (initialValue) {
      setPm((prev) => ({
        ...prev,
        type: initialValue.type === "ach" && allowACHInput ? "ach" : "card",
        nickname: initialValue.nickname || initialValue.label || "",
        // card
        brand: initialValue.brand || "",
        name:
          initialValue.billingName ||
          initialValue.name ||
          initialValue.accountHolderName ||
          "",
        number: "", // never prefill PAN
        expMonth: initialValue.expMonth
          ? String(initialValue.expMonth).padStart(2, "0")
          : "",
        expYear: initialValue.expYear
          ? String(initialValue.expYear).slice(-2)
          : "",
        cvc: "",
        postalCode:
          initialValue.billingPostalCode || initialValue.postalCode || "",
        // ach
        routingNumber: "",
        accountNumber: "",
        accountType: initialValue.accountType || "checking",
        holderType: initialValue.holderType || "individual",
        accountHolderName:
          initialValue.accountHolderName ||
          initialValue.billingName ||
          initialValue.name ||
          "",
        _id: initialValue._id,
        setDefault: false, // let user opt-in on edit
      }));
    } else {
      setPm({
        type: "card",
        nickname: "",
        brand: "",
        name: "",
        number: "",
        expMonth: "",
        expYear: "",
        cvc: "",
        postalCode: "",
        routingNumber: "",
        accountNumber: "",
        accountType: "checking",
        holderType: "individual",
        accountHolderName: "",
        setDefault: false,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialValue, allowACHInput]);

  // helpers
  const digitsOnly = (s = "") => s.replace(/\D+/g, "");

  // Card helpers
  const detectBrand = (numDigits) => {
    if (/^4/.test(numDigits)) return "visa";
    if (/^5[1-5]/.test(numDigits) || /^2(2[2-9]|[3-6]\d|7[01]|720)/.test(numDigits))
      return "mastercard";
    if (/^3[47]/.test(numDigits)) return "amex";
    if (/^6(?:011|5)/.test(numDigits)) return "discover";
    if (/^3(?:0[0-5]|[68])/.test(numDigits)) return "diners";
    if (/^(35\d{2})/.test(numDigits)) return "jcb";
    return pm.brand || "";
  };
  const formatCardNumber = (raw) => {
    const d = digitsOnly(raw).slice(0, 19);
    const brand = detectBrand(d);
    if (brand === "amex") {
      const p1 = d.slice(0, 4),
        p2 = d.slice(4, 10),
        p3 = d.slice(10, 15);
      return [p1, p2, p3].filter(Boolean).join(" ");
    }
    return d.replace(/(.{4})/g, "$1 ").trim();
  };
  const luhnCheck = (num) => {
    let sum = 0,
      alt = false;
    for (let i = num.length - 1; i >= 0; i--) {
      let n = parseInt(num[i], 10);
      if (alt) {
        n *= 2;
        if (n > 9) n -= 9;
      }
      sum += n;
      alt = !alt;
    }
    return num.length >= 13 && num.length <= 19 && sum % 10 === 0;
  };
  const formatExp = (raw) => {
    const d = digitsOnly(raw).slice(0, 4);
    return d.length <= 2 ? d : `${d.slice(0, 2)}/${d.slice(2)}`;
  };
  const parseExp = (exp) => {
    const d = digitsOnly(exp);
    return { mm: d.slice(0, 2), yy: d.slice(2, 4) };
  };

  // ACH helpers
  const formatRouting = (raw) => digitsOnly(raw).slice(0, 9);
  const formatAccount = (raw) => digitsOnly(raw).slice(0, 17);

  // ABA routing checksum: https://en.wikipedia.org/wiki/ABA_routing_transit_number
  const routingChecksumValid = (r) => {
    if (!/^\d{9}$/.test(r)) return false;
    const n = r.split("").map((c) => parseInt(c, 10));
    const sum =
      3 * (n[0] + n[3] + n[6]) +
      7 * (n[1] + n[4] + n[7]) +
      1 * (n[2] + n[5] + n[8]);
    return sum % 10 === 0;
  };

  // validation
  const validations = useMemo(() => {
    const nicknameRequired = mode === "edit";
    const nicknameValid =
      !nicknameRequired || (pm.nickname || "").trim().length > 0;

    // Shared zip logic: optional for ACH; required for Card in create-mode (as before)
    const zipValid = (pm.postalCode || "").trim().length >= 3 || pm.type === "ach";

    if (pm.type === "ach") {
      const routing = digitsOnly(pm.routingNumber);
      const account = digitsOnly(pm.accountNumber);
      const routingValid = routing.length === 9 && routingChecksumValid(routing);
      const accountValid = account.length >= 4 && account.length <= 17;
      const holderNameValid = (pm.accountHolderName || "").trim().length > 0;
      const holderTypeValid = ["individual", "company"].includes(pm.holderType);
      const accountTypeValid = ["checking", "savings"].includes(pm.accountType);

      // ACH create requires routing/account/holderName types; edit allows partial updates
      const createValid =
        routingValid &&
        accountValid &&
        holderNameValid &&
        holderTypeValid &&
        accountTypeValid &&
        nicknameValid;

      const editValid =
        holderNameValid &&
        (!pm.routingNumber || routingValid) &&
        (!pm.accountNumber || accountValid) &&
        holderTypeValid &&
        accountTypeValid &&
        nicknameValid;

      return {
        nicknameValid,
        zipValid,
        routingValid,
        accountValid,
        holderNameValid,
        holderTypeValid,
        accountTypeValid,
        createValid,
        editValid,
        allValid: mode === "create" ? createValid : editValid,
      };
    }

    // CARD branch (unchanged logic + a couple guards)
    const numberDigits = digitsOnly(pm.number);
    const brand = detectBrand(numberDigits);
    const numberValid = mode === "edit" ? true : luhnCheck(numberDigits);

    const expStr =
      pm.expMonth && pm.expYear
        ? `${pm.expMonth}/${pm.expYear}`
        : formatExp(pm.expMonth + pm.expYear);
    const { mm, yy } = parseExp(expStr);
    const m = parseInt(mm || "0", 10);
    const y = parseInt(yy || "0", 10);
    const monthValid = m >= 1 && m <= 12;

    let notExpired = false;
    if (monthValid && yy?.length === 2) {
      const fullYear = 2000 + y;
      const lastDay = new Date(fullYear, m, 0).getDate();
      const expDate = new Date(fullYear, m - 1, lastDay, 23, 59, 59, 999);
      notExpired = expDate >= new Date();
    }

    const cvvDigits = digitsOnly(pm.cvc);
    const cvvLenNeeded = (brand || pm.brand) === "amex" ? 4 : 3;
    const cvvValid = cvvDigits.length === cvvLenNeeded;

    const nameOnCardValid = pm.name.trim().length > 0;

    const createValid =
      numberValid &&
      monthValid &&
      notExpired &&
      cvvValid &&
      zipValid &&
      nicknameValid &&
      nameOnCardValid;

    const expProvided = !!pm.expMonth || !!pm.expYear;
    const cvvProvided = !!pm.cvc;
    const editValid =
      nameOnCardValid &&
      (!expProvided || (monthValid && notExpired)) &&
      (!cvvProvided || cvvValid) &&
      (!pm.postalCode || zipValid) &&
      nicknameValid;

    return {
      brand: brand || pm.brand,
      cvvLenNeeded,
      monthValid,
      notExpired,
      cvvValid,
      zipValid,
      nicknameValid,
      createValid,
      editValid,
      allValid: mode === "create" ? createValid : editValid,
    };
  }, [pm, mode, detectBrand, formatExp, parseExp]); // helpers are stable enough inline

  // state updates
  const setAndNotify = (patch) => {
    const next = { ...pm, ...patch };
    // Only auto-detect brand for cards
    if (next.type === "card") {
      const numberDigits = digitsOnly(next.number);
      next.brand = detectBrand(numberDigits) || next.brand || "";
    }
    setPm(next);
    onChange?.(next);
  };

  // handlers
  const onTypeChange = (e) => {
    const value = e.target.value;
    // Switching types: clear fields from the other type to avoid accidental submissions
    if (value === "ach") {
      setAndNotify({
        type: "ach",
        // clear card-only
        brand: "",
        number: "",
        expMonth: "",
        expYear: "",
        cvc: "",
        name: "",
      });
    } else {
      setAndNotify({
        type: "card",
        // clear ach-only
        routingNumber: "",
        accountNumber: "",
        accountType: "checking",
        holderType: "individual",
        accountHolderName: "",
      });
    }
  };

  const onNumberChange = (e) => setAndNotify({ number: formatCardNumber(e.target.value) });
  const onExpChange = (e) => {
    const f = formatExp(e.target.value);
    const { mm, yy } = parseExp(f);
    setAndNotify({ expMonth: mm, expYear: yy });
  };
  const onCvvChange = (e) => setAndNotify({ cvc: digitsOnly(e.target.value).slice(0, 4) });
  const onZipChange = (e) => setAndNotify({ postalCode: e.target.value.slice(0, 10) });
  const onNameChange = (e) => setAndNotify({ name: e.target.value });
  const onNicknameChange = (e) => setAndNotify({ nickname: e.target.value });
  const onSetDefaultChange = (e) => setAndNotify({ setDefault: !!e.target.checked });

  // ACH handlers
  const onRoutingChange = (e) => setAndNotify({ routingNumber: formatRouting(e.target.value) });
  const onAccountChange = (e) => setAndNotify({ accountNumber: formatAccount(e.target.value) });
  const onAccountTypeChange = (e) => setAndNotify({ accountType: e.target.value });
  const onHolderTypeChange = (e) => setAndNotify({ holderType: e.target.value });
  const onAccountHolderNameChange = (e) =>
    setAndNotify({ accountHolderName: e.target.value });

  const handleSubmit = async () => {
    if (!validations.allValid) return;
    // Submit as-is; backend can branch by pm.type
    await onSubmit?.(pm);
    setPm({
      type: allowACHInput ? "card" : "card",
      nickname: "",
      brand: "",
      name: "",
      number: "",
      expMonth: "",
      expYear: "",
      cvc: "",
      postalCode: "",
      routingNumber: "",
      accountNumber: "",
      accountType: "checking",
      holderType: "individual",
      accountHolderName: "",
      setDefault: false,
    });
  };

  const expDisplay = useMemo(() => {
    if (pm.type !== "card") return "";
    const { mm, yy } = parseExp((pm.expMonth || "") + (pm.expYear || ""));
    return mm && yy
      ? `${mm}/${yy}`
      : pm.expMonth || pm.expYear
      ? formatExp((pm.expMonth || "") + (pm.expYear || ""))
      : "";
  }, [pm.type, pm.expMonth, pm.expYear]);

  return (
    <>
      <Typography variant="subtitle1" sx={{ mb: 1 }}>
        {mode === "edit" ? "Edit Payment Method" : "Add New Payment Method"}
      </Typography>

      <Stack spacing={2}>
        {/* Method type selector (only when ACH allowed) */}
        {allowACHInput && (
          <TextField
            select
            label="Payment Method Type"
            fullWidth
            value={pm.type}
            onChange={onTypeChange}
          >
            {METHOD_TYPES.map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>
                {opt.label}
              </MenuItem>
            ))}
          </TextField>
        )}

        {/* Nickname */}
        <TextField
          label="Nickname (e.g., 'Personal Visa' or 'Chase Checking')"
          fullWidth
          value={pm.nickname}
          onChange={onNicknameChange}
          autoComplete="off"
          inputProps={{ maxLength: 40 }}
          helperText={
            mode === "create"
              ? "Optional label to recognize this method"
              : validations.nicknameValid
              ? " "
              : "Please add a nickname"
          }
          error={!validations.nicknameValid}
        />

        {/* --- CARD FIELDS --- */}
        {pm.type === "card" && (
          <>
            <TextField
              label="Name on Card"
              fullWidth
              value={pm.name}
              onChange={onNameChange}
              autoComplete="cc-name"
            />

            <TextField
              label="Card Number"
              fullWidth
              value={pm.number}
              onChange={onNumberChange}
              inputMode="numeric"
              autoComplete="cc-number"
              placeholder={mode === "edit" ? "Re-enter to replace" : "1234 5678 9012 3456"}
              error={pm.number.length > 0 && !validations.createValid && mode === "create"}
              helperText={
                mode === "edit"
                  ? "Leave blank to keep the same number on file"
                  : pm.number.length === 0
                  ? " "
                  : validations.createValid || mode === "edit"
                  ? (validations.brand
                      ? `Detected: ${String(validations.brand).toUpperCase()}`
                      : " ")
                  : "Enter a valid card number / details"
              }
              inputProps={{ maxLength: 24 }}
            />

            <Grid container spacing={1}>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Exp Date (MM/YY)"
                  fullWidth
                  value={expDisplay}
                  onChange={onExpChange}
                  inputMode="numeric"
                  autoComplete="cc-exp"
                  placeholder="MM/YY"
                  error={
                    (expDisplay?.length ?? 0) > 0 &&
                    (!validations.monthValid || !validations.notExpired)
                  }
                  helperText={
                    expDisplay?.length
                      ? !validations.monthValid
                        ? "Month must be 01–12"
                        : !validations.notExpired
                        ? "Card is expired"
                        : " "
                      : " "
                  }
                  inputProps={{ maxLength: 5 }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label={
                    (validations.brand || pm.brand) === "amex"
                      ? "CID (4 digits)"
                      : "CVV (3 digits)"
                  }
                  fullWidth
                  value={pm.cvc}
                  onChange={onCvvChange}
                  inputMode="numeric"
                  autoComplete="cc-csc"
                  placeholder={(validations.brand || pm.brand) === "amex" ? "1234" : "123"}
                  error={pm.cvc.length > 0 && !validations.cvvValid}
                  helperText={
                    pm.cvc.length === 0
                      ? " "
                      : validations.cvvValid
                      ? " "
                      : "CVV length doesn’t match card"
                  }
                  inputProps={{ maxLength: 4 }}
                />
              </Grid>
            </Grid>

            <TextField
              label="Billing ZIP / Postal Code"
              fullWidth
              value={pm.postalCode}
              onChange={onZipChange}
              autoComplete="postal-code"
              error={pm.postalCode.length > 0 && !validations.zipValid}
              helperText={
                pm.postalCode.length === 0
                  ? " "
                  : validations.zipValid
                  ? " "
                  : "Enter a valid postal code"
              }
            />
          </>
        )}

        {/* --- ACH FIELDS --- */}
        {pm.type === "ach" && (
          <>
            <Grid container spacing={1}>
              <Grid item xs={12} sm={6}>
                <TextField
                  select
                  label="Account Type"
                  fullWidth
                  value={pm.accountType}
                  onChange={onAccountTypeChange}
                >
                  {ACCOUNT_TYPES.map((opt) => (
                    <MenuItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  select
                  label="Holder Type"
                  fullWidth
                  value={pm.holderType}
                  onChange={onHolderTypeChange}
                >
                  {HOLDER_TYPES.map((opt) => (
                    <MenuItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
            </Grid>

            <TextField
              label="Account Holder Name"
              fullWidth
              value={pm.accountHolderName}
              onChange={onAccountHolderNameChange}
              autoComplete="name"
            />

            <Grid container spacing={1}>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Routing Number"
                  fullWidth
                  value={pm.routingNumber}
                  onChange={onRoutingChange}
                  inputMode="numeric"
                  placeholder="9 digits"
                  error={pm.routingNumber.length > 0 && !/^\d{9}$/.test(pm.routingNumber)}
                  helperText={
                    pm.routingNumber.length === 0
                      ? " "
                      : /^\d{9}$/.test(pm.routingNumber)
                      ? " "
                      : "Routing number must be 9 digits"
                  }
                  inputProps={{ maxLength: 9 }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Account Number"
                  fullWidth
                  value={pm.accountNumber}
                  onChange={onAccountChange}
                  inputMode="numeric"
                  placeholder="4–17 digits"
                  inputProps={{ maxLength: 17 }}
                />
              </Grid>
            </Grid>

            {/* Optional postal for ACH, still available for AVS-like needs */}
            <TextField
              label="Billing ZIP / Postal Code (optional)"
              fullWidth
              value={pm.postalCode}
              onChange={onZipChange}
              autoComplete="postal-code"
            />
          </>
        )}

        {/* Set default checkbox */}
        <Tooltip
          title={
            mode === "edit"
              ? "Make this the default method after saving."
              : "Set this new method as your default."
          }
        >
          <FormControlLabel
            control={
              <Checkbox
                checked={pm.setDefault}
                onChange={onSetDefaultChange}
                inputProps={{ "aria-label": "Set as default payment method" }}
              />
            }
            label="Set as default payment method"
          />
        </Tooltip>

        <Stack direction="row" spacing={1} justifyContent="flex-end">
          {onCancel && (
            <Button variant="text" onClick={onCancel} disabled={submitting}>
              Cancel
            </Button>
          )}
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={!validations.allValid || submitting}
            sx={{ backgroundColor: "var(--primary-color)" }}
          >
            {submitting
              ? mode === "edit"
                ? "Saving..."
                : "Adding..."
              : mode === "edit"
              ? "Save Changes"
              : "Add Payment Method"}
          </Button>
        </Stack>
      </Stack>
    </>
  );
};

export default PaymentMethodForm;
