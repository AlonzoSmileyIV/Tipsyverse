import React from "react";
import { Box, Paper, Typography } from "@mui/material";

function AdminSummaryCards({ cards = [], selectedKey, onSelect, maxColumns = 6, sx }) {
  if (!cards.length) return null;

  const mediumColumns = Math.min(3, maxColumns, cards.length);
  const wideColumns = Math.min(maxColumns, cards.length);

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: {
          xs: "1fr",
          sm: "repeat(2, minmax(0, 1fr))",
          md: `repeat(${mediumColumns}, minmax(0, 1fr))`,
          xl: `repeat(${wideColumns}, minmax(0, 1fr))`,
        },
        gap: 1.5,
        mb: 2,
        ...sx,
      }}
    >
      {cards.map((card) => {
        const selected = selectedKey === card.key;
        return (
          <Paper
            key={card.key}
            variant="outlined"
            component="button"
            type="button"
            onClick={() => onSelect?.(card.key)}
            disabled={card.disabled}
            sx={{
              p: 1.5,
              textAlign: "left",
              cursor: card.disabled ? "default" : "pointer",
              borderColor: selected ? "var(--primary-color)" : "divider",
              bgcolor: selected ? "rgba(139, 0, 38, 0.06)" : "background.paper",
              color: "text.primary",
              font: "inherit",
              minWidth: 0,
              opacity: card.disabled ? 0.65 : 1,
              "&:hover": {
                borderColor: card.disabled ? "divider" : "var(--primary-color)",
                bgcolor: card.disabled
                  ? "background.paper"
                  : selected
                  ? "rgba(139, 0, 38, 0.08)"
                  : "rgba(128, 0, 32, 0.04)",
              },
            }}
          >
            <Typography variant="h5" fontWeight={700}>
              {card.count}
            </Typography>
            <Typography variant="subtitle2">{card.label}</Typography>
            {card.description && (
              <Typography variant="caption" color="text.secondary">
                {card.description}
              </Typography>
            )}
          </Paper>
        );
      })}
    </Box>
  );
}

export default AdminSummaryCards;
