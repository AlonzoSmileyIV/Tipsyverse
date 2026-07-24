// components/DrinkCard.js
import React, { useMemo } from "react";
import {
  Card,
  CardMedia,
  CardContent,
  Typography,
  Box,
  Button,
} from "@mui/material";

import { useNavigate } from "react-router-dom";
import { navigateOrReload } from "../../utils/navigateOrReload";


const DrinkCard = ({ drink, rank, userAllergies = [] }) => {
  const navigate = useNavigate();

  // Normalize allergies once for O(1) lookups
  const allergenSet = useMemo(
    () =>
      new Set(
        (userAllergies || [])
          .map((a) =>
            String(a || "")
              .trim()
              .toLowerCase()
          )
          .filter(Boolean)
      ),
    [userAllergies]
  );

  const hasAllergy = (drinkObj, set) => {
    const ings = drinkObj?.ingredients || [];
    if (!ings.length || set.size === 0) return false;

    return ings.some((ing) => {
      // support both string or object ingredient shapes
      const name = typeof ing === "string" ? ing : ing?.name || ing?.ingredient;
      if (!name) return false;
      return set.has(String(name).trim().toLowerCase());
    });
  };

  const allergyFlag = hasAllergy(drink, allergenSet);

 
  const handleOpen = () => navigateOrReload(navigate, `/drinks/${drink.slug}`);

  return (
    <Card
      role="button"
      tabIndex={0}
      aria-label={`Open ${drink?.name || "drink"} details`}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && handleOpen()}
      sx={{
        position: "relative",
        borderRadius: 4,
        width: 240,
        height: 300,
        mx: "auto",
        border: allergyFlag ? "2px solid red" : "1px solid",
        borderColor: allergyFlag ? "error.main" : "divider",
        cursor: "pointer",
        backgroundColor: "background.paper",
        boxShadow: "0px 1px 3px rgba(0,0,0,0.12), 0px 1px 2px rgba(0,0,0,0.08)", // ✅ soft subtle shadows
        transition: "transform 160ms ease, box-shadow 160ms ease",
        "&:hover": {
          transform: "translateY(-2px)",
          boxShadow:
            "0px 4px 6px rgba(0,0,0,0.1), 0px 2px 4px rgba(0,0,0,0.06)", // ✅ gentle lift
        },
        "&:focus-visible": {
          outline: "3px solid",
          outlineColor: "primary.main",
          outlineOffset: "2px",
        },
      }}
      onClick={handleOpen}
    >
      {allergyFlag && (
        <Box
          sx={{
            position: "absolute",
            top: 10,
            right: 10,
            backgroundColor: "red",
            color: "white",
            px: 1,
            py: 0.5,
            borderRadius: 1,
            fontSize: 12,
            zIndex: 2,
          }}
        >
          ⚠ Allergy
        </Box>
      )}
      {rank && (
        <Box
          sx={{
            position: "absolute",
            top: 10,
            left: 10,
            backgroundColor: "rgba(255, 69, 58, 0.9)",
            color: "white",
            borderRadius: "50%",
            width: 36,
            height: 36,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: "bold",
            fontSize: 14,
            zIndex: 2,
          }}
        >
          {rank}
        </Box>
      )}
      <CardMedia
        component="img"
        image={
          drink.photo ||
          "https://res.cloudinary.com/dtbgyeyjq/image/upload/v1747893721/default/drink.png"
        }
        alt={drink.name}
        sx={{
          height: 160, // ✅ fixed media height
          objectFit: "cover",
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
        }}
      />
      <CardContent
        sx={{
          flex: 1, // take remaining space
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          textAlign: "center",
          p: 1.5,
        }}
      >
        <Typography
          variant="h6"
          gutterBottom
          noWrap
          sx={{
            fontWeight: 700,
            display: "-webkit-box",
            WebkitLineClamp: 2, // ✅ clamp to 2 lines
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            minHeight: 44, // ~2 lines height
          }}
        >
          {drink.name}
        </Typography>
         <Button
         onClick={handleOpen}
          
          sx={{color: 'var(--primary-color)', 
            border: '1px solid var(--primary-color)',
             mt: 2}}
          fullWidth
         
       >
          View Drink
       </Button>
       
      </CardContent>
    </Card>
  );
};

export default DrinkCard;
