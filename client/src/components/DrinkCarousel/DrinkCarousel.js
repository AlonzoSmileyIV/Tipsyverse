// components/DrinkCarousel.js
import React, {useMemo} from "react";
import { Box, Typography } from "@mui/material";
import DrinkCard from "../DrinkCard/DrinkCard";
import { Navigation } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css";
import "swiper/css/navigation";
import "./styles.scss";
import {  useSelector } from "react-redux";


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
      <Swiper
        modules={[Navigation]}
        navigation
        spaceBetween={16}
        slidesPerView={1}
        breakpoints={{ 640: { slidesPerView: 3 }, 1024: { slidesPerView: 5 } }}
      >
        {normalizedDrinks.map((drink, index) => (
          <SwiperSlide key={drink._id || drink.slug || index}>
            <DrinkCard
              drink={drink}
              rank={showRank ? index + 1 : undefined}
              userAllergies={userAllergies}
            />
          </SwiperSlide>
        ))}
      </Swiper>
    </Box>
  );
};

export default DrinkCarousel;
