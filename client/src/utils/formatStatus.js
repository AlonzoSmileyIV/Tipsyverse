

export function formatStatus(value = "") {
  if (!value) return "";

  const overrides = {
    in_progress: "In Progress",
    ready_to_assign: "Ready To Assign",
    awaiting_response: "Awaiting Response",
    waiting_on_user: "Waiting On User",
    reminder_sent: "Reminder Sent",
    under_review: "Under Review",
    cocktail_bar: "Cocktail Bar",
    signature_cocktail: "Signature Cocktail Bar",
    beer_wine: "Beer & Wine",
    full_bar: "Full Bar",
    open_bar: "Open Bar",
    cash_bar: "Cash Bar",
    non_alcoholic: "Mocktail / Non-Alcoholic",
    cashapp: "Cash App",
    cash_app: "Cash App",
    cashApp: "Cash App",
    paypal: "PayPal",
    zelle: "Zelle",
    venmo: "Venmo",
    stripe: "Stripe",
    square: "Square",
    FIXED_DEPOSIT: "Fixed Deposit",
    PERCENTAGE: "Percentage",
  };

  const raw = String(value).trim();
  if (overrides[raw]) return overrides[raw];

  return raw
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\w\S*/g, (w) =>
      w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
    );
}
