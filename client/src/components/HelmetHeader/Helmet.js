import { Helmet } from "react-helmet-async";
import { useLocation } from "react-router-dom";

const SITE_NAME = "Tipsyverse";
const DEFAULT_IMAGE = "/images/tipsyverse-og.jpg";
const DEFAULT_KEYWORDS = [
  "Tipsyverse",
  "cocktail recipes",
  "drink recipes",
  "mocktail recipes",
  "mixology",
  "mobile bartending",
  "event bartenders",
  "bartender booking",
  "bartender training",
  "Indianapolis bartending",
];

const SEO_PRESETS = [
  {
    match: (path) => path === "/" || path === "/home",
    title: "Tipsyverse | Discover Cocktail Recipes and Bartending Services",
    description:
      "Explore cocktail and mocktail recipes, discover trending drinks, book event bartenders, and learn bartending basics with Tipsyverse.",
    keywords: [
      "cocktail recipes",
      "mocktail recipes",
      "trending cocktails",
      "bartending services",
      "mobile bartenders",
      "Tipsyverse",
    ],
  },
  {
    match: (path) => path.startsWith("/drinks"),
    title: "Tipsyverse | Explore Cocktail and Mocktail Recipes",
    description:
      "Browse cocktail recipes, mocktails, party drinks, seasonal drinks, glassware, ingredients, and mixology inspiration on Tipsyverse.",
    keywords: [
      "cocktail recipes",
      "mocktail recipes",
      "drink library",
      "mixed drinks",
      "party drinks",
      "seasonal cocktails",
    ],
  },
  {
    match: (path) => path.startsWith("/book") || path === "/events/book" || path === "/book-event",
    title: "Tipsyverse | Book Bartenders for Your Event",
    description:
      "Book professional bartending services for weddings, birthdays, private parties, corporate events, and special occasions with Tipsyverse.",
    keywords: [
      "book bartenders",
      "event bartender booking",
      "mobile bartending",
      "private party bartender",
      "wedding bartender",
      "Indianapolis bartender",
    ],
  },
  {
    match: (path) => path.startsWith("/my-events"),
    title: "Tipsyverse | My Events",
    description:
      "View your Tipsyverse event bookings, payment status, assigned bartenders, attendance, invoices, and event details.",
    keywords: ["my events", "event booking", "bartender attendance", "event invoice", "event payment"],
    noindex: true,
  },
  {
    match: (path) => path.startsWith("/bartend"),
    title: "Tipsyverse | Bartender Dashboard",
    description:
      "Manage bartender onboarding, licenses, schedule, assignments, clock in and out, earnings, rewards, reviews, and support with Tipsyverse.",
    keywords: [
      "bartender dashboard",
      "bartender schedule",
      "bartender earnings",
      "bartender rewards",
      "bartender licenses",
    ],
    noindex: true,
  },
  {
    match: (path) => path.startsWith("/learn"),
    title: "Tipsyverse | Bartender Training Courses",
    description:
      "Take Tipsyverse bartender training courses, complete lessons, track progress, and prepare for bartending event work.",
    keywords: ["bartender training", "bartending course", "bartending foundations", "mixology training"],
  },
  {
    match: (path) => path.startsWith("/settings"),
    title: "Tipsyverse | Profile Settings",
    description:
      "Manage your Tipsyverse profile, preferences, account security, support tickets, account details, and activity settings.",
    keywords: ["profile settings", "account settings", "support tickets", "account security"],
    noindex: true,
  },
  {
    match: (path) => path.startsWith("/admin"),
    title: "Tipsyverse | Admin Panel",
    description:
      "Manage Tipsyverse events, finance, users, bartenders, licenses, operations, drinks, catalog setup, support, and permissions.",
    keywords: ["admin dashboard", "event management", "bartender management", "finance dashboard"],
    noindex: true,
  },
  {
    match: (path) => path === "/about",
    title: "Tipsyverse | About Us",
    description:
      "Learn about Tipsyverse, a cocktail discovery, bartending, and event service platform built for drink lovers, customers, and bartenders.",
    keywords: ["about Tipsyverse", "cocktail community", "bartending platform", "event bartending"],
  },
  {
    match: (path) => path === "/contact",
    title: "Tipsyverse | Contact Us",
    description:
      "Contact Tipsyverse for support, event questions, bartending services, partnerships, account help, and customer assistance.",
    keywords: ["contact Tipsyverse", "bartending support", "event support", "customer support"],
  },
  {
    match: (path) => path === "/faq",
    title: "Tipsyverse | FAQ and How-To Guides",
    description:
      "Find answers and how-to guides for Tipsyverse events, drinks, customer accounts, bartender workflows, support tickets, and platform features.",
    keywords: ["Tipsyverse FAQ", "how to use Tipsyverse", "cocktail FAQ", "bartender help", "event help"],
  },
  {
    match: (path) => path === "/privacy",
    title: "Tipsyverse | Privacy Policy",
    description:
      "Read the Tipsyverse Privacy Policy to learn how account, event, bartender, support, payment, and activity information is collected and used.",
    keywords: ["Tipsyverse privacy policy", "privacy policy", "data privacy"],
  },
  {
    match: (path) => path === "/terms-conditions",
    title: "Tipsyverse | Terms and Conditions",
    description:
      "Read the Tipsyverse Terms and Conditions for platform use, events, bartenders, payments, content, account requirements, and service rules.",
    keywords: ["Tipsyverse terms", "terms and conditions", "event service terms", "bartender terms"],
  },
  {
    match: (path) => path === "/login",
    title: "Tipsyverse | Login",
    description: "Log in to Tipsyverse to manage events, drinks, bartender work, support, settings, and account activity.",
    keywords: ["Tipsyverse login", "account login"],
    noindex: true,
  },
  {
    match: (path) => path === "/register",
    title: "Tipsyverse | Create an Account",
    description:
      "Create a Tipsyverse account to save drinks, book events, submit support tickets, and apply for bartender opportunities.",
    keywords: ["Tipsyverse registration", "create account", "bartender signup", "book bartenders"],
  },
];

