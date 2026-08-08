const normalizeRewardKey = (value = "") =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

const uniqueList = (items = []) => {
  const seen = new Set();
  return items.filter((item) => {
    const key = normalizeRewardKey(item);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const REWARD_SOURCES = {
  barTools: {
    label: "Bar Products — professional bar tools",
    url: "https://barproducts.com/collections/bar-tools",
  },
  barToolGuide: {
    label: "WebstaurantStore — bartender tool guide and shop links",
    url: "https://www.webstaurantstore.com/blog/5566/best-tools-for-bartenders.html",
  },
  apparel: {
    label: "Custom Ink — branded shirts, hoodies, and caps",
    url: "https://www.customink.com/products",
  },
  personalized: {
    label: "Etsy — personalized bartender gear",
    url: "https://www.etsy.com/search?q=personalized%20bartender%20gear",
  },
  packaging: {
    label: "Uline — corrugated shipping and gift boxes",
    url: "https://www.uline.com/Cls_04/Boxes-Corrugated",
  },
};

const purchaseLinksFor = (milestone) => {
  if (milestone === 1) {
    return [REWARD_SOURCES.barTools, REWARD_SOURCES.barToolGuide, REWARD_SOURCES.packaging];
  }
  if ([50, 150].includes(milestone)) {
    return [REWARD_SOURCES.apparel, REWARD_SOURCES.packaging];
  }
  if (milestone >= 200) {
    return [REWARD_SOURCES.personalized, REWARD_SOURCES.barTools, REWARD_SOURCES.packaging];
  }
  return [REWARD_SOURCES.barTools, REWARD_SOURCES.barToolGuide, REWARD_SOURCES.packaging];
};

const uniqueRewardMilestones = (rewards = []) => {
  const seenMilestones = new Set();
  const seenRewards = new Set();

  return rewards.filter((reward) => {
    const milestoneKey = Number(reward.milestone);
    const rewardKey = normalizeRewardKey(reward.reward);
    if (!milestoneKey || !rewardKey) return false;
    if (seenMilestones.has(milestoneKey) || seenRewards.has(rewardKey)) {
      return false;
    }
    seenMilestones.add(milestoneKey);
    seenRewards.add(rewardKey);
    reward.items = uniqueList(reward.items || []);
    reward.purchaseLinks = purchaseLinksFor(milestoneKey);
    return true;
  });
};

const BARTENDER_REWARD_MILESTONES_CONFIG = [
  {
    milestone: 1,
    reward: "Starter Bar Kit",
    costRange: "Included",
    description: "Welcome-letter message: Congratulations, and thank you for completing your first bartending event with Tipsyverse. We are excited to have you on the team and look forward to celebrating many more milestones with you.",
    items: [
      "Printed congratulations and welcome letter",
      "Stainless steel bottle opener",
      "Starter pour spout set",
    ],
  },
  {
    milestone: 5,
    reward: "Service Essentials Set",
    costRange: "$15-25",
    items: ["Waiter's corkscrew", "Black service towel set", "Pocket order notepad"],
  },
  {
    milestone: 10,
    reward: "Boston Shaker Set",
    costRange: "$20-30",
    items: ["Weighted Boston shaker tins", "Hawthorne strainer"],
  },
  {
    milestone: 25,
    reward: "Precision Tool Set",
    costRange: "$30-45",
    items: ["Japanese-style jigger", "Weighted bar spoon", "Stainless steel garnish peeler"],
  },
  {
    milestone: 50,
    reward: "Tipsyverse T-Shirt + Cap Set",
    costRange: "$35-50",
    items: ["Tipsyverse premium T-shirt", "Tipsyverse embroidered cap"],
  },
  {
    milestone: 75,
    reward: "Mixing Glass Set",
    costRange: "$45-65",
    items: ["Heavy-base cocktail mixing glass", "Julep strainer", "Weighted bar spoon"],
  },
  {
    milestone: 100,
    reward: "Bartender Tool Roll Set",
    costRange: "$60-85",
    items: ["Waxed-canvas bartender tool roll", "Six-piece stainless steel bar tool set"],
  },
  {
    milestone: 150,
    reward: "Tipsyverse Hoodie Workwear Set",
    costRange: "$75-100",
    items: ["Tipsyverse heavyweight hoodie", "Insulated stainless steel bottle"],
  },
  {
    milestone: 200,
    reward: "Personalized Bar Apron Set",
    costRange: "$100-140",
    description: "Durable professional workwear personalized for the bartender.",
    items: ["Personalized waxed-canvas bar apron", "Engraved stainless steel bar blade", "Premium service towel set"],
  },
  {
    milestone: 300,
    reward: "Travel Bartender Set",
    costRange: "$140-190",
    items: ["Structured bartender travel bag", "Removable bottle divider", "Personalized luggage tag"],
  },
  {
    milestone: 500,
    reward: "Professional Bar Kit",
    costRange: "$200-275",
    items: ["Premium stainless steel bar tool kit", "Heavy-duty bartender bag", "Personalized waxed-canvas apron"],
  },
  {
    milestone: 750,
    reward: "Premium Mobile Bar Set",
    costRange: "$275-350",
    items: ["Rolling bartender equipment bag", "Premium weighted tool set", "Insulated bottle carrier"],
  },
  {
    milestone: 1000,
    reward: "Personalized Signature Professional Set",
    costRange: "$350-450",
    items: ["Personalized full-grain leather bar apron", "Premium leather bartender tool roll", "Engraved professional bar tool set"],
  },
];

export const BARTENDER_REWARD_MILESTONES = uniqueRewardMilestones(
  BARTENDER_REWARD_MILESTONES_CONFIG
);

export const getCompletedBartenderEventsCount = (assignments = []) =>
  assignments.filter((assignment) => {
    if (assignment.status !== "active") return false;
    const event = assignment.event || {};
    return ["completed", "closed"].includes(event.status);
  }).length;

export const buildRewardProgress = (
  completedEvents = 0,
  claims = [],
  { includePurchaseLinks = false } = {}
) => {
  const claimByMilestone = new Map(
    claims.map((claim) => [Number(claim.milestone), claim])
  );

  return BARTENDER_REWARD_MILESTONES.map((item) => {
    const claim = claimByMilestone.get(item.milestone) || null;
    const unlocked = completedEvents >= item.milestone;
    const { purchaseLinks, ...publicItem } = item;
    return {
      ...publicItem,
      ...(includePurchaseLinks ? { purchaseLinks } : {}),
      requiresClaim: item.requiresClaim !== false,
      unlocked,
      completedEvents,
      remainingEvents: Math.max(0, item.milestone - completedEvents),
      claim: claim
        ? {
            _id: claim._id,
            status: claim.status,
            requestedAt: claim.requestedAt,
            fulfilledAt: claim.fulfilledAt,
            declinedAt: claim.declinedAt,
            shirtSize: claim.shirtSize,
            poloColor: claim.poloColor,
            personalizationText: claim.personalizationText,
            answers: claim.answers || [],
            shippingAddress: claim.shippingAddress,
            notes: claim.notes,
            internalNotes: claim.internalNotes,
            sentAt: claim.sentAt,
          }
        : null,
    };
  });
};
