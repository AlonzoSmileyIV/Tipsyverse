const LABEL_OVERRIDES = {
  in_progress: "In Progress",
  ready_to_assign: "Ready To Assign",
  awaiting_response: "Awaiting Response",
  waiting_on_user: "Waiting On User",
  reminder_sent: "Reminder Sent",
  cocktail_bar: "Cocktail Bar",
  signature_cocktail: "Signature Cocktail Bar",
  beer_wine: "Beer & Wine",
  full_bar: "Full Bar",
  open_bar: "Open Bar",
  cash_bar: "Cash Bar",
  non_alcoholic: "Mocktail / Non-Alcoholic",
  fixed_amount: "Fixed Amount",
  fixed_deposit: "Fixed Deposit",
  FIXED_DEPOSIT: "Fixed Deposit",
  PERCENTAGE: "Percentage",
  percentage: "Percentage",
  cashapp: "Cash App",
  cash_app: "Cash App",
  paypal: "PayPal",
  zelle: "Zelle",
  stripe: "Stripe",
  square: "Square",
  venmo: "Venmo",
  w9: "W-9",
};

export const displayLabel = (value, fallback = "Not specified") => {
  if (value == null || value === "") return fallback;
  const text = String(value).trim();
  if (!text) return fallback;
  if (LABEL_OVERRIDES[text]) return LABEL_OVERRIDES[text];

  return text
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .replace(/\b([a-z])/g, (match) => match.toUpperCase());
};

export const displayStatus = (value, fallback = "Not specified") =>
  displayLabel(value, fallback);

export const displayEventType = (value, fallback = "Not specified") =>
  displayLabel(value, fallback);

export const displayPaymentType = (value, fallback = "Payment") =>
  displayLabel(value, fallback);
