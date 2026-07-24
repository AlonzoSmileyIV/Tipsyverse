/* ----------------------- constants ----------------------- */
export const steps = [
  "Confirm Info",
  "Questions",
  "Cost & Details",
  "Payment",
  "Review",
];

export const PAYMENT_PROVIDER_LINKS = {
  stripe: "https://dashboard.stripe.com/payment-links",
  square: "https://squareup.com/us/en/online-checkout",
  paypal: "https://www.paypal.com/buttons",
  venmo: "https://venmo.com/business",
  cashapp: "https://cash.app/business",
  zelle: "https://www.zellepay.com/small-business",
};

// defaults for pricing inputs
export const emptyCalc = {
  hourlyRate: 40, // ↑ professional baseline
  gratuityPct: 18, // industry standard
  bookingFee: 75, // platform guarantee
  procurementFee: 0, // only when applicable
  rushPct: 0, // condition-based
  holidayFee: 0, // condition-based
  publicFee: 0, // condition-based
  setupHours: 0.5, // common real-world need
  breakdownHours: 0.5, // common real-world need
  taxPct: 7, // state-dependent
};

export const emptyCoupons = [];

export const EVENT_TYPES = [
  { label: "Birthday", value: "birthday" },
  { label: "Wedding", value: "wedding" },
  { label: "Corporate / Professional", value: "corporate" },
  { label: "Formal", value: "formal" },
  { label: "Holiday Party", value: "holiday" },
  { label: "Private Dinner", value: "private" },
  { label: "Fundraiser", value: "fundraiser" },
  { label: "Other", value: "other" },
];

export const BAR_TYPES = [
  {
    label: "Full Bar",
    value: "full_bar",
    description:
      "Includes all liquors, mixers, beer, and wine. Most flexible and most popular.",
  },
  {
    label: "Beer & Wine",
    value: "beer_wine",
    description:
      "Simple, budget-friendly option with beer, wine, and maybe seltzers.",
  },
  {
    label: "Cocktail Bar",
    value: "cocktail_bar",
    description: "Focuses on mixed drinks and specialty cocktails only.",
  },
  {
    label: "Signature Cocktail Bar",
    value: "signature_cocktail",
    description:
      "Serves 1–3 custom cocktails designed specifically for the event.",
  },
  {
    label: "Open Bar",
    value: "open_bar",
    description: "Guests drink for free; the host covers the total cost.",
  },
  {
    label: "Cash Bar",
    value: "cash_bar",
    description: "Guests pay for their own drinks at the bar.",
  },
  {
    label: "Mocktail / Non-Alcoholic",
    value: "non_alcoholic",
    description: "Serves alcohol-free drinks, mocktails, juices, and sodas.",
  },
];

export const OUTCOME_OPTIONS = [
  { value: "no_answer", label: "No Answer" },
  { value: "left_voicemail", label: "Left Voicemail" },
  { value: "emailed", label: "Emailed" },
  { value: "texted", label: "Texted" },
  { value: "customer_busy", label: "Customer Busy" },
  { value: "followup_scheduled", label: "Follow-up Scheduled" },
  { value: "spoke_confirming", label: "Spoke — Confirming" },
];

export const OVERRIDE_REASONS = [
  { value: "manual_discount", label: "Manual discount approved" },
  { value: "customer_service", label: "Customer service accommodation" },
  { value: "promo", label: "Promotional adjustment" },
  { value: "pricing_error", label: "Pricing calculation error" },
  { value: "competition_match", label: "Matched competitor pricing" },
  { value: "vip", label: "VIP / Partner client" },
  { value: "other", label: "Other (explain)" },
];

export const CANCEL_REASONS = [
  { value: "date_conflict", label: "Date conflict / scheduling change" },
  { value: "budget", label: "Budget / pricing concerns" },
  { value: "found_other_vendor", label: "Booked another vendor" },
  { value: "no_longer_needed", label: "Event postponed / no longer needed" },
  { value: "not_responding", label: "Client not responding" }, // ✅ you asked for this
  { value: "other", label: "Other" },
];

export const procurementBaseline = [
  {
    name: "Full bar",
    amount:
      "For 50 guests over 2 hours: vodka 1.5-2 L, tequila 1.5-2 L, rum/gin/whiskey 0.75-1.5 L each, mixers 12-18 L, ice 75-100 lb.",
  },
  {
    name: "Signature cocktails",
    amount:
      "For 50 guests over 2 hours: main spirit 3-4.5 L, secondary liqueur 0.75-1.5 L, mixers 8-12 L, ice 60-80 lb.",
  },
  {
    name: "Beer and wine",
    amount:
      "For 50 guests over 2 hours: 75-100 beer servings, 15-20 wine bottles, and 40-60 lb of ice if drinks need chilling.",
  },
  {
    name: "Universal supplies",
    amount:
      "Plan 2-3 cups per guest, 2 napkins per guest, extra garnish, bottled water, trash bags, and backups for mixers and ice.",
  },
];
