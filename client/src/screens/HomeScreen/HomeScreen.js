import React, { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link as RouterLink } from "react-router-dom";
import { Box, Button, Paper, Stack, Typography } from "@mui/material";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import SchoolOutlinedIcon from "@mui/icons-material/SchoolOutlined";
import {
  fetchMostRecentDrinks,
  fetchRecommendedDrinks,
  fetchTopTrending,
  fetchDrinksByCategory,
} from "../../features/drinks/drinkSlice";
import { fetchMe, fetchMyBartenderInfo } from "../../features/users/userSlice";

import HelmetHeader from "../../components/HelmetHeader/Helmet";
import DrinkCarousel from "../../components/DrinkCarousel/DrinkCarousel";
import TestimonialsCarousel from "../../components/TestimonialsCarousel/TestimonialsCarousel";
import UniqueFeatures from "../../components/UniqueFeatures/UniqueFeatures";
import Statistics from "../../components/Statistics/Statistics";
import Hero from "../../components/Hero/Hero";
import PublicLayout from "../../components/PublicLayout/PublicLayout";
import LoadingSkeleton from "../../components/LoadingSkeleton/LoadingSkeleton";

const SEASONAL_CATEGORIES = ["Fall", "Winter", "Spring", "Summer"];
const CATEGORY_ICONS = {
  Classic: "🍸",
  Party: "🎉",
  "Easy at Home": "🏠",
  Fall: "🍂",
  Winter: "❄️",
  Spring: "🌿",
  Summer: "☀️",
};

const getCurrentSeason = () => {
  const month = new Date().getMonth();
  if (month >= 2 && month <= 4) return "Spring";
  if (month >= 5 && month <= 7) return "Summer";
  if (month >= 8 && month <= 10) return "Fall";
  return "Winter";
};

const getCategoryHeader = (category) => {
  const icon = CATEGORY_ICONS[category] || "✨";
  return SEASONAL_CATEGORIES.includes(category)
    ? `${icon} ${category} Cocktails You Need to Try`
    : `${icon} Our ${category} Drinks`;
};

const drinkRows = (value) => {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.items)) return value.items;
  return [];
};

const BartenderCoursePromo = ({ onStart }) => (
  <Box sx={{ px: { xs: 2, md: 4 }, my: { xs: 3, md: 5 } }}>
    <Paper
      elevation={0}
      sx={{
        maxWidth: 1180,
        mx: "auto",
        p: { xs: 2.5, md: 3 },
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 2,
        background:
          "linear-gradient(135deg, rgba(128,0,32,0.08), rgba(255,255,255,0.96))",
      }}
    >
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={2}
        alignItems={{ xs: "flex-start", md: "center" }}
        justifyContent="space-between"
      >
        <Stack direction="row" spacing={1.5} alignItems="flex-start">
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: "50%",
              bgcolor: "var(--primary-color)",
              color: "#fff",
              display: "grid",
              placeItems: "center",
              flexShrink: 0,
            }}
          >
            <SchoolOutlinedIcon />
          </Box>
          <Box>
            <Typography variant="h6" fontWeight={800}>
              Interested in becoming a Tipsyverse bartender?
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Start with Tipsyverse Bartending Foundations and learn the basics
              before applying for event work.
            </Typography>
          </Box>
        </Stack>

        <Button
          component={RouterLink}
          to="/learn"
          onClick={onStart}
          variant="contained"
          endIcon={<ArrowForwardIcon />}
          sx={{
            bgcolor: "var(--primary-color)",
            whiteSpace: "nowrap",
            "&:hover": { bgcolor: "var(--primary-color)" },
          }}
        >
          Start the course
        </Button>
      </Stack>
    </Paper>
  </Box>
);



const HomeScreen = () => {
  const dispatch = useDispatch();
  const { loggedInUser } = useSelector((state) => state.users);
  const userRole = loggedInUser?.user?.role;
  const showBartenderCoursePromo = userRole === "regular";

  const { topTrending, recommendedDrinks, mostRecentDrinks, categoryDrinks } =
    useSelector((state) => state.drinks);

  const [showContent, setShowContent] = useState(false);
  const categoriesToShow = useMemo(() => {
    const currentSeason = getCurrentSeason();
    return [
      "Classic",
      "Party",
      "Easy at Home",
      currentSeason,
      "Tipsyverse Originals",
    ];
  }, []);

  useEffect(() => {
    dispatch(fetchTopTrending());
    dispatch(fetchMostRecentDrinks());
    if (loggedInUser?.user?._id) {
      dispatch(fetchRecommendedDrinks());
    }

    categoriesToShow.forEach((name) =>
      dispatch(fetchDrinksByCategory({ name, limit: 12 }))
    );
  }, [dispatch, loggedInUser?.user?._id, categoriesToShow]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowContent(true);
    }, 1500); // 1.5 seconds

    return () => clearTimeout(timer);
  }, []);

  const topTrendingRows = drinkRows(topTrending);
  const recommendedRows = drinkRows(recommendedDrinks);
  const mostRecentRows = drinkRows(mostRecentDrinks);
  const isLoading = topTrending.loading || !showContent;
  const handleStartBartenderCourse = () => {
    dispatch(fetchMe());
    dispatch(fetchMyBartenderInfo());
  };

  return (
    <PublicLayout>
      <HelmetHeader
        title="Tipsyverse | Discover Cocktails"
        description="Find trending cocktail recipes, share your creations, and sip your way through inspiration."
        keywords="cocktail recipes, trending drinks, mixology, tipsyverse"
      />
      {isLoading ? (
        <LoadingSkeleton />
      ) : (
        <>
          <Hero />

          {showBartenderCoursePromo && (
            <BartenderCoursePromo onStart={handleStartBartenderCourse} />
          )}

          <DrinkCarousel
            drinksData={topTrendingRows}
            type="trending"
            header="🔥 Our Trending Drinks"
          />

          {loggedInUser?.user?._id && recommendedRows.length > 0 && (
            <DrinkCarousel
              drinksData={recommendedRows}
              type="recommended"
              header={`🎯 You might like these drinks, too`}
            />
          )}

          {/* Category lanes */}
          {categoriesToShow.map((cat) => {
            const lane = categoryDrinks[cat];
            const laneRows = drinkRows(lane);

            if (!laneRows.length) return null;

            return (
              <DrinkCarousel
                key={cat}
                drinksData={laneRows}
                type="category"
                header={getCategoryHeader(cat)}
              />
            );
          })}

          {mostRecentRows.length > 0 && (
            <DrinkCarousel
              drinksData={mostRecentRows}
              header="⏳ Most Recent Drinks"
            />
          )}

          <UniqueFeatures />
          <Statistics />
          <TestimonialsCarousel />
        </>
      )}
    </PublicLayout>
  );
};

export default HomeScreen;
