// DrinkDetailScreen.js
import React, { useEffect, useState, useRef, useMemo } from "react";
import {
  useNavigate,
  useParams,
  useLocation,
  useSearchParams,
} from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import {
  Box,
  Typography,
  Button,
  Tooltip,
  Snackbar,
  Alert,
  Stack,
  Chip,
  Paper,
  Checkbox,
  Collapse,
} from "@mui/material";
import {
  FavoriteBorder,
  Share,
  ChatBubbleOutline,
  BookmarkBorder,
  PlayCircle,
  BrokenImage,
  LocalBar as LocalBarIcon,
  Build as BuildIcon,
  Spa as SpaIcon,
  Tag as TagIcon,
  RestaurantMenuOutlined as RestaurantMenuIcon,
  FormatListNumberedOutlined as FormatListNumberIcon,
  InfoOutlined as InfoIcon,
} from "@mui/icons-material";
import HelmetHeader from "../../components/HelmetHeader/Helmet";
import CommentSection from "../../components/CommentSection/CommentSection";
import { fetchDrinkBySlug } from "../../features/drinks/drinkSlice";
import PublicLayout from "../../components/PublicLayout/PublicLayout";
import LoadingSkeleton from "../../components/LoadingSkeleton/LoadingSkeleton";
import api from "../../services/api";
import { handleUpdateUser } from "../../utils/handleUpdateUser";
import { navigateOrReload } from "../../utils/navigateOrReload";
import { abbreviateNumber } from "../../utils/abbreviateNumber";
import { countThreaded } from "../../utils/countThread";

