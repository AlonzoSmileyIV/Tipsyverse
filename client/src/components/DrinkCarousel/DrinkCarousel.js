// components/DrinkCarousel.js
import React, {useMemo} from "react";
import { Box, IconButton, Typography } from "@mui/material";
import DrinkCard from "../DrinkCard/DrinkCard";
import Carousel from "react-multi-carousel";
import "react-multi-carousel/lib/styles.css";
import "./styles.scss";
import { ChevronLeft, ChevronRight } from "@mui/icons-material";
import {  useSelector } from "react-redux";


const responsive = {
  desktop: {
    breakpoint: { max: 3000, min: 1024 },
    items: 5,
  },
  tablet: {
    breakpoint: { max: 1024, min: 640 },
    items: 3,
  },
  mobile: {
    breakpoint: { max: 640, min: 0 },
    items: 1,
  },
};

const mockDrinks = [
  {
    name: "Tequila Sunrise",
    slug: "tequila-sunrise",
    photo: "https://images.unsplash.com/photo-1617191511007-88b2e4e4e207",
  },
  {
    name: "Mojito",
    slug: "mojito",
    photo: "https://images.unsplash.com/photo-1610474522455-7f85bdefb534",
  },
  {
    name: "Old Fashioned",
    slug: "old-fashioned",
    photo: "https://images.unsplash.com/photo-1603117988374-c37f9dbb30e4",
  },
  {
    name: "Mai Tai",
    slug: "mai-tai",
    photo: "https://images.unsplash.com/photo-1627662058663-d14a83ec6d77",
  },
  {
    name: "Cosmopolitan",
    slug: "cosmopolitan",
    photo: "https://images.unsplash.com/photo-1609630879647-55e8e9e9ccec",
  },
  {
    name: "Pina Colada",
    slug: "pina-colada",
    photo: "https://images.unsplash.com/photo-1611930029391-0e68a8d4d1b9",
  },
  {
    name: "Whiskey Sour",
    slug: "whiskey-sour",
    photo: "https://images.unsplash.com/photo-1581404917879-0e7f82d3e89d",
  },
  {
    name: "Negroni",
    slug: "negroni",
    photo: "https://images.unsplash.com/photo-1611080626919-4040c64d9f3b",
  },
  {
    name: "Margarita",
    slug: "margarita",
    photo: "https://images.unsplash.com/photo-1604079629048-327f1b5b1c59",
  },
  {
    name: "Bloody Mary",
    slug: "bloody-mary",
    photo: "https://images.unsplash.com/photo-1611605693169-b64a1a77f062",
  },
];

// ⬇️ Define outside your component
const CustomRightArrow = ({ onClick }) => (
  <IconButton
    onClick={onClick}
    sx={{
      position: "absolute",
      right: 0,
      top: "40%",
      zIndex: 1,
      backgroundColor: "rgba(0,0,0,0.1)",
    }}
  >
    <ChevronRight />
  </IconButton>
);

const CustomLeftArrow = ({ onClick }) => (
  <IconButton
    onClick={onClick}
    sx={{
      position: "absolute",
      left: 0,
      top: "40%",
      zIndex: 1,
      backgroundColor: "rgba(0,0,0,0.1)",
    }}
  >
    <ChevronLeft />
  </IconButton>
);

const DrinkCarousel = ({
  drinksData = mockDrinks,
  type = "trending",
  header = "",
  seeAllHref,                 // ✅ new (optional)
  limit = 12,                 // ✅ optional cap per lane
}) => {
  const drinks = type === "trending" ? drinksData?.slice(0, 10) : drinksData;
  const { loggedInUser } = useSelector((state) => state.users);
  const userAllergies = useMemo(() => loggedInUser?.user?.preferences?.allergies || [], [loggedInUser]);

  const normalizedDrinks = useMemo(
    () =>
      drinks.map((d) => ({
        ...d,
        ingredients:
          d?.ingredients ??
          d?.recipe?.ingredients ?? // if your API used another key
          [], // fallback: nothing => allergy check will be false
      })),
    [drinks]
  );

    const showRank = type === "trending"; // ✅ only Trending shows rank


  return (
    <Box sx={{ px: { xs: 1, sm: 2, md: 4 }, py: 6, backgroundColor: "#fff" }}>
      <Typography variant="h4" gutterBottom textAlign="left">
        {header}
      </Typography>
      <Carousel
        responsive={responsive}
        infinite={false}
        arrows
        //beforeChange={(nextSlide) => setCurrentSlide(nextSlide)}
        customRightArrow={<CustomRightArrow />}
        customLeftArrow={<CustomLeftArrow />}
      >
        {normalizedDrinks.map((drink, index) => (
         <DrinkCard
            key={drink._id || drink.slug || index}
            drink={drink}
            rank={showRank ? index + 1 : undefined}   // ✅ rank only for trending
            userAllergies={userAllergies}
          />
        ))}
      </Carousel>
    </Box>
  );
};

export default DrinkCarousel;
