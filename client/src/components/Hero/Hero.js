import React, { useEffect, useState } from "react";
import {
  Box,
  Typography,
  Button,
  Container,
  Stack,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import heroCocktailImg from "../../assets/images/hero-cocktail.jpg";
import { navigateOrReload } from "../../utils/navigateOrReload";

const heroSlides = [
  {
    heading: "Discover, Create, and Share Cocktail Recipes",
    description:
      "Explore trending cocktails, save your favorites, and discover new drinks for every occasion.",
    buttonLabel: "Explore Our Drinks",
    link: "/drinks",
  },
  {
    heading: "Bring the Tipsyverse Experience to Your Event",
    description:
      "Request professional bartending services for weddings, parties, corporate events, and other special occasions.",
    buttonLabel: "Book an Event",
    link: "/events/book",
  },
  {
    heading: "Bartend With Tipsyverse",
    description:
      "Complete training, build your experience, apply for events, and grow with a professional bartending team.",
    buttonLabel: "Become a Bartender",
    link: "/bartend",
  },
];

const Hero = () => {
  const navigate = useNavigate();

  const [activeSlide, setActiveSlide] = useState(0);
  const [visible, setVisible] = useState(true);

  const changeSlide = (nextIndex) => {
    if (nextIndex === activeSlide) return;

    setVisible(false);

    window.setTimeout(() => {
      setActiveSlide(nextIndex);
      setVisible(true);
    }, 350);
  };

  useEffect(() => {
    const interval = window.setInterval(() => {
      setVisible(false);

      window.setTimeout(() => {
        setActiveSlide((current) => (current + 1) % heroSlides.length);
        setVisible(true);
      }, 350);
    }, 15000); // 15 seconds

    return () => window.clearInterval(interval);
  }, []);

  const slide = heroSlides[activeSlide];

  return (
    <Box
      component="section"
      sx={{
        position: "relative",
        minHeight: { xs: 430, md: 520 },
        display: "flex",
        alignItems: "center",
        backgroundImage: `url(${heroCocktailImg})`,
        backgroundSize: "cover",
        backgroundRepeat: "no-repeat",
        backgroundPosition: { xs: "center", md: "center right" },
        backgroundColor: "#0f0f10",
        py: { xs: 6, md: 10 },
        overflow: "hidden",
      }}
    >
      {/* Gradient overlay */}
      <Box
        aria-hidden="true"
        sx={{
          position: "absolute",
          inset: 0,
          background: {
            xs: "linear-gradient(90deg, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0.58) 100%)",
            md: "linear-gradient(90deg, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.44) 42%, rgba(0,0,0,0.10) 70%, rgba(0,0,0,0) 100%)",
          },
        }}
      />

      <Container
        maxWidth="lg"
        sx={{
          position: "relative",
          zIndex: 1,
        }}
      >
        <Box
          sx={{
            width: { xs: "100%", md: "58%" },
            color: "#fff",
            opacity: visible ? 1 : 0,
            transform: visible ? "translateY(0)" : "translateY(18px)",
            transition:
              "opacity 350ms ease-in-out, transform 350ms ease-in-out",
          }}
        >
          <Typography
            variant="h3"
            sx={{
              fontWeight: 800,
              fontSize: {
                xs: "2rem",
                sm: "2.5rem",
                md: "3rem",
              },
              lineHeight: 1.15,
              mb: 2,
            }}
          >
            {slide.heading}
          </Typography>

          <Typography
            variant="h6"
            sx={{
              color: "rgba(255,255,255,0.9)",
              mb: 4,
              fontWeight: 400,
              lineHeight: 1.6,
              maxWidth: 650,
            }}
          >
            {slide.description}
          </Typography>

          <Button
            variant="contained"
            onClick={() => navigateOrReload(navigate, slide.link)}
            sx={{
              px: 4,
              py: 1.5,
              fontSize: "1rem",
              textTransform: "none",
              backgroundColor: "var(--primary-color)",
              boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
              "&:hover": {
                backgroundColor: "var(--primary-color)",
                opacity: 0.9,
              },
            }}
          >
            {slide.buttonLabel}
          </Button>
        </Box>

        {/* Slide indicators */}
        <Stack
          direction="row"
          spacing={1}
          sx={{
            position: "absolute",
            left: { xs: 24, sm: 32 },
            bottom: { xs: -42, md: -72 },
          }}
        >
          {heroSlides.map((item, index) => (
            <Box
              key={item.heading}
              component="button"
              type="button"
              aria-label={`Show hero slide ${index + 1}`}
              aria-current={index === activeSlide ? "true" : undefined}
              onClick={() => changeSlide(index)}
              sx={{
                width: index === activeSlide ? 28 : 10,
                height: 10,
                p: 0,
                border: 0,
                borderRadius: 999,
                cursor: "pointer",
                backgroundColor:
                  index === activeSlide
                    ? "var(--primary-color)"
                    : "rgba(255,255,255,0.55)",
                transition:
                  "width 250ms ease, background-color 250ms ease",
              }}
            />
          ))}
        </Stack>
      </Container>
    </Box>
  );
};

export default Hero;