const abs = (url) => {
  const base =
    process.env.REACT_APP_PUBLIC_SITE_URL ||
    (typeof window !== "undefined" ? window.location.origin : "");
  try {
    return url?.startsWith("http") ? url : new URL(url, base).toString();
  } catch {
    return url;
  }
};

const normalizeKeywords = (keywords) => {
  const values = Array.isArray(keywords)
    ? keywords
    : String(keywords || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);

  return Array.from(new Set([...values, ...DEFAULT_KEYWORDS])).slice(0, 25).join(", ");
};

const findPreset = (pathname) =>
  SEO_PRESETS.find((preset) => preset.match(pathname)) || {};

export default function HelmetHeader({
  title,
  description,
  image,
  url,
  keywords,
  type,
  noindex,
  jsonLd,
}) {
  const location = useLocation();
  const preset = findPreset(location.pathname);
  const pageTitle = title || preset.title || SITE_NAME;
  const pageDesc = (description || preset.description || "Discover cocktails, mocktails, bartending services, and event inspiration on Tipsyverse.").slice(0, 180);
  const pageUrl = abs(url || `${location.pathname}${location.search}`);
  const imgUrl = abs(image || DEFAULT_IMAGE);
  const pageKeywords = normalizeKeywords(keywords || preset.keywords);
  const shouldNoindex = noindex ?? preset.noindex;
  const ogType = type || (location.pathname.startsWith("/drinks/") ? "article" : "website");
  const structuredData =
    jsonLd ||
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: SITE_NAME,
      url: abs("/"),
      potentialAction: {
        "@type": "SearchAction",
        target: `${abs("/drinks")}?search={search_term_string}`,
        "query-input": "required name=search_term_string",
      },
    };

  return (
    <Helmet>
      <title>{pageTitle}</title>
      <meta name="description" content={pageDesc} />
      <meta name="keywords" content={pageKeywords} />
      {shouldNoindex ? (
        <meta name="robots" content="noindex,nofollow" />
      ) : (
        <meta name="robots" content="index,follow,max-image-preview:large" />
      )}
      {pageUrl && <link rel="canonical" href={pageUrl} />}

      <meta property="og:type" content={ogType} />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:title" content={pageTitle} />
      <meta property="og:description" content={pageDesc} />
      {pageUrl && <meta property="og:url" content={pageUrl} />}
      {imgUrl && (
        <>
          <meta property="og:image" content={imgUrl} />
          <meta property="og:image:width" content="1200" />
          <meta property="og:image:height" content="630" />
        </>
      )}

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={pageTitle} />
      <meta name="twitter:description" content={pageDesc} />
      {imgUrl && <meta name="twitter:image" content={imgUrl} />}
      <script type="application/ld+json">
        {JSON.stringify(structuredData)}
      </script>
    </Helmet>
  );
}
