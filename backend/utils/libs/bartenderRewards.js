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
    return true;
  });
};

const BARTENDER_REWARD_MILESTONES_CONFIG = [
  {
    milestone: 1,
    reward: "Welcome Kit",
    costRange: "Included",
    description: "Claim this after approval so Tipsyverse knows where to send your starter kit.",
    items: [
      "Tipsyverse welcome note",
      "Bottle opener",
      "Bar key",
      "Starter pour spout set",
      "Event-ready notepad",
      "Black service towel",
      "Tipsyverse stickers",
    ],
  },
  {
    milestone: 5,
    reward: "Tipsyverse T-Shirt",
    costRange: "$12-18",
    items: ["Tipsyverse branded T-shirt", "Chosen size", "Care card"],
  },
  {
    milestone: 10,
    reward: "Engraved Boston Shaker Tin",
    costRange: "$15-25",
    items: ["Weighted Boston shaker tin", "Tipsyverse engraving", "Polishing cloth"],
  },
  {
    milestone: 25,
    reward: "Premium Bar Spoon + Jigger Set",
    costRange: "$20-30",
    items: ["Twisted bar spoon", "Japanese-style jigger", "Compact tool care guide"],
  },
  {
    milestone: 50,
    reward: "Embroidered Polo Shirt",
    costRange: "$25-35",
    items: ["Tipsyverse embroidered polo", "Chosen size", "Chosen color"],
  },
  {
    milestone: 75,
    reward: "Personalized Cocktail Mixing Glass",
    costRange: "$25-40",
    items: ["Heavy-base mixing glass", "Personalized name text", "Protective shipping box"],
  },
  {
    milestone: 100,
    reward: "Premium Bartender Tool Roll",
    costRange: "$40-60",
    items: ["Canvas or leatherette tool roll", "Tool pockets", "Tipsyverse branded tag"],
  },
  {
    milestone: 150,
    reward: "Tipsyverse Hoodie",
    costRange: "$40-60",
    items: ["Tipsyverse branded hoodie", "Chosen size", "Care card"],
  },
  {
    milestone: 200,
    reward: "Custom Leather Bar Apron",
    costRange: "$70-120",
    description: "Embroidered with bartender name.",
    items: ["Leather bar apron", "Personalized embroidery", "Adjustable straps"],
  },
  {
    milestone: 300,
    reward: "Rolling Bartender Bag",
    costRange: "$100-150",
    items: ["Rolling bartender bag", "Bottle/tool compartments", "Travel ID tag"],
  },
  {
    milestone: 500,
    reward: "Professional Bar Kit + Recognition Plaque",
    costRange: "$150-250",
    items: [
      "Professional bartender tool kit",
      "Recognition plaque",
      "Tipsyverse milestone certificate",
    ],
  },
  {
    milestone: 750,
    reward: "Weekend Company Retreat Invitation",
    costRange: "Variable",
    items: [
      "Company retreat invitation",
      "Event itinerary",
      "Travel and lodging details when available",
    ],
  },
  {
    milestone: 1000,
    reward: "Custom Championship Jacket + Hall of Fame Recognition",
    costRange: "$250+",
    items: [
      "Custom championship jacket",
      "Hall of Fame recognition feature",
      "Personal milestone announcement",
    ],
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

export const buildRewardProgress = (completedEvents = 0, claims = []) => {
  const claimByMilestone = new Map(
    claims.map((claim) => [Number(claim.milestone), claim])
  );

  return BARTENDER_REWARD_MILESTONES.map((item) => {
    const claim = claimByMilestone.get(item.milestone) || null;
    const unlocked = completedEvents >= item.milestone;
    return {
      ...item,
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