const DrinkDetailScreen = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { loggedInUser } = useSelector((state) => state.users);
  const location = useLocation();

  const allergies = useMemo(
    () => loggedInUser?.user?.preferences?.allergies || [],
    [loggedInUser]
  );

  const drinkData = useSelector((state) => state.drinks.currentDrink);
  const [liked, setLiked] = useState(false);
  const [shareCount, setShareCount] = useState(0);
  const [commentCount, setCommentCount] = useState(0);
  const [likeCount, setLikeCount] = useState(0);
  const [saved, setSaved] = useState(false);
  const commentSectionRef = useRef(null);
  const [showContent, setShowContent] = useState(false);
  const drink = useMemo(() => drinkData?.data || [], [drinkData]);
  //const isLargeScreen = useMediaQuery("(min-width:640px)");
  const [notFound, setNotFound] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [showFullDesc, setShowFullDesc] = useState(false);
  const shortDesc = (drink.description || "").slice(0, 180);
  const drinkImage =
    (drink.photo && drink.photo.includes("res.cloudinary.com")
      ? drink.photo.replace(
          "/upload/",
          "/upload/c_fill,w_1200,h_630,g_auto,f_jpg,q_auto/"
        )
      : drink.photo) || "https://cdn.tipsyverse.com/defaults/drink_1200x630.jpg";
  const drinkIngredients = Array.isArray(drink.ingredients)
    ? drink.ingredients
        .map((item) =>
          [
            item?.ounces ? `${item.ounces} oz` : item?.amount,
            item?.flavor,
            item?.brand || item?.name,
          ]
            .filter(Boolean)
            .join(" ")
        )
        .filter(Boolean)
    : [];
  const drinkInstructions = Array.isArray(drink.instructions)
    ? drink.instructions.filter(Boolean)
    : [];
  const drinkDescription =
    drink.description ||
    `Learn how to make ${drink.name || "this cocktail"} with Tipsyverse, including ingredients, glassware, and step-by-step instructions.`;
  const drinkKeywords = [
    drink.name,
    `${drink.name} recipe`,
    drink.isAlcoholic ? "cocktail recipe" : "mocktail recipe",
    drink.glass?.name,
    ...(drink.categories || []),
    ...(drink.tags || []),
    ...(drink.taste || []),
  ]
    .filter(Boolean)
    .join(", ");
  const drinkJsonLd = {
    "@context": "https://schema.org",
    "@type": "Recipe",
    name: drink.name,
    description: drinkDescription,
    image: drinkImage,
    recipeCategory: drink.isAlcoholic ? "Cocktail" : "Mocktail",
    recipeIngredient: drinkIngredients,
    recipeInstructions: drinkInstructions.map((text, index) => ({
      "@type": "HowToStep",
      position: index + 1,
      text,
    })),
    author: {
      "@type": "Organization",
      name: "Tipsyverse",
    },
  };

  const ingredientsRef = useRef(null);
  const instructionsRef = useRef(null);
  const metaRef = useRef(null);

  // PATCH: chip compression toggles
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [showAllTags, setShowAllTags] = useState(false);
  const MAX_INLINE_CHIPS = 6; // how many to show before "+N more"
  const SCROLL_MARGIN = { xs: 72, sm: 96 }; // px — adjust if your top bar is taller/shorter

  const [searchParams] = useSearchParams();
  const commentIdFromURL = searchParams.get("commentId");

  // ⭐ NEW — local UI state
  const [showAllSteps, setShowAllSteps] = useState(false);
  const [checkedIngredients, setCheckedIngredients] = useState(new Set());

  // --- Category chips (Gen-Z flair) ---
  const CATEGORY_STYLES = {
    Trouble: {
      icon: "🔥",
      sx: {
        bgcolor: "#ff3b30 !important", // iOS danger red
        color: "#fff !important",
        borderColor: "transparent !important",
        fontWeight: 700,
      },
      variant: "filled",
    },
    "Tipsyverse Originals": {
      icon: "✨",
      sx: {
        bgcolor: "rgba(139, 92, 246, 0.12)",
        borderColor: "rgba(139, 92, 246, 0.3)",
        color: "#6d28d9",
        fontWeight: 600,
      },
      variant: "outlined",
    },
    Trending: {
      icon: "📈",
      sx: {
        bgcolor: "rgba(34,197,94,0.10)",
        borderColor: "rgba(34,197,94,0.25)",
        color: "#059669",
        fontWeight: 600,
      },
      variant: "outlined",
    },
    Classic: { icon: "🍸" },
    Fall: { icon: "🍂" },
    Winter: { icon: "❄️" },
    Spring: { icon: "🌿" },
    Summer: { icon: "☀️" },
    Mocktails: { icon: "🥤" },
    "Easy at Home": { icon: "🏠" },
    Party: { icon: "🎉" },
  };

  const TAG_STYLES = {
    Juneteenth: { icon: "✊🏾", color: "rgba(0,0,0,0.08)", text: "black" },
    "Memorial Day": {
      icon: "🫡",
      color: "rgba(173,216,230,0.25)",
      text: "#2563eb",
    },
    "Fourth of July": {
      icon: "🎆",
      color: "rgba(173,216,230,0.25)",
      text: "#1d4ed8",
    },
    Thanksgiving: {
      icon: "🍗",
      color: "rgba(165,42,42,0.15)",
      text: "#78350f",
    },
    Christmas: { icon: "🎄", color: "rgba(34,197,94,0.15)", text: "#047857" },
    Halloween: { icon: "🎃", color: "rgba(251,146,60,0.2)", text: "#c2410c" },
    "New Years": { icon: "🥂", color: "rgba(255,215,0,0.2)", text: "#ca8a04" },
    "Valentine's Day": {
      icon: "❤️",
      color: "rgba(239,68,68,0.15)",
      text: "#b91c1c",
    },
    "St Patricks Day": {
      icon: "🍀",
      color: "rgba(34,197,94,0.15)",
      text: "#166534",
    },
    Birthday: { icon: "🎉", color: "rgba(147,51,234,0.15)", text: "#7e22ce" },
    Wedding: { icon: "💍", color: "rgba(236,72,153,0.15)", text: "#be185d" },
    "Game Night": {
      icon: "🎲",
      color: "rgba(20,184,166,0.15)",
      text: "#0f766e",
    },
    "Summer BBQ": {
      icon: "🌞",
      color: "rgba(251,191,36,0.15)",
      text: "#b45309",
    },
    Brunch: { icon: "🥞", color: "rgba(251,191,36,0.15)", text: "#92400e" },
  };

  const tagIconFor = (name) => TAG_STYLES[name]?.icon ?? "🏷️";

  const tagChipSx = (name) => {
    const style = TAG_STYLES[name];
    return {
      mb: 1,
      borderRadius: 2,
      border: "1px solid", // thin border
      borderColor: "divider",
      bgcolor: style?.color || "grey.100", // faded background
      color: style?.text || "inherit", // readable text color
      fontWeight: 500,
    };
  };

  const catIcon = (name) => CATEGORY_STYLES[name]?.icon || "🏷️";
  const catVariant = (name) => CATEGORY_STYLES[name]?.variant || "outlined";
  const catSx = (name) => ({
    mb: 1,
    borderRadius: 2,
    borderColor: "divider",
    bgcolor: "background.paper",
    ...(CATEGORY_STYLES[name]?.sx || {}),
  });

  // --- helpers ---
  const toArray = (v) => (Array.isArray(v) ? v : v ? [v] : []);

  const TagRow = ({ label, icon, items = [] }) => {
    return (
      <Box sx={{ mt: 2, display: "flex", gap: 1 }}>
        <Typography variant="subtitle2" sx={{ mb: 1, color: "text.secondary" }}>
          {label}
        </Typography>

        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {items && items.length > 0 ? (
            items.map((it) => (
              <Chip
                key={it}
                icon={icon}
                label={it}
                size="small"
                //onClick={() => handleTagClick(label, it)}
                clickable
                sx={{
                  mb: 1,
                  borderRadius: 2,
                  borderColor: "divider",
                  bgcolor: "background.paper",
                }}
                variant="outlined"
              />
            ))
          ) : (
            <Chip
              icon={icon}
              label={`${label} not needed`}
              size="small"
              sx={{
                mb: 1,
                borderRadius: 2,
                borderColor: "divider",
                bgcolor: "grey.100",
                color: "text.secondary",
                fontStyle: "italic",
              }}
              variant="outlined"
              disabled
            />
          )}
        </Stack>
      </Box>
    );
  };

  // scroll-to-comment (unchanged)
  useEffect(() => {
    const commentId = location.state?.scrollToCommentId;
    if (commentId) {
      const el = document.getElementById(`comment-${commentId}`);
      if (el) {
        setTimeout(() => {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
          el.classList.add("highlighted-comment");
        }, 300);
      }
    }
  }, [location]);

  useEffect(() => {
    dispatch(fetchDrinkBySlug(slug));
  }, [dispatch, slug]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const noData =
        !drinkData?.data ||
        (typeof drinkData.data === "object" &&
          Object.keys(drinkData.data).length === 0);
      if (noData) setNotFound(true);
    }, 1500);
    return () => clearTimeout(timeoutId);
  }, [drinkData]);

  useEffect(() => {
    const timer = setTimeout(() => setShowContent(true), 1500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const token = loggedInUser?.accessToken;
    const recordView = async () => {
      try {
        await api.post(
          `/drinks/${slug}/view`,
          {},
          { headers: token ? { Authorization: `Bearer ${token}` } : {} }
        );
      } catch (err) {
        console.error("Failed to increment view", err);
      }
    };
    recordView();
  }, [slug, loggedInUser]);

  const isLoading = drinkData?.loading || !showContent || !drink?._id;

  useEffect(() => {
    const style = document.createElement("style");
    style.innerHTML = `
      @keyframes bounce { 0%{transform:scale(1)}30%{transform:scale(1.2)}50%{transform:scale(.9)}100%{transform:scale(1)} }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  useEffect(() => {
    const likedDrinks = (loggedInUser?.user?.likedDrinks || []).map((d) =>
      typeof d === "string" ? d : d._id?.toString()
    );
    const savedDrinks = (loggedInUser?.user?.savedDrinks || []).map(
      (d) => (typeof d === "string" ? d : d._id?.toString())
    );

    if (drink._id) {
      setLiked(likedDrinks.includes(drink._id));
      setSaved(savedDrinks.includes(drink._id));
    }
  }, [loggedInUser, drink._id]);

  useEffect(() => {
    if (drink?.analytics?.counts?.likes !== undefined)
      setLikeCount(drink.analytics.counts.likes);
  }, [drink?.analytics?.counts?.likes]);

  useEffect(() => {
    if (drink?.analytics?.counts?.shares !== undefined)
      setShareCount(drink.analytics.counts.shares);
  }, [drink?.analytics?.counts?.shares]);

  // DrinkDetailScreen.js (add near other selectors)
  const drinkCommentsForCount = useSelector(
    (s) => s.comments.drinkComments?.data || []
  );

  const threadedFromRedux = useMemo(
    () => countThreaded(drinkCommentsForCount),
    [drinkCommentsForCount]
  );

  useEffect(() => {
    if (threadedFromRedux > 0 || drinkCommentsForCount.length === 0) {
      setCommentCount(threadedFromRedux);
    } else if (typeof drink?.analytics?.counts?.comments === "number") {
      setCommentCount(drink.analytics.counts.comments);
    }
  }, [
    threadedFromRedux,
    drinkCommentsForCount.length,
    drink?.analytics?.counts?.comments,
  ]);

  const handleLike = async () => {
    try {
      const res = await api.put(`/drinks/${drink._id}/toggle-like`);
      const { liked, likeCount } = res.data;
      setLiked(liked);
      setLikeCount(likeCount);
      await handleUpdateUser(dispatch);
    } catch (err) {
      console.error("Failed to toggle like:", err);
    }
  };

  const handleShare = async () => {
    const appBase =
      process.env.REACT_APP_PUBLIC_SITE_URL || window.location.origin;
    const shareBase =
      process.env.REACT_APP_SHARE_BASE_URL ||
      process.env.REACT_APP_SOCKET_URL ||
      process.env.REACT_APP_BASE_URL?.replace(/\/api\/v\d+\/?$/, "") ||
      appBase;
    const url = new URL(`/share/drinks/${drink.slug || slug}`, shareBase);

    url.searchParams.set("utm_source", "share");
    url.searchParams.set("utm_medium", navigator.share ? "webshare" : "copy");

    const shareData = {
      title: `${drink.name} | Tipsyverse`,
      text: "Take a look at this drink! Enjoy this drink!",
      url: url.toString(),
    };

    // call only when share truly succeeds
    const recordShare = async () => {
      try {
        const res = await api.post(
          `/drinks/${drink._id}/share`,
          {},
          { skipAuthRefresh: true }
        );
        if (typeof res?.data?.shareCount === "number")
          setShareCount(res.data.shareCount);
        else setShareCount((c) => c + 1);
      } catch (e) {
        console.warn(
          "Failed to record share:",
          e?.response?.status || e?.message
        );
      }
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        await recordShare(); // only here
      } else {
        await navigator.clipboard.writeText(shareData.url);
        setSnackbarOpen(true);
        // don't record here
      }
    } catch (err) {
      // AbortError when user cancels; do not record
      if (err?.name !== "AbortError") console.error("Sharing failed", err);
    }
  };

  const handleBookmark = async () => {
    try {
      await api.put(`/drinks/${drink._id}/toggle-bookmark`);
      await handleUpdateUser(dispatch);
    } catch (err) {
      console.error("Failed to toggle bookmark:", err);
    }
  };

  const scrollToComments = () => {
    commentSectionRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // replace your formatIngredient with this
  const formatIngredient = (ingredient, idx) => {
    if (!ingredient) return null;

    const base = (ingredient.name || "").trim(); // e.g., "Brandy"
    const brand = (ingredient.brand || "").trim(); // e.g., "Hennessy"
    const flavor = (ingredient.flavor || "").trim(); // e.g., "Strawberry"
    const displayName = [flavor, brand || base].filter(Boolean).join(" ");

    const ounces = Number(ingredient.ounces);
    const isAllergic = allergies.includes(base); // keep allergy check on the base

    const checked = checkedIngredients.has(idx);

    // amount text with brand-aware name
    const amount = Number.isFinite(ounces)
      ? ounces < 0.5
        ? `a dash of ${displayName}`
        : `${ounces} oz ${displayName}`
      : displayName;

    return (
      <Box
        display="flex"
        alignItems="center"
        gap={1}
        sx={{ opacity: checked ? 0.55 : 1 }}
      >
        <Checkbox
          size="small"
          checked={checked}
          onChange={(e) => {
            setCheckedIngredients((prev) => {
              const next = new Set(prev);
              e.target.checked ? next.add(idx) : next.delete(idx);
              return next;
            });
          }}
          inputProps={{ "aria-label": `check ${amount}` }}
        />
        <Typography
          component="span"
          sx={{
            color: isAllergic ? "error.main" : "inherit",
            fontWeight: isAllergic ? "bold" : "normal",
            fontStyle: isAllergic ? "italic" : "normal",
            textDecoration: checked ? "line-through" : "none",
          }}
        >
          {amount}
          {isAllergic && ` (allergen)`}
        </Typography>
      </Box>
    );
  };

  if (!drink) return null;

  return (
    <PublicLayout>
      {isLoading ? (
        <LoadingSkeleton />
      ) : notFound ? (
        <Box
          sx={{
            height: "60vh",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            textAlign: "center",
            px: 2,
          }}
        >
          <BrokenImage sx={{ fontSize: 96, color: "#ccc", mb: 2 }} />
          <Typography variant="h5" fontWeight={700} gutterBottom>
            Not found
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            We couldn’t find a drink with that link.
          </Typography>
          <Button
            variant="contained"
            sx={{ backgroundColor: "var(--primary-color)" }}
            onClick={() => navigateOrReload(navigate, "/")}
          >
            Back to Home
          </Button>
        </Box>
      ) : (
        <Box
          sx={{
            px: { xs: 2, md: 6 },
            py: 4,
            pb: { xs: 10, sm: 4 } /* bottom pad for sticky bar */,
          }}
        >
          <HelmetHeader
            title={`${drink.name} | Tipsyverse`}
            description={drinkDescription}
            keywords={drinkKeywords}
            image={drinkImage}
            url={`${
              process.env.REACT_APP_PUBLIC_SITE_URL || window.location.origin
            }/drinks/${slug}`}
            type="article"
            jsonLd={drinkJsonLd}
          />

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "700px minmax(0, 1fr)" },
              gap: 4,
              alignItems: "start",
              mx: "auto",
            }}
          >
            {/* LEFT SIDE */}
            <Box>
              {/* Image */}
              <Box sx={{ mb: 3 }}>
                <Box
                  sx={{
                    width: "100%",
                    maxWidth: 500,
                    borderRadius: 2,
                    overflow: "hidden",
                  }}
                >
                  <img
                    src={
                      drink.photo ||
                      "https://res.cloudinary.com/dtbgyeyjq/image/upload/v1747893721/default/drink.png"
                    }
                    alt={drink.name}
                    style={{
                      display: "block",
                      width: "100%",
                      height: "auto",
                      aspectRatio: "1 / 1",
                      objectFit: "cover",
                      borderRadius: "inherit",
                    }}
                  />
                </Box>
              </Box>

              <Typography variant="h4">{drink.name}</Typography>

              <Typography
                variant="subtitle1"
                color="text.secondary"
                gutterBottom
                sx={{ mt: 1 }}
              >
                made by {drink.author || "Tipsyverse"}
              </Typography>

              {/* Desktop buttons */}
              <Box
                sx={{
                  mt: 2,
                  display: { xs: "none", sm: "flex" },
                  alignItems: "center",
                  gap: 2,
                  flexWrap: "wrap",
                }}
              >
                <Tooltip title={loggedInUser?.user ? "Like" : "Login to like"}>
                  <Button
                    onClick={handleLike}
                    variant="outlined"
                    disabled={!loggedInUser?.user}
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1,
                      pointerEvents: loggedInUser?.user ? "auto" : "none",
                      opacity: loggedInUser?.user ? 1 : 0.5,
                      color: liked ? "white" : "var(--primary-color)",
                      borderColor: liked ? "white" : "var(--primary-color)",
                      backgroundColor: liked ? "var(--primary-color)" : "white",
                    }}
                  >
                    <FavoriteBorder
                      sx={{
                        color: liked ? "white" : "var(--primary-color)",
                        animation: liked ? "bounce 0.4s ease" : "none",
                      }}
                    />
                    <Typography
                      sx={{ color: liked ? "white" : "var(--primary-color)" }}
                    >
                      {abbreviateNumber(likeCount)}
                    </Typography>
                  </Button>
                </Tooltip>

                <Tooltip title="Comments">
                  <Button
                    onClick={scrollToComments}
                    variant="outlined"
                    sx={{ gap: 1, borderColor: "var(--primary-color)" }}
                  >
                    <ChatBubbleOutline sx={{ color: "var(--primary-color)" }} />
                    <Typography sx={{ color: "var(--primary-color)" }}>
                      {abbreviateNumber(commentCount)}
                    </Typography>
                  </Button>
                </Tooltip>

                <Tooltip title="Share">
                  <Button
                    onClick={handleShare}
                    variant="outlined"
                    sx={{ gap: 1, borderColor: "var(--primary-color)" }}
                  >
                    <Share sx={{ color: "var(--primary-color)" }} />
                    <Typography sx={{ color: "var(--primary-color)" }}>
                      {abbreviateNumber(shareCount || 0)}
                    </Typography>
                  </Button>
                </Tooltip>

                <Tooltip title={loggedInUser?.user ? "Save" : "Login to save"}>
                  <Button
                    onClick={handleBookmark}
                    variant="outlined"
                    disabled={!loggedInUser?.user}
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1,
                      pointerEvents: loggedInUser?.user ? "auto" : "none",
                      opacity: loggedInUser?.user ? 1 : 0.5,
                      color: saved ? "white" : "var(--primary-color)",
                      borderColor: saved
                        ? "white"
                        : "var(--primary-color)",
                      backgroundColor: saved
                        ? "var(--primary-color)"
                        : "white",
                    }}
                  >
                    <BookmarkBorder
                      sx={{
                        color: saved ? "white" : "var(--primary-color)",
                        animation: saved ? "bounce 0.4s ease" : "none",
                      }}
                    />
                    <Typography>{saved ? "Saved" : "Save"}</Typography>
                  </Button>
                </Tooltip>
              </Box>

              {drink.description && (
                <Box sx={{ mt: 3 }}>
                  <Typography variant="subtitle2" color="text.secondary">
                    About this drink
                  </Typography>

                  <Typography paragraph sx={{ mb: 1 }}>
                    {showFullDesc || drink.description.length <= 180
                      ? drink.description
                      : `${shortDesc}…`}
                  </Typography>

                  {drink.description.length > 180 && (
                    <Button
                      size="small"
                      onClick={() => setShowFullDesc((v) => !v)}
                    >
                      {showFullDesc ? "Show less" : "Read more"}
                    </Button>
                  )}
                </Box>
              )}

              {drink.video && (
                <Box sx={{ mt: 2 }}>
                  <Button
                    variant="contained"
                    sx={{ backgroundColor: "var(--primary-color)", gap: 2 }}
                    href={drink.video}
                    target="_blank"
                  >
                    <PlayCircle /> Play Video
                  </Button>
                </Box>
              )}
            </Box>

            {/* RIGHT SIDE */}
            <Box>
              <Box
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 3,
                }}
              >
                 {/* Details */}
                <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
                  {/* ====== META AFTER ====== */}
                  <Box
                    ref={metaRef}
                    sx={{ mt: 0, scrollMarginTop: SCROLL_MARGIN }}
                  >
                    <Box display="flex" alignItems="center" gap={1}>
                      <InfoIcon
                        sx={{
                          color: "var(--primary-color)",
                          fontSize: 24,
                        }}
                      />

                      <Typography variant="h6">Details</Typography>
                    </Box>
                    {/* Categories (compressed) */}
                    <Box sx={{ mt: 2, display: "flex", gap: 1 }}>
                      <Typography
                        variant="subtitle2"
                        sx={{ mb: 1, color: "text.secondary" }}
                      >
                        Categories
                      </Typography>
                      <Stack
                        direction="row"
                        spacing={1}
                        flexWrap="wrap"
                        useFlexGap
                      >
                        {Array.isArray(drink.categories) &&
                        drink.categories.length > 0 ? (
                          (showAllCategories
                            ? drink.categories
                            : drink.categories.slice(0, MAX_INLINE_CHIPS)
                          ).map((name) => (
                            <Chip
                              key={name}
                              label={`${catIcon(name)} ${name}`}
                              size="small"
                              clickable
                              // onClick={() => handleTagClick("Categories", name)}
                              variant={catVariant(name)}
                              sx={catSx(name)}
                            />
                          ))
                        ) : (
                          <Chip
                            label="Categories not set"
                            size="small"
                            variant="outlined"
                            disabled
                            sx={{
                              mb: 1,
                              borderRadius: 2,
                              borderColor: "divider",
                              bgcolor: "grey.100",
                              color: "text.secondary",
                              fontStyle: "italic",
                            }}
                          />
                        )}
                        {Array.isArray(drink.categories) &&
                          drink.categories.length > MAX_INLINE_CHIPS && (
                            <Button
                              size="small"
                              variant="text"
                              onClick={() => setShowAllCategories((v) => !v)}
                              sx={{ ml: 1 }}
                            >
                              {showAllCategories
                                ? "Show less"
                                : `+${
                                    drink.categories.length - MAX_INLINE_CHIPS
                                  } more`}
                            </Button>
                          )}
                      </Stack>
                    </Box>

                    {/* Occasion / Holiday Tags (compressed) */}
                    <Box sx={{ mt: 2, display: "flex", gap: 1 }}>
                      <Typography
                        variant="subtitle2"
                        sx={{ mb: 1, color: "text.secondary" }}
                      >
                        Tags
                      </Typography>
                      <Stack
                        direction="row"
                        spacing={1}
                        flexWrap="wrap"
                        useFlexGap
                      >
                        {Array.isArray(drink.tags) && drink.tags.length > 0 ? (
                          (showAllTags
                            ? drink.tags
                            : drink.tags.slice(0, MAX_INLINE_CHIPS)
                          ).map((name) => (
                            <Chip
                              key={name}
                              icon={
                                <span style={{ fontSize: 14 }}>
                                  {tagIconFor(name)}
                                </span>
                              }
                              label={name}
                              size="small"
                              variant="outlined"
                              sx={tagChipSx(name)}
                              // onClick={() => handleTagClick("Tags", name)}
                              clickable
                            />
                          ))
                        ) : (
                          <Chip
                            icon={<TagIcon />}
                            label="No tags"
                            size="small"
                            variant="outlined"
                            disabled
                            sx={{
                              mb: 1,
                              borderRadius: 2,
                              borderColor: "divider",
                              bgcolor: "grey.100",
                              color: "text.secondary",
                              fontStyle: "italic",
                            }}
                          />
                        )}
                        {Array.isArray(drink.tags) &&
                          drink.tags.length > MAX_INLINE_CHIPS && (
                            <Button
                              size="small"
                              variant="text"
                              onClick={() => setShowAllTags((v) => !v)}
                              sx={{ ml: 1 }}
                            >
                              {showAllTags
                                ? "Show less"
                                : `+${
                                    drink.tags.length - MAX_INLINE_CHIPS
                                  } more`}
                            </Button>
                          )}
                      </Stack>
                    </Box>

                    {/* Attribute Tags */}
                    <Box sx={{ mt: 1 }}>
                      <TagRow
                        label="Taste"
                        icon={<TagIcon />}
                        items={toArray(drink.taste).map(String)}
                      />
                      <TagRow
                        label="Glass"
                        icon={<LocalBarIcon />}
                        items={drink.glass?.name ? [drink.glass.name] : []}
                      />
                      <TagRow
                        label="Tools"
                        icon={<BuildIcon />}
                        items={toArray(drink.tools)}
                      />
                      <TagRow
                        label="Garnishes"
                        icon={<SpaIcon />}
                        items={toArray(drink.garnishes)}
                      />
                    </Box>
                  </Box>
                </Paper>
                
                {/* Ingredients */}
                <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
                  <Box
                    ref={ingredientsRef}
                    sx={{ scrollMarginTop: SCROLL_MARGIN }}
                  >
                    <Box display="flex" alignItems="center" gap={1}>
                      <RestaurantMenuIcon
                        sx={{
                          color: "var(--primary-color)",
                          fontSize: 24,
                        }}
                      />

                      <Typography variant="h6">Ingredients</Typography>
                    </Box>
                    <Stack spacing={0.5} sx={{ mt: 1 }}>
                      {(drink.ingredients || []).map((item, idx) => (
                        <div key={idx}>{formatIngredient(item, idx)}</div>
                      ))}
                    </Stack>
                  </Box>
                </Paper>

                {/* Instructions */}
                <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
                  <Box
                    ref={instructionsRef}
                    sx={{ scrollMarginTop: SCROLL_MARGIN }}
                  >
                    <Box display="flex" alignItems="center" gap={1}>
                      <FormatListNumberIcon
                        sx={{
                          color: "var(--primary-color)",
                          fontSize: 24,
                        }}
                      />

                      <Typography variant="h6">Instructions</Typography>
                    </Box>

                    {(() => {
                      const steps = (drink.instructions || []).filter(Boolean);
                      const shouldCollapse = steps.length > 4;

                      return (
                        <>
                          <Box sx={{ position: "relative", mt: 1 }}>
                            {shouldCollapse ? (
                              <Collapse in={showAllSteps} collapsedSize={96}>
                                <ol
                                  id="instructions-list"
                                  style={{ paddingLeft: 24, margin: 0 }}
                                >
                                  {steps.map((item, index) => (
                                    <li key={index} style={{ marginBottom: 8 }}>
                                      <Typography>{item}</Typography>
                                    </li>
                                  ))}
                                </ol>
                              </Collapse>
                            ) : (
                              <ol
                                id="instructions-list"
                                style={{ paddingLeft: 24, margin: 0 }}
                              >
                                {steps.map((item, index) => (
                                  <li key={index} style={{ marginBottom: 16 }}>
                                    <Typography>{item}</Typography>
                                  </li>
                                ))}
                              </ol>
                            )}
                          </Box>

                          {shouldCollapse && (
                            <Button
                              size="small"
                              sx={{ mt: 1, px: 1 }}
                              onClick={() => setShowAllSteps((s) => !s)}
                            >
                              {showAllSteps
                                ? "Show less"
                                : `Show all ${steps.length} steps`}
                            </Button>
                          )}
                        </>
                      );
                    })()}
                  </Box>
                </Paper>
              </Box>
            </Box>
          </Box>

          {/* Comments */}
          <Box ref={commentSectionRef} sx={{ mt: 6, position: "relative" }}>
            {loggedInUser?.user && (
              <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 2 }}>
                <CommentSection
                  drinkId={drink?._id}
                  scrollToCommentId={commentIdFromURL}
                  numberComments={drink?.analytics?.counts?.comments}
                />
              </Paper>
            )}
            {!loggedInUser?.user && (
              <Paper
                variant="outlined"
                sx={{ p: 3, textAlign: "center", borderRadius: 2 }}
              >
                <Typography variant="h6" fontWeight="bold" sx={{ mb: 1 }}>
                  Login to join the conversation about “{drink.name}”
                </Typography>
                <Button
                  variant="contained"
                  sx={{ backgroundColor: "var(--primary-color)" }}
                  onClick={() => navigateOrReload(navigate, "/login")}
                >
                  Login
                </Button>
              </Paper>
            )}
          </Box>

          {/* ⭐ NEW: Sticky mobile action bar */}
          <Paper
            elevation={6}
            sx={{
              display: { xs: "flex", sm: "none" },
              position: "fixed",
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 1200,
              p: 1,
              borderTopLeftRadius: 12,
              borderTopRightRadius: 12,
              justifyContent: "space-around",
              alignItems: "center",
            }}
          >
            <Tooltip title={loggedInUser?.user ? "Like" : "Login to like"}>
              <Button
                onClick={handleLike}
                variant="outlined"
                disabled={!loggedInUser?.user}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                  pointerEvents: loggedInUser?.user ? "auto" : "none",
                  opacity: loggedInUser?.user ? 1 : 0.5,
                  color: liked ? "white" : "var(--primary-color)",
                  borderColor: liked ? "white" : "var(--primary-color)",
                  backgroundColor: liked ? "var(--primary-color)" : "white",
                }}
              >
                <FavoriteBorder
                  sx={{
                    color: liked ? "white" : "var(--primary-color)",
                    animation: liked ? "bounce 0.4s ease" : "none",
                  }}
                />
                <Typography
                  sx={{ color: liked ? "white" : "var(--primary-color)" }}
                >
                  {abbreviateNumber(likeCount)}
                </Typography>
              </Button>
            </Tooltip>

            <Tooltip title="Comments">
              <Button
                onClick={scrollToComments}
                variant="outlined"
                sx={{ gap: 1, borderColor: "var(--primary-color)" }}
              >
                <ChatBubbleOutline sx={{ color: "var(--primary-color)" }} />
                <Typography sx={{ color: "var(--primary-color)" }}>
                  {abbreviateNumber(commentCount)}
                </Typography>
              </Button>
            </Tooltip>

            <Tooltip title="Share">
              <Button
                onClick={handleShare}
                variant="outlined"
                sx={{ gap: 1, borderColor: "var(--primary-color)" }}
              >
                <Share sx={{ color: "var(--primary-color)" }} />
                <Typography sx={{ color: "var(--primary-color)" }}>
                  {abbreviateNumber(shareCount || 0)}
                </Typography>
              </Button>
            </Tooltip>

            <Tooltip title={loggedInUser?.user ? "Save" : "Login to save"}>
              <Button
                onClick={handleBookmark}
                variant="outlined"
                disabled={!loggedInUser?.user}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                  pointerEvents: loggedInUser?.user ? "auto" : "none",
                  opacity: loggedInUser?.user ? 1 : 0.5,
                  color: saved ? "white" : "var(--primary-color)",
                  borderColor: saved ? "white" : "var(--primary-color)",
                  backgroundColor: saved
                    ? "var(--primary-color)"
                    : "white",
                }}
              >
                <BookmarkBorder
                  sx={{
                    color: saved ? "white" : "var(--primary-color)",
                    animation: saved ? "bounce 0.4s ease" : "none",
                  }}
                />
                <Typography>{saved ? "Saved" : "Save"}</Typography>
              </Button>
            </Tooltip>
          </Paper>
        </Box>
      )}

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={3000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={() => setSnackbarOpen(false)}
          severity="success"
          sx={{ width: "100%" }}
        >
          Link copied to clipboard!
        </Alert>
      </Snackbar>
    </PublicLayout>
  );
};

export default DrinkDetailScreen;
