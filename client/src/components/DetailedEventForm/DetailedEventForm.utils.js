import { BAR_TYPES } from "./DetailedEventForm.constants";

export * from "./DetailedEventForm.constants";
export * from "./DetailedEventForm.formatters";
export * from "./DetailedEventForm.pricing";

const roundForPurchase = (value) => Math.max(1, Math.ceil(value));

const formatScaledRange = (min, max, scale, unit) =>
  `${roundForPurchase(min * scale)}-${roundForPurchase(max * scale)} ${unit}`;

const formatScaledLiters = (min, max, scale) => {
  const fmt = (value) => {
    const scaled = Math.max(0.25, value * scale);
    return scaled < 10 ? scaled.toFixed(1) : String(Math.ceil(scaled));
  };
  return `${fmt(min)}-${fmt(max)} L`;
};

export const buildProcurementGuide = ({ guestCount, durationHours, barType }) => {
  const guests = Math.max(1, Math.round(Number(guestCount) || 50));
  const hours = Math.max(1, Number(durationHours) || 2);
  const scale = Math.max(0.25, (guests / 50) * (hours / 2));
  const typeLabel =
    BAR_TYPES.find((type) => type.value === barType)?.label || "Bar setup";

  const defaultItems = [
    {
      name: "Vodka",
      amount: formatScaledLiters(1.5, 2, scale),
      note: "A common base spirit for full or open bar events.",
    },
    {
      name: "Tequila",
      amount: formatScaledLiters(1.5, 2, scale),
      note: "Increase if margaritas or tequila drinks are featured.",
    },
    {
      name: "Rum, gin, whiskey/bourbon",
      amount: formatScaledLiters(0.75, 1.5, scale),
      note: "Use this range for each spirit you plan to offer.",
    },
    {
      name: "Mixers",
      amount: formatScaledLiters(12, 18, scale),
      note: "Soda, juice, tonic, ginger beer, sour mix, and club soda.",
    },
    {
      name: "Ice",
      amount: formatScaledRange(75, 100, scale, "lb"),
      note: "More is safer for outdoor events, summer dates, or chilling bottles.",
    },
    {
      name: "Cups",
      amount: formatScaledRange(2 * guests, 3 * guests, 1, "cups"),
      note: "Covers guest refills, dropped cups, and water service.",
    },
  ];

  const itemsByType = {
    beer_wine: [
      {
        name: "Beer",
        amount: formatScaledRange(75, 100, scale, "servings"),
        note: "Use cans or bottles if there is no keg setup.",
      },
      {
        name: "Wine",
        amount: formatScaledRange(15, 20, scale, "750 mL bottles"),
        note: "Split between red, white, and sparkling based on the event style.",
      },
      {
        name: "Ice",
        amount: formatScaledRange(40, 60, scale, "lb"),
        note: "Needed for chilling and water service.",
      },
      {
        name: "Cups, napkins, openers",
        amount: formatScaledRange(2 * guests, 3 * guests, 1, "cups"),
        note: "Include wine keys, bottle openers, trash bags, and towels.",
      },
    ],
    signature_cocktail: [
      {
        name: "Main spirit",
        amount: formatScaledLiters(3, 4.5, scale),
        note: "Base this on the featured cocktail recipe.",
      },
      {
        name: "Secondary liqueur",
        amount: formatScaledLiters(0.75, 1.5, scale),
        note: "Triple sec, aperitif, vermouth, or specialty liqueur.",
      },
      {
        name: "Cocktail mixers",
        amount: formatScaledLiters(8, 12, scale),
        note: "Juice, soda, tonic, sour mix, ginger beer, or batch ingredients.",
      },
      {
        name: "Ice and garnish",
        amount: `${formatScaledRange(60, 80, scale, "lb")} ice`,
        note: "Add enough citrus, herbs, salt, sugar, and picks for every serving.",
      },
    ],
    non_alcoholic: [
      {
        name: "Non-alcoholic beverages",
        amount: formatScaledRange(8, 12, scale, "gal"),
        note: "Water, soda, tea, lemonade, mocktail mixers, or sparkling options.",
      },
      {
        name: "Ice",
        amount: formatScaledRange(50, 75, scale, "lb"),
        note: "Plan more for outdoor or warm-weather events.",
      },
      {
        name: "Cups and napkins",
        amount: formatScaledRange(2 * guests, 3 * guests, 1, "cups"),
        note: "Add straws, stirrers, trash bags, and towels as needed.",
      },
      {
        name: "Garnish",
        amount: formatScaledRange(40, 60, scale, "pieces"),
        note: "Citrus wheels, cherries, herbs, or fruit for mocktails.",
      },
    ],
  };

  return {
    guests,
    hours,
    typeLabel,
    items: itemsByType[barType] || defaultItems,
  };
};

export const normalizeProcurementItems = (items) =>
  Array.isArray(items)
    ? items
        .map((item) => ({
          name: item?.name || item?.item || item?.label || item?.title || "",
          qty: Number(item?.qty) || 1,
          pickedUp: !!item?.pickedUp,
        }))
        .filter((item) => item.name)
    : [];

export const getProcurementItemsFromEvent = (event) => {
  const options = event?.options || {};
  const candidates = [
    options.procurementItems,
    options.itemsToPickup,
    options.pickupItems,
    options.procurement?.items,
    event?.procurementItems,
    event?.needs,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeProcurementItems(candidate);
    if (normalized.length) return normalized;
  }
  return [];
};
